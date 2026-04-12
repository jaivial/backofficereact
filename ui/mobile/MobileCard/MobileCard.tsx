import React from "react";

interface MobileCardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  href?: string;
  "data-ui"?: string;
  "data-role"?: string;
  /** Whether the card should have a subtle press animation on tap */
  pressable?: boolean;
  /** Accent border on the left edge */
  accent?: "primary" | "success" | "warning" | "error";
  "aria-label"?: string;
}

const ACCENT_COLORS = {
  primary: "border-l-[hsl(var(--primary))]",
  success: "border-l-emerald-500",
  warning: "border-l-amber-500",
  error: "border-l-red-500",
};

export function MobileCard({
  children,
  className = "",
  onClick,
  href,
  pressable = false,
  accent,
  "data-ui": dataUi,
  "data-role": dataRole,
  "aria-label": ariaLabel,
}: MobileCardProps) {
  const classes = [
    "flex flex-col gap-2 p-4 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]",
    accent ? `border-l-4 ${ACCENT_COLORS[accent]}` : "",
    pressable || onClick ? "active:scale-[0.99] transition-transform cursor-pointer" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  if (href) {
    return (
      <a
        href={href}
        className={classes}
        data-ui={dataUi}
        data-role={dataRole}
        aria-label={ariaLabel}
      >
        {children}
      </a>
    );
  }

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={classes + " w-full text-left"}
        data-ui={dataUi}
        data-role={dataRole}
        aria-label={ariaLabel}
      >
        {children}
      </button>
    );
  }

  return (
    <div className={classes} data-ui={dataUi} data-role={dataRole} aria-label={ariaLabel}>
      {children}
    </div>
  );
}
