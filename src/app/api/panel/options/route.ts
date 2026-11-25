import { NextResponse } from "next/server";
import { SelectionType } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { jsonError, parseJsonBody } from "@/lib/api-helpers";
import { requirePanelRole } from "@/lib/auth";
import { serializeOptionGroup } from "@/lib/serializers";

const optionItemInputSchema = z.object({
  name: z.string().trim().min(1, "Seçenek adı gereklidir.").max(100),
  priceDelta: z.number().min(0).default(0),
  isDefault: z.boolean().default(false),
  isAvailable: z.boolean().default(true),
  sortOrder: z.number().int().optional(),
});

const createOptionGroupSchema = z.object({
  name: z.string().trim().min(2, "Opsiyon grubu adı en az 2 karakter olmalıdır.").max(100),
  selectionType: z.nativeEnum(SelectionType).default("SINGLE"),
  isRequired: z.boolean().default(false),
  sortOrder: z.number().int().default(0),
  isActive: z.boolean().default(true),
  items: z.array(optionItemInputSchema).default([]),
  productIds: z.array(z.string().min(1)).default([]),
});

export async function GET() {
  const auth = await requirePanelRole(["ADMIN"]);
  if (auth.response) return auth.response;

  const optionGroups = await prisma.optionGroup.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: {
      items: { orderBy: { sortOrder: "asc" } },
      products: { select: { productId: true } },
    },
  });

  return NextResponse.json({
    optionGroups: optionGroups.map((og) => ({
      ...serializeOptionGroup(og),
      productIds: og.products.map((p) => p.productId),
    })),
  });
}

export async function POST(request: Request) {
  const auth = await requirePanelRole(["ADMIN"]);
  if (auth.response) return auth.response;

  const parsed = await parseJsonBody(request, createOptionGroupSchema);
  if (parsed.response) return parsed.response;

  const data = parsed.data;
  const uniqueProductIds = Array.from(new Set(data.productIds));
  if (uniqueProductIds.length > 0) {
    const productCount = await prisma.product.count({
      where: { id: { in: uniqueProductIds } },
    });
    if (productCount !== uniqueProductIds.length) {
      return jsonError("Seçilen ürünlerden biri bulunamadı.", 400);
    }
  }

  const created = await prisma.optionGroup.create({
    data: {
      name: data.name,
      selectionType: data.selectionType,
      isRequired: data.isRequired,
      sortOrder: data.sortOrder,
      isActive: data.isActive,
      items: {
        create: data.items.map((item, idx) => ({
          name: item.name,
          priceDelta: item.priceDelta,
          isDefault: item.isDefault,
          isAvailable: item.isAvailable,
          sortOrder: item.sortOrder ?? idx,
        })),
      },
      products: {
        create: uniqueProductIds.map((productId) => ({
          productId,
          sortOrder: data.sortOrder,
        })),
      },
    },
    include: {
      items: { orderBy: { sortOrder: "asc" } },
      products: { select: { productId: true } },
    },
  });

  return NextResponse.json(
    {
      optionGroup: {
        ...serializeOptionGroup(created),
        productIds: created.products.map((p) => p.productId),
      },
    },
    { status: 201 },
  );
}
