import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { parseJsonBody } from "@/lib/api-helpers";
import { computeBranchStatus } from "@/lib/branch-status";
import {
  serializeBranchSummary,
  serializeNeighborhood,
} from "@/lib/serializers";

const resolveSchema = z.object({
  city: z.string().trim().min(1, "Şehir seçiniz."),
  district: z.string().trim().min(1, "İlçe seçiniz."),
  neighborhood: z.string().trim().min(1, "Mahalle seçiniz."),
});

export async function POST(request: Request) {
  const parsed = await parseJsonBody(request, resolveSchema);
  if (parsed.response) return parsed.response;

  const { city, district, neighborhood } = parsed.data;

  const found = await prisma.deliveryNeighborhood.findFirst({
    where: {
      city: { equals: city, mode: "insensitive" },
      district: { equals: district, mode: "insensitive" },
      neighborhood: { equals: neighborhood, mode: "insensitive" },
      isActive: true,
      branch: { isActive: true },
    },
    include: {
      branch: {
        include: { schedules: true },
      },
    },
  });

  if (!found) {
    return NextResponse.json({
      serviced: false,
      message: "Seçilen mahalle için şu anda kurye teslimatımız bulunmamaktadır.",
    });
  }

  const now = new Date();
  const branchSummary = serializeBranchSummary(found.branch, now);

  if (!found.branch.courierEnabled) {
    return NextResponse.json({
      serviced: false,
      takeawayOnly: true,
      branch: branchSummary,
      message: `${found.branch.name} şu an yalnızca Gel-Al (Takeaway) hizmet vermektedir; kurye teslimatı kapalıdır.`,
    });
  }

  const status = computeBranchStatus(found.branch, now);

  return NextResponse.json({
    serviced: true,
    neighborhood: serializeNeighborhood(found),
    branch: branchSummary,
    status,
  });
}
