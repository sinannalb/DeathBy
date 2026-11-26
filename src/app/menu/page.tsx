import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { decimalToNumber, serializeOptionGroup } from "@/lib/serializers";
import {
  QrMenuClient,
  type QrMenuBranch,
  type QrMenuCategory,
} from "@/components/qr/QrMenuClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Dijital Menü | Death By Chocolate",
  description: "Death By Chocolate dijital QR menü",
};

export default async function QrMenuPage(props: {
  searchParams: Promise<{ sube?: string }>;
}) {
  const { sube } = await props.searchParams;
  const branchSlug = sube?.trim() || null;

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
        // Show all non-deleted products on QR menu regardless of online stock/active toggle
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

  const categories: QrMenuCategory[] = rawCategories
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

  const initialBranch: QrMenuBranch | null = branch ?? null;

  return (
    <QrMenuClient
      initialBranch={initialBranch}
      initialCategories={categories}
    />
  );
}
