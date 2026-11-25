import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { jsonError, parseJsonBody, slugifyTr } from "@/lib/api-helpers";
import { requirePanelRole } from "@/lib/auth";
import { decimalToNumber } from "@/lib/serializers";

const updateProductSchema = z.object({
  categoryId: z.string().min(1).optional(),
  name: z.string().trim().min(2).max(120).optional(),
  slug: z.string().trim().min(2).max(140).optional(),
  description: z.string().trim().max(1000).optional(),
  price: z.number().min(0).optional(),
  imageUrl: z.string().trim().max(1000).nullable().optional(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
  optionGroupIds: z.array(z.string().min(1)).optional(),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requirePanelRole(["ADMIN"]);
  if (auth.response) return auth.response;

  const { id } = await context.params;
  const parsed = await parseJsonBody(request, updateProductSchema);
  if (parsed.response) return parsed.response;

  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing) {
    return jsonError("Ürün bulunamadı.", 404);
  }

  const data = parsed.data;
  if (data.categoryId) {
    const category = await prisma.category.findUnique({
      where: { id: data.categoryId },
    });
    if (!category) {
      return jsonError("Seçilen kategori bulunamadı.", 404);
    }
  }

  let normalizedSlug: string | undefined;
  if (data.slug !== undefined) {
    normalizedSlug = slugifyTr(data.slug);
    if (!normalizedSlug) {
      return jsonError("Geçerli bir slug giriniz.", 400);
    }
    const slugOwner = await prisma.product.findUnique({
      where: { slug: normalizedSlug },
    });
    if (slugOwner && slugOwner.id !== id) {
      return jsonError("Bu slug başka bir ürün tarafından kullanılıyor.", 409);
    }
  }

  const uniqueOptionGroupIds = data.optionGroupIds
    ? Array.from(new Set(data.optionGroupIds))
    : undefined;

  if (uniqueOptionGroupIds && uniqueOptionGroupIds.length > 0) {
    const foundGroups = await prisma.optionGroup.count({
      where: { id: { in: uniqueOptionGroupIds } },
    });
    if (foundGroups !== uniqueOptionGroupIds.length) {
      return jsonError("Seçilen opsiyon gruplarından biri bulunamadı.", 400);
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    if (uniqueOptionGroupIds !== undefined) {
      await tx.productOptionGroup.deleteMany({
        where: { productId: id },
      });
      if (uniqueOptionGroupIds.length > 0) {
        await tx.productOptionGroup.createMany({
          data: uniqueOptionGroupIds.map((optionGroupId, idx) => ({
            productId: id,
            optionGroupId,
            sortOrder: idx,
          })),
        });
      }
    }

    return tx.product.update({
      where: { id },
      data: {
        ...(data.categoryId !== undefined ? { categoryId: data.categoryId } : {}),
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(normalizedSlug !== undefined ? { slug: normalizedSlug } : {}),
        ...(data.description !== undefined
          ? { description: data.description }
          : {}),
        ...(data.price !== undefined ? { price: data.price } : {}),
        ...(data.imageUrl !== undefined
          ? { imageUrl: data.imageUrl || null }
          : {}),
        ...(data.sortOrder !== undefined ? { sortOrder: data.sortOrder } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
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

  return NextResponse.json({
    product: {
      id: updated.id,
      categoryId: updated.categoryId,
      categoryName: updated.category.name,
      rootGroup: updated.category.rootGroup,
      name: updated.name,
      slug: updated.slug,
      description: updated.description,
      price: decimalToNumber(updated.price),
      imageUrl: updated.imageUrl,
      sortOrder: updated.sortOrder,
      isActive: updated.isActive,
      optionGroupIds: updated.optionGroups.map((o) => o.optionGroupId),
      branchAvailabilities: updated.branchAvailabilities.map((ba) => ({
        branchId: ba.branchId,
        isAvailable: ba.isAvailable,
      })),
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
  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing) {
    return jsonError("Ürün bulunamadı.", 404);
  }

  await prisma.product.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
