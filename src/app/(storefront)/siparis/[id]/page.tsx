"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  Bike,
  Check,
  ChefHat,
  Clock,
  CreditCard,
  MapPin,
  PackageCheck,
  Phone,
  Receipt,
  RotateCcw,
  Store,
  XCircle,
} from "lucide-react";
import type {
  OrderDTO,
  ReorderCartItemDTO,
  ReorderUnavailableItemDTO,
} from "@/lib/types";
import { OtpLoginForm } from "@/components/storefront/OtpLoginForm";
import { ReorderResultModal } from "@/components/storefront/ReorderResultModal";
import { useStore } from "@/components/storefront/StoreProvider";
import {
  formatDateTimeTr,
  formatPhoneDisplay,
  formatTl,
} from "@/components/storefront/utils";

const STEPS = [
  {
    key: "RECEIVED",
    label: "Sipariş Alındı",
    icon: Receipt,
  },
  {
    key: "PREPARING",
    label: "Sipariş Hazırlanıyor",
    icon: ChefHat,
  },
  {
    key: "WAITING_COURIER",
    label: "Kurye Bekleniyor",
    icon: Clock,
  },
  {
    key: "ON_THE_WAY",
    label: "Kurye Yola Çıktı",
    icon: Bike,
  },
  {
    key: "COMPLETED",
    label: "Sipariş Tamamlandı",
    icon: PackageCheck,
  },
] as const;

export default function OrderTrackingPage() {
  const params = useParams<{ id: string }>();
  const orderId = params?.id;

  const { applyReorderItems, setCartDrawerOpen, showToast } = useStore();

  const [order, setOrder] = useState<OrderDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [reordering, setReordering] = useState(false);
  const [reorderModal, setReorderModal] = useState<{
    open: boolean;
    addedCount: number;
    unavailableItems: ReorderUnavailableItemDTO[];
  }>({ open: false, addedCount: 0, unavailableItems: [] });

  const fetchOrder = useCallback(
    async (silent = false) => {
      if (!orderId) return;
      if (!silent) setLoading(true);
      setError(null);
      setNeedsAuth(false);

      try {
        const res = await fetch(`/api/orders/${encodeURIComponent(orderId)}`, {
          cache: "no-store",
        });
        if (res.status === 401) {
          setNeedsAuth(true);
          return;
        }
        const data = (await res.json()) as {
          order?: OrderDTO;
          error?: string;
        };
        if (!res.ok || !data.order) {
          setError(data.error || "Sipariş bulunamadı.");
          return;
        }
        setOrder(data.order);
      } catch {
        if (!silent) setError("Bağlantı hatası. Lütfen tekrar deneyin.");
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [orderId],
  );

  useEffect(() => {
    void fetchOrder(false);
  }, [fetchOrder]);

  // Poll every 5s while order is active
  useEffect(() => {
    if (
      !order ||
      order.status === "COMPLETED" ||
      order.status === "CANCELLED"
    ) {
      return;
    }
    const timer = setInterval(() => {
      void fetchOrder(true);
    }, 5000);
    return () => clearInterval(timer);
  }, [order, fetchOrder]);

  async function handleReorder() {
    if (!order) return;
    setReordering(true);
    try {
      const res = await fetch(
        `/api/orders/${encodeURIComponent(order.id)}/reorder`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ branchId: order.branchId }),
        },
      );
      const data = (await res.json()) as {
        branchId?: string;
        cartItems?: ReorderCartItemDTO[];
        unavailableItems?: ReorderUnavailableItemDTO[];
        error?: string;
      };
      if (!res.ok || !data.cartItems) {
        showToast(data.error || "Sipariş tekrarlanamadı.", "error");
        return;
      }

      if (data.cartItems.length > 0) {
        applyReorderItems(data.cartItems, data.branchId || order.branchId);
      }

      const unavailable = data.unavailableItems ?? [];
      if (unavailable.length > 0) {
        setReorderModal({
          open: true,
          addedCount: data.cartItems.length,
          unavailableItems: unavailable,
        });
      } else {
        showToast("Siparişiniz sepete eklendi!", "success");
        setCartDrawerOpen(true);
      }
    } catch {
      showToast("Bağlantı hatası. Lütfen tekrar deneyin.", "error");
    } finally {
      setReordering(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 space-y-5">
        <div className="h-10 w-64 rounded-xl bg-[#EFE6DC] animate-pulse" />
        <div className="h-36 rounded-3xl bg-[#EFE6DC] animate-pulse" />
        <div className="h-64 rounded-3xl bg-[#EFE6DC] animate-pulse" />
      </div>
    );
  }

  if (needsAuth) {
    return (
      <div className="max-w-md mx-auto px-4 py-12">
        <div className="rounded-3xl border border-[#E6D9CB] bg-[#FFFDF9] p-6 shadow-sm">
          <OtpLoginForm
            title="Sipariş Takibi İçin Giriş Yapın"
            subtitle="Sipariş detaylarını görmek için telefonunuzu doğrulayın."
            onSuccess={() => void fetchOrder(false)}
          />
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="max-w-lg mx-auto px-4 py-14 text-center">
        <div className="rounded-3xl border border-[#9E2A2B]/30 bg-[#FFFDF9] p-8">
          <AlertTriangle className="w-10 h-10 text-[#9E2A2B] mx-auto mb-3" />
          <h1 className="font-serif text-xl font-bold text-[#1D110C]">
            Sipariş Görüntülenemiyor
          </h1>
          <p className="text-sm text-[#6E5245] mt-1">
            {error || "Sipariş bulunamadı."}
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 mt-5 rounded-xl bg-[#2C1A12] text-[#FBF6F0] text-sm font-semibold px-5 py-2.5"
          >
            <ArrowLeft className="w-4 h-4" />
            Ana Sayfaya Dön
          </Link>
        </div>
      </div>
    );
  }

  const currentStepIdx = STEPS.findIndex((s) => s.key === order.status);
  const isCancelled = order.status === "CANCELLED";

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            href="/hesabim"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#6E5245] hover:text-[#1D110C]"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Siparişlerime Dön
          </Link>
          <div className="flex flex-wrap items-center gap-2.5 mt-1">
            <h1 className="font-serif text-2xl sm:text-3xl font-bold text-[#1D110C]">
              Sipariş {order.orderNumber}
            </h1>
            <span
              className={`rounded-full text-xs font-bold px-3 py-1 ${
                order.paymentStatus === "PAID"
                  ? "bg-emerald-100 text-emerald-800"
                  : order.paymentStatus === "FAILED"
                    ? "bg-[#9E2A2B]/15 text-[#9E2A2B]"
                    : "bg-amber-100 text-amber-800"
              }`}
            >
              {order.paymentStatus === "PAID"
                ? "PayTR Online Ödendi"
                : order.paymentStatusLabel}
            </span>
          </div>
          <p className="text-xs text-[#6E5245] mt-1">
            {formatDateTimeTr(order.createdAt)}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {order.paymentStatus !== "PAID" && order.status !== "CANCELLED" && (
            <Link
              href={`/odeme/${order.id}`}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#C68B3C] hover:bg-[#B0782D] text-white text-xs sm:text-sm font-semibold px-4 py-2.5"
            >
              <CreditCard className="w-4 h-4" />
              Ödemeyi Tamamla
            </Link>
          )}
          <button
            type="button"
            disabled={reordering}
            onClick={handleReorder}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#2C1A12] hover:bg-[#1D110C] disabled:opacity-50 text-[#FBF6F0] text-xs sm:text-sm font-semibold px-4 py-2.5 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-4 h-4 text-[#C68B3C]" />
            {reordering ? "Hazırlanıyor..." : "Tekrarla"}
          </button>
        </div>
      </div>

      {/* 5-step progress tracker */}
      <section className="rounded-3xl border border-[#E6D9CB] bg-[#FFFDF9] p-5 sm:p-6 shadow-sm">
        {isCancelled ? (
          <div className="flex items-center gap-3 text-[#9E2A2B] bg-[#9E2A2B]/10 rounded-2xl p-4 border border-[#9E2A2B]/30">
            <XCircle className="w-7 h-7 shrink-0" />
            <div>
              <h2 className="font-serif text-lg font-bold">
                Sipariş İptal Edildi
              </h2>
              <p className="text-xs sm:text-sm text-[#7D2122] mt-0.5">
                Detaylı bilgi için şubemizle iletişime geçebilirsiniz.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-serif text-lg font-bold text-[#1D110C]">
                Canlı Sipariş Durumu
              </h2>
              {order.status !== "COMPLETED" && (
                <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#C68B3C]">
                  <span className="w-2 h-2 rounded-full bg-[#C68B3C] animate-pulse" />
                  Otomatik güncelleniyor
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 pt-2">
              {STEPS.map((step, idx) => {
                const Icon = step.icon;
                const done = currentStepIdx >= idx;
                const active = currentStepIdx === idx;
                return (
                  <div
                    key={step.key}
                    className={`rounded-2xl border p-3.5 flex sm:flex-col items-center sm:text-center gap-3 sm:gap-2 transition-all ${
                      active
                        ? "border-[#C68B3C] bg-[#FDF4E7] ring-2 ring-[#C68B3C]/25"
                        : done
                          ? "border-emerald-200 bg-emerald-50/70"
                          : "border-[#EAE0D5] bg-[#FBF6F0]/60 opacity-60"
                    }`}
                  >
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                        active
                          ? "bg-[#C68B3C] text-white"
                          : done
                            ? "bg-emerald-600 text-white"
                            : "bg-[#E8DDD1] text-[#6E5245]"
                      }`}
                    >
                      {done && !active ? (
                        <Check className="w-5 h-5" />
                      ) : (
                        <Icon className="w-5 h-5" />
                      )}
                    </div>
                    <span
                      className={`text-xs font-bold leading-snug ${
                        active
                          ? "text-[#1D110C]"
                          : done
                            ? "text-emerald-900"
                            : "text-[#6E5245]"
                      }`}
                    >
                      {step.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* Details Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Branch & Delivery */}
        <section className="rounded-3xl border border-[#E6D9CB] bg-[#FFFDF9] p-5 sm:p-6 shadow-sm space-y-4">
          <h2 className="font-serif text-lg font-bold text-[#1D110C] pb-2 border-b border-[#EFE6DC]">
            Şube & Teslimat Bilgileri
          </h2>

          <div className="space-y-3 text-sm">
            <div className="flex items-start gap-2.5">
              <Store className="w-4 h-4 text-[#C68B3C] shrink-0 mt-1" />
              <div>
                <p className="font-bold text-[#1D110C]">{order.branchName}</p>
                <p className="text-xs text-[#6E5245]">{order.branchAddress}</p>
                {order.branchPhone && (
                  <a
                    href={`tel:${order.branchPhone}`}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[#C68B3C] hover:underline mt-1"
                  >
                    <Phone className="w-3 h-3" />
                    {formatPhoneDisplay(order.branchPhone)}
                  </a>
                )}
              </div>
            </div>

            <div className="flex items-start gap-2.5 pt-2 border-t border-[#F2EAE0]">
              <MapPin className="w-4 h-4 text-[#C68B3C] shrink-0 mt-1" />
              <div>
                <p className="font-bold text-[#1D110C]">
                  {order.customerName} •{" "}
                  {formatPhoneDisplay(order.customerPhone)}
                </p>
                <p className="text-xs text-[#5C4338] mt-0.5">
                  {order.fullAddress}
                </p>
                <p className="text-xs text-[#8A6F62]">
                  {order.neighborhood}, {order.district} / {order.city}
                </p>
                {order.directions && (
                  <p className="text-xs text-[#6E5245] mt-1">
                    <strong>Tarif:</strong> {order.directions}
                  </p>
                )}
                {order.note && (
                  <p className="text-xs text-[#6E5245] mt-1">
                    <strong>Not:</strong> {order.note}
                  </p>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Items & Totals */}
        <section className="rounded-3xl border border-[#E6D9CB] bg-[#FFFDF9] p-5 sm:p-6 shadow-sm space-y-4">
          <h2 className="font-serif text-lg font-bold text-[#1D110C] pb-2 border-b border-[#EFE6DC]">
            Sipariş İçeriği
          </h2>

          <div className="space-y-3">
            {order.items.map((item) => (
              <div
                key={item.id}
                className="flex items-start justify-between gap-3 text-sm"
              >
                <div>
                  <p className="font-semibold text-[#1D110C]">
                    {item.quantity}x {item.productName}
                  </p>
                  {item.selectedOptions.length > 0 && (
                    <p className="text-xs text-[#6E5245] mt-0.5">
                      {item.selectedOptions
                        .map((o) =>
                          o.priceDelta > 0
                            ? `${o.optionItemName} (+${formatTl(o.priceDelta)})`
                            : o.optionItemName,
                        )
                        .join(", ")}
                    </p>
                  )}
                </div>
                <span className="font-bold text-[#2C1A12] shrink-0">
                  {formatTl(item.lineTotal)}
                </span>
              </div>
            ))}
          </div>

          <div className="border-t border-[#EFE6DC] pt-3 space-y-1.5 text-sm">
            <div className="flex justify-between text-[#5C4338]">
              <span>Ara Toplam</span>
              <span>{formatTl(order.subtotal)}</span>
            </div>
            <div className="flex justify-between text-[#5C4338]">
              <span>Teslimat Ücreti</span>
              <span>
                {order.deliveryFee === 0
                  ? "Ücretsiz"
                  : formatTl(order.deliveryFee)}
              </span>
            </div>
            <div className="flex justify-between text-base font-bold text-[#1D110C] pt-2 border-t border-[#EFE6DC]">
              <span>Toplam</span>
              <span>{formatTl(order.totalAmount)}</span>
            </div>
          </div>
        </section>
      </div>

      <ReorderResultModal
        open={reorderModal.open}
        addedCount={reorderModal.addedCount}
        unavailableItems={reorderModal.unavailableItems}
        onClose={() =>
          setReorderModal((prev) => ({ ...prev, open: false }))
        }
      />
    </div>
  );
}
