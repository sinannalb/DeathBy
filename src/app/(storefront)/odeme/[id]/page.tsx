"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  CreditCard,
  Lock,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import type { OrderDTO } from "@/lib/types";
import { OtpLoginForm } from "@/components/storefront/OtpLoginForm";
import { useStore } from "@/components/storefront/StoreProvider";
import { formatTl } from "@/components/storefront/utils";

const VISA_TEST_CARD = {
  label: "Visa Test Kartı",
  number: "4543 6000 0000 0006",
  expiry: "12/28",
  cvv: "000",
  holder: "TEST MUSTERI",
};

const MASTERCARD_TEST_CARD = {
  label: "Mastercard Test Kartı",
  number: "5406 6700 0000 0007",
  expiry: "12/28",
  cvv: "000",
  holder: "TEST MUSTERI",
};

const TEST_3DS_CODE = "123456";

function formatCardNumberInput(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 16);
  return digits.replace(/(.{4})/g, "$1 ").trim();
}

function formatExpiryInput(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

export default function PaytrPaymentPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const orderId = params?.id;

  const { clearCart, showToast } = useStore();

  const [order, setOrder] = useState<OrderDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [iframeUrl, setIframeUrl] = useState<string | null>(null);

  const [cardHolder, setCardHolder] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");

  const [show3dsModal, setShow3dsModal] = useState(false);
  const [otp3ds, setOtp3ds] = useState("");
  const [processing, setProcessing] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  const loadOrder = useCallback(async () => {
    if (!orderId) return;
    setLoading(true);
    setLoadError(null);
    setNeedsAuth(false);
    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(orderId)}`, {
        cache: "no-store",
      });
      if (res.status === 401) {
        setNeedsAuth(true);
        return;
      }
      const data = (await res.json()) as {
        order?: OrderDTO;
        error?: string;
      };
      if (!res.ok || !data.order) {
        setLoadError(data.error || "Sipariş bilgisi yüklenemedi.");
        return;
      }
      if (data.order.paymentStatus === "PAID") {
        clearCart();
        router.replace(`/siparis/${data.order.id}`);
        return;
      }
      setOrder(data.order);

      try {
        const storedPayment = window.sessionStorage.getItem(
          `dbc_payment_${data.order.id}`,
        );
        if (storedPayment) {
          const parsed = JSON.parse(storedPayment) as {
            mode?: string;
            iframeUrl?: string;
          };
          if (parsed.mode !== "mock" && parsed.iframeUrl) {
            setIframeUrl(parsed.iframeUrl);
          }
        }
      } catch {
        // Ignore sessionStorage read errors
      }
    } catch {
      setLoadError("Bağlantı hatası. Lütfen tekrar deneyin.");
    } finally {
      setLoading(false);
    }
  }, [orderId, clearCart, router]);

  useEffect(() => {
    void loadOrder();
  }, [loadOrder]);

  function fillTestCard(card = VISA_TEST_CARD) {
    setCardHolder(card.holder);
    setCardNumber(card.number);
    setExpiry(card.expiry);
    setCvv(card.cvv);
    setPaymentError(null);
  }

  function handleOpen3ds(e: React.FormEvent) {
    e.preventDefault();
    setPaymentError(null);
    const digits = cardNumber.replace(/\D/g, "");
    if (digits.length < 15) {
      setPaymentError("Lütfen geçerli bir kart numarası giriniz.");
      return;
    }
    if (!/^\d{2}\/\d{2}$/.test(expiry.trim())) {
      setPaymentError("Lütfen son kullanma tarihini AA/YY formatında giriniz.");
      return;
    }
    if (cvv.trim().length < 3) {
      setPaymentError("Lütfen geçerli bir CVV kodu giriniz.");
      return;
    }
    setOtp3ds("");
    setShow3dsModal(true);
  }

  async function submitMockPayment(simulateFail: boolean) {
    if (!order) return;
    setProcessing(true);
    setPaymentError(null);

    const effectiveNumber =
      cardNumber.replace(/\D/g, "").length >= 15
        ? cardNumber
        : VISA_TEST_CARD.number;
    const effectiveExpiry = expiry.trim() || VISA_TEST_CARD.expiry;
    const effectiveCvv = cvv.trim() || VISA_TEST_CARD.cvv;
    const effectiveOtp = simulateFail ? "000000" : otp3ds.trim();

    try {
      const res = await fetch("/api/paytr/mock-complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: order.id,
          cardNumber: effectiveNumber,
          expiry: effectiveExpiry,
          cvv: effectiveCvv,
          otp: effectiveOtp,
          simulateFail,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        order?: OrderDTO;
        error?: string;
      };

      if (!res.ok || !data.ok) {
        setShow3dsModal(false);
        setPaymentError(data.error || "Ödeme tamamlanamadı.");
        if (data.order) {
          setOrder(data.order);
        }
        return;
      }

      clearCart();
      showToast("Ödemeniz onaylandı! Siparişiniz şubeye iletildi.", "success");
      router.replace(`/siparis/${order.id}`);
    } catch {
      setShow3dsModal(false);
      setPaymentError("Ödeme isteği sırasında bağlantı hatası oluştu.");
    } finally {
      setProcessing(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 space-y-4">
        <div className="h-8 w-52 rounded-xl bg-[#EFE6DC] animate-pulse" />
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3 h-96 rounded-3xl bg-[#EFE6DC] animate-pulse" />
          <div className="lg:col-span-2 h-80 rounded-3xl bg-[#EFE6DC] animate-pulse" />
        </div>
      </div>
    );
  }

  if (needsAuth) {
    return (
      <div className="max-w-md mx-auto px-4 py-12">
        <div className="rounded-3xl border border-[#E6D9CB] bg-[#FFFDF9] p-6 shadow-sm">
          <OtpLoginForm
            title="Ödeme İçin Giriş Yapın"
            subtitle="Siparişinizi görüntülemek ve ödemeyi tamamlamak için telefonunuzu doğrulayın."
            onSuccess={() => void loadOrder()}
          />
        </div>
      </div>
    );
  }

  if (loadError || !order) {
    return (
      <div className="max-w-lg mx-auto px-4 py-14 text-center space-y-4">
        <div className="rounded-3xl border border-[#9E2A2B]/30 bg-[#FFFDF9] p-8">
          <AlertTriangle className="w-10 h-10 text-[#9E2A2B] mx-auto mb-3" />
          <h1 className="font-serif text-xl font-bold text-[#1D110C]">
            Sipariş Bulunamadı
          </h1>
          <p className="text-sm text-[#6E5245] mt-1">
            {loadError || "İlgili sipariş kaydına ulaşılamadı."}
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 mt-5 rounded-xl bg-[#2C1A12] text-[#FBF6F0] text-sm font-semibold px-5 py-2.5"
          >
            <ArrowLeft className="w-4 h-4" />
            Ana Sayfaya Dön
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#6E5245] hover:text-[#1D110C]"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Menüye Dön
          </Link>
          <h1 className="font-serif text-2xl sm:text-3xl font-bold text-[#1D110C] mt-1">
            PayTR Güvenli Ödeme
          </h1>
          <p className="text-xs sm:text-sm text-[#6E5245]">
            Sipariş No: <strong className="text-[#1D110C]">{order.orderNumber}</strong> •{" "}
            {order.branchName}
          </p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 border border-emerald-200 px-3.5 py-1.5 text-xs font-semibold text-emerald-800">
          <Lock className="w-3.5 h-3.5" />
          256-Bit SSL Güvenli Ödeme
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
        {/* Left: Payment Form / Iframe */}
        <div className="lg:col-span-3 space-y-5">
          {iframeUrl ? (
            <div className="rounded-3xl border border-[#E6D9CB] bg-[#FFFDF9] p-4 shadow-sm">
              <iframe
                src={iframeUrl}
                title="PayTR Güvenli Ödeme Formu"
                className="w-full min-h-[540px] rounded-2xl border-0"
              />
            </div>
          ) : (
            <>
              {/* Prominent PayTR Test Card & 3DS Info Box */}
              <div className="rounded-3xl border-2 border-[#C68B3C] bg-gradient-to-br from-[#FDF4E7] to-[#FAF0DC] p-5 shadow-sm space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-[#B0782D]" />
                    <h2 className="font-serif font-bold text-base text-[#1D110C]">
                      PayTR Test Kartı & 3D Secure Bilgileri
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => fillTestCard(VISA_TEST_CARD)}
                    className="rounded-xl bg-[#C68B3C] hover:bg-[#B0782D] text-white text-xs font-bold px-3.5 py-2 transition-colors shadow-xs cursor-pointer"
                  >
                    Test Kart Bilgilerini Doldur
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                  <button
                    type="button"
                    onClick={() => fillTestCard(VISA_TEST_CARD)}
                    className="text-left rounded-2xl bg-white/85 hover:bg-white border border-[#C68B3C]/40 p-3 transition-colors cursor-pointer"
                  >
                    <span className="block font-bold text-[#1D110C]">
                      Visa Test Kartı
                    </span>
                    <span className="font-mono text-sm font-semibold text-[#2C1A12] block mt-0.5">
                      {VISA_TEST_CARD.number}
                    </span>
                    <span className="text-[11px] text-[#6E5245] block mt-0.5">
                      SKT: {VISA_TEST_CARD.expiry} • CVV: {VISA_TEST_CARD.cvv}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => fillTestCard(MASTERCARD_TEST_CARD)}
                    className="text-left rounded-2xl bg-white/85 hover:bg-white border border-[#C68B3C]/40 p-3 transition-colors cursor-pointer"
                  >
                    <span className="block font-bold text-[#1D110C]">
                      Mastercard Test Kartı
                    </span>
                    <span className="font-mono text-sm font-semibold text-[#2C1A12] block mt-0.5">
                      {MASTERCARD_TEST_CARD.number}
                    </span>
                    <span className="text-[11px] text-[#6E5245] block mt-0.5">
                      SKT: {MASTERCARD_TEST_CARD.expiry} • CVV:{" "}
                      {MASTERCARD_TEST_CARD.cvv}
                    </span>
                  </button>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#7A4F14] bg-white/60 rounded-xl px-3.5 py-2 border border-[#C68B3C]/30">
                  <span>
                    Kart Sahibi: <strong>TEST MUSTERI</strong>
                  </span>
                  <span>
                    3D Secure Test Doğrulama Kodu:{" "}
                    <strong className="font-mono text-sm bg-white px-1.5 py-0.5 rounded border border-[#C68B3C]/40 text-[#1D110C]">
                      {TEST_3DS_CODE}
                    </strong>
                  </span>
                </div>
              </div>

              {/* Card Form */}
              <form
                onSubmit={handleOpen3ds}
                className="rounded-3xl border border-[#E6D9CB] bg-[#FFFDF9] p-5 sm:p-6 shadow-sm space-y-4"
              >
                <div className="flex items-center gap-2 pb-2 border-b border-[#EFE6DC]">
                  <CreditCard className="w-5 h-5 text-[#C68B3C]" />
                  <h2 className="font-serif text-lg font-bold text-[#1D110C]">
                    Kart Bilgileri
                  </h2>
                </div>

                {paymentError && (
                  <div
                    role="alert"
                    className="rounded-2xl border border-[#9E2A2B]/35 bg-[#9E2A2B]/10 p-3.5 text-xs sm:text-sm font-semibold text-[#9E2A2B] flex items-start gap-2.5"
                  >
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{paymentError}</span>
                  </div>
                )}

                {order.paymentStatus === "FAILED" && !paymentError && (
                  <div
                    role="alert"
                    className="rounded-2xl border border-[#9E2A2B]/35 bg-[#9E2A2B]/10 p-3.5 text-xs sm:text-sm font-semibold text-[#9E2A2B]"
                  >
                    Önceki ödeme denemesi başarısız oldu. Kart bilgilerinizi
                    kontrol ederek tekrar deneyebilirsiniz.
                  </div>
                )}

                <div>
                  <label
                    htmlFor="card-holder"
                    className="block text-xs font-semibold uppercase tracking-wide text-[#5C4338] mb-1.5"
                  >
                    Kart Üzerindeki İsim
                  </label>
                  <input
                    id="card-holder"
                    type="text"
                    required
                    autoComplete="cc-name"
                    placeholder="AD SOYAD"
                    value={cardHolder}
                    onChange={(e) => setCardHolder(e.target.value.toUpperCase())}
                    className="w-full rounded-xl border border-[#DFD2C3] bg-white px-3.5 py-2.5 text-sm text-[#1D110C] focus:outline-none focus:ring-2 focus:ring-[#C68B3C]/40"
                  />
                </div>

                <div>
                  <label
                    htmlFor="card-number"
                    className="block text-xs font-semibold uppercase tracking-wide text-[#5C4338] mb-1.5"
                  >
                    Kart Numarası
                  </label>
                  <input
                    id="card-number"
                    type="text"
                    inputMode="numeric"
                    autoComplete="cc-number"
                    required
                    placeholder="0000 0000 0000 0000"
                    value={cardNumber}
                    onChange={(e) =>
                      setCardNumber(formatCardNumberInput(e.target.value))
                    }
                    className="w-full rounded-xl border border-[#DFD2C3] bg-white px-3.5 py-2.5 text-sm font-mono tracking-wider text-[#1D110C] focus:outline-none focus:ring-2 focus:ring-[#C68B3C]/40"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label
                      htmlFor="card-expiry"
                      className="block text-xs font-semibold uppercase tracking-wide text-[#5C4338] mb-1.5"
                    >
                      Son Kullanma Tarihi
                    </label>
                    <input
                      id="card-expiry"
                      type="text"
                      inputMode="numeric"
                      autoComplete="cc-exp"
                      required
                      placeholder="AA/YY"
                      maxLength={5}
                      value={expiry}
                      onChange={(e) =>
                        setExpiry(formatExpiryInput(e.target.value))
                      }
                      className="w-full rounded-xl border border-[#DFD2C3] bg-white px-3.5 py-2.5 text-sm font-mono text-[#1D110C] focus:outline-none focus:ring-2 focus:ring-[#C68B3C]/40"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="card-cvv"
                      className="block text-xs font-semibold uppercase tracking-wide text-[#5C4338] mb-1.5"
                    >
                      CVV / CVC
                    </label>
                    <input
                      id="card-cvv"
                      type="text"
                      inputMode="numeric"
                      autoComplete="cc-csc"
                      required
                      placeholder="000"
                      maxLength={4}
                      value={cvv}
                      onChange={(e) =>
                        setCvv(e.target.value.replace(/\D/g, "").slice(0, 4))
                      }
                      className="w-full rounded-xl border border-[#DFD2C3] bg-white px-3.5 py-2.5 text-sm font-mono text-[#1D110C] focus:outline-none focus:ring-2 focus:ring-[#C68B3C]/40"
                    />
                  </div>
                </div>

                <div className="pt-2 space-y-2.5">
                  <button
                    type="submit"
                    disabled={processing}
                    className="w-full rounded-xl bg-[#2C1A12] hover:bg-[#1D110C] disabled:opacity-50 text-[#FBF6F0] font-semibold text-sm py-3.5 px-4 flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    <ShieldCheck className="w-4 h-4 text-[#C68B3C]" />
                    PayTR ile Güvenli Öde • {formatTl(order.totalAmount)}
                  </button>

                  <button
                    type="button"
                    disabled={processing}
                    onClick={() => void submitMockPayment(true)}
                    className="w-full rounded-xl border border-[#9E2A2B]/30 bg-white hover:bg-[#9E2A2B]/5 text-[#9E2A2B] font-semibold text-xs py-2.5 px-4 transition-colors cursor-pointer"
                  >
                    Başarısız Ödeme Simüle Et (Test)
                  </button>
                </div>
              </form>
            </>
          )}
        </div>

        {/* Right: Order Summary */}
        <aside className="lg:col-span-2 rounded-3xl border border-[#E6D9CB] bg-[#FFFDF9] p-5 shadow-sm space-y-4">
          <h2 className="font-serif text-lg font-bold text-[#1D110C] pb-2 border-b border-[#EFE6DC]">
            Sipariş Özeti
          </h2>

          <div className="text-xs space-y-1 text-[#5C4338]">
            <p>
              <strong className="text-[#1D110C]">Şube:</strong> {order.branchName}
            </p>
            <p>
              <strong className="text-[#1D110C]">Bölge:</strong>{" "}
              {order.neighborhood}, {order.district} / {order.city}
            </p>
            <p>
              <strong className="text-[#1D110C]">Adres:</strong>{" "}
              {order.fullAddress}
            </p>
            {order.note && (
              <p>
                <strong className="text-[#1D110C]">Not:</strong> {order.note}
              </p>
            )}
          </div>

          <div className="border-t border-[#EFE6DC] pt-3 space-y-2.5">
            {order.items.map((item) => (
              <div
                key={item.id}
                className="flex items-start justify-between gap-2 text-xs"
              >
                <div>
                  <p className="font-semibold text-[#1D110C]">
                    {item.quantity}x {item.productName}
                  </p>
                  {item.selectedOptions.length > 0 && (
                    <p className="text-[11px] text-[#8A6F62]">
                      {item.selectedOptions
                        .map((o) => o.optionItemName)
                        .join(", ")}
                    </p>
                  )}
                </div>
                <span className="font-semibold text-[#1D110C] shrink-0">
                  {formatTl(item.lineTotal)}
                </span>
              </div>
            ))}
          </div>

          <div className="border-t border-[#EFE6DC] pt-3 space-y-1.5 text-sm">
            <div className="flex justify-between text-[#5C4338]">
              <span>Ara Toplam</span>
              <span>{formatTl(order.subtotal)}</span>
            </div>
            <div className="flex justify-between text-[#5C4338]">
              <span>Teslimat Ücreti</span>
              <span>
                {order.deliveryFee === 0
                  ? "Ücretsiz"
                  : formatTl(order.deliveryFee)}
              </span>
            </div>
            <div className="flex justify-between text-base font-bold text-[#1D110C] pt-2 border-t border-[#EFE6DC]">
              <span>Ödenecek Tutar</span>
              <span>{formatTl(order.totalAmount)}</span>
            </div>
          </div>
        </aside>
      </div>

      {/* Step 2: 3D Secure Modal */}
      {show3dsModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="3D Secure Doğrulama"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1D110C]/70 backdrop-blur-xs"
        >
          <div className="w-full max-w-md rounded-3xl bg-[#FFFDF9] border border-[#E6D9CB] shadow-2xl p-6 relative space-y-4">
            <button
              type="button"
              onClick={() => setShow3dsModal(false)}
              aria-label="Kapat"
              className="absolute right-4 top-4 w-8 h-8 rounded-full flex items-center justify-center text-[#6E5245] hover:bg-[#F3EAE0] cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-[#2C1A12] text-[#C68B3C] flex items-center justify-center">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-serif text-lg font-bold text-[#1D110C]">
                  3D Secure Doğrulama
                </h2>
                <p className="text-xs text-[#6E5245]">
                  PayTR Güvenli Ödeme Onayı • {formatTl(order.totalAmount)}
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-[#C68B3C] bg-[#FDF4E7] p-3.5 flex items-center justify-between gap-2">
              <div className="text-xs text-[#7A4F14]">
                <span className="block font-bold">
                  Test 3D Secure Kodu: {TEST_3DS_CODE}
                </span>
                <span className="text-[11px]">
                  Tek tıkla doldurup ödemeyi onaylayabilirsiniz.
                </span>
              </div>
              <button
                type="button"
                onClick={() => setOtp3ds(TEST_3DS_CODE)}
                className="shrink-0 rounded-lg bg-[#C68B3C] hover:bg-[#B0782D] text-white text-xs font-bold px-3 py-1.5 cursor-pointer"
              >
                Kodu Doldur
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                void submitMockPayment(false);
              }}
              className="space-y-3"
            >
              <div>
                <label
                  htmlFor="otp-3ds"
                  className="block text-xs font-semibold uppercase tracking-wide text-[#5C4338] mb-1.5"
                >
                  Banka SMS Doğrulama Kodu
                </label>
                <input
                  id="otp-3ds"
                  type="text"
                  inputMode="numeric"
                  required
                  maxLength={6}
                  placeholder="123456"
                  value={otp3ds}
                  onChange={(e) =>
                    setOtp3ds(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  className="w-full rounded-xl border border-[#DFD2C3] bg-white px-4 py-3 text-center text-lg font-mono tracking-[0.35em] text-[#1D110C] focus:outline-none focus:ring-2 focus:ring-[#C68B3C]/40"
                />
              </div>

              <button
                type="submit"
                disabled={processing || otp3ds.length < 1}
                className="w-full rounded-xl bg-[#C68B3C] hover:bg-[#B0782D] disabled:opacity-50 text-white font-semibold text-sm py-3.5 px-4 flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                {processing ? "Onaylanıyor..." : "Ödemeyi Onayla"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
