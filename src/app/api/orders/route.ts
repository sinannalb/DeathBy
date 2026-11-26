import crypto from "node:crypto";
import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  generateNextOrderNumber,
  jsonError,
  parseJsonBody,
} from "@/lib/api-helpers";
import { normalizePhone, requireCustomerSession } from "@/lib/auth";
import { computeBranchStatus } from "@/lib/branch-status";
import { createPaytrPaymentSession } from "@/lib/paytr";
import { decimalToNumber, serializeOrder } from "@/lib/serializers";
import type { SelectedOptionSnapshot } from "@/lib/types";

const createOrderSchema = z.object({
  branchId: z.string().min(1).optional(),
  neighborhoodId: z.string().min(1).optional(),
  city: z.string().trim().min(1, "Şehir gereklidir."),
  district: z.string().trim().min(1, "İlçe gereklidir."),
  neighborhood: z.string().trim().min(1, "Mahalle gereklidir."),
  fullAddress: z.string().trim().min(5, "Açık adres en az 5 karakter olmalıdır."),
  directions: z.string().trim().max(300).optional().nullable(),
  customerName: z.string().trim().min(2, "Ad Soyad gereklidir.").max(100),
  customerPhone: z.string().trim().optional(),
  note: z.string().trim().max(500).optional().nullable(),
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: z.number().int().min(1).max(50),
        selectedOptionItemIds: z.array(z.string().min(1)).default([]),
      }),
    )
    .min(1, "Sepetiniz boş olamaz."),
});

export async function POST(request: Request) {
  const auth = await requireCustomerSession();
  if (auth.response) return auth.response;

  const parsed = await parseJsonBody(request, createOrderSchema);
  if (parsed.response) return parsed.response;

  const data = parsed.data;
  const customerPhone = data.customerPhone
    ? normalizePhone(data.customerPhone)
    : auth.session.phone;

  if (!customerPhone) {
    return jsonError("Geçerli bir telefon numarası giriniz.", 400);
  }

  const deliveryNeighborhood = data.neighborhoodId
    ? await prisma.deliveryNeighborhood.findFirst({
        where: {
          id: data.neighborhoodId,
          isActive: true,
          branch: { isActive: true },
        },
        include: { branch: { include: { schedules: true } } },
      })
    : await prisma.deliveryNeighborhood.findFirst({
        where: {
          city: { equals: data.city, mode: "insensitive" },
          district: { equals: data.district, mode: "insensitive" },
          neighborhood: { equals: data.neighborhood, mode: "insensitive" },
          isActive: true,
          branch: { isActive: true },
        },
        include: { branch: { include: { schedules: true } } },
      });

  if (!deliveryNeighborhood) {
    return jsonError(
      "Seçilen mahalle için teslimat hizmeti bulunmamaktadır.",
      400,
    );
  }

  if (data.branchId && data.branchId !== deliveryNeighborhood.branchId) {
    return jsonError(
      "Seçilen mahalle bu şubenin teslimat bölgesinde değildir.",
      400,
    );
  }

  const branch = deliveryNeighborhood.branch;
  if (!branch.courierEnabled) {
    return NextResponse.json(
      {
        error: `${branch.name} şu an yalnızca Gel-Al (Takeaway) hizmet vermektedir; kurye teslimatı kapalıdır.`,
      },
      { status: 400 },
    );
  }
  const branchStatus = computeBranchStatus(branch);
  if (!branchStatus.canAcceptOrders) {
    return NextResponse.json(
      {
        error: branchStatus.reason || "Şube şu anda sipariş alamamaktadır.",
        status: branchStatus,
      },
      { status: 400 },
    );
  }

  const uniqueProductIds = Array.from(
    new Set(data.items.map((item) => item.productId)),
  );
  const products = await prisma.product.findMany({
    where: { id: { in: uniqueProductIds } },
    include: {
      category: true,
      branchAvailabilities: {
        where: { branchId: branch.id },
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
  const preparedItems: Array<{
    productId: string;
    productName: string;
    unitPrice: number;
    quantity: number;
    selectedOptionsJson: Prisma.InputJsonValue;
    lineTotal: number;
  }> = [];

  let subtotal = 0;

  for (const reqItem of data.items) {
    const product = productMap.get(reqItem.productId);
    if (!product || !product.isActive || !product.category.isActive) {
      return jsonError(
        "Sepetteki ürünlerden biri artık aktif değil veya bulunamadı.",
        400,
      );
    }

    const avail = product.branchAvailabilities[0];
    const branchAvailable = avail ? avail.isAvailable : true;
    if (!branchAvailable) {
      return jsonError(
        `"${product.name}" seçili şubede şu anda mevcut değil.`,
        400,
      );
    }

    const uniqueOptionIds = Array.from(new Set(reqItem.selectedOptionItemIds));

    // Build lookup of available option items attached to this specific product
    const attachedItemMap = new Map<
      string,
      {
        groupId: string;
        groupName: string;
        itemId: string;
        itemName: string;
        priceDelta: number;
        isAvailable: boolean;
      }
    >();

    for (const link of product.optionGroups) {
      const og = link.optionGroup;
      for (const optItem of og.items) {
        attachedItemMap.set(optItem.id, {
          groupId: og.id,
          groupName: og.name,
          itemId: optItem.id,
          itemName: optItem.name,
          priceDelta: decimalToNumber(optItem.priceDelta),
          isAvailable: optItem.isAvailable,
        });
      }
    }

    const selectedSnapshots: SelectedOptionSnapshot[] = [];
    const selectedByGroup = new Map<string, number>();

    for (const optionItemId of uniqueOptionIds) {
      const foundOpt = attachedItemMap.get(optionItemId);
      if (!foundOpt) {
        return jsonError(
          `"${product.name}" ürünü için geçersiz seçenek gönderildi.`,
          400,
        );
      }
      if (!foundOpt.isAvailable) {
        return jsonError(
          `"${product.name}" için "${foundOpt.itemName}" seçeneği şu anda tükendi.`,
          400,
        );
      }
      selectedSnapshots.push({
        optionGroupId: foundOpt.groupId,
        optionGroupName: foundOpt.groupName,
        optionItemId: foundOpt.itemId,
        optionItemName: foundOpt.itemName,
        priceDelta: foundOpt.priceDelta,
      });
      selectedByGroup.set(
        foundOpt.groupId,
        (selectedByGroup.get(foundOpt.groupId) ?? 0) + 1,
      );
    }

    // Validate required and single-selection constraints
    for (const link of product.optionGroups) {
      const og = link.optionGroup;
      const availableItemsCount = og.items.filter((i) => i.isAvailable).length;
      if (availableItemsCount === 0) continue;

      const selectedCount = selectedByGroup.get(og.id) ?? 0;
      if (og.isRequired && selectedCount === 0) {
        return jsonError(
          `"${product.name}" ürünü için "${og.name}" seçimi zorunludur.`,
          400,
        );
      }
      if (og.selectionType === "SINGLE" && selectedCount > 1) {
        return jsonError(
          `"${og.name}" grubundan yalnızca 1 seçenek seçilebilir.`,
          400,
        );
      }
    }

    const basePrice = decimalToNumber(product.price);
    const optionsDelta = selectedSnapshots.reduce(
      (sum, opt) => sum + opt.priceDelta,
      0,
    );
    const unitPrice = Number((basePrice + optionsDelta).toFixed(2));
    const lineTotal = Number((unitPrice * reqItem.quantity).toFixed(2));

    subtotal = Number((subtotal + lineTotal).toFixed(2));

    preparedItems.push({
      productId: product.id,
      productName: product.name,
      unitPrice,
      quantity: reqItem.quantity,
      selectedOptionsJson: selectedSnapshots as unknown as Prisma.InputJsonValue,
      lineTotal,
    });
  }

  const minOrderAmount = decimalToNumber(deliveryNeighborhood.minOrderAmount);
  if (subtotal < minOrderAmount) {
    return jsonError(
      `Bu mahalle için minimum sipariş tutarı ${minOrderAmount.toFixed(2)} TL'dir. Sepet toplamınız: ${subtotal.toFixed(2)} TL.`,
      400,
    );
  }

  const deliveryFee = decimalToNumber(deliveryNeighborhood.deliveryFee);
  const totalAmount = Number((subtotal + deliveryFee).toFixed(2));
  const merchantOid = `DBC${Date.now()}${crypto
    .randomBytes(3)
    .toString("hex")
    .toUpperCase()}`;

  const createdOrder = await prisma.$transaction(async (tx) => {
    const orderNumber = await generateNextOrderNumber(tx);

    if (auth.session.name === "Müşteri" && data.customerName !== "Müşteri") {
      await tx.user.update({
        where: { id: auth.session.userId },
        data: { name: data.customerName },
      });
    }

    // Ensure every customer who places an order has at least 1 active saved address
    const activeAddressCount = await tx.customerAddress.count({
      where: { userId: auth.session.userId, isActive: true },
    });
    if (activeAddressCount === 0) {
      await tx.customerAddress.create({
        data: {
          userId: auth.session.userId,
          title: "Sipariş Adresim",
          city: deliveryNeighborhood.city,
          district: deliveryNeighborhood.district,
          neighborhood: deliveryNeighborhood.neighborhood,
          fullAddress: data.fullAddress,
          directions: data.directions || null,
          isActive: true,
        },
      });
    }

    return tx.order.create({
      data: {
        orderNumber,
        userId: auth.session.userId,
        branchId: branch.id,
        status: "RECEIVED",
        paymentStatus: "PENDING",
        paymentProvider: "PAYTR",
        merchantOid,
        subtotal,
        deliveryFee,
        totalAmount,
        customerName: data.customerName,
        customerPhone,
        city: deliveryNeighborhood.city,
        district: deliveryNeighborhood.district,
        neighborhood: deliveryNeighborhood.neighborhood,
        fullAddress: data.fullAddress,
        directions: data.directions || null,
        note: data.note || null,
        items: {
          create: preparedItems,
        },
      },
      include: {
        branch: {
          select: {
            id: true,
            name: true,
            phone: true,
            address: true,
            paperWidth: true,
          },
        },
        items: true,
      },
    });
  });

  const forwardedFor = request.headers.get("x-forwarded-for");
  const userIp =
    forwardedFor?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "127.0.0.1";

  const basketItems = preparedItems.map((item) => ({
    name: item.productName,
    unitPriceTl: item.unitPrice,
    quantity: item.quantity,
  }));
  if (deliveryFee > 0) {
    basketItems.push({
      name: "Teslimat Ücreti",
      unitPriceTl: deliveryFee,
      quantity: 1,
    });
  }

  let payment;
  try {
    payment = await createPaytrPaymentSession({
      merchantOid,
      email: `${customerPhone}@musteri.deathbychocolate.local`,
      paymentAmountKurus: Math.round(totalAmount * 100),
      userName: data.customerName,
      userAddress: `${data.fullAddress}, ${deliveryNeighborhood.neighborhood}, ${deliveryNeighborhood.district}/${deliveryNeighborhood.city}`,
      userPhone: customerPhone,
      userIp,
      basketItems,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Ödeme oturumu başlatılamadı.";
    return jsonError(message, 502);
  }

  return NextResponse.json(
    {
      order: serializeOrder(createdOrder),
      payment,
    },
    { status: 201 },
  );
}
