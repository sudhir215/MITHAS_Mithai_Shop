import {cleanup, render, screen, waitFor} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {afterEach, describe, expect, it, vi} from "vitest";
import {MemoryRouter} from "react-router-dom";
import App from "../../App.jsx";

const csrfToken = "csrf-token-value-for-admin-dashboard-tests";
const admin = {id: "admin-1", email: "owner@example.test", role: "OWNER"};
const category = {id: "category-1", name: "Ladoo", slug: "ladoo", description: null, isActive: true, _count: {products: 1}};
const product = {
  id: "product-1", name: "Kaju Katli", slug: "kaju-katli", description: "Cashew mithai", price: "250.00",
  imageUrl: null, stockQuantity: 4, isAvailable: true, isFeatured: false, categoryId: category.id, category,
};
const order = {
  id: "order-1", orderNumber: "MTH-1001", total: "540.00", subtotal: "500.00", deliveryFee: "40.00",
  orderStatus: "PENDING", paymentStatus: "PENDING", createdAt: "2026-11-04T10:00:00.000Z",
  customer: {id: "customer-1", name: "Customer One", phone: "+919999999999", email: null}, _count: {items: 1},
};

function response(data, status = 200) {
  return {ok: status >= 200 && status < 300, status, json: async () => ({success: status < 300, data})};
}

function renderAt(path) {
  return render(<MemoryRouter initialEntries={[path]}><App/></MemoryRouter>);
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("admin dashboard API integration", () => {
  it("loads products and submits a CSRF-protected create request", async () => {
    const requests = [];
    const fetchMock = vi.fn(async (url, options) => {
      requests.push({url, options});
      if (url === "/api/admin/auth/session") return response({admin, csrfToken, expiresAt: "2026-11-05T06:00:00.000Z"});
      if (url.startsWith("/api/admin/products?")) return response({items: [product], page: 1, pageSize: 10, total: 1, totalPages: 1});
      if (url === "/api/admin/categories?includeInactive=true") return response([category]);
      if (url === "/api/admin/products" && options.method === "POST") return response({...product, id: "product-2"}, 201);
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    renderAt("/admin/products");

    expect(await screen.findByText("Kaju Katli")).toBeTruthy();
    await user.type(screen.getByLabelText("Product name"), "Jalebi");
    await user.selectOptions(screen.getByLabelText("Category"), category.id);
    await user.type(screen.getByLabelText("Price (INR)"), "120.50");
    await user.type(screen.getByLabelText("Description"), "Fresh saffron jalebi");
    await user.click(screen.getByRole("button", {name: "Create product"}));

    await waitFor(() => expect(requests.some(item => item.url === "/api/admin/products" && item.options.method === "POST")).toBe(true));
    const create = requests.find(item => item.url === "/api/admin/products" && item.options.method === "POST");
    expect(create.options.credentials).toBe("include");
    expect(create.options.headers["X-CSRF-Token"]).toBe(csrfToken);
    expect(JSON.parse(create.options.body)).toMatchObject({name: "Jalebi", price: "120.5", categoryId: category.id});
  });

  it("loads category records and presents the empty state when none exist", async () => {
    const fetchMock = vi.fn(async url => {
      if (url === "/api/admin/auth/session") return response({admin, csrfToken});
      if (url === "/api/admin/categories?includeInactive=true") return response([]);
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    renderAt("/admin/categories");
    expect(await screen.findByText("No categories yet. Add one above to start organizing products.")).toBeTruthy();
  });

  it("shows a clear error state when an admin API request fails", async () => {
    const fetchMock = vi.fn(async url => {
      if (url === "/api/admin/auth/session") return response({admin, csrfToken});
      if (url.startsWith("/api/admin/products?")) {
        return {ok: false, status: 503, json: async () => ({success: false, error: {message: "Admin service unavailable"}})};
      }
      if (url === "/api/admin/categories?includeInactive=true") return response([category]);
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    renderAt("/admin/products");
    expect((await screen.findByRole("alert")).textContent).toContain("Admin service unavailable");
  });

  it("loads orders and sends status changes with credentials and CSRF", async () => {
    const requests = [];
    const fetchMock = vi.fn(async (url, options) => {
      requests.push({url, options});
      if (url === "/api/admin/auth/session") return response({admin, csrfToken});
      if (url.startsWith("/api/admin/orders?")) return response({items: [order], page: 1, pageSize: 10, total: 1, totalPages: 1});
      if (url === "/api/admin/orders/order-1/status") return response({...order, orderStatus: "CONFIRMED"});
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    renderAt("/admin/orders");

    const status = await screen.findByLabelText("Order status MTH-1001");
    await user.selectOptions(status, "CONFIRMED");
    await waitFor(() => expect(requests.some(item => item.url === "/api/admin/orders/order-1/status")).toBe(true));
    const update = requests.find(item => item.url === "/api/admin/orders/order-1/status");
    expect(update.options.credentials).toBe("include");
    expect(update.options.headers["X-CSRF-Token"]).toBe(csrfToken);
    expect(JSON.parse(update.options.body)).toEqual({orderStatus: "CONFIRMED"});
    expect(await screen.findByText("Order status updated.")).toBeTruthy();
  });

  it("loads and saves store settings through the protected API", async () => {
    const requests = [];
    const initial = {shopName: "MITHAS", contactNumber: "+91 98765 43210", address: "Kolhapur", deliveryFee: "40.00", minimumOrderAmount: "250.00", isOperating: true};
    const fetchMock = vi.fn(async (url, options) => {
      requests.push({url, options});
      if (url === "/api/admin/auth/session") return response({admin, csrfToken});
      if (url === "/api/admin/settings" && options.method === "GET") return response(initial);
      if (url === "/api/admin/settings" && options.method === "PUT") return response({...initial, ...JSON.parse(options.body)});
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    renderAt("/admin/settings");

    const address = await screen.findByLabelText("Address");
    await user.clear(address);
    await user.type(address, "New address");
    await user.click(screen.getByRole("button", {name: "Save settings"}));

    await waitFor(() => expect(requests.some(item => item.url === "/api/admin/settings" && item.options.method === "PUT")).toBe(true));
    const update = requests.find(item => item.url === "/api/admin/settings" && item.options.method === "PUT");
    expect(update.options.headers["X-CSRF-Token"]).toBe(csrfToken);
    expect(JSON.parse(update.options.body)).toMatchObject({address: "New address", deliveryFee: "40.00", isOperating: true});
    expect(await screen.findByText("Store settings saved.")).toBeTruthy();
  });
});
