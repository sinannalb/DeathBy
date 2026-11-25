"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  Clock,
  MapPin,
  Search,
  Store,
} from "lucide-react";
import { FIXED_CITY } from "@/lib/istanbul-locations";
import { toStoredNeighborhood, useStore } from "./StoreProvider";
import type { NeighborhoodWithBranch } from "./types";
import { formatTl, normalizeTrText } from "./utils";

interface NeighborhoodPickerProps {
  onSelected?: () => void;
  compact?: boolean;
}

export function NeighborhoodPicker({
  onSelected,
  compact = false,
}: NeighborhoodPickerProps) {
  const {
    neighborhoods,
    neighborhoodsLoading,
    selectedNeighborhood,
    setSelectedNeighborhood,
    setOutOfServiceMessage,
    showToast,
  } = useStore();

  const [query, setQuery] = useState("");
  const [selectedDistrict, setSelectedDistrict] = useState<string>(
    selectedNeighborhood?.district || "",
  );
  const [selectedNbId, setSelectedNbId] = useState<string>(
    selectedNeighborhood?.neighborhoodId || "",
  );

  // Only show districts that have active neighborhoods entered in the panel
  const activeDistricts = useMemo(
    () =>
      Array.from(new Set(neighborhoods.map((n) => n.district))).sort((a, b) =>
        a.localeCompare(b, "tr"),
      ),
    [neighborhoods],
  );

  useEffect(() => {
    if (activeDistricts.length === 0) {
      setSelectedDistrict("");
      setSelectedNbId("");
      return;
    }
    if (!selectedDistrict || !activeDistricts.includes(selectedDistrict)) {
      setSelectedDistrict(activeDistricts[0]);
    }
  }, [activeDistricts, selectedDistrict]);

  const districtNeighborhoods = useMemo(
    () =>
      neighborhoods.filter(
        (n) =>
          !selectedDistrict ||
          normalizeTrText(n.district) === normalizeTrText(selectedDistrict),
      ),
    [neighborhoods, selectedDistrict],
  );

  useEffect(() => {
    if (districtNeighborhoods.length === 0) {
      setSelectedNbId("");
      return;
    }
    if (!districtNeighborhoods.some((n) => n.id === selectedNbId)) {
      setSelectedNbId(districtNeighborhoods[0].id);
    }
  }, [districtNeighborhoods, selectedNbId]);

  const groupedByDistrict = useMemo(() => {
    const q = normalizeTrText(query);
    const filtered = neighborhoods.filter((n) => {
      if (!q) return true;
      return (
        normalizeTrText(n.district).includes(q) ||
        normalizeTrText(n.neighborhood).includes(q) ||
        normalizeTrText(n.branch.name).includes(q)
      );
    });

    const groups = new Map<string, NeighborhoodWithBranch[]>();
    for (const item of filtered) {
      const key = `${item.district} (${item.city})`;
      const list = groups.get(key) ?? [];
      list.push(item);
      groups.set(key, list);
    }
    return Array.from(groups.entries());
  }, [neighborhoods, query]);

  function handlePickNeighborhood(item: NeighborhoodWithBranch) {
    if (!item.branch.courierEnabled) {
      const msg = `${item.branch.name} (${item.neighborhood}) için şu an kurye hizmeti bulunmamaktadır; yalnızca mağazadan Takeaway (Gel-Al) hizmet verilmektedir.`;
      setOutOfServiceMessage(msg);
      showToast(msg, "error");
      return;
    }

    setSelectedNeighborhood(toStoredNeighborhood(item));
    setOutOfServiceMessage(null);
    setSelectedDistrict(item.district);
    setSelectedNbId(item.id);
    showToast(
      `${item.neighborhood}, ${item.district} seçildi (${item.branch.name}).`,
      "success",
    );
    onSelected?.();
  }

  function handleApplyDropdown(e: React.FormEvent) {
    e.preventDefault();
    const chosen = neighborhoods.find((n) => n.id === selectedNbId);
    if (!chosen) return;
    handlePickNeighborhood(chosen);
  }

  if (neighborhoodsLoading) {
    return (
      <div className="space-y-3 py-4">
        <div className="h-10 rounded-xl bg-[#EFE6DC] animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <div className="h-20 rounded-xl bg-[#EFE6DC] animate-pulse" />
          <div className="h-20 rounded-xl bg-[#EFE6DC] animate-pulse" />
        </div>
      </div>
    );
  }

  if (neighborhoods.length === 0) {
    return (
      <div className="rounded-2xl border border-[#E6D9CB] bg-[#FAF6F1] p-5 text-center text-sm text-[#6E5245]">
        Şu an aktif teslimat bölgesi bulunmamaktadır.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {!selectedNeighborhood && (
        <div className="rounded-2xl border border-[#D4A048]/35 bg-[#FDF7EE] p-3.5 text-xs text-[#5C4338]">
          Sipariş verebilmek için sistemde tanımlı olan ilçe ve mahallelerden
          birini seçiniz. Kurye hizmeti olmayan şubeler yalnızca Takeaway
          olarak işaretlenmiştir.
        </div>
      )}

      {/* System-Defined District & Neighborhood Dropdown Selector */}
      <form
        onSubmit={handleApplyDropdown}
        className="rounded-2xl border border-[#E6D9CB] bg-[#FAF6F1] p-3.5 sm:p-4 space-y-3"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-bold text-[#120D0C]">
            Hızlı İlçe ve Mahalle Seçimi
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-[#241612] text-[#E8BD6D] text-[10px] font-bold px-2.5 py-0.5">
            <MapPin className="w-3 h-3" />
            Şehir: {FIXED_CITY}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <div>
            <label
              htmlFor="picker-district"
              className="block text-[11px] font-semibold uppercase tracking-wide text-[#5C4338] mb-1"
            >
              İlçe Seçin
            </label>
            <select
              id="picker-district"
              value={selectedDistrict}
              onChange={(e) => setSelectedDistrict(e.target.value)}
              className="w-full rounded-xl border border-[#DFD2C3] bg-white px-3 py-2 text-xs sm:text-sm text-[#120D0C] focus:outline-none focus:ring-2 focus:ring-[#D4A048]/40"
            >
              {activeDistricts.map((dist) => (
                <option key={dist} value={dist}>
                  {dist}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="picker-neighborhood"
              className="block text-[11px] font-semibold uppercase tracking-wide text-[#5C4338] mb-1"
            >
              Mahalle Seçin
            </label>
            <select
              id="picker-neighborhood"
              value={selectedNbId}
              onChange={(e) => setSelectedNbId(e.target.value)}
              className="w-full rounded-xl border border-[#DFD2C3] bg-white px-3 py-2 text-xs sm:text-sm text-[#120D0C] focus:outline-none focus:ring-2 focus:ring-[#D4A048]/40"
            >
              {districtNeighborhoods.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.neighborhood}
                  {!item.branch.courierEnabled ? " (Şu an kurye hizmeti yok)" : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              disabled={!selectedNbId}
              className="w-full rounded-xl bg-[#120D0C] hover:bg-[#241612] disabled:opacity-50 text-[#FAF6F1] text-xs sm:text-sm font-semibold px-4 py-2 transition-colors cursor-pointer"
            >
              Mahalleyi Seç
            </button>
          </div>
        </div>
      </form>

      {/* Search & System Neighborhood Cards */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="w-4 h-4 text-[#8A6F62] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="İlçe, mahalle veya şube ara..."
            className="w-full rounded-xl border border-[#DFD2C3] bg-white pl-10 pr-4 py-2.5 text-sm text-[#120D0C] placeholder:text-[#A89286] focus:outline-none focus:ring-2 focus:ring-[#D4A048]/40 focus:border-[#D4A048]"
          />
        </div>

        <div
          className={
            compact
              ? "space-y-4 max-h-64 overflow-y-auto pr-1"
              : "space-y-4 max-h-[48vh] overflow-y-auto pr-1"
          }
        >
          {groupedByDistrict.length === 0 ? (
            <p className="text-sm text-[#6E5245] py-4 text-center">
              Aramanızla eşleşen aktif mahalle bulunamadı.
            </p>
          ) : (
            groupedByDistrict.map(([districtLabel, list]) => (
              <div key={districtLabel} className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#7A5C4D]">
                    {districtLabel}
                  </h4>
                  <span className="text-[11px] text-[#8A6F62]">
                    {list[0]?.branch.name}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {list.map((item) => {
                    const isSelected =
                      selectedNeighborhood?.neighborhoodId === item.id;
                    const st = item.branch.status.effectiveStatus;
                    const courierOpen = item.branch.courierEnabled;

                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handlePickNeighborhood(item)}
                        className={`text-left rounded-2xl border p-3 transition-all cursor-pointer ${
                          !courierOpen
                            ? "border-[#E6D9CB] bg-[#FAF7F3] opacity-85 hover:border-[#6B4E71]/60"
                            : isSelected
                              ? "border-[#D4A048] bg-[#FDF4E7] ring-2 ring-[#D4A048]/25"
                              : "border-[#E6D9CB] bg-white hover:border-[#D4A048]/70 hover:bg-[#FFF9F2]"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <MapPin className="w-3.5 h-3.5 text-[#D4A048] shrink-0" />
                            <span className="font-semibold text-sm text-[#120D0C] truncate">
                              {item.neighborhood}
                            </span>
                          </div>
                          {!courierOpen ? (
                            <span className="rounded-full bg-[#6B4E71]/15 text-[#4C3452] text-[10px] font-bold px-2 py-0.5 shrink-0">
                              Kurye Hizmeti Yok (Takeaway)
                            </span>
                          ) : isSelected ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-[#D4A048] text-[#120D0C] text-[10px] font-bold px-2 py-0.5 shrink-0">
                              <Check className="w-3 h-3" /> Seçili
                            </span>
                          ) : st === "CLOSED" ? (
                            <span className="rounded-full bg-[#9E2A2B]/15 text-[#9E2A2B] text-[10px] font-bold px-2 py-0.5 shrink-0">
                              Kapalı
                            </span>
                          ) : st === "BUSY" ? (
                            <span className="rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 shrink-0">
                              Yoğun
                            </span>
                          ) : (
                            <span className="rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 shrink-0">
                              Kurye Açık
                            </span>
                          )}
                        </div>

                        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[#6E5245]">
                          <span className="inline-flex items-center gap-1">
                            <Store className="w-3 h-3 text-[#8A6F62]" />
                            {item.branch.name}
                          </span>
                          {courierOpen ? (
                            <span className="inline-flex items-center gap-1">
                              <Clock className="w-3 h-3 text-[#8A6F62]" />
                              {item.branch.status.estimatedMinMinutes}-
                              {item.branch.status.estimatedMaxMinutes} dk
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[#6B4E71] font-medium">
                              <AlertTriangle className="w-3 h-3" />
                              Şu an yalnızca mağazadan teslim
                            </span>
                          )}
                        </div>

                        {courierOpen && (
                          <div className="mt-1 text-[11px] text-[#8A6F62]">
                            Min. Sepet: {formatTl(item.minOrderAmount)} •
                            Teslimat:{" "}
                            {item.deliveryFee === 0
                              ? "Ücretsiz"
                              : formatTl(item.deliveryFee)}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
