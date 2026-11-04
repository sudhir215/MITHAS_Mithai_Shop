const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

export class AdminAuthError extends Error {
  constructor(message, status, code) {
    super(message);
    this.name = "AdminAuthError";
    this.status = status;
    this.code = code;
  }
}

async function request(path, options = {}, fetchImpl = globalThis.fetch) {
  let response;
  try {
    response = await fetchImpl(`${API_BASE_URL}${path}`, {
      ...options,
      credentials: "include",
      headers: {
        Accept: "application/json",
        ...options.headers,
      },
    });
  } catch {
    throw new AdminAuthError("Unable to reach the sign-in service. Check your connection and try again.", 0);
  }

  let body;
  try {
    body = await response.json();
  } catch {
    throw new AdminAuthError("The sign-in service returned an invalid response.", response.status);
  }

  if (!response.ok || body?.success !== true) {
    throw new AdminAuthError(
      body?.error?.message || "The request could not be completed.",
      response.status,
      body?.error?.code,
    );
  }

  return body.data;
}

export function loginAdmin(credentials, fetchImpl) {
  return request("/api/admin/login", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify(credentials),
  }, fetchImpl);
}

export function getAdminSession(fetchImpl) {
  return request("/api/admin/auth/session", {method: "GET"}, fetchImpl);
}

export function logoutAdmin(csrfToken, fetchImpl) {
  return request("/api/admin/auth/logout", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-Token": csrfToken,
    },
    body: "{}",
  }, fetchImpl);
}
