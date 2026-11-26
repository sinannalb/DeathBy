"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Coffee,
  Flame,
  MapPin,
  Plus,
  Search,
  ShoppingBag,
  Sparkles,
  Store,
  UtensilsCrossed,
  X,
  ZoomIn,
} from "lucide-react";
import type {
  BranchSummaryDTO,
  MenuCategoryDTO,
  MenuProductDTO,
} from "@/lib/types";
import { NeighborhoodPicker } from "./NeighborhoodPicker";
import { ProductImage } from "./ProductImage";
import { ProductOptionModal } from "./ProductOptionModal";
import { useStore } from "./StoreProvider";
import { formatTl, normalizeTrText } from "./utils";

type RootTab = "ALL" | "FOOD" | "DRINK";

export function MenuBrowser() {
  const {
    hydrated,
    selectedNeighborhood,
    outOfServiceMessage,
    branches,
    neighborhoodsLoading,
    setNeighborhoodModalOpen,
    addToCart,
    cart,
    cartCount,
    cartSubtotal,
    setCartDrawerOpen,
    showToast,
  } = useStore();

  const [menuBranch, setMenuBranch] = useState<BranchSummaryDTO | null>(null);
  const [categories, setCategories] = useState<MenuCategoryDTO[]>([]);
  const [menuLoading, setMenuLoading] = useState(true);
  const [menuError, setMenuError] = useState<string | null>(null);

  const [rootTab, setRootTab] = useState<RootTab>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategoryId, setActiveCategoryId] = useState<string>("");
  const [optionProduct, setOptionProduct] = useState<MenuProductDTO | null>(
    null,
  );
  const [lightboxProduct, setLightboxProduct] = useState<MenuProductDTO | null>(
    null,
  );
  const [showInlinePicker, setShowInlinePicker] = useState(true);

  useEffect(() => {
    if (!lightboxProduct) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightboxProduct(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [lightboxProduct]);

  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  // Determine which branchId to fetch menu for (selected neighborhood's branch, or first active branch for read-only preview)
  const targetBranchId =
    selectedNeighborhood?.branch.id || branches[0]?.id || null;

  useEffect(() => {
    if (!targetBranchId) {
      if (!neighborhoodsLoading) setMenuLoading(false);
      return;
    }

    let cancelled = false;
    setMenuLoading(true);
    setMenuError(null);

    fetch(`/api/menu?branchId=${encodeURIComponent(targetBranchId)}`, {
      cache: "no-store",
    })
      .then(async (res) => {
        if (!res.ok) throw new Error("Menü yüklenemedi.");
        return (await res.json()) as {
          branch: BranchSummaryDTO;
          categories: MenuCategoryDTO[];
        };
      })
      .then((data) => {
        if (cancelled) return;
        setMenuBranch(data.branch);
        const nonEmpty = (data.categories ?? []).filter(
          (c) => c.products.length > 0,
        );
        setCategories(nonEmpty);
        if (nonEmpty[0]) {
          setActiveCategoryId(nonEmpty[0].id);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setMenuError(
          err instanceof Error ? err.message : "Menü yüklenirken hata oluştu.",
        );
      })
      .finally(() => {
        if (!cancelled) setMenuLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [targetBranchId, neighborhoodsLoading]);

  // Product quantities currently in cart for quick visual badge
  const cartQtyByProduct = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of cart) {
      map.set(item.productId, (map.get(item.productId) ?? 0) + item.quantity);
    }
    return map;
  }, [cart]);

  const filteredCategories = useMemo(() => {
    const q = normalizeTrText(searchQuery);
    return categories
      .filter((cat) => rootTab === "ALL" || cat.rootGroup === rootTab)
      .map((cat) => {
        if (!q) return cat;
        const catMatches = normalizeTrText(cat.name).includes(q);
        const products = catMatches
          ? cat.products
          : cat.products.filter(
              (p) =>
                normalizeTrText(p.name).includes(q) ||
                normalizeTrText(p.description).includes(q),
            );
        return { ...cat, products };
      })
      .filter((cat) => cat.products.length > 0);
  }, [categories, rootTab, searchQuery]);

  const effectiveBranch = selectedNeighborhood?.branch ?? menuBranch;
  const branchStatus = effectiveBranch?.status;

  function scrollToCategory(categoryId: string) {
    setActiveCategoryId(categoryId);
    const el = sectionRefs.current[categoryId];
    if (el) {
      const y = el.getBoundingClientRect().top + window.scrollY - 135;
      window.scrollTo({ top: Math.max(0, y), behavior: "smooth" });
    }
  }

  function handleProductAction(product: MenuProductDTO) {
    if (!selectedNeighborhood || outOfServiceMessage) {
      setNeighborhoodModalOpen(true);
      return;
    }
    if (!branchStatus?.canAcceptOrders || !product.branchAvailable) {
      return;
    }

    if (product.optionGroups.length > 0) {
      setOptionProduct(product);
      return;
    }

    addToCart({
      productId: product.id,
      productName: product.name,
      basePrice: product.price,
      unitPrice: product.price,
      quantity: 1,
      imageUrl: product.imageUrl,
      selectedOptionItemIds: [],
      selectedOptions: [],
    });
    showToast(`${product.name} sepete eklendi.`, "success");
  }

  return (
    <div className="pb-28">
      {/* Hero & Neighborhood Selection Section */}
      <section className="bg-gradient-to-b from-[#120D0C] via-[#1C1210] to-[#241612] text-[#FAF6F1] border-b border-[#33221D]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-7 sm:py-10">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-2.5 max-w-2xl">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-[#6B4E71]/25 border border-[#D4A048]/40 px-3 py-1 text-[11px] font-semibold text-[#F0D298]">
                <Sparkles className="w-3.5 h-3.5 text-[#D4A048]" />
                Sıcak Belçika Çikolatası &amp; Artisan Patisserie
              </div>
              <h1 className="font-serif text-2xl sm:text-4xl font-bold tracking-tight text-[#FFFDF9]">
                Eriyen Belçika Çikolatası,{" "}
                <span className="text-[#D4A048]">Dakikalar İçinde Kapında.</span>
              </h1>
              <p className="text-xs sm:text-sm text-[#D7C6B6] leading-relaxed">
                Özel reçeteli çıtır hamurlar, yoğun çikolata sosları ve taze
                kavrulmuş kahvelerimizi şubenizden hemen sipariş verin.
              </p>

              {/* Active Branches Courier / Takeaway Strip */}
              {branches.length > 0 && (
                <div className="pt-1.5 flex flex-wrap gap-2">
                  {branches.map((b) => (
                    <span
                      key={b.id}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${
                        b.courierEnabled
                          ? "border-emerald-500/40 bg-emerald-950/50 text-emerald-200"
                          : "border-[#6B4E71]/50 bg-[#2C1E2B]/70 text-[#E5D4EA]"
                      }`}
                    >
                      <Store className="w-3 h-3 shrink-0" />
                      <span>{b.name}:</span>
                      <strong className="font-semibold">
                        {b.courierEnabled ? "Kurye Açık" : "Sadece Takeaway"}
                      </strong>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Active Branch Summary Card OR Prompt */}
            {hydrated && selectedNeighborhood && !outOfServiceMessage ? (
              <div className="w-full lg:w-auto lg:min-w-[340px] rounded-2xl bg-[#FFFDF9] text-[#120D0C] p-4 shadow-lg border border-[#E6D9CB]">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#B6822E]">
                      <Store className="w-3.5 h-3.5" />
                      <span>Atanan Şube</span>
                    </div>
                    <h2 className="font-serif font-bold text-base text-[#120D0C] truncate">
                      {selectedNeighborhood.branch.name}
                    </h2>
                    <p className="text-xs text-[#6E5245] flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-[#D4A048] shrink-0" />
                      <span className="truncate">
                        {selectedNeighborhood.neighborhood},{" "}
                        {selectedNeighborhood.district}
                      </span>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setNeighborhoodModalOpen(true)}
                    className="shrink-0 rounded-xl border border-[#DFD2C3] bg-[#FAF6F1] hover:bg-[#F2E7DA] px-3 py-1.5 text-xs font-semibold text-[#241612] transition-colors cursor-pointer"
                  >
                    Değiştir
                  </button>
                </div>

                <div className="mt-3 pt-3 border-t border-[#EFE6DC] grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-xl bg-[#FAF6F1] px-2 py-1.5">
                    <span className="block text-[10px] text-[#8A6F62]">
                      Tahmini Süre
                    </span>
                    <span className="text-xs font-bold text-[#120D0C]">
                      {selectedNeighborhood.branch.status.estimatedMinMinutes}-
                      {selectedNeighborhood.branch.status.estimatedMaxMinutes}{" "}
                      dk
                    </span>
                  </div>
                  <div className="rounded-xl bg-[#FAF6F1] px-2 py-1.5">
                    <span className="block text-[10px] text-[#8A6F62]">
                      Min. Sepet
                    </span>
                    <span className="text-xs font-bold text-[#120D0C]">
                      {formatTl(selectedNeighborhood.minOrderAmount)}
                    </span>
                  </div>
                  <div className="rounded-xl bg-[#FAF6F1] px-2 py-1.5">
                    <span className="block text-[10px] text-[#8A6F62]">
                      Teslimat
                    </span>
                    <span className="text-xs font-bold text-[#120D0C]">
                      {selectedNeighborhood.deliveryFee === 0
                        ? "Ücretsiz"
                        : formatTl(selectedNeighborhood.deliveryFee)}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="w-full lg:w-auto lg:min-w-[320px] rounded-2xl bg-[#D4A048] text-[#120D0C] p-4 shadow-lg">
                <p className="text-xs font-bold uppercase tracking-wider text-[#241612]">
                  Siparişe Başlamak İçin
                </p>
                <p className="font-serif text-lg font-bold mt-0.5">
                  Teslimat Mahallenizi Seçin
                </p>
                <p className="text-xs text-[#241612]/85 mt-1">
                  Size en yakın kurye şubesini, teslimat süresini ve stok durumunu
                  görelim.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setShowInlinePicker((v) => !v)}
                    className="rounded-xl bg-[#120D0C] hover:bg-[#241612] text-[#FAF6F1] text-xs font-semibold px-4 py-2 transition-colors cursor-pointer"
                  >
                    {showInlinePicker ? "Seçiciyi Gizle" : "Mahalle Seç"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setNeighborhoodModalOpen(true)}
                    className="rounded-xl bg-white/85 hover:bg-white text-[#120D0C] text-xs font-semibold px-3 py-2 transition-colors cursor-pointer"
                  >
                    Tüm Liste
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 mt-5 space-y-5">
        {/* Inline Neighborhood Selector when not chosen yet or out of service */}
        {hydrated &&
          (Boolean(outOfServiceMessage) ||
            (!selectedNeighborhood && showInlinePicker)) && (
          <section className="rounded-3xl border border-[#DFD2C3] bg-[#FFFDF9] p-4 sm:p-6 shadow-sm">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#FDF4E7] border border-[#C68B3C]/30 flex items-center justify-center text-[#C68B3C]">
                  <MapPin className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-serif text-lg font-bold text-[#1D110C]">
                    Teslimat Mahallenizi Seçin
                  </h2>
                  <p className="text-xs text-[#6E5245]">
                    Sipariş verebilmek için hizmet verdiğimiz mahallelerden
                    birini seçiniz.
                  </p>
                </div>
              </div>
            </div>

            <NeighborhoodPicker
              compact
              onSelected={() => setShowInlinePicker(false)}
            />
          </section>
        )}

        {/* Branch Status Banners */}
        {hydrated && selectedNeighborhood && !outOfServiceMessage && branchStatus && (
          <>
            {branchStatus.effectiveStatus === "BUSY" && (
              <div
                role="status"
                className="rounded-2xl border border-amber-300 bg-amber-50 p-4 flex items-start gap-3 text-amber-950 shadow-xs"
              >
                <Flame className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-xs sm:text-sm">
                  <p className="font-bold">
                    {selectedNeighborhood.branch.name} — Yoğunluk Uyarısı
                  </p>
                  <p className="mt-0.5 text-amber-900">
                    {selectedNeighborhood.branch.busyMessage ||
                      branchStatus.reason}{" "}
                    Tahmini teslimat süresi:{" "}
                    <strong>
                      {branchStatus.estimatedMinMinutes}-
                      {branchStatus.estimatedMaxMinutes} dk
                    </strong>
                    . Sipariş vermeye devam edebilirsiniz.
                  </p>
                </div>
              </div>
            )}

            {branchStatus.effectiveStatus === "CLOSED" && (
              <div
                role="alert"
                className="rounded-2xl border border-[#9E2A2B]/40 bg-[#9E2A2B]/10 p-4 flex items-start gap-3 text-[#9E2A2B] shadow-xs"
              >
                <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                <div className="text-xs sm:text-sm">
                  <p className="font-bold">
                    Şube Şu An Kapalı — {selectedNeighborhood.branch.name}
                  </p>
                  <p className="mt-0.5 text-[#7D2122]">
                    {branchStatus.reason}
                    {branchStatus.nextOpenText
                      ? ` (${branchStatus.nextOpenText})`
                      : ""}
                  </p>
                </div>
              </div>
            )}

            {branchStatus.effectiveStatus === "OPEN" && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs text-emerald-900">
                <span className="inline-flex items-center gap-1.5 font-semibold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  {selectedNeighborhood.branch.name} şu an açık ve sipariş
                  alıyor
                </span>
                <span className="inline-flex items-center gap-1 text-emerald-800">
                  <Clock className="w-3.5 h-3.5" />
                  Ortalama {branchStatus.estimatedMinMinutes}-
                  {branchStatus.estimatedMaxMinutes} dakika teslimat
                </span>
              </div>
            )}
          </>
        )}

        {/* Sticky Filter & Category Bar */}
        <div className="sticky top-16 z-30 bg-[#FBF6F0]/95 backdrop-blur-md pt-3 pb-3 -mx-4 px-4 sm:-mx-6 sm:px-6 border-b border-[#EAE0D5] space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Root Group Tabs */}
            <div
              role="tablist"
              aria-label="Menü grubu"
              className="inline-flex rounded-2xl bg-[#EFE6DC] p-1 self-start"
            >
              {[
                { id: "ALL" as RootTab, label: "Tümü", icon: null },
                {
                  id: "FOOD" as RootTab,
                  label: "Tatlı & Fırın",
                  icon: UtensilsCrossed,
                },
                { id: "DRINK" as RootTab, label: "İçecekler", icon: Coffee },
              ].map((tab) => {
                const Icon = tab.icon;
                const active = rootTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setRootTab(tab.id)}
                    className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                      active
                        ? "bg-[#2C1A12] text-[#FBF6F0] shadow-xs"
                        : "text-[#5C4338] hover:text-[#1D110C]"
                    }`}
                  >
                    {Icon && <Icon className="w-3.5 h-3.5" />}
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Search */}
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-[#8A6F62] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Ürün ara..."
                className="w-full rounded-xl border border-[#DFD2C3] bg-[#FFFDF9] pl-9 pr-3 py-2 text-xs sm:text-sm text-[#1D110C] placeholder:text-[#A89286] focus:outline-none focus:ring-2 focus:ring-[#C68B3C]/40"
              />
            </div>
          </div>

          {/* Horizontal Category Pills */}
          {filteredCategories.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {filteredCategories.map((cat) => {
                const isActive = activeCategoryId === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => scrollToCategory(cat.id)}
                    className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold border transition-all cursor-pointer ${
                      isActive
                        ? "bg-[#C68B3C] text-white border-[#C68B3C] shadow-xs"
                        : "bg-[#FFFDF9] text-[#5C4338] border-[#E6D9CB] hover:border-[#C68B3C]/60"
                    }`}
                  >
                    {cat.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Menu Content */}
        {menuLoading ? (
          <div className="space-y-6 py-4">
            <div className="h-6 w-48 rounded-lg bg-[#EFE6DC] animate-pulse" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <div
                  key={n}
                  className="h-36 rounded-2xl bg-[#EFE6DC] animate-pulse"
                />
              ))}
            </div>
          </div>
        ) : menuError ? (
          <div className="rounded-2xl border border-[#9E2A2B]/30 bg-[#9E2A2B]/10 p-6 text-center text-sm text-[#9E2A2B]">
            {menuError}
          </div>
        ) : filteredCategories.length === 0 ? (
          <div className="rounded-3xl border border-[#E6D9CB] bg-[#FFFDF9] p-10 text-center">
            <p className="font-serif text-lg font-bold text-[#1D110C]">
              Aradığınız lezzet bulunamadı
            </p>
            <p className="text-xs text-[#6E5245] mt-1">
              Farklı bir arama kelimesi deneyebilir veya filtreyi
              temizleyebilirsiniz.
            </p>
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setRootTab("ALL");
                }}
                className="mt-4 rounded-xl bg-[#2C1A12] text-[#FBF6F0] text-xs font-semibold px-4 py-2 cursor-pointer"
              >
                Filtreleri Temizle
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-10">
            {filteredCategories.map((category, catIdx) => (
              <section
                key={category.id}
                ref={(el) => {
                  sectionRefs.current[category.id] = el;
                }}
                className="space-y-4 scroll-mt-36"
              >
                <div className="flex items-baseline justify-between border-b border-[#EAE0D5] pb-2">
                  <h2 className="font-serif text-xl sm:text-2xl font-bold text-[#1D110C]">
                    {category.name}
                  </h2>
                  <span className="text-xs font-medium text-[#8A6F62]">
                    {category.products.length} ürün
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {category.products.map((product, prodIdx) => {
                    const soldOut = !product.branchAvailable;
                    const inCartQty = cartQtyByProduct.get(product.id) ?? 0;
                    const disabled =
                      soldOut ||
                      !selectedNeighborhood ||
                      Boolean(outOfServiceMessage) ||
                      branchStatus?.canAcceptOrders === false;

                    let buttonLabel = "Sepete Ekle";
                    if (soldOut) buttonLabel = "Şubede Tükendi";
                    else if (!selectedNeighborhood || outOfServiceMessage)
                      buttonLabel = "Mahalle Seçin";
                    else if (branchStatus?.canAcceptOrders === false)
                      buttonLabel = "Şube Kapalı";

                    return (
                      <article
                        key={product.id}
                        className={`rounded-2xl border bg-[#FFFDF9] p-3.5 flex gap-3.5 transition-all ${
                          soldOut
                            ? "border-[#E6D9CB] opacity-65 grayscale-[40%]"
                            : "border-[#E6D9CB] hover:border-[#C68B3C]/70 hover:shadow-md"
                        }`}
                      >
                        {/* Thumbnail */}
                        {product.imageUrl ? (
                          <button
                            type="button"
                            onClick={() => setLightboxProduct(product)}
                            aria-label={`${product.name} görselini büyük görüntüle`}
                            className="group relative w-24 h-24 sm:w-28 sm:h-28 rounded-xl overflow-hidden shrink-0 border border-[#EFE6DC] bg-[#2C1A12] cursor-zoom-in focus:outline-none focus:ring-2 focus:ring-[#C68B3C]"
                          >
                            <ProductImage
                              src={product.imageUrl}
                              alt={product.name}
                              priority={catIdx === 0 && prodIdx < 3}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                            />
                            {inCartQty > 0 && (
                              <span className="absolute top-1.5 left-1.5 rounded-full bg-[#C68B3C] text-white text-[10px] font-bold px-2 py-0.5 shadow-sm">
                                {inCartQty}x
                              </span>
                            )}
                            <span className="absolute bottom-1.5 right-1.5 rounded-full bg-black/55 p-1 text-white opacity-85 group-hover:opacity-100 transition-opacity">
                              <ZoomIn className="w-3 h-3" />
                            </span>
                          </button>
                        ) : (
                          <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-xl overflow-hidden shrink-0 border border-[#EFE6DC] bg-[#2C1A12]">
                            <ProductImage
                              src={product.imageUrl}
                              alt={product.name}
                              priority={catIdx === 0 && prodIdx < 3}
                            />
                            {inCartQty > 0 && (
                              <span className="absolute top-1.5 left-1.5 rounded-full bg-[#C68B3C] text-white text-[10px] font-bold px-2 py-0.5 shadow-sm">
                                {inCartQty}x
                              </span>
                            )}
                          </div>
                        )}

                        {/* Info */}
                        <div className="flex-1 min-w-0 flex flex-col justify-between">
                          <div>
                            <div className="flex items-start justify-between gap-2">
                              <h3 className="font-semibold text-sm sm:text-base text-[#1D110C] leading-snug">
                                {product.name}
                              </h3>
                            </div>

                            {soldOut && (
                              <span className="inline-block mt-1 rounded-full bg-[#9E2A2B]/15 text-[#9E2A2B] text-[10px] font-bold px-2 py-0.5">
                                Şubede Tükendi
                              </span>
                            )}

                            {product.description && (
                              <p className="text-xs text-[#6E5245] mt-1 line-clamp-2 leading-relaxed">
                                {product.description}
                              </p>
                            )}
                          </div>

                          <div className="mt-3 flex items-center justify-between gap-2">
                            <span className="text-sm sm:text-base font-bold text-[#2C1A12]">
                              {formatTl(product.price)}
                            </span>

                            <button
                              type="button"
                              disabled={
                                soldOut ||
                                (Boolean(selectedNeighborhood) &&
                                  !outOfServiceMessage &&
                                  branchStatus?.canAcceptOrders === false)
                              }
                              onClick={() => handleProductAction(product)}
                              className={`inline-flex items-center gap-1 rounded-xl px-3 py-2 text-xs font-semibold transition-colors ${
                                disabled
                                  ? "bg-[#EFE6DC] text-[#8A6F62] cursor-not-allowed"
                                  : "bg-[#2C1A12] hover:bg-[#1D110C] text-[#FBF6F0] cursor-pointer shadow-xs"
                              }`}
                            >
                              {!disabled && (
                                <Plus className="w-3.5 h-3.5 text-[#C68B3C]" />
                              )}
                              <span>{buttonLabel}</span>
                            </button>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>

      {/* Sticky Bottom Cart Bar */}
      {hydrated && cartCount > 0 && (
        <div className="fixed bottom-4 inset-x-0 z-40 px-4 pointer-events-none">
          <div className="max-w-xl mx-auto pointer-events-auto">
            <button
              type="button"
              onClick={() => setCartDrawerOpen(true)}
              className="w-full rounded-2xl bg-[#1D110C] hover:bg-[#2C1A12] text-[#FBF6F0] border border-[#C68B3C]/50 shadow-2xl px-5 py-3.5 flex items-center justify-between transition-transform active:scale-[0.99] cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#C68B3C] text-[#1D110C] flex items-center justify-center font-bold">
                  <ShoppingBag className="w-4 h-4" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-bold">
                    Sepeti Gör • {cartCount} ürün
                  </p>
                  {selectedNeighborhood && (
                    <p className="text-[11px] text-[#D7C6B6]">
                      {selectedNeighborhood.branch.name}
                    </p>
                  )}
                </div>
              </div>
              <span className="text-base font-bold text-[#F5D09B]">
                {formatTl(cartSubtotal)}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Product Option Modal */}
      <ProductOptionModal
        product={optionProduct}
        onClose={() => setOptionProduct(null)}
      />

      {/* Large Image Lightbox Modal */}
      {lightboxProduct && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={lightboxProduct.name}
          onClick={() => setLightboxProduct(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-[#C68B3C]/40 bg-[#1D110C] shadow-2xl"
          >
            <button
              type="button"
              onClick={() => setLightboxProduct(null)}
              aria-label="Görseli kapat"
              className="absolute top-3 right-3 z-10 rounded-full bg-black/65 hover:bg-black/85 p-2 text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="aspect-square w-full bg-[#120D0C] overflow-hidden">
              <ProductImage
                src={lightboxProduct.imageUrl}
                alt={lightboxProduct.name}
                priority
                className="w-full h-full object-contain"
              />
            </div>

            <div className="bg-[#FFFDF9] p-4 sm:p-5 border-t border-[#E6D9CB]">
              <h3 className="font-serif font-bold text-base sm:text-lg text-[#1D110C]">
                {lightboxProduct.name}
              </h3>
              {lightboxProduct.description && (
                <p className="text-xs sm:text-sm text-[#5C4338] mt-1 leading-relaxed">
                  {lightboxProduct.description}
                </p>
              )}

              <div className="mt-4 flex items-center justify-between gap-3">
                <span className="text-base sm:text-lg font-bold text-[#2C1A12]">
                  {formatTl(lightboxProduct.price)}
                </span>

                {(() => {
                  const soldOut = !lightboxProduct.branchAvailable;
                  const disabled =
                    soldOut ||
                    !selectedNeighborhood ||
                    Boolean(outOfServiceMessage) ||
                    branchStatus?.canAcceptOrders === false;
                  let btnLabel = "Sepete Ekle";
                  if (soldOut) btnLabel = "Şubede Tükendi";
                  else if (!selectedNeighborhood || outOfServiceMessage)
                    btnLabel = "Mahalle Seçin";
                  else if (branchStatus?.canAcceptOrders === false)
                    btnLabel = "Şube Kapalı";

                  return (
                    <button
                      type="button"
                      disabled={
                        soldOut ||
                        (Boolean(selectedNeighborhood) &&
                          !outOfServiceMessage &&
                          branchStatus?.canAcceptOrders === false)
                      }
                      onClick={() => {
                        const target = lightboxProduct;
                        setLightboxProduct(null);
                        handleProductAction(target);
                      }}
                      className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-xs sm:text-sm font-semibold transition-colors ${
                        disabled
                          ? "bg-[#EFE6DC] text-[#8A6F62] cursor-not-allowed"
                          : "bg-[#2C1A12] hover:bg-[#1D110C] text-[#FBF6F0] cursor-pointer shadow-xs"
                      }`}
                    >
                      {!disabled && (
                        <Plus className="w-4 h-4 text-[#C68B3C]" />
                      )}
                      <span>{btnLabel}</span>
                    </button>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
