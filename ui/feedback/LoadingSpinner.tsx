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

function toneClass(tone: SpinnerTone): string {
  if (tone === "default") return "";
  return ` bo-spinner--${tone}`;
}

export function LoadingSpinner({
  size = "md",
  tone = "default",
  label,
  centered = false,
  className,
}: LoadingSpinnerProps) {
  const wrapperClass = centered ? "bo-spinnerCentered" : "bo-spinnerWithText";
  const rootClass = `${wrapperClass}${className ? ` ${className}` : ""}`;
  const spinnerClass = `bo-spinner bo-spinner--${size}${toneClass(tone)}`;

  return (
    <div className={rootClass} role="status" aria-live="polite">
      <span className={spinnerClass} aria-hidden="true" />
      {label ? <span className="bo-spinnerLabel">{label}</span> : null}
    </div>
  );
}
