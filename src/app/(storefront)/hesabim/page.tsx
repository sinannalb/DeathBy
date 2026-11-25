"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronRight,
  LogOut,
  MapPin,
  Plus,
  Receipt,
  RotateCcw,
  Trash2,
  User,
} from "lucide-react";
import type {
  CustomerAddressDTO,
  OrderDTO,
  ReorderCartItemDTO,
  ReorderUnavailableItemDTO,
} from "@/lib/types";
import { OtpLoginForm } from "@/components/storefront/OtpLoginForm";
import { ReorderResultModal } from "@/components/storefront/ReorderResultModal";
import {
  toStoredNeighborhood,
  useStore,
} from "@/components/storefront/StoreProvider";
import {
  formatDateTimeTr,
  formatPhoneDisplay,
  formatTl,
  normalizeTrText,
} from "@/components/storefront/utils";

export default function CustomerAccountPage() {
  const router = useRouter();
  const {
    customer,
    authLoading,
    logout,
    neighborhoods,
    setSelectedNeighborhood,
    applyReorderItems,
    setCartDrawerOpen,
    showToast,
  } = useStore();

  const [addresses, setAddresses] = useState<CustomerAddressDTO[]>([]);
  const [orders, setOrders] = useState<OrderDTO[]>([]);
  const [dataLoading, setDataLoading] = useState(false);

  const [showAddAddress, setShowAddAddress] = useState(false);
  const [addrTitle, setAddrTitle] = useState("");
  const [addrDistrict, setAddrDistrict] = useState("");
  const [addrNeighborhoodId, setAddrNeighborhoodId] = useState("");
  const [addrFull, setAddrFull] = useState("");
  const [addrDirections, setAddrDirections] = useState("");
  const [savingAddr, setSavingAddr] = useState(false);

  const [reorderingOrderId, setReorderingOrderId] = useState<string | null>(
    null,
  );
  const [reorderModal, setReorderModal] = useState<{
    open: boolean;
    addedCount: number;
    unavailableItems: ReorderUnavailableItemDTO[];
  }>({ open: false, addedCount: 0, unavailableItems: [] });

  const loadAccountData = useCallback(async () => {
    if (!customer) return;
    setDataLoading(true);
    try {
      const [addrRes, ordRes] = await Promise.all([
        fetch("/api/customer/addresses", { cache: "no-store" }),
        fetch("/api/orders/my", { cache: "no-store" }),
      ]);
      if (addrRes.ok) {
        const addrData = (await addrRes.json()) as {
          addresses?: CustomerAddressDTO[];
        };
        setAddresses(addrData.addresses ?? []);
      }
      if (ordRes.ok) {
        const ordData = (await ordRes.json()) as { orders?: OrderDTO[] };
        setOrders(ordData.orders ?? []);
      }
    } finally {
      setDataLoading(false);
    }
  }, [customer]);

  useEffect(() => {
    if (customer) {
      void loadAccountData();
    } else {
      setAddresses([]);
      setOrders([]);
    }
  }, [customer, loadAccountData]);

  const courierNeighborhoods = neighborhoods.filter(
    (n) => n.branch.courierEnabled,
  );
  const uniqueDistricts = Array.from(
    new Set(courierNeighborhoods.map((n) => n.district)),
  ).sort((a, b) => a.localeCompare(b, "tr"));

  const filteredDistrictNeighborhoods = courierNeighborhoods.filter(
    (n) => !addrDistrict || n.district === addrDistrict,
  );

  useEffect(() => {
    if (!addrDistrict && uniqueDistricts.length > 0) {
      setAddrDistrict(uniqueDistricts[0]);
    }
  }, [uniqueDistricts, addrDistrict]);

  useEffect(() => {
    if (
      filteredDistrictNeighborhoods.length > 0 &&
      !filteredDistrictNeighborhoods.some((n) => n.id === addrNeighborhoodId)
    ) {
      setAddrNeighborhoodId(filteredDistrictNeighborhoods[0].id);
    }
  }, [filteredDistrictNeighborhoods, addrNeighborhoodId]);

  async function handleAddAddress(e: React.FormEvent) {
    e.preventDefault();
    const chosen = neighborhoods.find((n) => n.id === addrNeighborhoodId);
    if (!chosen) return;
    setSavingAddr(true);
    try {
      const res = await fetch("/api/customer/addresses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: addrTitle.trim(),
          city: chosen.city,
          district: chosen.district,
          neighborhood: chosen.neighborhood,
          fullAddress: addrFull.trim(),
          directions: addrDirections.trim() || null,
        }),
      });
      const data = (await res.json()) as {
        address?: CustomerAddressDTO;
        error?: string;
      };
      if (!res.ok || !data.address) {
        showToast(data.error || "Adres kaydedilemedi.", "error");
        return;
      }
      setAddresses((prev) => [data.address!, ...prev]);
      setAddrTitle("");
      setAddrFull("");
      setAddrDirections("");
      setShowAddAddress(false);
      showToast("Adresiniz kaydedildi.", "success");
    } catch {
      showToast("Bağlantı hatası.", "error");
    } finally {
      setSavingAddr(false);
    }
  }

  async function handleDeleteAddress(id: string) {
    try {
      const res = await fetch(`/api/customer/addresses/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        showToast("Adres silinemedi.", "error");
        return;
      }
      setAddresses((prev) => prev.filter((a) => a.id !== id));
      showToast("Adres silindi.", "info");
    } catch {
      showToast("Bağlantı hatası.", "error");
    }
  }

  function handleOrderWithAddress(addr: CustomerAddressDTO) {
    const match = neighborhoods.find(
      (n) =>
        normalizeTrText(n.city) === normalizeTrText(addr.city) &&
        normalizeTrText(n.district) === normalizeTrText(addr.district) &&
        normalizeTrText(n.neighborhood) === normalizeTrText(addr.neighborhood),
    );
    if (!match) {
      showToast(
        `${addr.neighborhood} bölgesi şu an aktif teslimat listesinde bulunamadı.`,
        "error",
      );
      return;
    }
    setSelectedNeighborhood(toStoredNeighborhood(match));
    showToast(`${match.neighborhood} seçildi. Menüyü inceliyorsunuz.`, "success");
    router.push("/");
  }

  async function handleReorder(order: OrderDTO) {
    setReorderingOrderId(order.id);
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
        // Also try matching the exact neighborhood of the original order if active
        const exactNb = neighborhoods.find(
          (n) =>
            n.branchId === (data.branchId || order.branchId) &&
            normalizeTrText(n.neighborhood) ===
              normalizeTrText(order.neighborhood),
        );
        if (exactNb) {
          setSelectedNeighborhood(toStoredNeighborhood(exactNb), {
            silent: true,
          });
        }
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
        showToast("Sipariş ürünleri sepetinize eklendi!", "success");
        setCartDrawerOpen(true);
      }
    } catch {
      showToast("Bağlantı hatası.", "error");
    } finally {
      setReorderingOrderId(null);
    }
  }

  if (authLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 space-y-5">
        <div className="h-24 rounded-3xl bg-[#EFE6DC] animate-pulse" />
        <div className="h-64 rounded-3xl bg-[#EFE6DC] animate-pulse" />
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="max-w-md mx-auto px-4 py-12">
        <div className="rounded-3xl border border-[#E6D9CB] bg-[#FFFDF9] p-6 sm:p-7 shadow-sm">
          <OtpLoginForm
            title="Hesabım & Siparişlerim"
            subtitle="Kayıtlı adreslerinize erişmek ve geçmiş siparişlerinizi tek tıkla tekrarlamak için giriş yapın."
          />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* Profile Header */}
      <section className="rounded-3xl bg-gradient-to-r from-[#2C1A12] to-[#1D110C] text-[#FBF6F0] p-6 flex flex-wrap items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-[#C68B3C] text-[#1D110C] flex items-center justify-center shrink-0">
            <User className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-serif text-xl sm:text-2xl font-bold">
              {customer.name}
            </h1>
            <p className="text-xs sm:text-sm text-[#D7C6B6]">
              {formatPhoneDisplay(customer.phone)}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => void logout()}
          className="inline-flex items-center gap-2 rounded-xl border border-[#4A2E21] bg-[#2C1A12] hover:bg-[#3A2319] text-[#F5E6D0] text-xs font-semibold px-4 py-2.5 transition-colors cursor-pointer"
        >
          <LogOut className="w-4 h-4 text-[#C68B3C]" />
          Çıkış Yap
        </button>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
        {/* Saved Addresses */}
        <section className="lg:col-span-2 rounded-3xl border border-[#E6D9CB] bg-[#FFFDF9] p-5 sm:p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-serif text-lg font-bold text-[#1D110C]">
              Kayıtlı Adreslerim
            </h2>
            <button
              type="button"
              onClick={() => setShowAddAddress((v) => !v)}
              className="inline-flex items-center gap-1 rounded-xl bg-[#FDF4E7] border border-[#C68B3C]/40 hover:bg-[#F5E6D0] text-[#7A4F14] text-xs font-bold px-3 py-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              {showAddAddress ? "Vazgeç" : "Yeni Adres"}
            </button>
          </div>

          {showAddAddress && (
            <form
              onSubmit={handleAddAddress}
              className="rounded-2xl border border-[#DFD2C3] bg-[#FBF6F0] p-4 space-y-3"
            >
              <div>
                <label
                  htmlFor="addr-title"
                  className="block text-[11px] font-semibold uppercase tracking-wide text-[#5C4338] mb-1"
                >
                  Adres Başlığı *
                </label>
                <input
                  id="addr-title"
                  type="text"
                  required
                  placeholder="Örn. Ev, İş"
                  value={addrTitle}
                  onChange={(e) => setAddrTitle(e.target.value)}
                  className="w-full rounded-xl border border-[#DFD2C3] bg-white px-3 py-2 text-xs sm:text-sm text-[#1D110C]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <span className="block text-[11px] font-semibold uppercase tracking-wide text-[#5C4338] mb-1">
                    Şehir
                  </span>
                  <div className="rounded-xl border border-[#DFD2C3] bg-[#F5ECE0] px-3 py-2 text-xs sm:text-sm font-semibold text-[#4A3429]">
                    İstanbul
                  </div>
                </div>
                <div>
                  <label
                    htmlFor="addr-district"
                    className="block text-[11px] font-semibold uppercase tracking-wide text-[#5C4338] mb-1"
                  >
                    İlçe *
                  </label>
                  <select
                    id="addr-district"
                    value={addrDistrict}
                    onChange={(e) => setAddrDistrict(e.target.value)}
                    className="w-full rounded-xl border border-[#DFD2C3] bg-white px-3 py-2 text-xs sm:text-sm text-[#1D110C]"
                  >
                    {uniqueDistricts.map((dist) => (
                      <option key={dist} value={dist}>
                        {dist}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label
                  htmlFor="addr-nb"
                  className="block text-[11px] font-semibold uppercase tracking-wide text-[#5C4338] mb-1"
                >
                  Mahalle *
                </label>
                <select
                  id="addr-nb"
                  value={addrNeighborhoodId}
                  onChange={(e) => setAddrNeighborhoodId(e.target.value)}
                  className="w-full rounded-xl border border-[#DFD2C3] bg-white px-3 py-2 text-xs sm:text-sm text-[#1D110C]"
                >
                  {filteredDistrictNeighborhoods.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.neighborhood} ({n.branch.name})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="addr-full"
                  className="block text-[11px] font-semibold uppercase tracking-wide text-[#5C4338] mb-1"
                >
                  Açık Adres *
                </label>
                <textarea
                  id="addr-full"
                  required
                  minLength={5}
                  rows={2}
                  placeholder="Cadde, sokak, bina no, daire"
                  value={addrFull}
                  onChange={(e) => setAddrFull(e.target.value)}
                  className="w-full rounded-xl border border-[#DFD2C3] bg-white px-3 py-2 text-xs sm:text-sm text-[#1D110C]"
                />
              </div>

              <div>
                <label
                  htmlFor="addr-dir"
                  className="block text-[11px] font-semibold uppercase tracking-wide text-[#5C4338] mb-1"
                >
                  Adres Tarifi
                </label>
                <input
                  id="addr-dir"
                  type="text"
                  placeholder="Opsiyonel"
                  value={addrDirections}
                  onChange={(e) => setAddrDirections(e.target.value)}
                  className="w-full rounded-xl border border-[#DFD2C3] bg-white px-3 py-2 text-xs sm:text-sm text-[#1D110C]"
                />
              </div>

              <button
                type="submit"
                disabled={savingAddr}
                className="w-full rounded-xl bg-[#2C1A12] hover:bg-[#1D110C] text-[#FBF6F0] text-xs font-semibold py-2.5 cursor-pointer"
              >
                {savingAddr ? "Kaydediliyor..." : "Adresi Kaydet"}
              </button>
            </form>
          )}

          {dataLoading ? (
            <div className="space-y-2.5">
              <div className="h-24 rounded-2xl bg-[#EFE6DC] animate-pulse" />
              <div className="h-24 rounded-2xl bg-[#EFE6DC] animate-pulse" />
            </div>
          ) : addresses.length === 0 ? (
            <p className="text-xs text-[#6E5245] py-4">
              Henüz kayıtlı adresiniz yok. Yeni adres ekleyebilir veya sipariş
              verirken kaydedebilirsiniz.
            </p>
          ) : (
            <div className="space-y-3">
              {addresses.map((addr) => (
                <div
                  key={addr.id}
                  className="rounded-2xl border border-[#EAE0D5] bg-white p-3.5 space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-4 h-4 text-[#C68B3C] shrink-0" />
                      <h3 className="font-bold text-sm text-[#1D110C]">
                        {addr.title}
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleDeleteAddress(addr.id)}
                      aria-label={`${addr.title} adresini sil`}
                      className="text-[#9B8275] hover:text-[#9E2A2B] p-1 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <p className="text-xs text-[#5C4338] leading-relaxed">
                    {addr.fullAddress}
                  </p>
                  <p className="text-[11px] text-[#8A6F62]">
                    {addr.neighborhood}, {addr.district} / {addr.city}
                  </p>
                  <button
                    type="button"
                    onClick={() => handleOrderWithAddress(addr)}
                    className="w-full rounded-xl bg-[#FBF6F0] hover:bg-[#FDF4E7] border border-[#DFD2C3] hover:border-[#C68B3C] text-[#2C1A12] text-xs font-semibold py-2 px-3 transition-colors cursor-pointer"
                  >
                    Bu Adresle Sipariş Ver
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Recent Orders */}
        <section className="lg:col-span-3 rounded-3xl border border-[#E6D9CB] bg-[#FFFDF9] p-5 sm:p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-lg font-bold text-[#1D110C]">
              Son Siparişlerim
            </h2>
            <span className="text-xs text-[#8A6F62]">
              {orders.length} sipariş
            </span>
          </div>

          {dataLoading ? (
            <div className="space-y-3">
              <div className="h-32 rounded-2xl bg-[#EFE6DC] animate-pulse" />
              <div className="h-32 rounded-2xl bg-[#EFE6DC] animate-pulse" />
            </div>
          ) : orders.length === 0 ? (
            <div className="text-center py-10 space-y-3">
              <Receipt className="w-10 h-10 text-[#C68B3C] mx-auto opacity-80" />
              <p className="text-sm font-semibold text-[#1D110C]">
                Henüz siparişiniz bulunmuyor
              </p>
              <Link
                href="/"
                className="inline-block rounded-xl bg-[#2C1A12] text-[#FBF6F0] text-xs font-semibold px-5 py-2.5"
              >
                İlk Siparişini Ver
              </Link>
            </div>
          ) : (
            <div className="space-y-3.5">
              {orders.map((order) => (
                <article
                  key={order.id}
                  className="rounded-2xl border border-[#EAE0D5] bg-white p-4 space-y-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-[#1D110C]">
                          {order.orderNumber}
                        </span>
                        <span
                          className={`rounded-full text-[11px] font-bold px-2.5 py-0.5 ${
                            order.status === "COMPLETED"
                              ? "bg-emerald-100 text-emerald-800"
                              : order.status === "CANCELLED"
                                ? "bg-[#9E2A2B]/15 text-[#9E2A2B]"
                                : "bg-[#FDF4E7] text-[#B0782D] border border-[#C68B3C]/30"
                          }`}
                        >
                          {order.statusLabel}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#8A6F62] mt-0.5">
                        {order.branchName} • {formatDateTimeTr(order.createdAt)}
                      </p>
                    </div>
                    <span className="text-base font-bold text-[#2C1A12]">
                      {formatTl(order.totalAmount)}
                    </span>
                  </div>

                  <p className="text-xs text-[#5C4338] leading-relaxed">
                    {order.items
                      .map((i) => `${i.quantity}x ${i.productName}`)
                      .join(", ")}
                  </p>

                  <div className="pt-2 border-t border-[#F2EAE0] flex flex-wrap items-center justify-between gap-2">
                    <Link
                      href={`/siparis/${order.id}`}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-[#5C4338] hover:text-[#1D110C]"
                    >
                      Sipariş Detayı / Takip
                      <ChevronRight className="w-3.5 h-3.5" />
                    </Link>

                    <div className="flex items-center gap-2">
                      {order.paymentStatus !== "PAID" &&
                        order.status !== "CANCELLED" && (
                          <Link
                            href={`/odeme/${order.id}`}
                            className="rounded-xl bg-[#C68B3C] text-white text-xs font-semibold px-3 py-1.5"
                          >
                            Öde
                          </Link>
                        )}
                      <button
                        type="button"
                        disabled={reorderingOrderId === order.id}
                        onClick={() => void handleReorder(order)}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-[#2C1A12] hover:bg-[#1D110C] disabled:opacity-50 text-[#FBF6F0] text-xs font-semibold px-3.5 py-1.5 transition-colors cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5 text-[#C68B3C]" />
                        {reorderingOrderId === order.id
                          ? "Ekleniyor..."
                          : "Siparişi Tekrarla"}
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
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
