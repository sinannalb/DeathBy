"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import type { RootGroup } from "@prisma/client";
import {
  AlertCircle,
  CheckCircle2,
  Edit3,
  FolderPlus,
  Search,
  Tags,
  X,
} from "lucide-react";
import { usePanelAuth } from "@/components/panel/PanelAuthContext";
import { UnauthorizedView } from "@/components/panel/UnauthorizedView";
import { apiFetch } from "@/components/panel/panel-utils";

interface PanelCategoryItem {
  id: string;
  name: string;
  slug: string;
  rootGroup: RootGroup;
  sortOrder: number;
  isActive: boolean;
}

interface PanelProductLite {
  id: string;
  categoryId: string;
}

export default function PanelCategoriesPage() {
  const { user } = usePanelAuth();
  const isAdmin = user?.role === "ADMIN";

  const [categories, setCategories] = useState<PanelCategoryItem[]>([]);
  const [products, setProducts] = useState<PanelProductLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [rootFilter, setRootFilter] = useState<"" | RootGroup>("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] =
    useState<PanelCategoryItem | null>(null);
  const [catName, setCatName] = useState("");
  const [catRootGroup, setCatRootGroup] = useState<RootGroup>("FOOD");
  const [catSortOrder, setCatSortOrder] = useState("0");
  const [catIsActive, setCatIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 3500);
  };

  const loadCategories = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<{
        categories: PanelCategoryItem[];
        products: PanelProductLite[];
      }>("/api/panel/products", { cache: "no-store" });
      setCategories(data.categories);
      setProducts(data.products);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Kategoriler yüklenemedi.",
      );
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    if (isAdmin) {
      void loadCategories();
    }
  }, [isAdmin, loadCategories]);

  useEffect(() => {
    if (!modalOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !saving) setModalOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [modalOpen, saving]);

  const productCountByCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of products) {
      map.set(p.categoryId, (map.get(p.categoryId) ?? 0) + 1);
    }
    return map;
  }, [products]);

  const filteredCategories = useMemo(() => {
    const q = search.trim().toLocaleLowerCase("tr-TR");
    return categories.filter((c) => {
      if (rootFilter && c.rootGroup !== rootFilter) return false;
      if (q && !c.name.toLocaleLowerCase("tr-TR").includes(q)) return false;
      return true;
    });
  }, [categories, search, rootFilter]);

  if (!isAdmin) {
    return (
      <UnauthorizedView description="Kategori oluşturma ve düzenleme yetkisi yalnızca Yönetici (Admin) kullanıcısına aittir." />
    );
  }

  const openCreateModal = () => {
    setEditingCategory(null);
    setCatName("");
    setCatRootGroup("FOOD");
    setCatSortOrder(String(categories.length));
    setCatIsActive(true);
    setModalOpen(true);
  };

  const openEditModal = (cat: PanelCategoryItem) => {
    setEditingCategory(cat);
    setCatName(cat.name);
    setCatRootGroup(cat.rootGroup);
    setCatSortOrder(String(cat.sortOrder));
    setCatIsActive(cat.isActive);
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (editingCategory) {
        const res = await apiFetch<{ category: PanelCategoryItem }>(
          `/api/panel/categories/${editingCategory.id}`,
          {
            method: "PATCH",
            body: JSON.stringify({
              name: catName.trim(),
              rootGroup: catRootGroup,
              sortOrder: Number.parseInt(catSortOrder, 10) || 0,
              isActive: catIsActive,
            }),
          },
        );
        setCategories((prev) =>
          prev
            .map((c) => (c.id === res.category.id ? res.category : c))
            .sort((a, b) => a.sortOrder - b.sortOrder),
        );
        showToast(`"${res.category.name}" kategorisi güncellendi.`);
      } else {
        const res = await apiFetch<{ category: PanelCategoryItem }>(
          "/api/panel/categories",
          {
            method: "POST",
            body: JSON.stringify({
              name: catName.trim(),
              rootGroup: catRootGroup,
              sortOrder: Number.parseInt(catSortOrder, 10) || 0,
              isActive: catIsActive,
            }),
          },
        );
        setCategories((prev) =>
          [...prev, res.category].sort((a, b) => a.sortOrder - b.sortOrder),
        );
        showToast(`"${res.category.name}" kategorisi oluşturuldu.`);
      }
      setModalOpen(false);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Kategori kaydedilemedi.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-4 rounded-2xl border border-[#E5D7C8] bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#24140E] sm:text-2xl">
            Kategori Yönetimi
          </h1>
          <p className="mt-1 text-xs text-[#6E5549]">
            Menü kategorilerini, sıralamalarını, ana gruplarını ve aktiflik
            durumlarını yönetin.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center gap-1.5 rounded-xl bg-[#2C1810] px-4 py-2.5 text-xs font-bold text-[#FAF3EA] shadow-sm hover:bg-[#412418]"
        >
          <FolderPlus className="h-4 w-4 text-[#D4A048]" />
          <span>Yeni Kategori Ekle</span>
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

      {/* Search & Group Filter */}
      <div className="flex flex-col gap-3 rounded-2xl border border-[#E5D7C8] bg-white p-4 shadow-sm sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8C7062]" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Kategori adı ara..."
            className="w-full rounded-xl border border-[#DAC8B8] bg-[#FAF6F0] py-2 pl-9 pr-3 text-sm text-[#24140E] placeholder:text-[#9A8172] focus:border-[#2C1810] focus:bg-white focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-1.5 rounded-xl bg-[#F5EDE3] p-1">
          {(
            [
              { key: "", label: "Tümü" },
              { key: "FOOD", label: "Tatlı / Yiyecek" },
              { key: "DRINK", label: "İçecekler" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.key || "ALL"}
              type="button"
              onClick={() => setRootFilter(tab.key)}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                rootFilter === tab.key
                  ? "bg-[#120D0C] text-[#FAF6F1]"
                  : "text-[#5C4338] hover:text-[#120D0C]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Categories Table */}
      {loading ? (
        <div className="space-y-2.5">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-14 animate-pulse rounded-2xl border border-[#E5D7C8] bg-white"
            />
          ))}
        </div>
      ) : filteredCategories.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#D6C4B2] bg-white p-10 text-center">
          <Tags className="mx-auto h-9 w-9 text-[#B99D88]" />
          <p className="mt-2 text-sm font-bold text-[#24140E]">
            Kategori bulunamadı
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[#E5D7C8] bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#FAF6F0] text-[#5C3D2E] border-b border-[#EFE5DA]">
                <tr>
                  <th className="px-4 py-3 font-bold">Sıra</th>
                  <th className="px-4 py-3 font-bold">Kategori Adı</th>
                  <th className="px-4 py-3 font-bold">Ana Grup</th>
                  <th className="px-4 py-3 font-bold">Ürün Sayısı</th>
                  <th className="px-4 py-3 font-bold">Durum</th>
                  <th className="px-4 py-3 font-bold text-right">İşlem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EFE5DA]">
                {filteredCategories.map((cat) => (
                  <tr key={cat.id} className="hover:bg-[#FCF9F5]">
                    <td className="px-4 py-3 font-mono font-semibold text-[#6E5549]">
                      #{cat.sortOrder}
                    </td>
                    <td className="px-4 py-3 text-sm font-bold text-[#24140E]">
                      {cat.name}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                          cat.rootGroup === "FOOD"
                            ? "bg-amber-100 text-amber-900"
                            : "bg-sky-100 text-sky-900"
                        }`}
                      >
                        {cat.rootGroup === "FOOD"
                          ? "Tatlı / Yiyecek"
                          : "İçecek"}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-semibold text-[#4A3429] tabular-nums">
                      {productCountByCategory.get(cat.id) ?? 0} ürün
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                          cat.isActive
                            ? "bg-emerald-100 text-emerald-900"
                            : "bg-neutral-200 text-neutral-700"
                        }`}
                      >
                        {cat.isActive ? "Aktif" : "Pasif"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => openEditModal(cat)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-[#DAC8B8] bg-white px-3 py-1.5 text-xs font-semibold text-[#4A3429] hover:bg-[#FAF5EE]"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                        <span>Düzenle</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create / Edit Modal */}
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
            className="w-full max-w-md rounded-2xl border border-[#E5D7C8] bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-[#24140E]">
                {editingCategory ? "Kategoriyi Düzenle" : "Yeni Kategori"}
              </h2>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-lg p-1.5 text-[#7A6256] hover:bg-[#FAF5EE]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#4A3429]">
                  Kategori Adı
                </label>
                <input
                  type="text"
                  required
                  minLength={2}
                  value={catName}
                  onChange={(e) => setCatName(e.target.value)}
                  placeholder="Örn: İmzalı Çikolatalar"
                  className="mt-1.5 w-full rounded-xl border border-[#DAC8B8] px-3 py-2 text-sm focus:border-[#2C1810] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#4A3429]">
                    Ana Grup
                  </label>
                  <select
                    value={catRootGroup}
                    onChange={(e) =>
                      setCatRootGroup(e.target.value as RootGroup)
                    }
                    className="mt-1.5 w-full rounded-xl border border-[#DAC8B8] px-3 py-2 text-sm focus:border-[#2C1810] focus:outline-none"
                  >
                    <option value="FOOD">Tatlı / Yiyecek</option>
                    <option value="DRINK">İçecekler</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#4A3429]">
                    Sıralama
                  </label>
                  <input
                    type="number"
                    value={catSortOrder}
                    onChange={(e) => setCatSortOrder(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-[#DAC8B8] px-3 py-2 text-sm focus:border-[#2C1810] focus:outline-none"
                  />
                </div>
              </div>

              <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-bold text-[#24140E]">
                <input
                  type="checkbox"
                  checked={catIsActive}
                  onChange={(e) => setCatIsActive(e.target.checked)}
                  className="h-4 w-4 accent-[#2C1810]"
                />
                <span>Kategori Aktif</span>
              </label>

              <div className="flex justify-end gap-2 pt-2">
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
                  className="rounded-xl bg-[#2C1810] px-4 py-2 text-xs font-bold text-[#FAF3EA] hover:bg-[#412418] disabled:opacity-50"
                >
                  {saving ? "Kaydediliyor..." : "Kaydet"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
