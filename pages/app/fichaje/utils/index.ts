import type { FichajeActiveEntry, Member } from "../../../../api/types";

/**
 * Formats total seconds into HH:MM:SS string.
 */
export function formatElapsed(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/**
 * Returns elapsed time string for a given entry relative to now.
 */
export function elapsedForEntry(entry: FichajeActiveEntry, nowMs: number): string {
  const startMs = Date.parse(entry.startAtIso);
  if (!Number.isFinite(startMs)) return "00:00:00";
  return formatElapsed((nowMs - startMs) / 1000);
}

/**
 * Groups active entries by memberId into a map.
 */
export function toActiveEntriesByMember(
  entries: FichajeActiveEntry[] | null | undefined,
): Record<number, FichajeActiveEntry> {
  const out: Record<number, FichajeActiveEntry> = {};
  for (const entry of entries || []) {
    if (!entry || !Number.isFinite(entry.memberId) || entry.memberId <= 0) continue;
    out[entry.memberId] = entry;
  }
  return out;
}

/**
 * Returns the full display name for a member.
 */
export { fullName } from "../../../../lib/member";

/**
 * Parses an HH:MM string into total minutes since midnight.
 * Returns null if the string is malformed or out of range.
 */
export function parseHHMM(value: string): number | null {
  const [h, m] = value.split(":").map((v) => Number(v));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}

/**
 * Shifts an HH:MM time by deltaMinutes.
 * Returns null if the result is out of range.
 */
export function shiftHHMM(value: string, deltaMinutes: number): string | null {
  const current = parseHHMM(value);
  if (current === null) return null;
  const next = current + deltaMinutes;
  if (next < 0 || next > 23 * 60 + 59) return null;
  const h = Math.floor(next / 60);
  const m = next % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * Returns today's date in YYYY-MM-DD format.
 */
export function todayISO(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
