import { NextResponse } from "next/server";
import { RootGroup } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { jsonError, parseJsonBody, slugifyTr } from "@/lib/api-helpers";
import { requirePanelRole } from "@/lib/auth";

const updateCategorySchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  slug: z.string().trim().min(2).max(100).optional(),
  rootGroup: z.nativeEnum(RootGroup).optional(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requirePanelRole(["ADMIN"]);
  if (auth.response) return auth.response;

  const { id } = await context.params;
  const parsed = await parseJsonBody(request, updateCategorySchema);
  if (parsed.response) return parsed.response;

  const existing = await prisma.category.findUnique({ where: { id } });
  if (!existing) {
    return jsonError("Kategori bulunamadı.", 404);
  }

  let normalizedSlug: string | undefined;
  if (parsed.data.slug !== undefined) {
    normalizedSlug = slugifyTr(parsed.data.slug);
    if (!normalizedSlug) {
      return jsonError("Geçerli bir slug giriniz.", 400);
    }
    const duplicate = await prisma.category.findUnique({
      where: { slug: normalizedSlug },
    });
    if (duplicate && duplicate.id !== id) {
      return jsonError(
        "Bu slug başka bir kategori tarafından kullanılıyor.",
        409,
      );
    }
  }

  const category = await prisma.category.update({
    where: { id },
    data: {
      ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
      ...(normalizedSlug !== undefined ? { slug: normalizedSlug } : {}),
      ...(parsed.data.rootGroup !== undefined
        ? { rootGroup: parsed.data.rootGroup }
        : {}),
      ...(parsed.data.sortOrder !== undefined
        ? { sortOrder: parsed.data.sortOrder }
        : {}),
      ...(parsed.data.isActive !== undefined
        ? { isActive: parsed.data.isActive }
        : {}),
    },
  });

  return NextResponse.json({ category });
}
