"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { useStore } from "./StoreProvider";
import { OtpLoginForm } from "./OtpLoginForm";

export function OtpLoginModal() {
  const { otpModalOpen, setOtpModalOpen } = useStore();

  useEffect(() => {
    if (!otpModalOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOtpModalOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [otpModalOpen, setOtpModalOpen]);

  if (!otpModalOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Müşteri Girişi"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-[#1D110C]/65 backdrop-blur-xs"
      onClick={(e) => {
        if (e.target === e.currentTarget) setOtpModalOpen(false);
      }}
    >
      <div className="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl bg-[#FFFDF9] border border-[#E6D9CB] shadow-2xl p-6 relative animate-in fade-in duration-150">
        <button
          type="button"
          onClick={() => setOtpModalOpen(false)}
          aria-label="Kapat"
          className="absolute right-4 top-4 w-8 h-8 rounded-full flex items-center justify-center text-[#6E5245] hover:bg-[#F3EAE0] cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        <OtpLoginForm
          onSuccess={() => {
            setOtpModalOpen(false);
          }}
        />
      </div>
    </div>
  );
}
