import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-helpers";
import { requirePanelRole } from "@/lib/auth";

export async function GET() {
  const auth = await requirePanelRole(["ADMIN", "SYSTEM"]);
  if (auth.response) return auth.response;

  const user = await prisma.user.findUnique({
    where: { id: auth.session.userId },
    include: {
      branch: {
        select: { id: true, name: true },
      },
    },
  });

  if (!user || (user.role !== "ADMIN" && user.role !== "SYSTEM")) {
    return jsonError("Kullanıcı bulunamadı.", 401);
  }

  return NextResponse.json({
    user: {
      id: user.id,
      role: user.role,
      name: user.name,
      email: user.email,
      branchId: user.branchId,
      branchName: user.branch?.name ?? null,
      createdAt: user.createdAt.toISOString(),
    },
  });
}
