import assert from "node:assert/strict";
import {after, before, beforeEach, test} from "node:test";
import {createApp} from "../src/app.js";

const key = "94f1e794-240d-4c79-8fb2-d4927331ebef";
const input = {
  customerName: "Asha Shah",
  phone: "+91 98765 43210",
  deliveryAddress: "12 Garden Road, Kolhapur 416001",
  items: [{productId: "product-1", quantity: 2}],
};

const state = {
  products: [],
  customers: [],
  orders: [],
  movements: [],
  settings: null,
};

function clone(value) {
  return structuredClone(value);
}

const fakeDb = {
  $queryRaw: async () => [{result: 1}],
  product: {
    findMany: async ({where}) => state.products.filter(product =>
      where.id.in.includes(product.id)
      && product.isAvailable
      && product.category.isActive,
    ),
  },
  category: {findMany: async () => []},
  storeSettings: {
    findFirst: async () => state.settings,
  },
  customer: {
    upsert: async ({where, create, update}) => {
      let customer = state.customers.find(item => item.phone === where.phone);
      if (customer) Object.assign(customer, update);
      else {
        customer = {id: `customer-${state.customers.length + 1}`, ...create};
        state.customers.push(customer);
      }
      return {id: customer.id};
    },
  },
  order: {
    findUnique: async ({where, select}) => {
      const order = state.orders.find(item =>
        (where.checkoutKey && item.checkoutKey === where.checkoutKey)
        || (where.orderNumber && item.orderNumber === where.orderNumber),
      );
      if (!order) return null;
      if (select?.checkoutHash) return {...order, items: clone(order.items)};
      const {customerId: _customerId, deliveryAddress: _deliveryAddress, checkoutKey: _checkoutKey, checkoutHash: _checkoutHash, ...safe} = order;
      return safe;
    },
    create: async ({data}) => {
      const order = {
        id: `order-${state.orders.length + 1}`,
        ...data,
        createdAt: new Date("2026-11-04T18:00:00.000Z"),
        items: data.items.create.map((item, index) => ({id: `item-${index + 1}`, ...item})),
      };
      state.orders.push(order);
      return order;
    },
  },
  stockMovement: {
    create: async ({data}) => {
      const movement = {id: `movement-${state.movements.length + 1}`, ...data};
      state.movements.push(movement);
      return movement;
    },
  },
  $transaction: async (operation, options) => {
    assert.equal(options.isolationLevel, "Serializable");
    const snapshot = clone(state);
    const tx = {
      storeSettings: fakeDb.storeSettings,
      product: {
        findMany: fakeDb.product.findMany,
        updateMany: async ({where, data}) => {
          const product = state.products.find(item =>
            item.id === where.id
            && item.isAvailable === where.isAvailable
            && item.stockQuantity >= where.stockQuantity.gte
            && item.category.isActive,
          );
          if (!product) return {count: 0};
          product.stockQuantity -= data.stockQuantity.decrement;
          return {count: 1};
        },
      },
      customer: fakeDb.customer,
      order: fakeDb.order,
      stockMovement: fakeDb.stockMovement,
    };
    try {
      return await operation(tx);
    } catch (error) {
      Object.assign(state, snapshot);
      throw error;
    }
  },
};

let server;
let baseUrl;

before(async () => {
  server = createApp({db: fakeDb, logger: {error() {}}}).listen(0);
  await new Promise(resolve => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

beforeEach(() => {
  state.products = [{
    id: "product-1",
    name: "Kaju Katli",
    price: "123.45",
    stockQuantity: 5,
    isAvailable: true,
    category: {isActive: true},
  }];
  state.customers = [];
  state.orders = [];
  state.movements = [];
  state.settings = {deliveryFee: "25.50", minimumOrderAmount: "200.00", isOperating: true};
});

after(async () => {
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
});

async function postOrder(body = input, idempotencyKey = key) {
  const response = await fetch(`${baseUrl}/api/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify(body),
  });
  return {response, body: await response.json()};
}

test("checkout ignores client price fields and calculates prices, order items, and delivery in a transaction", async () => {
  const request = {...input, items: [{...input.items[0], price: 0, subtotal: 0}], total: 0};
  const result = await postOrder(request);
  assert.equal(result.response.status, 201);
  assert.equal(result.body.data.order.subtotal, "246.90");
  assert.equal(result.body.data.order.deliveryFee, "25.50");
  assert.equal(result.body.data.order.total, "272.40");
  assert.equal(result.body.data.order.items[0].unitPrice, "123.45");
  assert.equal(state.products[0].stockQuantity, 3);
  assert.equal(state.orders.length, 1);
  assert.equal(state.movements.length, 1);
  assert.equal(state.movements[0].quantityChange, -2);
  assert.equal(state.movements[0].newQuantity, 3);
});

test("checkout idempotency replays an order without charging stock twice and rejects key reuse", async () => {
  const first = await postOrder();
  const replay = await postOrder();
  assert.equal(first.response.status, 201);
  assert.equal(replay.response.status, 200);
  assert.equal(replay.body.data.replayed, true);
  assert.equal(replay.body.data.order.orderNumber, first.body.data.order.orderNumber);
  assert.equal(state.products[0].stockQuantity, 3);
  assert.equal(state.orders.length, 1);
  assert.equal(state.movements.length, 1);

  const changedRequest = await postOrder({...input, customerName: "Different Customer"});
  assert.equal(changedRequest.response.status, 409);
  assert.equal(changedRequest.body.error.code, "IDEMPOTENCY_KEY_REUSED");
});

test("checkout validates availability, stock, minimum order, operating state, and request fields", async () => {
  const invalidBody = await postOrder({...input, items: [{productId: "product-1", quantity: 0}]}, crypto.randomUUID());
  assert.equal(invalidBody.response.status, 400);

  const overStock = await postOrder({...input, items: [{productId: "product-1", quantity: 6}]}, crypto.randomUUID());
  assert.equal(overStock.response.status, 409);
  assert.equal(overStock.body.error.code, "INSUFFICIENT_STOCK");
  assert.equal(state.products[0].stockQuantity, 5);

  const notAvailable = await postOrder({...input, items: [{productId: "missing-product", quantity: 1}]}, crypto.randomUUID());
  assert.equal(notAvailable.response.status, 409);
  assert.equal(notAvailable.body.error.code, "PRODUCT_UNAVAILABLE");

  state.settings.minimumOrderAmount = "300.00";
  const belowMinimum = await postOrder(input, crypto.randomUUID());
  assert.equal(belowMinimum.response.status, 400);
  assert.equal(belowMinimum.body.error.code, "MINIMUM_ORDER_NOT_MET");
  assert.equal(state.products[0].stockQuantity, 5);

  state.settings.isOperating = false;
  const closed = await postOrder(input, crypto.randomUUID());
  assert.equal(closed.response.status, 409);
  assert.equal(closed.body.error.code, "STORE_CLOSED");
  assert.equal(state.products[0].stockQuantity, 5);
});

test("idempotency header is required and public confirmation omits customer contact and address", async () => {
  const missingKey = await postOrder(input, "");
  assert.equal(missingKey.response.status, 400);

  const created = await postOrder();
  const confirmation = await fetch(`${baseUrl}/api/orders/${encodeURIComponent(created.body.data.order.orderNumber)}`);
  assert.equal(confirmation.status, 200);
  const body = await confirmation.json();
  assert.equal(body.data.orderNumber, created.body.data.order.orderNumber);
  assert.equal("customerId" in body.data, false);
  assert.equal("deliveryAddress" in body.data, false);
  assert.equal(JSON.stringify(body).includes(input.phone), false);
});
