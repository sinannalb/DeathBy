"use client";

import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import { useStore } from "./StoreProvider";

export function ToastStack() {
  const { toasts, dismissToast } = useStore();

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="fixed top-20 right-4 z-[60] flex flex-col gap-2 max-w-xs w-full pointer-events-none"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`pointer-events-auto rounded-2xl px-4 py-3 shadow-xl border flex items-start gap-2.5 text-xs font-medium backdrop-blur-md ${
            toast.variant === "error"
              ? "bg-[#9E2A2B] text-white border-[#7D2122]"
              : toast.variant === "info"
                ? "bg-[#2C1A12] text-[#FBF6F0] border-[#4A2E21]"
                : "bg-[#1D110C] text-[#FBF6F0] border-[#C68B3C]/60"
          }`}
        >
          {toast.variant === "error" ? (
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-white" />
          ) : toast.variant === "info" ? (
            <Info className="w-4 h-4 shrink-0 mt-0.5 text-[#C68B3C]" />
          ) : (
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-[#C68B3C]" />
          )}
          <span className="flex-1 leading-snug">{toast.text}</span>
          <button
            type="button"
            onClick={() => dismissToast(toast.id)}
            aria-label="Bildirimi kapat"
            className="opacity-70 hover:opacity-100 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
