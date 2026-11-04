-- Additive dashboard fields. This migration has not been applied to any database.
ALTER TABLE "Category"
ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "StoreSettings"
ADD COLUMN "deliveryFee" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN "minimumOrderAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN "isOperating" BOOLEAN NOT NULL DEFAULT true;
