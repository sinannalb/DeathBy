import { NextResponse } from "next/server";
import type { z } from "zod";
import type { Prisma } from "@prisma/client";

export function jsonError(
  message: string,
  status: number = 400,
  details?: unknown,
): NextResponse {
  return NextResponse.json(
    details !== undefined ? { error: message, details } : { error: message },
    { status },
  );
}

export async function parseJsonBody<T>(
  request: Request,
  schema: z.ZodType<T, z.ZodTypeDef, unknown>,
): Promise<
  { data: T; response?: never } | { data?: never; response: NextResponse }
> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return { response: jsonError("Geçersiz JSON gövdesi.", 400) };
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const flat = parsed.error.flatten();
    const firstFieldMessage = Object.values(flat.fieldErrors)
      .flat()
      .find((msg): msg is string => typeof msg === "string");
    return {
      response: jsonError(
        firstFieldMessage || flat.formErrors[0] || "Geçersiz istek verisi.",
        400,
        flat,
      ),
    };
  }

  return { data: parsed.data };
}

export function slugifyTr(input: string): string {
  const map: Record<string, string> = {
    ç: "c",
    Ç: "c",
    ğ: "g",
    Ğ: "g",
    ı: "i",
    İ: "i",
    ö: "o",
    Ö: "o",
    ş: "s",
    Ş: "s",
    ü: "u",
    Ü: "u",
  };
  const replaced = input
    .split("")
    .map((ch) => map[ch] ?? ch)
    .join("");

  return replaced
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Generates an atomic sequential order number like `DBC-1001` inside a Prisma transaction.
 */
export async function generateNextOrderNumber(
  tx: Prisma.TransactionClient,
): Promise<string> {
  await tx.$executeRawUnsafe(
    `CREATE SEQUENCE IF NOT EXISTS order_number_seq START WITH 1001 INCREMENT BY 1`,
  );
  const rows = await tx.$queryRawUnsafe<Array<{ seq: string }>>(
    `SELECT nextval('order_number_seq')::text AS seq`,
  );
  const seq = rows[0]?.seq ?? String(Date.now());
  return `DBC-${seq}`;
}
