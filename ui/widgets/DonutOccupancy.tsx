import React, { useMemo } from "react";

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function toneForPct(pct: number): "base" | "y50" | "o75" | "o85" | "r100" {
  if (pct >= 100) return "r100";
  if (pct >= 85) return "o85";
  if (pct >= 75) return "o75";
  if (pct >= 50) return "y50";
  return "base";
}

export function DonutOccupancy({
  totalPeople,
  limit,
  totalBookings,
  pending,
  confirmed,
}: {
  totalPeople: number;
  limit: number;
  totalBookings?: number;
  pending?: number;
  confirmed?: number;
}) {
  const safeLimit = Number.isFinite(limit) && limit > 0 ? limit : 1;
  const pctRaw = (Number(totalPeople) / safeLimit) * 100;
  const pctArc = clamp(pctRaw, 0, 100);
  const pctLabel = Number.isFinite(pctRaw) ? Math.round(pctRaw) : 0;
  const tone = toneForPct(pctRaw);

  const { dashArray, dashOffset } = useMemo(() => {
    const r = 44;
    const c = 2 * Math.PI * r;
    const dash = (pctArc / 100) * c;
    return { dashArray: `${dash} ${c - dash}`, dashOffset: 0 };
  }, [pctArc]);

  const arcColor = {
    base: "#b9a8ff",
    y50: "#b9a8ff",
    o75: "#93efe7",
    o85: "#d97706",
    r100: "#dc2626",
  }[tone];

  return (
    <section className="flex flex-col items-center p-4 rounded-lg border border-white/[0.06] bg-white/[0.02]" aria-label="Ocupación">
      <div className="relative" aria-hidden="true">
        <svg viewBox="0 0 120 120" width="120" height="120">
          <circle cx="60" cy="60" r="44" fill="none" strokeWidth="10" className="stroke-white/[0.06]" />
          <circle
            cx="60"
            cy="60"
            r="44"
            fill="none"
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={dashArray}
            strokeDashoffset={dashOffset}
            transform="rotate(-90 60 60)"
            className="transition-all duration-500"
            style={{ stroke: arcColor }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-2xl font-bold text-foreground">{pctLabel}%</div>
          <div className="text-xs text-muted">
            {totalPeople}/{limit} pax
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2 mt-4 text-xs">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-primary" aria-hidden="true" />
          <span className="text-muted">Ocupación</span>
          <span className="text-foreground font-medium">{totalPeople}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-white/[0.2]" aria-hidden="true" />
          <span className="text-muted">Límite</span>
          <span className="text-foreground font-medium">{limit}</span>
        </div>
        {typeof totalBookings === "number" ? (
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-accent-2" aria-hidden="true" />
            <span className="text-muted">Reservas</span>
            <span className="text-foreground font-medium">{totalBookings}</span>
          </div>
        ) : null}
        {typeof pending === "number" && typeof confirmed === "number" ? (
          <div className="text-xs text-muted mt-1">{pending} pendientes · {confirmed} confirmadas</div>
        ) : null}
      </div>
    </section>
  );
}
