"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  Mail,
  ShieldCheck,
  Store,
} from "lucide-react";
import { usePanelAuth } from "@/components/panel/PanelAuthContext";
import { apiFetch } from "@/components/panel/panel-utils";
import type { PanelUserDTO } from "@/lib/types";

interface DemoAccount {
  label: string;
  badge: string;
  email: string;
  password: string;
  role: "ADMIN" | "SYSTEM";
}

const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    label: "Admin (Tüm Yetkiler)",
    badge: "ADMIN",
    email: "admin@deathbychocolate.com",
    password: "Admin123!",
    role: "ADMIN",
  },
  {
    label: "Beşiktaş Şubesi (Kurye Açık • 80mm)",
    badge: "SYSTEM • 80mm",
    email: "besiktas@deathbychocolate.com",
    password: "Sube123!",
    role: "SYSTEM",
  },
  {
    label: "Kağıthane Şubesi (Takeaway • 58mm)",
    badge: "SYSTEM • 58mm",
    email: "kagithane@deathbychocolate.com",
    password: "Sube123!",
    role: "SYSTEM",
  },
  {
    label: "Rumelihisarı Şubesi (Takeaway • 58mm)",
    badge: "SYSTEM • 58mm",
    email: "rumelihisari@deathbychocolate.com",
    password: "Sube123!",
    role: "SYSTEM",
  },
];

export default function PanelLoginPage() {
  const router = useRouter();
  const { user, setUser, refreshUser } = usePanelAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const performLogin = async (loginEmail: string, loginPassword: string) => {
    setError(null);
    setSubmitting(true);
    try {
      const data = await apiFetch<{ ok: boolean; user: PanelUserDTO }>(
        "/api/panel/auth/login",
        {
          method: "POST",
          body: JSON.stringify({
            email: loginEmail.trim(),
            password: loginPassword,
          }),
        },
      );
      setUser(data.user);
      await refreshUser();
      router.replace("/panel");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Giriş yapılırken bir hata oluştu.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await performLogin(email, password);
  };

  const handleQuickLogin = async (account: DemoAccount) => {
    setEmail(account.email);
    setPassword(account.password);
    await performLogin(account.email, account.password);
  };

  return (
    <div className="min-h-screen bg-[#120D0C] text-[#FAF6F1] flex flex-col justify-center px-4 py-10">
      <div className="mx-auto w-full max-w-md space-y-6">
        {/* Header Brand */}
        <div className="text-center">
          <img
            src="/logo.jpg"
            alt="Death By Chocolate Logo"
            className="mx-auto mb-3 h-16 w-16 rounded-full border-2 border-[#D4A048]/80 object-cover shadow-lg bg-black"
          />
          <h1 className="text-2xl font-bold tracking-wide text-[#FAF6F1]">
            DEATH BY CHOCOLATE
          </h1>
          <p className="mt-1 text-sm font-medium text-[#D4A048]">
            Yönetim &amp; Şube Operasyon Paneli
          </p>
        </div>

        {/* Already logged-in notice */}
        {user && (
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-[#4A2D20] bg-[#28160F] px-4 py-3 text-xs">
            <div className="min-w-0">
              <p className="font-semibold text-[#FAF3EA] truncate">
                Açık Oturum: {user.name}
              </p>
              <p className="text-[#C7B1A2]">
                {user.role === "ADMIN"
                  ? "Admin (Tüm Şubeler)"
                  : `${user.branchName ?? "Şube"} Kullanıcısı`}
              </p>
            </div>
            <Link
              href="/panel"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-[#D9A76A] px-3 py-1.5 font-bold text-[#1A0E09] hover:bg-[#E4B77E]"
            >
              Panele Git
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        )}

        {/* Login Card */}
        <div className="rounded-2xl border border-[#E5D7C8] bg-[#FAF6F0] p-6 text-[#24140E] shadow-2xl sm:p-7">
          <h2 className="text-lg font-bold text-[#24140E]">Panel Girişi</h2>
          <p className="mt-1 text-xs text-[#6E5549]">
            Sipariş takibi, termal fiş yazdırma ve şube ayarları için giriş
            yapın.
          </p>

          {error && (
            <div
              role="alert"
              className="mt-4 rounded-xl border border-rose-300 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-800"
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <div>
              <label
                htmlFor="panel-email"
                className="block text-xs font-semibold text-[#4A3429]"
              >
                E-posta Adresi
              </label>
              <div className="relative mt-1.5">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8C7062]" />
                <input
                  id="panel-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ornek@deathbychocolate.com"
                  className="w-full rounded-xl border border-[#DAC8B8] bg-white py-2.5 pl-9 pr-3 text-sm text-[#24140E] placeholder:text-[#A89284] focus:border-[#2C1810] focus:outline-none focus:ring-2 focus:ring-[#D9A76A]/40"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="panel-password"
                className="block text-xs font-semibold text-[#4A3429]"
              >
                Şifre
              </label>
              <div className="relative mt-1.5">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8C7062]" />
                <input
                  id="panel-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-[#DAC8B8] bg-white py-2.5 pl-9 pr-10 text-sm text-[#24140E] placeholder:text-[#A89284] focus:border-[#2C1810] focus:outline-none focus:ring-2 focus:ring-[#D9A76A]/40"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-[#7A6256] hover:bg-[#EFE5DA]"
                  aria-label={showPassword ? "Şifreyi gizle" : "Şifreyi göster"}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#2C1810] px-4 py-3 text-sm font-bold text-[#FAF3EA] shadow-sm transition hover:bg-[#3F2419] disabled:opacity-60"
            >
              {submitting ? "Giriş Yapılıyor..." : "Giriş Yap"}
            </button>
          </form>

          {/* Demo Test Accounts Box */}
          <div className="mt-6 rounded-xl border border-[#DFCFC0] bg-white p-4">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#5C3D2E]">
              <KeyRound className="h-3.5 w-3.5 text-[#B47D3B]" />
              <span>Demo Test Hesapları (Hızlı Giriş)</span>
            </div>
            <p className="mt-1 text-[11px] text-[#7A6256]">
              Test etmek için bir hesaba tıklayın; bilgiler doldurulup giriş
              yapılır.
            </p>
            <div className="mt-3 space-y-2">
              {DEMO_ACCOUNTS.map((acc) => (
                <button
                  key={acc.email}
                  type="button"
                  disabled={submitting}
                  onClick={() => void handleQuickLogin(acc)}
                  className="flex w-full items-center justify-between gap-2 rounded-xl border border-[#EAE0D5] bg-[#FAF6F0] px-3 py-2.5 text-left transition hover:border-[#C89B63] hover:bg-[#F5ECE0] disabled:opacity-60"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-[#24140E]">
                      {acc.role === "ADMIN" ? (
                        <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-[#B47D3B]" />
                      ) : (
                        <Store className="h-3.5 w-3.5 shrink-0 text-emerald-700" />
                      )}
                      <span className="truncate">{acc.label}</span>
                    </div>
                    <div className="mt-0.5 truncate font-mono text-[11px] text-[#6E5549]">
                      {acc.email} / {acc.password}
                    </div>
                  </div>
                  <span className="shrink-0 rounded-lg bg-[#2C1810] px-2.5 py-1 text-[11px] font-semibold text-[#FAF3EA]">
                    Giriş
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="text-center">
          <Link
            href="/"
            className="text-xs font-medium text-[#C7B1A2] underline-offset-4 hover:text-[#FAF3EA] hover:underline"
          >
            Mağaza Vitrini Sayfasına Dön
          </Link>
        </div>
      </div>
    </div>
  );
}
