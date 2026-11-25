import { NextResponse } from "next/server";
import { BranchManualStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { jsonError, parseJsonBody } from "@/lib/api-helpers";
import { requirePanelRole } from "@/lib/auth";
import { serializeBranchDetail } from "@/lib/serializers";

const updateBranchStatusSchema = z.object({
  manualStatus: z.nativeEnum(BranchManualStatus),
  isBusy: z.boolean().optional(),
  courierEnabled: z.boolean().optional(),
  busyUntil: z.string().datetime().nullable().optional(),
  busyMessage: z.string().trim().max(300).nullable().optional(),
  estimatedMinMinutes: z.number().int().min(5).max(240).optional(),
  estimatedMaxMinutes: z.number().int().min(5).max(300).optional(),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requirePanelRole(["ADMIN", "SYSTEM"]);
  if (auth.response) return auth.response;

  const { id } = await context.params;

  if (auth.session.role === "SYSTEM" && auth.session.branchId !== id) {
    return jsonError("Yalnızca kendi şubenizin durumunu değiştirebilirsiniz.", 403);
  }

  const parsed = await parseJsonBody(request, updateBranchStatusSchema);
  if (parsed.response) return parsed.response;

  const existing = await prisma.branch.findUnique({ where: { id } });
  if (!existing) {
    return jsonError("Şube bulunamadı.", 404);
  }

  const data = parsed.data;
  const nextMin = data.estimatedMinMinutes ?? existing.estimatedMinMinutes;
  const nextMax = data.estimatedMaxMinutes ?? existing.estimatedMaxMinutes;
  if (nextMin > nextMax) {
    return jsonError(
      "Minimum teslimat süresi maksimum süreden büyük olamaz.",
      400,
    );
  }

  const nextIsBusy =
    data.isBusy !== undefined
      ? data.isBusy
      : data.manualStatus === "BUSY"
        ? true
        : existing.isBusy;

  const hasTimedOverride = nextIsBusy || data.manualStatus === "FORCE_CLOSED";

  const busyUntil = !hasTimedOverride
    ? null
    : data.busyUntil !== undefined
      ? data.busyUntil
        ? new Date(data.busyUntil)
        : null
      : existing.busyUntil;

  const busyMessage = !hasTimedOverride
    ? null
    : data.busyMessage !== undefined
      ? data.busyMessage || null
      : existing.busyMessage;

  const updated = await prisma.branch.update({
    where: { id },
    data: {
      manualStatus: data.manualStatus,
      isBusy: nextIsBusy,
      ...(data.courierEnabled !== undefined
        ? { courierEnabled: data.courierEnabled }
        : {}),
      busyUntil,
      busyMessage,
      estimatedMinMinutes: nextMin,
      estimatedMaxMinutes: nextMax,
    },
    include: {
      schedules: { orderBy: { dayOfWeek: "asc" } },
      neighborhoods: {
        orderBy: [{ city: "asc" }, { district: "asc" }, { neighborhood: "asc" }],
      },
    },
  });

  return NextResponse.json({
    branch: serializeBranchDetail(updated),
  });
}
