import type { BranchManualStatus, OrderStatus } from "@prisma/client";

export function formatTRY(amount: number): string {
  return `${new Intl.NumberFormat("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)} ₺`;
}

export function formatReceiptPrice(amount: number): string {
  return `${new Intl.NumberFormat("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)} TL`;
}

export function formatDateTimeTR(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export function formatTimeTR(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export function formatElapsedTR(iso: string, nowMs: number = Date.now()): string {
  const createdMs = new Date(iso).getTime();
  if (Number.isNaN(createdMs)) return "";
  const diffMin = Math.max(0, Math.floor((nowMs - createdMs) / 60000));
  if (diffMin < 1) return "Az önce";
  if (diffMin < 60) return `${diffMin} dk önce`;
  const hours = Math.floor(diffMin / 60);
  const mins = diffMin % 60;
  if (hours < 24) {
    return mins > 0 ? `${hours} sa ${mins} dk önce` : `${hours} sa önce`;
  }
  const days = Math.floor(hours / 24);
  return `${days} gün önce`;
}

export async function apiFetch<T>(
  url: string,
  options?: RequestInit,
): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: {
      ...(options?.body ? { "Content-Type": "application/json" } : {}),
      ...(options?.headers ?? {}),
    },
  });

  const data = (await res.json().catch(() => null)) as {
    error?: string;
  } | null;

  if (!res.ok) {
    throw new Error(data?.error || `İstek başarısız oldu (${res.status}).`);
  }

  return data as T;
}

export const ORDER_STATUS_BADGE_CLASS: Record<OrderStatus, string> = {
  RECEIVED:
    "bg-amber-100 text-amber-900 border-amber-300 ring-1 ring-amber-400/40",
  PREPARING: "bg-sky-100 text-sky-900 border-sky-300",
  WAITING_COURIER: "bg-violet-100 text-violet-900 border-violet-300",
  ON_THE_WAY: "bg-indigo-100 text-indigo-900 border-indigo-300",
  COMPLETED: "bg-emerald-100 text-emerald-900 border-emerald-300",
  CANCELLED: "bg-rose-100 text-rose-900 border-rose-300",
};

export const MANUAL_STATUS_SHORT_LABEL: Record<BranchManualStatus, string> = {
  AUTO: "Otomatik Saatler",
  FORCE_OPEN: "Manuel Açık",
  BUSY: "Yoğun Saatler",
  FORCE_CLOSED: "Geçici Kapalı",
};

let sharedAudioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AudioCtx) return null;
  if (!sharedAudioCtx) {
    sharedAudioCtx = new AudioCtx();
  }
  return sharedAudioCtx;
}

/**
 * Plays a pleasant two-tone POS notification chime using the Web Audio API.
 */
export async function playNewOrderChime(): Promise<boolean> {
  try {
    const ctx = getAudioContext();
    if (!ctx) return false;
    if (ctx.state === "suspended") {
      await ctx.resume();
    }

    const now = ctx.currentTime;
    const notes = [
      { freq: 587.33, start: 0, duration: 0.22 }, // D5
      { freq: 880.0, start: 0.14, duration: 0.36 }, // A5
    ];

    for (const note of notes) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(note.freq, now + note.start);

      gain.gain.setValueAtTime(0.0001, now + note.start);
      gain.gain.exponentialRampToValueAtTime(0.24, now + note.start + 0.02);
      gain.gain.exponentialRampToValueAtTime(
        0.0001,
        now + note.start + note.duration,
      );

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + note.start);
      osc.stop(now + note.start + note.duration + 0.02);
    }

    return true;
  } catch {
    return false;
  }
}
