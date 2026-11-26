import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { parseJsonBody } from "@/lib/api-helpers";
import { requireCustomerSession } from "@/lib/auth";

const createAddressSchema = z.object({
  title: z.string().trim().min(1, "Adres başlığı gereklidir.").max(60),
  city: z.string().trim().min(1, "Şehir gereklidir."),
  district: z.string().trim().min(1, "İlçe gereklidir."),
  neighborhood: z.string().trim().min(1, "Mahalle gereklidir."),
  fullAddress: z.string().trim().min(5, "Açık adres en az 5 karakter olmalıdır."),
  directions: z.string().trim().max(300).optional().nullable(),
});

export async function GET() {
  const auth = await requireCustomerSession();
  if (auth.response) return auth.response;

  let addresses = await prisma.customerAddress.findMany({
    where: { userId: auth.session.userId, isActive: true },
    orderBy: { createdAt: "desc" },
  });

  // If the customer has no active saved address yet but has past orders, backfill from their latest order
  if (addresses.length === 0) {
    const latestOrder = await prisma.order.findFirst({
      where: { userId: auth.session.userId },
      orderBy: { createdAt: "desc" },
      select: {
        city: true,
        district: true,
        neighborhood: true,
        fullAddress: true,
        directions: true,
      },
    });
    if (latestOrder) {
      const created = await prisma.customerAddress.create({
        data: {
          userId: auth.session.userId,
          title: "Sipariş Adresim",
          city: latestOrder.city,
          district: latestOrder.district,
          neighborhood: latestOrder.neighborhood,
          fullAddress: latestOrder.fullAddress,
          directions: latestOrder.directions,
          isActive: true,
        },
      });
      addresses = [created];
    }
  }

  const activeOrdersCount = await prisma.order.count({
    where: {
      userId: auth.session.userId,
      status: { notIn: ["COMPLETED", "CANCELLED"] },
      paymentStatus: { not: "FAILED" },
    },
  });

  return NextResponse.json({
    hasActiveOrder: activeOrdersCount > 0,
    addresses: addresses.map((a) => ({
      id: a.id,
      userId: a.userId,
      title: a.title,
      city: a.city,
      district: a.district,
      neighborhood: a.neighborhood,
      fullAddress: a.fullAddress,
      directions: a.directions,
      createdAt: a.createdAt.toISOString(),
    })),
  });
}

export async function POST(request: Request) {
  const auth = await requireCustomerSession();
  if (auth.response) return auth.response;

  const parsed = await parseJsonBody(request, createAddressSchema);
  if (parsed.response) return parsed.response;

  const created = await prisma.customerAddress.create({
    data: {
      userId: auth.session.userId,
      title: parsed.data.title,
      city: parsed.data.city,
      district: parsed.data.district,
      neighborhood: parsed.data.neighborhood,
      fullAddress: parsed.data.fullAddress,
      directions: parsed.data.directions || null,
    },
  });

  return NextResponse.json(
    {
      address: {
        id: created.id,
        userId: created.userId,
        title: created.title,
        city: created.city,
        district: created.district,
        neighborhood: created.neighborhood,
        fullAddress: created.fullAddress,
        directions: created.directions,
        createdAt: created.createdAt.toISOString(),
      },
    },
    { status: 201 },
  );
}
