import type { AffluenceBucket, AffluenceSeasonalYear } from "../../../../../api/types";

export const MONTH_LABELS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
] as const;

export const WEEKDAY_LABELS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"] as const;

export type PeriodKey = "7d" | "4w" | "3m" | "6m" | "1y" | "2y" | "3y" | "4y" | "5y" | "10y";

export type PeriodPreset = {
  id: PeriodKey;
  label: string;
  days: number;
  bucket: AffluenceBucket;
};

/** Presets drive both the range (days back from today) and the series bucket. */
export const PERIOD_PRESETS: PeriodPreset[] = [
  { id: "7d", label: "7 días", days: 7, bucket: "day" },
  { id: "4w", label: "4 semanas", days: 28, bucket: "day" },
  { id: "3m", label: "3 meses", days: 91, bucket: "week" },
  { id: "6m", label: "6 meses", days: 182, bucket: "week" },
  { id: "1y", label: "1 año", days: 365, bucket: "month" },
  { id: "2y", label: "2 años", days: 730, bucket: "month" },
  { id: "3y", label: "3 años", days: 1096, bucket: "month" },
  { id: "4y", label: "4 años", days: 1461, bucket: "month" },
  { id: "5y", label: "5 años", days: 1827, bucket: "month" },
  { id: "10y", label: "10 años", days: 3653, bucket: "month" },
];

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function toISODate(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function todayISO(now = new Date()): string {
  return toISODate(now);
}

/** Range of a preset: today minus (days - 1), so "7 días" spans 7 calendar days. */
export function periodRange(preset: PeriodPreset, now = new Date()): { from: string; to: string } {
  const to = new Date(now);
  const from = new Date(now);
  from.setDate(from.getDate() - (preset.days - 1));
  return { from: toISODate(from), to: toISODate(to) };
}

/** Bucket label for the axis: days keep day/month, weeks and months are readable spans. */
export function bucketLabel(key: string, bucket: AffluenceBucket): string {
  if (bucket === "day") {
    const [, mm, dd] = key.split("-");
    return `${dd}/${mm}`;
  }
  if (bucket === "week") return `${key.slice(8, 10)}/${key.slice(5, 7)}`;
  if (bucket === "month") return MONTH_LABELS[Number(key.slice(5, 7)) - 1].slice(0, 3) + " " + key.slice(2, 4);
  return key.slice(0, 4);
}

export function monthName(month: number): string {
  return MONTH_LABELS[month - 1] ?? String(month);
}

/** Total per year over the requested months, used by the seasonality boxes. */
export function seasonYearTotals(year: AffluenceSeasonalYear): { covers: number; bookings: number } {
  return year.months.reduce(
    (acc, month) => ({ covers: acc.covers + month.covers, bookings: acc.bookings + month.bookings }),
    { covers: 0, bookings: 0 },
  );
}

/** Default seasonality window: the two months before the current one plus the current one. */
export function defaultSeasonMonths(now = new Date()): number[] {
  const current = now.getMonth() + 1;
  return [((current + 9) % 12) + 1, ((current + 10) % 12) + 1, current];
}

// "always": es-ES skips the thousands separator on 4-digit numbers by default (4766 -> 4.766).
const NUMBER_FORMATTER = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 2, useGrouping: "always" } as unknown as Intl.NumberFormatOptions);

export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "N/D";
  return NUMBER_FORMATTER.format(value);
}

export function formatPercent(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "N/D";
  return `${value > 0 ? "+" : ""}${value.toFixed(digits).replace(".", ",")} %`;
}

export function formatISODate(value: string): string {
  if (!ISO_DATE.test(value)) return value;
  const [yyyy, mm, dd] = value.split("-");
  return `${dd}/${mm}/${yyyy}`;
}

export type DeltaTone = "up" | "down" | "flat";

export function deltaTone(delta: number | null | undefined): DeltaTone {
  if (delta === null || delta === undefined || !Number.isFinite(delta) || Math.abs(delta) < 0.05) return "flat";
  return delta > 0 ? "up" : "down";
}

export const DELTA_COLORS: Record<DeltaTone, string> = {
  up: "var(--bo-on-surface-success, #16a34a)",
  down: "var(--bo-on-surface-danger, #dc2626)",
  flat: "var(--bo-muted)",
};

export const DELTA_HEX: Record<DeltaTone, string> = {
  up: "#16a34a",
  down: "#dc2626",
  flat: "#6b7280",
};

export const YEAR_PALETTE = ["#7c5cff", "#22b8cf", "#f59e0b", "#ec4899", "#10b981", "#60a5fa", "#ef4444", "#84cc16"];

export function yearColor(index: number): string {
  return YEAR_PALETTE[index % YEAR_PALETTE.length];
}

export function hasAffluenceData(totals: { bookings: number; covers: number } | null | undefined): boolean {
  return Boolean(totals && (totals.bookings > 0 || totals.covers > 0));
}

export const BUCKET_LABELS: Record<AffluenceBucket, string> = { day: "día", week: "semana", month: "mes", year: "año" };

/** Percent change vs a previous value; null when there is nothing to compare with. */
export function percentDelta(current: number | null | undefined, previous: number | null | undefined): number | null {
  if (!current && current !== 0) return null;
  if (!previous) return null;
  return ((current - previous) / previous) * 100;
}
