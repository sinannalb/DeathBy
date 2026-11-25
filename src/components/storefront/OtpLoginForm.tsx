"use client";

import { useState } from "react";
import { CheckCircle2, KeyRound, Phone, Sparkles, User } from "lucide-react";
import type { CustomerUserDTO } from "@/lib/types";
import { useStore } from "./StoreProvider";
import { formatPhoneDisplay } from "./utils";

interface OtpLoginFormProps {
  onSuccess?: (user: CustomerUserDTO) => void;
  compact?: boolean;
  title?: string;
  subtitle?: string;
}

export function OtpLoginForm({
  onSuccess,
  compact = false,
  title = "Telefon ile Hızlı Giriş",
  subtitle = "SMS doğrulama kodu ile saniyeler içinde giriş yapın.",
}: OtpLoginFormProps) {
  const { setCustomer, showToast } = useStore();
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phoneInput, setPhoneInput] = useState("");
  const [normalizedPhone, setNormalizedPhone] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [testOtp, setTestOtp] = useState<string | null>(null);
  const [mode, setMode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRequestOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/otp/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phoneInput }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        phone?: string;
        mode?: string;
        testOtp?: string;
        error?: string;
      };
      if (!res.ok || !data.ok) {
        setError(data.error || "Doğrulama kodu gönderilemedi.");
        return;
      }
      setNormalizedPhone(data.phone || phoneInput);
      setMode(data.mode || null);
      setTestOtp(data.testOtp || null);
      setCode("");
      setStep("code");
    } catch {
      setError("Bağlantı hatası. Lütfen tekrar deneyin.");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: normalizedPhone || phoneInput,
          code: code.trim(),
          ...(name.trim().length >= 2 ? { name: name.trim() } : {}),
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        user?: CustomerUserDTO;
        error?: string;
      };
      if (!res.ok || !data.ok || !data.user) {
        setError(data.error || "Doğrulama başarısız.");
        return;
      }
      setCustomer(data.user);
      showToast(`Hoş geldiniz, ${data.user.name}!`, "success");
      onSuccess?.(data.user);
    } catch {
      setError("Bağlantı hatası. Lütfen tekrar deneyin.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={compact ? "space-y-3" : "space-y-4"}>
      <div>
        <h3 className="font-serif text-lg font-bold text-[#1D110C]">
          {title}
        </h3>
        <p className="text-xs sm:text-sm text-[#6E5245] mt-0.5">{subtitle}</p>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-[#9E2A2B]/30 bg-[#9E2A2B]/10 px-3.5 py-2.5 text-xs sm:text-sm text-[#9E2A2B] font-medium"
        >
          {error}
        </div>
      )}

      {step === "phone" ? (
        <form onSubmit={handleRequestOtp} className="space-y-3">
          <div>
            <label
              htmlFor="otp-phone"
              className="block text-xs font-semibold uppercase tracking-wide text-[#5C4338] mb-1.5"
            >
              Cep Telefonu
            </label>
            <div className="relative">
              <Phone className="w-4 h-4 text-[#8A6F62] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="otp-phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                required
                placeholder="05XX XXX XX XX"
                value={phoneInput}
                onChange={(e) => setPhoneInput(e.target.value)}
                className="w-full rounded-xl border border-[#DFD2C3] bg-white pl-10 pr-4 py-2.5 text-sm text-[#1D110C] placeholder:text-[#A89286] focus:outline-none focus:ring-2 focus:ring-[#C68B3C]/40 focus:border-[#C68B3C]"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || phoneInput.replace(/\D/g, "").length < 10}
            className="w-full rounded-xl bg-[#2C1A12] hover:bg-[#1D110C] disabled:opacity-50 disabled:cursor-not-allowed text-[#FBF6F0] font-semibold text-sm py-3 px-4 transition-colors cursor-pointer"
          >
            {loading ? "Kod Gönderiliyor..." : "SMS Doğrulama Kodu Gönder"}
          </button>
        </form>
      ) : (
        <form onSubmit={handleVerifyOtp} className="space-y-3">
          <div className="flex items-center justify-between text-xs text-[#5C4338] bg-[#F5EDE3] rounded-xl px-3.5 py-2">
            <span>
              Numara:{" "}
              <strong className="text-[#1D110C]">
                {formatPhoneDisplay(normalizedPhone)}
              </strong>
            </span>
            <button
              type="button"
              onClick={() => {
                setStep("phone");
                setError(null);
              }}
              className="text-[#9E2A2B] font-semibold hover:underline cursor-pointer"
            >
              Değiştir
            </button>
          </div>

          {mode === "test" && testOtp && (
            <div className="rounded-xl border border-[#C68B3C] bg-gradient-to-r from-[#FDF4E7] to-[#FAF0DC] p-3.5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <Sparkles className="w-4 h-4 text-[#B0782D] shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-bold text-[#7A4F14]">
                      Test Modu — SMS Kodunuz:{" "}
                      <span className="font-mono text-sm tracking-widest bg-white/80 px-1.5 py-0.5 rounded border border-[#C68B3C]/40 text-[#1D110C]">
                        {testOtp}
                      </span>
                    </p>
                    <p className="text-[11px] text-[#8C6226] mt-0.5">
                      Gerçek SMS gönderimi kapalıdır; kodu tek tıkla
                      doldurabilirsiniz.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setCode(testOtp)}
                  className="shrink-0 rounded-lg bg-[#C68B3C] hover:bg-[#B0782D] text-white text-xs font-semibold px-3 py-1.5 transition-colors cursor-pointer"
                >
                  Kodu Otomatik Doldur
                </button>
              </div>
            </div>
          )}

          <div>
            <label
              htmlFor="otp-code"
              className="block text-xs font-semibold uppercase tracking-wide text-[#5C4338] mb-1.5"
            >
              6 Haneli SMS Kodu
            </label>
            <div className="relative">
              <KeyRound className="w-4 h-4 text-[#8A6F62] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="otp-code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                required
                placeholder="••••••"
                value={code}
                onChange={(e) =>
                  setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
                className="w-full rounded-xl border border-[#DFD2C3] bg-white pl-10 pr-4 py-2.5 text-sm font-mono tracking-[0.25em] text-[#1D110C] placeholder:text-[#A89286] focus:outline-none focus:ring-2 focus:ring-[#C68B3C]/40 focus:border-[#C68B3C]"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="otp-name"
              className="block text-xs font-semibold uppercase tracking-wide text-[#5C4338] mb-1.5"
            >
              Ad Soyad{" "}
              <span className="font-normal normal-case text-[#8A6F62]">
                (Yeni üyelik için veya güncelleme)
              </span>
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-[#8A6F62] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="otp-name"
                type="text"
                autoComplete="name"
                placeholder="Örn. Zeynep Kaya"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-xl border border-[#DFD2C3] bg-white pl-10 pr-4 py-2.5 text-sm text-[#1D110C] placeholder:text-[#A89286] focus:outline-none focus:ring-2 focus:ring-[#C68B3C]/40 focus:border-[#C68B3C]"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              type="submit"
              disabled={loading || code.length !== 6}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-[#C68B3C] hover:bg-[#B0782D] disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm py-3 px-4 transition-colors cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              {loading ? "Doğrulanıyor..." : "Doğrula ve Giriş Yap"}
            </button>
          </div>

          <button
            type="button"
            disabled={loading}
            onClick={handleRequestOtp}
            className="w-full text-center text-xs text-[#6E5245] hover:text-[#1D110C] underline py-1 cursor-pointer"
          >
            Kodu tekrar gönder
          </button>
        </form>
      )}
    </div>
  );
}
