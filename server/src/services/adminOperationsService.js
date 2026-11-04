import {Prisma} from "@prisma/client";

const completedPaidOrder = {orderStatus: "COMPLETED", paymentStatus: "PAID"};

function httpError(status, code, message) {
  return Object.assign(new Error(message), {status, code});
}

function makePage(items, total, page, pageSize) {
  return {items, page, pageSize, total, totalPages: Math.ceil(total / pageSize)};
}

export async function listInventory(db, query) {
  const where = {
    ...(query.search ? {OR: [
      {name: {contains: query.search, mode: "insensitive"}},
      {slug: {contains: query.search, mode: "insensitive"}},
    ]} : {}),
    ...(query.stock === "low" ? {stockQuantity: {gt: 0, lte: query.lowStockThreshold}} : {}),
    ...(query.stock === "out" ? {stockQuantity: 0} : {}),
  };
  const [items, total] = await Promise.all([
    db.product.findMany({
      where,
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      orderBy: [{stockQuantity: "asc"}, {name: "asc"}, {id: "asc"}],
      select: {
        id: true,
        name: true,
        slug: true,
        stockQuantity: true,
        isAvailable: true,
        category: {select: {id: true, name: true}},
      },
    }),
    db.product.count({where}),
  ]);
  return makePage(items, total, query.page, query.pageSize);
}

export async function adjustInventory(db, {productId, adminId, quantityChange, reason}) {
  return db.$transaction(async tx => {
    const product = await tx.product.findUnique({
      where: {id: productId},
      select: {id: true, name: true, stockQuantity: true},
    });
    if (!product) throw httpError(404, "NOT_FOUND", "Product was not found");

    const previousQuantity = product.stockQuantity;
    const newQuantity = previousQuantity + quantityChange;
    if (newQuantity < 0) {
      throw httpError(409, "INSUFFICIENT_STOCK", "Stock adjustment cannot result in negative inventory");
    }
    if (newQuantity > 2_147_483_647) {
      throw httpError(400, "STOCK_LIMIT_EXCEEDED", "Stock quantity exceeds the supported limit");
    }

    const updated = await tx.product.updateMany({
      where: {id: productId, stockQuantity: previousQuantity},
      data: {stockQuantity: newQuantity},
    });
    if (updated.count !== 1) {
      throw httpError(409, "STOCK_CHANGED", "Stock changed concurrently; reload and try again");
    }

    const movement = await tx.stockMovement.create({
      data: {
        productId,
        adminId,
        quantityChange,
        previousQuantity,
        newQuantity,
        reason,
      },
      include: {
        product: {select: {id: true, name: true}},
        admin: {select: {id: true, email: true}},
        order: {select: {id: true, orderNumber: true}},
      },
    });
    return movement;
  }, {isolationLevel: Prisma.TransactionIsolationLevel.Serializable});
}

export async function listStockMovements(db, query) {
  const where = query.productId ? {productId: query.productId} : {};
  const [items, total] = await Promise.all([
    db.stockMovement.findMany({
      where,
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      orderBy: [{createdAt: "desc"}, {id: "asc"}],
      include: {
        product: {select: {id: true, name: true}},
        admin: {select: {id: true, email: true}},
      },
    }),
    db.stockMovement.count({where}),
  ]);
  return makePage(items, total, query.page, query.pageSize);
}

function searchCustomer(search) {
  if (!search) return {};
  return {OR: [
    {name: {contains: search, mode: "insensitive"}},
    {phone: {contains: search}},
    {email: {contains: search, mode: "insensitive"}},
  ]};
}

export async function listAdminCustomers(db, query) {
  const where = searchCustomer(query.search);
  const [customers, total] = await Promise.all([
    db.customer.findMany({
      where,
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      orderBy: [{createdAt: "desc"}, {id: "asc"}],
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        createdAt: true,
        _count: {select: {orders: true}},
      },
    }),
    db.customer.count({where}),
  ]);

  const spendRows = customers.length
    ? await db.order.groupBy({
      by: ["customerId"],
      where: {customerId: {in: customers.map(customer => customer.id)}, ...completedPaidOrder},
      _sum: {total: true},
    })
    : [];
  const spendByCustomer = new Map(spendRows.map(row => [row.customerId, String(row._sum.total ?? "0")]));
  const items = customers.map(customer => ({
    ...customer,
    totalOrders: customer._count.orders,
    totalSpending: spendByCustomer.get(customer.id) ?? "0",
    _count: undefined,
  }));
  return makePage(items, total, query.page, query.pageSize);
}

export async function getAdminCustomer(db, id) {
  const customer = await db.customer.findUnique({
    where: {id},
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      createdAt: true,
      _count: {select: {orders: true}},
    },
  });
  if (!customer) throw httpError(404, "NOT_FOUND", "Customer was not found");

  const [orders, spend] = await Promise.all([
    db.order.findMany({
      where: {customerId: id},
      orderBy: [{createdAt: "desc"}, {id: "asc"}],
      select: {
        id: true,
        orderNumber: true,
        orderStatus: true,
        paymentStatus: true,
        subtotal: true,
        deliveryFee: true,
        total: true,
        createdAt: true,
        items: {select: {productName: true, quantity: true, unitPrice: true, subtotal: true}},
      },
    }),
    db.order.aggregate({
      where: {customerId: id, ...completedPaidOrder},
      _sum: {total: true},
    }),
  ]);

  return {
    id: customer.id,
    name: customer.name,
    phone: customer.phone,
    email: customer.email,
    createdAt: customer.createdAt,
    totalOrders: customer._count.orders,
    totalSpending: String(spend._sum.total ?? "0"),
    orders,
  };
}

function utcDayStart(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function utcMonthStart(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function fillPeriods(rows, start, count, period) {
  const values = new Map(rows.map(row => {
    const key = row.period instanceof Date
      ? period === "day" ? row.period.toISOString().slice(0, 10) : row.period.toISOString().slice(0, 7)
      : String(row.period).slice(0, period === "day" ? 10 : 7);
    return [key, {orders: Number(row.orders), revenue: String(row.revenue ?? "0")}];
  }));

  return Array.from({length: count}, (_, index) => {
    const date = new Date(start);
    if (period === "day") date.setUTCDate(date.getUTCDate() + index);
    else date.setUTCMonth(date.getUTCMonth() + index);
    const key = period === "day" ? date.toISOString().slice(0, 10) : date.toISOString().slice(0, 7);
    return {period: key, ...(values.get(key) ?? {orders: 0, revenue: "0"})};
  });
}

export async function getDashboardAnalytics(db, now = new Date()) {
  const dayStart = utcDayStart(now);
  const tomorrow = new Date(dayStart);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const dailyStart = new Date(dayStart);
  dailyStart.setUTCDate(dailyStart.getUTCDate() - 29);
  const monthStart = utcMonthStart(now);
  const nextMonth = new Date(monthStart);
  nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);
  const monthlyStart = new Date(monthStart);
  monthlyStart.setUTCMonth(monthlyStart.getUTCMonth() - 11);

  const [totalOrders, pendingOrders, allTimeRevenue, bestSelling, dailyRows, monthlyRows] = await Promise.all([
    db.order.count(),
    db.order.count({where: {orderStatus: "PENDING"}}),
    db.order.aggregate({where: completedPaidOrder, _sum: {total: true}}),
    db.orderItem.groupBy({
      by: ["productId"],
      where: {productId: {not: null}, order: {is: completedPaidOrder}},
      _sum: {quantity: true, subtotal: true},
      orderBy: {_sum: {quantity: "desc"}},
      take: 5,
    }),
    db.$queryRaw(Prisma.sql`
      SELECT date_trunc('day', "createdAt")::date AS period,
             COUNT(*)::int AS orders,
             COALESCE(SUM("total"), 0)::text AS revenue
      FROM "Order"
      WHERE "paymentStatus" = 'PAID'::"PaymentStatus"
        AND "orderStatus" = 'COMPLETED'::"OrderStatus"
        AND "createdAt" >= ${dailyStart}
        AND "createdAt" < ${tomorrow}
      GROUP BY period
      ORDER BY period
    `),
    db.$queryRaw(Prisma.sql`
      SELECT date_trunc('month', "createdAt")::date AS period,
             COUNT(*)::int AS orders,
             COALESCE(SUM("total"), 0)::text AS revenue
      FROM "Order"
      WHERE "paymentStatus" = 'PAID'::"PaymentStatus"
        AND "orderStatus" = 'COMPLETED'::"OrderStatus"
        AND "createdAt" >= ${monthlyStart}
        AND "createdAt" < ${nextMonth}
      GROUP BY period
      ORDER BY period
    `),
  ]);

  const productIds = bestSelling.map(row => row.productId).filter(Boolean);
  const products = productIds.length
    ? await db.product.findMany({
      where: {id: {in: productIds}},
      select: {id: true, name: true, imageUrl: true},
    })
    : [];
  const productsById = new Map(products.map(product => [product.id, product]));
  const bestSellingProducts = bestSelling
    .filter(row => productsById.has(row.productId))
    .map(row => ({
      ...productsById.get(row.productId),
      quantitySold: Number(row._sum.quantity ?? 0),
      revenue: String(row._sum.subtotal ?? "0"),
    }));

  const dailySales = fillPeriods(dailyRows, dailyStart, 30, "day");
  const monthlySales = fillPeriods(monthlyRows, monthlyStart, 12, "month");
  const today = dailySales.at(-1);
  const currentMonth = monthlySales.at(-1);

  return {
    totalOrders,
    pendingOrders,
    revenue: String(allTimeRevenue._sum.total ?? "0"),
    todayRevenue: today.revenue,
    todayOrders: today.orders,
    monthRevenue: currentMonth.revenue,
    monthOrders: currentMonth.orders,
    dailySales,
    monthlySales,
    bestSellingProducts,
  };
}
