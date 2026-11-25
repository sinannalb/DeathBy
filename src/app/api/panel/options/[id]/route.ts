import { NextResponse } from "next/server";
import { SelectionType } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { jsonError, parseJsonBody } from "@/lib/api-helpers";
import { requirePanelRole } from "@/lib/auth";
import { serializeOptionGroup } from "@/lib/serializers";

const optionItemPatchSchema = z.object({
  id: z.string().min(1).optional(),
  name: z.string().trim().min(1).max(100),
  priceDelta: z.number().min(0).optional().default(0),
  isDefault: z.boolean().optional().default(false),
  isAvailable: z.boolean().optional().default(true),
  sortOrder: z.number().int().optional().default(0),
});

const updateOptionGroupSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  selectionType: z.nativeEnum(SelectionType).optional(),
  isRequired: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
  items: z.array(optionItemPatchSchema).optional(),
  productIds: z.array(z.string().min(1)).optional(),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requirePanelRole(["ADMIN"]);
  if (auth.response) return auth.response;

  const { id } = await context.params;
  const parsed = await parseJsonBody(request, updateOptionGroupSchema);
  if (parsed.response) return parsed.response;

  const existing = await prisma.optionGroup.findUnique({
    where: { id },
    include: { items: true },
  });
  if (!existing) {
    return jsonError("Opsiyon grubu bulunamadı.", 404);
  }

  const data = parsed.data;
  const uniqueProductIds = data.productIds
    ? Array.from(new Set(data.productIds))
    : undefined;

  if (uniqueProductIds && uniqueProductIds.length > 0) {
    const productCount = await prisma.product.count({
      where: { id: { in: uniqueProductIds } },
    });
    if (productCount !== uniqueProductIds.length) {
      return jsonError("Seçilen ürünlerden biri bulunamadı.", 400);
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    if (data.items !== undefined) {
      const existingItemIds = new Set(existing.items.map((i) => i.id));
      const keptItemIds = new Set(
        data.items
          .map((i) => i.id)
          .filter((itemId): itemId is string =>
            Boolean(itemId && existingItemIds.has(itemId)),
          ),
      );

      // Delete removed items
      await tx.optionItem.deleteMany({
        where: {
          optionGroupId: id,
          id: { notIn: Array.from(keptItemIds) },
        },
      });

      for (let idx = 0; idx < data.items.length; idx++) {
        const item = data.items[idx];
        const sortOrder = item.sortOrder ?? idx;
        if (item.id && existingItemIds.has(item.id)) {
          await tx.optionItem.update({
            where: { id: item.id },
            data: {
              name: item.name,
              priceDelta: item.priceDelta,
              isDefault: item.isDefault,
              isAvailable: item.isAvailable,
              sortOrder,
            },
          });
        } else {
          await tx.optionItem.create({
            data: {
              optionGroupId: id,
              name: item.name,
              priceDelta: item.priceDelta,
              isDefault: item.isDefault,
              isAvailable: item.isAvailable,
              sortOrder,
            },
          });
        }
      }
    }

    if (uniqueProductIds !== undefined) {
      await tx.productOptionGroup.deleteMany({
        where: { optionGroupId: id },
      });
      if (uniqueProductIds.length > 0) {
        await tx.productOptionGroup.createMany({
          data: uniqueProductIds.map((productId) => ({
            productId,
            optionGroupId: id,
            sortOrder: data.sortOrder ?? existing.sortOrder,
          })),
        });
      }
    }

    return tx.optionGroup.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.selectionType !== undefined
          ? { selectionType: data.selectionType }
          : {}),
        ...(data.isRequired !== undefined
          ? { isRequired: data.isRequired }
          : {}),
        ...(data.sortOrder !== undefined ? { sortOrder: data.sortOrder } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      },
      include: {
        items: { orderBy: { sortOrder: "asc" } },
        products: { select: { productId: true } },
      },
    });
  });

  return NextResponse.json({
    optionGroup: {
      ...serializeOptionGroup(updated),
      productIds: updated.products.map((p) => p.productId),
    },
  });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requirePanelRole(["ADMIN"]);
  if (auth.response) return auth.response;

  const { id } = await context.params;
  const existing = await prisma.optionGroup.findUnique({ where: { id } });
  if (!existing) {
    return jsonError("Opsiyon grubu bulunamadı.", 404);
  }

  await prisma.optionGroup.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
