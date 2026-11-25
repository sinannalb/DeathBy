"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { OrderStatus } from "@prisma/client";
import {
  Bell,
  BellOff,
  CheckCircle2,
  ChefHat,
  Clock,
  CreditCard,
  ExternalLink,
  MapPin,
  MessageSquareWarning,
  Navigation,
  Phone,
  Printer,
  RefreshCw,
  Store,
  Truck,
  User,
  Volume2,
  XCircle,
} from "lucide-react";
import { ConfirmDialog } from "@/components/panel/ConfirmDialog";
import { usePanelAuth } from "@/components/panel/PanelAuthContext";
import {
  apiFetch,
  formatDateTimeTR,
  formatElapsedTR,
  formatTimeTR,
  formatTRY,
  ORDER_STATUS_BADGE_CLASS,
  playNewOrderChime,
} from "@/components/panel/panel-utils";
import type { BranchDetailDTO, OrderDTO } from "@/lib/types";

type FilterTabKey =
  | "ACTIVE"
  | "RECEIVED"
  | "PREPARING"
  | "WAITING_COURIER"
  | "ON_THE_WAY"
  | "COMPLETED"
  | "CANCELLED";

const ACTIVE_STATUSES: OrderStatus[] = [
  "RECEIVED",
  "PREPARING",
  "WAITING_COURIER",
  "ON_THE_WAY",
];

const NEXT_STATUS_ACTION: Partial<
  Record<OrderStatus, { next: OrderStatus; label: string }>
> = {
  RECEIVED: { next: "PREPARING", label: "Manuel Hazırlanıyor'a Al" },
  PREPARING: { next: "WAITING_COURIER", label: "Kurye Bekleniyor'a Al" },
  WAITING_COURIER: { next: "ON_THE_WAY", label: "Kurye Yola Çıktı" },
  ON_THE_WAY: { next: "COMPLETED", label: "Sipariş Tamamlandı" },
};

const SOUND_STORAGE_KEY = "dbc_panel_sound_enabled";

export default function LiveOrdersPage() {
  const { user } = usePanelAuth();
  const isAdmin = user?.role === "ADMIN";

  const [orders, setOrders] = useState<OrderDTO[]>([]);
  const [branches, setBranches] = useState<BranchDetailDTO[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>("");
  const [activeTab, setActiveTab] = useState<FilterTabKey>("ACTIVE");

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [soundBanner, setSoundBanner] = useState<string | null>(null);
  const [newOrderNotice, setNewOrderNotice] = useState<string | null>(null);

  const [busyOrderId, setBusyOrderId] = useState<string | null>(null);
  const [popupFallbackOrderId, setPopupFallbackOrderId] = useState<string | null>(
    null,
  );
  const [cancelTarget, setCancelTarget] = useState<OrderDTO | null>(null);

  const knownOrderIdsRef = useRef<Set<string> | null>(null);
  const soundEnabledRef = useRef(soundEnabled);
  soundEnabledRef.current = soundEnabled;

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(SOUND_STORAGE_KEY);
      if (saved === "false") {
        setSoundEnabled(false);
      }
    } catch {
      // ignore storage errors
    }
  }, []);

  const toggleSound = async () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    try {
      window.localStorage.setItem(SOUND_STORAGE_KEY, String(next));
    } catch {
      // ignore
    }
    if (next) {
      const ok = await playNewOrderChime();
      setSoundBanner(
        ok
          ? "Sesli uyarı açıldı ve ses sistemi etkinleştirildi."
          : "Sesli uyarı açıldı.",
      );
      window.setTimeout(() => setSoundBanner(null), 3000);
    }
  };

  const handleTestSound = async () => {
    const ok = await playNewOrderChime();
    setSoundBanner(
      ok
        ? "Test sesi çalındı — yeni siparişlerde uyarı aktif."
        : "Tarayıcı ses çalmayı engelledi.",
    );
    window.setTimeout(() => setSoundBanner(null), 3500);
  };

  // Fetch branches once for Admin dropdown
  useEffect(() => {
    if (!isAdmin) return;
    let active = true;
    apiFetch<{ branches: BranchDetailDTO[] }>("/api/panel/branches")
      .then((res) => {
        if (active) setBranches(res.branches);
      })
      .catch(() => {
        // non-fatal for orders board
      });
    return () => {
      active = false;
    };
  }, [isAdmin]);

  const fetchOrders = useCallback(
    async (opts?: { manual?: boolean; resetKnown?: boolean }) => {
      if (opts?.manual) setRefreshing(true);
      try {
        const params = new URLSearchParams();
        if (isAdmin && selectedBranchId) {
          params.set("branchId", selectedBranchId);
        }
        const query = params.toString();
        const url = query ? `/api/panel/orders?${query}` : "/api/panel/orders";
        const data = await apiFetch<{ orders: OrderDTO[] }>(url, {
          cache: "no-store",
        });

        const incoming = data.orders;

        if (opts?.resetKnown || knownOrderIdsRef.current === null) {
          knownOrderIdsRef.current = new Set(incoming.map((o) => o.id));
        } else {
          const newReceived = incoming.filter(
            (o) =>
              o.status === "RECEIVED" && !knownOrderIdsRef.current!.has(o.id),
          );
          for (const o of incoming) {
            knownOrderIdsRef.current.add(o.id);
          }

          if (newReceived.length > 0) {
            const first = newReceived[0];
            setNewOrderNotice(
              newReceived.length === 1
                ? `Yeni sipariş geldi: #${first.orderNumber} (${first.branchName})`
                : `${newReceived.length} yeni sipariş geldi!`,
            );
            if (soundEnabledRef.current) {
              void playNewOrderChime();
            }
          }
        }

        setOrders(incoming);
        setError(null);
        setLastUpdated(new Date());
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Siparişler yüklenemedi.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [isAdmin, selectedBranchId],
  );

  // Initial load + branch filter change
  useEffect(() => {
    knownOrderIdsRef.current = null;
    void fetchOrders({ resetKnown: true });
  }, [fetchOrders]);

  // 5-second polling
  useEffect(() => {
    const timer = window.setInterval(() => {
      void fetchOrders();
    }, 5000);
    return () => window.clearInterval(timer);
  }, [fetchOrders]);

  // Elapsed-time ticker every 30s
  useEffect(() => {
    const ticker = window.setInterval(() => {
      setNowMs(Date.now());
    }, 30000);
    return () => window.clearInterval(ticker);
  }, []);

  const counts = useMemo(() => {
    const map: Record<FilterTabKey, number> = {
      ACTIVE: 0,
      RECEIVED: 0,
      PREPARING: 0,
      WAITING_COURIER: 0,
      ON_THE_WAY: 0,
      COMPLETED: 0,
      CANCELLED: 0,
    };

    for (const order of orders) {
      if (ACTIVE_STATUSES.includes(order.status)) {
        map.ACTIVE += 1;
      }
      if (order.status in map) {
        map[order.status as FilterTabKey] += 1;
      }
    }
    return map;
  }, [orders]);

  const filteredOrders = useMemo(() => {
    if (activeTab === "ACTIVE") {
      return orders.filter((o) => ACTIVE_STATUSES.includes(o.status));
    }
    return orders.filter((o) => o.status === activeTab);
  }, [orders, activeTab]);

  const tabs: Array<{ key: FilterTabKey; label: string; count: number }> = [
    { key: "ACTIVE", label: "Tümü (Aktif)", count: counts.ACTIVE },
    { key: "RECEIVED", label: "Sipariş Alındı", count: counts.RECEIVED },
    { key: "PREPARING", label: "Hazırlanıyor", count: counts.PREPARING },
    {
      key: "WAITING_COURIER",
      label: "Kurye Bekleniyor",
      count: counts.WAITING_COURIER,
    },
    { key: "ON_THE_WAY", label: "Yola Çıktı", count: counts.ON_THE_WAY },
    { key: "COMPLETED", label: "Tamamlandı", count: counts.COMPLETED },
    ...(isAdmin
      ? [
          {
            key: "CANCELLED" as const,
            label: "İptal",
            count: counts.CANCELLED,
          },
        ]
      : []),
  ];

  const handlePrintOrder = async (order: OrderDTO) => {
    setBusyOrderId(order.id);
    setPopupFallbackOrderId(null);

    // Open window synchronously before await to avoid browser popup blockers
    const printUrl = `/panel/yazdir/${order.id}?autoprint=1`;
    const printWindow = window.open("", "_blank");

    try {
      const data = await apiFetch<{ order: OrderDTO }>(
        `/api/panel/orders/${order.id}/print`,
        { method: "POST" },
      );

      setOrders((prev) =>
        prev.map((item) => (item.id === order.id ? data.order : item)),
      );

      if (printWindow) {
        printWindow.location.href = printUrl;
      } else {
        setPopupFallbackOrderId(order.id);
      }
    } catch (err) {
      if (printWindow) {
        printWindow.close();
      }
      setError(
        err instanceof Error
          ? err.message
          : "Fiş yazdırılırken bir hata oluştu.",
      );
    } finally {
      setBusyOrderId(null);
    }
  };

  const handleTransitionStatus = async (
    order: OrderDTO,
    nextStatus: OrderStatus,
  ) => {
    setBusyOrderId(order.id);
    try {
      const data = await apiFetch<{ order: OrderDTO }>(
        `/api/panel/orders/${order.id}/status`,
        {
          method: "PATCH",
          body: JSON.stringify({ status: nextStatus }),
        },
      );
      setOrders((prev) =>
        prev.map((item) => (item.id === order.id ? data.order : item)),
      );
      setNewOrderNotice(null);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Sipariş durumu güncellenemedi.",
      );
    } finally {
      setBusyOrderId(null);
      setCancelTarget(null);
    }
  };

  return (
    <div className="space-y-5">
      {/* Top Bar */}
      <div className="flex flex-col gap-4 rounded-2xl border border-[#E5D7C8] bg-white p-4 shadow-sm sm:p-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold text-[#24140E] sm:text-2xl">
              Canlı Siparişler
            </h1>
            {counts.RECEIVED > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500 px-2.5 py-0.5 text-xs font-bold text-white animate-pulse">
                {counts.RECEIVED} Yeni
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-[#6E5549]">
            5 saniyede bir otomatik güncellenir.{" "}
            {lastUpdated && (
              <span className="font-medium text-[#4A3429]">
                Son kontrol:{" "}
                {lastUpdated.toLocaleTimeString("tr-TR", {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })}
              </span>
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Admin Branch Filter */}
          {isAdmin && (
            <div className="flex items-center gap-1.5 rounded-xl border border-[#DAC8B8] bg-[#FAF6F0] px-3 py-1.5">
              <Store className="h-4 w-4 text-[#8C6239]" />
              <label htmlFor="branch-filter" className="sr-only">
                Şube Filtresi
              </label>
              <select
                id="branch-filter"
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchId(e.target.value)}
                className="bg-transparent text-xs font-semibold text-[#24140E] focus:outline-none"
              >
                <option value="">Tüm Şubeler</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Sound Toggle */}
          <button
            type="button"
            onClick={() => void toggleSound()}
            className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition ${
              soundEnabled
                ? "border-emerald-300 bg-emerald-50 text-emerald-900 hover:bg-emerald-100"
                : "border-[#DAC8B8] bg-[#FAF6F0] text-[#6E5549] hover:bg-[#F2E9DE]"
            }`}
          >
            {soundEnabled ? (
              <Bell className="h-3.5 w-3.5 text-emerald-700" />
            ) : (
              <BellOff className="h-3.5 w-3.5" />
            )}
            <span>Sesli Uyarı: {soundEnabled ? "Açık" : "Kapalı"}</span>
          </button>

          {/* Test Sound Button */}
          <button
            type="button"
            onClick={() => void handleTestSound()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#DAC8B8] bg-white px-3 py-2 text-xs font-semibold text-[#4A3429] transition hover:bg-[#FAF5EE]"
            title="Tarayıcı ses sistemini etkinleştir ve test et"
          >
            <Volume2 className="h-3.5 w-3.5 text-[#B47D3B]" />
            <span>Sesi Test Et</span>
          </button>

          {/* Manual Refresh */}
          <button
            type="button"
            onClick={() => void fetchOrders({ manual: true })}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#2C1810] px-3.5 py-2 text-xs font-bold text-[#FAF3EA] transition hover:bg-[#412418] disabled:opacity-60"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`}
            />
            <span>Yenile</span>
          </button>
        </div>
      </div>

      {/* Banners */}
      {soundBanner && (
        <div className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2.5 text-xs font-semibold text-emerald-900">
          {soundBanner}
        </div>
      )}

      {newOrderNotice && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-400 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-950 shadow-sm">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-amber-700 animate-bounce" />
            <span>{newOrderNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setNewOrderNotice(null)}
            className="text-xs font-semibold text-amber-800 underline hover:text-amber-950"
          >
            Kapat
          </button>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-800"
        >
          {error}
        </div>
      )}

      {/* Status Filter Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {tabs.map((tab) => {
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`inline-flex shrink-0 items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-semibold transition ${
                active
                  ? "border-[#2C1810] bg-[#2C1810] text-[#FAF3EA] shadow-sm"
                  : "border-[#E2D4C5] bg-white text-[#4A3429] hover:border-[#C89B63] hover:bg-[#FAF5EE]"
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                  active
                    ? "bg-[#D9A76A] text-[#1F110B]"
                    : tab.key === "RECEIVED" && tab.count > 0
                      ? "bg-amber-500 text-white"
                      : "bg-[#F2E8DD] text-[#5C4337]"
                }`}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Orders Grid */}
      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2, 3, 4].map((skeleton) => (
            <div
              key={skeleton}
              className="h-64 animate-pulse rounded-2xl border border-[#E5D7C8] bg-white/70 p-5"
            />
          ))}
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#D6C4B2] bg-white p-12 text-center">
          <ChefHat className="mx-auto h-10 w-10 text-[#B99D88]" />
          <h2 className="mt-3 text-base font-bold text-[#24140E]">
            Bu görünümde sipariş bulunmuyor
          </h2>
          <p className="mt-1 text-xs text-[#6E5549]">
            Yeni bir PayTR ödemeli sipariş geldiğinde sesli uyarı ile burada
            listelenecektir.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {filteredOrders.map((order) => {
            const isReceived = order.status === "RECEIVED";
            const nextAction = NEXT_STATUS_ACTION[order.status];
            const isBusy = busyOrderId === order.id;
            const canCancel =
              isAdmin &&
              order.status !== "COMPLETED" &&
              order.status !== "CANCELLED";

            return (
              <article
                key={order.id}
                className={`flex flex-col justify-between rounded-2xl border bg-white p-5 shadow-sm transition ${
                  isReceived
                    ? "border-amber-400 ring-2 ring-amber-300/60"
                    : "border-[#E5D7C8]"
                }`}
              >
                <div className="space-y-4">
                  {/* Card Header */}
                  <div className="flex flex-wrap items-start justify-between gap-2 border-b border-[#EFE5DA] pb-3.5">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-lg font-black tracking-tight text-[#24140E]">
                          #{order.orderNumber}
                        </span>
                        <span
                          className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${
                            ORDER_STATUS_BADGE_CLASS[order.status]
                          }`}
                        >
                          {order.statusLabel}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#F5ECE2] px-2.5 py-0.5 text-[11px] font-semibold text-[#5C3D2E]">
                          <Store className="h-3 w-3 text-[#B47D3B]" />
                          {order.branchName}
                        </span>
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-[#6E5549]">
                        <span className="inline-flex items-center gap-1 font-medium">
                          <Clock className="h-3.5 w-3.5 text-[#9C7A63]" />
                          {formatElapsedTR(order.createdAt, nowMs)} (
                          {formatDateTimeTR(order.createdAt)})
                        </span>
                        {order.printedAt && (
                          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 border border-emerald-200">
                            <CheckCircle2 className="h-3 w-3" />
                            Fiş Yazdırıldı ({formatTimeTR(order.printedAt)})
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-lg font-black text-[#24140E] tabular-nums">
                        {formatTRY(order.totalAmount)}
                      </div>
                      <div className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-900">
                        <CreditCard className="h-3 w-3" />
                        {order.paymentStatus === "PAID"
                          ? "PayTR Online Ödendi"
                          : order.paymentStatusLabel}
                      </div>
                    </div>
                  </div>

                  {/* Customer & Address Block */}
                  <div className="rounded-xl border border-[#EFE5DA] bg-[#FAF6F0] p-3.5 space-y-1.5 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 font-bold text-[#24140E]">
                        <User className="h-3.5 w-3.5 text-[#8C6239]" />
                        <span>{order.customerName}</span>
                      </div>
                      <a
                        href={`tel:${order.customerPhone}`}
                        className="inline-flex items-center gap-1 font-semibold text-[#5C3D2E] hover:underline"
                      >
                        <Phone className="h-3.5 w-3.5 text-[#8C6239]" />
                        {order.customerPhone}
                      </a>
                    </div>

                    <div className="flex items-start gap-1.5 text-[#3B261C]">
                      <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#8C6239]" />
                      <div>
                        <span className="font-bold">
                          {order.neighborhood} / {order.district}
                        </span>
                        <span className="text-[#7A6256]"> ({order.city})</span>
                        <p className="mt-0.5 font-medium leading-snug text-[#24140E]">
                          {order.fullAddress}
                        </p>
                      </div>
                    </div>

                    {order.directions && (
                      <div className="flex items-start gap-1.5 text-[#5C463B]">
                        <Navigation className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#8C6239]" />
                        <span>
                          <strong className="font-semibold">Adres Tarifi:</strong>{" "}
                          {order.directions}
                        </span>
                      </div>
                    )}

                    {order.note && (
                      <div className="mt-2 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-100/80 px-2.5 py-2 text-amber-950">
                        <MessageSquareWarning className="mt-0.5 h-4 w-4 shrink-0 text-amber-800" />
                        <div>
                          <span className="font-bold uppercase text-[10px] tracking-wider block">
                            Müşteri Notu
                          </span>
                          <span className="font-semibold">{order.note}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Order Items */}
                  <div className="space-y-2">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-[#7A6256]">
                      Sipariş İçeriği ({order.items.length} Kalem)
                    </div>
                    <ul className="divide-y divide-[#F2E8DD] rounded-xl border border-[#EFE5DA] bg-white">
                      {order.items.map((item) => (
                        <li key={item.id} className="px-3.5 py-2.5">
                          <div className="flex items-start justify-between gap-3 text-sm">
                            <div className="font-bold text-[#24140E]">
                              <span className="mr-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-md bg-[#2C1810] px-1.5 text-xs font-bold text-[#FAF3EA]">
                                {item.quantity}x
                              </span>
                              {item.productName}
                            </div>
                            <span className="shrink-0 font-bold text-[#24140E] tabular-nums">
                              {formatTRY(item.lineTotal)}
                            </span>
                          </div>

                          {item.selectedOptions &&
                            item.selectedOptions.length > 0 && (
                              <div className="mt-1.5 flex flex-wrap gap-1.5 pl-7">
                                {item.selectedOptions.map((opt, idx) => (
                                  <span
                                    key={`${opt.optionItemId}-${idx}`}
                                    className="inline-flex items-center rounded-lg border border-[#DEC8AE] bg-[#FDF6EC] px-2 py-0.5 text-xs font-bold text-[#5A3416]"
                                  >
                                    + {opt.optionItemName}
                                    {opt.priceDelta > 0
                                      ? ` (+${formatTRY(opt.priceDelta)})`
                                      : ""}
                                  </span>
                                ))}
                              </div>
                            )}
                        </li>
                      ))}
                    </ul>
                    <div className="flex items-center justify-between px-1 text-xs text-[#6E5549]">
                      <span>
                        Ara Toplam: {formatTRY(order.subtotal)} • Teslimat:{" "}
                        {order.deliveryFee === 0
                          ? "Ücretsiz"
                          : formatTRY(order.deliveryFee)}
                      </span>
                      <span className="text-[11px]">
                        Kağıt: {order.paperWidth === "MM58" ? "58mm" : "80mm"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Action Footer */}
                <div className="mt-5 space-y-2 border-t border-[#EFE5DA] pt-4">
                  {popupFallbackOrderId === order.id && (
                    <div className="flex items-center justify-between rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                      <span>
                        Tarayıcı yeni sekmeyi engelledi. Fişi açmak için:
                      </span>
                      <Link
                        href={`/panel/yazdir/${order.id}?autoprint=1`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-bold underline"
                      >
                        Fişi Aç <ExternalLink className="h-3 w-3" />
                      </Link>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-2">
                    {/* Print Thermal Receipt */}
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => void handlePrintOrder(order)}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-[#2C1810] px-4 py-2.5 text-xs font-bold text-[#FAF3EA] shadow-sm transition hover:bg-[#412418] disabled:opacity-50"
                    >
                      <Printer className="h-4 w-4 text-[#D9A76A]" />
                      <span>
                        {order.printedAt ? "Tekrar Yazdır" : "Fiş Yazdır"}
                      </span>
                    </button>

                    {/* Direct view link without transitioning if already printed */}
                    <Link
                      href={`/panel/yazdir/${order.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-xl border border-[#DAC8B8] bg-white px-3 py-2.5 text-xs font-semibold text-[#4A3429] hover:bg-[#FAF5EE]"
                      title="Fişi önizle"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      <span>Önizle</span>
                    </Link>

                    {/* Next Status Transition */}
                    {nextAction && (
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() =>
                          void handleTransitionStatus(order, nextAction.next)
                        }
                        className={`ml-auto inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-bold text-white shadow-sm transition disabled:opacity-50 ${
                          nextAction.next === "PREPARING"
                            ? "bg-sky-700 hover:bg-sky-800"
                            : nextAction.next === "WAITING_COURIER"
                              ? "bg-violet-700 hover:bg-violet-800"
                              : nextAction.next === "ON_THE_WAY"
                                ? "bg-indigo-700 hover:bg-indigo-800"
                                : "bg-emerald-700 hover:bg-emerald-800"
                        }`}
                      >
                        <Truck className="h-3.5 w-3.5" />
                        <span>{nextAction.label}</span>
                      </button>
                    )}

                    {/* Cancel Order (ADMIN ONLY) */}
                    {canCancel && (
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => setCancelTarget(order)}
                        className="inline-flex items-center gap-1 rounded-xl border border-rose-300 bg-rose-50 px-3 py-2.5 text-xs font-bold text-rose-700 transition hover:bg-rose-100 disabled:opacity-50"
                      >
                        <XCircle className="h-3.5 w-3.5" />
                        <span>İptal Et</span>
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Cancel Confirmation Dialog (Admin) */}
      <ConfirmDialog
        open={Boolean(cancelTarget)}
        title="Siparişi İptal Et"
        description={
          cancelTarget
            ? `#${cancelTarget.orderNumber} numaralı (${cancelTarget.customerName}) siparişi iptal etmek istediğinize emin misiniz? Bu işlem geri alınamaz.`
            : ""
        }
        confirmLabel="Siparişi İptal Et"
        variant="danger"
        loading={Boolean(cancelTarget && busyOrderId === cancelTarget.id)}
        onCancel={() => setCancelTarget(null)}
        onConfirm={() => {
          if (cancelTarget) {
            void handleTransitionStatus(cancelTarget, "CANCELLED");
          }
        }}
      />
    </div>
  );
}
