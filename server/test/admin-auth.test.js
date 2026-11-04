import assert from "node:assert/strict";
import {hash} from "@node-rs/argon2";
import {after, before, beforeEach, test} from "node:test";
import {createApp} from "../src/app.js";
import {ARGON2_OPTIONS, requireAdminRole} from "../src/middleware/adminAuth.js";

const password = "correct horse battery staple";
const passwordHash = await hash(password, ARGON2_OPTIONS);
const storedSessions = new Map();
const adminRecord = {
  id: "admin-1",
  email: "owner@example.test",
  passwordHash,
  role: "OWNER",
};

const fakeDb = {
  admin: {
    findUnique: async ({where}) => where.email === adminRecord.email ? adminRecord : null,
  },
  adminSession: {
    create: async ({data}) => {
      storedSessions.set(data.tokenHash, data);
      return data;
    },
    findUnique: async ({where}) => {
      const session = storedSessions.get(where.tokenHash);
      if (!session) return null;
      return {
        ...session,
        admin: {id: adminRecord.id, email: adminRecord.email, role: adminRecord.role},
      };
    },
    deleteMany: async ({where}) => {
      if (where.expiresAt?.lte) {
        let count = 0;
        for (const [tokenHash, session] of storedSessions) {
          if (session.expiresAt <= where.expiresAt.lte) {
            storedSessions.delete(tokenHash);
            count += 1;
          }
        }
        return {count};
      }
      return {count: Number(storedSessions.delete(where.tokenHash))};
    },
  },
  $queryRaw: async () => [{result: 1}],
  product: {findMany: async () => []},
  category: {findMany: async () => []},
  storeSettings: {findFirst: async () => null},
};

let server;
let baseUrl;

before(async () => {
  server = createApp({
    db: fakeDb,
    logger: {error() {}},
    loginRateLimit: {limit: 50},
  }).listen(0);
  await new Promise(resolve => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

beforeEach(() => {
  storedSessions.clear();
});

after(async () => {
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
});

function login(body = {email: adminRecord.email, password}, extraHeaders = {}) {
  return fetch(`${baseUrl}/api/admin/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "http://localhost:5173",
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  });
}

function getCookies(response) {
  const setCookie = response.headers.get("set-cookie") ?? "";
  const csrfCookieStart = setCookie.indexOf(", mithas_admin_csrf=");
  const sessionCookie = csrfCookieStart < 0 ? setCookie : setCookie.slice(0, csrfCookieStart);
  const csrfCookie = csrfCookieStart < 0 ? "" : setCookie.slice(csrfCookieStart + 2);
  const sessionToken = sessionCookie.match(/^mithas_admin_session=([^;,]+)/)?.[1];
  const csrfToken = csrfCookie.match(/^mithas_admin_csrf=([^;,]+)/)?.[1];
  return {sessionToken, csrfToken, sessionCookie, csrfCookie, setCookie};
}

test("login creates a hashed session and returns only safe admin fields", async () => {
  const response = await login();
  assert.equal(response.status, 200);
  const body = await response.json();
  const {sessionToken, csrfToken, sessionCookie, csrfCookie} = getCookies(response);

  assert.deepEqual(body.data.admin, {
    id: adminRecord.id,
    email: adminRecord.email,
    role: "OWNER",
  });
  assert.equal(typeof body.data.csrfToken, "string");
  assert.equal(body.data.csrfToken, csrfToken);
  assert.equal(JSON.stringify(body).includes(passwordHash), false);
  assert.match(sessionToken, /^[A-Za-z0-9_-]{43}$/);
  assert.match(csrfToken, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(storedSessions.size, 1);
  const session = [...storedSessions.values()][0];
  assert.notEqual(session.tokenHash, sessionToken);
  assert.notEqual(session.csrfTokenHash, csrfToken);
  assert.ok(sessionCookie.includes("; Path=/;"));
  assert.ok(sessionCookie.includes("; HttpOnly;"));
  assert.ok(sessionCookie.includes("; SameSite=Strict"));
  assert.ok(csrfCookie.includes("; Path=/;"));
  assert.ok(!csrfCookie.includes("; HttpOnly;"));
  assert.ok(csrfCookie.includes("; SameSite=Strict"));
  assert.equal(sessionCookie.includes("; Secure"), false);
});

test("valid session authenticates protected admin routes and does not expose hashes", async () => {
  const response = await login();
  const {sessionToken, csrfToken} = getCookies(response);

  const sessionResponse = await fetch(`${baseUrl}/api/admin/auth/session`, {
    headers: {Cookie: `mithas_admin_session=${sessionToken}; mithas_admin_csrf=${csrfToken}`},
  });
  assert.equal(sessionResponse.status, 200);
  const body = await sessionResponse.json();
  assert.deepEqual(body.data.admin, {
    id: adminRecord.id,
    email: adminRecord.email,
    role: "OWNER",
  });
  assert.equal(body.data.csrfToken, csrfToken);
  assert.equal(JSON.stringify(body).includes(passwordHash), false);

  const missingProductsRoute = await fetch(`${baseUrl}/api/admin/not-implemented`, {
    headers: {Cookie: `mithas_admin_session=${sessionToken}`},
  });
  assert.equal(missingProductsRoute.status, 404);
});

test("logout requires origin and matching CSRF cookie/header, then revokes session", async () => {
  const response = await login();
  const {sessionToken, csrfToken} = getCookies(response);
  const cookie = `mithas_admin_session=${sessionToken}; mithas_admin_csrf=${csrfToken}`;

  const missingCsrf = await fetch(`${baseUrl}/api/admin/auth/logout`, {
    method: "POST",
    headers: {Cookie: cookie, Origin: "http://localhost:5173"},
  });
  assert.equal(missingCsrf.status, 403);
  assert.equal(storedSessions.size, 1);

  const invalidCsrf = await fetch(`${baseUrl}/api/admin/auth/logout`, {
    method: "POST",
    headers: {
      Cookie: cookie,
      Origin: "http://localhost:5173",
      "X-CSRF-Token": "A".repeat(43),
    },
  });
  assert.equal(invalidCsrf.status, 403);

  const logout = await fetch(`${baseUrl}/api/admin/auth/logout`, {
    method: "POST",
    headers: {
      Cookie: cookie,
      Origin: "http://localhost:5173",
      "X-CSRF-Token": csrfToken,
    },
  });
  assert.equal(logout.status, 200);
  assert.equal(storedSessions.size, 0);

  const afterLogout = await fetch(`${baseUrl}/api/admin/auth/session`, {
    headers: {Cookie: `mithas_admin_session=${sessionToken}`},
  });
  assert.equal(afterLogout.status, 401);
});

test("expired sessions and disallowed origins are rejected", async () => {
  const response = await login();
  const {sessionToken} = getCookies(response);
  const tokenHash = [...storedSessions.keys()][0];
  storedSessions.get(tokenHash).expiresAt = new Date(Date.now() - 1);

  const expired = await fetch(`${baseUrl}/api/admin/auth/session`, {
    headers: {Cookie: `mithas_admin_session=${sessionToken}`},
  });
  assert.equal(expired.status, 401);

  const forbiddenOrigin = await login(
    {email: adminRecord.email, password},
    {Origin: "https://attacker.example"},
  );
  assert.equal(forbiddenOrigin.status, 403);
});

test("login failures are generic and malformed requests are validated", async () => {
  const unknownAccount = await login({email: "missing@example.test", password});
  const wrongPassword = await login({email: adminRecord.email, password: "wrong password"});
  const unknownBody = await unknownAccount.json();
  const wrongBody = await wrongPassword.json();
  assert.equal(unknownAccount.status, 401);
  assert.equal(wrongPassword.status, 401);
  assert.deepEqual(unknownBody.error, wrongBody.error);
  assert.equal(unknownBody.error.message, "Invalid email or password");

  const malformed = await login({email: "not-an-email", password: ""});
  assert.equal(malformed.status, 400);
});

test("login rate limiter blocks excess attempts", async () => {
  const rateLimitedServer = createApp({
    db: fakeDb,
    logger: {error() {}},
    loginRateLimit: {limit: 2, windowMs: 60_000},
  }).listen(0);
  await new Promise(resolve => rateLimitedServer.once("listening", resolve));
  const url = `http://127.0.0.1:${rateLimitedServer.address().port}/api/admin/auth/login`;
  try {
    for (let index = 0; index < 2; index += 1) {
      const response = await fetch(url, {
        method: "POST",
        headers: {"Content-Type": "application/json", Origin: "http://localhost:5173"},
        body: JSON.stringify({email: "missing@example.test", password}),
      });
      assert.equal(response.status, 401);
    }

    const limited = await fetch(url, {
      method: "POST",
      headers: {"Content-Type": "application/json", Origin: "http://localhost:5173"},
      body: JSON.stringify({email: "missing@example.test", password}),
    });
    assert.equal(limited.status, 429);
    assert.ok(limited.headers.get("retry-after"));
  } finally {
    await new Promise((resolve, reject) => rateLimitedServer.close(error => error ? reject(error) : resolve()));
  }
});

test("role authorization denies insufficient roles and permits allowed roles", () => {
  const middleware = requireAdminRole("OWNER");
  const response = {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
  let nextCalled = false;

  middleware({admin: {role: "ADMIN"}}, response, () => { nextCalled = true; });
  assert.equal(response.statusCode, 403);
  assert.equal(nextCalled, false);

  middleware({admin: {role: "OWNER"}}, response, () => { nextCalled = true; });
  assert.equal(nextCalled, true);
});
