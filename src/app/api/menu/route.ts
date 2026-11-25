import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-helpers";
import {
  decimalToNumber,
  serializeBranchSummary,
  serializeOptionGroup,
} from "@/lib/serializers";
import type { MenuCategoryDTO } from "@/lib/types";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const branchId = searchParams.get("branchId")?.trim();

  if (!branchId) {
    return jsonError("branchId parametresi gereklidir.", 400);
  }

  const branch = await prisma.branch.findUnique({
    where: { id: branchId },
    include: { schedules: true },
  });

  if (!branch) {
    return jsonError("Şube bulunamadı.", 404);
  }

  const rawCategories = await prisma.category.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: {
      products: {
        where: { isActive: true },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        include: {
          branchAvailabilities: {
            where: { branchId },
          },
          optionGroups: {
            where: { optionGroup: { isActive: true } },
            orderBy: [{ sortOrder: "asc" }, { optionGroup: { sortOrder: "asc" } }],
            include: {
              optionGroup: {
                include: {
                  items: {
                    where: { isAvailable: true },
                    orderBy: { sortOrder: "asc" },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  const categories: MenuCategoryDTO[] = rawCategories.map((cat) => ({
    id: cat.id,
    name: cat.name,
    slug: cat.slug,
    rootGroup: cat.rootGroup,
    sortOrder: cat.sortOrder,
    isActive: cat.isActive,
    products: cat.products.map((prod) => {
      const avail = prod.branchAvailabilities[0];
      const branchAvailable = avail ? avail.isAvailable : true;

      return {
        id: prod.id,
        categoryId: prod.categoryId,
        name: prod.name,
        slug: prod.slug,
        description: prod.description,
        price: decimalToNumber(prod.price),
        imageUrl: prod.imageUrl,
        sortOrder: prod.sortOrder,
        isActive: prod.isActive,
        branchAvailable,
        optionGroups: prod.optionGroups
          .map((link) => serializeOptionGroup(link.optionGroup))
          .filter((og) => og.items.length > 0),
      };
    }),
  }));

  return NextResponse.json({
    branch: serializeBranchSummary(branch),
    categories,
  });
}
