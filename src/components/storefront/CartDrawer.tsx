"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  CreditCard,
  Minus,
  Plus,
  ShoppingBag,
  Store,
  Trash2,
  X,
} from "lucide-react";
import type { CustomerAddressDTO, OrderDTO } from "@/lib/types";
import { OtpLoginForm } from "./OtpLoginForm";
import { ProductImage } from "./ProductImage";
import { toStoredNeighborhood, useStore } from "./StoreProvider";
import { formatTl, normalizeTrText } from "./utils";

export function CartDrawer() {
  const router = useRouter();
  const {
    cart,
    cartCount,
    cartSubtotal,
    updateQuantity,
    removeFromCart,
    neighborhoods,
    selectedNeighborhood,
    setSelectedNeighborhood,
    setNeighborhoodModalOpen,
    cartDrawerOpen,
    setCartDrawerOpen,
    customer,
    showToast,
  } = useStore();

  const [step, setStep] = useState<"cart" | "checkout">("cart");
  const [addresses, setAddresses] = useState<CustomerAddressDTO[]>([]);
  const [lastOrderAddress, setLastOrderAddress] = useState<{
    city: string;
    district: string;
    neighborhood: string;
    fullAddress: string;
    directions: string | null;
  } | null>(null);
  const [addressesLoading, setAddressesLoading] = useState(false);
  const [selectedAddressId, setSelectedAddressId] = useState<string>("new");

  const [customerName, setCustomerName] = useState("");
  const [fullAddress, setFullAddress] = useState("");
  const [directions, setDirections] = useState("");
  const [note, setNote] = useState("");
  const [saveAddress, setSaveAddress] = useState(true);
  const [addressTitle, setAddressTitle] = useState("Ev");
  const [checkoutDistrict, setCheckoutDistrict] = useState("");
  const [checkoutNeighborhoodId, setCheckoutNeighborhoodId] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!cartDrawerOpen) {
      setStep("cart");
      setSelectedAddressId("new");
      setFullAddress("");
      setDirections("");
      setNote("");
      setSubmitError(null);
      return;
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setCartDrawerOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [cartDrawerOpen, setCartDrawerOpen]);

  // Reset address fields and pre-fill name when customer session changes (login/logout)
  useEffect(() => {
    setSelectedAddressId("new");
    setFullAddress("");
    setDirections("");
    setNote("");
    if (customer && customer.name && customer.name !== "Müşteri") {
      setCustomerName(customer.name);
    } else {
      setCustomerName("");
    }
  }, [customer?.id, customer?.name]);

  const courierNeighborhoods = useMemo(
    () => neighborhoods.filter((n) => n.branch.courierEnabled),
    [neighborhoods],
  );

  // Sync checkout district/neighborhood dropdowns when entering checkout
  useEffect(() => {
    if (!cartDrawerOpen || step !== "checkout") return;
    if (
      selectedNeighborhood &&
      courierNeighborhoods.some(
        (n) => n.id === selectedNeighborhood.neighborhoodId,
      )
    ) {
      setCheckoutDistrict(selectedNeighborhood.district);
      setCheckoutNeighborhoodId(selectedNeighborhood.neighborhoodId);
    } else if (courierNeighborhoods.length > 0) {
      setCheckoutDistrict(courierNeighborhoods[0].district);
      setCheckoutNeighborhoodId(courierNeighborhoods[0].id);
      setSelectedNeighborhood(toStoredNeighborhood(courierNeighborhoods[0]), {
        silent: true,
      });
    }
  }, [
    cartDrawerOpen,
    step,
    selectedNeighborhood,
    courierNeighborhoods,
    setSelectedNeighborhood,
  ]);

  // Fetch saved addresses AND latest order address when entering checkout while logged in
  useEffect(() => {
    if (!cartDrawerOpen || step !== "checkout" || !customer) return;
    let cancelled = false;
    setAddressesLoading(true);

    Promise.all([
      fetch("/api/customer/addresses", { cache: "no-store" })
        .then((res) => (res.ok ? res.json() : { addresses: [] }))
        .catch(() => ({ addresses: [] })),
      fetch("/api/orders/my", { cache: "no-store" })
        .then((res) => (res.ok ? res.json() : { orders: [] }))
        .catch(() => ({ orders: [] })),
    ])
      .then(
        ([addrData, ordData]: [
          { addresses?: CustomerAddressDTO[] },
          { orders?: OrderDTO[] },
        ]) => {
          if (cancelled) return;
          const savedList = addrData.addresses ?? [];
          setAddresses(savedList);

          const latestOrd = (ordData.orders ?? [])[0];
          const latestOrdAddr = latestOrd
            ? {
                city: latestOrd.city,
                district: latestOrd.district,
                neighborhood: latestOrd.neighborhood,
                fullAddress: latestOrd.fullAddress,
                directions: latestOrd.directions,
              }
            : null;
          setLastOrderAddress(latestOrdAddr);

          // Auto-select matching saved address, or any saved address in an active courier neighborhood, or latest order address
          const findMatchingCourierNb = (addr: {
            city: string;
            district: string;
            neighborhood: string;
          }) =>
            courierNeighborhoods.find(
              (n) =>
                normalizeTrText(n.city) === normalizeTrText(addr.city) &&
                normalizeTrText(n.district) === normalizeTrText(addr.district) &&
                normalizeTrText(n.neighborhood) ===
                  normalizeTrText(addr.neighborhood),
            );

          const savedInCurrentNb = selectedNeighborhood
            ? savedList.find(
                (a) =>
                  normalizeTrText(a.city) ===
                    normalizeTrText(selectedNeighborhood.city) &&
                  normalizeTrText(a.district) ===
                    normalizeTrText(selectedNeighborhood.district) &&
                  normalizeTrText(a.neighborhood) ===
                    normalizeTrText(selectedNeighborhood.neighborhood),
              )
            : undefined;

          const firstServicedSaved =
            savedInCurrentNb ??
            savedList.find((a) => Boolean(findMatchingCourierNb(a)));

          if (firstServicedSaved) {
            const matchedNb = findMatchingCourierNb(firstServicedSaved);
            if (matchedNb) {
              setSelectedNeighborhood(toStoredNeighborhood(matchedNb), {
                silent: true,
              });
              setCheckoutDistrict(matchedNb.district);
              setCheckoutNeighborhoodId(matchedNb.id);
            }
            setSelectedAddressId(firstServicedSaved.id);
            setFullAddress(firstServicedSaved.fullAddress);
            setDirections(firstServicedSaved.directions || "");
          } else if (latestOrdAddr && findMatchingCourierNb(latestOrdAddr)) {
            const matchedNb = findMatchingCourierNb(latestOrdAddr)!;
            setSelectedNeighborhood(toStoredNeighborhood(matchedNb), {
              silent: true,
            });
            setCheckoutDistrict(matchedNb.district);
            setCheckoutNeighborhoodId(matchedNb.id);
            setSelectedAddressId("last-order");
            setFullAddress(latestOrdAddr.fullAddress);
            setDirections(latestOrdAddr.directions || "");
          } else {
            setSelectedAddressId("new");
            setFullAddress("");
            setDirections("");
          }
        },
      )
      .finally(() => {
        if (!cancelled) setAddressesLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [cartDrawerOpen, step, customer]);

  const checkoutDistricts = useMemo(
    () =>
      Array.from(new Set(courierNeighborhoods.map((n) => n.district))).sort(
        (a, b) => a.localeCompare(b, "tr"),
      ),
    [courierNeighborhoods],
  );

  const checkoutNeighborhoods = useMemo(
    () =>
      courierNeighborhoods.filter(
        (n) => !checkoutDistrict || n.district === checkoutDistrict,
      ),
    [courierNeighborhoods, checkoutDistrict],
  );

  const servicedSavedAddresses = useMemo(
    () =>
      addresses.filter((a) =>
        courierNeighborhoods.some(
          (n) =>
            normalizeTrText(n.city) === normalizeTrText(a.city) &&
            normalizeTrText(n.district) === normalizeTrText(a.district) &&
            normalizeTrText(n.neighborhood) === normalizeTrText(a.neighborhood),
        ),
      ),
    [addresses, courierNeighborhoods],
  );

  if (!cartDrawerOpen) return null;

  const minOrderAmount = selectedNeighborhood?.minOrderAmount ?? 0;
  const deliveryFee = selectedNeighborhood?.deliveryFee ?? 0;
  const totalAmount = Number((cartSubtotal + deliveryFee).toFixed(2));
  const missingAmount = Math.max(
    0,
    Number((minOrderAmount - cartSubtotal).toFixed(2)),
  );
  const progressPct =
    minOrderAmount > 0
      ? Math.min(100, Math.round((cartSubtotal / minOrderAmount) * 100))
      : 100;

  const branchClosed =
    selectedNeighborhood?.branch.status.effectiveStatus === "CLOSED";
  const canCheckout =
    Boolean(selectedNeighborhood) &&
    !branchClosed &&
    cart.length > 0 &&
    missingAmount === 0;

  const hasSavedCustomerName = Boolean(
    customer?.name &&
      customer.name.trim().length >= 2 &&
      customer.name.trim() !== "Müşteri",
  );

  function handleSelectSavedAddress(addr: CustomerAddressDTO) {
    const matchedNb = courierNeighborhoods.find(
      (n) =>
        normalizeTrText(n.city) === normalizeTrText(addr.city) &&
        normalizeTrText(n.district) === normalizeTrText(addr.district) &&
        normalizeTrText(n.neighborhood) === normalizeTrText(addr.neighborhood),
    );
    if (matchedNb) {
      setSelectedNeighborhood(toStoredNeighborhood(matchedNb), { silent: true });
      setCheckoutDistrict(matchedNb.district);
      setCheckoutNeighborhoodId(matchedNb.id);
    }
    setSelectedAddressId(addr.id);
    setFullAddress(addr.fullAddress);
    setDirections(addr.directions || "");
    setSubmitError(null);
  }

  function handleSelectLastOrderAddress() {
    if (!lastOrderAddress) return;
    const matchedNb = courierNeighborhoods.find(
      (n) =>
        normalizeTrText(n.city) === normalizeTrText(lastOrderAddress.city) &&
        normalizeTrText(n.district) ===
          normalizeTrText(lastOrderAddress.district) &&
        normalizeTrText(n.neighborhood) ===
          normalizeTrText(lastOrderAddress.neighborhood),
    );
    if (matchedNb) {
      setSelectedNeighborhood(toStoredNeighborhood(matchedNb), { silent: true });
      setCheckoutDistrict(matchedNb.district);
      setCheckoutNeighborhoodId(matchedNb.id);
    }
    setSelectedAddressId("last-order");
    setFullAddress(lastOrderAddress.fullAddress);
    setDirections(lastOrderAddress.directions || "");
    setSubmitError(null);
  }

  function handleSelectNewAddress() {
    setSelectedAddressId("new");
    setFullAddress("");
    setDirections("");
    setSubmitError(null);
  }

  async function handleSubmitOrder(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedNeighborhood) {
      setSubmitError("Lütfen önce teslimat mahallenizi seçin.");
      return;
    }
    if (!customer) {
      setSubmitError("Lütfen önce telefonunuzla giriş yapın.");
      return;
    }
    const resolvedCustomerName =
      customerName.trim() ||
      (hasSavedCustomerName ? customer.name.trim() : "");
    if (resolvedCustomerName.length < 2) {
      setSubmitError("Lütfen ad soyad bilginizi giriniz.");
      return;
    }
    if (!fullAddress.trim()) {
      setSubmitError("Lütfen teslimat adresinizi seçin veya girin.");
      return;
    }

    setSubmitError(null);
    setSubmitting(true);

    try {
      // Save address if requested and using a new or last-order address
      if (
        saveAddress &&
        (selectedAddressId === "new" || selectedAddressId === "last-order")
      ) {
        await fetch("/api/customer/addresses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: addressTitle.trim() || "Adresim",
            city: selectedNeighborhood.city,
            district: selectedNeighborhood.district,
            neighborhood: selectedNeighborhood.neighborhood,
            fullAddress: fullAddress.trim(),
            directions: directions.trim() || null,
          }),
        }).catch(() => undefined);
      }

      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branchId: selectedNeighborhood.branch.id,
          neighborhoodId: selectedNeighborhood.neighborhoodId,
          city: selectedNeighborhood.city,
          district: selectedNeighborhood.district,
          neighborhood: selectedNeighborhood.neighborhood,
          fullAddress: fullAddress.trim(),
          directions: directions.trim() || null,
          customerName: resolvedCustomerName,
          note: note.trim() || null,
          items: cart.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            selectedOptionItemIds: item.selectedOptionItemIds,
          })),
        }),
      });

      const data = (await res.json()) as {
        order?: OrderDTO;
        payment?: unknown;
        error?: string;
      };

      if (!res.ok || !data.order) {
        setSubmitError(data.error || "Sipariş oluşturulamadı.");
        return;
      }

      try {
        if (data.payment) {
          window.sessionStorage.setItem(
            `dbc_payment_${data.order.id}`,
            JSON.stringify(data.payment),
          );
        }
      } catch {
        // Ignore sessionStorage failures
      }

      showToast("Siparişiniz oluşturuldu, ödeme ekranına yönlendiriliyorsunuz.", "success");
      setFullAddress("");
      setDirections("");
      setNote("");
      setSelectedAddressId("new");
      setCartDrawerOpen(false);
      router.push(`/odeme/${data.order.id}`);
    } catch {
      setSubmitError("Bağlantı hatası. Lütfen tekrar deneyin.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Sepet ve Sipariş"
      className="fixed inset-0 z-50 flex justify-end bg-[#1D110C]/65 backdrop-blur-xs"
      onClick={(e) => {
        if (e.target === e.currentTarget) setCartDrawerOpen(false);
      }}
    >
      <div className="w-full max-w-md bg-[#FFFDF9] h-full shadow-2xl flex flex-col border-l border-[#E6D9CB]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#EAE0D5] flex items-center justify-between bg-[#2C1A12] text-[#FBF6F0]">
          <div className="flex items-center gap-2.5">
            {step === "checkout" && (
              <button
                type="button"
                onClick={() => {
                  setStep("cart");
                  setSubmitError(null);
                }}
                aria-label="Sepete dön"
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <div>
              <h2 className="font-serif text-lg font-bold">
                {step === "cart"
                  ? `Sepetim (${cartCount})`
                  : "Teslimat & Ödeme"}
              </h2>
              {step === "cart" && selectedNeighborhood && (
                <p className="text-[11px] text-[#E6C79C]">
                  {selectedNeighborhood.neighborhood},{" "}
                  {selectedNeighborhood.district} •{" "}
                  {selectedNeighborhood.branch.name}
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setCartDrawerOpen(false)}
            aria-label="Kapat"
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        {cart.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <div className="w-16 h-16 rounded-2xl bg-[#F5EDE3] text-[#C68B3C] flex items-center justify-center mb-4">
              <ShoppingBag className="w-8 h-8" />
            </div>
            <h3 className="font-serif text-lg font-bold text-[#1D110C]">
              Sepetiniz Henüz Boş
            </h3>
            <p className="text-sm text-[#6E5245] mt-1 max-w-xs">
              Sıcak Belçika çikolatalı tatlılarımızdan ve taze kahvelerimizden
              ekleyerek hemen sipariş verebilirsiniz.
            </p>
            <button
              type="button"
              onClick={() => setCartDrawerOpen(false)}
              className="mt-5 rounded-xl bg-[#2C1A12] text-[#FBF6F0] text-sm font-semibold px-5 py-2.5 hover:bg-[#1D110C] cursor-pointer"
            >
              Menüye Göz At
            </button>
          </div>
        ) : step === "cart" ? (
          <>
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
              {!selectedNeighborhood ? (
                <div className="rounded-2xl border border-[#9E2A2B]/30 bg-[#9E2A2B]/10 p-3.5 text-xs text-[#9E2A2B] flex items-center justify-between gap-3">
                  <span>Teslimat için mahalle seçmeniz gerekiyor.</span>
                  <button
                    type="button"
                    onClick={() => {
                      setCartDrawerOpen(false);
                      setNeighborhoodModalOpen(true);
                    }}
                    className="shrink-0 rounded-lg bg-[#9E2A2B] text-white font-semibold px-3 py-1.5 cursor-pointer"
                  >
                    Mahalle Seç
                  </button>
                </div>
              ) : (
                <div className="rounded-2xl border border-[#E6D9CB] bg-[#FBF6F0] p-3.5 space-y-2">
                  {missingAmount > 0 ? (
                    <p className="text-xs font-semibold text-[#9E2A2B]">
                      Min. sepet tutarı için{" "}
                      <strong>{formatTl(missingAmount)}</strong> daha ekleyin
                      <span className="text-[#6E5245] font-normal">
                        {" "}
                        (Min. {formatTl(minOrderAmount)})
                      </span>
                    </p>
                  ) : (
                    <p className="text-xs font-semibold text-emerald-700 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" />
                      Minimum sepet tutarına ulaşıldı!
                    </p>
                  )}
                  <div className="h-2 w-full rounded-full bg-[#E8DDD1] overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${
                        missingAmount > 0 ? "bg-[#C68B3C]" : "bg-emerald-600"
                      }`}
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                </div>
              )}

              {branchClosed && (
                <div className="rounded-2xl border border-[#9E2A2B]/35 bg-[#9E2A2B]/10 p-3.5 flex items-start gap-2.5 text-xs text-[#9E2A2B]">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold">Şube Şu An Kapalı</p>
                    <p className="mt-0.5">
                      {selectedNeighborhood?.branch.status.reason}
                    </p>
                  </div>
                </div>
              )}

              {/* Cart Items */}
              <div className="space-y-3">
                {cart.map((item) => (
                  <div
                    key={item.cartKey}
                    className="rounded-2xl border border-[#EAE0D5] bg-white p-3 flex gap-3 shadow-xs"
                  >
                    <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0 border border-[#EAE0D5]">
                      <ProductImage
                        src={item.imageUrl}
                        alt={item.productName}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-semibold text-sm text-[#1D110C] leading-snug">
                          {item.productName}
                        </h3>
                        <button
                          type="button"
                          onClick={() => removeFromCart(item.cartKey)}
                          aria-label={`${item.productName} kaldır`}
                          className="text-[#9B8275] hover:text-[#9E2A2B] p-1 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {item.selectedOptions.length > 0 && (
                        <p className="text-[11px] text-[#6E5245] mt-0.5 leading-relaxed">
                          {item.selectedOptions
                            .map((o) =>
                              o.priceDelta > 0
                                ? `${o.optionItemName} (+${formatTl(o.priceDelta)})`
                                : o.optionItemName,
                            )
                            .join(", ")}
                        </p>
                      )}

                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-sm font-bold text-[#2C1A12]">
                          {formatTl(item.unitPrice * item.quantity)}
                        </span>

                        <div className="flex items-center rounded-lg border border-[#DFD2C3] bg-[#FBF6F0]">
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.cartKey, -1)}
                            aria-label="Azalt"
                            className="w-7 h-7 flex items-center justify-center text-[#5C4338] hover:text-[#1D110C] cursor-pointer"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="w-6 text-center text-xs font-bold text-[#1D110C]">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.cartKey, 1)}
                            aria-label="Artır"
                            className="w-7 h-7 flex items-center justify-center text-[#5C4338] hover:text-[#1D110C] cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Summary & Continue */}
            <div className="border-t border-[#EAE0D5] bg-[#FFFDF9] p-4 sm:p-5 space-y-3">
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between text-[#5C4338]">
                  <span>Ara Toplam</span>
                  <span>{formatTl(cartSubtotal)}</span>
                </div>
                <div className="flex justify-between text-[#5C4338]">
                  <span>Teslimat Ücreti</span>
                  <span>
                    {deliveryFee === 0 ? "Ücretsiz" : formatTl(deliveryFee)}
                  </span>
                </div>
                <div className="flex justify-between text-base font-bold text-[#1D110C] pt-1.5 border-t border-[#EFE6DC]">
                  <span>Toplam</span>
                  <span>{formatTl(totalAmount)}</span>
                </div>
              </div>

              <button
                type="button"
                disabled={!canCheckout}
                onClick={() => setStep("checkout")}
                className="w-full rounded-xl bg-[#C68B3C] hover:bg-[#B0782D] disabled:bg-[#D8CCC0] disabled:text-[#8A7668] disabled:cursor-not-allowed text-white font-semibold text-sm py-3.5 px-4 transition-colors cursor-pointer"
              >
                {branchClosed
                  ? "Şube Şu An Kapalı"
                  : !selectedNeighborhood
                    ? "Önce Mahalle Seçin"
                    : missingAmount > 0
                      ? `Min. Tutar İçin ${formatTl(missingAmount)} Ekleyin`
                      : `Siparişi Tamamla • ${formatTl(totalAmount)}`}
              </button>
            </div>
          </>
        ) : (
          /* Step 2: Checkout */
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5">
            {!customer ? (
              <div className="rounded-2xl border border-[#E6D9CB] bg-white p-4">
                <OtpLoginForm
                  compact
                  title="Devam Etmek İçin Giriş Yapın"
                  subtitle="Sipariş durumunuzu takip edebilmek için telefonunuzu doğrulayın."
                />
              </div>
            ) : (
              <form onSubmit={handleSubmitOrder} className="space-y-4">
                {/* Saved Addresses & Last Order Address */}
                {addressesLoading ? (
                  <div className="h-16 rounded-xl bg-[#EFE6DC] animate-pulse" />
                ) : (
                  (servicedSavedAddresses.length > 0 || lastOrderAddress) && (
                    <div className="space-y-2">
                      <span className="block text-xs font-semibold uppercase tracking-wide text-[#5C4338]">
                        Kayıtlı / Önceki Adresleriniz
                      </span>
                      <div className="space-y-2">
                        {servicedSavedAddresses.map((addr) => (
                          <button
                            key={addr.id}
                            type="button"
                            onClick={() => handleSelectSavedAddress(addr)}
                            className={`w-full text-left rounded-xl border p-3 text-xs transition-all cursor-pointer ${
                              selectedAddressId === addr.id
                                ? "border-[#C68B3C] bg-[#FDF4E7]"
                                : "border-[#E6D9CB] bg-white hover:border-[#C68B3C]/50"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <p className="font-bold text-[#1D110C] truncate">
                                  {addr.title}
                                </p>
                                {selectedAddressId === addr.id && (
                                  <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-[#B0782D] shrink-0">
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    Seçili
                                  </span>
                                )}
                              </div>
                              <span className="text-[11px] text-[#8A6F62] shrink-0">
                                {addr.neighborhood}, {addr.district}
                              </span>
                            </div>
                            <p className="text-[#5C4338] mt-0.5">
                              {addr.fullAddress}
                            </p>
                            {addr.directions && (
                              <p className="text-[11px] text-[#8A6F62] mt-0.5">
                                Tarif: {addr.directions}
                              </p>
                            )}
                          </button>
                        ))}
                        {servicedSavedAddresses.length === 0 &&
                          lastOrderAddress && (
                            <button
                              type="button"
                              onClick={handleSelectLastOrderAddress}
                              className={`w-full text-left rounded-xl border p-3 text-xs transition-all cursor-pointer ${
                                selectedAddressId === "last-order"
                                  ? "border-[#C68B3C] bg-[#FDF4E7]"
                                  : "border-[#E6D9CB] bg-white hover:border-[#C68B3C]/50"
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <p className="font-bold text-[#1D110C] truncate">
                                    Son Sipariş Adresim
                                  </p>
                                  {selectedAddressId === "last-order" && (
                                    <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-[#B0782D] shrink-0">
                                      <CheckCircle2 className="w-3.5 h-3.5" />
                                      Seçili
                                    </span>
                                  )}
                                </div>
                                <span className="text-[11px] text-[#8A6F62] shrink-0">
                                  {lastOrderAddress.neighborhood},{" "}
                                  {lastOrderAddress.district}
                                </span>
                              </div>
                              <p className="text-[#5C4338] mt-0.5">
                                {lastOrderAddress.fullAddress}
                              </p>
                              {lastOrderAddress.directions && (
                                <p className="text-[11px] text-[#8A6F62] mt-0.5">
                                  Tarif: {lastOrderAddress.directions}
                                </p>
                              )}
                            </button>
                          )}
                        <button
                          type="button"
                          onClick={handleSelectNewAddress}
                          className={`w-full text-left rounded-xl border px-3 py-2 text-xs font-semibold cursor-pointer ${
                            selectedAddressId === "new"
                              ? "border-[#C68B3C] bg-[#FDF4E7] text-[#1D110C]"
                              : "border-dashed border-[#CBBBAE] text-[#6E5245]"
                          }`}
                        >
                          + Yeni Adres Gir
                        </button>
                      </div>
                    </div>
                  )
                )}

                {!hasSavedCustomerName && (
                  <div>
                    <label
                      htmlFor="checkout-name"
                      className="block text-xs font-semibold uppercase tracking-wide text-[#5C4338] mb-1"
                    >
                      Ad Soyad *
                    </label>
                    <input
                      id="checkout-name"
                      type="text"
                      required
                      minLength={2}
                      placeholder="Örn. Zeynep Kaya"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="w-full rounded-xl border border-[#DFD2C3] bg-white px-3.5 py-2.5 text-sm text-[#1D110C] focus:outline-none focus:ring-2 focus:ring-[#C68B3C]/40"
                    />
                  </div>
                )}

                {/* District, Neighborhood & Address Fields (shown only when entering a new address) */}
                {!addressesLoading && selectedAddressId === "new" && (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label
                          htmlFor="checkout-district"
                          className="block text-xs font-semibold uppercase tracking-wide text-[#5C4338] mb-1"
                        >
                          İlçe (İstanbul) *
                        </label>
                        <select
                          id="checkout-district"
                          value={checkoutDistrict || checkoutDistricts[0] || ""}
                          onChange={(e) => {
                            const nextDistrict = e.target.value;
                            setCheckoutDistrict(nextDistrict);
                            const firstNb = courierNeighborhoods.find(
                              (n) => n.district === nextDistrict,
                            );
                            if (firstNb) {
                              setCheckoutNeighborhoodId(firstNb.id);
                              setSelectedNeighborhood(
                                toStoredNeighborhood(firstNb),
                                { silent: true },
                              );
                              setSelectedAddressId("new");
                              setFullAddress("");
                              setDirections("");
                            }
                          }}
                          className="w-full rounded-xl border border-[#DFD2C3] bg-white px-3 py-2.5 text-sm text-[#1D110C] focus:outline-none focus:ring-2 focus:ring-[#C68B3C]/40"
                        >
                          {checkoutDistricts.map((dist) => (
                            <option key={dist} value={dist}>
                              {dist}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label
                          htmlFor="checkout-neighborhood"
                          className="block text-xs font-semibold uppercase tracking-wide text-[#5C4338] mb-1"
                        >
                          Mahalle *
                        </label>
                        <select
                          id="checkout-neighborhood"
                          value={
                            checkoutNeighborhoodId ||
                            checkoutNeighborhoods[0]?.id ||
                            ""
                          }
                          onChange={(e) => {
                            const nextId = e.target.value;
                            setCheckoutNeighborhoodId(nextId);
                            const chosen = courierNeighborhoods.find(
                              (n) => n.id === nextId,
                            );
                            if (chosen) {
                              setSelectedNeighborhood(
                                toStoredNeighborhood(chosen),
                                { silent: true },
                              );
                              setSelectedAddressId("new");
                              setFullAddress("");
                              setDirections("");
                            }
                          }}
                          className="w-full rounded-xl border border-[#DFD2C3] bg-white px-3 py-2.5 text-sm text-[#1D110C] focus:outline-none focus:ring-2 focus:ring-[#C68B3C]/40"
                        >
                          {checkoutNeighborhoods.map((nb) => (
                            <option key={nb.id} value={nb.id}>
                              {nb.neighborhood}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor="checkout-address"
                        className="block text-xs font-semibold uppercase tracking-wide text-[#5C4338] mb-1"
                      >
                        Açık Adres (Sokak, Bina No, Daire) *
                      </label>
                      <textarea
                        id="checkout-address"
                        required
                        minLength={5}
                        rows={2}
                        placeholder="Örn. Süleyman Seba Cad. No: 42 Kat: 3 Daire: 7"
                        value={fullAddress}
                        onChange={(e) => setFullAddress(e.target.value)}
                        className="w-full rounded-xl border border-[#DFD2C3] bg-white px-3.5 py-2.5 text-sm text-[#1D110C] focus:outline-none focus:ring-2 focus:ring-[#C68B3C]/40"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="checkout-directions"
                        className="block text-xs font-semibold uppercase tracking-wide text-[#5C4338] mb-1"
                      >
                        Adres Tarifi
                      </label>
                      <input
                        id="checkout-directions"
                        type="text"
                        placeholder="Örn. Eczanenin yanındaki kahverengi bina"
                        value={directions}
                        onChange={(e) => setDirections(e.target.value)}
                        className="w-full rounded-xl border border-[#DFD2C3] bg-white px-3.5 py-2.5 text-sm text-[#1D110C] focus:outline-none focus:ring-2 focus:ring-[#C68B3C]/40"
                      />
                    </div>
                  </>
                )}

                <div>
                  <label
                    htmlFor="checkout-note"
                    className="block text-xs font-semibold uppercase tracking-wide text-[#5C4338] mb-1"
                  >
                    Sipariş Notu
                  </label>
                  <input
                    id="checkout-note"
                    type="text"
                    placeholder="Örn. Zile basmayınız, kapıya bırakabilirsiniz"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    className="w-full rounded-xl border border-[#DFD2C3] bg-white px-3.5 py-2.5 text-sm text-[#1D110C] focus:outline-none focus:ring-2 focus:ring-[#C68B3C]/40"
                  />
                </div>

                {!addressesLoading && selectedAddressId === "new" && (
                  <div className="rounded-xl border border-[#E6D9CB] bg-[#FBF6F0] p-3 space-y-2">
                    <label className="flex items-center gap-2 text-xs font-semibold text-[#1D110C] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={saveAddress}
                        onChange={(e) => setSaveAddress(e.target.checked)}
                        className="rounded border-[#CBBBAE] text-[#C68B3C] focus:ring-[#C68B3C]"
                      />
                      Adresi hesabıma kaydet
                    </label>
                    {saveAddress && (
                      <input
                        type="text"
                        placeholder="Adres Başlığı (Ev, İş...)"
                        value={addressTitle}
                        onChange={(e) => setAddressTitle(e.target.value)}
                        className="w-full rounded-lg border border-[#DFD2C3] bg-white px-3 py-1.5 text-xs text-[#1D110C]"
                      />
                    )}
                  </div>
                )}

                {selectedNeighborhood && (
                  <div className="rounded-2xl border border-[#E6D9CB] bg-[#FAF6F1] p-3.5 flex items-start justify-between gap-3 text-xs">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <Store className="w-4 h-4 text-[#B6822E] shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <p className="font-bold text-[#120D0C]">
                          Teslimat Şubesi: {selectedNeighborhood.branch.name}
                        </p>
                        <p className="text-[#6E5245] mt-0.5">
                          {selectedNeighborhood.neighborhood},{" "}
                          {selectedNeighborhood.district} /{" "}
                          {selectedNeighborhood.city} •{" "}
                          {selectedNeighborhood.branch.status.estimatedMinMinutes}
                          -
                          {selectedNeighborhood.branch.status.estimatedMaxMinutes}{" "}
                          dk
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="rounded-2xl border border-[#C68B3C]/40 bg-[#FDF4E7] p-3.5 flex items-start gap-2.5">
                  <CreditCard className="w-4 h-4 text-[#B0782D] shrink-0 mt-0.5" />
                  <div className="text-xs text-[#5C4338]">
                    <p className="font-bold text-[#1D110C]">
                      Ödeme Yöntemi: PayTR Güvenli Online Ödeme
                    </p>
                    <p className="mt-0.5">
                      Kapıda nakit veya kredi kartı ile ödeme bulunmamaktadır.
                    </p>
                  </div>
                </div>

                {submitError && (
                  <div
                    role="alert"
                    className="rounded-xl border border-[#9E2A2B]/30 bg-[#9E2A2B]/10 p-3 text-xs font-semibold text-[#9E2A2B]"
                  >
                    {submitError}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full rounded-xl bg-[#2C1A12] hover:bg-[#1D110C] disabled:opacity-50 text-[#FBF6F0] font-semibold text-sm py-3.5 px-4 transition-colors cursor-pointer"
                >
                  {submitting
                    ? "Sipariş Oluşturuluyor..."
                    : `Ödemeye Geç • ${formatTl(totalAmount)}`}
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
