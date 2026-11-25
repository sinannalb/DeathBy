import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-helpers";
import { getCustomerSession, getPanelSession } from "@/lib/auth";
import { serializeOrder } from "@/lib/serializers";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const [customerSession, panelSession] = await Promise.all([
    getCustomerSession(),
    getPanelSession(),
  ]);

  if (!customerSession && !panelSession) {
    return jsonError("Bu siparişi görüntülemek için oturum açmalısınız.", 401);
  }

  const order = await prisma.order.findUnique({
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

  if (!order) {
    return jsonError("Sipariş bulunamadı.", 404);
  }

  const customerAuthorized =
    customerSession !== null && order.userId === customerSession.userId;
  const panelAuthorized =
    panelSession !== null &&
    (panelSession.role === "ADMIN" ||
      (panelSession.role === "SYSTEM" &&
        panelSession.branchId === order.branchId));

  if (!customerAuthorized && !panelAuthorized) {
    return jsonError("Bu siparişi görüntüleme yetkiniz yok.", 403);
  }

  return NextResponse.json({
    order: serializeOrder(order),
  });
}
