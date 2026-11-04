-- Prisma schema fields do not currently express PostgreSQL CHECK constraints
-- or deferred cross-table constraints. Keep these additions in a new migration.
ALTER TABLE "Product"
    ADD CONSTRAINT "Product_price_nonnegative_check" CHECK ("price" >= 0),
    ADD CONSTRAINT "Product_stockQuantity_nonnegative_check" CHECK ("stockQuantity" >= 0);

ALTER TABLE "Order"
    ADD CONSTRAINT "Order_subtotal_nonnegative_check" CHECK ("subtotal" >= 0),
    ADD CONSTRAINT "Order_deliveryFee_nonnegative_check" CHECK ("deliveryFee" >= 0),
    ADD CONSTRAINT "Order_total_nonnegative_check" CHECK ("total" >= 0),
    ADD CONSTRAINT "Order_total_matches_components_check" CHECK ("total" = "subtotal" + "deliveryFee");

ALTER TABLE "OrderItem"
    ADD CONSTRAINT "OrderItem_quantity_positive_check" CHECK ("quantity" > 0),
    ADD CONSTRAINT "OrderItem_unitPrice_nonnegative_check" CHECK ("unitPrice" >= 0),
    ADD CONSTRAINT "OrderItem_subtotal_nonnegative_check" CHECK ("subtotal" >= 0),
    ADD CONSTRAINT "OrderItem_subtotal_matches_quantity_check" CHECK ("subtotal" = "quantity" * "unitPrice");

CREATE FUNCTION mithas_assert_order_subtotal_matches_items(target_order_id TEXT)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    declared_subtotal NUMERIC;
    calculated_subtotal NUMERIC;
BEGIN
    SELECT "subtotal"
      INTO declared_subtotal
      FROM "Order"
     WHERE "id" = target_order_id;

    IF NOT FOUND THEN
        RETURN;
    END IF;

    SELECT COALESCE(SUM("subtotal"), 0)
      INTO calculated_subtotal
      FROM "OrderItem"
     WHERE "orderId" = target_order_id;

    IF declared_subtotal <> calculated_subtotal THEN
        RAISE EXCEPTION 'Order subtotal must equal the sum of its item subtotals'
            USING ERRCODE = '23514';
    END IF;
END;
$$;

CREATE FUNCTION mithas_check_order_subtotal_from_order()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    PERFORM mithas_assert_order_subtotal_matches_items(NEW."id");
    RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER "Order_subtotal_matches_items_trigger"
AFTER INSERT OR UPDATE ON "Order"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION mithas_check_order_subtotal_from_order();

CREATE FUNCTION mithas_check_order_subtotal_from_item()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        PERFORM mithas_assert_order_subtotal_matches_items(NEW."orderId");
    ELSIF TG_OP = 'UPDATE' THEN
        PERFORM mithas_assert_order_subtotal_matches_items(OLD."orderId");
        IF NEW."orderId" IS DISTINCT FROM OLD."orderId" THEN
            PERFORM mithas_assert_order_subtotal_matches_items(NEW."orderId");
        END IF;
    ELSE
        PERFORM mithas_assert_order_subtotal_matches_items(OLD."orderId");
    END IF;

    RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER "OrderItem_subtotal_matches_items_trigger"
AFTER INSERT OR UPDATE OR DELETE ON "OrderItem"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION mithas_check_order_subtotal_from_item();
