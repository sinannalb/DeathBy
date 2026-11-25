import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-helpers";
import { requireCustomerSession } from "@/lib/auth";

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

  if (!address) {
    return jsonError("Adres bulunamadı.", 404);
  }

  if (address.userId !== auth.session.userId) {
    return jsonError("Bu adresi silme yetkiniz yok.", 403);
  }

  await prisma.customerAddress.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
