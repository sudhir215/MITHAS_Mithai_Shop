import {z} from "zod";

export const productQuerySchema = z.object({
  category: z.string().trim().min(1).max(100).optional(),
  featured: z.enum(["true", "false"]).optional(),
  search: z.string().trim().max(120).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().trim().min(1).optional(),
}).strict();

export const categoryQuerySchema = z.object({
  includeProducts: z.enum(["true", "false"]).default("false"),
}).strict();

export const checkoutInputSchema = z.object({
  customerName: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(8).max(25).regex(/^\+?[0-9][0-9 ()-]{6,23}$/, "Enter a valid phone number"),
  deliveryAddress: z.string().trim().min(8).max(1000),
  items: z.array(z.object({
    productId: z.string().trim().min(1).max(64),
    quantity: z.number().int().min(1).max(100),
  }).strict()).min(1).max(50).refine(items => new Set(items.map(item => item.productId)).size === items.length, {
    message: "Each product may only appear once in the cart",
  }),
}).strict();

export const orderReferenceSchema = z.object({
  orderNumber: z.string().trim().min(32).max(64).regex(/^MTH-[A-Z0-9]+-[A-F0-9]{32}$/),
}).strict();
export const productSlugSchema = z.object({
  slug: z.string().trim().min(1).max(120).regex(/^[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*$/u),
}).strict();
