import React, { useMemo } from "react";

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

export function Slider({
  value,
  min = 0,
  max = 100,
  step = 1,
  onChange,
  ariaLabel,
  disabled,
  className,
}: {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (nextValue: number) => void;
  ariaLabel?: string;
  disabled?: boolean;
  className?: string;
}) {
  const normalized = clamp(Math.round(value), min, max);
  const progress = useMemo(() => {
    if (max <= min) return 0;
    return ((normalized - min) * 100) / (max - min);
  }, [max, min, normalized]);

  return (
    <div className={["flex flex-col gap-2", className].filter(Boolean).join(" ")}>
      <input
        className="w-full h-2 rounded-full appearance-none cursor-pointer bg-white/[0.06] [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:duration-150 [&::-webkit-slider-thumb]:hover:scale-110"
        type="range"
        min={min}
        max={max}
        step={step}
        value={normalized}
        disabled={disabled}
        onChange={(ev) => onChange(clamp(Number(ev.target.value), min, max))}
        aria-label={ariaLabel}
      />
      <div className="flex items-center justify-between text-xs text-muted" aria-hidden="true">
        <span>{min}</span>
        <strong className="text-foreground">{normalized}</strong>
        <span>{max}</span>
      </div>
    </div>
  );
}
