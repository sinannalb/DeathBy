import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-helpers";
import { requirePanelRole } from "@/lib/auth";
import { serializeOrder } from "@/lib/serializers";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requirePanelRole(["ADMIN", "SYSTEM"]);
  if (auth.response) return auth.response;

  const { id } = await context.params;
  const existing = await prisma.order.findUnique({
    where: { id },
    include: {
      branch: {
        select: {
          id: true,
          name: true,
          phone: true,
          address: true,
          paperWidth: true,
        },
      },
      items: true,
    },
  });

  if (!existing) {
    return jsonError("Sipariş bulunamadı.", 404);
  }

  if (
    auth.session.role === "SYSTEM" &&
    existing.branchId !== auth.session.branchId
  ) {
    return jsonError("Başka şubeye ait siparişi yazdıramazsınız.", 403);
  }

  const nextStatus =
    existing.status === "RECEIVED" ? "PREPARING" : existing.status;

  const updated = await prisma.order.update({
    where: { id: existing.id },
    data: {
      printedAt: existing.printedAt ?? new Date(),
      status: nextStatus,
    },
    include: {
      branch: {
        select: {
          id: true,
          name: true,
          phone: true,
          address: true,
          paperWidth: true,
        },
      },
      items: true,
    },
  });

  return NextResponse.json({
    order: serializeOrder(updated),
    paperWidth: updated.branch.paperWidth,
  });
}
