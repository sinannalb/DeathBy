import { NextResponse } from "next/server";
import { RootGroup } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { jsonError, parseJsonBody, slugifyTr } from "@/lib/api-helpers";
import { requirePanelRole } from "@/lib/auth";

const createCategorySchema = z.object({
  name: z.string().trim().min(2, "Kategori adı en az 2 karakter olmalıdır.").max(80),
  slug: z.string().trim().min(2).max(100).optional(),
  rootGroup: z.nativeEnum(RootGroup),
  sortOrder: z.number().int().optional().default(0),
  isActive: z.boolean().optional().default(true),
});

async function generateUniqueCategorySlug(baseInput: string): Promise<string> {
  const base = slugifyTr(baseInput) || `kategori-${Date.now()}`;
  let candidate = base;
  let suffix = 2;

  while (await prisma.category.findUnique({ where: { slug: candidate } })) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }

  return candidate;
}

export async function POST(request: Request) {
  const auth = await requirePanelRole(["ADMIN"]);
  if (auth.response) return auth.response;

  const parsed = await parseJsonBody(request, createCategorySchema);
  if (parsed.response) return parsed.response;

  const slug = parsed.data.slug
    ? await generateUniqueCategorySlug(parsed.data.slug)
    : await generateUniqueCategorySlug(parsed.data.name);

  if (!slug) {
    return jsonError("Geçerli bir kategori slug oluşturulamadı.", 400);
  }

  const category = await prisma.category.create({
    data: {
      name: parsed.data.name,
      slug,
      rootGroup: parsed.data.rootGroup,
      sortOrder: parsed.data.sortOrder,
      isActive: parsed.data.isActive,
    },
  });

  return NextResponse.json({ category }, { status: 201 });
}
