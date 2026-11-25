import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { jsonError, parseJsonBody } from "@/lib/api-helpers";
import {
  normalizePhone,
  setCustomerSessionCookie,
  signCustomerToken,
} from "@/lib/auth";

const otpVerifySchema = z.object({
  phone: z.string().trim().min(10, "Telefon numarası gereklidir."),
  code: z.string().trim().regex(/^\d{6}$/, "6 haneli doğrulama kodunu giriniz."),
  name: z.string().trim().min(2).max(100).optional(),
});

export async function POST(request: Request) {
  const parsed = await parseJsonBody(request, otpVerifySchema);
  if (parsed.response) return parsed.response;

  const normalizedPhone = normalizePhone(parsed.data.phone);
  if (!normalizedPhone) {
    return jsonError(
      "Geçerli bir Türkiye cep telefonu numarası giriniz (05XX XXX XX XX).",
      400,
    );
  }

  const now = new Date();
  const latestOtp = await prisma.otpCode.findFirst({
    where: {
      phone: normalizedPhone,
      usedAt: null,
      expiresAt: { gt: now },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!latestOtp || latestOtp.code !== parsed.data.code) {
    return jsonError("Doğrulama kodu geçersiz veya süresi dolmuş.", 400);
  }

  const user = await prisma.$transaction(async (tx) => {
    await tx.otpCode.update({
      where: { id: latestOtp.id },
      data: { usedAt: now },
    });

    const existing = await tx.user.findUnique({
      where: { phone: normalizedPhone },
    });

    if (existing) {
      if (parsed.data.name && parsed.data.name !== existing.name) {
        return tx.user.update({
          where: { id: existing.id },
          data: { name: parsed.data.name },
        });
      }
      return existing;
    }

    return tx.user.create({
      data: {
        role: "CUSTOMER",
        phone: normalizedPhone,
        name: parsed.data.name || "Müşteri",
      },
    });
  });

  const token = await signCustomerToken(user.id);
  const response = NextResponse.json({
    ok: true,
    user: {
      id: user.id,
      role: user.role,
      name: user.name,
      phone: user.phone,
      createdAt: user.createdAt.toISOString(),
    },
  });

  setCustomerSessionCookie(response, token);
  return response;
}
