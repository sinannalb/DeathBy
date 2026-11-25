"use client";

import Link from "next/link";
import { ChevronDown, MapPin, ShoppingBag, User } from "lucide-react";
import { useStore } from "./StoreProvider";
import { formatTl } from "./utils";

export function StoreHeader() {
  const {
    hydrated,
    selectedNeighborhood,
    setNeighborhoodModalOpen,
    customer,
    cartCount,
    cartSubtotal,
    setCartDrawerOpen,
  } = useStore();

  return (
    <header className="sticky top-0 z-40 bg-[#120D0C]/95 backdrop-blur-md text-[#FAF6F1] border-b border-[#33221D] shadow-md">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-2 sm:gap-4">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-2.5 shrink-0 group">
          <img
            src="/logo.jpg"
            alt="Death By Chocolate Logo"
            className="w-10 h-10 rounded-full object-cover border border-[#D4A048]/70 shadow-sm shrink-0 bg-black"
          />
          <div className="leading-tight">
            <span className="font-serif font-bold text-sm sm:text-base tracking-tight text-[#FAF6F1] group-hover:text-[#E8BD6D] transition-colors block">
              Death By Chocolate
            </span>
            <span className="text-[10px] uppercase tracking-[0.16em] text-[#D4A048] hidden sm:block">
              Belçika Çikolata Atölyesi
            </span>
          </div>
        </Link>

        {/* Neighborhood Pill */}
        <button
          type="button"
          onClick={() => setNeighborhoodModalOpen(true)}
          className="flex-1 max-w-xs sm:max-w-sm flex items-center justify-between gap-2 rounded-full bg-[#241612] hover:bg-[#321F19] border border-[#472D25] px-3 py-1.5 text-left transition-colors min-w-0 cursor-pointer"
        >
          <div className="flex items-center gap-1.5 min-w-0">
            <MapPin className="w-3.5 h-3.5 text-[#D4A048] shrink-0" />
            <span className="text-xs font-medium text-[#F3E4CE] truncate">
              {hydrated && selectedNeighborhood
                ? `${selectedNeighborhood.neighborhood}, ${selectedNeighborhood.district} • ${selectedNeighborhood.branch.name}`
                : "Mahalle Seçin (İstanbul)"}
            </span>
          </div>
          <ChevronDown className="w-3.5 h-3.5 text-[#D4A048] shrink-0" />
        </button>

        {/* Right Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <Link
            href="/hesabim"
            className="inline-flex items-center gap-1.5 rounded-full border border-[#472D25] bg-[#241612] hover:bg-[#321F19] px-3 py-1.5 text-xs font-semibold text-[#F3E4CE] transition-colors"
          >
            <User className="w-3.5 h-3.5 text-[#D4A048]" />
            <span className="hidden md:inline">
              {customer ? "Hesabım / Siparişlerim" : "Giriş Yap"}
            </span>
            <span className="md:hidden">
              {customer ? "Hesabım" : "Giriş"}
            </span>
          </Link>

          <button
            type="button"
            onClick={() => setCartDrawerOpen(true)}
            aria-label="Sepeti aç"
            className="inline-flex items-center gap-2 rounded-full bg-[#D4A048] hover:bg-[#BE8B34] text-[#120D0C] font-bold text-xs px-3 sm:px-3.5 py-1.5 transition-colors shadow-sm cursor-pointer"
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>{hydrated ? cartCount : 0}</span>
            {hydrated && cartCount > 0 && (
              <span className="hidden sm:inline border-l border-[#120D0C]/20 pl-2">
                {formatTl(cartSubtotal)}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
