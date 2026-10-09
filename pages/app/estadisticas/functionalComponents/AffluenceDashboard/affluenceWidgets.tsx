import React from "react";
import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Card } from "../../../../../ui/shell/Card";
import { cn } from "../../../../../ui/shadcn/utils";
import { DELTA_COLORS, deltaTone, formatPercent, type DeltaTone } from "./affluenceUtils";

/** Sign-aware delta chip: arrow up/down + colour, neutral when the backend sent null. */
export function DeltaBadge({
  delta,
  prefix,
  testId,
  size = "md",
}: {
  delta: number | null | undefined;
  prefix?: string;
  testId: string;
  size?: "sm" | "md";
}) {
  const tone: DeltaTone = deltaTone(delta);
  const Icon = tone === "up" ? ArrowUp : tone === "down" ? ArrowDown : Minus;
  const text = delta === null || delta === undefined || !Number.isFinite(delta)
    ? "sin periodo anterior"
    : `${prefix ? `${prefix} ` : ""}${formatPercent(delta)}`;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-semibold",
        size === "sm" ? "text-[11px]" : "text-xs",
      )}
      style={{ borderColor: DELTA_COLORS[tone], color: DELTA_COLORS[tone] }}
      data-testid={testId}
      data-ui={`${testId}-delta`}
      data-delta-tone={tone}
    >
      <Icon size={size === "sm" ? 11 : 13} aria-hidden="true" data-ui={`${testId}-icon`} />
      <span data-ui={`${testId}-text`}>{text}</span>
    </span>
  );
}

/** Headline delta of the whole period: "En este periodo aumentamos X%". */
export function PeriodDeltaBanner({ delta, testId }: { delta: number | null | undefined; testId: string }) {
  const tone = deltaTone(delta);
  const hasValue = delta !== null && delta !== undefined && Number.isFinite(delta);
  const sentence = !hasValue
    ? "Sin periodo anterior con el que comparar"
    : tone === "up"
      ? "En este periodo aumentamos"
      : tone === "down"
        ? "En este periodo bajamos"
        : "En este periodo mantenemos";
  const Icon = tone === "up" ? ArrowUp : tone === "down" ? ArrowDown : Minus;
  return (
    <div
      className="flex flex-wrap items-center gap-2"
      data-testid={testId}
      data-ui={`${testId}-period-banner`}
      data-delta-tone={tone}
    >
      <span
        className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold"
        style={{ color: DELTA_COLORS[tone], backgroundColor: `color-mix(in srgb, ${DELTA_COLORS[tone]} 12%, transparent)` }}
        data-ui={`${testId}-chip`}
      >
        <Icon size={16} aria-hidden="true" data-ui={`${testId}-chip-icon`} />
        <span data-ui={`${testId}-chip-text`}>
          {sentence} {hasValue ? formatPercent(Math.abs(delta as number)).replace("+", "") : ""}
        </span>
      </span>
      <span className="text-xs text-[var(--bo-muted)]" data-ui={`${testId}-legend`}>
        Comparado con el periodo anterior de igual duración
      </span>
    </div>
  );
}

export function AffluenceKpi({
  label,
  value,
  detail,
  delta,
  icon: Icon,
  testId,
}: {
  label: string;
  value: string;
  detail: string;
  delta: number | null;
  icon: LucideIcon;
  testId: string;
}) {
  return (
    <Card variant="glass" className="flex h-full flex-col justify-between" style={{ minHeight: 132 }} data-testid={testId} data-ui={`${testId}-card`}>
      <div className="flex items-start justify-between gap-3" data-ui={`${testId}-head`}>
        <span className="text-xs font-medium uppercase tracking-wide text-[var(--bo-muted)]" data-ui={`${testId}-label`}>
          {label}
        </span>
        <span className="rounded-lg bg-[var(--bo-bg-selected)] p-2 text-[var(--bo-accent)]" aria-hidden="true" data-ui={`${testId}-icon-wrap`}>
          <Icon size={16} data-ui={`${testId}-icon`} />
        </span>
      </div>
      <div data-ui={`${testId}-body`}>
        <div className="mt-2 text-xl font-semibold tracking-tight sm:mt-3 sm:text-2xl" data-testid={`${testId}-value`} data-ui={`${testId}-value`}>
          {value}
        </div>
        <p className="mt-1 text-xs leading-5 text-[var(--bo-muted)]" data-ui={`${testId}-detail`}>
          {detail}
        </p>
        <div className="mt-2" data-ui={`${testId}-delta-slot`}>
          <DeltaBadge delta={delta} size="sm" testId={`${testId}-delta`} />
        </div>
      </div>
    </Card>
  );
}

export function AffluencePanel({
  title,
  description,
  icon: Icon,
  testId,
  actions,
  children,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
  testId: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card variant="glass" data-testid={testId} data-ui={`${testId}-panel`}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3" data-ui={`${testId}-head`}>
        <div className="min-w-0" data-ui={`${testId}-heading`}>
          <div className="flex items-center gap-3" data-ui={`${testId}-title-row`}>
            <span className="rounded-lg bg-[var(--bo-bg-selected)] p-2 text-[var(--bo-accent)]" aria-hidden="true" data-ui={`${testId}-icon-wrap`}>
              <Icon size={16} data-ui={`${testId}-icon`} />
            </span>
            <h2 className="font-semibold" style={{ margin: 0 }} data-ui={`${testId}-title`}>
              {title}
            </h2>
          </div>
          <p className="mt-[0.4rem] text-xs leading-5 text-[var(--bo-muted)]" data-ui={`${testId}-description`}>
            {description}
          </p>
        </div>
        {actions ? (
          <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2" data-ui={`${testId}-actions`}>
            {actions}
          </div>
        ) : null}
      </div>
      {children}
    </Card>
  );
}

export function ChartEmpty({ message, testId }: { message: string; testId: string }) {
  return (
    <div
      className="flex h-56 min-h-52 items-center sm:h-64 sm:min-h-56 justify-center rounded-xl border border-dashed border-[var(--bo-border-2)] bg-[var(--bo-surface-3)] px-4 text-center sm:px-6 text-sm leading-6 text-[var(--bo-muted)]"
      data-testid={testId}
      data-ui={`${testId}-empty`}
    >
      {message}
    </div>
  );
}

export type ToggleChipProps = {
  label: string;
  active: boolean;
  onClick: () => void;
  testId: string;
  color?: string;
};

/** Small pill toggle used for period presets and month selection. */
export function ToggleChip({ label, active, onClick, testId, color }: ToggleChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition-colors",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--bo-accent)]",
      )}
      style={
        active
          ? { borderColor: color ?? "var(--bo-accent)", color: "var(--bo-on-accent)", backgroundColor: color ?? "var(--bo-accent)" }
          : { borderColor: "var(--bo-border-2)", color: "var(--bo-muted)", backgroundColor: "var(--bo-surface-3)" }
      }
      data-testid={testId}
      data-ui={`${testId}-chip`}
      data-active={active}
    >
      {color ? <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" data-ui={`${testId}-dot`} /> : null}
      {label}
    </button>
  );
}
