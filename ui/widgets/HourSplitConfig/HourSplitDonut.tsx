import * as React from "react";
import { Pie, PieChart, Cell } from "recharts";

import { ChartContainer, type ChartConfig } from "../../shadcn/chart";
import { cn } from "../../shadcn/utils";

/**
 * Donut-with-text for a single hour: shows bookings vs capacity (people).
 * Uses the shadcn chart container + Recharts Pie. Center overlay renders the
 * `bookings/capacity` text (mirrors the shadcn "Pie - Donut with Text" example).
 */
export type HourSplitDonutProps = {
  bookings: number;
  capacity: number;
  percentage: number;
  /** Accessible label, e.g. "13:30". */
  label: string;
  className?: string;
};

export function HourSplitDonut({ bookings, capacity, percentage, label, className }: HourSplitDonutProps) {
  const cap = Number.isFinite(capacity) && capacity > 0 ? capacity : 0;
  const used = Math.max(0, Math.min(bookings, cap));
  const free = Math.max(0, cap - used);
  const ratio = cap > 0 ? Math.min(1, used / cap) : 0;

  const data = [
    { name: "Ocupado", value: used },
    { name: "Libre", value: free },
  ];
  const config: ChartConfig = {
    used: { label: "Ocupado", color: "var(--bo-accent)" },
    free: { label: "Libre", color: "var(--bo-accent-2)" },
  };

  const tone = ratio >= 1 ? "is-full" : ratio >= 0.7 ? "is-limited" : "";

  return (
    <div
      className={cn("bo-hsplitDonut", tone, className)}
      data-testid="hour-split-donut"
      data-ui="hour-split-donut"
      data-hour={label}
      data-ratio={ratio.toFixed(2)}
    >
      <ChartContainer config={config} className="bo-hsplitDonutChart" aria-label={`Ocupación hora ${label}`}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius={42}
            outerRadius={62}
            paddingAngle={2}
            strokeWidth={0}
            isAnimationActive={false}
          >
            <Cell key="used" fill="var(--color-used)" />
            <Cell key="free" fill="var(--color-free)" />
          </Pie>
        </PieChart>
      </ChartContainer>
      <div className="bo-hsplitDonutCenter" data-slot="donut-center" aria-hidden="true">
        <div className="bo-hsplitDonutPct" data-slot="donut-percentage">{Math.round(percentage)}%</div>
        <div className="bo-hsplitDonutMeta" data-slot="donut-meta">
          {used}/{cap}
        </div>
      </div>
    </div>
  );
}
