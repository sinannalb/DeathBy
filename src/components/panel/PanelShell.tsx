"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  BellRing,
  ExternalLink,
  LogOut,
  Menu,
  SlidersHorizontal,
  Store,
  Tags,
  Users,
  UtensilsCrossed,
  X,
} from "lucide-react";
import { usePanelAuth } from "./PanelAuthContext";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  adminOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/panel", label: "Canlı Siparişler", icon: BellRing },
  { href: "/panel/sube-durumu", label: "Şube Durumu", icon: Store },
  { href: "/panel/menu", label: "Menü & Stok", icon: UtensilsCrossed },
  { href: "/panel/raporlar", label: "Raporlar", icon: BarChart3 },
  {
    href: "/panel/kategoriler",
    label: "Kategoriler",
    icon: Tags,
    adminOnly: true,
  },
  {
    href: "/panel/opsiyonlar",
    label: "Opsiyonlar",
    icon: SlidersHorizontal,
    adminOnly: true,
  },
  {
    href: "/panel/kullanicilar",
    label: "Kullanıcılar",
    icon: Users,
    adminOnly: true,
  },
];

export function PanelShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, logout } = usePanelAuth();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const isBypassRoute =
    pathname === "/panel/giris" || pathname.startsWith("/panel/yazdir");

  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!isBypassRoute && !loading && !user) {
      router.replace("/panel/giris");
    }
  }, [isBypassRoute, loading, user, router]);

  if (isBypassRoute) {
    return <>{children}</>;
  }

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FAF6F0] text-[#3B2318]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-9 w-9 animate-spin rounded-full border-4 border-[#D9A76A] border-t-[#2C1810]" />
          <p className="text-sm font-medium text-[#6B4F41]">
            Operasyon paneli yükleniyor...
          </p>
        </div>
      </div>
    );
  }

  const isAdmin = user.role === "ADMIN";
  const visibleItems = NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin);

  const handleLogout = async () => {
    await logout();
    router.replace("/panel/giris");
  };

  const sidebarContent = (
    <div className="flex h-full flex-col bg-[#120D0C] text-[#FAF6F1]">
      {/* Brand */}
      <div className="border-b border-[#33221D] px-5 py-5">
        <div className="flex items-center gap-3">
          <img
            src="/logo.jpg"
            alt="Death By Chocolate Logo"
            className="h-10 w-10 shrink-0 rounded-full border border-[#D4A048]/70 object-cover shadow-sm bg-black"
          />
          <div className="min-w-0">
            <div className="truncate text-sm font-bold tracking-wide text-[#FAF6F1]">
              DEATH BY CHOCOLATE
            </div>
            <div className="text-xs font-medium text-[#D4A048]">
              Operasyon Paneli
            </div>
          </div>
        </div>
      </div>

      {/* User card */}
      <div className="mx-3 mt-4 rounded-xl border border-[#3E2419] bg-[#2B1810] p-3.5">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-semibold text-white">
            {user.name}
          </span>
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${
              isAdmin
                ? "bg-[#D9A76A] text-[#1F110B]"
                : "bg-emerald-900/80 text-emerald-200 ring-1 ring-emerald-500/40"
            }`}
          >
            {isAdmin ? "Admin" : "Şube Kullanıcısı"}
          </span>
        </div>
        <div className="mt-1.5 flex items-center gap-1.5 text-xs text-[#CDB8AA]">
          <Store className="h-3.5 w-3.5 shrink-0 text-[#D9A76A]" />
          <span className="truncate">
            {isAdmin
              ? "Tüm Şubeler"
              : user.branchName || "Atanmış Şube"}
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="mt-5 flex-1 space-y-1 px-3" aria-label="Panel Menüsü">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.href === "/panel"
              ? pathname === "/panel"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition ${
                isActive
                  ? "bg-[#D9A76A] text-[#1F110B] font-bold shadow-sm"
                  : "text-[#DFCFC1] hover:bg-[#2F1B12] hover:text-white"
              }`}
            >
              <Icon
                className={`h-4 w-4 shrink-0 ${
                  isActive ? "text-[#1F110B]" : "text-[#D9A76A]"
                }`}
              />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer actions */}
      <div className="space-y-1.5 border-t border-[#3A2218] p-3">
        <Link
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between rounded-xl px-3.5 py-2.5 text-xs font-medium text-[#CDB8AA] transition hover:bg-[#2F1B12] hover:text-white"
        >
          <span>Mağaza Vitrinini Aç</span>
          <ExternalLink className="h-3.5 w-3.5" />
        </Link>
        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-rose-300 transition hover:bg-rose-950/50 hover:text-rose-200"
        >
          <LogOut className="h-4 w-4" />
          <span>Çıkış Yap</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#FAF6F0] text-[#24140E] lg:flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:block lg:w-64">
        {sidebarContent}
      </aside>

      {/* Mobile Topbar */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-[#33221D] bg-[#120D0C] px-4 py-3 text-[#FAF6F1] lg:hidden">
        <div className="flex items-center gap-2.5">
          <img
            src="/logo.jpg"
            alt="Death By Chocolate Logo"
            className="h-8 w-8 rounded-full border border-[#D4A048]/70 object-cover bg-black"
          />
          <div>
            <div className="text-xs font-bold tracking-wide">
              DEATH BY CHOCOLATE
            </div>
            <div className="text-[11px] text-[#D4A048]">
              {isAdmin ? "Admin" : user.branchName || "Şube Paneli"}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setMobileNavOpen((prev) => !prev)}
          className="rounded-lg border border-[#3E2419] p-2 text-[#FAF3EA] hover:bg-[#2F1B12]"
          aria-label="Menüyü Aç/Kapat"
        >
          {mobileNavOpen ? (
            <X className="h-5 w-5" />
          ) : (
            <Menu className="h-5 w-5" />
          )}
        </button>
      </header>

      {/* Mobile Drawer */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-40 flex lg:hidden">
          <div className="w-72 max-w-[85vw] shadow-2xl">{sidebarContent}</div>
          <div
            className="flex-1 bg-black/50"
            onClick={() => setMobileNavOpen(false)}
          />
        </div>
      )}

      {/* Main Content */}
      <main className="min-w-0 flex-1 lg:pl-64">
        <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">{children}</div>
      </main>
    </div>
  );
}
