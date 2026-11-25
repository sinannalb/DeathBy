import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-helpers";
import { requirePanelRole } from "@/lib/auth";
import { decimalToNumber } from "@/lib/serializers";

function parseDateBound(
  raw: string | null,
  endOfDay: boolean,
): Date | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
  const suffix = endOfDay ? "T23:59:59.999+03:00" : "T00:00:00.000+03:00";
  const d = new Date(`${trimmed}${suffix}`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function GET(request: Request) {
  const auth = await requirePanelRole(["ADMIN", "SYSTEM"]);
  if (auth.response) return auth.response;

  if (auth.session.role === "SYSTEM" && !auth.session.branchId) {
    return jsonError("Kullanıcıya atanmış şube bulunamadı.", 403);
  }

  const { searchParams } = new URL(request.url);
  const now = new Date();
  const defaultFrom = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  const fromDate = parseDateBound(searchParams.get("from"), false) ?? defaultFrom;
  const toDate = parseDateBound(searchParams.get("to"), true) ?? now;
  const requestedBranchId = searchParams.get("branchId")?.trim() || null;

  if (
    auth.session.role === "SYSTEM" &&
    requestedBranchId &&
    requestedBranchId !== auth.session.branchId
  ) {
    return jsonError("Yalnızca kendi şubenizin raporlarını görebilirsiniz.", 403);
  }

  const effectiveBranchId =
    auth.session.role === "SYSTEM" ? auth.session.branchId! : requestedBranchId;

  const [branches, orders, products] = await Promise.all([
    prisma.branch.findMany({
      where:
        auth.session.role === "SYSTEM"
          ? { id: auth.session.branchId! }
          : undefined,
      orderBy: { name: "asc" },
      select: { id: true, name: true, slug: true, courierEnabled: true },
    }),
    prisma.order.findMany({
      where: {
        paymentStatus: "PAID",
        status: { not: "CANCELLED" },
        createdAt: {
          gte: fromDate,
          lte: toDate,
        },
        ...(effectiveBranchId ? { branchId: effectiveBranchId } : {}),
      },
      include: {
        branch: { select: { id: true, name: true } },
        items: true,
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.product.findMany({
      select: {
        id: true,
        category: { select: { name: true } },
      },
    }),
  ]);

  const categoryByProductId = new Map(
    products.map((p) => [p.id, p.category.name]),
  );

  let totalRevenue = 0;
  let totalItemQuantity = 0;

  const branchAgg = new Map<
    string,
    {
      branchId: string;
      branchName: string;
      orderCount: number;
      totalRevenue: number;
      itemQuantity: number;
    }
  >();

  for (const b of branches) {
    if (!effectiveBranchId || b.id === effectiveBranchId) {
      branchAgg.set(b.id, {
        branchId: b.id,
        branchName: b.name,
        orderCount: 0,
        totalRevenue: 0,
        itemQuantity: 0,
      });
    }
  }

  const productAgg = new Map<
    string,
    {
      productKey: string;
      productName: string;
      categoryName: string;
      quantity: number;
      revenue: number;
      orderIds: Set<string>;
    }
  >();

  const dayAgg = new Map<
    string,
    { date: string; orderCount: number; revenue: number }
  >();

  const istanbulDayFmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  for (const order of orders) {
    const orderTotal = decimalToNumber(order.totalAmount);
    totalRevenue += orderTotal;

    const bEntry = branchAgg.get(order.branchId) ?? {
      branchId: order.branchId,
      branchName: order.branch.name,
      orderCount: 0,
      totalRevenue: 0,
      itemQuantity: 0,
    };
    bEntry.orderCount += 1;
    bEntry.totalRevenue += orderTotal;

    const dayKey = istanbulDayFmt.format(order.createdAt);
    const dayEntry = dayAgg.get(dayKey) ?? {
      date: dayKey,
      orderCount: 0,
      revenue: 0,
    };
    dayEntry.orderCount += 1;
    dayEntry.revenue += orderTotal;
    dayAgg.set(dayKey, dayEntry);

    for (const item of order.items) {
      totalItemQuantity += item.quantity;
      bEntry.itemQuantity += item.quantity;

      const prodKey = item.productId || item.productName;
      const catName =
        (item.productId && categoryByProductId.get(item.productId)) ||
        "Diğer";
      const pEntry = productAgg.get(prodKey) ?? {
        productKey: prodKey,
        productName: item.productName,
        categoryName: catName,
        quantity: 0,
        revenue: 0,
        orderIds: new Set<string>(),
      };
      pEntry.quantity += item.quantity;
      pEntry.revenue += decimalToNumber(item.lineTotal);
      pEntry.orderIds.add(order.id);
      productAgg.set(prodKey, pEntry);
    }

    branchAgg.set(order.branchId, bEntry);
  }

  const orderCount = orders.length;
  const roundedRevenue = Number(totalRevenue.toFixed(2));

  const byBranch = Array.from(branchAgg.values())
    .map((b) => ({
      branchId: b.branchId,
      branchName: b.branchName,
      orderCount: b.orderCount,
      totalRevenue: Number(b.totalRevenue.toFixed(2)),
      itemQuantity: b.itemQuantity,
      avgOrderValue:
        b.orderCount > 0 ? Number((b.totalRevenue / b.orderCount).toFixed(2)) : 0,
      sharePercent:
        roundedRevenue > 0
          ? Number(((b.totalRevenue / roundedRevenue) * 100).toFixed(1))
          : 0,
    }))
    .sort((a, b) => b.totalRevenue - a.totalRevenue);

  const byProduct = Array.from(productAgg.values())
    .map((p) => ({
      productName: p.productName,
      categoryName: p.categoryName,
      quantity: p.quantity,
      revenue: Number(p.revenue.toFixed(2)),
      orderCount: p.orderIds.size,
    }))
    .sort((a, b) => b.revenue - a.revenue || b.quantity - a.quantity);

  const byDay = Array.from(dayAgg.values())
    .map((d) => ({
      date: d.date,
      orderCount: d.orderCount,
      revenue: Number(d.revenue.toFixed(2)),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return NextResponse.json({
    from: istanbulDayFmt.format(fromDate),
    to: istanbulDayFmt.format(toDate),
    branches,
    summary: {
      totalRevenue: roundedRevenue,
      orderCount,
      avgOrderValue:
        orderCount > 0 ? Number((roundedRevenue / orderCount).toFixed(2)) : 0,
      totalItemQuantity,
    },
    byBranch,
    byProduct,
    byDay,
  });
}
