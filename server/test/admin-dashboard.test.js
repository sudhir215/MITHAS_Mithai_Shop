import assert from "node:assert/strict";
import {Prisma} from "@prisma/client";
import {after, before, beforeEach, test} from "node:test";
import {createApp} from "../src/app.js";
import {hashToken} from "../src/middleware/adminAuth.js";

const sessionToken = "A".repeat(43);
const csrfToken = "B".repeat(43);
const productRecords = Array.from({length: 12}, (_, index) => ({
  id: `product-${index + 1}`,
  name: `Sweet ${index + 1}`,
  slug: `sweet-${index + 1}`,
  description: "Fresh mithai",
  price: "125.00",
  imageUrl: null,
  stockQuantity: 4,
  isAvailable: true,
  isFeatured: false,
  categoryId: "category-1",
  category: {id: "category-1", name: "Ladoo", isActive: true},
  createdAt: new Date(`2026-10-${String(index + 1).padStart(2, "0")}T00:00:00.000Z`),
}));
const categoryRecords = [{
  id: "category-1", name: "Ladoo", slug: "ladoo", description: null, isActive: true,
  _count: {products: 12},
}];
const orderRecords = [{
  id: "order-1",
  orderNumber: "MTH-1001",
  customerId: "customer-1",
  customer: {id: "customer-1", name: "Test Customer", phone: "+919999999999", email: null},
  subtotal: "500.00",
  deliveryFee: "40.00",
  total: "540.00",
  paymentStatus: "PENDING",
  orderStatus: "PENDING",
  items: [{id: "item-1", productId: "product-1", productName: "Kaju Katli", quantity: 2, unitPrice: "250.00", subtotal: "500.00"}],
  createdAt: new Date("2026-11-04T10:00:00.000Z"),
}];
let role = "OWNER";
let failProductCreate = false;
let capturedProductQuery;
let settingsRecord = null;
let stockMovements = [];

function dbError(code) {
  return new Prisma.PrismaClientKnownRequestError("mock database constraint error", {
    code,
    clientVersion: "test",
  });
}

function containsText(value, search) {
  return String(value ?? "").toLowerCase().includes(search.toLowerCase());
}

const fakeDb = {
  adminSession: {
    findUnique: async ({where}) => where.tokenHash === hashToken(sessionToken) ? {
      tokenHash: where.tokenHash,
      csrfTokenHash: hashToken(csrfToken),
      expiresAt: new Date(Date.now() + 60_000),
      admin: {id: "admin-1", email: "admin@example.test", role},
    } : null,
  },
  product: {
    findMany: async args => {
      capturedProductQuery = args;
      const {where} = args;
      let rows = productRecords.filter(product =>
        (!where.categoryId || product.categoryId === where.categoryId)
        && (where.isAvailable === undefined || product.isAvailable === where.isAvailable)
        && (!where.OR || where.OR.some(term => containsText(product.name, term.name?.contains) || containsText(product.slug, term.slug?.contains))),
      );
      return rows.slice(args.skip, args.skip + args.take);
    },
    count: async ({where}) => productRecords.filter(product =>
      (!where.categoryId || product.categoryId === where.categoryId)
      && (where.isAvailable === undefined || product.isAvailable === where.isAvailable)
      && (!where.OR || where.OR.some(term => containsText(product.name, term.name?.contains) || containsText(product.slug, term.slug?.contains))),
    ).length,
    findUnique: async ({where}) => {
      const product = productRecords.find(item => item.id === where.id);
      return product ? {categoryId: product.categoryId, stockQuantity: product.stockQuantity} : null;
    },
    updateMany: async ({where, data}) => {
      const product = productRecords.find(item => item.id === where.id
        && (where.stockQuantity === undefined || item.stockQuantity === where.stockQuantity));
      if (!product) return {count: 0};
      if (data.stockQuantity.increment !== undefined) product.stockQuantity += data.stockQuantity.increment;
      if (data.stockQuantity.decrement !== undefined) product.stockQuantity -= data.stockQuantity.decrement;
      return {count: 1};
    },
    create: async ({data}) => {
      if (failProductCreate) throw dbError("P2002");
      const created = {id: "product-new", ...data};
      productRecords.push(created);
      return created;
    },
    update: async ({where, data}) => {
      const product = productRecords.find(item => item.id === where.id);
      if (!product) throw dbError("P2025");
      Object.assign(product, data);
      return product;
    },
  },
  category: {
    findMany: async ({where} = {}) => categoryRecords.filter(category => !where?.isActive || category.isActive),
    findUnique: async ({where, select}) => {
      const category = categoryRecords.find(item => item.id === where.id);
      if (!category) return null;
      if (select?._count) return {_count: {products: category._count.products}};
      return {id: category.id, isActive: category.isActive};
    },
    create: async ({data}) => {
      const created = {id: "category-new", ...data, isActive: true, _count: {products: 0}};
      categoryRecords.push(created);
      return created;
    },
    update: async ({where, data}) => {
      const category = categoryRecords.find(item => item.id === where.id);
      if (!category) throw dbError("P2025");
      Object.assign(category, data);
      return category;
    },
    delete: async ({where}) => {
      const index = categoryRecords.findIndex(item => item.id === where.id);
      if (index < 0) throw dbError("P2025");
      return categoryRecords.splice(index, 1)[0];
    },
  },
  order: {
    findMany: async args => {
      let rows = orderRecords.filter(order =>
        (!args.where.orderStatus || order.orderStatus === args.where.orderStatus)
        && (!args.where.paymentStatus || order.paymentStatus === args.where.paymentStatus)
        && (!args.where.OR || args.where.OR.some(term =>
          containsText(order.orderNumber, term.orderNumber?.contains)
          || containsText(order.customer.name, term.customer?.name?.contains)
          || containsText(order.customer.phone, term.customer?.phone?.contains))),
      );
      return rows.slice(args.skip, args.skip + args.take);
    },
    count: async ({where}) => orderRecords.filter(order =>
      (!where.orderStatus || order.orderStatus === where.orderStatus)
      && (!where.paymentStatus || order.paymentStatus === where.paymentStatus),
    ).length,
    findUnique: async ({where, select}) => {
      const order = orderRecords.find(item => item.id === where.id);
      if (!order) return null;
      if (select?.orderStatus) return {orderStatus: order.orderStatus, ...(select.orderNumber ? {orderNumber: order.orderNumber} : {})};
      if (select?.paymentStatus) return {paymentStatus: order.paymentStatus};
      return order;
    },
    updateMany: async ({where, data}) => {
      const order = orderRecords.find(item => item.id === where.id
        && (!where.orderStatus || item.orderStatus === where.orderStatus)
        && (!where.paymentStatus || item.paymentStatus === where.paymentStatus));
      if (!order) return {count: 0};
      Object.assign(order, data);
      return {count: 1};
    },
  },
  storeSettings: {
    findFirst: async () => settingsRecord,
    update: async ({where, data}) => {
      if (!settingsRecord || settingsRecord.id !== where.id) throw dbError("P2025");
      settingsRecord = {...settingsRecord, ...data};
      return settingsRecord;
    },
    create: async ({data}) => {
      settingsRecord = {id: "settings-1", ...data};
      return settingsRecord;
    },
  },
  stockMovement: {
    findMany: async ({where}) => stockMovements.filter(movement =>
      movement.orderId === where.orderId && movement.quantityChange < 0,
    ),
    create: async ({data}) => {
      const movement = {id: `movement-${stockMovements.length + 1}`, ...data};
      stockMovements.push(movement);
      return movement;
    },
  },
  $transaction: async operation => operation(fakeDb),
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
  failProductCreate = false;
  capturedProductQuery = undefined;
  settingsRecord = null;
  stockMovements = [];
  productRecords.splice(12);
  productRecords.forEach((product, index) => {
    product.isAvailable = true;
    product.name = `Sweet ${index + 1}`;
  });
  categoryRecords.splice(1);
  categoryRecords[0].isActive = true;
  categoryRecords[0]._count.products = 12;
  orderRecords[0].orderStatus = "PENDING";
  orderRecords[0].paymentStatus = "PENDING";
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

const productBody = {
  name: "Kaju Katli",
  description: "Fresh cashew mithai",
  price: "250.00",
  stockQuantity: 5,
  categoryId: "category-1",
  imageUrl: "https://example.test/kaju.jpg",
  isFeatured: true,
  isAvailable: true,
};

test("admin product CRUD, safe deactivation, pagination, and search filters", async () => {
  const page = await request("/products?page=2&pageSize=5&search=sweet&availability=available");
  assert.equal(page.response.status, 200);
  assert.equal(page.body.data.page, 2);
  assert.equal(page.body.data.total, 12);
  assert.equal(page.body.data.items.length, 5);
  assert.equal(capturedProductQuery.skip, 5);
  assert.equal(capturedProductQuery.take, 5);
  assert.equal(capturedProductQuery.where.isAvailable, true);

  const created = await request("/products", {method: "POST", body: productBody});
  assert.equal(created.response.status, 201);
  assert.equal(created.body.data.slug, "kaju-katli");
  assert.equal(created.body.data.price, "250.00");

  const updated = await request("/products/product-1", {
    method: "PUT",
    body: {...productBody, name: "Updated Kaju Katli", stockQuantity: 4},
  });
  assert.equal(updated.response.status, 200);
  assert.equal(updated.body.data.slug, "updated-kaju-katli");
  assert.equal(updated.body.data.stockQuantity, 4);

  const unauditedStockEdit = await request("/products/product-1", {
    method: "PUT",
    body: {...productBody, stockQuantity: 8},
  });
  assert.equal(unauditedStockEdit.response.status, 400);
  assert.equal(unauditedStockEdit.body.error.code, "USE_INVENTORY_ADJUSTMENT");

  const deactivated = await request("/products/product-1", {method: "DELETE"});
  assert.equal(deactivated.response.status, 200);
  assert.equal(deactivated.body.data.isAvailable, false);
});

test("product input validation, missing product, and database uniqueness failures are reported", async () => {
  const invalid = await request("/products", {method: "POST", body: {...productBody, price: "-1"}});
  assert.equal(invalid.response.status, 400);
  assert.equal(invalid.body.error.code, "VALIDATION_ERROR");

  const missing = await request("/products/missing", {method: "PUT", body: productBody});
  assert.equal(missing.response.status, 404);

  failProductCreate = true;
  const conflict = await request("/products", {method: "POST", body: productBody});
  assert.equal(conflict.response.status, 409);
  assert.equal(conflict.body.error.code, "P2002");
});

test("category CRUD protects dependent products and allows safe deactivation", async () => {
  const listed = await request("/categories?includeInactive=true");
  assert.equal(listed.response.status, 200);
  assert.equal(listed.body.data[0]._count.products, 12);

  const created = await request("/categories", {method: "POST", body: {name: "Barfi", description: "Milk sweets"}});
  assert.equal(created.response.status, 201);
  assert.equal(created.body.data.slug, "barfi");
  const updated = await request("/categories/category-new", {method: "PUT", body: {name: "Milk Barfi", description: null}});
  assert.equal(updated.response.status, 200);
  assert.equal(updated.body.data.slug, "milk-barfi");

  const blockedDelete = await request("/categories/category-1", {method: "DELETE"});
  assert.equal(blockedDelete.response.status, 409);
  assert.equal(blockedDelete.body.error.code, "CATEGORY_IN_USE");

  const deactivated = await request("/categories/category-1/deactivate", {method: "PATCH"});
  assert.equal(deactivated.response.status, 200);
  assert.equal(deactivated.body.data.isActive, false);
  const activated = await request("/categories/category-1/activate", {method: "PATCH"});
  assert.equal(activated.response.status, 200);
  assert.equal(activated.body.data.isActive, true);

  categoryRecords.find(category => category.id === "category-1")._count.products = 0;
  const deleted = await request("/categories/category-1", {method: "DELETE"});
  assert.equal(deleted.response.status, 200);
});

test("category validation and missing categories return explicit errors", async () => {
  const invalid = await request("/categories", {method: "POST", body: {name: "  "}});
  assert.equal(invalid.response.status, 400);
  const missing = await request("/categories/missing", {method: "PUT", body: {name: "New category"}});
  assert.equal(missing.response.status, 404);
  const missingDelete = await request("/categories/missing", {method: "DELETE"});
  assert.equal(missingDelete.response.status, 404);
});

test("orders paginate and filter, return details, and enforce independent valid status changes", async () => {
  const filtered = await request("/orders?page=1&pageSize=10&orderStatus=PENDING&paymentStatus=PENDING&search=1001");
  assert.equal(filtered.response.status, 200);
  assert.equal(filtered.body.data.items.length, 1);
  assert.equal(filtered.body.data.items[0].customer.name, "Test Customer");

  const detail = await request("/orders/order-1");
  assert.equal(detail.response.status, 200);
  assert.equal(detail.body.data.items[0].quantity, 2);

  const advanced = await request("/orders/order-1/status", {method: "PATCH", body: {orderStatus: "CONFIRMED"}});
  assert.equal(advanced.response.status, 200);
  assert.equal(advanced.body.data.orderStatus, "CONFIRMED");

  const invalidTransition = await request("/orders/order-1/status", {method: "PATCH", body: {orderStatus: "COMPLETED"}});
  assert.equal(invalidTransition.response.status, 409);
  assert.equal(invalidTransition.body.error.code, "INVALID_ORDER_TRANSITION");

  const payment = await request("/orders/order-1/payment-status", {method: "PATCH", body: {paymentStatus: "PAID"}});
  assert.equal(payment.response.status, 200);
  assert.equal(payment.body.data.paymentStatus, "PAID");

  const missingOrder = await request("/orders/missing");
  assert.equal(missingOrder.response.status, 404);
});

test("order query validation and payment transitions reject invalid changes", async () => {
  const invalidQuery = await request("/orders?from=2026-12-01&to=2026-11-01");
  assert.equal(invalidQuery.response.status, 400);
  const invalidBody = await request("/orders/order-1/status", {method: "PATCH", body: {orderStatus: "SHIPPED"}});
  assert.equal(invalidBody.response.status, 400);
  const failedPayment = await request("/orders/order-1/payment-status", {method: "PATCH", body: {paymentStatus: "FAILED"}});
  assert.equal(failedPayment.response.status, 200);
  const invalidPayment = await request("/orders/order-1/payment-status", {method: "PATCH", body: {paymentStatus: "PAID"}});
  assert.equal(invalidPayment.response.status, 409);
});

test("cancelling a checkout order restores stock and records an admin-attributed movement", async () => {
  productRecords[0].stockQuantity = 2;
  stockMovements = [{
    id: "sale-movement",
    productId: "product-1",
    orderId: "order-1",
    quantityChange: -2,
  }];
  const {response, body} = await request("/orders/order-1/status", {
    method: "PATCH",
    body: {orderStatus: "CANCELLED"},
  });
  assert.equal(response.status, 200);
  assert.equal(body.data.orderStatus, "CANCELLED");
  assert.equal(productRecords[0].stockQuantity, 4);
  assert.equal(stockMovements.length, 2);
  assert.deepEqual({
    adminId: stockMovements[1].adminId,
    quantityChange: stockMovements[1].quantityChange,
    previousQuantity: stockMovements[1].previousQuantity,
    newQuantity: stockMovements[1].newQuantity,
  }, {adminId: "admin-1", quantityChange: 2, previousQuantity: 2, newQuantity: 4});
});

test("store settings validate and persist values; only OWNER may update", async () => {
  const saved = await request("/settings", {
    method: "PUT",
    body: {
      shopName: "MITHAS",
      phone: "+91 98765 43210",
      address: "Kolhapur",
      deliveryFee: "40.00",
      minimumOrderAmount: "250",
      isOperating: true,
    },
  });
  assert.equal(saved.response.status, 200);
  assert.equal(saved.body.data.deliveryFee, "40.00");
  assert.equal(saved.body.data.contactNumber, "+91 98765 43210");

  role = "ADMIN";
  const forbidden = await request("/settings", {
    method: "PUT",
    body: {
      shopName: "MITHAS",
      deliveryFee: "0",
      minimumOrderAmount: "0",
      isOperating: false,
    },
  });
  assert.equal(forbidden.response.status, 403);
  role = "OWNER";
  const invalid = await request("/settings", {
    method: "PUT",
    body: {shopName: "MITHAS", deliveryFee: "-5", minimumOrderAmount: "0", isOperating: true},
  });
  assert.equal(invalid.response.status, 400);
});

test("all admin APIs require a session and state changes reject missing CSRF tokens", async () => {
  const unauthorized = await request("/products", {authenticated: false});
  assert.equal(unauthorized.response.status, 401);

  const csrfRejected = await request("/products", {method: "POST", body: productBody, csrf: false});
  assert.equal(csrfRejected.response.status, 403);
  assert.equal(csrfRejected.body.error.code, "CSRF_VALIDATION_FAILED");

  role = "UNKNOWN";
  const forbidden = await request("/products");
  assert.equal(forbidden.response.status, 403);
});
