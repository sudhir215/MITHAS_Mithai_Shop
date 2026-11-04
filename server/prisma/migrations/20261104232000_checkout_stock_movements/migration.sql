-- Allow stock changes caused by customer orders to be audited without an admin actor.
ALTER TABLE "StockMovement"
ALTER COLUMN "adminId" DROP NOT NULL;

ALTER TABLE "StockMovement"
ADD COLUMN "orderId" TEXT;

CREATE INDEX "StockMovement_orderId_idx" ON "StockMovement"("orderId");

ALTER TABLE "StockMovement"
ADD CONSTRAINT "StockMovement_orderId_fkey"
FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
