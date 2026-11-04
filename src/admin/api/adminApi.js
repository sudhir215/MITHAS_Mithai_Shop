const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

export class AdminApiError extends Error {
  constructor(message, status, code) {
    super(message);
    this.name = "AdminApiError";
    this.status = status;
    this.code = code;
  }
}

export async function adminRequest(path, {method = "GET", body, csrfToken, signal} = {}, fetchImpl = globalThis.fetch) {
  const headers = {Accept: "application/json"};
  const options = {method, credentials: "include", headers, signal};
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(body);
  }
  if (!["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase())) {
    if (!csrfToken) throw new AdminApiError("Your admin session needs to be refreshed before saving.", 403, "CSRF_TOKEN_MISSING");
    headers["X-CSRF-Token"] = csrfToken;
  }

  let response;
  try {
    response = await fetchImpl(`${API_BASE_URL}${path}`, options);
  } catch {
    throw new AdminApiError("Unable to reach the admin service. Check your connection and try again.", 0);
  }

  let result;
  try {
    result = await response.json();
  } catch {
    throw new AdminApiError("The admin service returned an invalid response.", response.status);
  }
  if (!response.ok || result?.success !== true) {
    throw new AdminApiError(
      result?.error?.message || "The request could not be completed.",
      response.status,
      result?.error?.code,
    );
  }
  return result.data;
}

export function getAdminProducts(params = {}, options = {}) {
  const query = new URLSearchParams(params);
  return adminRequest(`/api/admin/products?${query}`, options);
}

export function saveAdminProduct(id, data, csrfToken) {
  return adminRequest(id ? `/api/admin/products/${encodeURIComponent(id)}` : "/api/admin/products", {
    method: id ? "PUT" : "POST", body: data, csrfToken,
  });
}

export function deactivateAdminProduct(id, csrfToken) {
  return adminRequest(`/api/admin/products/${encodeURIComponent(id)}`, {method: "DELETE", csrfToken});
}

export function getAdminCategories(includeInactive = true) {
  return adminRequest(`/api/admin/categories?includeInactive=${includeInactive}`);
}

export function saveAdminCategory(id, data, csrfToken) {
  return adminRequest(id ? `/api/admin/categories/${encodeURIComponent(id)}` : "/api/admin/categories", {
    method: id ? "PUT" : "POST", body: data, csrfToken,
  });
}

export function deactivateAdminCategory(id, csrfToken) {
  return adminRequest(`/api/admin/categories/${encodeURIComponent(id)}/deactivate`, {method: "PATCH", csrfToken});
}

export function activateAdminCategory(id, csrfToken) {
  return adminRequest(`/api/admin/categories/${encodeURIComponent(id)}/activate`, {method: "PATCH", csrfToken});
}

export function deleteAdminCategory(id, csrfToken) {
  return adminRequest(`/api/admin/categories/${encodeURIComponent(id)}`, {method: "DELETE", csrfToken});
}

export function getAdminOrders(params = {}) {
  const query = new URLSearchParams(params);
  return adminRequest(`/api/admin/orders?${query}`);
}

export function getAdminOrder(id) {
  return adminRequest(`/api/admin/orders/${encodeURIComponent(id)}`);
}

export function updateAdminOrderStatus(id, orderStatus, csrfToken) {
  return adminRequest(`/api/admin/orders/${encodeURIComponent(id)}/status`, {
    method: "PATCH", body: {orderStatus}, csrfToken,
  });
}

export function updateAdminPaymentStatus(id, paymentStatus, csrfToken) {
  return adminRequest(`/api/admin/orders/${encodeURIComponent(id)}/payment-status`, {
    method: "PATCH", body: {paymentStatus}, csrfToken,
  });
}

export function getAdminSettings() {
  return adminRequest("/api/admin/settings");
}

export function saveAdminSettings(data, csrfToken) {
  return adminRequest("/api/admin/settings", {method: "PUT", body: data, csrfToken});
}

export function getAdminInventory(params = {}) {
  const query = new URLSearchParams(params);
  return adminRequest(`/api/admin/inventory?${query}`);
}

export function adjustAdminInventory(id, data, csrfToken) {
  return adminRequest(`/api/admin/inventory/${encodeURIComponent(id)}/adjust`, {
    method: "POST", body: data, csrfToken,
  });
}

export function getStockMovements(params = {}) {
  const query = new URLSearchParams(params);
  return adminRequest(`/api/admin/inventory/movements?${query}`);
}

export function getAdminCustomers(params = {}) {
  const query = new URLSearchParams(params);
  return adminRequest(`/api/admin/customers?${query}`);
}

export function getAdminCustomer(id) {
  return adminRequest(`/api/admin/customers/${encodeURIComponent(id)}`);
}

export function getDashboardAnalytics() {
  return adminRequest("/api/admin/analytics/dashboard");
}
