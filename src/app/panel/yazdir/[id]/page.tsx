"use client";

import React, {
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import type { PaperWidth } from "@prisma/client";
import { ArrowLeft, CheckCircle2, Printer } from "lucide-react";
import { ThermalReceipt } from "@/components/panel/ThermalReceipt";
import { apiFetch, formatTimeTR } from "@/components/panel/panel-utils";
import type { OrderDTO } from "@/lib/types";

function ThermalReceiptPrintContent() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const orderId = params?.id;
  const autoprint = searchParams.get("autoprint") === "1";
  const markPrinted = searchParams.get("markPrinted") === "1";

  const [order, setOrder] = useState<OrderDTO | null>(null);
  const [paperWidth, setPaperWidth] = useState<PaperWidth>("MM80");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [printing, setPrinting] = useState(false);

  const autoPrintedRef = useRef(false);

  const markOrderPrinted = useCallback(async (id: string) => {
    try {
      const res = await apiFetch<{ order: OrderDTO; paperWidth: PaperWidth }>(
        `/api/panel/orders/${id}/print`,
        { method: "POST" },
      );
      setOrder(res.order);
      return res.order;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    if (!orderId) return;
    let active = true;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await apiFetch<{ order: OrderDTO }>(
          `/api/orders/${orderId}`,
        );
        if (!active) return;

        let currentOrder = data.order;
        setPaperWidth(currentOrder.paperWidth);

        if (markPrinted) {
          const updated = await markOrderPrinted(orderId);
          if (updated && active) {
            currentOrder = updated;
          }
        }

        if (active) {
          setOrder(currentOrder);
        }
      } catch (err) {
        if (active) {
          setError(
            err instanceof Error ? err.message : "Sipariş fişi yüklenemedi.",
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [orderId, markPrinted, markOrderPrinted]);

  useEffect(() => {
    if (!loading && order && autoprint && !autoPrintedRef.current) {
      autoPrintedRef.current = true;
      const timer = window.setTimeout(() => {
        window.print();
      }, 250);
      return () => window.clearTimeout(timer);
    }
  }, [loading, order, autoprint]);

  const handleManualPrint = async () => {
    if (!order) return;
    setPrinting(true);
    try {
      if (order.status === "RECEIVED" || !order.printedAt) {
        await markOrderPrinted(order.id);
      }
    } finally {
      setPrinting(false);
      window.print();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-100 flex items-center justify-center p-6">
        <div className="text-center space-y-2">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-neutral-300 border-t-neutral-900" />
          <p className="text-sm font-medium text-neutral-600">
            Termal fiş hazırlanıyor...
          </p>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-neutral-100 flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-2xl border border-neutral-200 bg-white p-6 text-center shadow-sm">
          <h1 className="text-lg font-bold text-neutral-900">
            Fiş Görüntülenemedi
          </h1>
          <p className="mt-2 text-sm text-rose-700">
            {error || "Sipariş bulunamadı."}
          </p>
          <div className="mt-5 flex items-center justify-center gap-3">
            <Link
              href="/panel"
              className="rounded-xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800"
            >
              Panele Dön
            </Link>
            <Link
              href="/panel/giris"
              className="rounded-xl border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
            >
              Giriş Sayfası
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-200 py-6 px-4 print:bg-white print:p-0">
      {/* Toolbar (Hidden in @media print) */}
      <div className="no-print mx-auto mb-6 flex max-w-2xl flex-wrap items-center justify-between gap-3 rounded-2xl border border-neutral-300 bg-white p-3.5 shadow-sm">
        <div className="flex items-center gap-3">
          <Link
            href="/panel"
            className="inline-flex items-center gap-1.5 rounded-xl border border-neutral-300 px-3 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-100"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Siparişlere Dön
          </Link>
          <div className="text-xs">
            <div className="font-bold text-neutral-900">
              #{order.orderNumber} • {order.branchName}
            </div>
            <div className="flex items-center gap-1 text-neutral-500">
              {order.printedAt ? (
                <>
                  <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                  <span>Yazdırıldı ({formatTimeTR(order.printedAt)})</span>
                </>
              ) : (
                <span>Henüz yazdırılmadı</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Paper Width Toggle Preview */}
          <div
            className="inline-flex rounded-xl border border-neutral-300 bg-neutral-100 p-0.5 text-xs font-semibold"
            role="group"
            aria-label="Kağıt Genişliği"
          >
            <button
              type="button"
              onClick={() => setPaperWidth("MM58")}
              className={`rounded-lg px-2.5 py-1.5 transition ${
                paperWidth === "MM58"
                  ? "bg-neutral-900 text-white"
                  : "text-neutral-600 hover:text-neutral-900"
              }`}
            >
              58mm
            </button>
            <button
              type="button"
              onClick={() => setPaperWidth("MM80")}
              className={`rounded-lg px-2.5 py-1.5 transition ${
                paperWidth === "MM80"
                  ? "bg-neutral-900 text-white"
                  : "text-neutral-600 hover:text-neutral-900"
              }`}
            >
              80mm
            </button>
          </div>

          <button
            type="button"
            onClick={() => void handleManualPrint()}
            disabled={printing}
            className="inline-flex items-center gap-1.5 rounded-xl bg-neutral-900 px-4 py-2 text-xs font-bold text-white hover:bg-neutral-800 disabled:opacity-50"
          >
            <Printer className="h-4 w-4" />
            {printing ? "Hazırlanıyor..." : "Yazdır"}
          </button>
        </div>
      </div>

      {/* Thermal Receipt Sheet */}
      <ThermalReceipt order={order} paperWidth={paperWidth} />
    </div>
  );
}

export default function ThermalReceiptPrintPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-neutral-100 flex items-center justify-center p-6">
          <p className="text-sm font-medium text-neutral-600">
            Termal fiş hazırlanıyor...
          </p>
        </div>
      }
    >
      <ThermalReceiptPrintContent />
    </Suspense>
  );
}
