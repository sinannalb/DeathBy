import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { decimalToNumber, serializeOptionGroup } from "@/lib/serializers";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const branchSlug = searchParams.get("sube")?.trim() || null;

  const [branch, rawCategories] = await Promise.all([
    branchSlug
      ? prisma.branch.findFirst({
          where: { slug: branchSlug, isActive: true },
          select: { id: true, name: true, slug: true, address: true, phone: true },
        })
      : Promise.resolve(null),
    prisma.category.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: {
        // QR menu shows all non-deleted products regardless of online stock/active status
        products: {
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
          include: {
            optionGroups: {
              where: { optionGroup: { isActive: true } },
              orderBy: [
                { sortOrder: "asc" },
                { optionGroup: { sortOrder: "asc" } },
              ],
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
    }),
  ]);

  const categories = rawCategories
    .filter((cat) => cat.products.length > 0)
    .map((cat) => ({
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
      rootGroup: cat.rootGroup,
      sortOrder: cat.sortOrder,
      products: cat.products.map((prod) => ({
        id: prod.id,
        categoryId: prod.categoryId,
        name: prod.name,
        slug: prod.slug,
        description: prod.description,
        price: decimalToNumber(prod.price),
        imageUrl: prod.imageUrl,
        sortOrder: prod.sortOrder,
        optionGroups: prod.optionGroups
          .map((link) => serializeOptionGroup(link.optionGroup))
          .filter((og) => og.items.length > 0),
      })),
    }));

  return NextResponse.json({
    branch,
    categories,
  });
}
