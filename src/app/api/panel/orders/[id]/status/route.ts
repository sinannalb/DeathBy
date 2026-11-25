import { NextResponse } from "next/server";
import { OrderStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { jsonError, parseJsonBody } from "@/lib/api-helpers";
import { requirePanelRole } from "@/lib/auth";
import { ALLOWED_STATUS_TRANSITIONS } from "@/lib/constants";
import { serializeOrder } from "@/lib/serializers";

const updateStatusSchema = z.object({
  status: z.nativeEnum(OrderStatus),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requirePanelRole(["ADMIN", "SYSTEM"]);
  if (auth.response) return auth.response;

  const { id } = await context.params;
  const parsed = await parseJsonBody(request, updateStatusSchema);
  if (parsed.response) return parsed.response;

  const nextStatus = parsed.data.status;

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
    return jsonError("Başka şubenin siparişini güncelleyemezsiniz.", 403);
  }

  if (nextStatus === "CANCELLED" && auth.session.role !== "ADMIN") {
    return jsonError(
      "Sipariş iptal yetkisi yalnızca Yönetici (Admin) rolüne aittir.",
      403,
    );
  }

  if (existing.status === nextStatus) {
    return NextResponse.json({ order: serializeOrder(existing) });
  }

  const allowedNext = ALLOWED_STATUS_TRANSITIONS[existing.status];
  if (!allowedNext.includes(nextStatus)) {
    return jsonError(
      `"${existing.status}" durumundan "${nextStatus}" durumuna geçiş yapılamaz.`,
      400,
    );
  }

  const updated = await prisma.order.update({
    where: { id: existing.id },
    data: { status: nextStatus },
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
  });
}
