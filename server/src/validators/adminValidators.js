import {z} from "zod";

const moneySchema = z.union([z.number(), z.string().trim()])
  .transform(value => String(value))
  .refine(value => /^(?:0|[1-9]\d{0,7})(?:\.\d{1,2})?$/.test(value), "Enter a nonnegative amount with at most two decimal places");

const idSchema = z.string().trim().min(1).max(64);
const nameSchema = z.string().trim().min(1).max(120);
const descriptionSchema = z.string().trim().max(4000);
const optionalUrlSchema = z.union([
  z.string().trim().url().max(2048).refine(value => /^https?:\/\//i.test(value), "Image URL must use HTTP or HTTPS"),
  z.literal(""),
]).transform(value => value || null).optional();

export const adminProductListSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(120).default(""),
  categoryId: idSchema.optional(),
  availability: z.enum(["all", "available", "unavailable"]).default("all"),
}).strict();

export const productInputSchema = z.object({
  name: nameSchema,
  description: descriptionSchema,
  price: moneySchema,
  stockQuantity: z.coerce.number().int().min(0).max(2_147_483_647),
  categoryId: idSchema,
  imageUrl: optionalUrlSchema,
  isFeatured: z.boolean().default(false),
  isAvailable: z.boolean().default(true),
}).strict();

export const adminCategoryListSchema = z.object({
  includeInactive: z.enum(["true", "false"]).default("false"),
}).strict();

export const categoryInputSchema = z.object({
  name: nameSchema,
  description: descriptionSchema.nullable().optional(),
}).strict();

export const adminOrderListSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(120).default(""),
  orderStatus: z.enum(["PENDING", "CONFIRMED", "PREPARING", "READY", "COMPLETED", "CANCELLED"]).optional(),
  paymentStatus: z.enum(["PENDING", "PAID", "FAILED", "REFUNDED"]).optional(),
  from: z.string().date().optional(),
  to: z.string().date().optional(),
}).strict().refine(value => !value.from || !value.to || value.from <= value.to, {
  path: ["to"],
  message: "End date must be on or after start date",
});

export const orderIdParamsSchema = z.object({id: idSchema}).strict();
export const orderStatusInputSchema = z.object({
  orderStatus: z.enum(["PENDING", "CONFIRMED", "PREPARING", "READY", "COMPLETED", "CANCELLED"]),
}).strict();
export const paymentStatusInputSchema = z.object({
  paymentStatus: z.enum(["PENDING", "PAID", "FAILED", "REFUNDED"]),
}).strict();

export const storeSettingsInputSchema = z.object({
  shopName: nameSchema,
  phone: z.string().trim().max(40).nullable().optional(),
  address: z.string().trim().max(2000).nullable().optional(),
  deliveryFee: moneySchema,
  minimumOrderAmount: moneySchema,
  isOperating: z.boolean(),
}).strict().refine(value => !value.phone || /^[+()\d .-]{5,40}$/.test(value.phone), {
  path: ["phone"],
  message: "Enter a valid phone number",
});

export const inventoryListSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(120).default(""),
  stock: z.enum(["all", "low", "out"]).default("all"),
  lowStockThreshold: z.coerce.number().int().min(0).max(1_000_000).default(5),
}).strict();

export const stockMovementListSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  productId: idSchema.optional(),
}).strict();

export const stockAdjustmentSchema = z.object({
  quantityChange: z.coerce.number().int().min(-1_000_000).max(1_000_000).refine(value => value !== 0, "Stock change cannot be zero"),
  reason: z.string().trim().min(3).max(500),
}).strict();

export const adminCustomerListSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(120).default(""),
}).strict();

export const customerIdParamsSchema = z.object({id: idSchema}).strict();
