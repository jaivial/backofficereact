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
    <div className={["bo-slider", className].filter(Boolean).join(" ")}>
      <input
        className="bo-sliderInput"
        type="range"
        min={min}
        max={max}
        step={step}
        value={normalized}
        disabled={disabled}
        onChange={(ev) => onChange(clamp(Number(ev.target.value), min, max))}
        aria-label={ariaLabel}
        style={{ ["--bo-slider-progress" as any]: `${progress}%` } as React.CSSProperties}
      />
      <div className="bo-sliderMeta" aria-hidden="true">
        <span>{min}</span>
        <strong className="bo-sliderValue">{normalized}</strong>
        <span>{max}</span>
      </div>
    </div>
  );
}
