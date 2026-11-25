import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { jsonError, parseJsonBody } from "@/lib/api-helpers";
import { setPanelSessionCookie, signPanelToken } from "@/lib/auth";

const panelLoginSchema = z.object({
  email: z.string().trim().email("Geçerli bir e-posta adresi giriniz."),
  password: z.string().min(1, "Şifre gereklidir."),
});

export async function POST(request: Request) {
  const parsed = await parseJsonBody(request, panelLoginSchema);
  if (parsed.response) return parsed.response;

  const email = parsed.data.email.toLowerCase();
  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      branch: {
        select: { id: true, name: true },
      },
    },
  });

  if (
    !user ||
    (user.role !== "ADMIN" && user.role !== "SYSTEM") ||
    !user.passwordHash
  ) {
    return jsonError("E-posta veya şifre hatalı.", 401);
  }

  const passwordMatches = await bcrypt.compare(
    parsed.data.password,
    user.passwordHash,
  );
  if (!passwordMatches) {
    return jsonError("E-posta veya şifre hatalı.", 401);
  }

  const token = await signPanelToken(user.id, user.role);
  const response = NextResponse.json({
    ok: true,
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

  setPanelSessionCookie(response, token);
  return response;
}
