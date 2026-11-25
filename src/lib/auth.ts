import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { prisma } from "@/lib/prisma";

export const CUSTOMER_COOKIE_NAME = "dbc_customer_session";
export const PANEL_COOKIE_NAME = "dbc_panel_session";

const CUSTOMER_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days
const PANEL_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

export interface CustomerSession {
  userId: string;
  role: "CUSTOMER";
  phone: string;
  name: string;
}

export interface PanelSession {
  userId: string;
  role: "ADMIN" | "SYSTEM";
  email: string;
  name: string;
  branchId: string | null;
}

interface SessionJwtPayload extends JWTPayload {
  sub: string;
  role: "ADMIN" | "SYSTEM" | "CUSTOMER";
  scope: "customer" | "panel";
}

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET environment variable is not configured.");
  }
  return new TextEncoder().encode(secret);
}

function isSecureCookie(): boolean {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.URL ?? "";
  return appUrl.startsWith("https://");
}

/**
 * Normalizes Turkish mobile phone inputs into `05XXXXXXXXX` format.
 * Returns null if the phone number is not a valid Turkish mobile number.
 */
export function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  let normalized = digits;

  if (digits.startsWith("90") && digits.length === 12) {
    normalized = `0${digits.slice(2)}`;
  } else if (digits.startsWith("5") && digits.length === 10) {
    normalized = `0${digits}`;
  } else if (digits.startsWith("0090") && digits.length === 14) {
    normalized = `0${digits.slice(4)}`;
  }

  if (!/^05\d{9}$/.test(normalized)) {
    return null;
  }

  return normalized;
}

async function signJwt(
  payload: Omit<SessionJwtPayload, "iat" | "exp">,
  ttlSeconds: number,
): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${ttlSeconds}s`)
    .sign(getJwtSecret());
}

async function verifyJwt(token: string): Promise<SessionJwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret(), {
      algorithms: ["HS256"],
    });
    if (
      typeof payload.sub !== "string" ||
      typeof payload.role !== "string" ||
      typeof payload.scope !== "string"
    ) {
      return null;
    }
    return payload as SessionJwtPayload;
  } catch {
    return null;
  }
}

export async function signCustomerToken(userId: string): Promise<string> {
  return signJwt(
    { sub: userId, role: "CUSTOMER", scope: "customer" },
    CUSTOMER_TTL_SECONDS,
  );
}

export async function signPanelToken(
  userId: string,
  role: "ADMIN" | "SYSTEM",
): Promise<string> {
  return signJwt(
    { sub: userId, role, scope: "panel" },
    PANEL_TTL_SECONDS,
  );
}

export function setCustomerSessionCookie(
  response: NextResponse,
  token: string,
): void {
  response.cookies.set(CUSTOMER_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: isSecureCookie(),
    path: "/",
    maxAge: CUSTOMER_TTL_SECONDS,
  });
}

export function clearCustomerSessionCookie(response: NextResponse): void {
  response.cookies.set(CUSTOMER_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: isSecureCookie(),
    path: "/",
    maxAge: 0,
  });
}

export function setPanelSessionCookie(
  response: NextResponse,
  token: string,
): void {
  response.cookies.set(PANEL_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: isSecureCookie(),
    path: "/",
    maxAge: PANEL_TTL_SECONDS,
  });
}

export function clearPanelSessionCookie(response: NextResponse): void {
  response.cookies.set(PANEL_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: isSecureCookie(),
    path: "/",
    maxAge: 0,
  });
}

export async function getCustomerSession(): Promise<CustomerSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(CUSTOMER_COOKIE_NAME)?.value;
  if (!token) return null;

  const payload = await verifyJwt(token);
  if (!payload || payload.scope !== "customer" || payload.role !== "CUSTOMER") {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: { id: true, role: true, phone: true, name: true },
  });

  if (!user || user.role !== "CUSTOMER" || !user.phone) {
    return null;
  }

  return {
    userId: user.id,
    role: "CUSTOMER",
    phone: user.phone,
    name: user.name,
  };
}

export async function getPanelSession(): Promise<PanelSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(PANEL_COOKIE_NAME)?.value;
  if (!token) return null;

  const payload = await verifyJwt(token);
  if (
    !payload ||
    payload.scope !== "panel" ||
    (payload.role !== "ADMIN" && payload.role !== "SYSTEM")
  ) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: { id: true, role: true, email: true, name: true, branchId: true },
  });

  if (
    !user ||
    (user.role !== "ADMIN" && user.role !== "SYSTEM") ||
    !user.email
  ) {
    return null;
  }

  return {
    userId: user.id,
    role: user.role,
    email: user.email,
    name: user.name,
    branchId: user.branchId,
  };
}

export async function requireCustomerSession(): Promise<
  { session: CustomerSession; response?: never } | { session?: never; response: NextResponse }
> {
  const session = await getCustomerSession();
  if (!session) {
    return {
      response: NextResponse.json(
        { error: "Oturum açmanız gerekiyor." },
        { status: 401 },
      ),
    };
  }
  return { session };
}

export async function requirePanelRole(
  allowedRoles: Array<"ADMIN" | "SYSTEM"> = ["ADMIN", "SYSTEM"],
): Promise<
  { session: PanelSession; response?: never } | { session?: never; response: NextResponse }
> {
  const session = await getPanelSession();
  if (!session) {
    return {
      response: NextResponse.json(
        { error: "Yönetim paneli oturumu gerekli." },
        { status: 401 },
      ),
    };
  }
  if (!allowedRoles.includes(session.role)) {
    return {
      response: NextResponse.json(
        { error: "Bu işlem için yetkiniz bulunmamaktadır." },
        { status: 403 },
      ),
    };
  }
  return { session };
}
