import React from "react";
import { cn } from "../shadcn/utils";
import { childTestId } from "../lib/testId";

type SpinnerSize = "sm" | "md" | "lg" | "xl";
type SpinnerTone = "default" | "lila" | "cyan" | "white" | "dark";

type LoadingSpinnerProps = {
  size?: SpinnerSize;
  tone?: SpinnerTone;
  label?: string;
  centered?: boolean;
  className?: string;
  /** Unique root test id; the icon and label derive theirs from it. */
  testId?: string;
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
  testId,
}: LoadingSpinnerProps) {
  const wrapperClass = centered ? "bo-spinnerCentered" : "bo-spinnerWithText";
  const spinnerClass = `bo-spinner bo-spinner--${size}${toneClass(tone)}`;

  return (
    <div
      className={cn(wrapperClass, className)}
      role="status"
      aria-live="polite"
      aria-label={label || "Cargando..."}
      data-component="loading-spinner"
      data-size={size}
      data-slot="loading-spinner"
      data-testid={testId}
    >
      <span className={spinnerClass} aria-hidden="true" data-slot="loading-spinner-icon" data-testid={childTestId(testId, "icon")} />
      {label ? <span className="bo-spinnerLabel" data-slot="loading-spinner-label" data-testid={childTestId(testId, "label")}>{label}</span> : null}
    </div>
  );
}
