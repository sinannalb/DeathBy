"use client";

import { AlertTriangle, CheckCircle2, Store, X } from "lucide-react";
import { useStore } from "./StoreProvider";

export function BranchAdjustmentModal() {
  const { branchAdjustment, dismissBranchAdjustment } = useStore();

  if (!branchAdjustment) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="branch-adjustment-title"
      onClick={dismissBranchAdjustment}
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/65 backdrop-blur-xs p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl border border-[#C68B3C]/40 bg-[#FFFDF9] p-5 sm:p-6 shadow-2xl space-y-4"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <div className="rounded-xl bg-[#FDF4E7] p-2 text-[#B0782D] shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3
                id="branch-adjustment-title"
                className="font-serif text-base sm:text-lg font-bold text-[#1D110C]"
              >
                Şube değişikliği sebebi ile sepetiniz düzenlenmiştir
              </h3>
              <p className="text-xs text-[#6E5245] mt-1 flex items-center gap-1.5 flex-wrap">
                <Store className="w-3.5 h-3.5 text-[#C68B3C] shrink-0" />
                <span>
                  <strong>{branchAdjustment.previousBranchName}</strong> →{" "}
                  <strong>{branchAdjustment.newBranchName}</strong>
                </span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={dismissBranchAdjustment}
            aria-label="Kapat"
            className="rounded-lg p-1 text-[#7A6256] hover:bg-[#F5ECE0] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {branchAdjustment.removedItems.length > 0 && (
          <div className="rounded-xl border border-[#9E2A2B]/25 bg-[#9E2A2B]/5 p-3.5 space-y-1.5">
            <p className="text-xs font-bold text-[#9E2A2B]">
              Yeni şubede temin edilemediği için sepetten çıkarılanlar:
            </p>
            <ul className="list-disc pl-4 space-y-0.5 text-xs text-[#5C4338]">
              {branchAdjustment.removedItems.map((name, idx) => (
                <li key={`${name}-${idx}`}>{name}</li>
              ))}
            </ul>
          </div>
        )}

        {branchAdjustment.keptItems.length > 0 ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3.5 space-y-1">
            <p className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              Sepetinizde kalmaya devam eden ürünler:
            </p>
            <p className="text-xs text-emerald-800">
              {branchAdjustment.keptItems.join(", ")}
            </p>
          </div>
        ) : (
          <p className="text-xs text-[#6E5245]">
            Sepetinizdeki ürünlerin tamamı seçilen şubede şu an temin
            edilemediği için sepetiniz boşaltıldı.
          </p>
        )}

        <button
          type="button"
          onClick={dismissBranchAdjustment}
          className="w-full rounded-xl bg-[#2C1A12] hover:bg-[#1D110C] text-[#FBF6F0] text-sm font-semibold py-2.5 transition-colors cursor-pointer"
        >
          Tamam
        </button>
      </div>
    </div>
  );
}
