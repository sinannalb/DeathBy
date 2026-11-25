import type { CartItem } from "./types";

const tlFormatter = new Intl.NumberFormat("tr-TR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatTl(amount: number): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  return `₺${tlFormatter.format(safe)}`;
}

export function formatPhoneDisplay(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("0")) {
    return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7, 9)} ${digits.slice(9, 11)}`;
  }
  if (digits.length === 10 && digits.startsWith("5")) {
    return `0${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 8)} ${digits.slice(8, 10)}`;
  }
  return phone;
}

export function formatDateTimeTr(iso: string): string {
  try {
    return new Intl.DateTimeFormat("tr-TR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function buildCartKey(
  productId: string,
  selectedOptionItemIds: string[],
): string {
  const sorted = [...selectedOptionItemIds].sort();
  return `${productId}::${sorted.join(",")}`;
}

export function calculateCartTotals(items: CartItem[]): {
  count: number;
  subtotal: number;
} {
  let count = 0;
  let subtotal = 0;
  for (const item of items) {
    count += item.quantity;
    subtotal += item.unitPrice * item.quantity;
  }
  return {
    count,
    subtotal: Number(subtotal.toFixed(2)),
  };
}

export function normalizeTrText(value: string): string {
  return value.trim().toLocaleLowerCase("tr-TR");
}
