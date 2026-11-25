import { NextResponse } from "next/server";
import { PaperWidth } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { jsonError, parseJsonBody } from "@/lib/api-helpers";
import { requirePanelRole } from "@/lib/auth";
import { serializeBranchDetail } from "@/lib/serializers";

const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

const updateBranchSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  address: z.string().trim().min(5).max(300).optional(),
  phone: z.string().trim().min(7).max(30).optional(),
  paperWidth: z.nativeEnum(PaperWidth).optional(),
  courierEnabled: z.boolean().optional(),
  isActive: z.boolean().optional(),
  estimatedMinMinutes: z.number().int().min(5).max(240).optional(),
  estimatedMaxMinutes: z.number().int().min(5).max(300).optional(),
  schedules: z
    .array(
      z.object({
        dayOfWeek: z.number().int().min(0).max(6),
        openTime: z.string().regex(timeRegex, "Saat formatı HH:MM olmalıdır."),
        closeTime: z.string().regex(timeRegex, "Saat formatı HH:MM olmalıdır."),
        isClosed: z.boolean(),
      }),
    )
    .optional(),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requirePanelRole(["ADMIN"]);
  if (auth.response) return auth.response;

  const { id } = await context.params;
  const parsed = await parseJsonBody(request, updateBranchSchema);
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

  const updated = await prisma.$transaction(async (tx) => {
    if (data.schedules) {
      for (const sched of data.schedules) {
        await tx.branchSchedule.upsert({
          where: {
            branchId_dayOfWeek: {
              branchId: id,
              dayOfWeek: sched.dayOfWeek,
            },
          },
          update: {
            openTime: sched.openTime,
            closeTime: sched.closeTime,
            isClosed: sched.isClosed,
          },
          create: {
            branchId: id,
            dayOfWeek: sched.dayOfWeek,
            openTime: sched.openTime,
            closeTime: sched.closeTime,
            isClosed: sched.isClosed,
          },
        });
      }
    }

    return tx.branch.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.address !== undefined ? { address: data.address } : {}),
        ...(data.phone !== undefined ? { phone: data.phone } : {}),
        ...(data.paperWidth !== undefined ? { paperWidth: data.paperWidth } : {}),
        ...(data.courierEnabled !== undefined
          ? { courierEnabled: data.courierEnabled }
          : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
        ...(data.estimatedMinMinutes !== undefined
          ? { estimatedMinMinutes: data.estimatedMinMinutes }
          : {}),
        ...(data.estimatedMaxMinutes !== undefined
          ? { estimatedMaxMinutes: data.estimatedMaxMinutes }
          : {}),
      },
      include: {
        schedules: { orderBy: { dayOfWeek: "asc" } },
        neighborhoods: {
          orderBy: [{ city: "asc" }, { district: "asc" }, { neighborhood: "asc" }],
        },
      },
    });
  });

  return NextResponse.json({
    branch: serializeBranchDetail(updated),
  });
}
