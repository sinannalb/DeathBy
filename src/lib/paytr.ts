import crypto from "node:crypto";

export type PaytrMode = "mock" | "test" | "live";

export interface PaytrTestCard {
  label: string;
  brand: "VISA" | "MASTERCARD";
  cardNumber: string;
  expiry: string;
  cvv: string;
  holderName: string;
}

export const TEST_CARDS: PaytrTestCard[] = [
  {
    label: "Visa Test Kartı",
    brand: "VISA",
    cardNumber: "4355 0843 5508 4358",
    expiry: "12/28",
    cvv: "000",
    holderName: "TEST MÜŞTERİ",
  },
  {
    label: "Mastercard Test Kartı",
    brand: "MASTERCARD",
    cardNumber: "5406 6754 0667 5406",
    expiry: "12/28",
    cvv: "000",
    holderName: "TEST MÜŞTERİ",
  },
];

export const TEST_3DS_OTP = "123456";

export function getPaytrMode(): PaytrMode {
  const raw = (process.env.PAYTR_MODE ?? "mock").toLowerCase();
  if (raw === "test" || raw === "live") return raw;
  return "mock";
}

export interface PaytrBasketItem {
  name: string;
  unitPriceTl: number;
  quantity: number;
}

export interface CreatePaytrSessionInput {
  merchantOid: string;
  email: string;
  paymentAmountKurus: number;
  userName: string;
  userAddress: string;
  userPhone: string;
  userIp: string;
  basketItems: PaytrBasketItem[];
}

export interface PaytrPaymentSession {
  mode: PaytrMode;
  merchantOid: string;
  testCards?: PaytrTestCard[];
  testOtp?: string;
  iframeToken?: string;
  iframeUrl?: string;
}

export async function createPaytrPaymentSession(
  input: CreatePaytrSessionInput,
): Promise<PaytrPaymentSession> {
  const mode = getPaytrMode();

  if (mode === "mock") {
    return {
      mode: "mock",
      merchantOid: input.merchantOid,
      testCards: TEST_CARDS,
      testOtp: TEST_3DS_OTP,
    };
  }

  const merchantId = process.env.PAYTR_MERCHANT_ID ?? "";
  const merchantKey = process.env.PAYTR_MERCHANT_KEY ?? "";
  const merchantSalt = process.env.PAYTR_MERCHANT_SALT ?? "";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  if (!merchantId || !merchantKey || !merchantSalt) {
    throw new Error(
      "PAYTR_MERCHANT_ID, PAYTR_MERCHANT_KEY ve PAYTR_MERCHANT_SALT tanımlı olmalıdır.",
    );
  }

  const userBasket = Buffer.from(
    JSON.stringify(
      input.basketItems.map((item) => [
        item.name,
        item.unitPriceTl.toFixed(2),
        item.quantity,
      ]),
    ),
  ).toString("base64");

  const noInstallment = "1";
  const maxInstallment = "0";
  const currency = "TL";
  const testMode = mode === "test" ? "1" : "0";
  const paymentAmount = String(input.paymentAmountKurus);

  const hashStr =
    merchantId +
    input.userIp +
    input.merchantOid +
    input.email +
    paymentAmount +
    userBasket +
    noInstallment +
    maxInstallment +
    currency +
    testMode;

  const paytrToken = crypto
    .createHmac("sha256", merchantKey)
    .update(hashStr + merchantSalt)
    .digest("base64");

  const body = new URLSearchParams({
    merchant_id: merchantId,
    user_ip: input.userIp,
    merchant_oid: input.merchantOid,
    email: input.email,
    payment_amount: paymentAmount,
    paytr_token: paytrToken,
    user_basket: userBasket,
    debug_on: testMode,
    no_installment: noInstallment,
    max_installment: maxInstallment,
    user_name: input.userName,
    user_address: input.userAddress,
    user_phone: input.userPhone,
    merchant_ok_url: `${appUrl}/siparislerim`,
    merchant_fail_url: `${appUrl}/sepet`,
    timeout_limit: "30",
    currency,
    test_mode: testMode,
    lang: "tr",
  });

  const res = await fetch("https://www.paytr.com/odeme/api/get-token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const data = (await res.json()) as {
    status?: string;
    token?: string;
    reason?: string;
  };

  if (data.status !== "success" || !data.token) {
    throw new Error(data.reason || "PayTR ödeme oturumu başlatılamadı.");
  }

  return {
    mode,
    merchantOid: input.merchantOid,
    iframeToken: data.token,
    iframeUrl: `https://www.paytr.com/odeme/guvenli/${data.token}`,
  };
}

export function verifyPaytrCallback(params: {
  merchantOid: string;
  status: string;
  totalAmount: string;
  hash: string;
}): boolean {
  const merchantKey = process.env.PAYTR_MERCHANT_KEY ?? "";
  const merchantSalt = process.env.PAYTR_MERCHANT_SALT ?? "";
  if (!merchantKey || !merchantSalt || !params.hash) {
    return false;
  }

  const expected = crypto
    .createHmac("sha256", merchantKey)
    .update(
      `${params.merchantOid}${merchantSalt}${params.status}${params.totalAmount}`,
    )
    .digest("base64");

  const expectedBuf = Buffer.from(expected, "utf8");
  const actualBuf = Buffer.from(params.hash, "utf8");

  if (expectedBuf.length !== actualBuf.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuf, actualBuf);
}
