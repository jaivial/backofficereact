import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "../shadcn/utils";

interface ChevronButtonProps {
  direction: "left" | "right";
  onClick: () => void;
  ariaLabel: string;
  className?: string;
  disabled?: boolean;
}

export function ChevronButton({
  direction,
  onClick,
  ariaLabel,
  className,
  disabled,
}: ChevronButtonProps) {
  const Icon = direction === "left" ? ChevronLeft : ChevronRight;

  return (
    <button
      type="button"
      className={cn(
        // shrink-0: as a flex child the 36px box was squeezed to 30px wide.
        // max-sm sizing meets the 44pt touch target on phones.
        "inline-flex shrink-0 items-center justify-center w-9 h-9 max-sm:w-11 max-sm:h-11 rounded-xl border cursor-pointer transition-all duration-150",
        "border-[var(--bo-border)] bg-transparent text-[var(--bo-muted)] hover:text-[var(--bo-text)] hover:bg-black/10 dark:hover:bg-white/10 hover:border-[var(--bo-border-2)]",
        "disabled:opacity-40 disabled:cursor-not-allowed",
        className,
      )}
      onClick={onClick}
      aria-label={ariaLabel}
      disabled={disabled}
      data-ui={direction === "left" ? "prev-range-btn" : "next-range-btn"}
    >
      <Icon size={16} strokeWidth={1.8} />
    </button>
  );
}
