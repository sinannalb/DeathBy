"use client";

import React, { useCallback, useEffect, useState } from "react";
import type { BranchManualStatus } from "@prisma/client";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Edit3,
  Flame,
  MapPin,
  Plus,
  Save,
  ShieldCheck,
  Store,
  Trash2,
  XCircle,
} from "lucide-react";
import { ConfirmDialog } from "@/components/panel/ConfirmDialog";
import { usePanelAuth } from "@/components/panel/PanelAuthContext";
import { QrMenuCard } from "@/components/panel/QrMenuCard";
import {
  apiFetch,
  formatDateTimeTR,
  formatTRY,
} from "@/components/panel/panel-utils";
import { DAY_OF_WEEK_LABELS } from "@/lib/constants";
import { FIXED_CITY, ISTANBUL_DISTRICTS } from "@/lib/istanbul-locations";
import type {
  BranchDetailDTO,
  BranchScheduleDTO,
  DeliveryNeighborhoodDTO,
} from "@/lib/types";

const ORDERED_DAYS = [1, 2, 3, 4, 5, 6, 0]; // Pazartesi -> Pazar

const MANUAL_MODES: Array<{
  value: "AUTO" | "FORCE_OPEN" | "FORCE_CLOSED";
  title: string;
  desc: string;
}> = [
  {
    value: "AUTO",
    title: "Otomatik Saatler",
    desc: "Haftalık açılış-kapanış saatlerine göre otomatik çalışır.",
  },
  {
    value: "FORCE_OPEN",
    title: "Manuel Açık",
    desc: "Çalışma saatleri dışında bile şubeyi açık tutar.",
  },
  {
    value: "FORCE_CLOSED",
    title: "Geçici / Manuel Kapalı",
    desc: "Şube geçici olarak yeni sipariş alımına kapatılır.",
  },
];

type DurationPreset = "30" | "60" | "90" | "UNLIMITED" | "KEEP";

export default function BranchStatusPage() {
  const { user } = usePanelAuth();
  const isAdmin = user?.role === "ADMIN";

  const [branches, setBranches] = useState<BranchDetailDTO[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Section 1: Operational status form
  const [manualStatus, setManualStatus] = useState<BranchManualStatus>("AUTO");
  const [isBusy, setIsBusy] = useState(false);
  const [courierEnabled, setCourierEnabled] = useState(true);
  const [durationPreset, setDurationPreset] = useState<DurationPreset>("60");
  const [busyMessage, setBusyMessage] = useState("");
  const [estMin, setEstMin] = useState(30);
  const [estMax, setEstMax] = useState(45);
  const [savingStatus, setSavingStatus] = useState(false);

  // Section 2 (Admin): Branch details & schedules
  const [branchPhone, setBranchPhone] = useState("");
  const [branchAddress, setBranchAddress] = useState("");
  const [branchActive, setBranchActive] = useState(true);
  const [schedules, setSchedules] = useState<BranchScheduleDTO[]>([]);
  const [savingSettings, setSavingSettings] = useState(false);

  // Section 3 (Admin): Neighborhoods
  const [newDistrict, setNewDistrict] = useState(ISTANBUL_DISTRICTS[0].district);
  const [newNeighborhood, setNewNeighborhood] = useState(
    ISTANBUL_DISTRICTS[0].neighborhoods[0],
  );
  const [customNeighborhoodText, setCustomNeighborhoodText] = useState("");
  const [newMinOrder, setNewMinOrder] = useState("250");
  const [newDeliveryFee, setNewDeliveryFee] = useState("0");
  const [addingNeighborhood, setAddingNeighborhood] = useState(false);

  const [pendingUpdateNeighborhood, setPendingUpdateNeighborhood] = useState<{
    existing: DeliveryNeighborhoodDTO;
    minOrderAmount: number;
    deliveryFee: number;
  } | null>(null);

  const [editingNeighborhoodId, setEditingNeighborhoodId] = useState<
    string | null
  >(null);
  const [editMinOrder, setEditMinOrder] = useState("");
  const [editDeliveryFee, setEditDeliveryFee] = useState("");
  const [editActive, setEditActive] = useState(true);
  const [savingNeighborhood, setSavingNeighborhood] = useState(false);
  const [deleteTarget, setDeleteTarget] =
    useState<DeliveryNeighborhoodDTO | null>(null);

  const syncFormFromBranch = useCallback((branch: BranchDetailDTO) => {
    setManualStatus(
      branch.manualStatus === "BUSY" ? "AUTO" : branch.manualStatus,
    );
    setIsBusy(branch.isBusy || branch.manualStatus === "BUSY");
    setCourierEnabled(branch.courierEnabled);
    setBusyMessage(branch.busyMessage ?? "");
    setDurationPreset(branch.busyUntil ? "KEEP" : "UNLIMITED");
    setEstMin(branch.estimatedMinMinutes);
    setEstMax(branch.estimatedMaxMinutes);

    setBranchPhone(branch.phone);
    setBranchAddress(branch.address);
    setBranchActive(branch.isActive);

    // Default district suggestion matching the selected branch
    const defaultDistrict =
      branch.slug === "kagithane"
        ? "Kağıthane"
        : branch.slug === "rumeli-hisari"
          ? "Sarıyer"
          : branch.neighborhoods[0]?.district || "Beşiktaş";
    const foundDist =
      ISTANBUL_DISTRICTS.find((d) => d.district === defaultDistrict) ??
      ISTANBUL_DISTRICTS[0];
    setNewDistrict(foundDist.district);
    setNewNeighborhood(foundDist.neighborhoods[0] ?? "__CUSTOM__");
    setCustomNeighborhoodText("");

    const scheduleMap = new Map(
      branch.schedules.map((s) => [s.dayOfWeek, s]),
    );
    const fullSchedules: BranchScheduleDTO[] = ORDERED_DAYS.map((day) => {
      const existing = scheduleMap.get(day);
      return (
        existing ?? {
          id: `temp-${day}`,
          dayOfWeek: day,
          openTime: "10:00",
          closeTime: "23:00",
          isClosed: false,
        }
      );
    });
    setSchedules(fullSchedules);
    setEditingNeighborhoodId(null);
  }, []);

  const loadBranches = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<{ branches: BranchDetailDTO[] }>(
        "/api/panel/branches",
        { cache: "no-store" },
      );
      setBranches(data.branches);
      if (data.branches.length > 0) {
        const chosen =
          data.branches.find((b) => b.id === selectedBranchId) ??
          data.branches[0];
        setSelectedBranchId(chosen.id);
        syncFormFromBranch(chosen);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Şube bilgileri yüklenemedi.",
      );
    } finally {
      setLoading(false);
    }
  }, [selectedBranchId, syncFormFromBranch]);

  useEffect(() => {
    void loadBranches();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currentBranch =
    branches.find((b) => b.id === selectedBranchId) ?? branches[0] ?? null;

  const handleSelectBranch = (branch: BranchDetailDTO) => {
    setSelectedBranchId(branch.id);
    syncFormFromBranch(branch);
    setSuccessMsg(null);
    setError(null);
  };

  const replaceBranchInState = (updated: BranchDetailDTO) => {
    setBranches((prev) =>
      prev.map((b) => (b.id === updated.id ? updated : b)),
    );
    syncFormFromBranch(updated);
  };

  const showToast = (msg: string) => {
    setSuccessMsg(msg);
    window.setTimeout(() => setSuccessMsg(null), 4000);
  };

  const handleSaveStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentBranch) return;
    setError(null);
    setSuccessMsg(null);

    if (estMin > estMax) {
      setError("Minimum teslimat süresi maksimum süreden büyük olamaz.");
      return;
    }

    const hasTimedMode = isBusy || manualStatus === "FORCE_CLOSED";
    let busyUntilPayload: string | null | undefined;
    if (!hasTimedMode) {
      busyUntilPayload = null;
    } else if (durationPreset === "30") {
      busyUntilPayload = new Date(Date.now() + 30 * 60_000).toISOString();
    } else if (durationPreset === "60") {
      busyUntilPayload = new Date(Date.now() + 60 * 60_000).toISOString();
    } else if (durationPreset === "90") {
      busyUntilPayload = new Date(Date.now() + 90 * 60_000).toISOString();
    } else if (durationPreset === "UNLIMITED") {
      busyUntilPayload = null;
    } else {
      busyUntilPayload = currentBranch.busyUntil;
    }

    setSavingStatus(true);
    try {
      const data = await apiFetch<{ branch: BranchDetailDTO }>(
        `/api/panel/branches/${currentBranch.id}/status`,
        {
          method: "PATCH",
          body: JSON.stringify({
            manualStatus: manualStatus === "BUSY" ? "AUTO" : manualStatus,
            isBusy,
            courierEnabled,
            busyUntil: busyUntilPayload,
            busyMessage: !hasTimedMode ? null : busyMessage.trim() || null,
            estimatedMinMinutes: estMin,
            estimatedMaxMinutes: estMax,
          }),
        },
      );
      replaceBranchInState(data.branch);
      showToast(`${data.branch.name} şube operasyon durumu güncellendi.`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Şube durumu güncellenemedi.",
      );
    } finally {
      setSavingStatus(false);
    }
  };

  const handleSaveAdminSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentBranch || !isAdmin) return;
    setError(null);
    setSuccessMsg(null);
    setSavingSettings(true);

    try {
      const data = await apiFetch<{ branch: BranchDetailDTO }>(
        `/api/panel/branches/${currentBranch.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            phone: branchPhone.trim(),
            address: branchAddress.trim(),
            isActive: branchActive,
            schedules: schedules.map((s) => ({
              dayOfWeek: s.dayOfWeek,
              openTime: s.openTime,
              closeTime: s.closeTime,
              isClosed: s.isClosed,
            })),
          }),
        },
      );
      replaceBranchInState(data.branch);
      showToast(
        `${data.branch.name} şube ayarları ve çalışma saatleri kaydedildi.`,
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Şube ayarları kaydedilemedi.",
      );
    } finally {
      setSavingSettings(false);
    }
  };

  const handleScheduleChange = (
    dayOfWeek: number,
    patch: Partial<BranchScheduleDTO>,
  ) => {
    setSchedules((prev) =>
      prev.map((s) => (s.dayOfWeek === dayOfWeek ? { ...s, ...patch } : s)),
    );
  };

  const handleAddNeighborhood = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentBranch || !isAdmin) return;
    const finalNb =
      newNeighborhood === "__CUSTOM__"
        ? customNeighborhoodText.trim()
        : newNeighborhood.trim();
    if (!finalNb) {
      setError("Lütfen mahalle seçiniz veya yazınız.");
      return;
    }

    const nextMinOrder = Number(newMinOrder) || 0;
    const nextDeliveryFee = Number(newDeliveryFee) || 0;

    // If neighborhood already exists in this branch, ask confirmation to update the existing row
    const existingMatch = currentBranch.neighborhoods.find(
      (n) =>
        n.city.toLocaleLowerCase("tr-TR") ===
          FIXED_CITY.toLocaleLowerCase("tr-TR") &&
        n.district.toLocaleLowerCase("tr-TR") ===
          newDistrict.trim().toLocaleLowerCase("tr-TR") &&
        n.neighborhood.toLocaleLowerCase("tr-TR") ===
          finalNb.toLocaleLowerCase("tr-TR"),
    );

    if (existingMatch) {
      setPendingUpdateNeighborhood({
        existing: existingMatch,
        minOrderAmount: nextMinOrder,
        deliveryFee: nextDeliveryFee,
      });
      return;
    }

    setError(null);
    setAddingNeighborhood(true);

    try {
      const data = await apiFetch<{ neighborhood: DeliveryNeighborhoodDTO }>(
        `/api/panel/branches/${currentBranch.id}/neighborhoods`,
        {
          method: "POST",
          body: JSON.stringify({
            city: FIXED_CITY,
            district: newDistrict.trim(),
            neighborhood: finalNb,
            minOrderAmount: nextMinOrder,
            deliveryFee: nextDeliveryFee,
            isActive: true,
          }),
        },
      );

      setBranches((prev) =>
        prev.map((b) =>
          b.id === currentBranch.id
            ? {
                ...b,
                neighborhoods: [...b.neighborhoods, data.neighborhood].sort(
                  (a, c) => a.neighborhood.localeCompare(c.neighborhood, "tr"),
                ),
              }
            : b,
        ),
      );
      setCustomNeighborhoodText("");
      setNewMinOrder("250");
      setNewDeliveryFee("0");
      showToast(`"${data.neighborhood.neighborhood}" mahallesi eklendi.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Mahalle eklenemedi.");
    } finally {
      setAddingNeighborhood(false);
    }
  };

  const handleConfirmUpdateExistingNeighborhood = async () => {
    if (!currentBranch || !isAdmin || !pendingUpdateNeighborhood) return;
    const { existing, minOrderAmount, deliveryFee } = pendingUpdateNeighborhood;
    setSavingNeighborhood(true);
    setError(null);
    try {
      const data = await apiFetch<{ neighborhood: DeliveryNeighborhoodDTO }>(
        `/api/panel/branches/${currentBranch.id}/neighborhoods`,
        {
          method: "PATCH",
          body: JSON.stringify({
            neighborhoodId: existing.id,
            minOrderAmount,
            deliveryFee,
            isActive: true,
          }),
        },
      );
      setBranches((prev) =>
        prev.map((b) =>
          b.id === currentBranch.id
            ? {
                ...b,
                neighborhoods: b.neighborhoods.map((item) =>
                  item.id === existing.id ? data.neighborhood : item,
                ),
              }
            : b,
        ),
      );
      setPendingUpdateNeighborhood(null);
      setCustomNeighborhoodText("");
      showToast(`"${existing.neighborhood}" mahalle bilgileri güncellendi.`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Mahalle güncellenemedi.",
      );
    } finally {
      setSavingNeighborhood(false);
    }
  };

  const startEditNeighborhood = (n: DeliveryNeighborhoodDTO) => {
    setEditingNeighborhoodId(n.id);
    setEditMinOrder(String(n.minOrderAmount));
    setEditDeliveryFee(String(n.deliveryFee));
    setEditActive(n.isActive);
  };

  const handleSaveNeighborhoodEdit = async (n: DeliveryNeighborhoodDTO) => {
    if (!currentBranch || !isAdmin) return;
    setSavingNeighborhood(true);
    setError(null);
    try {
      const data = await apiFetch<{ neighborhood: DeliveryNeighborhoodDTO }>(
        `/api/panel/branches/${currentBranch.id}/neighborhoods`,
        {
          method: "PATCH",
          body: JSON.stringify({
            neighborhoodId: n.id,
            minOrderAmount: Number(editMinOrder) || 0,
            deliveryFee: Number(editDeliveryFee) || 0,
            isActive: editActive,
          }),
        },
      );
      setBranches((prev) =>
        prev.map((b) =>
          b.id === currentBranch.id
            ? {
                ...b,
                neighborhoods: b.neighborhoods.map((item) =>
                  item.id === n.id ? data.neighborhood : item,
                ),
              }
            : b,
        ),
      );
      setEditingNeighborhoodId(null);
      showToast(`"${n.neighborhood}" güncellendi.`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Mahalle güncellenemedi.",
      );
    } finally {
      setSavingNeighborhood(false);
    }
  };

  const handleToggleNeighborhoodActive = async (
    n: DeliveryNeighborhoodDTO,
  ) => {
    if (!currentBranch || !isAdmin) return;
    setError(null);
    try {
      const data = await apiFetch<{ neighborhood: DeliveryNeighborhoodDTO }>(
        `/api/panel/branches/${currentBranch.id}/neighborhoods`,
        {
          method: "PATCH",
          body: JSON.stringify({
            neighborhoodId: n.id,
            isActive: !n.isActive,
          }),
        },
      );
      setBranches((prev) =>
        prev.map((b) =>
          b.id === currentBranch.id
            ? {
                ...b,
                neighborhoods: b.neighborhoods.map((item) =>
                  item.id === n.id ? data.neighborhood : item,
                ),
              }
            : b,
        ),
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Mahalle durumu değiştirilemedi.",
      );
    }
  };

  const handleDeleteNeighborhood = async (n: DeliveryNeighborhoodDTO) => {
    if (!currentBranch || !isAdmin) return;
    setSavingNeighborhood(true);
    setError(null);
    try {
      await apiFetch<{ ok: boolean }>(
        `/api/panel/branches/${currentBranch.id}/neighborhoods?neighborhoodId=${encodeURIComponent(
          n.id,
        )}`,
        { method: "DELETE" },
      );
      setBranches((prev) =>
        prev.map((b) =>
          b.id === currentBranch.id
            ? {
                ...b,
                neighborhoods: b.neighborhoods.filter(
                  (item) => item.id !== n.id,
                ),
              }
            : b,
        ),
      );
      setDeleteTarget(null);
      showToast(`"${n.neighborhood}" silindi.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Mahalle silinemedi.");
    } finally {
      setSavingNeighborhood(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-24 animate-pulse rounded-2xl bg-white" />
        <div className="h-72 animate-pulse rounded-2xl bg-white" />
      </div>
    );
  }

  if (!currentBranch) {
    return (
      <div className="rounded-2xl border border-[#E5D7C8] bg-white p-8 text-center">
        <p className="text-sm font-semibold text-[#6E5549]">
          Yönetilecek şube bulunamadı.
        </p>
      </div>
    );
  }

  const effectiveBadge =
    currentBranch.status.effectiveStatus === "OPEN"
      ? {
          label: "SİPARİŞE AÇIK",
          cls: "bg-emerald-100 text-emerald-900 border-emerald-300",
          icon: CheckCircle2,
        }
      : currentBranch.status.effectiveStatus === "BUSY"
        ? {
            label: "YOĞUN SAATLER",
            cls: "bg-amber-100 text-amber-900 border-amber-300",
            icon: Flame,
          }
        : {
            label: "KAPALI",
            cls: "bg-rose-100 text-rose-900 border-rose-300",
            icon: XCircle,
          };

  const StatusIcon = effectiveBadge.icon;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 rounded-2xl border border-[#E5D7C8] bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#24140E] sm:text-2xl">
            Şube Durumu {isAdmin ? "& Ayarları" : ""}
          </h1>
          <p className="mt-1 text-xs text-[#6E5549]">
            {isAdmin
              ? "Şubelerin sipariş kabul durumunu, çalışma saatlerini, termal fiş genişliğini ve teslimat mahallelerini yönetin."
              : "Şubenizin anlık sipariş kabul durumunu ve tahmini teslimat süresini güncelleyin."}
          </p>
        </div>

        {isAdmin && branches.length > 1 && (
          <div className="flex flex-wrap gap-2">
            {branches.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => handleSelectBranch(b)}
                className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-xs font-bold transition ${
                  b.id === currentBranch.id
                    ? "border-[#2C1810] bg-[#2C1810] text-[#FAF3EA]"
                    : "border-[#DAC8B8] bg-[#FAF6F0] text-[#4A3429] hover:bg-[#F2E8DC]"
                }`}
              >
                <Store className="h-3.5 w-3.5" />
                <span>{b.name}</span>
              </button>
            ))}
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

      {successMsg && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-900">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Live Effective Status Summary */}
      <div className="rounded-2xl border border-[#E5D7C8] bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <h2 className="text-lg font-bold text-[#24140E]">
                {currentBranch.name}
              </h2>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold ${effectiveBadge.cls}`}
              >
                <StatusIcon className="h-3.5 w-3.5" />
                {effectiveBadge.label}
              </span>
              <span
                className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-bold ${
                  currentBranch.courierEnabled
                    ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                    : "border-purple-300 bg-purple-50 text-purple-900"
                }`}
              >
                {currentBranch.courierEnabled
                  ? "Kurye Teslimatı Açık"
                  : "Sadece Takeaway (Gel-Al)"}
              </span>
            </div>
            <p className="text-xs text-[#5C463B]">
              {currentBranch.status.reason}
              {currentBranch.status.nextOpenText
                ? ` • ${currentBranch.status.nextOpenText}`
                : ""}
            </p>
            {currentBranch.busyUntil && (
              <p className="text-xs font-semibold text-amber-800">
                Geçerlilik Bitişi: {formatDateTimeTR(currentBranch.busyUntil)}
              </p>
            )}
          </div>

          <div className="rounded-xl border border-[#EFE5DA] bg-[#FAF6F0] px-4 py-2.5 text-right">
            <div className="text-[11px] font-semibold text-[#7A6256]">
              Tahmini Teslimat
            </div>
            <div className="text-base font-black text-[#24140E]">
              {currentBranch.estimatedMinMinutes}–
              {currentBranch.estimatedMaxMinutes} dk
            </div>
          </div>
        </div>
      </div>

      {/* Section 1: Operational Status (SYSTEM & ADMIN) */}
      <form
        onSubmit={handleSaveStatus}
        className="rounded-2xl border border-[#E5D7C8] bg-white p-5 shadow-sm space-y-5"
      >
        <div className="flex items-center gap-2 border-b border-[#EFE5DA] pb-3">
          <Clock className="h-5 w-5 text-[#B47D3B]" />
          <div>
            <h2 className="text-base font-bold text-[#24140E]">
              Operasyonel Şube Durumu
            </h2>
            <p className="text-xs text-[#6E5549]">
              Yoğunluk veya geçici kapatma durumlarında anlık güncelleme yapın.
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {MANUAL_MODES.map((mode) => {
            const selected = manualStatus === mode.value;
            return (
              <button
                key={mode.value}
                type="button"
                onClick={() => setManualStatus(mode.value)}
                className={`rounded-xl border p-3.5 text-left transition ${
                  selected
                    ? "border-[#2C1810] bg-[#FAF3EA] ring-2 ring-[#D9A76A]"
                    : "border-[#E5D7C8] bg-white hover:border-[#C89B63] hover:bg-[#FAF6F0]"
                }`}
              >
                <div className="text-sm font-bold text-[#24140E]">
                  {mode.title}
                </div>
                <p className="mt-1 text-xs leading-snug text-[#6E5549]">
                  {mode.desc}
                </p>
              </button>
            );
          })}
        </div>

        {/* Independent Toggles: Yoğun Saatler (Aç/Kapat) & Kurye Teslimatı (Aç/Kapat) */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex items-center justify-between gap-4 rounded-xl border border-[#E5D7C8] bg-[#FAF6F0] p-4">
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5 text-sm font-bold text-[#24140E]">
                <Flame className="h-4 w-4 text-amber-600" />
                <span>Yoğun Saatler</span>
              </div>
              <p className="text-xs text-[#6E5549]">
                Açık olduğunda müşteriye yoğunluk uyarısı gösterilir.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={isBusy}
              onClick={() => setIsBusy((v) => !v)}
              className={`inline-flex min-w-[110px] items-center justify-between gap-2 rounded-xl border px-3 py-2 text-xs font-bold transition ${
                isBusy
                  ? "border-amber-500 bg-amber-500 text-white"
                  : "border-[#DAC8B8] bg-white text-[#5C4338]"
              }`}
            >
              <span>{isBusy ? "Açık" : "Kapalı"}</span>
              <span
                className={`inline-flex h-4 w-8 items-center rounded-full p-0.5 transition ${
                  isBusy ? "bg-white/30" : "bg-[#DFCFC0]"
                }`}
              >
                <span
                  className={`h-3 w-3 rounded-full bg-white shadow transition-transform ${
                    isBusy ? "translate-x-4" : "translate-x-0"
                  }`}
                />
              </span>
            </button>
          </div>

          <div className="flex items-center justify-between gap-4 rounded-xl border border-[#E5D7C8] bg-[#FAF6F0] p-4">
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5 text-sm font-bold text-[#24140E]">
                <Store className="h-4 w-4 text-emerald-700" />
                <span>Kurye Teslimatı</span>
              </div>
              <p className="text-xs text-[#6E5549]">
                Kapalıysa şube yalnızca mağazadan Takeaway hizmet verir.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={courierEnabled}
              onClick={() => setCourierEnabled((v) => !v)}
              className={`inline-flex min-w-[110px] items-center justify-between gap-2 rounded-xl border px-3 py-2 text-xs font-bold transition ${
                courierEnabled
                  ? "border-emerald-600 bg-emerald-600 text-white"
                  : "border-purple-300 bg-purple-100 text-purple-900"
              }`}
            >
              <span>{courierEnabled ? "Açık" : "Takeaway"}</span>
              <span
                className={`inline-flex h-4 w-8 items-center rounded-full p-0.5 transition ${
                  courierEnabled ? "bg-white/30" : "bg-purple-300"
                }`}
              >
                <span
                  className={`h-3 w-3 rounded-full bg-white shadow transition-transform ${
                    courierEnabled ? "translate-x-4" : "translate-x-0"
                  }`}
                />
              </span>
            </button>
          </div>
        </div>

        {(isBusy || manualStatus === "FORCE_CLOSED") && (
          <div className="grid gap-4 rounded-xl border border-[#E5D7C8] bg-[#FAF6F0] p-4 md:grid-cols-2">
            <div>
              <label className="block text-xs font-bold text-[#4A3429]">
                Geçerlilik Süresi
              </label>
              <div className="mt-2 flex flex-wrap gap-2">
                {(
                  [
                    { key: "30", label: "30 dk" },
                    { key: "60", label: "60 dk" },
                    { key: "90", label: "90 dk" },
                    { key: "UNLIMITED", label: "Süresiz" },
                  ] as const
                ).map((preset) => (
                  <button
                    key={preset.key}
                    type="button"
                    onClick={() => setDurationPreset(preset.key)}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-bold transition ${
                      durationPreset === preset.key
                        ? "border-[#2C1810] bg-[#2C1810] text-[#FAF3EA]"
                        : "border-[#DAC8B8] bg-white text-[#4A3429] hover:bg-[#F5ECE0]"
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              {durationPreset === "KEEP" && currentBranch.busyUntil && (
                <p className="mt-1.5 text-[11px] font-medium text-[#6E5549]">
                  Mevcut bitiş saati korunacak:{" "}
                  {formatDateTimeTR(currentBranch.busyUntil)}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="busy-message"
                className="block text-xs font-bold text-[#4A3429]"
              >
                Müşteriye Gösterilecek Mesaj (İsteğe Bağlı)
              </label>
              <input
                id="busy-message"
                type="text"
                maxLength={300}
                value={busyMessage}
                onChange={(e) => setBusyMessage(e.target.value)}
                placeholder={
                  isBusy
                    ? "Örn: Yoğunluk nedeniyle teslimat 45-60 dk sürebilir."
                    : "Örn: Kısa süreli bakım nedeniyle 19:00'da tekrar açılıyoruz."
                }
                className="mt-1.5 w-full rounded-xl border border-[#DAC8B8] bg-white px-3 py-2 text-sm text-[#24140E] focus:border-[#2C1810] focus:outline-none"
              />
            </div>
          </div>
        )}

        {/* Estimated Delivery Minutes */}
        <div className="grid gap-4 sm:grid-cols-2 max-w-md">
          <div>
            <label
              htmlFor="est-min"
              className="block text-xs font-bold text-[#4A3429]"
            >
              Min. Teslimat Süresi (dk)
            </label>
            <input
              id="est-min"
              type="number"
              min={5}
              max={240}
              required
              value={estMin}
              onChange={(e) => setEstMin(Number(e.target.value))}
              className="mt-1.5 w-full rounded-xl border border-[#DAC8B8] bg-white px-3 py-2 text-sm font-semibold text-[#24140E] focus:border-[#2C1810] focus:outline-none"
            />
          </div>
          <div>
            <label
              htmlFor="est-max"
              className="block text-xs font-bold text-[#4A3429]"
            >
              Maks. Teslimat Süresi (dk)
            </label>
            <input
              id="est-max"
              type="number"
              min={5}
              max={300}
              required
              value={estMax}
              onChange={(e) => setEstMax(Number(e.target.value))}
              className="mt-1.5 w-full rounded-xl border border-[#DAC8B8] bg-white px-3 py-2 text-sm font-semibold text-[#24140E] focus:border-[#2C1810] focus:outline-none"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={savingStatus}
            className="inline-flex items-center gap-2 rounded-xl bg-[#2C1810] px-5 py-2.5 text-sm font-bold text-[#FAF3EA] shadow-sm transition hover:bg-[#412418] disabled:opacity-50"
          >
            <Save className="h-4 w-4 text-[#D9A76A]" />
            <span>
              {savingStatus ? "Kaydediliyor..." : "Şube Durumunu Güncelle"}
            </span>
          </button>
        </div>
      </form>

      {/* Section 2 (ADMIN ONLY): Schedules, Paper Width & Branch Contact */}
      {isAdmin && (
        <form
          onSubmit={handleSaveAdminSettings}
          className="rounded-2xl border border-[#E5D7C8] bg-white p-5 shadow-sm space-y-5"
        >
          <div className="flex items-center justify-between gap-2 border-b border-[#EFE5DA] pb-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-[#B47D3B]" />
              <div>
                <h2 className="text-base font-bold text-[#24140E]">
                  Şube Ayarları &amp; Çalışma Saatleri
                </h2>
                <p className="text-xs text-[#6E5549]">
                  Yalnızca Yönetici (Admin) tarafından düzenlenebilir.
                </p>
              </div>
            </div>
            <span className="rounded-full bg-[#F5ECE2] px-2.5 py-1 text-[11px] font-bold text-[#5C3D2E]">
              Admin Yetkisi
            </span>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label
                htmlFor="branch-phone"
                className="block text-xs font-bold text-[#4A3429]"
              >
                Şube Telefonu
              </label>
              <input
                id="branch-phone"
                type="text"
                required
                value={branchPhone}
                onChange={(e) => setBranchPhone(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-[#DAC8B8] bg-white px-3 py-2 text-sm text-[#24140E] focus:border-[#2C1810] focus:outline-none"
              />
            </div>

            <div className="flex flex-wrap items-end gap-3 pb-1">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-[#DAC8B8] bg-[#FAF6F0] px-3 py-2 text-xs font-bold text-[#24140E]">
                <input
                  type="checkbox"
                  checked={branchActive}
                  onChange={(e) => setBranchActive(e.target.checked)}
                  className="h-4 w-4 rounded accent-[#2C1810]"
                />
                <span>Şube Aktif</span>
              </label>
            </div>
          </div>

          <div>
            <label
              htmlFor="branch-address"
              className="block text-xs font-bold text-[#4A3429]"
            >
              Şube Adresi
            </label>
            <input
              id="branch-address"
              type="text"
              required
              value={branchAddress}
              onChange={(e) => setBranchAddress(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-[#DAC8B8] bg-white px-3 py-2 text-sm text-[#24140E] focus:border-[#2C1810] focus:outline-none"
            />
          </div>

          {/* 7-day Schedule Table */}
          <div>
            <h3 className="mb-2.5 text-xs font-bold uppercase tracking-wider text-[#5C3D2E]">
              Haftalık Otomatik Açılış / Kapanış Saatleri
            </h3>
            <div className="overflow-x-auto rounded-xl border border-[#E5D7C8]">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#FAF6F0] text-[#5C3D2E]">
                  <tr>
                    <th className="px-4 py-2.5 font-bold">Gün</th>
                    <th className="px-4 py-2.5 font-bold">Durum</th>
                    <th className="px-4 py-2.5 font-bold">Açılış</th>
                    <th className="px-4 py-2.5 font-bold">Kapanış</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EFE5DA]">
                  {schedules.map((sched) => (
                    <tr key={sched.dayOfWeek} className="bg-white">
                      <td className="px-4 py-2.5 font-bold text-[#24140E]">
                        {DAY_OF_WEEK_LABELS[sched.dayOfWeek]}
                      </td>
                      <td className="px-4 py-2.5">
                        <label className="inline-flex cursor-pointer items-center gap-2 font-semibold text-[#4A3429]">
                          <input
                            type="checkbox"
                            checked={!sched.isClosed}
                            onChange={(e) =>
                              handleScheduleChange(sched.dayOfWeek, {
                                isClosed: !e.target.checked,
                              })
                            }
                            className="h-4 w-4 accent-emerald-700"
                          />
                          <span>Açık</span>
                        </label>
                      </td>
                      <td className="px-4 py-2.5">
                        <input
                          type="time"
                          disabled={sched.isClosed}
                          value={sched.openTime}
                          onChange={(e) =>
                            handleScheduleChange(sched.dayOfWeek, {
                              openTime: e.target.value,
                            })
                          }
                          className="rounded-lg border border-[#DAC8B8] px-2.5 py-1 text-xs font-semibold disabled:bg-neutral-100 disabled:text-neutral-400"
                        />
                      </td>
                      <td className="px-4 py-2.5">
                        <input
                          type="time"
                          disabled={sched.isClosed}
                          value={sched.closeTime}
                          onChange={(e) =>
                            handleScheduleChange(sched.dayOfWeek, {
                              closeTime: e.target.value,
                            })
                          }
                          className="rounded-lg border border-[#DAC8B8] px-2.5 py-1 text-xs font-semibold disabled:bg-neutral-100 disabled:text-neutral-400"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={savingSettings}
              className="inline-flex items-center gap-2 rounded-xl bg-[#2C1810] px-5 py-2.5 text-sm font-bold text-[#FAF3EA] shadow-sm transition hover:bg-[#412418] disabled:opacity-50"
            >
              <Save className="h-4 w-4 text-[#D9A76A]" />
              <span>
                {savingSettings
                  ? "Kaydediliyor..."
                  : "Şube Ayarlarını Kaydet"}
              </span>
            </button>
          </div>
        </form>
      )}

      {/* Section 3 (ADMIN ONLY): Delivery Neighborhoods */}
      {isAdmin && (
        <section className="rounded-2xl border border-[#E5D7C8] bg-white p-5 shadow-sm space-y-5">
          <div className="flex items-center gap-2 border-b border-[#EFE5DA] pb-3">
            <MapPin className="h-5 w-5 text-[#B47D3B]" />
            <div>
              <h2 className="text-base font-bold text-[#24140E]">
                Teslimat Mahalleleri ({currentBranch.neighborhoods.length})
              </h2>
              <p className="text-xs text-[#6E5549]">
                Bu şubenin hizmet verdiği mahalleleri, minimum sepet tutarını ve
                teslimat ücretini yönetin.
              </p>
            </div>
          </div>

          {/* Add Neighborhood Form */}
          <form
            onSubmit={handleAddNeighborhood}
            className="grid gap-3 rounded-xl border border-[#E5D7C8] bg-[#FAF6F0] p-4 sm:grid-cols-2 lg:grid-cols-6"
          >
            <div>
              <label className="block text-[11px] font-bold text-[#4A3429]">
                İl (Sabit)
              </label>
              <div className="mt-1 w-full rounded-lg border border-[#DAC8B8] bg-[#EFE5DA] px-2.5 py-1.5 text-xs font-bold text-[#4A3429]">
                {FIXED_CITY}
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[#4A3429]">
                İlçe
              </label>
              <select
                value={newDistrict}
                onChange={(e) => {
                  const dist = e.target.value;
                  setNewDistrict(dist);
                  const found = ISTANBUL_DISTRICTS.find(
                    (d) => d.district === dist,
                  );
                  setNewNeighborhood(found?.neighborhoods[0] ?? "__CUSTOM__");
                }}
                className="mt-1 w-full rounded-lg border border-[#DAC8B8] bg-white px-2.5 py-1.5 text-xs"
              >
                {ISTANBUL_DISTRICTS.map((d) => (
                  <option key={d.district} value={d.district}>
                    {d.district}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[#4A3429]">
                Mahalle
              </label>
              <select
                value={newNeighborhood}
                onChange={(e) => setNewNeighborhood(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#DAC8B8] bg-white px-2.5 py-1.5 text-xs"
              >
                {(
                  ISTANBUL_DISTRICTS.find((d) => d.district === newDistrict)
                    ?.neighborhoods ?? []
                ).map((nb) => (
                  <option key={nb} value={nb}>
                    {nb}
                  </option>
                ))}
                <option value="__CUSTOM__">+ Özel Mahalle Yaz...</option>
              </select>
              {newNeighborhood === "__CUSTOM__" && (
                <input
                  type="text"
                  required
                  placeholder="Mahalle adı yazın"
                  value={customNeighborhoodText}
                  onChange={(e) => setCustomNeighborhoodText(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-[#DAC8B8] bg-white px-2.5 py-1.5 text-xs"
                />
              )}
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[#4A3429]">
                Min. Sepet (₺)
              </label>
              <input
                type="number"
                min={0}
                step="0.01"
                required
                value={newMinOrder}
                onChange={(e) => setNewMinOrder(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#DAC8B8] bg-white px-2.5 py-1.5 text-xs"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[#4A3429]">
                Teslimat Ücreti (₺)
              </label>
              <input
                type="number"
                min={0}
                step="0.01"
                required
                value={newDeliveryFee}
                onChange={(e) => setNewDeliveryFee(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#DAC8B8] bg-white px-2.5 py-1.5 text-xs"
              />
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                disabled={addingNeighborhood}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#2C1810] px-3 py-2 text-xs font-bold text-[#FAF3EA] hover:bg-[#412418] disabled:opacity-50"
              >
                <Plus className="h-3.5 w-3.5 text-[#D9A76A]" />
                <span>{addingNeighborhood ? "Ekleniyor..." : "Mahalle Ekle"}</span>
              </button>
            </div>
          </form>

          {/* Neighborhoods Table */}
          <div className="overflow-x-auto rounded-xl border border-[#E5D7C8]">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#FAF6F0] text-[#5C3D2E]">
                <tr>
                  <th className="px-4 py-2.5 font-bold">Mahalle</th>
                  <th className="px-4 py-2.5 font-bold">İlçe / İl</th>
                  <th className="px-4 py-2.5 font-bold">Min. Sepet</th>
                  <th className="px-4 py-2.5 font-bold">Teslimat Ücreti</th>
                  <th className="px-4 py-2.5 font-bold">Durum</th>
                  <th className="px-4 py-2.5 font-bold text-right">İşlem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EFE5DA]">
                {currentBranch.neighborhoods.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-8 text-center text-[#7A6256]"
                    >
                      Bu şube için tanımlı mahalle yok.
                    </td>
                  </tr>
                ) : (
                  currentBranch.neighborhoods.map((n) => {
                    const isEditing = editingNeighborhoodId === n.id;
                    return (
                      <tr key={n.id} className="bg-white">
                        <td className="px-4 py-2.5 font-bold text-[#24140E]">
                          {n.neighborhood}
                        </td>
                        <td className="px-4 py-2.5 text-[#5C463B]">
                          {n.district} / {n.city}
                        </td>
                        <td className="px-4 py-2.5 tabular-nums">
                          {isEditing ? (
                            <input
                              type="number"
                              min={0}
                              step="0.01"
                              value={editMinOrder}
                              onChange={(e) => setEditMinOrder(e.target.value)}
                              className="w-24 rounded-lg border border-[#DAC8B8] px-2 py-1 text-xs"
                            />
                          ) : (
                            formatTRY(n.minOrderAmount)
                          )}
                        </td>
                        <td className="px-4 py-2.5 tabular-nums">
                          {isEditing ? (
                            <input
                              type="number"
                              min={0}
                              step="0.01"
                              value={editDeliveryFee}
                              onChange={(e) =>
                                setEditDeliveryFee(e.target.value)
                              }
                              className="w-24 rounded-lg border border-[#DAC8B8] px-2 py-1 text-xs"
                            />
                          ) : n.deliveryFee === 0 ? (
                            <span className="font-semibold text-emerald-700">
                              Ücretsiz
                            </span>
                          ) : (
                            formatTRY(n.deliveryFee)
                          )}
                        </td>
                        <td className="px-4 py-2.5">
                          {isEditing ? (
                            <label className="inline-flex items-center gap-1.5 font-semibold">
                              <input
                                type="checkbox"
                                checked={editActive}
                                onChange={(e) =>
                                  setEditActive(e.target.checked)
                                }
                              />
                              <span>{editActive ? "Aktif" : "Pasif"}</span>
                            </label>
                          ) : (
                            <button
                              type="button"
                              onClick={() =>
                                void handleToggleNeighborhoodActive(n)
                              }
                              className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold transition ${
                                n.isActive
                                  ? "bg-emerald-100 text-emerald-900 hover:bg-emerald-200"
                                  : "bg-neutral-200 text-neutral-700 hover:bg-neutral-300"
                              }`}
                            >
                              {n.isActive ? "Aktif" : "Pasif"}
                            </button>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          {isEditing ? (
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                disabled={savingNeighborhood}
                                onClick={() =>
                                  void handleSaveNeighborhoodEdit(n)
                                }
                                className="rounded-lg bg-emerald-700 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-emerald-800"
                              >
                                Kaydet
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingNeighborhoodId(null)}
                                className="rounded-lg border border-[#DAC8B8] px-2.5 py-1 text-[11px] font-semibold text-[#5C463B]"
                              >
                                İptal
                              </button>
                            </div>
                          ) : (
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => startEditNeighborhood(n)}
                                className="rounded-lg border border-[#DAC8B8] p-1.5 text-[#4A3429] hover:bg-[#FAF5EE]"
                                title="Düzenle"
                              >
                                <Edit3 className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeleteTarget(n)}
                                className="rounded-lg border border-rose-200 p-1.5 text-rose-700 hover:bg-rose-50"
                                title="Sil"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* QR Menu & Downloadable QR Code */}
      <QrMenuCard
        branchName={currentBranch.name}
        branchSlug={currentBranch.slug}
      />

      {/* Update Existing Neighborhood Confirmation */}
      <ConfirmDialog
        open={Boolean(pendingUpdateNeighborhood)}
        variant="primary"
        title="Mahalle Zaten Kayıtlı — Güncellensin mi?"
        description={
          pendingUpdateNeighborhood
            ? `"${pendingUpdateNeighborhood.existing.neighborhood}" (${pendingUpdateNeighborhood.existing.district}) mahallesi zaten aşağıda mevcut. Onaylarsanız mevcut satır güncellenecektir: Min. Sepet ${formatTRY(
                pendingUpdateNeighborhood.existing.minOrderAmount,
              )} → ${formatTRY(
                pendingUpdateNeighborhood.minOrderAmount,
              )} • Teslimat Ücreti ${formatTRY(
                pendingUpdateNeighborhood.existing.deliveryFee,
              )} → ${formatTRY(pendingUpdateNeighborhood.deliveryFee)}.`
            : ""
        }
        confirmLabel="Satırı Güncelle"
        loading={savingNeighborhood}
        onCancel={() => setPendingUpdateNeighborhood(null)}
        onConfirm={() => {
          void handleConfirmUpdateExistingNeighborhood();
        }}
      />

      {/* Delete Neighborhood Confirmation */}
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Mahalleyi Sil"
        description={
          deleteTarget
            ? `"${deleteTarget.neighborhood}" (${deleteTarget.district}) mahallesini bu şubeden silmek istediğinize emin misiniz?`
            : ""
        }
        confirmLabel="Sil"
        loading={savingNeighborhood}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) {
            void handleDeleteNeighborhood(deleteTarget);
          }
        }}
      />
    </div>
  );
}
