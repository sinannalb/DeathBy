import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { jsonError, parseJsonBody } from "@/lib/api-helpers";
import { requireCustomerSession } from "@/lib/auth";
import { getPaytrMode, TEST_3DS_OTP } from "@/lib/paytr";
import { serializeOrder } from "@/lib/serializers";

const mockCompleteSchema = z.object({
  orderId: z.string().min(1, "Sipariş ID gereklidir."),
  cardNumber: z.string().trim().min(15, "Kart numarası geçersiz."),
  expiry: z.string().trim().min(4, "Son kullanma tarihi geçersiz."),
  cvv: z.string().trim().min(3, "CVV geçersiz.").max(4),
  otp: z.string().trim().min(1, "3D Secure doğrulama kodu gereklidir."),
  simulateFail: z.boolean().optional().default(false),
});

export async function POST(request: Request) {
  if (getPaytrMode() !== "mock") {
    return jsonError(
      "Mock ödeme uç noktası yalnızca PAYTR_MODE=mock modunda çalışır.",
      403,
    );
  }

  const auth = await requireCustomerSession();
  if (auth.response) return auth.response;

  const parsed = await parseJsonBody(request, mockCompleteSchema);
  if (parsed.response) return parsed.response;

  const { orderId, cardNumber, otp, simulateFail } = parsed.data;
  const digitsOnly = cardNumber.replace(/\D/g, "");
  if (digitsOnly.length < 15 || digitsOnly.length > 19) {
    return jsonError("Geçerli bir kart numarası giriniz.", 400);
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
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

  if (order.userId !== auth.session.userId) {
    return jsonError("Bu sipariş üzerinde işlem yetkiniz yok.", 403);
  }

  if (order.paymentStatus === "PAID") {
    return NextResponse.json({
      ok: true,
      order: serializeOrder(order),
    });
  }

  if (simulateFail || otp !== TEST_3DS_OTP) {
    const failedOrder = await prisma.order.update({
      where: { id: order.id },
      data: { paymentStatus: "FAILED" },
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

    return NextResponse.json(
      {
        ok: false,
        error: simulateFail
          ? "Ödeme banka tarafından reddedildi (Simülasyon)."
          : `3D Secure doğrulama kodu hatalı (Test kodu: ${TEST_3DS_OTP}).`,
        order: serializeOrder(failedOrder),
      },
      { status: 400 },
    );
  }

  const paidOrder = await prisma.order.update({
    where: { id: order.id },
    data: {
      paymentStatus: "PAID",
      status: "RECEIVED",
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
    ok: true,
    order: serializeOrder(paidOrder),
  });
}
