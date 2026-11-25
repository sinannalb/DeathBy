"use client";

import { useEffect } from "react";
import { RefreshCw } from "lucide-react";

const RELOAD_FLAG = "dbc_panel_chunk_reloaded";

export default function PanelError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    const message = `${error?.name ?? ""} ${error?.message ?? ""}`;
    const isChunkError =
      message.includes("ChunkLoadError") ||
      message.includes("Loading chunk") ||
      message.includes("Failed to fetch dynamically imported module");

    if (isChunkError && typeof window !== "undefined") {
      const alreadyReloaded = window.sessionStorage.getItem(RELOAD_FLAG);
      if (!alreadyReloaded) {
        window.sessionStorage.setItem(RELOAD_FLAG, "1");
        window.location.reload();
      }
    }
  }, [error]);

  return (
    <div className="min-h-screen bg-[#120D0C] text-[#FAF6F1] flex items-center justify-center p-6">
      <div className="max-w-md w-full rounded-2xl border border-[#33221D] bg-[#1C1210] p-6 text-center space-y-4 shadow-xl">
        <img
          src="/logo.jpg"
          alt="Death By Chocolate"
          className="mx-auto h-14 w-14 rounded-full border border-[#D4A048]/70 object-cover bg-black"
        />
        <h2 className="text-lg font-bold text-[#FAF6F1]">
          Sayfa Güncellemesi Gerekiyor
        </h2>
        <p className="text-xs text-[#D7C6B6] leading-relaxed">
          Panel arayüzü güncellendiği için tarayıcı önbelleğinin yenilenmesi
          gerekiyor. Lütfen sayfayı yenileyin.
        </p>
        <div className="flex items-center justify-center gap-2 pt-1">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-2 rounded-xl bg-[#D4A048] hover:bg-[#BE8B34] text-[#120D0C] px-4 py-2 text-xs font-bold cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Sayfayı Yenile
          </button>
          <button
            type="button"
            onClick={() => reset()}
            className="rounded-xl border border-[#472D25] px-4 py-2 text-xs font-semibold text-[#F3E4CE] hover:bg-[#241612] cursor-pointer"
          >
            Tekrar Dene
          </button>
        </div>
      </div>
    </div>
  );
}
