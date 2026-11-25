"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import type { SelectionType } from "@prisma/client";
import {
  AlertCircle,
  CheckCircle2,
  Edit3,
  Plus,
  Search,
  SlidersHorizontal,
  Trash2,
  X,
} from "lucide-react";
import { ConfirmDialog } from "@/components/panel/ConfirmDialog";
import { usePanelAuth } from "@/components/panel/PanelAuthContext";
import { UnauthorizedView } from "@/components/panel/UnauthorizedView";
import { apiFetch, formatTRY } from "@/components/panel/panel-utils";
import type { OptionGroupDTO } from "@/lib/types";

interface OptionGroupWithProducts extends OptionGroupDTO {
  productIds: string[];
}

interface ProductLite {
  id: string;
  categoryId: string;
  categoryName: string;
  name: string;
}

interface CategoryLite {
  id: string;
  name: string;
}

interface EditableOptionItem {
  localKey: string;
  id?: string;
  name: string;
  priceDelta: string;
  isDefault: boolean;
  isAvailable: boolean;
}

function makeLocalKey(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function PanelOptionsPage() {
  const { user } = usePanelAuth();
  const isAdmin = user?.role === "ADMIN";

  const [optionGroups, setOptionGroups] = useState<OptionGroupWithProducts[]>(
    [],
  );
  const [categories, setCategories] = useState<CategoryLite[]>([]);
  const [products, setProducts] = useState<ProductLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] =
    useState<OptionGroupWithProducts | null>(null);

  const [name, setName] = useState("");
  const [selectionType, setSelectionType] = useState<SelectionType>("SINGLE");
  const [isRequired, setIsRequired] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [sortOrder, setSortOrder] = useState("0");
  const [items, setItems] = useState<EditableOptionItem[]>([]);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] =
    useState<OptionGroupWithProducts | null>(null);
  const [deleting, setDeleting] = useState(false);

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 3500);
  };

  const loadData = useCallback(async () => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [optRes, prodRes] = await Promise.all([
        apiFetch<{ optionGroups: OptionGroupWithProducts[] }>(
          "/api/panel/options",
          { cache: "no-store" },
        ),
        apiFetch<{
          categories: CategoryLite[];
          products: ProductLite[];
        }>("/api/panel/products", { cache: "no-store" }),
      ]);
      setOptionGroups(optRes.optionGroups);
      setCategories(prodRes.categories);
      setProducts(prodRes.products);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Opsiyon grupları yüklenemedi.",
      );
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (!modalOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !saving) setModalOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [modalOpen, saving]);

  const productsByCategory = useMemo(() => {
    const q = productSearch.trim().toLocaleLowerCase("tr-TR");
    const groups = new Map<
      string,
      { categoryName: string; items: ProductLite[] }
    >();

    for (const cat of categories) {
      groups.set(cat.id, { categoryName: cat.name, items: [] });
    }

    for (const p of products) {
      if (q) {
        const hay = `${p.name} ${p.categoryName}`.toLocaleLowerCase("tr-TR");
        if (!hay.includes(q)) continue;
      }
      const bucket = groups.get(p.categoryId) ?? {
        categoryName: p.categoryName,
        items: [],
      };
      bucket.items.push(p);
      groups.set(p.categoryId, bucket);
    }

    return Array.from(groups.entries()).filter(
      ([, val]) => val.items.length > 0,
    );
  }, [categories, products, productSearch]);

  if (!isAdmin) {
    return <UnauthorizedView />;
  }

  const openCreateModal = () => {
    setEditingGroup(null);
    setName("");
    setSelectionType("SINGLE");
    setIsRequired(false);
    setIsActive(true);
    setSortOrder(String(optionGroups.length));
    setItems([
      {
        localKey: makeLocalKey(),
        name: "",
        priceDelta: "0",
        isDefault: false,
        isAvailable: true,
      },
    ]);
    setSelectedProductIds([]);
    setProductSearch("");
    setModalOpen(true);
  };

  const openEditModal = (og: OptionGroupWithProducts) => {
    setEditingGroup(og);
    setName(og.name);
    setSelectionType(og.selectionType);
    setIsRequired(og.isRequired);
    setIsActive(og.isActive);
    setSortOrder(String(og.sortOrder));
    setItems(
      og.items.map((item) => ({
        localKey: makeLocalKey(),
        id: item.id,
        name: item.name,
        priceDelta: String(item.priceDelta),
        isDefault: item.isDefault,
        isAvailable: item.isAvailable,
      })),
    );
    setSelectedProductIds(og.productIds);
    setProductSearch("");
    setModalOpen(true);
  };

  const addOptionItemRow = () => {
    setItems((prev) => [
      ...prev,
      {
        localKey: makeLocalKey(),
        name: "",
        priceDelta: "0",
        isDefault: false,
        isAvailable: true,
      },
    ]);
  };

  const updateOptionItemRow = (
    localKey: string,
    patch: Partial<EditableOptionItem>,
  ) => {
    setItems((prev) =>
      prev.map((row) =>
        row.localKey === localKey ? { ...row, ...patch } : row,
      ),
    );
  };

  const removeOptionItemRow = (localKey: string) => {
    setItems((prev) => prev.filter((row) => row.localKey !== localKey));
  };

  const toggleProductId = (productId: string) => {
    setSelectedProductIds((prev) =>
      prev.includes(productId)
        ? prev.filter((id) => id !== productId)
        : [...prev, productId],
    );
  };

  const toggleCategoryProducts = (catProducts: ProductLite[]) => {
    const ids = catProducts.map((p) => p.id);
    const allSelected = ids.every((id) => selectedProductIds.includes(id));
    if (allSelected) {
      setSelectedProductIds((prev) => prev.filter((id) => !ids.includes(id)));
    } else {
      setSelectedProductIds((prev) => Array.from(new Set([...prev, ...ids])));
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanedItems = items
      .map((item, idx) => ({
        ...(item.id ? { id: item.id } : {}),
        name: item.name.trim(),
        priceDelta: Number.parseFloat(item.priceDelta.replace(",", ".")) || 0,
        isDefault: item.isDefault,
        isAvailable: item.isAvailable,
        sortOrder: idx,
      }))
      .filter((item) => item.name.length > 0);

    if (cleanedItems.some((item) => item.priceDelta < 0)) {
      setError("Opsiyon fiyat farkı 0'dan küçük olamaz.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        selectionType,
        isRequired,
        isActive,
        sortOrder: Number.parseInt(sortOrder, 10) || 0,
        items: cleanedItems,
        productIds: selectedProductIds,
      };

      if (editingGroup) {
        const res = await apiFetch<{ optionGroup: OptionGroupWithProducts }>(
          `/api/panel/options/${editingGroup.id}`,
          {
            method: "PATCH",
            body: JSON.stringify(payload),
          },
        );
        setOptionGroups((prev) =>
          prev.map((g) => (g.id === res.optionGroup.id ? res.optionGroup : g)),
        );
        showToast(`"${res.optionGroup.name}" güncellendi.`);
      } else {
        const res = await apiFetch<{ optionGroup: OptionGroupWithProducts }>(
          "/api/panel/options",
          {
            method: "POST",
            body: JSON.stringify(payload),
          },
        );
        setOptionGroups((prev) => [...prev, res.optionGroup]);
        showToast(`"${res.optionGroup.name}" oluşturuldu.`);
      }
      setModalOpen(false);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Opsiyon grubu kaydedilemedi.",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (group: OptionGroupWithProducts) => {
    setDeleting(true);
    setError(null);
    try {
      await apiFetch<{ ok: boolean }>(`/api/panel/options/${group.id}`, {
        method: "DELETE",
      });
      setOptionGroups((prev) => prev.filter((g) => g.id !== group.id));
      setDeleteTarget(null);
      showToast(`"${group.name}" silindi.`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Opsiyon grubu silinemedi.",
      );
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-4 rounded-2xl border border-[#E5D7C8] bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#24140E] sm:text-2xl">
            Opsiyon Grupları
          </h1>
          <p className="mt-1 text-xs text-[#6E5549]">
            Dondurma, süt seçimi, tarçın veya ekstra sos gibi ürün
            özelleştirmelerini oluşturun ve ürünlere bağlayın.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center gap-1.5 rounded-xl bg-[#2C1810] px-4 py-2.5 text-xs font-bold text-[#FAF3EA] shadow-sm hover:bg-[#412418]"
        >
          <Plus className="h-4 w-4 text-[#D9A76A]" />
          <span>Yeni Opsiyon Grubu</span>
        </button>
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

      {/* Option Groups List */}
      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-44 animate-pulse rounded-2xl border border-[#E5D7C8] bg-white"
            />
          ))}
        </div>
      ) : optionGroups.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#D6C4B2] bg-white p-12 text-center">
          <SlidersHorizontal className="mx-auto h-10 w-10 text-[#B99D88]" />
          <h2 className="mt-3 text-base font-bold text-[#24140E]">
            Henüz opsiyon grubu tanımlanmamış
          </h2>
          <p className="mt-1 text-xs text-[#6E5549]">
            Yeni bir opsiyon grubu ekleyerek tatlı veya içeceklere seçenek
            bağlayabilirsiniz.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {optionGroups.map((og) => (
            <article
              key={og.id}
              className="flex flex-col justify-between rounded-2xl border border-[#E5D7C8] bg-white p-5 shadow-sm"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-base font-bold text-[#24140E]">
                        {og.name}
                      </h2>
                      <span className="rounded-full bg-[#F5ECE2] px-2.5 py-0.5 text-[11px] font-bold text-[#5C3D2E]">
                        {og.selectionType === "SINGLE"
                          ? "Tekli Seçim"
                          : "Çoklu Seçim"}
                      </span>
                      {og.isRequired && (
                        <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-bold text-amber-900">
                          Zorunlu
                        </span>
                      )}
                      {!og.isActive && (
                        <span className="rounded-full bg-rose-100 px-2.5 py-0.5 text-[11px] font-bold text-rose-800">
                          Pasif
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-[#6E5549]">
                      <strong className="font-bold text-[#24140E]">
                        {og.productIds.length}
                      </strong>{" "}
                      ürüne bağlı • {og.items.length} seçenek
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => openEditModal(og)}
                      className="inline-flex items-center gap-1 rounded-xl border border-[#DAC8B8] bg-white px-3 py-1.5 text-xs font-semibold text-[#4A3429] hover:bg-[#FAF5EE]"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                      <span>Düzenle</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(og)}
                      className="rounded-xl border border-rose-200 bg-rose-50 p-1.5 text-rose-700 hover:bg-rose-100"
                      title="Sil"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Items Preview */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {og.items.map((item) => (
                    <span
                      key={item.id}
                      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold ${
                        item.isAvailable
                          ? "border-[#E5D7C8] bg-[#FAF6F0] text-[#24140E]"
                          : "border-neutral-200 bg-neutral-100 text-neutral-400 line-through"
                      }`}
                    >
                      <span>{item.name}</span>
                      {item.priceDelta > 0 && (
                        <span className="font-bold text-[#8C6239]">
                          +{formatTRY(item.priceDelta)}
                        </span>
                      )}
                      {item.isDefault && (
                        <span className="rounded bg-[#2C1810] px-1 py-0.5 text-[9px] font-bold text-[#FAF3EA]">
                          Varsayılan
                        </span>
                      )}
                    </span>
                  ))}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Create / Edit OptionGroup Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => {
            if (!saving) setModalOpen(false);
          }}
        >
          <div
            className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-[#E5D7C8] bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#EFE5DA] pb-3">
              <h2 className="text-lg font-bold text-[#24140E]">
                {editingGroup
                  ? `Opsiyon Grubunu Düzenle: ${editingGroup.name}`
                  : "Yeni Opsiyon Grubu"}
              </h2>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-lg p-1.5 text-[#7A6256] hover:bg-[#FAF5EE]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="mt-5 space-y-6">
              {/* Group Metadata */}
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-[#4A3429]">
                    Opsiyon Grubu Adı
                  </label>
                  <input
                    type="text"
                    required
                    minLength={2}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Örn: Dondurma İster misiniz?"
                    className="mt-1.5 w-full rounded-xl border border-[#DAC8B8] px-3 py-2 text-sm focus:border-[#2C1810] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#4A3429]">
                    Seçim Tipi
                  </label>
                  <select
                    value={selectionType}
                    onChange={(e) =>
                      setSelectionType(e.target.value as SelectionType)
                    }
                    className="mt-1.5 w-full rounded-xl border border-[#DAC8B8] px-3 py-2 text-sm font-semibold focus:border-[#2C1810] focus:outline-none"
                  >
                    <option value="SINGLE">Tekli Seçim (SINGLE)</option>
                    <option value="MULTIPLE">Çoklu Seçim (MULTIPLE)</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-5">
                <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-bold text-[#24140E]">
                  <input
                    type="checkbox"
                    checked={isRequired}
                    onChange={(e) => setIsRequired(e.target.checked)}
                    className="h-4 w-4 accent-[#2C1810]"
                  />
                  <span>Müşteri Seçimi Zorunlu</span>
                </label>

                <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-bold text-[#24140E]">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="h-4 w-4 accent-[#2C1810]"
                  />
                  <span>Grup Aktif</span>
                </label>

                <div className="flex items-center gap-2">
                  <label className="text-xs font-bold text-[#4A3429]">
                    Sıralama:
                  </label>
                  <input
                    type="number"
                    value={sortOrder}
                    onChange={(e) => setSortOrder(e.target.value)}
                    className="w-20 rounded-lg border border-[#DAC8B8] px-2.5 py-1 text-xs"
                  />
                </div>
              </div>

              {/* Dynamic Option Items */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#5C3D2E]">
                    Seçenek Kalemleri ({items.length})
                  </h3>
                  <button
                    type="button"
                    onClick={addOptionItemRow}
                    className="inline-flex items-center gap-1 rounded-lg border border-[#DAC8B8] bg-[#FAF6F0] px-2.5 py-1.5 text-xs font-bold text-[#24140E] hover:bg-[#F2E8DC]"
                  >
                    <Plus className="h-3.5 w-3.5 text-[#B47D3B]" />
                    <span>Seçenek Ekle</span>
                  </button>
                </div>

                <div className="space-y-2 rounded-xl border border-[#E5D7C8] bg-[#FAF6F0] p-3">
                  {items.length === 0 ? (
                    <p className="py-3 text-center text-xs text-[#7A6256]">
                      Henüz seçenek yok. Yukarıdan seçenek ekleyin.
                    </p>
                  ) : (
                    items.map((item) => (
                      <div
                        key={item.localKey}
                        className="grid gap-2 rounded-xl border border-[#E5D7C8] bg-white p-2.5 sm:grid-cols-12 sm:items-center"
                      >
                        <div className="sm:col-span-5">
                          <input
                            type="text"
                            required
                            value={item.name}
                            onChange={(e) =>
                              updateOptionItemRow(item.localKey, {
                                name: e.target.value,
                              })
                            }
                            placeholder="Seçenek adı (Örn: Vanilyalı Dondurma)"
                            className="w-full rounded-lg border border-[#DAC8B8] px-2.5 py-1.5 text-xs focus:border-[#2C1810] focus:outline-none"
                          />
                        </div>
                        <div className="sm:col-span-3">
                          <div className="relative">
                            <input
                              type="number"
                              min={0}
                              step="0.01"
                              value={item.priceDelta}
                              onChange={(e) =>
                                updateOptionItemRow(item.localKey, {
                                  priceDelta: e.target.value,
                                })
                              }
                              placeholder="0"
                              className="w-full rounded-lg border border-[#DAC8B8] px-2.5 py-1.5 pr-7 text-xs focus:border-[#2C1810] focus:outline-none"
                            />
                            <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] font-bold text-[#7A6256]">
                              ₺
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 sm:col-span-3">
                          <label className="inline-flex cursor-pointer items-center gap-1 text-[11px] font-semibold text-[#4A3429]">
                            <input
                              type="checkbox"
                              checked={item.isDefault}
                              onChange={(e) =>
                                updateOptionItemRow(item.localKey, {
                                  isDefault: e.target.checked,
                                })
                              }
                            />
                            <span>Varsayılan</span>
                          </label>
                          <label className="inline-flex cursor-pointer items-center gap-1 text-[11px] font-semibold text-[#4A3429]">
                            <input
                              type="checkbox"
                              checked={item.isAvailable}
                              onChange={(e) =>
                                updateOptionItemRow(item.localKey, {
                                  isAvailable: e.target.checked,
                                })
                              }
                            />
                            <span>Mevcut</span>
                          </label>
                        </div>
                        <div className="flex justify-end sm:col-span-1">
                          <button
                            type="button"
                            onClick={() => removeOptionItemRow(item.localKey)}
                            className="rounded-lg p-1.5 text-rose-600 hover:bg-rose-50"
                            title="Seçeneği Kaldır"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Multi-select Searchable "Ürünlere Bağla" Checklist */}
              <div className="space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#5C3D2E]">
                    Ürünlere Bağla ({selectedProductIds.length} ürün seçili)
                  </h3>
                  <div className="relative w-full sm:w-64">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#8C7062]" />
                    <input
                      type="search"
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                      placeholder="Ürün veya kategori ara..."
                      className="w-full rounded-lg border border-[#DAC8B8] bg-[#FAF6F0] py-1.5 pl-8 pr-2.5 text-xs focus:bg-white focus:outline-none"
                    />
                  </div>
                </div>

                <div className="max-h-60 space-y-3 overflow-y-auto rounded-xl border border-[#E5D7C8] bg-[#FAF6F0] p-3">
                  {productsByCategory.length === 0 ? (
                    <p className="py-4 text-center text-xs text-[#7A6256]">
                      Eşleşen ürün bulunamadı.
                    </p>
                  ) : (
                    productsByCategory.map(([catId, group]) => {
                      const allSelected = group.items.every((p) =>
                        selectedProductIds.includes(p.id),
                      );
                      return (
                        <div
                          key={catId}
                          className="rounded-xl border border-[#E5D7C8] bg-white p-3"
                        >
                          <div className="mb-2 flex items-center justify-between border-b border-[#EFE5DA] pb-1.5">
                            <span className="text-xs font-bold text-[#24140E]">
                              {group.categoryName}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                toggleCategoryProducts(group.items)
                              }
                              className="text-[11px] font-bold text-[#8C6239] hover:underline"
                            >
                              {allSelected ? "Temizle" : "Tümünü Seç"}
                            </button>
                          </div>
                          <div className="grid gap-1.5 sm:grid-cols-2">
                            {group.items.map((p) => (
                              <label
                                key={p.id}
                                className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 text-xs hover:bg-[#FAF6F0]"
                              >
                                <input
                                  type="checkbox"
                                  checked={selectedProductIds.includes(p.id)}
                                  onChange={() => toggleProductId(p.id)}
                                  className="h-3.5 w-3.5 accent-[#2C1810]"
                                />
                                <span className="truncate font-medium text-[#24140E]">
                                  {p.name}
                                </span>
                              </label>
                            ))}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t border-[#EFE5DA] pt-4">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-xl border border-[#DAC8B8] px-4 py-2 text-xs font-bold text-[#4A3429]"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-[#2C1810] px-5 py-2 text-xs font-bold text-[#FAF3EA] hover:bg-[#412418] disabled:opacity-50"
                >
                  {saving ? "Kaydediliyor..." : "Opsiyon Grubunu Kaydet"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Option Group Confirmation */}
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Opsiyon Grubunu Sil"
        description={
          deleteTarget
            ? `"${deleteTarget.name}" opsiyon grubunu kalıcı olarak silmek istediğinize emin misiniz?`
            : ""
        }
        confirmLabel="Sil"
        loading={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) {
            void handleDelete(deleteTarget);
          }
        }}
      />
    </div>
  );
}
