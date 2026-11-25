import type { BranchManualStatus } from "@prisma/client";
import { DAY_OF_WEEK_LABELS } from "@/lib/constants";
import type { BranchStatusDTO } from "@/lib/types";

export interface BranchForStatus {
  isActive: boolean;
  manualStatus: BranchManualStatus;
  isBusy: boolean;
  busyUntil: Date | null;
  busyMessage: string | null;
  estimatedMinMinutes: number;
  estimatedMaxMinutes: number;
  schedules: Array<{
    dayOfWeek: number;
    openTime: string;
    closeTime: string;
    isClosed: boolean;
  }>;
}

const ISTANBUL_TZ = "Europe/Istanbul";

const WEEKDAY_MAP: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

function getIstanbulTimeParts(date: Date): {
  dayOfWeek: number;
  minutesSinceMidnight: number;
} {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: ISTANBUL_TZ,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const parts = formatter.formatToParts(date);
  const weekday = parts.find((p) => p.type === "weekday")?.value ?? "Mon";
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");

  return {
    dayOfWeek: WEEKDAY_MAP[weekday] ?? 1,
    minutesSinceMidnight: hour * 60 + minute,
  };
}

function formatIstanbulClock(date: Date): string {
  return new Intl.DateTimeFormat("tr-TR", {
    timeZone: ISTANBUL_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

function parseTimeToMinutes(hhmm: string): number {
  const [hStr, mStr] = hhmm.split(":");
  const h = Number(hStr);
  const m = Number(mStr);
  if (Number.isNaN(h) || Number.isNaN(m)) return 0;
  return h * 60 + m;
}

function findNextOpenText(
  schedules: BranchForStatus["schedules"],
  todayIndex: number,
  currentMinutes: number,
): string | null {
  const byDay = new Map(schedules.map((s) => [s.dayOfWeek, s]));

  for (let offset = 0; offset <= 7; offset++) {
    const dayIndex = (todayIndex + offset) % 7;
    const sched = byDay.get(dayIndex);
    if (!sched || sched.isClosed) continue;

    const openMinutes = parseTimeToMinutes(sched.openTime);
    if (offset === 0 && currentMinutes < openMinutes) {
      return `Bugün ${sched.openTime} itibarıyla açılıyor`;
    }
    if (offset === 1) {
      return `Yarın ${sched.openTime} itibarıyla açılıyor`;
    }
    if (offset > 1) {
      return `${DAY_OF_WEEK_LABELS[dayIndex]} ${sched.openTime} itibarıyla açılıyor`;
    }
  }

  return null;
}

function makeBusyResult(
  branch: BranchForStatus,
  minMins: number,
  maxMins: number,
): BranchStatusDTO {
  return {
    effectiveStatus: "BUSY",
    canAcceptOrders: true,
    reason:
      branch.busyMessage?.trim() ||
      "Yoğunluk nedeniyle teslimat süremiz normale göre biraz daha uzun olabilir.",
    nextOpenText: branch.busyUntil
      ? `Yoğun saatlerin ${formatIstanbulClock(branch.busyUntil)} civarında sona ermesi beklenmektedir`
      : null,
    estimatedMinMinutes: minMins,
    estimatedMaxMinutes: maxMins,
  };
}

/**
 * Computes effective operational status of a branch in Europe/Istanbul timezone.
 * `isBusy` (or legacy `manualStatus === "BUSY"`) applies when the branch is open and unexpired.
 * `FORCE_CLOSED` or outside `AUTO` working hours always returns `CLOSED`.
 */
export function computeBranchStatus(
  branch: BranchForStatus,
  now: Date = new Date(),
): BranchStatusDTO {
  const minMins = branch.estimatedMinMinutes;
  const maxMins = branch.estimatedMaxMinutes;

  if (!branch.isActive) {
    return {
      effectiveStatus: "CLOSED",
      canAcceptOrders: false,
      reason: "Şube şu anda hizmet vermemektedir.",
      nextOpenText: null,
      estimatedMinMinutes: minMins,
      estimatedMaxMinutes: maxMins,
    };
  }

  const busyUntilValid =
    branch.busyUntil !== null && branch.busyUntil.getTime() > now.getTime();
  const hasUnexpiredOverride =
    branch.busyUntil === null || busyUntilValid;

  if (branch.manualStatus === "FORCE_CLOSED" && hasUnexpiredOverride) {
    const reopenLabel = branch.busyUntil
      ? `Saat ${formatIstanbulClock(branch.busyUntil)} itibarıyla tekrar hizmet vermesi beklenmektedir`
      : null;

    return {
      effectiveStatus: "CLOSED",
      canAcceptOrders: false,
      reason:
        branch.busyMessage?.trim() ||
        "Şube geçici olarak sipariş alamamaktadır.",
      nextOpenText: reopenLabel,
      estimatedMinMinutes: minMins,
      estimatedMaxMinutes: maxMins,
    };
  }

  const busyActive =
    (branch.isBusy || branch.manualStatus === "BUSY") && hasUnexpiredOverride;

  if (branch.manualStatus === "FORCE_OPEN") {
    if (busyActive) {
      return makeBusyResult(branch, minMins, maxMins);
    }
    return {
      effectiveStatus: "OPEN",
      canAcceptOrders: true,
      reason: "Şube şu anda açık (Sipariş alınıyor).",
      nextOpenText: null,
      estimatedMinMinutes: minMins,
      estimatedMaxMinutes: maxMins,
    };
  }

  if (branch.manualStatus === "BUSY" && hasUnexpiredOverride) {
    return makeBusyResult(branch, minMins, maxMins);
  }

  // Evaluate AUTO working hours in Europe/Istanbul
  const { dayOfWeek, minutesSinceMidnight } = getIstanbulTimeParts(now);
  const byDay = new Map(branch.schedules.map((s) => [s.dayOfWeek, s]));

  // Check if yesterday had an overnight schedule extending into today early morning
  const yesterdayIndex = (dayOfWeek + 6) % 7;
  const yesterdaySchedule = byDay.get(yesterdayIndex);
  if (yesterdaySchedule && !yesterdaySchedule.isClosed) {
    const yOpen = parseTimeToMinutes(yesterdaySchedule.openTime);
    const yClose = parseTimeToMinutes(yesterdaySchedule.closeTime);
    if (yClose <= yOpen && yClose > 0 && minutesSinceMidnight < yClose) {
      if (busyActive) {
        return makeBusyResult(branch, minMins, maxMins);
      }
      return {
        effectiveStatus: "OPEN",
        canAcceptOrders: true,
        reason: `Şube açık (${yesterdaySchedule.closeTime} kapanış).`,
        nextOpenText: null,
        estimatedMinMinutes: minMins,
        estimatedMaxMinutes: maxMins,
      };
    }
  }

  const todaySchedule = byDay.get(dayOfWeek);
  if (todaySchedule && !todaySchedule.isClosed) {
    const openMins = parseTimeToMinutes(todaySchedule.openTime);
    const closeMins = parseTimeToMinutes(todaySchedule.closeTime);

    let isOpenToday = false;
    if (closeMins <= openMins) {
      isOpenToday = minutesSinceMidnight >= openMins;
    } else if (todaySchedule.closeTime === "23:59") {
      isOpenToday =
        minutesSinceMidnight >= openMins && minutesSinceMidnight <= closeMins;
    } else {
      isOpenToday =
        minutesSinceMidnight >= openMins && minutesSinceMidnight < closeMins;
    }

    if (isOpenToday) {
      if (busyActive) {
        return makeBusyResult(branch, minMins, maxMins);
      }
      return {
        effectiveStatus: "OPEN",
        canAcceptOrders: true,
        reason: `Şube açık (${todaySchedule.openTime} - ${todaySchedule.closeTime}).`,
        nextOpenText: null,
        estimatedMinMinutes: minMins,
        estimatedMaxMinutes: maxMins,
      };
    }
  }

  const nextOpenText = findNextOpenText(
    branch.schedules,
    dayOfWeek,
    minutesSinceMidnight,
  );

  return {
    effectiveStatus: "CLOSED",
    canAcceptOrders: false,
    reason: "Şube şu anda çalışma saatleri dışındadır.",
    nextOpenText,
    estimatedMinMinutes: minMins,
    estimatedMaxMinutes: maxMins,
  };
}
