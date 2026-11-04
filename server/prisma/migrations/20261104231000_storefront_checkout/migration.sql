-- Additive storefront checkout fields. This migration has not been applied to any database.
ALTER TABLE "Order"
ADD COLUMN "checkoutKey" TEXT,
ADD COLUMN "checkoutHash" CHAR(64),
ADD COLUMN "deliveryAddress" TEXT NOT NULL DEFAULT '';

CREATE UNIQUE INDEX "Order_checkoutKey_key" ON "Order"("checkoutKey");
