import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-helpers";
import { requireCustomerSession } from "@/lib/auth";
import { computeBranchStatus } from "@/lib/branch-status";
import { decimalToNumber } from "@/lib/serializers";
import type {
  ReorderCartItemDTO,
  ReorderUnavailableItemDTO,
  SelectedOptionSnapshot,
} from "@/lib/types";

const reorderBodySchema = z
  .object({
    branchId: z.string().min(1).optional(),
  })
  .optional();

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireCustomerSession();
  if (auth.response) return auth.response;

  const { id } = await context.params;
  const rawBody = await request.json().catch(() => ({}));
  const parsedBody = reorderBodySchema.safeParse(rawBody);
  if (!parsedBody.success) {
    return jsonError("Geçersiz istek gövdesi.", 400);
  }

  const order = await prisma.order.findUnique({
    where: { id },
    include: { items: true },
  });

  if (!order) {
    return jsonError("Sipariş bulunamadı.", 404);
  }

  if (order.userId !== auth.session.userId) {
    return jsonError("Bu siparişe erişim yetkiniz yok.", 403);
  }

  const targetBranchId = parsedBody.data?.branchId || order.branchId;
  const targetBranch = await prisma.branch.findUnique({
    where: { id: targetBranchId },
    include: { schedules: true },
  });

  if (!targetBranch || !targetBranch.isActive) {
    return jsonError("Hedef şube bulunamadı veya aktif değil.", 400);
  }

  const branchStatus = computeBranchStatus(targetBranch);

  const productIds = Array.from(
    new Set(
      order.items
        .map((i) => i.productId)
        .filter((pid): pid is string => Boolean(pid)),
    ),
  );

  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    include: {
      category: true,
      branchAvailabilities: {
        where: { branchId: targetBranchId },
      },
      optionGroups: {
        where: { optionGroup: { isActive: true } },
        orderBy: [{ sortOrder: "asc" }, { optionGroup: { sortOrder: "asc" } }],
        include: {
          optionGroup: {
            include: {
              items: {
                orderBy: { sortOrder: "asc" },
              },
            },
          },
        },
      },
    },
  });

  const productMap = new Map(products.map((p) => [p.id, p]));
  const cartItems: ReorderCartItemDTO[] = [];
  const unavailableItems: ReorderUnavailableItemDTO[] = [];

  for (const orderItem of order.items) {
    if (!orderItem.productId) {
      unavailableItems.push({
        productName: orderItem.productName,
        reason: "Ürün artık menüde bulunmuyor.",
      });
      continue;
    }

    const product = productMap.get(orderItem.productId);
    if (!product || !product.isActive || !product.category.isActive) {
      unavailableItems.push({
        productName: orderItem.productName,
        reason: "Ürün şu anda menüde aktif değil.",
      });
      continue;
    }

    const avail = product.branchAvailabilities[0];
    const branchAvailable = avail ? avail.isAvailable : true;
    if (!branchAvailable) {
      unavailableItems.push({
        productName: product.name,
        reason: "Ürün seçili şubede şu anda tükendi.",
      });
      continue;
    }

    const attachedOptionItems = new Map<
      string,
      {
        optionGroupId: string;
        optionGroupName: string;
        optionItemId: string;
        optionItemName: string;
        priceDelta: number;
        isAvailable: boolean;
      }
    >();

    for (const link of product.optionGroups) {
      const og = link.optionGroup;
      for (const optItem of og.items) {
        attachedOptionItems.set(optItem.id, {
          optionGroupId: og.id,
          optionGroupName: og.name,
          optionItemId: optItem.id,
          optionItemName: optItem.name,
          priceDelta: decimalToNumber(optItem.priceDelta),
          isAvailable: optItem.isAvailable,
        });
      }
    }

    const oldOptions = Array.isArray(orderItem.selectedOptionsJson)
      ? (orderItem.selectedOptionsJson as Array<Record<string, unknown>>)
      : [];

    let optionFailureReason: string | null = null;
    const validSelectedOptions: SelectedOptionSnapshot[] = [];
    const selectedGroupIds = new Set<string>();

    for (const oldOpt of oldOptions) {
      const optId = String(oldOpt.optionItemId ?? "");
      const optName = String(oldOpt.optionItemName ?? "Seçenek");
      if (!optId) continue;

      const currentOpt = attachedOptionItems.get(optId);
      if (!currentOpt) {
        optionFailureReason = `"${optName}" seçeneği artık bu üründe bulunmuyor.`;
        break;
      }
      if (!currentOpt.isAvailable) {
        optionFailureReason = `"${optName}" seçeneği şu anda tükendi.`;
        break;
      }

      selectedGroupIds.add(currentOpt.optionGroupId);
      validSelectedOptions.push({
        optionGroupId: currentOpt.optionGroupId,
        optionGroupName: currentOpt.optionGroupName,
        optionItemId: currentOpt.optionItemId,
        optionItemName: currentOpt.optionItemName,
        priceDelta: currentOpt.priceDelta,
      });
    }

    if (optionFailureReason) {
      unavailableItems.push({
        productName: product.name,
        reason: optionFailureReason,
      });
      continue;
    }

    // Verify all currently required option groups on this product remain satisfied
    const missingRequiredGroup = product.optionGroups.find((link) => {
      const og = link.optionGroup;
      const hasAvailableItems = og.items.some((i) => i.isAvailable);
      return og.isRequired && hasAvailableItems && !selectedGroupIds.has(og.id);
    });

    if (missingRequiredGroup) {
      unavailableItems.push({
        productName: product.name,
        reason: `Yeni zorunlu seçenek ("${missingRequiredGroup.optionGroup.name}") nedeniyle ürünü menüden tekrar seçiniz.`,
      });
      continue;
    }

    const basePrice = decimalToNumber(product.price);
    const optionsDelta = validSelectedOptions.reduce(
      (sum, o) => sum + o.priceDelta,
      0,
    );
    const unitPrice = Number((basePrice + optionsDelta).toFixed(2));
    const lineTotal = Number((unitPrice * orderItem.quantity).toFixed(2));

    cartItems.push({
      productId: product.id,
      productName: product.name,
      unitPrice,
      quantity: orderItem.quantity,
      imageUrl: product.imageUrl,
      selectedOptionItemIds: validSelectedOptions.map((o) => o.optionItemId),
      selectedOptions: validSelectedOptions,
      lineTotal,
    });
  }

  return NextResponse.json({
    branchId: targetBranchId,
    branchStatus,
    cartItems,
    unavailableItems,
  });
}
