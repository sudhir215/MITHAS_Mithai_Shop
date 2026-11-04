# Admin dashboard API

These APIs use the existing opaque HTTP-only admin session cookie. Every admin request requires an authenticated session. Non-safe methods also require the configured allowed `Origin`, the readable CSRF cookie, and a matching `X-CSRF-Token` header. JSON input is validated server-side.

## Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/admin/products` | Paginated product list; `page`, `pageSize`, `search`, `categoryId`, and `availability` filters |
| `POST` | `/api/admin/products` | Create product |
| `PUT` | `/api/admin/products/:id` | Update product |
| `DELETE` | `/api/admin/products/:id` | Safely deactivate product; does not delete order history |
| `GET` | `/api/admin/categories` | List categories; `includeInactive=true` includes inactive categories |
| `POST` | `/api/admin/categories` | Create category |
| `PUT` | `/api/admin/categories/:id` | Update category |
| `PATCH` | `/api/admin/categories/:id/deactivate` | Deactivate category without deleting products |
| `PATCH` | `/api/admin/categories/:id/activate` | Reactivate a category |
| `DELETE` | `/api/admin/categories/:id` | Delete only if no products depend on the category |
| `GET` | `/api/admin/orders` | Paginated orders; filters include search, order/payment status, and date range |
| `GET` | `/api/admin/orders/:id` | Read order, customer contact, and line items |
| `PATCH` | `/api/admin/orders/:id/status` | Apply an allowed fulfillment status transition |
| `PATCH` | `/api/admin/orders/:id/payment-status` | Apply an allowed payment transition independently |
| `GET` | `/api/admin/settings` | Read store settings |
| `PUT` | `/api/admin/settings` | Update store settings |
| `GET` | `/api/admin/inventory` | Paginated stock list; filters: `page`, `pageSize`, `search`, `stock`, and `lowStockThreshold` |
| `GET` | `/api/admin/inventory/movements` | Paginated, newest-first stock movement history; optional `productId` |
| `POST` | `/api/admin/inventory/:id/adjust` | Atomically adjust stock and record admin, reason, and before/after values |
| `GET` | `/api/admin/customers` | Paginated customer directory; searches name, phone, and email |
| `GET` | `/api/admin/customers/:id` | Customer contact details and complete order history |
| `GET` | `/api/admin/analytics/dashboard` | Order totals, pending orders, eligible revenue, daily/monthly summaries, best sellers |

`OWNER` and the existing `ADMIN` role (the project's current STAFF-equivalent role) may manage products, categories, and orders. Only `OWNER` may update store settings. `ADMIN` accounts are not rewritten or renamed by this work.

Order transitions are `PENDING -> CONFIRMED|CANCELLED`, `CONFIRMED -> PREPARING|CANCELLED`, `PREPARING -> READY|CANCELLED`, and `READY -> COMPLETED|CANCELLED`. `COMPLETED` and `CANCELLED` are terminal. Payment transitions are `PENDING -> PAID|FAILED` and `PAID -> REFUNDED`. Invalid or concurrent transitions return a conflict response.

All admin roles currently supported by this project's schema (`OWNER` and `ADMIN`) can access inventory, customer, and analytics data. Customer contact information is returned only by these authenticated endpoints and only explicitly selected customer fields are returned. Stock cannot be changed through product editing; it must use the audited inventory adjustment endpoint. Adjustments use a serializable transaction and an optimistic stock check to prevent negative or overwritten balances.

Revenue and customer spending use only orders with both `paymentStatus = PAID` and `orderStatus = COMPLETED`. Refunded, failed, pending, and cancelled orders are excluded. Daily periods use UTC and include the latest 30 days; monthly periods include the latest 12 months. Order counts include all orders, while pending counts include `PENDING` orders.

## Database migrations required before deployment

No database migration status was queried in this offline work, so which migrations remain pending on any target is unknown. Review the migration history before a separately approved deployment. The local migration sequence currently includes:

1. `20261104220000_initial_schema` — initial shop, order, product, customer, and admin tables.
2. `20261104223000_add_integrity_constraints` — nonnegative prices/fees/stock, positive order quantities, and order total/subtotal integrity checks.
3. `20261104224000_admin_sessions` — persistent admin sessions for cookie authentication.
4. `20261104225000_admin_dashboard_fields` — dashboard fields:

- `Category.isActive` (default `true`) for safe category deactivation.
- `StoreSettings.deliveryFee` and `minimumOrderAmount` (default `0`), and `isOperating` (default `true`).

5. `20261104230000_inventory_stock_movements` — inventory audit history:

- `StockMovement` with product/admin foreign keys, signed adjustment, before/after quantity, reason, and timestamp.
- Indexes for product/time and admin/time history lookups.
- Restrictive foreign keys so referenced product/admin records cannot be deleted while audit history exists.

The last two migrations are additive. These files are local only and none were applied as part of this milestone. Do not assume the target database is empty or that any migration is pending; verify its migration history and review the SQL before any separately approved operation.

Stock adjustments are persisted as stock movement audit history. The schema still has no general-purpose audit log for unrelated admin actions (product edits, order updates, settings changes). If a comprehensive admin audit trail is required, propose a separate additive `AdminAuditLog` model with action/entity metadata, actor, timestamp, indexes, and an agreed retention/access policy.
