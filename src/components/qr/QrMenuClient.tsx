"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Coffee,
  Search,
  UtensilsCrossed,
  X,
  ZoomIn,
} from "lucide-react";
import type { OptionGroupDTO } from "@/lib/types";
import { ProductImage } from "@/components/storefront/ProductImage";
import { formatTl, normalizeTrText } from "@/components/storefront/utils";

export interface QrMenuProduct {
  id: string;
  categoryId: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  imageUrl: string | null;
  sortOrder: number;
  optionGroups: OptionGroupDTO[];
}

export interface QrMenuCategory {
  id: string;
  name: string;
  slug: string;
  rootGroup: "FOOD" | "DRINK";
  sortOrder: number;
  products: QrMenuProduct[];
}

export interface QrMenuBranch {
  id: string;
  name: string;
  slug: string;
  address: string;
  phone: string;
}

interface QrMenuClientProps {
  initialBranch: QrMenuBranch | null;
  initialCategories: QrMenuCategory[];
}

type RootTab = "ALL" | "FOOD" | "DRINK";

export function QrMenuClient({
  initialBranch,
  initialCategories,
}: QrMenuClientProps) {
  const [rootTab, setRootTab] = useState<RootTab>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategoryId, setActiveCategoryId] = useState<string>(
    initialCategories[0]?.id ?? "",
  );
  const [lightboxProduct, setLightboxProduct] = useState<QrMenuProduct | null>(
    null,
  );
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

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

  const filteredCategories = useMemo(() => {
    const q = normalizeTrText(searchQuery);
    return initialCategories
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
  }, [initialCategories, rootTab, searchQuery]);

  function scrollToCategory(categoryId: string) {
    setActiveCategoryId(categoryId);
    const el = sectionRefs.current[categoryId];
    if (el) {
      const y = el.getBoundingClientRect().top + window.scrollY - 148;
      window.scrollTo({ top: Math.max(0, y), behavior: "smooth" });
    }
  }

  return (
    <div className="min-h-screen bg-[#FAF6F1] text-[#1D110C] flex flex-col">
      {/* Compact Brand Hero */}
      <header className="bg-gradient-to-br from-[#120D0C] via-[#241612] to-[#120D0C] text-[#FAF6F1] border-b border-[#33221D]">
        <div className="max-w-4xl mx-auto px-4 py-5 flex items-center gap-3.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.jpg"
            alt="Death By Chocolate"
            className="w-12 h-12 sm:w-14 sm:h-14 rounded-full object-cover border-2 border-[#D4A048]/80 shadow-md shrink-0 bg-black"
          />
          <div className="min-w-0">
            <h1 className="font-serif font-bold text-xl sm:text-2xl tracking-tight text-[#FAF6F1]">
              Death By Chocolate
            </h1>
            <p className="text-xs text-[#D4A048] font-semibold tracking-wider uppercase mt-0.5">
              {initialBranch ? `${initialBranch.name} • Dijital Menü` : "Dijital Menü"}
            </p>
          </div>
        </div>
      </header>

      {/* Sticky Filter & Category Bar */}
      <div className="sticky top-0 z-30 bg-[#FAF6F1]/95 backdrop-blur-md border-b border-[#E6D9CB] shadow-xs">
        <div className="max-w-4xl mx-auto px-4 py-3 space-y-2.5">
          <div className="flex flex-col sm:flex-row gap-2.5">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-[#8A6F62] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tatlı, kahve veya içecek ara..."
                className="w-full rounded-xl border border-[#DFD2C3] bg-white pl-9 pr-3 py-2 text-sm text-[#1D110C] placeholder:text-[#9C8476] focus:outline-none focus:ring-2 focus:ring-[#D4A048]/40"
              />
            </div>

            {/* Root Tabs */}
            <div className="inline-flex items-center rounded-xl bg-[#EFE6DC] p-1 self-start sm:self-auto">
              {(
                [
                  { id: "ALL", label: "Tümü" },
                  { id: "FOOD", label: "Tatlılar", icon: UtensilsCrossed },
                  { id: "DRINK", label: "İçecekler", icon: Coffee },
                ] as const
              ).map((tab) => {
                const active = rootTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setRootTab(tab.id)}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors cursor-pointer ${
                      active
                        ? "bg-[#120D0C] text-[#FAF6F1] shadow-xs"
                        : "text-[#5C4338] hover:text-[#120D0C]"
                    }`}
                  >
                    {"icon" in tab && <tab.icon className="w-3.5 h-3.5 text-[#D4A048]" />}
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Horizontal Category Pills */}
          {filteredCategories.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
              {filteredCategories.map((cat) => {
                const active = activeCategoryId === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => scrollToCategory(cat.id)}
                    className={`shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                      active
                        ? "border-[#120D0C] bg-[#120D0C] text-[#FAF6F1]"
                        : "border-[#E0D2C3] bg-white text-[#4A3429] hover:border-[#D4A048]"
                    }`}
                  >
                    {cat.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Menu Sections */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-6 space-y-8">
        {filteredCategories.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#D6C4B2] bg-white p-10 text-center">
            <p className="text-sm font-bold text-[#1D110C]">
              Aradığınız kriterde ürün bulunamadı.
            </p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                setRootTab("ALL");
              }}
              className="mt-3 rounded-xl bg-[#120D0C] px-4 py-2 text-xs font-semibold text-[#FAF6F1] cursor-pointer"
            >
              Filtreyi Temizle
            </button>
          </div>
        ) : (
          filteredCategories.map((category, catIdx) => (
            <section
              key={category.id}
              ref={(el) => {
                sectionRefs.current[category.id] = el;
              }}
              className="space-y-3.5 scroll-mt-36"
            >
              <div className="flex items-baseline justify-between border-b border-[#E6D9CB] pb-2">
                <h2 className="font-serif text-lg sm:text-xl font-bold text-[#1D110C]">
                  {category.name}
                </h2>
                <span className="text-xs font-medium text-[#8A6F62]">
                  {category.products.length} ürün
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {category.products.map((product, prodIdx) => {
                  const extraItems = product.optionGroups.flatMap((og) =>
                    og.items.filter((i) => i.priceDelta > 0),
                  );

                  return (
                    <article
                      key={product.id}
                      className="rounded-2xl border border-[#E6D9CB] bg-[#FFFDF9] p-3.5 flex gap-3.5 hover:border-[#D4A048]/70 transition-colors"
                    >
                      {product.imageUrl ? (
                        <button
                          type="button"
                          onClick={() => setLightboxProduct(product)}
                          aria-label={`${product.name} görselini büyük görüntüle`}
                          className="group relative w-24 h-24 rounded-xl overflow-hidden shrink-0 border border-[#EFE6DC] bg-[#2C1A12] cursor-zoom-in focus:outline-none focus:ring-2 focus:ring-[#C68B3C]"
                        >
                          <ProductImage
                            src={product.imageUrl}
                            alt={product.name}
                            priority={catIdx === 0 && prodIdx < 4}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                          />
                          <span className="absolute bottom-1.5 right-1.5 rounded-full bg-black/55 p-1 text-white opacity-85 group-hover:opacity-100">
                            <ZoomIn className="w-3 h-3" />
                          </span>
                        </button>
                      ) : (
                        <div className="relative w-24 h-24 rounded-xl overflow-hidden shrink-0 border border-[#EFE6DC] bg-[#2C1A12]">
                          <ProductImage
                            src={product.imageUrl}
                            alt={product.name}
                          />
                        </div>
                      )}

                      <div className="flex-1 min-w-0 flex flex-col justify-between">
                        <div>
                          <h3 className="font-semibold text-sm sm:text-base text-[#1D110C] leading-snug">
                            {product.name}
                          </h3>
                          {product.description && (
                            <p className="text-xs text-[#6E5245] mt-1 leading-relaxed line-clamp-3">
                              {product.description}
                            </p>
                          )}
                          {extraItems.length > 0 && (
                            <div className="mt-1.5 flex flex-wrap gap-1">
                              {extraItems.map((item) => (
                                <span
                                  key={item.id}
                                  className="inline-block rounded-md bg-[#F5ECE0] px-2 py-0.5 text-[10px] font-semibold text-[#6E5245]"
                                >
                                  {item.name} (+{formatTl(item.priceDelta)})
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="mt-2.5 flex items-center justify-between">
                          <span className="text-sm sm:text-base font-bold text-[#2C1A12]">
                            {formatTl(product.price)}
                          </span>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ))
        )}
      </main>

      {/* Simple QR Menu Footer */}
      <footer className="border-t border-[#E6D9CB] bg-[#FFFDF9] py-6 text-center text-xs text-[#8A6F62]">
        <p className="font-serif font-bold text-[#1D110C]">Death By Chocolate</p>
        <p className="mt-1">Fiyatlarımıza KDV dahildir.</p>
      </footer>

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

            <div className="bg-[#FFFDF9] p-4 sm:p-5 border-t border-[#E6D9CB] space-y-2">
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-serif font-bold text-base sm:text-lg text-[#1D110C]">
                  {lightboxProduct.name}
                </h3>
                <span className="text-base sm:text-lg font-bold text-[#2C1A12] shrink-0">
                  {formatTl(lightboxProduct.price)}
                </span>
              </div>
              {lightboxProduct.description && (
                <p className="text-xs sm:text-sm text-[#5C4338] leading-relaxed">
                  {lightboxProduct.description}
                </p>
              )}
              {lightboxProduct.optionGroups.length > 0 && (
                <div className="pt-2 border-t border-[#EFE6DC] space-y-1">
                  {lightboxProduct.optionGroups.map((og) => (
                    <p key={og.id} className="text-xs text-[#6E5245]">
                      <strong className="text-[#1D110C]">{og.name}:</strong>{" "}
                      {og.items
                        .map((i) =>
                          i.priceDelta > 0
                            ? `${i.name} (+${formatTl(i.priceDelta)})`
                            : i.name,
                        )
                        .join(", ")}
                    </p>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
