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

  return (
    <section className={`bo-donut bo-donut--${tone}`} aria-label="Ocupación">
      <div className="bo-donutSvg" aria-hidden="true">
        <svg viewBox="0 0 120 120" width="120" height="120">
          <circle className="bo-donutTrack" cx="60" cy="60" r="44" fill="none" strokeWidth="10" />
          <circle
            className="bo-donutArc"
            cx="60"
            cy="60"
            r="44"
            fill="none"
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={dashArray}
            strokeDashoffset={dashOffset}
            transform="rotate(-90 60 60)"
          />
        </svg>
        <div className="bo-donutCenter">
          <div className="bo-donutPct">{pctLabel}%</div>
          <div className="bo-donutMeta">
            {totalPeople}/{limit} pax
          </div>
        </div>
      </div>

      <div className="bo-donutLegend">
        <div className="bo-donutRow">
          <span className="bo-pill bo-pill--used" aria-hidden="true" />
          <span className="bo-mutedText">Ocupación</span>
          <span className="bo-donutVal">{totalPeople}</span>
        </div>
        <div className="bo-donutRow">
          <span className="bo-pill bo-pill--free" aria-hidden="true" />
          <span className="bo-mutedText">Límite</span>
          <span className="bo-donutVal">{limit}</span>
        </div>
        {typeof totalBookings === "number" ? (
          <div className="bo-donutRow">
            <span className="bo-pill" aria-hidden="true" />
            <span className="bo-mutedText">Reservas</span>
            <span className="bo-donutVal">{totalBookings}</span>
          </div>
        ) : null}
        {typeof pending === "number" && typeof confirmed === "number" ? (
          <div className="bo-donutHint">{pending} pendientes · {confirmed} confirmadas</div>
        ) : null}
      </div>
    </section>
  );
}

