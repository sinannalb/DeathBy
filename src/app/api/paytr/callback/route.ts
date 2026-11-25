import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPaytrCallback } from "@/lib/paytr";

export async function POST(request: Request) {
  const rawBody = await request.text();
  const params = new URLSearchParams(rawBody);

  const merchantOid = params.get("merchant_oid") ?? "";
  const status = params.get("status") ?? "";
  const totalAmount = params.get("total_amount") ?? "";
  const hash = params.get("hash") ?? "";

  if (!merchantOid || !status || !totalAmount || !hash) {
    return new NextResponse("PAYTR notification failed: missing parameters", {
      status: 400,
    });
  }

  const isValid = verifyPaytrCallback({
    merchantOid,
    status,
    totalAmount,
    hash,
  });

  if (!isValid) {
    return new NextResponse("PAYTR notification failed: bad hash", {
      status: 400,
    });
  }

  const order = await prisma.order.findUnique({
    where: { merchantOid },
  });

  if (!order) {
    return new NextResponse("PAYTR notification failed: order not found", {
      status: 404,
    });
  }

  if (order.paymentStatus !== "PAID") {
    await prisma.order.update({
      where: { id: order.id },
      data: {
        paymentStatus: status === "success" ? "PAID" : "FAILED",
      },
    });
  }

  return new NextResponse("OK", {
    status: 200,
    headers: { "Content-Type": "text/plain" },
  });
}
