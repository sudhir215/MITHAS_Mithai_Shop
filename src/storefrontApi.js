const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

export class StorefrontApiError extends Error {
  constructor(message, status, code) {
    super(message);
    this.name = "StorefrontApiError";
    this.status = status;
    this.code = code;
  }
}

export async function storefrontRequest(path, options = {}) {
  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers: {Accept: "application/json", ...options.headers},
    });
  } catch {
    throw new StorefrontApiError("Unable to reach the shop. Check your connection and try again.", 0);
  }

  let body;
  try {
    body = await response.json();
  } catch {
    throw new StorefrontApiError("The shop returned an invalid response.", response.status);
  }
  if (!response.ok || body?.success !== true) {
    throw new StorefrontApiError(
      body?.error?.message || "The request could not be completed.",
      response.status,
      body?.error?.code,
    );
  }
  return body.data;
}

export function getStorefrontProducts({search = "", category = ""} = {}) {
  const query = new URLSearchParams({limit: "50"});
  if (search) query.set("search", search);
  if (category) query.set("category", category);
  return storefrontRequest(`/api/products?${query}`);
}

export function getStorefrontProduct(slug) {
  return storefrontRequest(`/api/products/${encodeURIComponent(slug)}`);
}

export function getStorefrontCategories() {
  return storefrontRequest("/api/categories");
}

export function getStorefrontSettings() {
  return storefrontRequest("/api/store-settings");
}

export function createStorefrontOrder(input, idempotencyKey) {
  return storefrontRequest("/api/orders", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify(input),
  });
}

export function getOrderConfirmation(orderNumber) {
  return storefrontRequest(`/api/orders/${encodeURIComponent(orderNumber)}`);
}
