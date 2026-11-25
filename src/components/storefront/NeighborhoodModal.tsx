"use client";

import { useEffect } from "react";
import { MapPin, X } from "lucide-react";
import { useStore } from "./StoreProvider";
import { NeighborhoodPicker } from "./NeighborhoodPicker";

export function NeighborhoodModal() {
  const { neighborhoodModalOpen, setNeighborhoodModalOpen } = useStore();

  useEffect(() => {
    if (!neighborhoodModalOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setNeighborhoodModalOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [neighborhoodModalOpen, setNeighborhoodModalOpen]);

  if (!neighborhoodModalOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Teslimat Mahallesi Seçimi"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-[#1D110C]/65 backdrop-blur-xs"
      onClick={(e) => {
        if (e.target === e.currentTarget) setNeighborhoodModalOpen(false);
      }}
    >
      <div className="w-full sm:max-w-2xl rounded-t-3xl sm:rounded-3xl bg-[#FFFDF9] border border-[#E6D9CB] shadow-2xl p-5 sm:p-6 relative max-h-[90vh] flex flex-col">
        <button
          type="button"
          onClick={() => setNeighborhoodModalOpen(false)}
          aria-label="Kapat"
          className="absolute right-4 top-4 w-8 h-8 rounded-full flex items-center justify-center text-[#6E5245] hover:bg-[#F3EAE0] cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2.5 pr-8 mb-4">
          <div className="w-9 h-9 rounded-xl bg-[#FDF4E7] border border-[#C68B3C]/30 flex items-center justify-center text-[#C68B3C]">
            <MapPin className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-serif text-lg sm:text-xl font-bold text-[#1D110C]">
              Teslimat Mahallenizi Seçin
            </h2>
            <p className="text-xs text-[#6E5245]">
              Bölgenize en yakın şubemizi ve güncel menüyü otomatik getirelim.
            </p>
          </div>
        </div>

        <NeighborhoodPicker onSelected={() => setNeighborhoodModalOpen(false)} />
      </div>
    </div>
  );
}
