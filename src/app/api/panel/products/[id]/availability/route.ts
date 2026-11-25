import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { jsonError, parseJsonBody } from "@/lib/api-helpers";
import { requirePanelRole } from "@/lib/auth";

const availabilitySchema = z.object({
  branchId: z.string().min(1).optional(),
  isAvailable: z.boolean(),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requirePanelRole(["ADMIN", "SYSTEM"]);
  if (auth.response) return auth.response;

  const { id: productId } = await context.params;
  const parsed = await parseJsonBody(request, availabilitySchema);
  if (parsed.response) return parsed.response;

  let targetBranchId: string;
  if (auth.session.role === "SYSTEM") {
    if (!auth.session.branchId) {
      return jsonError("Kullanıcıya atanmış şube bulunamadı.", 403);
    }
    if (
      parsed.data.branchId &&
      parsed.data.branchId !== auth.session.branchId
    ) {
      return jsonError(
        "Yalnızca kendi şubenizin ürün stok durumunu değiştirebilirsiniz.",
        403,
      );
    }
    targetBranchId = auth.session.branchId;
  } else {
    if (!parsed.data.branchId) {
      return jsonError("Admin rolü için branchId parametresi gereklidir.", 400);
    }
    targetBranchId = parsed.data.branchId;
  }

  const [product, branch] = await Promise.all([
    prisma.product.findUnique({ where: { id: productId } }),
    prisma.branch.findUnique({ where: { id: targetBranchId } }),
  ]);

  if (!product) {
    return jsonError("Ürün bulunamadı.", 404);
  }
  if (!branch) {
    return jsonError("Şube bulunamadı.", 404);
  }

  const availability = await prisma.branchProductAvailability.upsert({
    where: {
      branchId_productId: {
        branchId: targetBranchId,
        productId,
      },
    },
    update: {
      isAvailable: parsed.data.isAvailable,
    },
    create: {
      branchId: targetBranchId,
      productId,
      isAvailable: parsed.data.isAvailable,
    },
  });

  return NextResponse.json({
    availability: {
      branchId: availability.branchId,
      productId: availability.productId,
      isAvailable: availability.isAvailable,
    },
  });
}
