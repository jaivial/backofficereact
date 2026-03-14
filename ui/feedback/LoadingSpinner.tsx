import React from "react";

type SpinnerSize = "sm" | "md" | "lg" | "xl";
type SpinnerTone = "default" | "lila" | "cyan" | "white" | "dark";

type LoadingSpinnerProps = {
  size?: SpinnerSize;
  tone?: SpinnerTone;
  label?: string;
  centered?: boolean;
  className?: string;
};

const sizeClass: Record<SpinnerSize, string> = {
  sm: "w-4 h-4",
  md: "w-5 h-5",
  lg: "w-6 h-6",
  xl: "w-8 h-8",
};

const toneClass: Record<SpinnerTone, string> = {
  default: "border-primary",
  lila: "border-primary",
  cyan: "border-accent-2",
  white: "border-white",
  dark: "border-foreground",
};

export function LoadingSpinner({
  size = "md",
  tone = "default",
  label,
  centered = false,
  className,
}: LoadingSpinnerProps) {
  const wrapperClass = centered ? "flex items-center justify-center" : "flex items-center gap-3";
  const rootClass = `${wrapperClass}${className ? ` ${className}` : ""}`;
  const spinnerClass = `animate-spin rounded-full border-2 ${sizeClass[size]} ${toneClass[tone]}`;

  return (
    <div className={rootClass} role="status" aria-live="polite">
      <span className={spinnerClass} aria-hidden="true" />
      {label ? <span className="text-sm text-muted">{label}</span> : null}
    </div>
  );
}
