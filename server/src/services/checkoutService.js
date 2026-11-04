import {createHash, randomBytes} from "node:crypto";
import {Prisma} from "@prisma/client";

function httpError(status, code, message) {
  return Object.assign(new Error(message), {status, code});
}

function toCents(value) {
  const [whole, fraction = ""] = String(value).split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}

function fromCents(value) {
  return `${Math.floor(value / 100)}.${String(value % 100).padStart(2, "0")}`;
}

function getRequestHash(input) {
  const normalized = {
    customerName: input.customerName,
    phone: input.phone.replace(/[ ()-]/g, ""),
    deliveryAddress: input.deliveryAddress,
    items: [...input.items].sort((a, b) => a.productId.localeCompare(b.productId)),
  };
  return createHash("sha256").update(JSON.stringify(normalized)).digest("hex");
}

function safeOrderSelection() {
  return {
    orderNumber: true,
    subtotal: true,
    deliveryFee: true,
    total: true,
    orderStatus: true,
    paymentStatus: true,
    createdAt: true,
    items: {
      orderBy: {id: "asc"},
      select: {productName: true, quantity: true, unitPrice: true, subtotal: true},
    },
  };
}

async function findIdempotentOrder(db, checkoutKey, checkoutHash) {
  const existing = await db.order.findUnique({
    where: {checkoutKey},
    select: {...safeOrderSelection(), checkoutHash: true},
  });
  if (!existing) return null;
  if (existing.checkoutHash !== checkoutHash) {
    throw httpError(409, "IDEMPOTENCY_KEY_REUSED", "This checkout key was already used for a different order");
  }
  const {checkoutHash: _checkoutHash, ...order} = existing;
  return {order, replayed: true};
}

function createOrderNumber() {
  const timestamp = Date.now().toString(36).toUpperCase();
  return `MTH-${timestamp}-${randomBytes(16).toString("hex").toUpperCase()}`;
}

async function placeCheckoutTransaction(tx, input, checkoutKey, checkoutHash) {
  const existing = await findIdempotentOrder(tx, checkoutKey, checkoutHash);
  if (existing) return existing;

  const settings = await tx.storeSettings.findFirst({
    orderBy: [{updatedAt: "desc"}, {id: "asc"}],
    select: {deliveryFee: true, minimumOrderAmount: true, isOperating: true},
  });
  if (!settings) {
    throw httpError(503, "STORE_NOT_CONFIGURED", "The store is not ready to accept orders");
  }
  if (settings && !settings.isOperating) {
    throw httpError(409, "STORE_CLOSED", "The store is not currently accepting orders");
  }

  const products = await tx.product.findMany({
    where: {
      id: {in: input.items.map(item => item.productId)},
      isAvailable: true,
      category: {isActive: true},
    },
    select: {id: true, name: true, price: true, stockQuantity: true},
  });
  const productsById = new Map(products.map(product => [product.id, product]));
  if (products.length !== input.items.length) {
    throw httpError(409, "PRODUCT_UNAVAILABLE", "One or more selected products are unavailable");
  }

  const pricedItems = input.items.map(item => {
    const product = productsById.get(item.productId);
    if (product.stockQuantity < item.quantity) {
      throw httpError(409, "INSUFFICIENT_STOCK", `${product.name} does not have enough stock`);
    }
    const unitPriceCents = toCents(product.price);
    const subtotalCents = unitPriceCents * item.quantity;
    return {
      product,
      quantity: item.quantity,
      unitPrice: fromCents(unitPriceCents),
      subtotal: fromCents(subtotalCents),
      subtotalCents,
    };
  });

  const subtotalCents = pricedItems.reduce((sum, item) => sum + item.subtotalCents, 0);
  if (!Number.isSafeInteger(subtotalCents) || subtotalCents > 9_999_999_999) {
    throw httpError(400, "ORDER_TOTAL_TOO_LARGE", "The order total exceeds the supported limit");
  }
  const minimumOrderCents = toCents(settings.minimumOrderAmount);
  if (subtotalCents < minimumOrderCents) {
    throw httpError(400, "MINIMUM_ORDER_NOT_MET", "The order does not meet the store minimum");
  }
  const deliveryFeeCents = toCents(settings.deliveryFee);
  if (subtotalCents + deliveryFeeCents > 9_999_999_999) {
    throw httpError(400, "ORDER_TOTAL_TOO_LARGE", "The order total exceeds the supported limit");
  }

  const phone = input.phone.replace(/[ ()-]/g, "");
  const customer = await tx.customer.upsert({
    where: {phone},
    create: {name: input.customerName, phone},
    update: {name: input.customerName},
    select: {id: true},
  });

  for (const item of pricedItems) {
    const stockUpdate = await tx.product.updateMany({
      where: {
        id: item.product.id,
        isAvailable: true,
        stockQuantity: {gte: item.quantity},
        category: {isActive: true},
      },
      data: {stockQuantity: {decrement: item.quantity}},
    });
    if (stockUpdate.count !== 1) {
      throw httpError(409, "INSUFFICIENT_STOCK", `${item.product.name} stock changed; review your cart`);
    }
  }

  const order = await tx.order.create({
    data: {
      orderNumber: createOrderNumber(),
      checkoutKey,
      checkoutHash,
      customerId: customer.id,
      deliveryAddress: input.deliveryAddress,
      subtotal: fromCents(subtotalCents),
      deliveryFee: fromCents(deliveryFeeCents),
      total: fromCents(subtotalCents + deliveryFeeCents),
      orderStatus: "PENDING",
      paymentStatus: "PENDING",
      items: {
        create: pricedItems.map(item => ({
          productId: item.product.id,
          productName: item.product.name,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          subtotal: item.subtotal,
        })),
      },
    },
    select: {id: true, ...safeOrderSelection()},
  });
  for (const item of pricedItems) {
    await tx.stockMovement.create({
      data: {
        productId: item.product.id,
        orderId: order.id,
        quantityChange: -item.quantity,
        previousQuantity: item.product.stockQuantity,
        newQuantity: item.product.stockQuantity - item.quantity,
        reason: `Customer checkout ${order.orderNumber}`,
      },
    });
  }
  const {id: _id, ...safeOrder} = order;
  return {order: safeOrder, replayed: false};
}

export async function createCheckoutOrder(db, input, checkoutKey) {
  const checkoutHash = getRequestHash(input);
  const existing = await findIdempotentOrder(db, checkoutKey, checkoutHash);
  if (existing) return existing;

  try {
    return await db.$transaction(
      tx => placeCheckoutTransaction(tx, input, checkoutKey, checkoutHash),
      {isolationLevel: Prisma.TransactionIsolationLevel.Serializable},
    );
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const replay = await findIdempotentOrder(db, checkoutKey, checkoutHash);
      if (replay) return replay;
    }
    throw error;
  }
}

export async function getPublicOrderConfirmation(db, orderNumber) {
  const order = await db.order.findUnique({
    where: {orderNumber},
    select: safeOrderSelection(),
  });
  if (!order) throw httpError(404, "ORDER_NOT_FOUND", "Order confirmation was not found");
  return order;
}
