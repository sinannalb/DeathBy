import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCustomerSession } from "@/lib/auth";
import { serializeOrder } from "@/lib/serializers";

export async function GET() {
  const auth = await requireCustomerSession();
  if (auth.response) return auth.response;

  const orders = await prisma.order.findMany({
    where: { userId: auth.session.userId },
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
