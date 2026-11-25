import { NextResponse } from "next/server";
import { clearPanelSessionCookie } from "@/lib/auth";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  clearPanelSessionCookie(response);
  return response;
}
