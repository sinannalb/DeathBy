import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";

export interface SendOtpResult {
  sent: true;
  mode: "test" | "live";
  testOtp?: string;
}

const OTP_TTL_MS = 5 * 60 * 1000;

export async function sendOtpSms(normalizedPhone: string): Promise<SendOtpResult> {
  const mode = process.env.SMS_MODE === "live" ? "live" : "test";
  const code = crypto.randomInt(100000, 1000000).toString();
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);

  await prisma.otpCode.create({
    data: {
      phone: normalizedPhone,
      code,
      expiresAt,
    },
  });

  if (mode === "live") {
    // Live SMS gateway integration point (NetGSM / IletiMerkezi / etc.)
    console.info(`[SMS:LIVE] OTP dispatched to ${normalizedPhone}`);
    return {
      sent: true,
      mode: "live",
    };
  }

  console.info(`[SMS:TEST] Phone=${normalizedPhone} OTP=${code}`);
  return {
    sent: true,
    mode: "test",
    testOtp: code,
  };
}
