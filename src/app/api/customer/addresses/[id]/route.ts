import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { jsonError, parseJsonBody } from "@/lib/api-helpers";
import { requireCustomerSession } from "@/lib/auth";

const updateAddressSchema = z.object({
  title: z.string().trim().min(1, "Adres başlığı gereklidir.").max(60),
  city: z.string().trim().min(1, "Şehir gereklidir."),
  district: z.string().trim().min(1, "İlçe gereklidir."),
  neighborhood: z.string().trim().min(1, "Mahalle gereklidir."),
  fullAddress: z.string().trim().min(5, "Açık adres en az 5 karakter olmalıdır."),
  directions: z.string().trim().max(300).optional().nullable(),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireCustomerSession();
  if (auth.response) return auth.response;

  const { id } = await context.params;
  const parsed = await parseJsonBody(request, updateAddressSchema);
  if (parsed.response) return parsed.response;

  const address = await prisma.customerAddress.findUnique({
    where: { id },
  });

  if (!address || !address.isActive) {
    return jsonError("Adres bulunamadı.", 404);
  }

  if (address.userId !== auth.session.userId) {
    return jsonError("Bu adresi düzenleme yetkiniz yok.", 403);
  }

  const activeOrdersCount = await prisma.order.count({
    where: {
      userId: auth.session.userId,
      status: { notIn: ["COMPLETED", "CANCELLED"] },
      paymentStatus: { not: "FAILED" },
    },
  });

  if (activeOrdersCount > 0) {
    return jsonError(
      "Aktif siparişiniz bulunduğu için adres değişikliği yapılamaz. Tüm siparişleriniz tamamlandıktan sonra adresinizi güncelleyebilirsiniz.",
      409,
    );
  }

  const updated = await prisma.customerAddress.update({
    where: { id },
    data: {
      title: parsed.data.title,
      city: parsed.data.city,
      district: parsed.data.district,
      neighborhood: parsed.data.neighborhood,
      fullAddress: parsed.data.fullAddress,
      directions: parsed.data.directions || null,
    },
  });

  return NextResponse.json({
    address: {
      id: updated.id,
      userId: updated.userId,
      title: updated.title,
      city: updated.city,
      district: updated.district,
      neighborhood: updated.neighborhood,
      fullAddress: updated.fullAddress,
      directions: updated.directions,
      createdAt: updated.createdAt.toISOString(),
    },
  });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireCustomerSession();
  if (auth.response) return auth.response;

  const { id } = await context.params;

  const address = await prisma.customerAddress.findUnique({
    where: { id },
  });

  if (!address || !address.isActive) {
    return jsonError("Adres bulunamadı.", 404);
  }

  if (address.userId !== auth.session.userId) {
    return jsonError("Bu adresi silme yetkiniz yok.", 403);
  }

  const activeCount = await prisma.customerAddress.count({
    where: { userId: auth.session.userId, isActive: true },
  });

  if (activeCount <= 1) {
    return jsonError(
      "En az 1 kayıtlı adresiniz bulunmalıdır. Bu adresi silmek için önce yeni bir adres ekleyin.",
      400,
    );
  }

  // Soft-delete so historical records remain preserved in DB
  await prisma.customerAddress.update({
    where: { id },
    data: { isActive: false },
  });

  return NextResponse.json({ ok: true });
}
