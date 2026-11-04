export async function listProducts(db, query) {
  const where = {
    isAvailable: true,
    category: {isActive: true},
    ...(query.category ? {category: {isActive: true, slug: query.category}} : {}),
    ...(query.featured ? {isFeatured: query.featured === "true"} : {}),
    ...(query.search ? {OR: [
      {name: {contains: query.search, mode: "insensitive"}},
      {description: {contains: query.search, mode: "insensitive"}},
    ]} : {}),
  };

  const rows = await db.product.findMany({
    where,
    take: query.limit,
    ...(query.cursor ? {skip: 1, cursor: {id: query.cursor}} : {}),
    orderBy: [{isFeatured: "desc"}, {name: "asc"}],
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      price: true,
      imageUrl: true,
      stockQuantity: true,
      isAvailable: true,
      isFeatured: true,
      category: {select: {id: true, name: true, slug: true}},
    },
  });

  return {
    items: rows,
    nextCursor: rows.length === query.limit ? rows.at(-1)?.id ?? null : null,
  };
}

export async function getProductBySlug(db, slug) {
  return db.product.findFirst({
    where: {slug, isAvailable: true, category: {isActive: true}},
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      price: true,
      imageUrl: true,
      stockQuantity: true,
      isAvailable: true,
      isFeatured: true,
      category: {select: {id: true, name: true, slug: true}},
    },
  });
}

export async function listCategories(db, query) {
  return db.category.findMany({
    where: {isActive: true},
    orderBy: {name: "asc"},
    ...(query.includeProducts === "true"
      ? {include: {products: {where: {isAvailable: true}, select: {id: true, name: true, slug: true}}}}
      : {}),
  });
}

export async function getStoreSettings(db) {
  return db.storeSettings.findFirst({
    orderBy: [{updatedAt: "desc"}, {id: "asc"}],
    select: {
      shopName: true,
      whatsappNumber: true,
      contactNumber: true,
      address: true,
      openingHours: true,
      deliveryInformation: true,
      deliveryFee: true,
      minimumOrderAmount: true,
      isOperating: true,
      updatedAt: true,
    },
  });
}
