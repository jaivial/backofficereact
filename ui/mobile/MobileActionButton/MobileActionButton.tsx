import React from "react";
import { cn } from "../../shadcn/utils";

type Variant = "primary" | "secondary" | "destructive" | "ghost";
type Size = "sm" | "md" | "lg" | "full";

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] hover:bg-[hsl(var(--primary))]/90 active:bg-[hsl(var(--primary))]/80",
  secondary: "bg-[hsl(var(--secondary))] text-[hsl(var(--secondary-foreground))] hover:bg-[hsl(var(--secondary))]/90",
  destructive: "bg-red-500 text-white hover:bg-red-600 active:bg-red-700",
  ghost: "bg-transparent text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]",
};

const SIZE_CLASSES: Record<Size, string> = {
  sm: "px-3 py-1.5 text-sm rounded-lg min-h-[36px]",
  md: "px-4 py-3 text-base rounded-xl min-h-[48px]",
  lg: "px-6 py-4 text-lg rounded-2xl min-h-[56px]",
  full: "px-4 py-3.5 text-base rounded-xl min-h-[52px] w-full",
};

interface MobileActionButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  type?: "button" | "submit" | "reset";
  variant?: Variant;
  size?: Size;
  disabled?: boolean;
  loading?: boolean;
  className?: string;
  "data-ui"?: string;
  "data-role"?: string;
  "aria-label"?: string;
}

export function MobileActionButton({
  children,
  onClick,
  type = "button",
  variant = "primary",
  size = "md",
  disabled = false,
  loading = false,
  className,
  "data-ui": dataUi,
  "data-role": dataRole,
  "aria-label": ariaLabel,
}: MobileActionButtonProps) {
  const isDisabled = disabled || loading;
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={isDisabled}
      className={cn(
        "flex items-center justify-center gap-2 font-semibold transition-all",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        "active:scale-95",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2",
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        className,
      )}
      data-ui={dataUi}
      data-role={dataRole}
      aria-label={ariaLabel}
      aria-busy={loading}
    >
      {loading ? (
        <>
          <span className="animate-spin inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full" aria-hidden="true" data-slot="mobileActionButton-rounded-full" />
          <span data-slot="mobileActionButton-ndo">Cargando...</span>
        </>
      ) : (
        children
      )}
    </button>
  );
}
