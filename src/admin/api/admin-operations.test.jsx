import {cleanup, render, screen, waitFor} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {afterEach, describe, expect, it, vi} from "vitest";
import {MemoryRouter} from "react-router-dom";
import App from "../../App.jsx";

const csrfToken = "csrf-token-for-admin-operations-tests";
const admin = {id: "admin-1", email: "owner@example.test", role: "OWNER"};
const product = {
  id: "product-1", name: "Kaju Katli", slug: "kaju-katli", stockQuantity: 4, isAvailable: true,
  category: {id: "category-1", name: "Barfi"},
};
const customer = {
  id: "customer-1", name: "Asha Shah", phone: "+919999999991", email: "asha@example.test",
  totalOrders: 2, totalSpending: "700.00", createdAt: "2026-10-01T00:00:00.000Z",
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

describe("inventory, customer, and analytics dashboard integration", () => {
  it("shows stock levels and records adjustments with credentials and CSRF", async () => {
    const requests = [];
    const fetchMock = vi.fn(async (url, options) => {
      requests.push({url, options});
      if (url === "/api/admin/auth/session") return response({admin, csrfToken});
      if (url.startsWith("/api/admin/inventory?")) return response({items: [product], page: 1, pageSize: 10, total: 1, totalPages: 1});
      if (url.startsWith("/api/admin/inventory/movements?")) return response({items: [], page: 1, pageSize: 20, total: 0, totalPages: 0});
      if (url === "/api/admin/inventory/product-1/adjust") {
        return response({product: {name: product.name}, previousQuantity: 4, newQuantity: 7});
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    renderAt("/admin/inventory");

    expect(await screen.findByText("Kaju Katli")).toBeTruthy();
    expect(screen.getByText("Low stock")).toBeTruthy();
    await user.click(screen.getByRole("button", {name: "Adjust stock"}));
    await user.type(screen.getByLabelText("Quantity change"), "3");
    await user.type(screen.getByLabelText("Reason"), "Supplier restock");
    await user.click(screen.getByRole("button", {name: "Record adjustment"}));

    await waitFor(() => expect(requests.some(item => item.url === "/api/admin/inventory/product-1/adjust")).toBe(true));
    const update = requests.find(item => item.url === "/api/admin/inventory/product-1/adjust");
    expect(update.options.credentials).toBe("include");
    expect(update.options.headers["X-CSRF-Token"]).toBe(csrfToken);
    expect(JSON.parse(update.options.body)).toEqual({quantityChange: 3, reason: "Supplier restock"});
    expect(await screen.findByText("Kaju Katli stock changed from 4 to 7.")).toBeTruthy();
  });

  it("lists customers, displays spending, and opens protected customer order history", async () => {
    const fetchMock = vi.fn(async (url, options) => {
      if (url === "/api/admin/auth/session") return response({admin, csrfToken});
      if (url.startsWith("/api/admin/customers?")) return response({items: [customer], page: 1, pageSize: 10, total: 1, totalPages: 1});
      if (url === "/api/admin/customers/customer-1") return response({
        ...customer,
        orders: [{
          id: "order-1", orderNumber: "MTH-001", orderStatus: "COMPLETED", paymentStatus: "PAID",
          subtotal: "700.00", deliveryFee: "0.00", total: "700.00", createdAt: "2026-10-01T00:00:00.000Z",
          items: [{productName: "Kaju Katli", quantity: 2, subtotal: "700.00"}],
        }],
      });
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    renderAt("/admin/customers");

    expect(await screen.findByText("₹700.00")).toBeTruthy();
    await user.click(screen.getByRole("link", {name: "View details"}));
    expect(await screen.findByText("MTH-001")).toBeTruthy();
    expect(screen.getByText("Kaju Katli × 2")).toBeTruthy();
  });

  it("renders database-backed dashboard totals and product rankings", async () => {
    const fetchMock = vi.fn(async url => {
      if (url === "/api/admin/auth/session") return response({admin, csrfToken});
      if (url.startsWith("/api/admin/inventory?")) return response({items: [product], page: 1, pageSize: 5, total: 1, totalPages: 1});
      if (url === "/api/admin/analytics/dashboard") return response({
        totalOrders: 24,
        pendingOrders: 3,
        revenue: "12500.00",
        todayRevenue: "500.00",
        todayOrders: 2,
        monthRevenue: "4000.00",
        monthOrders: 8,
        dailySales: [{period: "2026-11-04", orders: 2, revenue: "500.00"}],
        monthlySales: [{period: "2026-11", orders: 8, revenue: "4000.00"}],
        bestSellingProducts: [{id: "product-1", name: "Kaju Katli", quantitySold: 20, revenue: "5000.00"}],
      });
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    renderAt("/admin");

    expect(await screen.findByText("Connected analytics")).toBeTruthy();
    expect(screen.getByText("24")).toBeTruthy();
    expect(screen.getByText("₹12,500.00")).toBeTruthy();
    expect(screen.getAllByText("Kaju Katli").length).toBeGreaterThan(0);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/admin/analytics/dashboard", expect.objectContaining({credentials: "include"})));
  });
});
