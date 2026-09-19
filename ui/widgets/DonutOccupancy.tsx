import React, { useMemo } from "react";

import { cn } from "../shadcn/utils";

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
  size = 120,
  strokeWidth = 10,
  className,
  "data-testid": dataTestId,
}: {
  totalPeople: number;
  limit: number;
  totalBookings?: number;
  pending?: number;
  confirmed?: number;
  /** SVG viewBox diameter in px; controls rendered size. Default 120. */
  size?: number;
  /** Stroke width for both track and arc circles. Default 10. */
  strokeWidth?: number;
  className?: string;
  "data-testid"?: string;
}) {
  const safeLimit = Number.isFinite(limit) && limit > 0 ? limit : 1;
  const pctRaw = (Number(totalPeople) / safeLimit) * 100;
  const pctArc = clamp(pctRaw, 0, 100);
  const pctLabel = Number.isFinite(pctRaw) ? Math.round(pctRaw) : 0;
  const tone = toneForPct(pctRaw);
  const r = Math.max(6, (size - strokeWidth) / 2 - 4);
  const compact = size <= 64;

  const { dashArray, dashOffset } = useMemo(() => {
    const c = 2 * Math.PI * r;
    const dash = (pctArc / 100) * c;
    return { dashArray: `${dash} ${c - dash}`, dashOffset: 0 };
  }, [pctArc, r]);

  return (
    <section
      className={cn(`bo-donut bo-donut--${tone}${compact ? " bo-donut--compact" : ""}`, className)}
      aria-label="Ocupación"
      data-testid={dataTestId ?? "donut-occupancy"}
    >
      <div className="bo-donutSvg" aria-hidden="true" data-slot="donut-chart">
        <svg viewBox={`0 0 ${size} ${size}`} width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
          <circle className="bo-donutTrack" cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={strokeWidth} />
          <circle
            className="bo-donutArc"
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={dashArray}
            strokeDashoffset={dashOffset}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        </svg>
        <div className="bo-donutCenter" data-slot="donut-center">
          <div className="bo-donutPct" data-slot="donut-percentage">{pctLabel}%</div>
          {!compact ? (
            <div className="bo-donutMeta" data-slot="donut-meta">
              {totalPeople}/{limit} pax
            </div>
          ) : null}
        </div>
      </div>

      {compact ? null : (
        <div className="bo-donutLegend" data-slot="donut-legend">
          <div className="bo-donutRow" data-slot="donut-legend-row">
            <span className="bo-pill bo-pill--used" aria-hidden="true" data-slot="donut-legend-dot" />
            <span className="bo-mutedText" data-slot="donut-legend-label">Ocupación</span>
            <span className="bo-donutVal" data-slot="donut-legend-value">{totalPeople}</span>
          </div>
          <div className="bo-donutRow" data-slot="donut-legend-row">
            <span className="bo-pill bo-pill--free" aria-hidden="true" data-slot="donut-legend-dot" />
            <span className="bo-mutedText" data-slot="donut-legend-label">Límite</span>
            <span className="bo-donutVal" data-slot="donut-legend-value">{limit}</span>
          </div>
          {typeof totalBookings === "number" ? (
            <div className="bo-donutRow" data-slot="donut-legend-row">
              <span className="bo-pill" aria-hidden="true" data-slot="donut-legend-dot" />
              <span className="bo-mutedText" data-slot="donut-legend-label">Reservas</span>
              <span className="bo-donutVal" data-slot="donut-legend-value">{totalBookings}</span>
            </div>
          ) : null}
          {typeof pending === "number" && typeof confirmed === "number" ? (
            <div className="bo-donutHint" data-slot="donut-hint">{pending} pendientes · {confirmed} confirmadas</div>
          ) : null}
        </div>
      )}
    </section>
  );
}
