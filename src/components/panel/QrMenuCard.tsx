"use client";

import React, { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Check, Copy, Download, ExternalLink, QrCode } from "lucide-react";

interface QrMenuCardProps {
  branchName: string;
  branchSlug: string;
}

export function QrMenuCard({ branchName, branchSlug }: QrMenuCardProps) {
  const [scope, setScope] = useState<"branch" | "general">("branch");
  const [origin, setOrigin] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const menuPath = scope === "branch" ? `/menu?sube=${branchSlug}` : "/menu";
  const fullUrl = origin ? `${origin}${menuPath}` : menuPath;

  useEffect(() => {
    if (!origin) return;
    let cancelled = false;
    QRCode.toDataURL(fullUrl, {
      width: 512,
      margin: 2,
      color: {
        dark: "#120D0C",
        light: "#FFFFFF",
      },
      errorCorrectionLevel: "H",
    })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl("");
      });

    return () => {
      cancelled = true;
    };
  }, [fullUrl, origin]);

  async function handleDownloadPng() {
    if (!origin) return;
    setDownloading(true);
    try {
      const qrCanvas = document.createElement("canvas");
      await QRCode.toCanvas(qrCanvas, fullUrl, {
        width: 820,
        margin: 2,
        color: { dark: "#120D0C", light: "#FFFFFF" },
        errorCorrectionLevel: "H",
      });

      const posterW = 1024;
      const posterH = 1220;
      const canvas = document.createElement("canvas");
      canvas.width = posterW;
      canvas.height = posterH;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Background
      ctx.fillStyle = "#FAF6F1";
      ctx.fillRect(0, 0, posterW, posterH);

      // Top dark chocolate header bar
      ctx.fillStyle = "#120D0C";
      ctx.fillRect(0, 0, posterW, 180);

      // Brand title
      ctx.fillStyle = "#FAF6F1";
      ctx.font = "bold 46px Georgia, serif";
      ctx.textAlign = "center";
      ctx.fillText("Death By Chocolate", posterW / 2, 92);

      // Subtitle
      ctx.fillStyle = "#D4A048";
      ctx.font = "bold 24px -apple-system, BlinkMacSystemFont, sans-serif";
      const subText =
        scope === "branch"
          ? `${branchName.toUpperCase()} • DİJİTAL MENÜ`
          : "DİJİTAL QR MENÜ";
      ctx.fillText(subText, posterW / 2, 140);

      // White card behind QR
      const cardX = 82;
      const cardY = 230;
      const cardSize = 860;
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(cardX, cardY, cardSize, cardSize);
      ctx.strokeStyle = "#E6D9CB";
      ctx.lineWidth = 4;
      ctx.strokeRect(cardX, cardY, cardSize, cardSize);

      // QR Code centered
      ctx.drawImage(qrCanvas, (posterW - 820) / 2, cardY + 20, 820, 820);

      // Footer instruction
      ctx.fillStyle = "#24140E";
      ctx.font = "bold 28px -apple-system, BlinkMacSystemFont, sans-serif";
      ctx.fillText("Menüyü görmek için kameranızı okutun", posterW / 2, 1148);

      ctx.fillStyle = "#7A6256";
      ctx.font = "20px -apple-system, BlinkMacSystemFont, sans-serif";
      ctx.fillText(fullUrl, posterW / 2, 1188);

      const link = document.createElement("a");
      link.href = canvas.toDataURL("image/png");
      link.download =
        scope === "branch"
          ? `death-by-chocolate-qr-${branchSlug}.png`
          : "death-by-chocolate-qr-menu.png";
      link.click();
    } finally {
      setDownloading(false);
    }
  }

  async function handleDownloadSvg() {
    if (!origin) return;
    const svgString = await QRCode.toString(fullUrl, {
      type: "svg",
      width: 512,
      margin: 2,
      color: { dark: "#120D0C", light: "#FFFFFF" },
      errorCorrectionLevel: "H",
    });
    const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download =
      scope === "branch"
        ? `death-by-chocolate-qr-${branchSlug}.svg`
        : "death-by-chocolate-qr-menu.svg";
    link.click();
    URL.revokeObjectURL(url);
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  }

  return (
    <section className="rounded-2xl border border-[#E5D7C8] bg-white p-5 shadow-sm space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#EFE5DA] pb-3">
        <div className="flex items-center gap-2">
          <QrCode className="h-5 w-5 text-[#B47D3B]" />
          <div>
            <h2 className="text-base font-bold text-[#24140E]">
              Dijital QR Menü Kodu
            </h2>
            <p className="text-xs text-[#6E5549]">
              Masalara basmak için yüksek çözünürlüklü PNG veya SVG QR kodunu
              indirebilirsiniz.
            </p>
          </div>
        </div>

        <div className="inline-flex rounded-xl bg-[#F5EDE3] p-1">
          <button
            type="button"
            onClick={() => setScope("branch")}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
              scope === "branch"
                ? "bg-[#120D0C] text-[#FAF6F1]"
                : "text-[#5C4338] hover:text-[#120D0C]"
            }`}
          >
            {branchName}
          </button>
          <button
            type="button"
            onClick={() => setScope("general")}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
              scope === "general"
                ? "bg-[#120D0C] text-[#FAF6F1]"
                : "text-[#5C4338] hover:text-[#120D0C]"
            }`}
          >
            Genel Menü
          </button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
        <div className="w-44 h-44 shrink-0 rounded-2xl border border-[#E5D7C8] bg-white p-2.5 flex items-center justify-center shadow-xs">
          {qrDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={qrDataUrl}
              alt={`${branchName} QR Menü`}
              className="w-full h-full object-contain"
            />
          ) : (
            <QrCode className="w-12 h-12 text-[#CBBBAE]" />
          )}
        </div>

        <div className="flex-1 w-full space-y-3">
          <div>
            <span className="block text-[11px] font-bold uppercase tracking-wider text-[#7A6256] mb-1">
              QR Menü Bağlantısı
            </span>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={fullUrl}
                className="flex-1 rounded-xl border border-[#DAC8B8] bg-[#FAF6F0] px-3 py-2 text-xs font-mono text-[#24140E]"
              />
              <button
                type="button"
                onClick={() => void handleCopy()}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#DAC8B8] bg-white hover:bg-[#FAF5EE] px-3 py-2 text-xs font-bold text-[#24140E] cursor-pointer"
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-700" />
                    <span>Kopyalandı</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    <span>Kopyala</span>
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={downloading || !qrDataUrl}
              onClick={() => void handleDownloadPng()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#2C1810] hover:bg-[#412418] disabled:opacity-50 px-4 py-2 text-xs font-bold text-[#FAF3EA] cursor-pointer"
            >
              <Download className="h-3.5 w-3.5 text-[#D4A048]" />
              <span>{downloading ? "Hazırlanıyor..." : "PNG İndir (Baskı)"}</span>
            </button>

            <button
              type="button"
              disabled={!qrDataUrl}
              onClick={() => void handleDownloadSvg()}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#DAC8B8] bg-white hover:bg-[#FAF5EE] disabled:opacity-50 px-3.5 py-2 text-xs font-bold text-[#24140E] cursor-pointer"
            >
              <Download className="h-3.5 w-3.5 text-[#B47D3B]" />
              <span>SVG İndir</span>
            </button>

            <a
              href={menuPath}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#DAC8B8] bg-[#FAF6F0] hover:bg-[#F2E8DC] px-3.5 py-2 text-xs font-bold text-[#4A3429]"
            >
              <ExternalLink className="h-3.5 w-3.5 text-[#B47D3B]" />
              <span>QR Menüyü Önizle</span>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
