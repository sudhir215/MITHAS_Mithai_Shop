import assert from "node:assert/strict";
import {after, before, beforeEach, test} from "node:test";
import {createApp} from "../src/app.js";
import {hashToken} from "../src/middleware/adminAuth.js";
import {getDashboardAnalytics} from "../src/services/adminOperationsService.js";

const sessionToken = "C".repeat(43);
const csrfToken = "D".repeat(43);
let role = "OWNER";
let products;
let movements;
let customers;
let orders;
let capturedInventoryQuery;
let forceStockConflict;
let failMovementInsert;

const fakeDb = {
  adminSession: {
    findUnique: async ({where}) => where.tokenHash === hashToken(sessionToken) ? {
      tokenHash: where.tokenHash,
      csrfTokenHash: hashToken(csrfToken),
      expiresAt: new Date(Date.now() + 60_000),
      admin: {id: "admin-1", email: "owner@example.test", role},
    } : null,
  },
  product: {
    findMany: async args => {
      capturedInventoryQuery = args;
      const {where} = args;
      const filtered = products.filter(product =>
        (!where.stockQuantity || (
          (where.stockQuantity.gt === undefined || product.stockQuantity > where.stockQuantity.gt)
          && (where.stockQuantity.lte === undefined || product.stockQuantity <= where.stockQuantity.lte)
        ))
        && (where.stockQuantity !== 0 || product.stockQuantity === 0)
        && (!where.OR || where.OR.some(term =>
          product.name.toLowerCase().includes(term.name?.contains?.toLowerCase() ?? "\0")
          || product.slug.toLowerCase().includes(term.slug?.contains?.toLowerCase() ?? "\0"))),
      );
      if (args.where.id?.in) {
        return products.filter(product => args.where.id.in.includes(product.id)).map(({id, name, imageUrl}) => ({id, name, imageUrl}));
      }
      return filtered.slice(args.skip, args.skip + args.take);
    },
    count: async ({where}) => products.filter(product =>
      (!where.stockQuantity || (
        (where.stockQuantity.gt === undefined || product.stockQuantity > where.stockQuantity.gt)
        && (where.stockQuantity.lte === undefined || product.stockQuantity <= where.stockQuantity.lte)
      ))
      && (where.stockQuantity !== 0 || product.stockQuantity === 0),
    ).length,
    findUnique: async ({where}) => products.find(product => product.id === where.id) ?? null,
    updateMany: async ({where, data}) => {
      if (forceStockConflict) return {count: 0};
      const product = products.find(item => item.id === where.id && item.stockQuantity === where.stockQuantity);
      if (!product) return {count: 0};
      product.stockQuantity = data.stockQuantity;
      return {count: 1};
    },
  },
  stockMovement: {
    create: async ({data, include}) => {
      if (failMovementInsert) throw new Error("mock audit insert failure");
      const movement = {
        id: `movement-${movements.length + 1}`,
        ...data,
        createdAt: new Date("2026-11-04T12:00:00.000Z"),
        ...(include ? {
          product: {id: products.find(product => product.id === data.productId).id, name: products.find(product => product.id === data.productId).name},
          admin: {id: data.adminId, email: "owner@example.test"},
        } : {}),
      };
      movements.push(movement);
      return movement;
    },
    findMany: async ({where, skip, take}) => movements.filter(movement => !where.productId || movement.productId === where.productId).slice(skip, skip + take),
    count: async ({where}) => movements.filter(movement => !where.productId || movement.productId === where.productId).length,
  },
  customer: {
    findMany: async ({where, skip, take}) => customers.filter(customer => !where.OR || where.OR.some(term =>
      customer.name.toLowerCase().includes(term.name?.contains?.toLowerCase() ?? "\0")
      || customer.phone.includes(term.phone?.contains ?? "\0")
      || customer.email?.toLowerCase().includes(term.email?.contains?.toLowerCase() ?? "\0"),
    )).slice(skip, skip + take),
    count: async ({where}) => customers.filter(customer => !where.OR || where.OR.some(term =>
      customer.name.toLowerCase().includes(term.name?.contains?.toLowerCase() ?? "\0")
      || customer.phone.includes(term.phone?.contains ?? "\0")
      || customer.email?.toLowerCase().includes(term.email?.contains?.toLowerCase() ?? "\0"),
    )).length,
    findUnique: async ({where}) => customers.find(customer => customer.id === where.id) ?? null,
  },
  order: {
    groupBy: async args => {
      if (args.by.includes("productId")) {
        return [{productId: "product-1", _sum: {quantity: 7, subtotal: "700.00"}}];
      }
      return [{customerId: "customer-1", _sum: {total: "700.00"}}];
    },
    findMany: async ({where}) => orders.filter(order => order.customerId === where.customerId),
    count: async args => args?.where?.orderStatus === "PENDING" ? 2 : orders.length,
    aggregate: async args => args?.where?.customerId
      ? {_sum: {total: "700.00"}}
      : {_sum: {total: "1250.00"}},
  },
  orderItem: {
    groupBy: async () => [{productId: "product-1", _sum: {quantity: 7, subtotal: "700.00"}}],
  },
  $queryRaw: async query => query.sql.includes("date_trunc('day'")
    ? [{period: new Date("2026-11-04T00:00:00.000Z"), orders: 2, revenue: "500.00"}]
    : [{period: new Date("2026-11-01T00:00:00.000Z"), orders: 4, revenue: "900.00"}],
  $transaction: async (operation, options) => {
    assert.equal(options.isolationLevel, "Serializable");
    const snapshot = products.map(product => ({...product}));
    const movementCount = movements.length;
    try {
      return await operation(fakeDb);
    } catch (error) {
      products = snapshot;
      movements.splice(movementCount);
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
  role = "OWNER";
  products = [
    {id: "product-1", name: "Kaju Katli", slug: "kaju-katli", stockQuantity: 4, isAvailable: true, imageUrl: null, category: {id: "category-1", name: "Barfi"}},
    {id: "product-2", name: "Gulab Jamun", slug: "gulab-jamun", stockQuantity: 0, isAvailable: true, imageUrl: null, category: {id: "category-1", name: "Barfi"}},
    {id: "product-3", name: "Ladoo", slug: "ladoo", stockQuantity: 20, isAvailable: true, imageUrl: null, category: {id: "category-2", name: "Ladoo"}},
  ];
  movements = [];
  customers = [
    {id: "customer-1", name: "Asha Shah", phone: "+919999999991", email: "asha@example.test", createdAt: new Date("2026-10-01"), _count: {orders: 4}},
    {id: "customer-2", name: "Ravi Patel", phone: "+919999999992", email: null, createdAt: new Date("2026-10-02"), _count: {orders: 2}},
  ];
  orders = [{
    id: "order-1",
    customerId: "customer-1",
    orderNumber: "MTH-001",
    orderStatus: "COMPLETED",
    paymentStatus: "PAID",
    subtotal: "700.00",
    deliveryFee: "0.00",
    total: "700.00",
    createdAt: new Date("2026-10-01"),
    items: [{productName: "Kaju Katli", quantity: 2, unitPrice: "350.00", subtotal: "700.00"}],
  }];
  capturedInventoryQuery = null;
  forceStockConflict = false;
  failMovementInsert = false;
});

after(async () => {
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
});

async function request(path, {method = "GET", body, authenticated = true, csrf = true} = {}) {
  const headers = {};
  if (authenticated) headers.Cookie = `mithas_admin_session=${sessionToken}${csrf ? `; mithas_admin_csrf=${csrfToken}` : ""}`;
  if (method !== "GET") {
    headers.Origin = "http://localhost:5173";
    headers["Content-Type"] = "application/json";
    if (csrf) headers["X-CSRF-Token"] = csrfToken;
  }
  const response = await fetch(`${baseUrl}/api/admin${path}`, {
    method,
    headers,
    ...(body === undefined ? {} : {body: JSON.stringify(body)}),
  });
  return {response, body: await response.json()};
}

test("inventory pagination, low/out-of-stock filters, and audited positive/negative adjustments", async () => {
  const low = await request("/inventory?stock=low&lowStockThreshold=5&page=1&pageSize=10");
  assert.equal(low.response.status, 200);
  assert.equal(low.body.data.total, 1);
  assert.equal(low.body.data.items[0].name, "Kaju Katli");
  assert.deepEqual(capturedInventoryQuery.where.stockQuantity, {gt: 0, lte: 5});

  const out = await request("/inventory?stock=out");
  assert.equal(out.body.data.items[0].stockQuantity, 0);

  const added = await request("/inventory/product-1/adjust", {
    method: "POST",
    body: {quantityChange: 3, reason: "Received supplier restock"},
  });
  assert.equal(added.response.status, 200);
  assert.equal(added.body.data.previousQuantity, 4);
  assert.equal(added.body.data.newQuantity, 7);
  assert.equal(added.body.data.admin.id, "admin-1");

  const removed = await request("/inventory/product-1/adjust", {
    method: "POST",
    body: {quantityChange: -2, reason: "Damaged products"},
  });
  assert.equal(removed.response.status, 200);
  assert.equal(removed.body.data.newQuantity, 5);
  assert.equal(movements.length, 2);

  const history = await request("/inventory/movements?productId=product-1");
  assert.equal(history.body.data.total, 2);
});

test("inventory adjustment rejects negative totals, zero/invalid changes, missing products, and concurrency conflicts", async () => {
  const negative = await request("/inventory/product-1/adjust", {
    method: "POST",
    body: {quantityChange: -5, reason: "Incorrect stock count"},
  });
  assert.equal(negative.response.status, 409);
  assert.equal(negative.body.error.code, "INSUFFICIENT_STOCK");
  assert.equal(products[0].stockQuantity, 4);
  assert.equal(movements.length, 0);

  const zero = await request("/inventory/product-1/adjust", {
    method: "POST",
    body: {quantityChange: 0, reason: "Not a change"},
  });
  assert.equal(zero.response.status, 400);

  const missing = await request("/inventory/missing/adjust", {
    method: "POST",
    body: {quantityChange: 1, reason: "Restock"},
  });
  assert.equal(missing.response.status, 404);

  const invalidReason = await request("/inventory/product-1/adjust", {
    method: "POST",
    body: {quantityChange: 1, reason: "  "},
  });
  assert.equal(invalidReason.response.status, 400);

  forceStockConflict = true;
  const conflict = await request("/inventory/product-1/adjust", {
    method: "POST",
    body: {quantityChange: 1, reason: "Concurrent correction"},
  });
  assert.equal(conflict.response.status, 409);
  assert.equal(conflict.body.error.code, "STOCK_CHANGED");
  assert.equal(products[0].stockQuantity, 4);
});

test("stock and movement audit record roll back together when audit insertion fails", async () => {
  failMovementInsert = true;
  const response = await request("/inventory/product-1/adjust", {
    method: "POST",
    body: {quantityChange: 3, reason: "Supplier restock"},
  });
  assert.equal(response.response.status, 500);
  assert.equal(products[0].stockQuantity, 4);
  assert.equal(movements.length, 0);
});

test("customer search and pagination include order totals without leaking unselected fields", async () => {
  const secondPage = await request("/customers?page=2&pageSize=1");
  assert.equal(secondPage.response.status, 200);
  assert.equal(secondPage.body.data.total, 2);
  assert.equal(secondPage.body.data.page, 2);
  assert.equal(secondPage.body.data.items[0].id, "customer-2");
  assert.equal(secondPage.body.data.items[0].totalOrders, 2);
  assert.equal("_count" in secondPage.body.data.items[0], false);

  const search = await request("/customers?page=1&pageSize=1&search=asha");
  assert.equal(search.body.data.total, 1);
  assert.equal(search.body.data.items[0].totalSpending, "700.00");

  const detail = await request("/customers/customer-1");
  assert.equal(detail.response.status, 200);
  assert.equal(detail.body.data.orders.length, 1);
  assert.equal(detail.body.data.totalOrders, 4);
  assert.equal(detail.body.data.totalSpending, "700.00");

  const missing = await request("/customers/missing");
  assert.equal(missing.response.status, 404);
});

test("dashboard analytics aggregate only paid completed revenue and sales periods", async () => {
  const result = await getDashboardAnalytics(fakeDb, new Date("2026-11-04T14:30:00.000Z"));
  assert.equal(result.totalOrders, 1);
  assert.equal(result.pendingOrders, 2);
  assert.equal(result.revenue, "1250.00");
  assert.equal(result.todayRevenue, "500.00");
  assert.equal(result.monthRevenue, "900.00");
  assert.equal(result.dailySales.length, 30);
  assert.equal(result.monthlySales.length, 12);
  assert.equal(result.bestSellingProducts[0].quantitySold, 7);
  assert.equal(result.bestSellingProducts[0].name, "Kaju Katli");
});

test("customer and inventory data require admin authentication; writes require CSRF", async () => {
  const unauthenticated = await request("/customers", {authenticated: false});
  assert.equal(unauthenticated.response.status, 401);

  const csrfRejected = await request("/inventory/product-1/adjust", {
    method: "POST",
    csrf: false,
    body: {quantityChange: 2, reason: "Restock"},
  });
  assert.equal(csrfRejected.response.status, 403);
  assert.equal(csrfRejected.body.error.code, "CSRF_VALIDATION_FAILED");

  role = "UNKNOWN";
  const forbidden = await request("/analytics/dashboard");
  assert.equal(forbidden.response.status, 403);
});
