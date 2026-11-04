import {asyncHandler} from "../middleware/asyncHandler.js";
import {createCheckoutOrder, getPublicOrderConfirmation} from "../services/checkoutService.js";
import {getProductBySlug, getStoreSettings, listCategories, listProducts} from "../services/catalogService.js";
import {categoryQuerySchema, checkoutInputSchema, orderReferenceSchema, productQuerySchema, productSlugSchema} from "../validators/catalogValidators.js";

export const getProducts = asyncHandler(async (req, res) => {
  const query = productQuerySchema.parse(req.query);
  const data = await listProducts(req.app.locals.db, query);
  res.status(200).json({success: true, data});
});

export const getProduct = asyncHandler(async (req, res) => {
  const {slug} = productSlugSchema.parse(req.params);
  const data = await getProductBySlug(req.app.locals.db, slug);
  if (!data) {
    res.status(404).json({success: false, error: {code: "PRODUCT_NOT_FOUND", message: "Product was not found"}});
    return;
  }
  res.status(200).json({success: true, data});
});

export const getCategories = asyncHandler(async (req, res) => {
  const query = categoryQuerySchema.parse(req.query);
  const data = await listCategories(req.app.locals.db, query);
  res.status(200).json({success: true, data});
});

export const getStoreSettingsController = asyncHandler(async (req, res) => {
  const data = await getStoreSettings(req.app.locals.db);
  res.status(200).json({success: true, data});
});

export const postCheckout = asyncHandler(async (req, res) => {
  const checkoutKey = req.get("idempotency-key");
  if (typeof checkoutKey !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(checkoutKey)) {
    res.status(400).json({success: false, error: {code: "INVALID_IDEMPOTENCY_KEY", message: "A valid checkout key is required"}});
    return;
  }
  const input = checkoutInputSchema.parse(req.body);
  const result = await createCheckoutOrder(req.app.locals.db, input, checkoutKey);
  res.status(result.replayed ? 200 : 201).json({success: true, data: result});
});

export const getOrderConfirmation = asyncHandler(async (req, res) => {
  const {orderNumber} = orderReferenceSchema.parse(req.params);
  const data = await getPublicOrderConfirmation(req.app.locals.db, orderNumber);
  res.status(200).json({success: true, data});
});
