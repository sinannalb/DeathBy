"use client";

import React from "react";
import type { PaperWidth } from "@prisma/client";
import type { OrderDTO } from "@/lib/types";
import {
  formatDateTimeTR,
  formatReceiptPrice,
} from "@/components/panel/panel-utils";

interface ThermalReceiptProps {
  order: OrderDTO;
  paperWidth: PaperWidth;
}

export function ThermalReceipt({ order, paperWidth }: ThermalReceiptProps) {
  const is58 = paperWidth === "MM58";
  const pageSize = is58 ? "58mm auto" : "80mm auto";
  const widthCss = is58 ? "58mm" : "80mm";

  return (
    <>
      <style>{`
        @media print {
          @page {
            size: ${pageSize};
            margin: 2mm;
          }
          html, body {
            background: #ffffff !important;
            color: #000000 !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .no-print {
            display: none !important;
          }
          .thermal-sheet {
            box-shadow: none !important;
            border: none !important;
            margin: 0 !important;
            width: ${widthCss} !important;
            max-width: ${widthCss} !important;
          }
        }
      `}</style>

      <article
        style={{ width: widthCss, maxWidth: widthCss }}
        className={`thermal-sheet mx-auto bg-white text-black font-mono leading-snug border border-neutral-300 shadow-lg ${
          is58 ? "p-2.5 text-[11px]" : "p-3.5 text-[12px]"
        }`}
      >
        {/* Header */}
        <header className="text-center">
          <div
            className={`font-black tracking-wider uppercase ${
              is58 ? "text-[14px]" : "text-[16px]"
            }`}
          >
            DEATH BY CHOCOLATE
          </div>
          <div className="mt-0.5 font-bold uppercase">{order.branchName}</div>
          <div className="text-[10px]">Tel: {order.branchPhone}</div>
        </header>

        <div className="my-2 border-t border-dashed border-black" />

        {/* Order Number & Timestamp */}
        <section className="text-center">
          <div
            className={`font-black tracking-tight ${
              is58 ? "text-[20px]" : "text-[24px]"
            }`}
          >
            #{order.orderNumber}
          </div>
          <div className="mt-0.5 text-[11px] font-semibold">
            {formatDateTimeTR(order.createdAt)}
          </div>
        </section>

        <div className="my-2 border-t border-dashed border-black" />

        {/* Customer & Delivery Address */}
        <section className="space-y-1">
          <div className="font-black uppercase tracking-wide text-[11px]">
            MÜŞTERİ &amp; TESLİMAT ADRESİ
          </div>
          <div className="font-bold">{order.customerName}</div>
          <div className="font-bold">Tel: {order.customerPhone}</div>
          <div className="font-semibold">
            {order.neighborhood} / {order.district} ({order.city})
          </div>
          <div className="font-bold leading-tight break-words">
            {order.fullAddress}
          </div>
          {order.directions && (
            <div className="pt-0.5 text-[11px] break-words">
              <span className="font-bold">Tarif:</span> {order.directions}
            </div>
          )}
          {order.note && (
            <div className="mt-1.5 border-2 border-black p-1.5 font-bold break-words">
              NOT: {order.note}
            </div>
          )}
        </section>

        <div className="my-2 border-t border-dashed border-black" />

        {/* Items */}
        <section className="space-y-1.5">
          <div className="font-black uppercase tracking-wide text-[11px]">
            ÜRÜNLER
          </div>
          {order.items.map((item) => (
            <div key={item.id} className="space-y-0.5">
              <div className="flex items-start justify-between gap-2 font-bold">
                <span className="break-words">
                  {item.quantity}x {item.productName}
                </span>
                <span className="shrink-0 tabular-nums">
                  {formatReceiptPrice(item.lineTotal)}
                </span>
              </div>
              {item.selectedOptions && item.selectedOptions.length > 0 && (
                <div className="pl-3 space-y-0.5">
                  {item.selectedOptions.map((opt, idx) => (
                    <div
                      key={`${opt.optionItemId}-${idx}`}
                      className="font-bold text-[11px] leading-tight"
                    >
                      + {opt.optionItemName}
                      {opt.priceDelta > 0
                        ? ` (+${formatReceiptPrice(opt.priceDelta)})`
                        : ""}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </section>

        <div className="my-2 border-t border-dashed border-black" />

        {/* Totals */}
        <section className="space-y-1">
          <div className="flex items-center justify-between">
            <span>Ara Toplam</span>
            <span className="tabular-nums">
              {formatReceiptPrice(order.subtotal)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span>Teslimat Ücreti</span>
            <span className="tabular-nums">
              {order.deliveryFee === 0
                ? "Ücretsiz"
                : formatReceiptPrice(order.deliveryFee)}
            </span>
          </div>
          <div className="my-1 border-t border-black" />
          <div
            className={`flex items-center justify-between font-black ${
              is58 ? "text-[14px]" : "text-[16px]"
            }`}
          >
            <span>GENEL TOPLAM</span>
            <span className="tabular-nums">
              {formatReceiptPrice(order.totalAmount)}
            </span>
          </div>
        </section>

        <div className="my-2 border-t border-dashed border-black" />

        {/* Payment & Footer */}
        <footer className="text-center space-y-1 pb-2">
          <div className="border border-black py-1 px-1.5 font-black uppercase tracking-wide">
            {order.paymentStatus === "PAID"
              ? "ÖDEME: PAYTR ONLINE ÖDENDİ"
              : `ÖDEME: ${order.paymentStatusLabel.toUpperCase()}`}
          </div>
          {order.paymentStatus === "PAID" && (
            <div className="text-[10px] font-bold">
              Kapıda tahsilat yapılmayacaktır.
            </div>
          )}
          <div className="pt-1 font-bold">Afiyet Olsun!</div>
        </footer>
      </article>
    </>
  );
}
