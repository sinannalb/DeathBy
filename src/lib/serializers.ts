import type { Prisma } from "@prisma/client";
import {
  ORDER_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
} from "@/lib/constants";
import { computeBranchStatus } from "@/lib/branch-status";
import type {
  BranchDetailDTO,
  BranchSummaryDTO,
  DeliveryNeighborhoodDTO,
  OptionGroupDTO,
  OrderDTO,
  SelectedOptionSnapshot,
} from "@/lib/types";

export function decimalToNumber(value: Prisma.Decimal | number | string): number {
  return Number(Number(value).toFixed(2));
}

export function serializeNeighborhood(n: {
  id: string;
  branchId: string;
  city: string;
  district: string;
  neighborhood: string;
  minOrderAmount: Prisma.Decimal | number;
  deliveryFee: Prisma.Decimal | number;
  isActive: boolean;
}): DeliveryNeighborhoodDTO {
  return {
    id: n.id,
    branchId: n.branchId,
    city: n.city,
    district: n.district,
    neighborhood: n.neighborhood,
    minOrderAmount: decimalToNumber(n.minOrderAmount),
    deliveryFee: decimalToNumber(n.deliveryFee),
    isActive: n.isActive,
  };
}

export function serializeBranchSummary(
  branch: Prisma.BranchGetPayload<{ include: { schedules: true } }>,
  now: Date = new Date(),
): BranchSummaryDTO {
  return {
    id: branch.id,
    name: branch.name,
    slug: branch.slug,
    address: branch.address,
    phone: branch.phone,
    paperWidth: branch.paperWidth,
    manualStatus: branch.manualStatus,
    isBusy: branch.isBusy,
    busyUntil: branch.busyUntil ? branch.busyUntil.toISOString() : null,
    busyMessage: branch.busyMessage,
    estimatedMinMinutes: branch.estimatedMinMinutes,
    estimatedMaxMinutes: branch.estimatedMaxMinutes,
    courierEnabled: branch.courierEnabled,
    isActive: branch.isActive,
    status: computeBranchStatus(branch, now),
  };
}

export function serializeBranchDetail(
  branch: Prisma.BranchGetPayload<{
    include: { schedules: true; neighborhoods: true };
  }>,
  now: Date = new Date(),
): BranchDetailDTO {
  return {
    ...serializeBranchSummary(branch, now),
    schedules: [...branch.schedules]
      .sort((a, b) => a.dayOfWeek - b.dayOfWeek)
      .map((s) => ({
        id: s.id,
        dayOfWeek: s.dayOfWeek,
        openTime: s.openTime,
        closeTime: s.closeTime,
        isClosed: s.isClosed,
      })),
    neighborhoods: branch.neighborhoods.map(serializeNeighborhood),
  };
}

export function serializeOptionGroup(
  og: Prisma.OptionGroupGetPayload<{ include: { items: true } }>,
): OptionGroupDTO {
  return {
    id: og.id,
    name: og.name,
    selectionType: og.selectionType,
    isRequired: og.isRequired,
    sortOrder: og.sortOrder,
    isActive: og.isActive,
    items: [...og.items]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((item) => ({
        id: item.id,
        optionGroupId: item.optionGroupId,
        name: item.name,
        priceDelta: decimalToNumber(item.priceDelta),
        isDefault: item.isDefault,
        isAvailable: item.isAvailable,
        sortOrder: item.sortOrder,
      })),
  };
}

function parseSelectedOptions(raw: Prisma.JsonValue): SelectedOptionSnapshot[] {
  if (!Array.isArray(raw)) return [];
  const result: SelectedOptionSnapshot[] = [];
  for (const entry of raw) {
    if (entry && typeof entry === "object" && !Array.isArray(entry)) {
      const obj = entry as Record<string, unknown>;
      result.push({
        optionGroupId: String(obj.optionGroupId ?? ""),
        optionGroupName: String(obj.optionGroupName ?? ""),
        optionItemId: String(obj.optionItemId ?? ""),
        optionItemName: String(obj.optionItemName ?? ""),
        priceDelta: Number(obj.priceDelta ?? 0),
      });
    }
  }
  return result;
}

export function serializeOrder(
  order: Prisma.OrderGetPayload<{
    include: {
      branch: {
        select: { id: true; name: true; phone: true; address: true; paperWidth: true };
      };
      items: true;
    };
  }>,
): OrderDTO {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    userId: order.userId,
    branchId: order.branchId,
    branchName: order.branch.name,
    branchPhone: order.branch.phone,
    branchAddress: order.branch.address,
    paperWidth: order.branch.paperWidth,
    status: order.status,
    statusLabel: ORDER_STATUS_LABELS[order.status],
    paymentStatus: order.paymentStatus,
    paymentStatusLabel: PAYMENT_STATUS_LABELS[order.paymentStatus],
    paymentProvider: order.paymentProvider,
    merchantOid: order.merchantOid,
    subtotal: decimalToNumber(order.subtotal),
    deliveryFee: decimalToNumber(order.deliveryFee),
    totalAmount: decimalToNumber(order.totalAmount),
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    city: order.city,
    district: order.district,
    neighborhood: order.neighborhood,
    fullAddress: order.fullAddress,
    directions: order.directions,
    note: order.note,
    printedAt: order.printedAt ? order.printedAt.toISOString() : null,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
    items: order.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      productName: item.productName,
      unitPrice: decimalToNumber(item.unitPrice),
      quantity: item.quantity,
      selectedOptions: parseSelectedOptions(item.selectedOptionsJson),
      lineTotal: decimalToNumber(item.lineTotal),
    })),
  };
}
