import {Router} from "express";
import {
  authenticateAdmin,
  getAdminCsrfCookieName,
  getAdminCsrfToken,
  getAdminSessionCookieName,
  getAdminSessionCookieOptions,
  isValidAdminCsrfToken,
  loginAdmin,
  protectAdminCsrf,
  requireAdminRole,
} from "../middleware/adminAuth.js";
import {asyncHandler} from "../middleware/asyncHandler.js";
import {
  adminCategoryListSchema,
  adminOrderListSchema,
  adminProductListSchema,
  categoryInputSchema,
  adminCustomerListSchema,
  customerIdParamsSchema,
  inventoryListSchema,
  orderIdParamsSchema,
  orderStatusInputSchema,
  paymentStatusInputSchema,
  productInputSchema,
  stockAdjustmentSchema,
  stockMovementListSchema,
  storeSettingsInputSchema,
} from "../validators/adminValidators.js";
import {
  adjustInventory,
  getAdminCustomer,
  getDashboardAnalytics,
  listAdminCustomers,
  listInventory,
  listStockMovements,
} from "../services/adminOperationsService.js";
import {
  activateAdminCategory,
  createAdminCategory,
  createAdminProduct,
  deactivateAdminCategory,
  deactivateAdminProduct,
  deleteAdminCategory,
  getAdminOrder,
  getAdminStoreSettings,
  listAdminCategories,
  listAdminOrders,
  listAdminProducts,
  updateAdminCategory,
  updateAdminOrderStatus,
  updateAdminPaymentStatus,
  updateAdminProduct,
  updateAdminStoreSettings,
} from "../services/adminDashboardService.js";

const adminRouter = Router();
const staffRoles = requireAdminRole("OWNER", "ADMIN");
const ownerRole = requireAdminRole("OWNER");

const login = [
  (req, res, next) => req.app.locals.loginRateLimiter(req, res, next),
  loginAdmin,
];

adminRouter.post("/login", ...login);
adminRouter.post("/auth/login", ...login);

adminRouter.use(authenticateAdmin);

adminRouter.get("/auth/session", (req, res) => {
  const csrfToken = getAdminCsrfToken(req);
  if (!isValidAdminCsrfToken(csrfToken, req.adminSession.csrfTokenHash)) {
    res.status(403).json({
      success: false,
      error: {code: "CSRF_VALIDATION_FAILED", message: "Request could not be verified"},
    });
    return;
  }

  res.status(200).json({
    success: true,
    data: {
      admin: req.admin,
      csrfToken,
      expiresAt: req.adminSession.expiresAt.toISOString(),
    },
  });
});

adminRouter.use(protectAdminCsrf);

adminRouter.post("/auth/logout", async (req, res, next) => {
  try {
    await req.app.locals.db.adminSession.deleteMany({
      where: {tokenHash: req.adminSession.tokenHash},
    });
    const cookieOptions = getAdminSessionCookieOptions();
    res.clearCookie(getAdminSessionCookieName(), cookieOptions);
    res.clearCookie(getAdminCsrfCookieName(), {
      ...cookieOptions,
      httpOnly: false,
    });
    res.status(200).json({success: true, data: {loggedOut: true}});
  } catch (error) {
    next(error);
  }
});

adminRouter.get("/products", staffRoles, asyncHandler(async (req, res) => {
  const query = adminProductListSchema.parse(req.query);
  const data = await listAdminProducts(req.app.locals.db, query);
  res.status(200).json({success: true, data});
}));
adminRouter.post("/products", staffRoles, asyncHandler(async (req, res) => {
  const input = productInputSchema.parse(req.body);
  const data = await createAdminProduct(req.app.locals.db, input);
  res.status(201).json({success: true, data});
}));
adminRouter.put("/products/:id", staffRoles, asyncHandler(async (req, res) => {
  const {id} = orderIdParamsSchema.parse(req.params);
  const input = productInputSchema.parse(req.body);
  const data = await updateAdminProduct(req.app.locals.db, id, input);
  res.status(200).json({success: true, data});
}));
adminRouter.delete("/products/:id", staffRoles, asyncHandler(async (req, res) => {
  const {id} = orderIdParamsSchema.parse(req.params);
  const data = await deactivateAdminProduct(req.app.locals.db, id);
  res.status(200).json({success: true, data});
}));

adminRouter.get("/categories", staffRoles, asyncHandler(async (req, res) => {
  const query = adminCategoryListSchema.parse(req.query);
  const data = await listAdminCategories(req.app.locals.db, query.includeInactive === "true");
  res.status(200).json({success: true, data});
}));
adminRouter.post("/categories", staffRoles, asyncHandler(async (req, res) => {
  const input = categoryInputSchema.parse(req.body);
  const data = await createAdminCategory(req.app.locals.db, input);
  res.status(201).json({success: true, data});
}));
adminRouter.put("/categories/:id", staffRoles, asyncHandler(async (req, res) => {
  const {id} = orderIdParamsSchema.parse(req.params);
  const input = categoryInputSchema.parse(req.body);
  const data = await updateAdminCategory(req.app.locals.db, id, input);
  res.status(200).json({success: true, data});
}));
adminRouter.patch("/categories/:id/deactivate", staffRoles, asyncHandler(async (req, res) => {
  const {id} = orderIdParamsSchema.parse(req.params);
  const data = await deactivateAdminCategory(req.app.locals.db, id);
  res.status(200).json({success: true, data});
}));
adminRouter.patch("/categories/:id/activate", staffRoles, asyncHandler(async (req, res) => {
  const {id} = orderIdParamsSchema.parse(req.params);
  const data = await activateAdminCategory(req.app.locals.db, id);
  res.status(200).json({success: true, data});
}));
adminRouter.delete("/categories/:id", staffRoles, asyncHandler(async (req, res) => {
  const {id} = orderIdParamsSchema.parse(req.params);
  const data = await deleteAdminCategory(req.app.locals.db, id);
  res.status(200).json({success: true, data});
}));

adminRouter.get("/orders", staffRoles, asyncHandler(async (req, res) => {
  const query = adminOrderListSchema.parse(req.query);
  const data = await listAdminOrders(req.app.locals.db, query);
  res.status(200).json({success: true, data});
}));
adminRouter.get("/orders/:id", staffRoles, asyncHandler(async (req, res) => {
  const {id} = orderIdParamsSchema.parse(req.params);
  const data = await getAdminOrder(req.app.locals.db, id);
  res.status(200).json({success: true, data});
}));
adminRouter.patch("/orders/:id/status", staffRoles, asyncHandler(async (req, res) => {
  const {id} = orderIdParamsSchema.parse(req.params);
  const {orderStatus} = orderStatusInputSchema.parse(req.body);
  const data = await updateAdminOrderStatus(req.app.locals.db, id, orderStatus, req.admin.id);
  res.status(200).json({success: true, data});
}));
adminRouter.patch("/orders/:id/payment-status", staffRoles, asyncHandler(async (req, res) => {
  const {id} = orderIdParamsSchema.parse(req.params);
  const {paymentStatus} = paymentStatusInputSchema.parse(req.body);
  const data = await updateAdminPaymentStatus(req.app.locals.db, id, paymentStatus);
  res.status(200).json({success: true, data});
}));

adminRouter.get("/settings", asyncHandler(async (req, res) => {
  const data = await getAdminStoreSettings(req.app.locals.db);
  res.status(200).json({success: true, data});
}));
adminRouter.put("/settings", ownerRole, asyncHandler(async (req, res) => {
  const input = storeSettingsInputSchema.parse(req.body);
  const data = await updateAdminStoreSettings(req.app.locals.db, input);
  res.status(200).json({success: true, data});
}));

adminRouter.get("/inventory", staffRoles, asyncHandler(async (req, res) => {
  const query = inventoryListSchema.parse(req.query);
  const data = await listInventory(req.app.locals.db, query);
  res.status(200).json({success: true, data});
}));
adminRouter.get("/inventory/movements", staffRoles, asyncHandler(async (req, res) => {
  const query = stockMovementListSchema.parse(req.query);
  const data = await listStockMovements(req.app.locals.db, query);
  res.status(200).json({success: true, data});
}));
adminRouter.post("/inventory/:id/adjust", staffRoles, asyncHandler(async (req, res) => {
  const {id} = orderIdParamsSchema.parse(req.params);
  const input = stockAdjustmentSchema.parse(req.body);
  const data = await adjustInventory(req.app.locals.db, {
    productId: id,
    adminId: req.admin.id,
    ...input,
  });
  res.status(200).json({success: true, data});
}));

adminRouter.get("/customers", staffRoles, asyncHandler(async (req, res) => {
  const query = adminCustomerListSchema.parse(req.query);
  const data = await listAdminCustomers(req.app.locals.db, query);
  res.status(200).json({success: true, data});
}));
adminRouter.get("/customers/:id", staffRoles, asyncHandler(async (req, res) => {
  const {id} = customerIdParamsSchema.parse(req.params);
  const data = await getAdminCustomer(req.app.locals.db, id);
  res.status(200).json({success: true, data});
}));

adminRouter.get("/analytics/dashboard", staffRoles, asyncHandler(async (req, res) => {
  const data = await getDashboardAnalytics(req.app.locals.db);
  res.status(200).json({success: true, data});
}));

export default adminRouter;
