"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  BarChart3,
  Calendar,
  Package,
  Search,
  ShoppingBag,
  Store,
  TrendingUp,
} from "lucide-react";
import { usePanelAuth } from "@/components/panel/PanelAuthContext";
import { apiFetch, formatTRY } from "@/components/panel/panel-utils";

interface ReportBranchLite {
  id: string;
  name: string;
  slug: string;
  courierEnabled: boolean;
}

interface ReportBranchRow {
  branchId: string;
  branchName: string;
  orderCount: number;
  totalRevenue: number;
  itemQuantity: number;
  avgOrderValue: number;
  sharePercent: number;
}

interface ReportProductRow {
  productName: string;
  categoryName: string;
  quantity: number;
  revenue: number;
  orderCount: number;
}

interface ReportDayRow {
  date: string;
  orderCount: number;
  revenue: number;
}

interface ReportPayload {
  from: string;
  to: string;
  branches: ReportBranchLite[];
  summary: {
    totalRevenue: number;
    orderCount: number;
    avgOrderValue: number;
    totalItemQuantity: number;
  };
  byBranch: ReportBranchRow[];
  byProduct: ReportProductRow[];
  byDay: ReportDayRow[];
}

type RangePreset = "15d" | "1m" | "3m" | "custom";

function formatDateInput(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function getPresetBounds(preset: Exclude<RangePreset, "custom">): {
  from: string;
  to: string;
} {
  const now = new Date();
  const days = preset === "15d" ? 14 : preset === "1m" ? 29 : 89;
  const start = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  return {
    from: formatDateInput(start),
    to: formatDateInput(now),
  };
}

export default function PanelReportsPage() {
  const { user } = usePanelAuth();
  const isAdmin = user?.role === "ADMIN";

  const initialBounds = useMemo(() => getPresetBounds("15d"), []);
  const [preset, setPreset] = useState<RangePreset>("15d");
  const [fromDate, setFromDate] = useState(initialBounds.from);
  const [toDate, setToDate] = useState(initialBounds.to);
  const [branchId, setBranchId] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [productSort, setProductSort] = useState<"revenue" | "quantity">(
    "revenue",
  );

  const [report, setReport] = useState<ReportPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({
        from: fromDate,
        to: toDate,
      });
      if (isAdmin && branchId) {
        qs.set("branchId", branchId);
      }
      const data = await apiFetch<ReportPayload>(
        `/api/panel/reports?${qs.toString()}`,
        { cache: "no-store" },
      );
      setReport(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Rapor verileri alınamadı.");
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate, branchId, isAdmin]);

  useEffect(() => {
    void loadReport();
  }, [loadReport]);

  const handleSelectPreset = (next: Exclude<RangePreset, "custom">) => {
    const bounds = getPresetBounds(next);
    setPreset(next);
    setFromDate(bounds.from);
    setToDate(bounds.to);
  };

  const filteredProducts = useMemo(() => {
    if (!report) return [];
    const q = productSearch.trim().toLocaleLowerCase("tr-TR");
    const list = report.byProduct.filter((p) => {
      if (!q) return true;
      return (
        p.productName.toLocaleLowerCase("tr-TR").includes(q) ||
        p.categoryName.toLocaleLowerCase("tr-TR").includes(q)
      );
    });
    return [...list].sort((a, b) =>
      productSort === "quantity"
        ? b.quantity - a.quantity || b.revenue - a.revenue
        : b.revenue - a.revenue || b.quantity - a.quantity,
    );
  }, [report, productSearch, productSort]);

  const maxDayRevenue = useMemo(() => {
    if (!report || report.byDay.length === 0) return 1;
    return Math.max(1, ...report.byDay.map((d) => d.revenue));
  }, [report]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 rounded-2xl border border-[#E5D7C8] bg-white p-5 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#24140E] sm:text-2xl">
            Satış &amp; Performans Raporları
          </h1>
          <p className="mt-1 text-xs text-[#6E5549]">
            {isAdmin
              ? "Şube ve ürün bazlı ciro, sipariş hacmi ve satış dağılımını tarih aralığına göre inceleyin."
              : `${user?.branchName || "Şubeniz"} için tarih bazlı satış ve ürün performansını inceleyin.`}
          </p>
        </div>

        {/* Branch Filter for Admin */}
        {isAdmin && report && report.branches.length > 0 && (
          <div className="flex items-center gap-2">
            <Store className="h-4 w-4 text-[#B47D3B] shrink-0" />
            <select
              aria-label="Şube Filtresi"
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
              className="rounded-xl border border-[#DAC8B8] bg-[#FAF6F0] px-3.5 py-2 text-xs font-bold text-[#24140E] focus:outline-none"
            >
              <option value="">Tüm Şubeler</option>
              {report.branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Quick Range & Custom Date Picker */}
      <div className="rounded-2xl border border-[#E5D7C8] bg-white p-4 shadow-sm flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#5C3D2E] mr-1">
            <Calendar className="h-4 w-4 text-[#B47D3B]" />
            Hızlı Tarih:
          </span>
          {(
            [
              { id: "15d", label: "Son 15 Gün" },
              { id: "1m", label: "Son 1 Ay" },
              { id: "3m", label: "Son 3 Ay" },
            ] as const
          ).map((btn) => (
            <button
              key={btn.id}
              type="button"
              onClick={() => handleSelectPreset(btn.id)}
              className={`rounded-xl border px-3.5 py-2 text-xs font-bold transition ${
                preset === btn.id
                  ? "border-[#120D0C] bg-[#120D0C] text-[#FAF6F1]"
                  : "border-[#DAC8B8] bg-[#FAF6F0] text-[#4A3429] hover:border-[#D4A048]"
              }`}
            >
              {btn.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setPreset("custom")}
            className={`rounded-xl border px-3.5 py-2 text-xs font-bold transition ${
              preset === "custom"
                ? "border-[#120D0C] bg-[#120D0C] text-[#FAF6F1]"
                : "border-[#DAC8B8] bg-[#FAF6F0] text-[#4A3429] hover:border-[#D4A048]"
            }`}
          >
            Özel Tarih Aralığı
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="text-xs font-semibold text-[#6E5549]">
            Başlangıç:
            <input
              type="date"
              value={fromDate}
              max={toDate}
              onChange={(e) => {
                setPreset("custom");
                setFromDate(e.target.value);
              }}
              className="ml-1.5 rounded-lg border border-[#DAC8B8] bg-[#FAF6F0] px-2.5 py-1.5 text-xs font-semibold text-[#24140E]"
            />
          </label>
          <label className="text-xs font-semibold text-[#6E5549]">
            Bitiş:
            <input
              type="date"
              value={toDate}
              min={fromDate}
              onChange={(e) => {
                setPreset("custom");
                setToDate(e.target.value);
              }}
              className="ml-1.5 rounded-lg border border-[#DAC8B8] bg-[#FAF6F0] px-2.5 py-1.5 text-xs font-semibold text-[#24140E]"
            />
          </label>
        </div>
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

      {loading || !report ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-28 animate-pulse rounded-2xl border border-[#E5D7C8] bg-white"
            />
          ))}
        </div>
      ) : (
        <>
          {/* Summary KPIs */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-[#E5D7C8] bg-white p-5 shadow-xs">
              <div className="flex items-center justify-between text-xs font-bold text-[#6E5549]">
                <span>Toplam Ciro</span>
                <TrendingUp className="h-4 w-4 text-[#D4A048]" />
              </div>
              <div className="mt-2 text-2xl font-black text-[#120D0C] tabular-nums">
                {formatTRY(report.summary.totalRevenue)}
              </div>
              <div className="mt-1 text-[11px] text-[#8C7062]">
                {report.from} — {report.to}
              </div>
            </div>

            <div className="rounded-2xl border border-[#E5D7C8] bg-white p-5 shadow-xs">
              <div className="flex items-center justify-between text-xs font-bold text-[#6E5549]">
                <span>Ödenen Sipariş</span>
                <ShoppingBag className="h-4 w-4 text-emerald-700" />
              </div>
              <div className="mt-2 text-2xl font-black text-[#120D0C] tabular-nums">
                {report.summary.orderCount}
              </div>
              <div className="mt-1 text-[11px] text-[#8C7062]">
                PayTR onaylı siparişler
              </div>
            </div>

            <div className="rounded-2xl border border-[#E5D7C8] bg-white p-5 shadow-xs">
              <div className="flex items-center justify-between text-xs font-bold text-[#6E5549]">
                <span>Ortalama Sepet</span>
                <BarChart3 className="h-4 w-4 text-[#6B4E71]" />
              </div>
              <div className="mt-2 text-2xl font-black text-[#120D0C] tabular-nums">
                {formatTRY(report.summary.avgOrderValue)}
              </div>
              <div className="mt-1 text-[11px] text-[#8C7062]">
                Sipariş başı ortalama
              </div>
            </div>

            <div className="rounded-2xl border border-[#E5D7C8] bg-white p-5 shadow-xs">
              <div className="flex items-center justify-between text-xs font-bold text-[#6E5549]">
                <span>Satılan Ürün Adedi</span>
                <Package className="h-4 w-4 text-[#B47D3B]" />
              </div>
              <div className="mt-2 text-2xl font-black text-[#120D0C] tabular-nums">
                {report.summary.totalItemQuantity}
              </div>
              <div className="mt-1 text-[11px] text-[#8C7062]">
                {report.byProduct.length} farklı ürün satıldı
              </div>
            </div>
          </div>

          {/* Daily Trend Bar Chart */}
          {report.byDay.length > 0 && (
            <section className="rounded-2xl border border-[#E5D7C8] bg-white p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-[#24140E]">
                  Günlük Ciro Dağılımı
                </h2>
                <span className="text-xs text-[#7A6256]">
                  {report.byDay.length} aktif gün
                </span>
              </div>
              <div className="flex items-end gap-1.5 h-36 pt-4 overflow-x-auto">
                {report.byDay.map((d) => {
                  const pct = Math.max(
                    6,
                    Math.round((d.revenue / maxDayRevenue) * 100),
                  );
                  return (
                    <div
                      key={d.date}
                      title={`${d.date}: ${d.orderCount} sipariş • ${formatTRY(d.revenue)}`}
                      className="flex-1 min-w-[14px] flex flex-col items-center gap-1 group"
                    >
                      <div className="w-full flex items-end justify-center h-28">
                        <div
                          className="w-full max-w-[24px] rounded-t-md bg-[#D4A048] group-hover:bg-[#120D0C] transition-colors"
                          style={{ height: `${pct}%` }}
                        />
                      </div>
                      <span className="text-[9px] text-[#8C7062] rotate-0 truncate max-w-full">
                        {d.date.slice(5)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Branch Breakdown */}
          <section className="rounded-2xl border border-[#E5D7C8] bg-white p-5 shadow-sm space-y-4">
            <h2 className="text-base font-bold text-[#24140E]">
              Şube Bazlı Satış Raporu
            </h2>
            <div className="overflow-x-auto rounded-xl border border-[#EFE5DA]">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#FAF6F0] text-[#5C3D2E] border-b border-[#EFE5DA]">
                  <tr>
                    <th className="px-4 py-3 font-bold">Şube</th>
                    <th className="px-4 py-3 font-bold">Sipariş</th>
                    <th className="px-4 py-3 font-bold">Ürün Adedi</th>
                    <th className="px-4 py-3 font-bold">Ort. Sepet</th>
                    <th className="px-4 py-3 font-bold">Toplam Ciro</th>
                    <th className="px-4 py-3 font-bold">Ciro Payı</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EFE5DA]">
                  {report.byBranch.map((b) => (
                    <tr key={b.branchId} className="hover:bg-[#FCF9F5]">
                      <td className="px-4 py-3 font-bold text-[#24140E]">
                        {b.branchName}
                      </td>
                      <td className="px-4 py-3 tabular-nums font-semibold">
                        {b.orderCount}
                      </td>
                      <td className="px-4 py-3 tabular-nums">
                        {b.itemQuantity}
                      </td>
                      <td className="px-4 py-3 tabular-nums">
                        {formatTRY(b.avgOrderValue)}
                      </td>
                      <td className="px-4 py-3 tabular-nums font-black text-[#120D0C]">
                        {formatTRY(b.totalRevenue)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-24 rounded-full bg-[#EFE5DA] overflow-hidden">
                            <div
                              className="h-full bg-[#D4A048]"
                              style={{ width: `${b.sharePercent}%` }}
                            />
                          </div>
                          <span className="font-bold tabular-nums text-[#5C3D2E]">
                            %{b.sharePercent}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Product Breakdown */}
          <section className="rounded-2xl border border-[#E5D7C8] bg-white p-5 shadow-sm space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-base font-bold text-[#24140E]">
                Ürün Bazlı Satış Raporu ({filteredProducts.length})
              </h2>

              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#8C7062]" />
                  <input
                    type="search"
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    placeholder="Ürün veya kategori ara..."
                    className="rounded-xl border border-[#DAC8B8] bg-[#FAF6F0] py-1.5 pl-8 pr-3 text-xs text-[#24140E] focus:outline-none"
                  />
                </div>
                <select
                  value={productSort}
                  onChange={(e) =>
                    setProductSort(e.target.value as "revenue" | "quantity")
                  }
                  className="rounded-xl border border-[#DAC8B8] bg-[#FAF6F0] px-3 py-1.5 text-xs font-bold text-[#24140E]"
                >
                  <option value="revenue">Ciroya Göre Sırala</option>
                  <option value="quantity">Satış Adedine Göre</option>
                </select>
              </div>
            </div>

            {filteredProducts.length === 0 ? (
              <p className="py-6 text-center text-xs text-[#6E5549]">
                Seçilen tarih aralığında ürün satışı bulunamadı.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-[#EFE5DA]">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#FAF6F0] text-[#5C3D2E] border-b border-[#EFE5DA]">
                    <tr>
                      <th className="px-4 py-3 font-bold">Ürün</th>
                      <th className="px-4 py-3 font-bold">Kategori</th>
                      <th className="px-4 py-3 font-bold">Sipariş Sayısı</th>
                      <th className="px-4 py-3 font-bold">Satılan Adet</th>
                      <th className="px-4 py-3 font-bold text-right">
                        Toplam Ciro
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EFE5DA]">
                    {filteredProducts.map((p) => (
                      <tr key={p.productName} className="hover:bg-[#FCF9F5]">
                        <td className="px-4 py-3 font-bold text-[#24140E]">
                          {p.productName}
                        </td>
                        <td className="px-4 py-3 text-[#6E5549]">
                          {p.categoryName}
                        </td>
                        <td className="px-4 py-3 tabular-nums">
                          {p.orderCount}
                        </td>
                        <td className="px-4 py-3 tabular-nums font-bold text-[#24140E]">
                          {p.quantity}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums font-black text-[#120D0C]">
                          {formatTRY(p.revenue)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
