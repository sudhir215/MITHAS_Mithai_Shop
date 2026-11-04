import {cleanup, render, screen, waitFor} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {MemoryRouter} from "react-router-dom";
import App from "../../App.jsx";

const admin = {id: "admin-1", email: "owner@example.test", role: "OWNER"};
const csrfToken = "csrf-token-value-for-mocked-session";
const password = "correct horse battery staple";

function jsonResponse(status, body, headers = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(headers),
    json: async () => body,
  };
}

function renderAt(path) {
  return render(<MemoryRouter initialEntries={[path]}><App/></MemoryRouter>);
}

function makeFetch({authenticated = false, loginStatus = 200, logoutStatus = 200} = {}) {
  let isAuthenticated = authenticated;
  const requests = [];
  const fetchMock = vi.fn(async (url, options) => {
    requests.push({url, options});
    if (url === "/api/admin/auth/session") {
      return isAuthenticated
        ? jsonResponse(200, {success: true, data: {admin, csrfToken, expiresAt: "2026-11-05T06:00:00.000Z"}})
        : jsonResponse(401, {success: false, error: {code: "AUTHENTICATION_REQUIRED", message: "Authentication is required"}});
    }

    if (url === "/api/admin/login") {
      if (loginStatus !== 200) {
        return jsonResponse(loginStatus, {success: false, error: {code: "INVALID_CREDENTIALS", message: "Invalid email or password"}});
      }
      isAuthenticated = true;
      return jsonResponse(200, {success: true, data: {admin, csrfToken, expiresAt: "2026-11-05T06:00:00.000Z"}});
    }

    if (url === "/api/admin/auth/logout") {
      if (logoutStatus === 200) isAuthenticated = false;
      return logoutStatus === 200
        ? jsonResponse(200, {success: true, data: {loggedOut: true}})
        : jsonResponse(logoutStatus, {success: false, error: {code: "CSRF_VALIDATION_FAILED", message: "Request could not be verified"}});
    }

    if (url === "/api/admin/analytics/dashboard") {
      return jsonResponse(200, {success: true, data: {
        totalOrders: 0,
        pendingOrders: 0,
        revenue: "0",
        todayRevenue: "0",
        todayOrders: 0,
        monthRevenue: "0",
        monthOrders: 0,
        dailySales: [],
        monthlySales: [],
        bestSellingProducts: [],
      }});
    }

    if (url.startsWith("/api/admin/inventory?")) {
      return jsonResponse(200, {success: true, data: {items: [], page: 1, pageSize: 5, total: 0, totalPages: 0}});
    }

    throw new Error(`Unexpected API request: ${url}`);
  });
  return {fetchMock, requests};
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("admin frontend authentication", () => {
  it("logs in with valid credentials, includes cookies, and redirects to admin", async () => {
    const user = userEvent.setup();
    const {fetchMock, requests} = makeFetch();
    vi.stubGlobal("fetch", fetchMock);
    renderAt("/admin/login");

    await user.type(await screen.findByLabelText("Email address"), admin.email);
    await user.type(screen.getByLabelText("Password"), password);
    await user.click(screen.getByRole("button", {name: "Sign in"}));

    expect(await screen.findByLabelText(`Signed in as ${admin.email}`)).toBeTruthy();
    const loginRequest = requests.find(request => request.url === "/api/admin/login");
    expect(loginRequest.options.method).toBe("POST");
    expect(loginRequest.options.credentials).toBe("include");
    expect(JSON.parse(loginRequest.options.body)).toEqual({email: admin.email, password});
    expect(window.localStorage.length).toBe(0);
    expect(requests.every(request => request.options.credentials === "include")).toBe(true);
  });

  it("shows a useful error for incorrect credentials and prevents duplicate submission while pending", async () => {
    const user = userEvent.setup();
    let rejectLogin;
    const {fetchMock} = makeFetch({loginStatus: 401});
    const baseFetch = fetchMock.getMockImplementation();
    fetchMock.mockImplementation(async (url, options) => {
      if (url === "/api/admin/login") {
        return new Promise(resolve => {
          rejectLogin = () => resolve(jsonResponse(401, {
            success: false,
            error: {code: "INVALID_CREDENTIALS", message: "Invalid email or password"},
          }));
        });
      }
      return baseFetch(url, options);
    });
    vi.stubGlobal("fetch", fetchMock);
    renderAt("/admin/login");

    await user.type(await screen.findByLabelText("Email address"), admin.email);
    await user.type(screen.getByLabelText("Password"), "incorrect password");
    await user.click(screen.getByRole("button", {name: "Sign in"}));
    expect(screen.getByRole("button", {name: "Signing in…"}).disabled).toBe(true);
    await user.click(screen.getByRole("button", {name: "Signing in…"}));
    expect(fetchMock.mock.calls.filter(([url]) => url === "/api/admin/login")).toHaveLength(1);

    rejectLogin();
    expect((await screen.findByRole("alert")).textContent).toContain("Invalid email or password");
  });

  it("redirects expired sessions from protected admin routes to login", async () => {
    const {fetchMock} = makeFetch();
    vi.stubGlobal("fetch", fetchMock);
    renderAt("/admin/orders");

    expect(await screen.findByRole("heading", {name: "Welcome back"})).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith("/api/admin/auth/session", expect.objectContaining({credentials: "include"}));
  });

  it("restores an authenticated session after a page refresh", async () => {
    const {fetchMock} = makeFetch({authenticated: true});
    vi.stubGlobal("fetch", fetchMock);
    renderAt("/admin/orders");

    expect(await screen.findByLabelText(`Signed in as ${admin.email}`)).toBeTruthy();
    await waitFor(() => expect(screen.getAllByRole("heading", {name: "Orders"}).length).toBeGreaterThan(1));
    expect(fetchMock).toHaveBeenCalledWith("/api/admin/auth/session", expect.objectContaining({credentials: "include"}));
  });

  it("logs out with the CSRF token and redirects to login", async () => {
    const user = userEvent.setup();
    const {fetchMock, requests} = makeFetch({authenticated: true});
    vi.stubGlobal("fetch", fetchMock);
    renderAt("/admin");

    await user.click(await screen.findByRole("button", {name: /Logout/}));
    expect(await screen.findByRole("heading", {name: "Welcome back"})).toBeTruthy();

    const logoutRequest = requests.find(request => request.url === "/api/admin/auth/logout");
    expect(logoutRequest.options.credentials).toBe("include");
    expect(logoutRequest.options.headers["X-CSRF-Token"]).toBe(csrfToken);
  });

  it("keeps the admin page available and reports CSRF rejection when logout is rejected", async () => {
    const user = userEvent.setup();
    const {fetchMock} = makeFetch({authenticated: true, logoutStatus: 403});
    vi.stubGlobal("fetch", fetchMock);
    renderAt("/admin");

    await user.click(await screen.findByRole("button", {name: /Logout/}));
    expect((await screen.findByRole("alert")).textContent).toContain("Request could not be verified");
    expect(screen.getByLabelText(`Signed in as ${admin.email}`)).toBeTruthy();
  });
});
