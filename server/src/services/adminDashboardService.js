const orderTransitions = {
  PENDING: new Set(["CONFIRMED", "CANCELLED"]),
  CONFIRMED: new Set(["PREPARING", "CANCELLED"]),
  PREPARING: new Set(["READY", "CANCELLED"]),
  READY: new Set(["COMPLETED", "CANCELLED"]),
  COMPLETED: new Set(),
  CANCELLED: new Set(),
};

const paymentTransitions = {
  PENDING: new Set(["PAID", "FAILED"]),
  PAID: new Set(["REFUNDED"]),
  FAILED: new Set(),
  REFUNDED: new Set(),
};

function httpError(status, code, message) {
  return Object.assign(new Error(message), {status, code});
}

function slugify(value) {
  return value.normalize("NFKC").toLowerCase().trim()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120);
}

function getSlug(value) {
  const slug = slugify(value);
  if (!slug) throw httpError(400, "INVALID_NAME", "Name must include at least one letter or number");
  return slug;
}

function makePageResult(items, total, page, pageSize) {
  return {items, page, pageSize, total, totalPages: Math.ceil(total / pageSize)};
}

export async function listAdminProducts(db, query) {
  const where = {
    ...(query.search ? {OR: [
      {name: {contains: query.search, mode: "insensitive"}},
      {slug: {contains: query.search, mode: "insensitive"}},
    ]} : {}),
    ...(query.categoryId ? {categoryId: query.categoryId} : {}),
    ...(query.availability === "available" ? {isAvailable: true} : {}),
    ...(query.availability === "unavailable" ? {isAvailable: false} : {}),
  };
  const [items, total] = await Promise.all([
    db.product.findMany({
      where,
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      orderBy: [{createdAt: "desc"}, {id: "asc"}],
      include: {category: {select: {id: true, name: true, isActive: true}}},
    }),
    db.product.count({where}),
  ]);
  return makePageResult(items, total, query.page, query.pageSize);
}

export async function createAdminProduct(db, input) {
  const category = await db.category.findUnique({where: {id: input.categoryId}, select: {id: true, isActive: true}});
  if (!category || !category.isActive) {
    throw httpError(400, "INVALID_CATEGORY", "Select an active category");
  }
  const {name, ...data} = input;
  return db.product.create({data: {...data, name, slug: getSlug(name)}});
}

export async function updateAdminProduct(db, id, input) {
  const existing = await db.product.findUnique({where: {id}, select: {categoryId: true, stockQuantity: true}});
  if (!existing) throw httpError(404, "NOT_FOUND", "Product was not found");
  if (existing.stockQuantity !== input.stockQuantity) {
    throw httpError(400, "USE_INVENTORY_ADJUSTMENT", "Use the Inventory page to change stock so the adjustment is audited");
  }
  const category = await db.category.findUnique({where: {id: input.categoryId}, select: {id: true, isActive: true}});
  if (!category || (!category.isActive && existing.categoryId !== category.id)) {
    throw httpError(400, "INVALID_CATEGORY", "Select an active category");
  }
  const {name, description, price, imageUrl, isFeatured, isAvailable, categoryId} = input;
  return db.product.update({
    where: {id},
    data: {
      name,
      slug: getSlug(name),
      description,
      price,
      imageUrl,
      isFeatured,
      isAvailable,
      categoryId,
    },
  });
}

export async function deactivateAdminProduct(db, id) {
  return db.product.update({where: {id}, data: {isAvailable: false}});
}

export async function listAdminCategories(db, includeInactive) {
  return db.category.findMany({
    where: includeInactive ? undefined : {isActive: true},
    orderBy: [{name: "asc"}, {id: "asc"}],
    include: {_count: {select: {products: true}}},
  });
}

export async function createAdminCategory(db, input) {
  const {name, ...data} = input;
  return db.category.create({data: {...data, name, slug: getSlug(name)}});
}

export async function updateAdminCategory(db, id, input) {
  const {name, ...data} = input;
  return db.category.update({where: {id}, data: {...data, name, slug: getSlug(name)}});
}

export async function deactivateAdminCategory(db, id) {
  return db.category.update({where: {id}, data: {isActive: false}});
}

export async function activateAdminCategory(db, id) {
  return db.category.update({where: {id}, data: {isActive: true}});
}

export async function deleteAdminCategory(db, id) {
  const category = await db.category.findUnique({
    where: {id},
    select: {_count: {select: {products: true}}},
  });
  if (!category) throw httpError(404, "NOT_FOUND", "Category was not found");
  if (category._count.products > 0) {
    throw httpError(409, "CATEGORY_IN_USE", "Category has products; deactivate it instead");
  }
  return db.category.delete({where: {id}});
}

export async function listAdminOrders(db, query) {
  const where = {
    ...(query.orderStatus ? {orderStatus: query.orderStatus} : {}),
    ...(query.paymentStatus ? {paymentStatus: query.paymentStatus} : {}),
    ...(query.search ? {OR: [
      {orderNumber: {contains: query.search, mode: "insensitive"}},
      {customer: {name: {contains: query.search, mode: "insensitive"}}},
      {customer: {phone: {contains: query.search}}},
    ]} : {}),
    ...(query.from || query.to ? {createdAt: {
      ...(query.from ? {gte: new Date(`${query.from}T00:00:00.000Z`)} : {}),
      ...(query.to ? {lte: new Date(`${query.to}T23:59:59.999Z`)} : {}),
    }} : {}),
  };
  const [items, total] = await Promise.all([
    db.order.findMany({
      where,
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      orderBy: [{createdAt: "desc"}, {id: "asc"}],
      include: {
        customer: {select: {id: true, name: true, phone: true, email: true}},
        _count: {select: {items: true}},
      },
    }),
    db.order.count({where}),
  ]);
  return makePageResult(items, total, query.page, query.pageSize);
}

export async function getAdminOrder(db, id) {
  const order = await db.order.findUnique({
    where: {id},
    include: {
      customer: {select: {id: true, name: true, phone: true, email: true}},
      items: {
        orderBy: {id: "asc"},
        select: {id: true, productId: true, productName: true, quantity: true, unitPrice: true, subtotal: true},
      },
    },
  });
  if (!order) throw httpError(404, "NOT_FOUND", "Order was not found");
  return order;
}

export async function updateAdminOrderStatus(db, id, nextStatus, adminId) {
  if (nextStatus === "CANCELLED") {
    return db.$transaction(async tx => {
      const current = await tx.order.findUnique({where: {id}, select: {orderStatus: true, orderNumber: true}});
      if (!current) throw httpError(404, "NOT_FOUND", "Order was not found");
      if (!orderTransitions[current.orderStatus].has(nextStatus)) {
        throw httpError(409, "INVALID_ORDER_TRANSITION", `Cannot change order status from ${current.orderStatus} to ${nextStatus}`);
      }
      const result = await tx.order.updateMany({
        where: {id, orderStatus: current.orderStatus},
        data: {orderStatus: nextStatus},
      });
      if (result.count !== 1) {
        throw httpError(409, "ORDER_CHANGED", "Order status changed concurrently; reload and try again");
      }

      const salesMovements = await tx.stockMovement.findMany({
        where: {orderId: id, quantityChange: {lt: 0}},
        select: {productId: true, quantityChange: true},
      });
      for (const movement of salesMovements) {
        const quantity = -movement.quantityChange;
        const product = await tx.product.findUnique({
          where: {id: movement.productId},
          select: {stockQuantity: true},
        });
        if (!product) throw httpError(409, "PRODUCT_UNAVAILABLE", "A product in this order can no longer be restocked");
        const updated = await tx.product.updateMany({
          where: {id: movement.productId, stockQuantity: product.stockQuantity},
          data: {stockQuantity: {increment: quantity}},
        });
        if (updated.count !== 1) {
          throw httpError(409, "STOCK_CHANGED", "Stock changed concurrently; retry the cancellation");
        }
        await tx.stockMovement.create({
          data: {
            productId: movement.productId,
            orderId: id,
            adminId,
            quantityChange: quantity,
            previousQuantity: product.stockQuantity,
            newQuantity: product.stockQuantity + quantity,
            reason: `Cancellation of ${current.orderNumber}`,
          },
        });
      }
      return tx.order.findUnique({where: {id}});
    }, {isolationLevel: "Serializable"});
  }

  const current = await db.order.findUnique({where: {id}, select: {orderStatus: true}});
  if (!current) throw httpError(404, "NOT_FOUND", "Order was not found");
  if (!orderTransitions[current.orderStatus].has(nextStatus)) {
    throw httpError(409, "INVALID_ORDER_TRANSITION", `Cannot change order status from ${current.orderStatus} to ${nextStatus}`);
  }
  const result = await db.order.updateMany({
    where: {id, orderStatus: current.orderStatus},
    data: {orderStatus: nextStatus},
  });
  if (result.count !== 1) {
    throw httpError(409, "ORDER_CHANGED", "Order status changed concurrently; reload and try again");
  }
  return db.order.findUnique({where: {id}});
}

export async function updateAdminPaymentStatus(db, id, nextStatus) {
  const current = await db.order.findUnique({where: {id}, select: {paymentStatus: true}});
  if (!current) throw httpError(404, "NOT_FOUND", "Order was not found");
  if (!paymentTransitions[current.paymentStatus].has(nextStatus)) {
    throw httpError(409, "INVALID_PAYMENT_TRANSITION", `Cannot change payment status from ${current.paymentStatus} to ${nextStatus}`);
  }
  const result = await db.order.updateMany({
    where: {id, paymentStatus: current.paymentStatus},
    data: {paymentStatus: nextStatus},
  });
  if (result.count !== 1) {
    throw httpError(409, "ORDER_CHANGED", "Payment status changed concurrently; reload and try again");
  }
  return db.order.findUnique({where: {id}});
}

export async function getAdminStoreSettings(db) {
  return db.storeSettings.findFirst({orderBy: [{updatedAt: "desc"}, {id: "asc"}]});
}

export async function updateAdminStoreSettings(db, input) {
  const data = {
    shopName: input.shopName,
    contactNumber: input.phone || null,
    address: input.address || null,
    deliveryFee: input.deliveryFee,
    minimumOrderAmount: input.minimumOrderAmount,
    isOperating: input.isOperating,
  };
  const existing = await db.storeSettings.findFirst({orderBy: [{updatedAt: "desc"}, {id: "asc"}], select: {id: true}});
  return existing
    ? db.storeSettings.update({where: {id: existing.id}, data})
    : db.storeSettings.create({data});
}
