// Extracted helper functions from +Page.tsx
import type { WeekdayOpen } from "../../../../api/types";

export type HourSlot = {
  id: string;
  value: string;
  label: string;
};

export type FloorTab = "plantas" | "salones";

type FloorLike = { id: number; floorNumber: number; name: string; isGround: boolean; active: boolean };

/** Build the optimistic floors array for a target floor count (0 = ground). */
export function buildFloorsWithCount(floors: FloorLike[], count: number): FloorLike[] {
  const sorted = [...floors].sort((a, b) => a.floorNumber - b.floorNumber);
  if (count <= sorted.length) return sorted.slice(0, count);
  const out = [...sorted];
  for (let n = sorted.length; n < count; n += 1) {
    out.push({
      id: -Date.now() - n,
      floorNumber: n,
      name: `Planta ${n}`,
      isGround: false,
      active: true,
    });
  }
  return out;
}

export type WeekdayCard = {
  key: keyof WeekdayOpen;
  label: string;
  shortLabel: string;
};

export function normalizeToHHMM(totalMinutes: number): string {
  const day = 24 * 60;
  const normalized = ((totalMinutes % day) + day) % day;
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function buildHalfHourSlots(startMinutes: number, endMinutes: number, prefix: string): HourSlot[] {
  const out: HourSlot[] = [];
  const target = endMinutes < startMinutes ? endMinutes + 24 * 60 : endMinutes;
  for (let cursor = startMinutes; cursor <= target; cursor += 30) {
    const value = normalizeToHHMM(cursor);
    out.push({
      id: `${prefix}-${value.replace(":", "")}`,
      value,
      label: value,
    });
  }
  return out;
}

export function serviceSortKey(hhmm: string): number {
  const [hRaw, mRaw] = hhmm.split(":");
  const h = Number(hRaw);
  const m = Number(mRaw);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 0;
  const minutes = h * 60 + m;
  return minutes < 8 * 60 ? minutes + 24 * 60 : minutes;
}

export function sortServiceHours(hours: string[]): string[] {
  return [...hours].sort((a, b) => {
    const ka = serviceSortKey(a);
    const kb = serviceSortKey(b);
    if (ka === kb) return a.localeCompare(b);
    return ka - kb;
  });
}

export function toggleHour(current: string[], hour: string): string[] {
  const set = new Set(current);
  if (set.has(hour)) set.delete(hour);
  else set.add(hour);
  return sortServiceHours([...set]);
}

export function clampDailyLimit(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(500, Math.trunc(v)));
}

export function defaultWeekdayOpen(): WeekdayOpen {
  return {
    monday: false,
    tuesday: false,
    wednesday: false,
    thursday: true,
    friday: true,
    saturday: true,
    sunday: true,
  };
}

export function parseWeekdayFlag(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true" || normalized === "1" || normalized === "open" || normalized === "abierto") return true;
    if (normalized === "false" || normalized === "0" || normalized === "closed" || normalized === "cerrado") return false;
  }
  return null;
}

export function normalizeWeekdayOpenMap(input: unknown): WeekdayOpen {
  const fallback = defaultWeekdayOpen();
  if (!input || typeof input !== "object") return fallback;

  const sourceRaw = input as Record<string, unknown>;
  const source: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(sourceRaw)) {
    source[key.toLowerCase()] = value;
  }

  const aliases: Record<keyof WeekdayOpen, string[]> = {
    monday: ["monday", "lunes", "1"],
    tuesday: ["tuesday", "martes", "2"],
    wednesday: ["wednesday", "miércoles", "miercoles", "3"],
    thursday: ["thursday", "jueves", "4"],
    friday: ["friday", "viernes", "5"],
    saturday: ["saturday", "sábado", "sabado", "6"],
    sunday: ["sunday", "domingo", "0", "7"],
  };

  const out = { ...fallback };

  (Object.keys(aliases) as (keyof WeekdayOpen)[]).forEach((weekday) => {
    for (const alias of aliases[weekday]) {
      if (!(alias in source)) continue;
      const parsed = parseWeekdayFlag(source[alias]);
      if (parsed !== null) {
        out[weekday] = parsed;
        break;
      }
    }
  });

  return out;
}

export const tableLimitValues = [...Array.from({ length: 100 }, (_, i) => String(i)), "999"];

export function normalizeTableLimit(value: string | null | undefined): string {
  if (value === "999") return "999";
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return "999";
  const clamped = Math.max(0, Math.min(99, Math.trunc(parsed)));
  return String(clamped);
}

export function stepTableLimit(current: string, direction: -1 | 1): string {
  const currentValue = normalizeTableLimit(current);
  const currentIndex = tableLimitValues.indexOf(currentValue);
  const safeIndex = currentIndex === -1 ? tableLimitValues.indexOf("999") : currentIndex;
  const nextIndex = Math.max(0, Math.min(tableLimitValues.length - 1, safeIndex + direction));
  return tableLimitValues[nextIndex] || currentValue;
}

export function formatTableLimit(value: string): string {
  const normalized = normalizeTableLimit(value);
  return normalized === "999" ? "Sin límite" : normalized;
}

export function readAPIMessage(result: unknown, fallback: string): string {
  if (!result || typeof result !== "object") return fallback;
  if (!("message" in result)) return fallback;
  const message = (result as { message?: unknown }).message;
  if (typeof message !== "string") return fallback;
  const trimmed = message.trim();
  return trimmed || fallback;
}
