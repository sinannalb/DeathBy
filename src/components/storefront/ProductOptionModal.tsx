"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Check, Minus, Plus, X } from "lucide-react";
import type {
  MenuProductDTO,
  OptionGroupDTO,
  SelectedOptionSnapshot,
} from "@/lib/types";
import { ProductImage } from "./ProductImage";
import { useStore } from "./StoreProvider";
import { formatTl } from "./utils";

interface ProductOptionModalProps {
  product: MenuProductDTO | null;
  onClose: () => void;
}

function buildInitialSelections(
  optionGroups: OptionGroupDTO[],
): Record<string, string[]> {
  const initial: Record<string, string[]> = {};
  for (const group of optionGroups) {
    const available = group.items.filter((i) => i.isAvailable);
    if (available.length === 0) continue;

    if (group.selectionType === "SINGLE") {
      const def = available.find((i) => i.isDefault);
      initial[group.id] = def ? [def.id] : [];
    } else {
      initial[group.id] = available.filter((i) => i.isDefault).map((i) => i.id);
    }
  }
  return initial;
}

export function ProductOptionModal({
  product,
  onClose,
}: ProductOptionModalProps) {
  const { addToCart, showToast } = useStore();
  const [selections, setSelections] = useState<Record<string, string[]>>({});
  const [quantity, setQuantity] = useState(1);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (!product) return;
    setSelections(buildInitialSelections(product.optionGroups));
    setQuantity(1);
    setValidationError(null);
  }, [product]);

  useEffect(() => {
    if (!product) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [product, onClose]);

  const { selectedSnapshots, selectedIds, unitPrice, lineTotal, missingGroup } =
    useMemo(() => {
      if (!product) {
        return {
          selectedSnapshots: [] as SelectedOptionSnapshot[],
          selectedIds: [] as string[],
          unitPrice: 0,
          lineTotal: 0,
          missingGroup: null as OptionGroupDTO | null,
        };
      }

      const snapshots: SelectedOptionSnapshot[] = [];
      const ids: string[] = [];
      let optionsDelta = 0;
      let missing: OptionGroupDTO | null = null;

      for (const group of product.optionGroups) {
        const available = group.items.filter((i) => i.isAvailable);
        if (available.length === 0) continue;

        const chosen = selections[group.id] ?? [];
        if (group.isRequired && chosen.length === 0 && !missing) {
          missing = group;
        }

        for (const itemId of chosen) {
          const item = available.find((i) => i.id === itemId);
          if (item) {
            ids.push(item.id);
            optionsDelta += item.priceDelta;
            snapshots.push({
              optionGroupId: group.id,
              optionGroupName: group.name,
              optionItemId: item.id,
              optionItemName: item.name,
              priceDelta: item.priceDelta,
            });
          }
        }
      }

      const unit = Number((product.price + optionsDelta).toFixed(2));
      const total = Number((unit * quantity).toFixed(2));
      return {
        selectedSnapshots: snapshots,
        selectedIds: ids,
        unitPrice: unit,
        lineTotal: total,
        missingGroup: missing,
      };
    }, [product, selections, quantity]);

  if (!product) return null;

  function toggleSingle(group: OptionGroupDTO, itemId: string) {
    setValidationError(null);
    setSelections((prev) => {
      const current = prev[group.id] ?? [];
      if (!group.isRequired && current[0] === itemId) {
        return { ...prev, [group.id]: [] };
      }
      return { ...prev, [group.id]: [itemId] };
    });
  }

  function toggleMultiple(group: OptionGroupDTO, itemId: string) {
    setValidationError(null);
    setSelections((prev) => {
      const current = prev[group.id] ?? [];
      const exists = current.includes(itemId);
      const next = exists
        ? current.filter((id) => id !== itemId)
        : [...current, itemId];
      return { ...prev, [group.id]: next };
    });
  }

  function handleConfirm() {
    if (!product) return;
    if (missingGroup) {
      setValidationError(`Lütfen "${missingGroup.name}" için seçim yapınız.`);
      return;
    }

    addToCart({
      productId: product.id,
      productName: product.name,
      basePrice: product.price,
      unitPrice,
      quantity,
      imageUrl: product.imageUrl,
      selectedOptionItemIds: selectedIds,
      selectedOptions: selectedSnapshots,
    });
    showToast(`${product.name} sepete eklendi.`, "success");
    onClose();
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${product.name} seçenekleri`}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-[#1D110C]/65 backdrop-blur-xs"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl bg-[#FFFDF9] border border-[#E6D9CB] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header image + title */}
        <div className="relative h-44 sm:h-48 shrink-0 bg-[#2C1A12]">
          <ProductImage
            src={product.imageUrl}
            alt={product.name}
            className="w-full h-full object-cover"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#1D110C]/85 via-[#1D110C]/20 to-transparent" />
          <button
            type="button"
            onClick={onClose}
            aria-label="Kapat"
            className="absolute right-3.5 top-3.5 w-9 h-9 rounded-full bg-[#1D110C]/70 text-[#FBF6F0] hover:bg-[#1D110C] flex items-center justify-center backdrop-blur-xs cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="absolute bottom-3.5 left-4 right-4 text-[#FBF6F0]">
            <h2 className="font-serif text-xl font-bold leading-snug">
              {product.name}
            </h2>
            {product.description && (
              <p className="text-xs text-[#E8DDD1] line-clamp-2 mt-0.5">
                {product.description}
              </p>
            )}
          </div>
        </div>

        {/* Option Groups */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-5 flex-1">
          {product.optionGroups.map((group) => {
            const available = group.items.filter((i) => i.isAvailable);
            if (available.length === 0) return null;
            const chosen = selections[group.id] ?? [];

            return (
              <div key={group.id} className="space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-[#1D110C]">
                      {group.name}
                    </h3>
                    <p className="text-[11px] text-[#8A6F62]">
                      {group.selectionType === "SINGLE"
                        ? "Tek seçim"
                        : "Birden fazla seçebilirsiniz"}
                    </p>
                  </div>
                  {group.isRequired ? (
                    <span className="rounded-full bg-[#9E2A2B]/12 text-[#9E2A2B] border border-[#9E2A2B]/25 text-[11px] font-bold px-2.5 py-0.5">
                      Zorunlu
                    </span>
                  ) : (
                    <span className="rounded-full bg-[#F3EAE0] text-[#6E5245] text-[11px] font-medium px-2.5 py-0.5">
                      İsteğe Bağlı
                    </span>
                  )}
                </div>

                <div className="space-y-2">
                  {available.map((item) => {
                    const isSelected = chosen.includes(item.id);
                    const isSingle = group.selectionType === "SINGLE";
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() =>
                          isSingle
                            ? toggleSingle(group, item.id)
                            : toggleMultiple(group, item.id)
                        }
                        className={`w-full flex items-center justify-between gap-3 rounded-2xl border px-3.5 py-3 text-left transition-all cursor-pointer ${
                          isSelected
                            ? "border-[#C68B3C] bg-[#FDF4E7] ring-1 ring-[#C68B3C]/40"
                            : "border-[#E6D9CB] bg-white hover:border-[#C68B3C]/50"
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span
                            className={`w-5 h-5 shrink-0 flex items-center justify-center border transition-colors ${
                              isSingle ? "rounded-full" : "rounded-md"
                            } ${
                              isSelected
                                ? "border-[#C68B3C] bg-[#C68B3C] text-white"
                                : "border-[#CBBBAE] bg-white"
                            }`}
                          >
                            {isSelected && <Check className="w-3.5 h-3.5" />}
                          </span>
                          <span className="text-sm font-medium text-[#1D110C] truncate">
                            {item.name}
                          </span>
                        </div>
                        <span className="text-xs font-semibold text-[#5C4338] shrink-0">
                          {item.priceDelta > 0
                            ? `+${formatTl(item.priceDelta)}`
                            : "Ücretsiz"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {validationError && (
            <div
              role="alert"
              className="rounded-xl bg-[#9E2A2B]/10 border border-[#9E2A2B]/30 px-3.5 py-2.5 text-xs font-semibold text-[#9E2A2B] flex items-center gap-2"
            >
              <AlertCircle className="w-4 h-4 shrink-0" />
              {validationError}
            </div>
          )}
        </div>

        {/* Footer stepper + Add button */}
        <div className="border-t border-[#EAE0D5] bg-[#FFFDF9] p-4 flex items-center gap-3">
          <div className="flex items-center rounded-xl border border-[#DFD2C3] bg-white">
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              aria-label="Adet azalt"
              className="w-10 h-11 flex items-center justify-center text-[#5C4338] hover:text-[#1D110C] cursor-pointer"
            >
              <Minus className="w-4 h-4" />
            </button>
            <span className="w-7 text-center text-sm font-bold text-[#1D110C]">
              {quantity}
            </span>
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.min(50, q + 1))}
              aria-label="Adet artır"
              className="w-10 h-11 flex items-center justify-center text-[#5C4338] hover:text-[#1D110C] cursor-pointer"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={handleConfirm}
            className="flex-1 h-11 rounded-xl bg-[#2C1A12] hover:bg-[#1D110C] text-[#FBF6F0] font-semibold text-sm px-4 flex items-center justify-between transition-colors cursor-pointer"
          >
            <span>Sepete Ekle</span>
            <span className="font-bold text-[#F5D09B]">
              {formatTl(lineTotal)}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
