import fs from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";
import { PrismaClient, type RootGroup, type SelectionType } from "@prisma/client";

const prisma = new PrismaClient();

interface RawMenuProduct {
  name: string;
  slug?: string;
  description?: string;
  price?: number | string;
  priceTry?: number | string;
  imageUrl?: string | null;
  image?: string | null;
  sortOrder?: number;
  isActive?: boolean;
}

interface RawMenuCategory {
  name: string;
  slug?: string;
  rootGroup?: string;
  sortOrder?: number;
  isActive?: boolean;
  products?: RawMenuProduct[];
}

interface NormalizedMenuCategory {
  name: string;
  slug: string;
  rootGroup: RootGroup;
  sortOrder: number;
  isActive: boolean;
  products: Array<{
    name: string;
    slug: string;
    description: string;
    price: number;
    imageUrl: string | null;
    sortOrder: number;
    isActive: boolean;
  }>;
}

function slugifyTr(input: string): string {
  const map: Record<string, string> = {
    ç: "c",
    Ç: "c",
    ğ: "g",
    Ğ: "g",
    ı: "i",
    İ: "i",
    ö: "o",
    Ö: "o",
    ş: "s",
    Ş: "s",
    ü: "u",
    Ü: "u",
  };
  return input
    .split("")
    .map((ch) => map[ch] ?? ch)
    .join("")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function trLower(value: string): string {
  return value.toLocaleLowerCase("tr-TR");
}

function parsePrice(value: number | string): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Number(value.toFixed(2));
  }
  const cleaned = String(value)
    .replace(/[^\d.,]/g, "")
    .replace(/\.(?=\d{3}(?:[,.]|$))/g, "")
    .replace(",", ".");
  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) ? Number(parsed.toFixed(2)) : 0;
}

function inferRootGroup(rawRootGroup: string | undefined, categoryName: string): RootGroup {
  if (rawRootGroup) {
    const upper = rawRootGroup.trim().toUpperCase();
    if (upper === "DRINK" || upper === "ICECEK" || upper === "İÇECEK") {
      return "DRINK";
    }
    if (upper === "FOOD" || upper === "YIYECEK" || upper === "YİYECEK") {
      return "FOOD";
    }
  }

  const lower = trLower(categoryName);
  const drinkHints = [
    "kahve",
    "çay",
    "içecek",
    "icecek",
    "soğuk",
    "sıcak",
    "milkshake",
    "smoothie",
    "limonata",
    "frozen",
    "salep",
    "espresso",
    "meşrubat",
    "su",
  ];
  if (drinkHints.some((hint) => lower.includes(hint))) {
    return "DRINK";
  }
  return "FOOD";
}

function normalizeMenuJson(rawJson: unknown): NormalizedMenuCategory[] {
  let rawCategories: RawMenuCategory[] = [];
  let flatProducts: Array<RawMenuProduct & { category?: string; categorySlug?: string; categoryName?: string }> = [];

  if (Array.isArray(rawJson)) {
    rawCategories = rawJson as RawMenuCategory[];
  } else if (rawJson && typeof rawJson === "object") {
    const obj = rawJson as Record<string, unknown>;
    if (Array.isArray(obj.categories)) {
      rawCategories = obj.categories as RawMenuCategory[];
    } else if (Array.isArray(obj.menu)) {
      rawCategories = obj.menu as RawMenuCategory[];
    }
    if (Array.isArray(obj.products)) {
      flatProducts = obj.products as typeof flatProducts;
    }
  }

  if (flatProducts.length > 0 && rawCategories.every((c) => !c.products?.length)) {
    const byKey = new Map<string, RawMenuCategory>();
    for (const cat of rawCategories) {
      const catClone: RawMenuCategory = { ...cat, products: [] };
      byKey.set(slugifyTr(cat.slug || cat.name), catClone);
      byKey.set(trLower(cat.name), catClone);
    }
    for (const prod of flatProducts) {
      const key = prod.categorySlug
        ? slugifyTr(prod.categorySlug)
        : trLower(prod.categoryName || prod.category || "");
      const target = byKey.get(key);
      if (target) {
        target.products = target.products ?? [];
        target.products.push(prod);
      }
    }
    rawCategories = Array.from(new Set(byKey.values()));
  }

  const usedCategorySlugs = new Set<string>();
  const usedProductSlugs = new Set<string>();

  const uniqueSlug = (base: string, registry: Set<string>): string => {
    const cleanBase = base || "item";
    let candidate = cleanBase;
    let idx = 2;
    while (registry.has(candidate)) {
      candidate = `${cleanBase}-${idx}`;
      idx += 1;
    }
    registry.add(candidate);
    return candidate;
  };

  return rawCategories.map((cat, catIdx) => {
    const catSlug = uniqueSlug(
      slugifyTr(cat.slug || cat.name),
      usedCategorySlugs,
    );
    const rootGroup = inferRootGroup(cat.rootGroup, cat.name);
    const products = (cat.products ?? []).map((prod, prodIdx) => ({
      name: prod.name.trim(),
      slug: uniqueSlug(slugifyTr(prod.slug || prod.name), usedProductSlugs),
      description: (prod.description ?? "").trim(),
      price: parsePrice(prod.price ?? prod.priceTry ?? 0),
      imageUrl: prod.imageUrl ?? prod.image ?? null,
      sortOrder: prod.sortOrder ?? prodIdx,
      isActive: prod.isActive ?? true,
    }));

    return {
      name: cat.name.trim(),
      slug: catSlug,
      rootGroup,
      sortOrder: cat.sortOrder ?? catIdx,
      isActive: cat.isActive ?? true,
      products,
    };
  });
}

async function upsertOptionGroupWithItems(params: {
  name: string;
  selectionType: SelectionType;
  isRequired: boolean;
  sortOrder: number;
  items: Array<{
    name: string;
    priceDelta: number;
    isDefault?: boolean;
    sortOrder: number;
  }>;
}) {
  let group = await prisma.optionGroup.findFirst({
    where: { name: params.name },
    include: { items: true },
  });

  if (!group) {
    group = await prisma.optionGroup.create({
      data: {
        name: params.name,
        selectionType: params.selectionType,
        isRequired: params.isRequired,
        sortOrder: params.sortOrder,
        isActive: true,
        items: {
          create: params.items.map((item) => ({
            name: item.name,
            priceDelta: item.priceDelta,
            isDefault: item.isDefault ?? false,
            isAvailable: true,
            sortOrder: item.sortOrder,
          })),
        },
      },
      include: { items: true },
    });
  } else {
    group = await prisma.optionGroup.update({
      where: { id: group.id },
      data: {
        selectionType: params.selectionType,
        isRequired: params.isRequired,
        sortOrder: params.sortOrder,
        isActive: true,
      },
      include: { items: true },
    });

    for (const item of params.items) {
      const existingItem = group.items.find((i) => i.name === item.name);
      if (existingItem) {
        await prisma.optionItem.update({
          where: { id: existingItem.id },
          data: {
            priceDelta: item.priceDelta,
            isDefault: item.isDefault ?? false,
            sortOrder: item.sortOrder,
          },
        });
      } else {
        await prisma.optionItem.create({
          data: {
            optionGroupId: group.id,
            name: item.name,
            priceDelta: item.priceDelta,
            isDefault: item.isDefault ?? false,
            isAvailable: true,
            sortOrder: item.sortOrder,
          },
        });
      }
    }
  }

  return group;
}

async function main() {
  const menuPath = path.resolve(process.cwd(), "prisma/data/menu.json");
  if (!fs.existsSync(menuPath)) {
    console.error(
      `[seed] Hata: "${menuPath}" bulunamadı.\n` +
        `Lütfen menü verisini prisma/data/menu.json konumuna yerleştirip tekrar "npm run db:seed" çalıştırınız.`,
    );
    process.exit(1);
  }

  const rawMenu = JSON.parse(fs.readFileSync(menuPath, "utf8")) as unknown;
  const categories = normalizeMenuJson(rawMenu);
  if (categories.length === 0) {
    console.error("[seed] Hata: prisma/data/menu.json içinde kategori bulunamadı.");
    process.exit(1);
  }

  console.log("[seed] Eski Kadıköy şube/kullanıcı varsa temizleniyor...");
  await prisma.user.deleteMany({
    where: { email: "kadikoy@deathbychocolate.com" },
  });
  const oldKadikoy = await prisma.branch.findUnique({
    where: { slug: "kadikoy" },
    include: { _count: { select: { orders: true } } },
  });
  if (oldKadikoy && oldKadikoy._count.orders === 0) {
    await prisma.branch.delete({ where: { id: oldKadikoy.id } });
  } else if (oldKadikoy) {
    await prisma.branch.update({
      where: { id: oldKadikoy.id },
      data: { isActive: false, courierEnabled: false },
    });
  }

  console.log("[seed] Şubeler ve mahalleler oluşturuluyor...");

  const besiktas = await prisma.branch.upsert({
    where: { slug: "besiktas" },
    update: {
      name: "Beşiktaş Şubesi",
      address: "Vişnezade Mah. Şair Nedim Cad. No: 18/A, Beşiktaş / İstanbul",
      phone: "0531 899 98 76",
      paperWidth: "MM80",
      courierEnabled: true,
      isActive: true,
    },
    create: {
      name: "Beşiktaş Şubesi",
      slug: "besiktas",
      address: "Vişnezade Mah. Şair Nedim Cad. No: 18/A, Beşiktaş / İstanbul",
      phone: "0531 899 98 76",
      paperWidth: "MM80",
      courierEnabled: true,
      manualStatus: "AUTO",
      estimatedMinMinutes: 30,
      estimatedMaxMinutes: 45,
      isActive: true,
    },
  });

  const kagithane = await prisma.branch.upsert({
    where: { slug: "kagithane" },
    update: {
      name: "Kağıthane Şubesi",
      address: "Merkez Mah. Kağıthane / İstanbul",
      phone: "0531 010 84 86",
      paperWidth: "MM58",
      courierEnabled: false,
      isActive: true,
    },
    create: {
      name: "Kağıthane Şubesi",
      slug: "kagithane",
      address: "Merkez Mah. Kağıthane / İstanbul",
      phone: "0531 010 84 86",
      paperWidth: "MM58",
      courierEnabled: false,
      manualStatus: "AUTO",
      estimatedMinMinutes: 25,
      estimatedMaxMinutes: 40,
      isActive: true,
    },
  });

  const rumeliHisari = await prisma.branch.upsert({
    where: { slug: "rumeli-hisari" },
    update: {
      name: "Rumelihisarı Şubesi",
      address: "Rumeli Hisarı Mah. Sarıyer / İstanbul",
      phone: "0539 848 15 15",
      paperWidth: "MM58",
      courierEnabled: false,
      isActive: true,
    },
    create: {
      name: "Rumelihisarı Şubesi",
      slug: "rumeli-hisari",
      address: "Rumeli Hisarı Mah. Sarıyer / İstanbul",
      phone: "0539 848 15 15",
      paperWidth: "MM58",
      courierEnabled: false,
      manualStatus: "AUTO",
      estimatedMinMinutes: 25,
      estimatedMaxMinutes: 40,
      isActive: true,
    },
  });

  const branches = [besiktas, kagithane, rumeliHisari];

  // 7-day schedules (09:00 - 23:59) for all branches
  for (const branch of branches) {
    for (let dayOfWeek = 0; dayOfWeek <= 6; dayOfWeek++) {
      await prisma.branchSchedule.upsert({
        where: {
          branchId_dayOfWeek: {
            branchId: branch.id,
            dayOfWeek,
          },
        },
        update: {
          openTime: "09:00",
          closeTime: "23:59",
          isClosed: false,
        },
        create: {
          branchId: branch.id,
          dayOfWeek,
          openTime: "09:00",
          closeTime: "23:59",
          isClosed: false,
        },
      });
    }
  }

  const besiktasNeighborhoods = [
    { city: "İstanbul", district: "Beşiktaş", neighborhood: "Vişnezade", minOrderAmount: 250, deliveryFee: 29.9 },
    { city: "İstanbul", district: "Beşiktaş", neighborhood: "Sinanpaşa", minOrderAmount: 250, deliveryFee: 29.9 },
    { city: "İstanbul", district: "Beşiktaş", neighborhood: "Türkali", minOrderAmount: 250, deliveryFee: 29.9 },
    { city: "İstanbul", district: "Beşiktaş", neighborhood: "Abbasağa", minOrderAmount: 250, deliveryFee: 29.9 },
    { city: "İstanbul", district: "Beşiktaş", neighborhood: "Cihannüma", minOrderAmount: 250, deliveryFee: 29.9 },
    { city: "İstanbul", district: "Beşiktaş", neighborhood: "Dikilitaş", minOrderAmount: 300, deliveryFee: 39.9 },
    { city: "İstanbul", district: "Beşiktaş", neighborhood: "Yıldız", minOrderAmount: 300, deliveryFee: 39.9 },
    { city: "İstanbul", district: "Beşiktaş", neighborhood: "Ortaköy", minOrderAmount: 350, deliveryFee: 49.9 },
    { city: "İstanbul", district: "Beşiktaş", neighborhood: "Gayrettepe", minOrderAmount: 350, deliveryFee: 49.9 },
    { city: "İstanbul", district: "Beyoğlu", neighborhood: "Tophane", minOrderAmount: 350, deliveryFee: 49.9 },
    { city: "İstanbul", district: "Beyoğlu", neighborhood: "Cihangir", minOrderAmount: 350, deliveryFee: 49.9 },
    { city: "İstanbul", district: "Beyoğlu", neighborhood: "Firuzağa", minOrderAmount: 350, deliveryFee: 49.9 },
    { city: "İstanbul", district: "Beyoğlu", neighborhood: "Gümüşsuyu", minOrderAmount: 300, deliveryFee: 39.9 },
    { city: "İstanbul", district: "Beyoğlu", neighborhood: "Ömer Avni (Kabataş)", minOrderAmount: 300, deliveryFee: 39.9 },
    { city: "İstanbul", district: "Şişli", neighborhood: "Fulya", minOrderAmount: 350, deliveryFee: 49.9 },
    { city: "İstanbul", district: "Şişli", neighborhood: "Maçka", minOrderAmount: 300, deliveryFee: 39.9 },
    { city: "İstanbul", district: "Şişli", neighborhood: "Teşvikiye", minOrderAmount: 300, deliveryFee: 39.9 },
    { city: "İstanbul", district: "Şişli", neighborhood: "Harbiye", minOrderAmount: 300, deliveryFee: 39.9 },
  ];

  for (const item of besiktasNeighborhoods) {
    await prisma.deliveryNeighborhood.upsert({
      where: {
        city_district_neighborhood: {
          city: item.city,
          district: item.district,
          neighborhood: item.neighborhood,
        },
      },
      update: {
        branchId: besiktas.id,
        minOrderAmount: item.minOrderAmount,
        deliveryFee: item.deliveryFee,
        isActive: true,
      },
      create: {
        branchId: besiktas.id,
        city: item.city,
        district: item.district,
        neighborhood: item.neighborhood,
        minOrderAmount: item.minOrderAmount,
        deliveryFee: item.deliveryFee,
        isActive: true,
      },
    });
  }

  const takeawayNeighborhoods = [
    { branchId: kagithane.id, city: "İstanbul", district: "Kağıthane", neighborhood: "Merkez", minOrderAmount: 250, deliveryFee: 0 },
    { branchId: kagithane.id, city: "İstanbul", district: "Kağıthane", neighborhood: "Çağlayan", minOrderAmount: 250, deliveryFee: 0 },
    { branchId: kagithane.id, city: "İstanbul", district: "Kağıthane", neighborhood: "Hamidiye", minOrderAmount: 250, deliveryFee: 0 },
    { branchId: kagithane.id, city: "İstanbul", district: "Kağıthane", neighborhood: "Seyrantepe", minOrderAmount: 300, deliveryFee: 0 },
    { branchId: rumeliHisari.id, city: "İstanbul", district: "Sarıyer", neighborhood: "Rumeli Hisarı", minOrderAmount: 250, deliveryFee: 0 },
    { branchId: rumeliHisari.id, city: "İstanbul", district: "Sarıyer", neighborhood: "Baltalimanı", minOrderAmount: 250, deliveryFee: 0 },
  ];

  for (const item of takeawayNeighborhoods) {
    await prisma.deliveryNeighborhood.upsert({
      where: {
        city_district_neighborhood: {
          city: item.city,
          district: item.district,
          neighborhood: item.neighborhood,
        },
      },
      update: {
        branchId: item.branchId,
        minOrderAmount: item.minOrderAmount,
        deliveryFee: item.deliveryFee,
        isActive: true,
      },
      create: {
        branchId: item.branchId,
        city: item.city,
        district: item.district,
        neighborhood: item.neighborhood,
        minOrderAmount: item.minOrderAmount,
        deliveryFee: item.deliveryFee,
        isActive: true,
      },
    });
  }

  console.log("[seed] Kategoriler ve ürünler yükleniyor...");

  const allSeededProducts: Array<{
    id: string;
    name: string;
    price: number;
    rootGroup: RootGroup;
  }> = [];

  for (const cat of categories) {
    const dbCat = await prisma.category.upsert({
      where: { slug: cat.slug },
      update: {
        name: cat.name,
        rootGroup: cat.rootGroup,
        sortOrder: cat.sortOrder,
        isActive: cat.isActive,
      },
      create: {
        name: cat.name,
        slug: cat.slug,
        rootGroup: cat.rootGroup,
        sortOrder: cat.sortOrder,
        isActive: cat.isActive,
      },
    });

    for (const prod of cat.products) {
      const dbProd = await prisma.product.upsert({
        where: { slug: prod.slug },
        update: {
          categoryId: dbCat.id,
          name: prod.name,
          description: prod.description,
          price: prod.price,
          imageUrl: prod.imageUrl,
          sortOrder: prod.sortOrder,
          isActive: prod.isActive,
        },
        create: {
          categoryId: dbCat.id,
          name: prod.name,
          slug: prod.slug,
          description: prod.description,
          price: prod.price,
          imageUrl: prod.imageUrl,
          sortOrder: prod.sortOrder,
          isActive: prod.isActive,
        },
      });

      allSeededProducts.push({
        id: dbProd.id,
        name: dbProd.name,
        price: prod.price,
        rootGroup: dbCat.rootGroup,
      });

      for (const branch of branches) {
        await prisma.branchProductAvailability.upsert({
          where: {
            branchId_productId: {
              branchId: branch.id,
              productId: dbProd.id,
            },
          },
          update: {},
          create: {
            branchId: branch.id,
            productId: dbProd.id,
            isAvailable: true,
          },
        });
      }
    }
  }

  // Ensure a Salep product exists so Salep option rules (Süt Seçimi + Tarçın Seçimi) are always testable
  const hasSalep = allSeededProducts.some((p) =>
    trLower(p.name).includes("salep"),
  );
  if (!hasSalep) {
    const targetCat =
      (await prisma.category.findFirst({
        where: {
          rootGroup: "DRINK",
          OR: [
            { name: { contains: "Sıcak", mode: "insensitive" } },
            { name: { contains: "Kahve", mode: "insensitive" } },
            { name: { contains: "Çay", mode: "insensitive" } },
          ],
        },
        orderBy: { sortOrder: "asc" },
      })) ??
      (await prisma.category.findFirst({
        where: { rootGroup: "DRINK" },
        orderBy: { sortOrder: "asc" },
      })) ??
      (await prisma.category.upsert({
        where: { slug: "sicak-icecekler" },
        update: {},
        create: {
          name: "Sıcak İçecekler",
          slug: "sicak-icecekler",
          rootGroup: "DRINK",
          sortOrder: 99,
          isActive: true,
        },
      }));

    const salepProd = await prisma.product.upsert({
      where: { slug: "salep" },
      update: {},
      create: {
        categoryId: targetCat.id,
        name: "Salep",
        slug: "salep",
        description: "Geleneksel kış lezzeti, sıcak sütlü salep.",
        price: 155,
        imageUrl: null,
        sortOrder: 99,
        isActive: true,
      },
    });

    allSeededProducts.push({
      id: salepProd.id,
      name: salepProd.name,
      price: 155,
      rootGroup: "DRINK",
    });

    for (const branch of branches) {
      await prisma.branchProductAvailability.upsert({
        where: {
          branchId_productId: {
            branchId: branch.id,
            productId: salepProd.id,
          },
        },
        update: {},
        create: {
          branchId: branch.id,
          productId: salepProd.id,
          isAvailable: true,
        },
      });
    }
  }

  console.log("[seed] Opsiyon grupları oluşturuluyor ve ürünlere bağlanıyor...");

  // Remove old ice cream group name if present from initial seed
  await prisma.optionGroup.deleteMany({
    where: { name: "Dondurma İster misiniz?" },
  });

  const iceCreamGroup = await upsertOptionGroupWithItems({
    name: "Dondurma Seçimi",
    selectionType: "SINGLE",
    isRequired: true,
    sortOrder: 1,
    items: [
      { name: "Dondurma İstemiyorum", priceDelta: 0, isDefault: true, sortOrder: 1 },
      { name: "Dondurma İstiyorum", priceDelta: 65, isDefault: false, sortOrder: 2 },
    ],
  });

  const milkGroup = await upsertOptionGroupWithItems({
    name: "Süt Seçimi",
    selectionType: "SINGLE",
    isRequired: true,
    sortOrder: 2,
    items: [
      { name: "Normal Süt", priceDelta: 0, isDefault: true, sortOrder: 1 },
      { name: "Laktozsuz Süt", priceDelta: 20, isDefault: false, sortOrder: 2 },
    ],
  });

  const cinnamonGroup = await upsertOptionGroupWithItems({
    name: "Tarçın Seçimi",
    selectionType: "SINGLE",
    isRequired: false,
    sortOrder: 3,
    items: [
      { name: "Tarçınlı", priceDelta: 0, isDefault: true, sortOrder: 1 },
      { name: "Tarçınsız", priceDelta: 0, isDefault: false, sortOrder: 2 },
    ],
  });

  const milkKeywords = [
    "latte",
    "cappuccino",
    "mocha",
    "macchiato",
    "salep",
    "sıcak çikolata",
    "flat white",
    "frappe",
    "chai",
    "süt",
  ];

  for (const prod of allSeededProducts) {
    const lowerName = trLower(prod.name);

    if (lowerName.includes("death by") || lowerName.includes("brownie")) {
      await prisma.productOptionGroup.upsert({
        where: {
          productId_optionGroupId: {
            productId: prod.id,
            optionGroupId: iceCreamGroup.id,
          },
        },
        update: { sortOrder: 1 },
        create: {
          productId: prod.id,
          optionGroupId: iceCreamGroup.id,
          sortOrder: 1,
        },
      });
    }

    if (
      prod.rootGroup === "DRINK" &&
      milkKeywords.some((kw) => lowerName.includes(kw))
    ) {
      await prisma.productOptionGroup.upsert({
        where: {
          productId_optionGroupId: {
            productId: prod.id,
            optionGroupId: milkGroup.id,
          },
        },
        update: { sortOrder: 2 },
        create: {
          productId: prod.id,
          optionGroupId: milkGroup.id,
          sortOrder: 2,
        },
      });
    }

    if (lowerName.includes("salep")) {
      await prisma.productOptionGroup.upsert({
        where: {
          productId_optionGroupId: {
            productId: prod.id,
            optionGroupId: cinnamonGroup.id,
          },
        },
        update: { sortOrder: 3 },
        create: {
          productId: prod.id,
          optionGroupId: cinnamonGroup.id,
          sortOrder: 3,
        },
      });
    }
  }

  console.log("[seed] Demo kullanıcılar oluşturuluyor...");

  const adminHash = await bcrypt.hash("Admin123!", 10);
  const branchHash = await bcrypt.hash("Sube123!", 10);

  await prisma.user.upsert({
    where: { email: "admin@deathbychocolate.com" },
    update: {
      role: "ADMIN",
      name: "Genel Yönetici",
      passwordHash: adminHash,
      branchId: null,
    },
    create: {
      role: "ADMIN",
      name: "Genel Yönetici",
      email: "admin@deathbychocolate.com",
      passwordHash: adminHash,
      branchId: null,
    },
  });

  await prisma.user.upsert({
    where: { email: "besiktas@deathbychocolate.com" },
    update: {
      role: "SYSTEM",
      name: "Beşiktaş Şube Yetkilisi",
      passwordHash: branchHash,
      branchId: besiktas.id,
    },
    create: {
      role: "SYSTEM",
      name: "Beşiktaş Şube Yetkilisi",
      email: "besiktas@deathbychocolate.com",
      passwordHash: branchHash,
      branchId: besiktas.id,
    },
  });

  await prisma.user.upsert({
    where: { email: "kagithane@deathbychocolate.com" },
    update: {
      role: "SYSTEM",
      name: "Kağıthane Şube Yetkilisi",
      passwordHash: branchHash,
      branchId: kagithane.id,
    },
    create: {
      role: "SYSTEM",
      name: "Kağıthane Şube Yetkilisi",
      email: "kagithane@deathbychocolate.com",
      passwordHash: branchHash,
      branchId: kagithane.id,
    },
  });

  await prisma.user.upsert({
    where: { email: "rumelihisari@deathbychocolate.com" },
    update: {
      role: "SYSTEM",
      name: "Rumelihisarı Şube Yetkilisi",
      passwordHash: branchHash,
      branchId: rumeliHisari.id,
    },
    create: {
      role: "SYSTEM",
      name: "Rumelihisarı Şube Yetkilisi",
      email: "rumelihisari@deathbychocolate.com",
      passwordHash: branchHash,
      branchId: rumeliHisari.id,
    },
  });

  const demoCustomer = await prisma.user.upsert({
    where: { phone: "05321234567" },
    update: {
      role: "CUSTOMER",
      name: "Test Müşteri",
    },
    create: {
      role: "CUSTOMER",
      name: "Test Müşteri",
      phone: "05321234567",
    },
  });

  const addressCount = await prisma.customerAddress.count({
    where: { userId: demoCustomer.id },
  });
  if (addressCount === 0) {
    await prisma.customerAddress.create({
      data: {
        userId: demoCustomer.id,
        title: "Ev",
        city: "İstanbul",
        district: "Beşiktaş",
        neighborhood: "Vişnezade",
        fullAddress: "Şair Nedim Cad. Çeşme Sok. No: 12 Daire: 4",
        directions: "Siyah demir kapılı apartman, zil no 4.",
      },
    });
  }

  const existingSeedReportOrders = await prisma.order.count({
    where: { merchantOid: { startsWith: "SEED-RPT-" } },
  });

  if (existingSeedReportOrders === 0 && allSeededProducts.length > 0) {
    console.log("[seed] Raporlar için 90 günlük örnek satış verileri oluşturuluyor...");
    const preferredProducts = allSeededProducts.filter((p) => {
      const l = trLower(p.name);
      return (
        l.includes("death by") ||
        l.includes("browni") ||
        l.includes("san sebastian") ||
        l.includes("magnolia") ||
        l.includes("latte") ||
        l.includes("americano") ||
        l.includes("salep") ||
        l.includes("cream puff")
      );
    });
    const productPool =
      preferredProducts.length >= 6 ? preferredProducts : allSeededProducts;

    const branchConfigs = [
      {
        branch: besiktas,
        district: "Beşiktaş",
        neighborhood: "Vişnezade",
        fee: 29.9,
        weight: 0.56,
      },
      {
        branch: kagithane,
        district: "Kağıthane",
        neighborhood: "Merkez",
        fee: 0,
        weight: 0.24,
      },
      {
        branch: rumeliHisari,
        district: "Sarıyer",
        neighborhood: "Rumeli Hisarı",
        fee: 0,
        weight: 0.2,
      },
    ];

    const nowMs = Date.now();
    const totalSeedOrders = 120;

    for (let i = 0; i < totalSeedOrders; i++) {
      const dayOffset = Math.floor((i * 89) / totalSeedOrders);
      const hourOffset = 10 + (i * 3) % 13;
      const createdAt = new Date(
        nowMs - dayOffset * 24 * 60 * 60 * 1000 - (23 - hourOffset) * 60 * 60 * 1000,
      );

      const roll = ((i * 37) % 100) / 100;
      const bCfg =
        roll < branchConfigs[0].weight
          ? branchConfigs[0]
          : roll < branchConfigs[0].weight + branchConfigs[1].weight
            ? branchConfigs[1]
            : branchConfigs[2];

      const itemCount = (i % 3) + 1;
      const itemsToCreate: Array<{
        productId: string;
        productName: string;
        unitPrice: number;
        quantity: number;
        selectedOptionsJson: [];
        lineTotal: number;
      }> = [];

      let subtotal = 0;
      for (let j = 0; j < itemCount; j++) {
        const prod = productPool[(i * 5 + j * 3) % productPool.length];
        const qty = j === 0 && i % 4 === 0 ? 2 : 1;
        const unitPrice = Number(prod.price) || 250;
        const lineTotal = Number((unitPrice * qty).toFixed(2));
        subtotal += lineTotal;
        itemsToCreate.push({
          productId: prod.id,
          productName: prod.name,
          unitPrice,
          quantity: qty,
          selectedOptionsJson: [],
          lineTotal,
        });
      }

      const roundedSubtotal = Number(subtotal.toFixed(2));
      const totalAmount = Number((roundedSubtotal + bCfg.fee).toFixed(2));
      const seq = String(i + 1).padStart(3, "0");

      await prisma.order.create({
        data: {
          orderNumber: `DBC-R${seq}`,
          userId: demoCustomer.id,
          branchId: bCfg.branch.id,
          status: "COMPLETED",
          paymentStatus: "PAID",
          paymentProvider: "PAYTR",
          merchantOid: `SEED-RPT-${seq}`,
          subtotal: roundedSubtotal,
          deliveryFee: bCfg.fee,
          totalAmount,
          customerName: demoCustomer.name,
          customerPhone: demoCustomer.phone ?? "05321234567",
          city: "İstanbul",
          district: bCfg.district,
          neighborhood: bCfg.neighborhood,
          fullAddress: "Demo Sipariş Adresi No: 1",
          createdAt,
          updatedAt: createdAt,
          items: {
            create: itemsToCreate,
          },
        },
      });
    }
  }

  console.log(
    `[seed] Tamamlandı! ${categories.length} kategori, ${allSeededProducts.length} ürün, ${branches.length} şube ve demo hesaplar hazır.`,
  );
}

main()
  .catch((err) => {
    console.error("[seed] Beklenmeyen hata:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
