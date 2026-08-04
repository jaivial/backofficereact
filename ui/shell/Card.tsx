import React, { type HTMLAttributes, type ReactNode } from "react";
import { cn } from "../shadcn/utils";

type CardVariant = "default" | "glass" | "tailwind";

type CardProps = HTMLAttributes<HTMLDivElement> & {
  variant?: CardVariant;
  padding?: boolean;
  header?: ReactNode;
  footer?: ReactNode;
  headerClassName?: string;
  footerClassName?: string;
};

const variantClasses: Record<CardVariant, string> = {
  default: "bo-card",
  glass: "bo-card bo-card--glass",
  // "tailwind" predates the design tokens; it now renders in theme colours
  // instead of hardcoded light-mode white, which was unreadable in the app.
  tailwind: "bg-[var(--bo-surface)] rounded-lg shadow-sm border border-[var(--bo-border)]",
};

export function Card({
  variant = "default",
  padding = false,
  header,
  footer,
  className,
  headerClassName,
  footerClassName,
  children,
  ...rest
}: CardProps) {
  return (
    <div className={cn(variantClasses[variant], padding && "p-4", className)} {...rest}>
      {header && <div className={cn("bo-cardHead", headerClassName)}>{header}</div>}
      {children}
      {footer && <div className={cn("bo-cardFoot", footerClassName)}>{footer}</div>}
    </div>
  );
}
