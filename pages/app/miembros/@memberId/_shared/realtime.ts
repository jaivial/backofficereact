import { useEffect, useMemo, useState } from "react";
import { useAtomValue } from "jotai";

import type { FichajeActiveEntry, MemberStats, MemberTimeBalance } from "../../../../../api/types";
import { fichajeRealtimeAtom } from "../../../../../state/atoms";

function dateRangeContains(dateISO: string, startISO: string, endISO: string): boolean {
  return dateISO >= startISO && dateISO <= endISO;
}

function parseISODateUTC(iso: string): Date | null {
  const m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const yyyy = Number(m[1]);
  const mm = Number(m[2]);
  const dd = Number(m[3]);
  if (!Number.isFinite(yyyy) || !Number.isFinite(mm) || !Number.isFinite(dd)) return null;
  return new Date(Date.UTC(yyyy, mm - 1, dd));
}

function formatISODateUTC(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function weekRangeFromRefISO(refISO: string): { startISO: string; endISO: string } {
  const ref = parseISODateUTC(refISO) ?? new Date();
  const weekday0Sun = ref.getUTCDay();
  const weekday1Mon = weekday0Sun === 0 ? 7 : weekday0Sun;
  const start = new Date(ref);
  start.setUTCDate(ref.getUTCDate() - (weekday1Mon - 1));
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);
  return { startISO: formatISODateUTC(start), endISO: formatISODateUTC(end) };
}

function elapsedHours(entry: FichajeActiveEntry | null, nowMs: number): number {
  if (!entry?.startAtIso) return 0;
  const startMs = Date.parse(entry.startAtIso);
  if (!Number.isFinite(startMs)) return 0;
  const deltaMs = nowMs - startMs;
  if (deltaMs <= 0) return 0;
  return deltaMs / 3600000;
}

export function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

export function maxHours(stats: MemberStats | null): number {
  if (!stats || !stats.points.length) return 1;
  const m = Math.max(...stats.points.map((p) => p.hours));
  return m > 0 ? m : 1;
}

export function formatElapsedHHMMSS(entry: FichajeActiveEntry | null, nowMs: number): string {
  if (!entry?.startAtIso) return "--:--:--";
  const startMs = Date.parse(entry.startAtIso);
  if (!Number.isFinite(startMs)) return "--:--:--";
  const totalSeconds = Math.max(0, Math.floor((nowMs - startMs) / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function useMemberLive(memberId: number | null | undefined) {
  const realtime = useAtomValue(fichajeRealtimeAtom);
  const [tick, setTick] = useState(() => Date.now());

  const liveEntry = useMemo(() => {
    if (!memberId || !Number.isFinite(memberId)) return null;
    return realtime.activeEntriesByMember[memberId] ?? null;
  }, [memberId, realtime.activeEntriesByMember]);

  useEffect(() => {
    if (!liveEntry) return;
    const timer = window.setInterval(() => setTick(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [liveEntry?.id, liveEntry?.startAtIso]);

  const liveHours = useMemo(() => round2(elapsedHours(liveEntry, tick)), [liveEntry?.id, liveEntry?.startAtIso, tick]);

  return { liveEntry, liveHours, tick };
}

export function applyLiveToStats(stats: MemberStats | null, liveEntry: FichajeActiveEntry | null, liveHours: number, dateRefISO: string): MemberStats | null {
  if (!stats || !liveEntry || liveHours <= 0) return stats;

  const addToPeriod = dateRangeContains(liveEntry.workDate, stats.startDate, stats.endDate) ? liveHours : 0;
  const weeklyRange = weekRangeFromRefISO(dateRefISO);
  const addToWeek = dateRangeContains(liveEntry.workDate, weeklyRange.startISO, weeklyRange.endISO) ? liveHours : 0;
  if (addToPeriod <= 0 && addToWeek <= 0) return stats;

  const workedHours = round2(stats.summary.workedHours + addToPeriod);
  const expectedHours = stats.summary.expectedHours;
  const progressPercent = expectedHours > 0 ? round2((workedHours / expectedHours) * 100) : 0;

  const weeklyWorkedHours = round2(stats.summary.weeklyWorkedHours + addToWeek);
  const weeklyContractHours = stats.summary.weeklyContractHours;
  const weeklyProgressPercent = weeklyContractHours > 0 ? round2((weeklyWorkedHours / weeklyContractHours) * 100) : 0;

  const points = stats.points.map((point) =>
    point.date === liveEntry.workDate ? { ...point, hours: round2(point.hours + addToPeriod) } : point,
  );

  return {
    ...stats,
    points,
    summary: {
      ...stats.summary,
      workedHours,
      progressPercent,
      weeklyWorkedHours,
      weeklyProgressPercent,
    },
  };
}

export function applyLiveToBalance(
  balance: MemberTimeBalance | null,
  liveEntry: FichajeActiveEntry | null,
  liveHours: number,
): MemberTimeBalance | null {
  if (!balance || !liveEntry || liveHours <= 0) return balance;
  if (!dateRangeContains(liveEntry.workDate, balance.quarter.startDate, balance.quarter.cutoffDate)) return balance;

  const workedHours = round2(balance.workedHours + liveHours);
  return {
    ...balance,
    workedHours,
    balanceHours: round2(balance.balanceHours + liveHours),
  };
}
