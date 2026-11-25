import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { jsonError, parseJsonBody } from "@/lib/api-helpers";
import { requirePanelRole } from "@/lib/auth";

const createPanelUserSchema = z.object({
  name: z.string().trim().min(2, "Ad Soyad en az 2 karakter olmalıdır.").max(100),
  email: z.string().trim().email("Geçerli bir e-posta adresi giriniz."),
  password: z.string().min(6, "Şifre en az 6 karakter olmalıdır."),
  role: z.enum(["ADMIN", "SYSTEM"]),
  branchId: z.string().min(1).nullable().optional(),
});

const updatePanelUserSchema = z.object({
  id: z.string().min(1, "Kullanıcı ID gereklidir."),
  name: z.string().trim().min(2).max(100).optional(),
  email: z.string().trim().email().optional(),
  password: z.string().min(6).optional(),
  role: z.enum(["ADMIN", "SYSTEM"]).optional(),
  branchId: z.string().min(1).nullable().optional(),
});

export async function GET() {
  const auth = await requirePanelRole(["ADMIN"]);
  if (auth.response) return auth.response;

  const users = await prisma.user.findMany({
    where: { role: { in: ["ADMIN", "SYSTEM"] } },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      role: true,
      name: true,
      email: true,
      branchId: true,
      createdAt: true,
      branch: {
        select: { name: true },
      },
    },
  });

  return NextResponse.json({
    users: users.map((u) => ({
      id: u.id,
      role: u.role,
      name: u.name,
      email: u.email,
      branchId: u.branchId,
      branchName: u.branch?.name ?? null,
      createdAt: u.createdAt.toISOString(),
    })),
  });
}

export async function POST(request: Request) {
  const auth = await requirePanelRole(["ADMIN"]);
  if (auth.response) return auth.response;

  const parsed = await parseJsonBody(request, createPanelUserSchema);
  if (parsed.response) return parsed.response;

  const data = parsed.data;
  const email = data.email.toLowerCase();

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return jsonError("Bu e-posta adresi zaten kayıtlı.", 409);
  }

  let resolvedBranchId: string | null = null;
  if (data.role === "SYSTEM") {
    if (!data.branchId) {
      return jsonError("Şube (SYSTEM) kullanıcısı için şube seçilmelidir.", 400);
    }
    const branch = await prisma.branch.findUnique({
      where: { id: data.branchId },
    });
    if (!branch) {
      return jsonError("Seçilen şube bulunamadı.", 404);
    }
    resolvedBranchId = branch.id;
  }

  const passwordHash = await bcrypt.hash(data.password, 10);

  const created = await prisma.user.create({
    data: {
      role: data.role,
      name: data.name,
      email,
      passwordHash,
      branchId: resolvedBranchId,
    },
    select: {
      id: true,
      role: true,
      name: true,
      email: true,
      branchId: true,
      createdAt: true,
      branch: { select: { name: true } },
    },
  });

  return NextResponse.json(
    {
      user: {
        id: created.id,
        role: created.role,
        name: created.name,
        email: created.email,
        branchId: created.branchId,
        branchName: created.branch?.name ?? null,
        createdAt: created.createdAt.toISOString(),
      },
    },
    { status: 201 },
  );
}

export async function PATCH(request: Request) {
  const auth = await requirePanelRole(["ADMIN"]);
  if (auth.response) return auth.response;

  const parsed = await parseJsonBody(request, updatePanelUserSchema);
  if (parsed.response) return parsed.response;

  const data = parsed.data;
  const existing = await prisma.user.findUnique({ where: { id: data.id } });
  if (!existing || (existing.role !== "ADMIN" && existing.role !== "SYSTEM")) {
    return jsonError("Panel kullanıcısı bulunamadı.", 404);
  }

  let nextEmail: string | undefined;
  if (data.email !== undefined) {
    nextEmail = data.email.toLowerCase();
    const owner = await prisma.user.findUnique({ where: { email: nextEmail } });
    if (owner && owner.id !== existing.id) {
      return jsonError("Bu e-posta adresi başka bir kullanıcıda kayıtlı.", 409);
    }
  }

  const nextRole = data.role ?? (existing.role as "ADMIN" | "SYSTEM");
  let nextBranchId =
    data.branchId !== undefined ? data.branchId : existing.branchId;

  if (nextRole === "ADMIN") {
    nextBranchId = null;
  } else {
    if (!nextBranchId) {
      return jsonError("Şube (SYSTEM) kullanıcısı için şube seçilmelidir.", 400);
    }
    const branch = await prisma.branch.findUnique({
      where: { id: nextBranchId },
    });
    if (!branch) {
      return jsonError("Seçilen şube bulunamadı.", 404);
    }
  }

  const passwordHash = data.password
    ? await bcrypt.hash(data.password, 10)
    : undefined;

  const updated = await prisma.user.update({
    where: { id: existing.id },
    data: {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(nextEmail !== undefined ? { email: nextEmail } : {}),
      ...(passwordHash !== undefined ? { passwordHash } : {}),
      role: nextRole,
      branchId: nextBranchId,
    },
    select: {
      id: true,
      role: true,
      name: true,
      email: true,
      branchId: true,
      createdAt: true,
      branch: { select: { name: true } },
    },
  });

  return NextResponse.json({
    user: {
      id: updated.id,
      role: updated.role,
      name: updated.name,
      email: updated.email,
      branchId: updated.branchId,
      branchName: updated.branch?.name ?? null,
      createdAt: updated.createdAt.toISOString(),
    },
  });
}
