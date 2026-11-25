"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { RootGroup } from "@prisma/client";
import {
  AlertCircle,
  CheckCircle2,
  Edit3,
  ImageIcon,
  Plus,
  Search,
  SlidersHorizontal,
  Tags,
  Trash2,
  UtensilsCrossed,
  X,
} from "lucide-react";
import { ConfirmDialog } from "@/components/panel/ConfirmDialog";
import { usePanelAuth } from "@/components/panel/PanelAuthContext";
import { apiFetch, formatTRY } from "@/components/panel/panel-utils";
import type { OptionGroupDTO } from "@/lib/types";

interface PanelCategoryItem {
  id: string;
  name: string;
  slug: string;
  rootGroup: RootGroup;
  sortOrder: number;
  isActive: boolean;
}

interface PanelBranchLite {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
}

interface PanelProductItem {
  id: string;
  categoryId: string;
  categoryName: string;
  rootGroup: RootGroup;
  name: string;
  slug: string;
  description: string;
  price: number;
  imageUrl: string | null;
  sortOrder: number;
  isActive: boolean;
  optionGroupIds: string[];
  branchAvailabilities: Array<{
    branchId: string;
    isAvailable: boolean;
  }>;
}

interface MenuPayload {
  categories: PanelCategoryItem[];
  branches: PanelBranchLite[];
  optionGroups: Array<OptionGroupDTO & { productIds: string[] }>;
  products: PanelProductItem[];
}

export default function PanelMenuPage() {
  const { user } = usePanelAuth();
  const isAdmin = user?.role === "ADMIN";

  const [categories, setCategories] = useState<PanelCategoryItem[]>([]);
  const [branches, setBranches] = useState<PanelBranchLite[]>([]);
  const [optionGroups, setOptionGroups] = useState<
    Array<OptionGroupDTO & { productIds: string[] }>
  >([]);
  const [products, setProducts] = useState<PanelProductItem[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [selectedRootGroup, setSelectedRootGroup] = useState<"" | RootGroup>("");
  const [togglingKey, setTogglingKey] = useState<string | null>(null);

  // Product modal state (Admin)
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] =
    useState<PanelProductItem | null>(null);
  const [prodCategoryId, setProdCategoryId] = useState("");
  const [prodName, setProdName] = useState("");
  const [prodDescription, setProdDescription] = useState("");
  const [prodPrice, setProdPrice] = useState("");
  const [prodImageUrl, setProdImageUrl] = useState("");
  const [prodSortOrder, setProdSortOrder] = useState("0");
  const [prodIsActive, setProdIsActive] = useState(true);
  const [prodOptionGroupIds, setProdOptionGroupIds] = useState<string[]>([]);
  const [savingProduct, setSavingProduct] = useState(false);

  // Delete product confirmation (Admin)
  const [deleteTarget, setDeleteTarget] = useState<PanelProductItem | null>(
    null,
  );
  const [deletingProduct, setDeletingProduct] = useState(false);

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 3500);
  };

  const loadMenu = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<MenuPayload>("/api/panel/products", {
        cache: "no-store",
      });
      setCategories(data.categories);
      setBranches(data.branches);
      setOptionGroups(data.optionGroups);
      setProducts(data.products);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Menü bilgileri yüklenemedi.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMenu();
  }, [loadMenu]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && productModalOpen && !savingProduct) {
        setProductModalOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [productModalOpen, savingProduct]);

  const productCountByCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of products) {
      map.set(p.categoryId, (map.get(p.categoryId) ?? 0) + 1);
    }
    return map;
  }, [products]);

  const visibleFilterCategories = useMemo(
    () =>
      categories.filter(
        (cat) => !selectedRootGroup || cat.rootGroup === selectedRootGroup,
      ),
    [categories, selectedRootGroup],
  );

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLocaleLowerCase("tr-TR");
    return products.filter((p) => {
      if (selectedCategoryId && p.categoryId !== selectedCategoryId) {
        return false;
      }
      if (selectedRootGroup && p.rootGroup !== selectedRootGroup) {
        return false;
      }
      if (q) {
        const hay = `${p.name} ${p.categoryName} ${p.description}`.toLocaleLowerCase(
          "tr-TR",
        );
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [products, search, selectedCategoryId, selectedRootGroup]);

  const getBranchAvailability = (
    product: PanelProductItem,
    branchId: string,
  ): boolean => {
    const found = product.branchAvailabilities.find(
      (ba) => ba.branchId === branchId,
    );
    return found ? found.isAvailable : true;
  };

  const handleToggleAvailability = async (
    product: PanelProductItem,
    branchId: string,
  ) => {
    const current = getBranchAvailability(product, branchId);
    const next = !current;
    const key = `${product.id}:${branchId}`;
    setTogglingKey(key);
    setError(null);

    try {
      const payload = isAdmin
        ? { branchId, isAvailable: next }
        : { isAvailable: next };

      await apiFetch(`/api/panel/products/${product.id}/availability`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });

      setProducts((prev) =>
        prev.map((item) => {
          if (item.id !== product.id) return item;
          const exists = item.branchAvailabilities.some(
            (ba) => ba.branchId === branchId,
          );
          const nextAvailabilities = exists
            ? item.branchAvailabilities.map((ba) =>
                ba.branchId === branchId ? { ...ba, isAvailable: next } : ba,
              )
            : [...item.branchAvailabilities, { branchId, isAvailable: next }];
          return { ...item, branchAvailabilities: nextAvailabilities };
        }),
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Ürün stok durumu güncellenemedi.",
      );
    } finally {
      setTogglingKey(null);
    }
  };

  // Product modal handlers (Admin)
  const openCreateProduct = () => {
    setEditingProduct(null);
    setProdCategoryId(selectedCategoryId || categories[0]?.id || "");
    setProdName("");
    setProdDescription("");
    setProdPrice("");
    setProdImageUrl("");
    setProdSortOrder(String(products.length));
    setProdIsActive(true);
    setProdOptionGroupIds([]);
    setProductModalOpen(true);
  };

  const openEditProduct = (p: PanelProductItem) => {
    setEditingProduct(p);
    setProdCategoryId(p.categoryId);
    setProdName(p.name);
    setProdDescription(p.description);
    setProdPrice(String(p.price));
    setProdImageUrl(p.imageUrl ?? "");
    setProdSortOrder(String(p.sortOrder));
    setProdIsActive(p.isActive);
    setProdOptionGroupIds(p.optionGroupIds);
    setProductModalOpen(true);
  };

  const toggleProductOptionGroup = (groupId: string) => {
    setProdOptionGroupIds((prev) =>
      prev.includes(groupId)
        ? prev.filter((id) => id !== groupId)
        : [...prev, groupId],
    );
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    setSavingProduct(true);
    setError(null);

    const parsedPrice = Number.parseFloat(prodPrice.replace(",", "."));
    if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
      setError("Geçerli bir ürün fiyatı giriniz.");
      setSavingProduct(false);
      return;
    }

    try {
      const payload = {
        categoryId: prodCategoryId,
        name: prodName.trim(),
        description: prodDescription.trim(),
        price: parsedPrice,
        imageUrl: prodImageUrl.trim() || null,
        sortOrder: Number.parseInt(prodSortOrder, 10) || 0,
        isActive: prodIsActive,
        optionGroupIds: prodOptionGroupIds,
      };

      if (editingProduct) {
        const res = await apiFetch<{ product: PanelProductItem }>(
          `/api/panel/products/${editingProduct.id}`,
          {
            method: "PATCH",
            body: JSON.stringify(payload),
          },
        );
        setProducts((prev) =>
          prev.map((p) => (p.id === res.product.id ? res.product : p)),
        );
        showToast(`"${res.product.name}" ürünü güncellendi.`);
      } else {
        const res = await apiFetch<{ product: PanelProductItem }>(
          "/api/panel/products",
          {
            method: "POST",
            body: JSON.stringify(payload),
          },
        );
        setProducts((prev) => [...prev, res.product]);
        showToast(`"${res.product.name}" ürünü eklendi.`);
      }
      setProductModalOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ürün kaydedilemedi.");
    } finally {
      setSavingProduct(false);
    }
  };

  const handleDeleteProduct = async (product: PanelProductItem) => {
    if (!isAdmin) return;
    setDeletingProduct(true);
    setError(null);
    try {
      await apiFetch<{ ok: boolean }>(`/api/panel/products/${product.id}`, {
        method: "DELETE",
      });
      setProducts((prev) => prev.filter((p) => p.id !== product.id));
      setDeleteTarget(null);
      showToast(`"${product.name}" silindi.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ürün silinemedi.");
    } finally {
      setDeletingProduct(false);
    }
  };

  const ownBranchId = user?.branchId || branches[0]?.id || "";

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-4 rounded-2xl border border-[#E5D7C8] bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#24140E] sm:text-2xl">
            {isAdmin ? "Menü & Şube Stok Yönetimi" : "Ürün Satış Durumu"}
          </h1>
          <p className="mt-1 text-xs text-[#6E5549]">
            {isAdmin
              ? "Ürünleri, fiyatları, opsiyon bağlantılarını ve her şubenin anlık satış durumunu yönetin."
              : `${user?.branchName || "Şubeniz"} için ürünleri tek tıkla Satışta / Kapalı olarak güncelleyin.`}
          </p>
        </div>

        {isAdmin && (
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/panel/kategoriler"
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#DAC8B8] bg-[#FAF6F0] px-3.5 py-2.5 text-xs font-bold text-[#24140E] hover:bg-[#F2E8DC]"
            >
              <Tags className="h-4 w-4 text-[#B47D3B]" />
              <span>Kategorileri Yönet</span>
            </Link>
            <button
              type="button"
              onClick={openCreateProduct}
              disabled={categories.length === 0}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#2C1810] px-4 py-2.5 text-xs font-bold text-[#FAF3EA] shadow-sm hover:bg-[#412418] disabled:opacity-50"
            >
              <Plus className="h-4 w-4 text-[#D4A048]" />
              <span>Yeni Ürün Ekle</span>
            </button>
          </div>
        )}
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-800"
        >
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {toast && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-900">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{toast}</span>
        </div>
      )}

      {/* Search & Interactive Category Filter Bar */}
      <div className="rounded-2xl border border-[#E5D7C8] bg-white p-4 shadow-sm space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8C7062]" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Ürün adı, açıklama veya kategori ara..."
              className="w-full rounded-xl border border-[#DAC8B8] bg-[#FAF6F0] py-2 pl-9 pr-3 text-sm text-[#24140E] placeholder:text-[#9A8172] focus:border-[#2C1810] focus:bg-white focus:outline-none"
            />
          </div>

          <div className="inline-flex items-center gap-1 rounded-xl bg-[#F5EDE3] p-1 self-start sm:self-auto">
            {(
              [
                { id: "", label: "Tümü" },
                { id: "FOOD", label: "Tatlı / Yiyecek" },
                { id: "DRINK", label: "İçecekler" },
              ] as const
            ).map((group) => (
              <button
                key={group.id || "ALL"}
                type="button"
                onClick={() => {
                  setSelectedRootGroup(group.id);
                  setSelectedCategoryId("");
                }}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                  selectedRootGroup === group.id
                    ? "bg-[#120D0C] text-[#FAF6F1] shadow-xs"
                    : "text-[#5C4338] hover:text-[#120D0C]"
                }`}
              >
                {group.label}
              </button>
            ))}
          </div>
        </div>

        {/* Sleek Category Filter Pills */}
        {visibleFilterCategories.length > 0 && (
          <div className="border-t border-[#F2E8DC] pt-3">
            <div className="mb-2 flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-[#7A6256]">
              <span>Kategori Filtresi</span>
              <span className="font-semibold normal-case text-[#8C7062]">
                {filteredProducts.length} ürün gösteriliyor
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setSelectedCategoryId("")}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                  selectedCategoryId === ""
                    ? "border-[#120D0C] bg-[#120D0C] text-[#FAF6F1] shadow-xs"
                    : "border-[#E5D7C8] bg-[#FAF6F0] text-[#4A3429] hover:border-[#D4A048]"
                }`}
              >
                <span>Tüm Kategoriler</span>
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${
                    selectedCategoryId === ""
                      ? "bg-[#D4A048] text-[#120D0C]"
                      : "bg-[#EAE0D5] text-[#5C3D2E]"
                  }`}
                >
                  {
                    products.filter(
                      (p) =>
                        !selectedRootGroup || p.rootGroup === selectedRootGroup,
                    ).length
                  }
                </span>
              </button>

              {visibleFilterCategories.map((cat) => {
                const active = selectedCategoryId === cat.id;
                const count = productCountByCategory.get(cat.id) ?? 0;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() =>
                      setSelectedCategoryId(active ? "" : cat.id)
                    }
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                      active
                        ? "border-[#120D0C] bg-[#120D0C] text-[#FAF6F1] shadow-xs"
                        : cat.isActive
                          ? "border-[#E5D7C8] bg-[#FAF6F0] text-[#4A3429] hover:border-[#D4A048] hover:bg-[#FDF7EE]"
                          : "border-neutral-200 bg-neutral-100 text-neutral-500"
                    }`}
                  >
                    <span>{cat.name}</span>
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${
                        active
                          ? "bg-[#D4A048] text-[#120D0C]"
                          : "bg-[#EAE0D5] text-[#5C3D2E]"
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Products List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-2xl border border-[#E5D7C8] bg-white"
            />
          ))}
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#D6C4B2] bg-white p-12 text-center">
          <UtensilsCrossed className="mx-auto h-10 w-10 text-[#B99D88]" />
          <h2 className="mt-3 text-base font-bold text-[#24140E]">
            Eşleşen ürün bulunamadı
          </h2>
          <p className="mt-1 text-xs text-[#6E5549]">
            Arama veya kategori filtresini temizleyerek tüm ürünleri
            görebilirsiniz.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredProducts.map((product) => (
            <div
              key={product.id}
              className="rounded-2xl border border-[#E5D7C8] bg-white p-4 shadow-xs transition hover:border-[#D4A048]/60"
            >
              {/* Top Row: Thumbnail + Info + Price + Right Actions */}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 flex-1 items-start gap-3.5">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[#E5D7C8] bg-[#FAF6F0]">
                    {product.imageUrl ? (
                      <img
                        src={product.imageUrl}
                        alt={product.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <ImageIcon className="h-5 w-5 text-[#B99D88]" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-bold text-[#24140E]">
                        {product.name}
                      </h3>
                      <span className="rounded-md bg-[#F5ECE2] px-2 py-0.5 text-[11px] font-semibold text-[#5C3D2E] whitespace-nowrap">
                        {product.categoryName}
                      </span>
                      {!product.isActive && (
                        <span className="rounded-md bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-800 whitespace-nowrap">
                          Genel Pasif
                        </span>
                      )}
                    </div>

                    {product.description && (
                      <p className="line-clamp-2 text-xs text-[#6E5549]">
                        {product.description}
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-3 pt-0.5 text-xs">
                      <span className="whitespace-nowrap font-black text-[#24140E] tabular-nums">
                        {formatTRY(product.price)}
                      </span>
                      {isAdmin && product.optionGroupIds.length > 0 && (
                        <span className="inline-flex items-center gap-1 whitespace-nowrap text-[11px] text-[#7A6256]">
                          <SlidersHorizontal className="h-3 w-3 text-[#B47D3B]" />
                          {product.optionGroupIds.length} opsiyon grubu
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right Action Area */}
                <div className="flex shrink-0 items-center gap-2 self-end sm:self-start">
                  {!isAdmin &&
                    ownBranchId &&
                    (() => {
                      const available = getBranchAvailability(
                        product,
                        ownBranchId,
                      );
                      const busy =
                        togglingKey === `${product.id}:${ownBranchId}`;
                      return (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            void handleToggleAvailability(product, ownBranchId)
                          }
                          aria-pressed={available}
                          className={`inline-flex min-w-[148px] items-center justify-between gap-3 rounded-xl border px-4 py-2 text-xs font-bold transition disabled:opacity-60 ${
                            available
                              ? "border-emerald-400 bg-emerald-600 text-white shadow-sm hover:bg-emerald-700"
                              : "border-rose-300 bg-rose-50 text-rose-800 hover:bg-rose-100"
                          }`}
                        >
                          <span>{available ? "Satışta" : "Kapalı"}</span>
                          <span
                            className={`inline-flex h-5 w-9 items-center rounded-full p-0.5 transition ${
                              available ? "bg-white/30" : "bg-rose-200"
                            }`}
                          >
                            <span
                              className={`h-4 w-4 rounded-full bg-white shadow transition-transform ${
                                available ? "translate-x-4" : "translate-x-0"
                              }`}
                            />
                          </span>
                        </button>
                      );
                    })()}

                  {isAdmin && (
                    <>
                      <button
                        type="button"
                        onClick={() => openEditProduct(product)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-[#DAC8B8] bg-white px-3 py-2 text-xs font-semibold text-[#4A3429] hover:bg-[#FAF5EE] whitespace-nowrap"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                        <span>Düzenle</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(product)}
                        className="inline-flex items-center justify-center rounded-xl border border-rose-200 bg-rose-50 p-2 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                        title="Ürünü Sil"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Bottom Strip (Admin): Branch Availabilities cleanly separated */}
              {isAdmin && branches.length > 0 && (
                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[#F3EAE0] pt-3">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#8C7062] mr-1">
                    Şube Satış Durumu:
                  </span>
                  {branches.map((branch) => {
                    const available = getBranchAvailability(
                      product,
                      branch.id,
                    );
                    const busy = togglingKey === `${product.id}:${branch.id}`;
                    return (
                      <button
                        key={branch.id}
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          void handleToggleAvailability(product, branch.id)
                        }
                        className={`inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-bold transition disabled:opacity-60 whitespace-nowrap ${
                          available
                            ? "border-emerald-300 bg-emerald-50 text-emerald-900 hover:bg-emerald-100"
                            : "border-rose-300 bg-rose-50 text-rose-800 hover:bg-rose-100"
                        }`}
                      >
                        <span
                          className={`h-2 w-2 rounded-full ${
                            available ? "bg-emerald-600" : "bg-rose-600"
                          }`}
                        />
                        <span>{branch.name}:</span>
                        <span>{available ? "Satışta" : "Kapalı"}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Admin: Create / Edit Product Modal */}
      {isAdmin && productModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => {
            if (!savingProduct) setProductModalOpen(false);
          }}
        >
          <div
            className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-[#E5D7C8] bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-[#24140E]">
                {editingProduct ? "Ürünü Düzenle" : "Yeni Ürün Ekle"}
              </h2>
              <button
                type="button"
                onClick={() => setProductModalOpen(false)}
                className="rounded-lg p-1.5 text-[#7A6256] hover:bg-[#FAF5EE]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="mt-4 space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-bold text-[#4A3429]">
                    Ürün Adı
                  </label>
                  <input
                    type="text"
                    required
                    minLength={2}
                    value={prodName}
                    onChange={(e) => setProdName(e.target.value)}
                    placeholder="Örn: Death By Chocolate"
                    className="mt-1.5 w-full rounded-xl border border-[#DAC8B8] px-3 py-2 text-sm focus:border-[#2C1810] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#4A3429]">
                    Kategori
                  </label>
                  <select
                    required
                    value={prodCategoryId}
                    onChange={(e) => setProdCategoryId(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-[#DAC8B8] px-3 py-2 text-sm focus:border-[#2C1810] focus:outline-none"
                  >
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-bold text-[#4A3429]">
                    Satış Fiyatı (₺)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    required
                    value={prodPrice}
                    onChange={(e) => setProdPrice(e.target.value)}
                    placeholder="375.00"
                    className="mt-1.5 w-full rounded-xl border border-[#DAC8B8] px-3 py-2 text-sm focus:border-[#2C1810] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#4A3429]">
                    Sıralama
                  </label>
                  <input
                    type="number"
                    value={prodSortOrder}
                    onChange={(e) => setProdSortOrder(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-[#DAC8B8] px-3 py-2 text-sm focus:border-[#2C1810] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#4A3429]">
                  Açıklama
                </label>
                <textarea
                  rows={2}
                  value={prodDescription}
                  onChange={(e) => setProdDescription(e.target.value)}
                  placeholder="Ürün içeriği ve alerjen notları..."
                  className="mt-1.5 w-full rounded-xl border border-[#DAC8B8] px-3 py-2 text-sm focus:border-[#2C1810] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#4A3429]">
                  Görsel URL (İsteğe Bağlı)
                </label>
                <input
                  type="text"
                  value={prodImageUrl}
                  onChange={(e) => setProdImageUrl(e.target.value)}
                  placeholder="https://... veya /images/..."
                  className="mt-1.5 w-full rounded-xl border border-[#DAC8B8] px-3 py-2 text-sm focus:border-[#2C1810] focus:outline-none"
                />
              </div>

              {/* Linked Option Groups */}
              <div>
                <label className="block text-xs font-bold text-[#4A3429]">
                  Bağlı Opsiyon Grupları
                </label>
                <div className="mt-1.5 max-h-40 space-y-1.5 overflow-y-auto rounded-xl border border-[#DAC8B8] bg-[#FAF6F0] p-3">
                  {optionGroups.length === 0 ? (
                    <p className="text-xs text-[#7A6256]">
                      Henüz tanımlı opsiyon grubu yok.
                    </p>
                  ) : (
                    optionGroups.map((og) => {
                      const checked = prodOptionGroupIds.includes(og.id);
                      return (
                        <label
                          key={og.id}
                          className="flex cursor-pointer items-center justify-between gap-2 rounded-lg bg-white px-3 py-2 text-xs border border-[#EFE5DA]"
                        >
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleProductOptionGroup(og.id)}
                              className="h-4 w-4 accent-[#2C1810]"
                            />
                            <span className="font-bold text-[#24140E]">
                              {og.name}
                            </span>
                          </div>
                          <span className="text-[11px] text-[#6E5549]">
                            {og.selectionType === "SINGLE"
                              ? "Tekli"
                              : "Çoklu"}{" "}
                            • {og.items.length} seçenek
                          </span>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>

              <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-bold text-[#24140E]">
                <input
                  type="checkbox"
                  checked={prodIsActive}
                  onChange={(e) => setProdIsActive(e.target.checked)}
                  className="h-4 w-4 accent-[#2C1810]"
                />
                <span>Ürün Vitrinlerde Aktif</span>
              </label>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setProductModalOpen(false)}
                  className="rounded-xl border border-[#DAC8B8] px-4 py-2 text-xs font-bold text-[#4A3429]"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  disabled={savingProduct}
                  className="rounded-xl bg-[#2C1810] px-4 py-2 text-xs font-bold text-[#FAF3EA] hover:bg-[#412418] disabled:opacity-50"
                >
                  {savingProduct ? "Kaydediliyor..." : "Ürünü Kaydet"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Admin: Delete Product Confirmation */}
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Ürünü Sil"
        description={
          deleteTarget
            ? `"${deleteTarget.name}" ürününü menüden kalıcı olarak silmek istediğinize emin misiniz?`
            : ""
        }
        confirmLabel="Ürünü Sil"
        loading={deletingProduct}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) {
            void handleDeleteProduct(deleteTarget);
          }
        }}
      />
    </div>
  );
}
