import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { jsonError, parseJsonBody } from "@/lib/api-helpers";
import { requirePanelRole } from "@/lib/auth";
import { serializeNeighborhood } from "@/lib/serializers";

const createNeighborhoodSchema = z.object({
  city: z.string().trim().min(1, "Şehir gereklidir."),
  district: z.string().trim().min(1, "İlçe gereklidir."),
  neighborhood: z.string().trim().min(1, "Mahalle gereklidir."),
  minOrderAmount: z.number().min(0, "Minimum tutar 0'dan küçük olamaz."),
  deliveryFee: z.number().min(0, "Teslimat ücreti 0'dan küçük olamaz."),
  isActive: z.boolean().optional().default(true),
});

const patchNeighborhoodSchema = z.object({
  neighborhoodId: z.string().min(1),
  minOrderAmount: z.number().min(0).optional(),
  deliveryFee: z.number().min(0).optional(),
  isActive: z.boolean().optional(),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requirePanelRole(["ADMIN"]);
  if (auth.response) return auth.response;

  const { id: branchId } = await context.params;
  const parsed = await parseJsonBody(request, createNeighborhoodSchema);
  if (parsed.response) return parsed.response;

  const branch = await prisma.branch.findUnique({ where: { id: branchId } });
  if (!branch) {
    return jsonError("Şube bulunamadı.", 404);
  }

  const duplicate = await prisma.deliveryNeighborhood.findFirst({
    where: {
      city: { equals: parsed.data.city, mode: "insensitive" },
      district: { equals: parsed.data.district, mode: "insensitive" },
      neighborhood: { equals: parsed.data.neighborhood, mode: "insensitive" },
    },
    include: { branch: { select: { name: true } } },
  });

  if (duplicate) {
    return jsonError(
      `Bu mahalle zaten "${duplicate.branch.name}" şubesine tanımlı.`,
      409,
    );
  }

  const created = await prisma.deliveryNeighborhood.create({
    data: {
      branchId,
      city: parsed.data.city,
      district: parsed.data.district,
      neighborhood: parsed.data.neighborhood,
      minOrderAmount: parsed.data.minOrderAmount,
      deliveryFee: parsed.data.deliveryFee,
      isActive: parsed.data.isActive,
    },
  });

  return NextResponse.json(
    { neighborhood: serializeNeighborhood(created) },
    { status: 201 },
  );
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requirePanelRole(["ADMIN"]);
  if (auth.response) return auth.response;

  const { id: branchId } = await context.params;
  const parsed = await parseJsonBody(request, patchNeighborhoodSchema);
  if (parsed.response) return parsed.response;

  const existing = await prisma.deliveryNeighborhood.findUnique({
    where: { id: parsed.data.neighborhoodId },
  });

  if (!existing || existing.branchId !== branchId) {
    return jsonError("Mahalle bu şubede bulunamadı.", 404);
  }

  const updated = await prisma.deliveryNeighborhood.update({
    where: { id: existing.id },
    data: {
      ...(parsed.data.minOrderAmount !== undefined
        ? { minOrderAmount: parsed.data.minOrderAmount }
        : {}),
      ...(parsed.data.deliveryFee !== undefined
        ? { deliveryFee: parsed.data.deliveryFee }
        : {}),
      ...(parsed.data.isActive !== undefined
        ? { isActive: parsed.data.isActive }
        : {}),
    },
  });

  return NextResponse.json({
    neighborhood: serializeNeighborhood(updated),
  });
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requirePanelRole(["ADMIN"]);
  if (auth.response) return auth.response;

  const { id: branchId } = await context.params;
  const { searchParams } = new URL(request.url);
  let neighborhoodId = searchParams.get("neighborhoodId")?.trim();

  if (!neighborhoodId) {
    const body = (await request.json().catch(() => null)) as {
      neighborhoodId?: string;
    } | null;
    neighborhoodId = body?.neighborhoodId?.trim();
  }

  if (!neighborhoodId) {
    return jsonError("neighborhoodId gereklidir.", 400);
  }

  const existing = await prisma.deliveryNeighborhood.findUnique({
    where: { id: neighborhoodId },
  });

  if (!existing || existing.branchId !== branchId) {
    return jsonError("Mahalle bu şubede bulunamadı.", 404);
  }

  await prisma.deliveryNeighborhood.delete({
    where: { id: existing.id },
  });

  return NextResponse.json({ ok: true });
}
