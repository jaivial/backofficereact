import type { CalendarDay, FichajeActiveEntry, HorarioMonthPoint, Member } from "../../../../api/types";

export function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export { fullName } from "../../../../lib/member";

export function splitHHMM(value: string): { h: string; m: string } {
  const raw = String(value || "").trim();
  const [h, m] = raw.split(":");
  const hh = /^\d{2}$/.test(h || "") ? h : "09";
  const mm = /^\d{2}$/.test(m || "") ? m : "00";
  return { h: hh, m: mm };
}

export function toMinutes(hour: string, minute: string): number {
  const h = Number(hour);
  const m = Number(minute);
  const safeH = Number.isFinite(h) ? Math.max(0, Math.min(23, Math.floor(h))) : 0;
  const safeM = Number.isFinite(m) ? Math.max(0, Math.min(59, Math.floor(m))) : 0;
  return safeH * 60 + safeM;
}

export function fromMinutes(totalMinutes: number): { h: string; m: string } {
  const bounded = Math.max(0, Math.min(23 * 60 + 59, Math.floor(totalMinutes)));
  const h = Math.floor(bounded / 60);
  const m = bounded % 60;
  return { h: pad2(h), m: pad2(m) };
}

export function diffLabel(start: string, end: string): string {
  const [sh, sm] = start.split(":").map((v) => Number(v));
  const [eh, em] = end.split(":").map((v) => Number(v));
  if (![sh, sm, eh, em].every((v) => Number.isFinite(v))) return "--";
  const minutes = (eh * 60 + em) - (sh * 60 + sm);
  if (minutes <= 0) return "--";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

export function formatElapsed(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function elapsedForEntry(entry: FichajeActiveEntry, nowMs: number): string {
  const startMs = Date.parse(entry.startAtIso);
  if (!Number.isFinite(startMs)) return "--:--:--";
  return formatElapsed((nowMs - startMs) / 1000);
}

export function monthCalendarData(year: number, month: number, monthDays: HorarioMonthPoint[], membersCount: number): CalendarDay[] {
  const total = Math.max(1, membersCount);
  const byDate = new Map(monthDays.map((d) => [d.date, d.assignedCount]));
  const daysInMonth = new Date(year, month, 0).getDate();
  const out: CalendarDay[] = [];
  for (let day = 1; day <= daysInMonth; day++) {
    const dateISO = `${year}-${pad2(month)}-${pad2(day)}`;
    const assigned = byDate.get(dateISO) ?? 0;
    out.push({
      date: dateISO,
      booking_count: assigned,
      total_people: assigned,
      limit: total,
      is_open: true,
    });
  }
  return out;
}

export function todayISO(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function addDays(date: string, days: number): string {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}
