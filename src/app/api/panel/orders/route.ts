import { NextResponse } from "next/server";
import { OrderStatus, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-helpers";
import { requirePanelRole } from "@/lib/auth";
import { serializeOrder } from "@/lib/serializers";

export async function GET(request: Request) {
  const auth = await requirePanelRole(["ADMIN", "SYSTEM"]);
  if (auth.response) return auth.response;

  const { searchParams } = new URL(request.url);
  const queryBranchId = searchParams.get("branchId")?.trim();
  const queryStatus = searchParams.get("status")?.trim();
  const includePending = searchParams.get("includePending") === "true";

  const where: Prisma.OrderWhereInput = {};

  if (auth.session.role === "SYSTEM") {
    if (!auth.session.branchId) {
      return jsonError("Kullanıcıya atanmış şube bulunamadı.", 403);
    }
    if (queryBranchId && queryBranchId !== auth.session.branchId) {
      return jsonError("Başka şubenin siparişlerine erişemezsiniz.", 403);
    }
    where.branchId = auth.session.branchId;
  } else if (queryBranchId) {
    where.branchId = queryBranchId;
  }

  if (queryStatus) {
    if (!Object.values(OrderStatus).includes(queryStatus as OrderStatus)) {
      return jsonError("Geçersiz sipariş durumu filtresi.", 400);
    }
    where.status = queryStatus as OrderStatus;
  }

  if (!includePending) {
    where.paymentStatus = "PAID";
  }

  const orders = await prisma.order.findMany({
    where,
    orderBy: { createdAt: "desc" },
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
    orders: orders.map(serializeOrder),
  });
}
