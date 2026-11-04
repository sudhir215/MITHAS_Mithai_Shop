import assert from "node:assert/strict";
import {after, before, test} from "node:test";
import {createApp} from "../src/app.js";

const calls = [];
const fakeDb = {
  $queryRaw: async () => [{result: 1}],
  product: {
    findMany: async args => {
      calls.push(["products", args]);
      return [];
    },
  },
  category: {
    findMany: async args => {
      calls.push(["categories", args]);
      return [];
    },
  },
  storeSettings: {
    findFirst: async args => {
      calls.push(["settings", args]);
      return null;
    },
  },
};

let server;
let baseUrl;

before(async () => {
  server = createApp({db: fakeDb, logger: {error() {}}}).listen(0);
  await new Promise(resolve => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
});

test("GET /api/health reports API and database readiness", async () => {
  const response = await fetch(`${baseUrl}/api/health`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    success: true,
    data: {status: "ok", database: "connected"},
  });
});

test("GET /api/health reports database outages without exposing connection details", async () => {
  const unavailableApp = createApp({
    db: {...fakeDb, $queryRaw: async () => { throw new Error("private connection detail"); }},
    logger: {error() {}},
  });
  const unavailableServer = unavailableApp.listen(0);
  await new Promise(resolve => unavailableServer.once("listening", resolve));

  try {
    const response = await fetch(`http://127.0.0.1:${unavailableServer.address().port}/api/health`);
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), {
      success: false,
      error: {code: "DATABASE_UNAVAILABLE", message: "Database health check failed"},
    });
  } finally {
    await new Promise((resolve, reject) => unavailableServer.close(error => error ? reject(error) : resolve()));
  }
});

test("GET /api/products returns an empty catalog with pagination metadata", async () => {
  calls.length = 0;
  const response = await fetch(`${baseUrl}/api/products`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    success: true,
    data: {items: [], nextCursor: null},
  });
  assert.equal(calls[0][1].where.isAvailable, true);
});

test("GET /api/products validates query and supports catalog filters", async () => {
  calls.length = 0;
  const response = await fetch(`${baseUrl}/api/products?category=ladoo&featured=true&limit=10`);
  assert.equal(response.status, 200);
  assert.equal(calls[0][1].where.category.slug, "ladoo");
  assert.equal(calls[0][1].where.isFeatured, true);
  assert.equal(calls[0][1].take, 10);

  const invalidResponse = await fetch(`${baseUrl}/api/products?limit=101`);
  assert.equal(invalidResponse.status, 400);
  const invalidBody = await invalidResponse.json();
  assert.equal(invalidBody.error.code, "VALIDATION_ERROR");
});

test("GET /api/categories supports optional available-product inclusion", async () => {
  calls.length = 0;
  const response = await fetch(`${baseUrl}/api/categories?includeProducts=true`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {success: true, data: []});
  assert.deepEqual(calls[0][1].include.products.where, {isAvailable: true});
});

test("GET /api/store-settings returns null when settings have not been configured", async () => {
  const response = await fetch(`${baseUrl}/api/store-settings`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {success: true, data: null});
});

test("admin API rejects unauthenticated requests", async () => {
  const response = await fetch(`${baseUrl}/api/admin/products`);
  assert.equal(response.status, 401);
  const body = await response.json();
  assert.equal(body.error.code, "AUTHENTICATION_REQUIRED");
});

test("unknown API routes return a consistent not-found response", async () => {
  const response = await fetch(`${baseUrl}/api/missing`);
  assert.equal(response.status, 404);
  const body = await response.json();
  assert.equal(body.success, false);
  assert.equal(body.error.code, "NOT_FOUND");
});

test("CORS rejects origins outside the configured frontend allow-list", async () => {
  const response = await fetch(`${baseUrl}/api/health`, {
    headers: {Origin: "https://untrusted.example"},
  });
  assert.equal(response.status, 403);
  const body = await response.json();
  assert.equal(body.error.code, "CORS_ORIGIN_DENIED");
});
