"use client";

import Link from "next/link";
import { ShieldAlert, ArrowLeft } from "lucide-react";

export function UnauthorizedView({
  title = "Yetkiniz Yok",
  description = "Bu sayfa yalnızca Yönetici (Admin) rolüne sahip kullanıcılar içindir. Şube operasyonları için Canlı Siparişler veya Şube Durumu ekranını kullanabilirsiniz.",
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div className="mx-auto max-w-lg py-16 px-4">
      <div className="rounded-2xl border border-[#E5D7C8] bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-rose-100 text-rose-700">
          <ShieldAlert className="h-7 w-7" />
        </div>
        <h1 className="text-xl font-bold text-[#24140E]">{title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-[#6E5549]">
          {description}
        </p>
        <div className="mt-6">
          <Link
            href="/panel"
            className="inline-flex items-center gap-2 rounded-xl bg-[#2C1810] px-5 py-2.5 text-sm font-semibold text-[#FAF3EA] transition hover:bg-[#3F2318]"
          >
            <ArrowLeft className="h-4 w-4" />
            Canlı Siparişlere Dön
          </Link>
        </div>
      </div>
    </div>
  );
}
