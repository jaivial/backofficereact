import type { FichajeSchedule } from "../../../../../api/types";

export { fullName } from "../../../../../lib/member";

export function formatElapsed(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function elapsedLabel(startAtIso: string, nowMs: number): string {
  const startMs = Date.parse(startAtIso);
  if (!Number.isFinite(startMs)) return "--:--:--";
  return formatElapsed((nowMs - startMs) / 1000);
}

export function scheduleLabel(schedule: FichajeSchedule | undefined): string {
  if (!schedule) return "Sin horario";
  return `${schedule.startTime} - ${schedule.endTime}`;
}

export function todayISO(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
