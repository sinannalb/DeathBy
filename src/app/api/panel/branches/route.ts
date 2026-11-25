import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-helpers";
import { requirePanelRole } from "@/lib/auth";
import { serializeBranchDetail } from "@/lib/serializers";

export async function GET() {
  const auth = await requirePanelRole(["ADMIN", "SYSTEM"]);
  if (auth.response) return auth.response;

  if (auth.session.role === "SYSTEM" && !auth.session.branchId) {
    return jsonError("Kullanıcıya atanmış şube bulunamadı.", 403);
  }

  const branches = await prisma.branch.findMany({
    where:
      auth.session.role === "SYSTEM"
        ? { id: auth.session.branchId! }
        : undefined,
    orderBy: { name: "asc" },
    include: {
      schedules: { orderBy: { dayOfWeek: "asc" } },
      neighborhoods: {
        orderBy: [{ city: "asc" }, { district: "asc" }, { neighborhood: "asc" }],
      },
    },
  });

  const now = new Date();
  return NextResponse.json({
    branches: branches.map((b) => serializeBranchDetail(b, now)),
  });
}
