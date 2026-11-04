import {createHash, randomBytes, timingSafeEqual} from "node:crypto";
import {Algorithm, hash, verify} from "@node-rs/argon2";
import {z} from "zod";
import {env} from "../config/env.js";

export const ADMIN_SESSION_TTL_MS = 8 * 60 * 60 * 1000;
export const ADMIN_SESSION_COOKIE = "mithas_admin_session";
export const ADMIN_CSRF_COOKIE = "mithas_admin_csrf";
export const ARGON2_OPTIONS = {
  algorithm: Algorithm.Argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
  outputLen: 32,
};

const loginSchema = z.object({
  email: z.string().trim().email().max(254).transform(value => value.toLowerCase()),
  password: z.string().min(1).max(128),
}).strict();

export const provisionAdminSchema = z.object({
  email: z.string().trim().email().max(254).transform(value => value.toLowerCase()),
  password: z.string().min(12).max(128),
});

const dummyPasswordHash = hash(randomBytes(32).toString("base64url"), ARGON2_OPTIONS);
const safeMethods = new Set(["GET", "HEAD", "OPTIONS"]);
const rateLimitDefaults = {limit: 5, windowMs: 15 * 60 * 1000, maxClients: 10_000};

export function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

export function createOpaqueToken() {
  return randomBytes(32).toString("base64url");
}

export function getAdminSessionCookieName() {
  return env.NODE_ENV === "production"
    ? `__Host-${ADMIN_SESSION_COOKIE}`
    : ADMIN_SESSION_COOKIE;
}

export function getAdminSessionCookieOptions() {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: ADMIN_SESSION_TTL_MS,
  };
}

export function getAdminCsrfCookieName() {
  return env.NODE_ENV === "production"
    ? `__Host-${ADMIN_CSRF_COOKIE}`
    : ADMIN_CSRF_COOKIE;
}

export function getAdminCsrfCookieOptions() {
  return {
    httpOnly: false,
    secure: env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: ADMIN_SESSION_TTL_MS,
  };
}

function sendError(res, status, code, message) {
  res.status(status).json({success: false, error: {code, message}});
}

function readCookie(req, cookieName) {
  const cookieHeader = req.headers.cookie;
  if (typeof cookieHeader !== "string") return null;

  const matches = cookieHeader.split(";").map(part => part.trim())
    .filter(part => part.startsWith(`${cookieName}=`));

  if (matches.length !== 1) return null;
  const token = matches[0].slice(cookieName.length + 1);
  return /^[A-Za-z0-9_-]{43}$/.test(token) ? token : null;
}

function readSessionCookie(req) {
  return readCookie(req, getAdminSessionCookieName());
}

export function getAdminCsrfToken(req) {
  return readCookie(req, getAdminCsrfCookieName());
}

export function isValidAdminCsrfToken(token, expectedHash) {
  if (typeof token !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(token)) return false;
  const actualHash = Buffer.from(hashToken(token), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return actualHash.length === expected.length && timingSafeEqual(actualHash, expected);
}

export function createLoginRateLimiter(options = {}) {
  const {limit, windowMs, maxClients} = {...rateLimitDefaults, ...options};
  const attempts = new Map();
  let lastCleanup = 0;

  return function loginRateLimiter(req, res, next) {
    const now = Date.now();
    if (now - lastCleanup >= windowMs) {
      for (const [ip, record] of attempts) {
        if (record.resetAt <= now) attempts.delete(ip);
      }
      lastCleanup = now;
    }

    const ip = req.ip || req.socket?.remoteAddress || "unknown";
    let record = attempts.get(ip);
    if (!record || record.resetAt <= now) {
      if (attempts.size >= maxClients) {
        sendError(res, 429, "LOGIN_RATE_LIMITED", "Too many login attempts. Try again later.");
        return;
      }
      record = {count: 0, resetAt: now + windowMs};
      attempts.set(ip, record);
    }

    if (record.count >= limit) {
      res.set("Retry-After", String(Math.max(1, Math.ceil((record.resetAt - now) / 1000))));
      sendError(res, 429, "LOGIN_RATE_LIMITED", "Too many login attempts. Try again later.");
      return;
    }

    record.count += 1;
    next();
  };
}

function isAllowedOrigin(req) {
  return typeof req.get("origin") === "string" && env.frontendOrigins.includes(req.get("origin"));
}

export async function loginAdmin(req, res, next) {
  if (!isAllowedOrigin(req)) {
    sendError(res, 403, "ORIGIN_NOT_ALLOWED", "Request origin is not allowed");
    return;
  }

  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    sendError(res, 400, "VALIDATION_ERROR", "Email or password is invalid");
    return;
  }

  try {
    const {email, password} = parsed.data;
    const admin = await req.app.locals.db.admin.findUnique({
      where: {email},
      select: {id: true, email: true, passwordHash: true, role: true},
    });
    const passwordHash = admin?.passwordHash ?? await dummyPasswordHash;
    const passwordMatches = await verify(passwordHash, password);

    if (!admin || !passwordMatches) {
      sendError(res, 401, "INVALID_CREDENTIALS", "Invalid email or password");
      return;
    }

    await req.app.locals.db.adminSession.deleteMany({
      where: {expiresAt: {lte: new Date()}},
    });
    const token = createOpaqueToken();
    const csrfToken = createOpaqueToken();
    const expiresAt = new Date(Date.now() + ADMIN_SESSION_TTL_MS);
    await req.app.locals.db.adminSession.create({
      data: {
        tokenHash: hashToken(token),
        csrfTokenHash: hashToken(csrfToken),
        adminId: admin.id,
        expiresAt,
      },
    });

    res.cookie(getAdminSessionCookieName(), token, getAdminSessionCookieOptions());
    res.cookie(getAdminCsrfCookieName(), csrfToken, getAdminCsrfCookieOptions());
    res.status(200).json({
      success: true,
      data: {
        admin: {id: admin.id, email: admin.email, role: admin.role},
        csrfToken,
        expiresAt: expiresAt.toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function authenticateAdmin(req, res, next) {
  const token = readSessionCookie(req);
  if (!token) {
    sendError(res, 401, "AUTHENTICATION_REQUIRED", "Authentication is required");
    return;
  }

  try {
    const tokenHash = hashToken(token);
    const session = await req.app.locals.db.adminSession.findUnique({
      where: {tokenHash},
      select: {
        tokenHash: true,
        csrfTokenHash: true,
        expiresAt: true,
        admin: {select: {id: true, email: true, role: true}},
      },
    });

    if (!session || session.expiresAt <= new Date()) {
      sendError(res, 401, "AUTHENTICATION_REQUIRED", "Authentication is required");
      return;
    }

    req.admin = session.admin;
    req.adminSession = {
      tokenHash: session.tokenHash,
      csrfTokenHash: session.csrfTokenHash,
      expiresAt: session.expiresAt,
    };
    next();
  } catch (error) {
    next(error);
  }
}

export function protectAdminCsrf(req, res, next) {
  if (safeMethods.has(req.method)) {
    next();
    return;
  }

  const csrfToken = req.get("x-csrf-token");
  const csrfCookie = getAdminCsrfToken(req);
  if (
    !isAllowedOrigin(req)
    || typeof csrfToken !== "string"
    || !/^[A-Za-z0-9_-]{43}$/.test(csrfToken)
    || csrfCookie !== csrfToken
    || !isValidAdminCsrfToken(csrfToken, req.adminSession.csrfTokenHash)
  ) {
    sendError(res, 403, "CSRF_VALIDATION_FAILED", "Request could not be verified");
    return;
  }

  next();
}

export function requireAdminRole(...roles) {
  return function adminRoleAuthorization(req, res, next) {
    if (!req.admin || !roles.includes(req.admin.role)) {
      sendError(res, 403, "FORBIDDEN", "You are not authorized to perform this action");
      return;
    }
    next();
  };
}
