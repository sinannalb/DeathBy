import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { jsonError, parseJsonBody, slugifyTr } from "@/lib/api-helpers";
import { requirePanelRole } from "@/lib/auth";
import { decimalToNumber, serializeOptionGroup } from "@/lib/serializers";

const createProductSchema = z.object({
  categoryId: z.string().min(1, "Kategori seçiniz."),
  name: z.string().trim().min(2, "Ürün adı en az 2 karakter olmalıdır.").max(120),
  slug: z.string().trim().min(2).max(140).optional(),
  description: z.string().trim().max(1000).optional().default(""),
  price: z.number().min(0, "Fiyat 0'dan küçük olamaz."),
  imageUrl: z.string().trim().max(1000).optional().nullable(),
  sortOrder: z.number().int().optional().default(0),
  isActive: z.boolean().optional().default(true),
  optionGroupIds: z.array(z.string().min(1)).optional().default([]),
});

async function generateUniqueProductSlug(baseInput: string): Promise<string> {
  const base = slugifyTr(baseInput) || `urun-${Date.now()}`;
  let candidate = base;
  let suffix = 2;

  while (await prisma.product.findUnique({ where: { slug: candidate } })) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }

  return candidate;
}

export async function GET() {
  const auth = await requirePanelRole(["ADMIN", "SYSTEM"]);
  if (auth.response) return auth.response;

  if (auth.session.role === "SYSTEM" && !auth.session.branchId) {
    return jsonError("Kullanıcıya atanmış şube bulunamadı.", 403);
  }

  const [categories, products, optionGroups, branches] = await Promise.all([
    prisma.category.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    prisma.product.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: {
        category: { select: { id: true, name: true, rootGroup: true } },
        branchAvailabilities:
          auth.session.role === "SYSTEM"
            ? { where: { branchId: auth.session.branchId! } }
            : true,
        optionGroups: {
          orderBy: { sortOrder: "asc" },
          select: { optionGroupId: true, sortOrder: true },
        },
      },
    }),
    prisma.optionGroup.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: {
        items: { orderBy: { sortOrder: "asc" } },
        products: { select: { productId: true } },
      },
    }),
    prisma.branch.findMany({
      where:
        auth.session.role === "SYSTEM"
          ? { id: auth.session.branchId! }
          : undefined,
      orderBy: { name: "asc" },
      select: { id: true, name: true, slug: true, isActive: true },
    }),
  ]);

  return NextResponse.json({
    categories,
    branches,
    optionGroups: optionGroups.map((og) => ({
      ...serializeOptionGroup(og),
      productIds: og.products.map((p) => p.productId),
    })),
    products: products.map((p) => ({
      id: p.id,
      categoryId: p.categoryId,
      categoryName: p.category.name,
      rootGroup: p.category.rootGroup,
      name: p.name,
      slug: p.slug,
      description: p.description,
      price: decimalToNumber(p.price),
      imageUrl: p.imageUrl,
      sortOrder: p.sortOrder,
      isActive: p.isActive,
      optionGroupIds: p.optionGroups.map((link) => link.optionGroupId),
      branchAvailabilities: p.branchAvailabilities.map((ba) => ({
        branchId: ba.branchId,
        isAvailable: ba.isAvailable,
      })),
    })),
  });
}

export async function POST(request: Request) {
  const auth = await requirePanelRole(["ADMIN"]);
  if (auth.response) return auth.response;

  const parsed = await parseJsonBody(request, createProductSchema);
  if (parsed.response) return parsed.response;

  const data = parsed.data;
  const category = await prisma.category.findUnique({
    where: { id: data.categoryId },
  });
  if (!category) {
    return jsonError("Seçilen kategori bulunamadı.", 404);
  }

  const slug = data.slug
    ? await generateUniqueProductSlug(data.slug)
    : await generateUniqueProductSlug(data.name);

  const uniqueOptionGroupIds = Array.from(new Set(data.optionGroupIds));
  if (uniqueOptionGroupIds.length > 0) {
    const foundGroups = await prisma.optionGroup.count({
      where: { id: { in: uniqueOptionGroupIds } },
    });
    if (foundGroups !== uniqueOptionGroupIds.length) {
      return jsonError("Seçilen opsiyon gruplarından biri bulunamadı.", 400);
    }
  }

  const created = await prisma.$transaction(async (tx) => {
    const branches = await tx.branch.findMany({ select: { id: true } });

    return tx.product.create({
      data: {
        categoryId: data.categoryId,
        name: data.name,
        slug,
        description: data.description,
        price: data.price,
        imageUrl: data.imageUrl || null,
        sortOrder: data.sortOrder,
        isActive: data.isActive,
        branchAvailabilities: {
          create: branches.map((b) => ({
            branchId: b.id,
            isAvailable: true,
          })),
        },
        optionGroups: {
          create: uniqueOptionGroupIds.map((optionGroupId, idx) => ({
            optionGroupId,
            sortOrder: idx,
          })),
        },
      },
      include: {
        category: { select: { id: true, name: true, rootGroup: true } },
        branchAvailabilities: true,
        optionGroups: {
          orderBy: { sortOrder: "asc" },
          select: { optionGroupId: true },
        },
      },
    });
  });

  return NextResponse.json(
    {
      product: {
        id: created.id,
        categoryId: created.categoryId,
        categoryName: created.category.name,
        rootGroup: created.category.rootGroup,
        name: created.name,
        slug: created.slug,
        description: created.description,
        price: decimalToNumber(created.price),
        imageUrl: created.imageUrl,
        sortOrder: created.sortOrder,
        isActive: created.isActive,
        optionGroupIds: created.optionGroups.map((o) => o.optionGroupId),
        branchAvailabilities: created.branchAvailabilities.map((ba) => ({
          branchId: ba.branchId,
          isAvailable: ba.isAvailable,
        })),
      },
    },
    { status: 201 },
  );
}
