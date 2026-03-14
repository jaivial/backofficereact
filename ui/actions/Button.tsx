import React from "react";
import { cn } from "../shadcn/utils";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "success";
type ButtonSize = "sm" | "md" | "lg";

const variantClass: Record<ButtonVariant, string> = {
  primary: "border border-primary/30 bg-primary/16",
  secondary: "border border-border bg-surface-2 text-foreground",
  ghost: "bg-transparent border-none",
  danger: "border border-destructive/35 bg-destructive/14",
  success: "border border-green-500/35 bg-green-500/14 text-green-500",
};

const sizeClass: Record<ButtonSize, string> = {
  sm: "h-8 px-2.5 rounded-[10px] text-xs",
  md: "h-10 px-[14px] rounded-[12px]",
  lg: "h-12 px-6 rounded-lg text-base",
};

export function Button({
  variant = "secondary",
  size = "md",
  className = "",
  type = "button",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
}) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex items-center justify-center gap-2 font-semibold whitespace-nowrap rounded-[12px] border border-border bg-white/[0.03] text-foreground transition-all duration-150 hover:bg-white/[0.06] hover:border-border-2 hover:-translate-y-0.5 disabled:opacity-55 disabled:cursor-not-allowed",
        variantClass[variant],
        sizeClass[size],
        className
      )}
      {...props}
    />
  );
}
