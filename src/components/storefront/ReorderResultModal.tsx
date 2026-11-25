"use client";

import Link from "next/link";
import { AlertTriangle, CheckCircle2, ShoppingBag, X } from "lucide-react";
import type { ReorderUnavailableItemDTO } from "@/lib/types";
import { useStore } from "./StoreProvider";

interface ReorderResultModalProps {
  open: boolean;
  addedCount: number;
  unavailableItems: ReorderUnavailableItemDTO[];
  onClose: () => void;
}

export function ReorderResultModal({
  open,
  addedCount,
  unavailableItems,
  onClose,
}: ReorderResultModalProps) {
  const { setCartDrawerOpen } = useStore();

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Sipariş Tekrarlama Sonucu"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1D110C]/65 backdrop-blur-xs"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-3xl bg-[#FFFDF9] border border-[#E6D9CB] shadow-2xl p-6 relative space-y-4">
        <button
          type="button"
          onClick={onClose}
          aria-label="Kapat"
          className="absolute right-4 top-4 w-8 h-8 rounded-full flex items-center justify-center text-[#6E5245] hover:bg-[#F3EAE0] cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {addedCount > 0 ? (
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-serif text-lg font-bold text-[#1D110C]">
                {addedCount} Ürün Sepete Eklendi
              </h2>
              <p className="text-xs text-[#6E5245] mt-0.5">
                Siparişinizdeki mevcut ürünler sepetinize aktarıldı.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#9E2A2B]/15 text-[#9E2A2B] flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-serif text-lg font-bold text-[#1D110C]">
                Ürünler Eklenemedi
              </h2>
              <p className="text-xs text-[#6E5245] mt-0.5">
                Bu siparişteki ürünler şu anda sepete eklenemiyor.
              </p>
            </div>
          </div>
        )}

        {unavailableItems.length > 0 && (
          <div
            role="alert"
            className="rounded-2xl border border-[#9E2A2B]/30 bg-[#9E2A2B]/10 p-4 space-y-2"
          >
            <p className="text-xs font-bold text-[#9E2A2B] flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              Eklenemeyen Ürünler ({unavailableItems.length})
            </p>
            <ul className="space-y-1.5 text-xs text-[#7D2122]">
              {unavailableItems.map((item, idx) => (
                <li key={`${item.productName}-${idx}`} className="leading-snug">
                  <strong>{item.productName}</strong> — {item.reason}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2.5 pt-1">
          {addedCount > 0 && (
            <button
              type="button"
              onClick={() => {
                onClose();
                setCartDrawerOpen(true);
              }}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-[#C68B3C] hover:bg-[#B0782D] text-white font-semibold text-xs sm:text-sm py-3 px-4 cursor-pointer"
            >
              <ShoppingBag className="w-4 h-4" />
              Sepeti Aç
            </button>
          )}
          <Link
            href="/"
            onClick={onClose}
            className="flex-1 text-center rounded-xl border border-[#DFD2C3] bg-[#FBF6F0] hover:bg-[#EFE6DC] text-[#1D110C] font-semibold text-xs sm:text-sm py-3 px-4"
          >
            Menüye Git
          </Link>
        </div>
      </div>
    </div>
  );
}
