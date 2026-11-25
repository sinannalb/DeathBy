import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  serializeBranchSummary,
  serializeNeighborhood,
} from "@/lib/serializers";
import type { BranchSummaryDTO } from "@/lib/types";

export async function GET() {
  const now = new Date();

  const [allBranches, rows] = await Promise.all([
    prisma.branch.findMany({
      where: { isActive: true },
      include: { schedules: true },
      orderBy: [{ courierEnabled: "desc" }, { name: "asc" }],
    }),
    prisma.deliveryNeighborhood.findMany({
      where: {
        isActive: true,
        branch: {
          isActive: true,
        },
      },
      include: {
        branch: {
          include: {
            schedules: true,
          },
        },
      },
      orderBy: [{ city: "asc" }, { district: "asc" }, { neighborhood: "asc" }],
    }),
  ]);

  const branchMap = new Map<string, BranchSummaryDTO>();
  for (const b of allBranches) {
    branchMap.set(b.id, serializeBranchSummary(b, now));
  }

  const neighborhoods = rows.map((row) => {
    const branchSummary =
      branchMap.get(row.branchId) ?? serializeBranchSummary(row.branch, now);
    return {
      ...serializeNeighborhood(row),
      branch: branchSummary,
    };
  });

  return NextResponse.json({
    neighborhoods,
    branches: Array.from(branchMap.values()),
  });
}
