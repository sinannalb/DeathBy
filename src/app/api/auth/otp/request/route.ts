import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, parseJsonBody } from "@/lib/api-helpers";
import { normalizePhone } from "@/lib/auth";
import { sendOtpSms } from "@/lib/sms";

const otpRequestSchema = z.object({
  phone: z.string().trim().min(10, "Geçerli bir cep telefonu numarası giriniz."),
});

export async function POST(request: Request) {
  const parsed = await parseJsonBody(request, otpRequestSchema);
  if (parsed.response) return parsed.response;

  const normalizedPhone = normalizePhone(parsed.data.phone);
  if (!normalizedPhone) {
    return jsonError(
      "Geçerli bir Türkiye cep telefonu numarası giriniz (05XX XXX XX XX).",
      400,
    );
  }

  const result = await sendOtpSms(normalizedPhone);

  return NextResponse.json({
    ok: true,
    phone: normalizedPhone,
    mode: result.mode,
    ...(result.testOtp ? { testOtp: result.testOtp } : {}),
  });
}
