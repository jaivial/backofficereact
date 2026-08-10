/**
 * Pure helpers for the by-hour client split editor.
 *
 * `%` is the source of truth (decision #2): people counts are always derived as
 * `round(pct/100*limit)`. These functions mirror the Go rebalance logic
 * (internal/api/hour_split.go) so optimistic client state matches the persisted
 * server result.
 */

export type Percentages = Record<string, number>;

const round2 = (v: number): number => Math.round(v * 100) / 100;

export function clampPercentage(v: number): number {
  if (!Number.isFinite(v)) return 0;
  if (v < 0) return 0;
  if (v > 100) return 100;
  return v;
}

export function sumPercentages(percentages: Percentages): number {
  let total = 0;
  for (const v of Object.values(percentages)) total += v;
  return round2(total);
}

export function percentagesToPeople(percentages: Percentages, dailyLimit: number): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [hour, pct] of Object.entries(percentages)) {
    out[hour] = Math.round((pct / 100) * dailyLimit);
  }
  return out;
}

export function peopleToPercentage(people: number, dailyLimit: number): number {
  if (dailyLimit <= 0) return 0;
  return round2((people / dailyLimit) * 100);
}

/** Equal split across hours, with rounding drift absorbed by the first sorted hour. */
export function equalSplit(hours: string[]): Percentages {
  const out: Percentages = {};
  if (hours.length === 0) return out;
  const each = round2(100 / hours.length);
  for (const h of hours) out[h] = each;
  const sorted = [...hours].sort();
  const drift = round2(100 - sumPercentages(out));
  if (drift !== 0 && sorted.length > 0) {
    out[sorted[0]] = round2(out[sorted[0]] + drift);
  }
  return out;
}

/** Drop entries for inactive hours; keep stored values for active ones. */
export function normalizePercentages(stored: Percentages | undefined, activeHours: string[]): Percentages {
  const out: Percentages = {};
  for (const h of activeHours) {
    out[h] = stored && typeof stored[h] === "number" ? round2(stored[h]) : 0;
  }
  return out;
}

/**
 * Rebalance so `changedHour` is set to `newPercentage` and every other hour is
 * rescaled to keep the total at exactly 100. Largest fractional remainder absorbs
 * sub-cent drift (deterministic).
 */
export function rebalanceByPercentage(
  percentages: Percentages,
  changedHour: string,
  newPercentage: number,
): Percentages {
  const out: Percentages = { ...percentages };
  if (!(changedHour in out)) return out;

  const next = clampPercentage(newPercentage);
  out[changedHour] = next;

  const remaining = Math.max(0, 100 - next);

  const others = Object.keys(out).filter((k) => k !== changedHour);
  if (others.length === 0) {
    out[changedHour] = 100;
    return out;
  }

  let othersSum = 0;
  for (const k of others) othersSum += out[k];

  if (othersSum <= 0) {
    const each = round2(remaining / others.length);
    for (const k of others) out[k] = each;
    const sorted = [...others].sort();
    let othersTotal = 0;
    for (const k of sorted) othersTotal += out[k];
    const drift = round2(remaining - round2(othersTotal));
    if (drift !== 0 && sorted.length > 0) {
      out[sorted[0]] = round2(out[sorted[0]] + drift);
    }
    return out;
  }

  const scaled: Record<string, number> = {};
  for (const k of others) scaled[k] = remaining * (out[k] / othersSum);

  // Floor each, then distribute the 0.01 drift to the largest fractional remainders.
  let roundedSum = 0;
  for (const k of others) {
    const floor = Math.floor(scaled[k] * 100) / 100;
    out[k] = floor;
    roundedSum += floor;
  }
  const stepsNeeded = Math.round((round2(remaining) - round2(roundedSum)) * 100);
  if (stepsNeeded !== 0) {
    const rems = others
      .map((k) => ({ k, frac: scaled[k] - out[k] }))
      .sort((a, b) => (a.frac === b.frac ? (a.k < b.k ? -1 : 1) : b.frac - a.frac));
    const step = stepsNeeded > 0 ? 0.01 : -0.01;
    let count = Math.min(Math.abs(stepsNeeded), rems.length);
    let i = 0;
    while (count > 0) {
      const idx = stepsNeeded > 0 ? i : rems.length - 1 - i;
      out[rems[idx].k] = round2(out[rems[idx].k] + step);
      count--;
      i++;
    }
  }
  return out;
}

/** People-mode edit: convert the requested people count to a percentage, then rebalance. */
export function rebalanceByPeople(
  percentages: Percentages,
  changedHour: string,
  people: number,
  dailyLimit: number,
): Percentages {
  const pct = clampPercentage(peopleToPercentage(people, dailyLimit));
  return rebalanceByPercentage(percentages, changedHour, pct);
}
