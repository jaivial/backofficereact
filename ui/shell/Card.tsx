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
  /** ClassName applied to the inner body wrapper. Useful when callers want
   *  to swap the default `.bo-cardBody` padding (e.g. `bo-cardBody--noPadding`). */
  bodyClassName?: string;
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
  bodyClassName,
  headerClassName,
  footerClassName,
  children,
  ...rest
}: CardProps) {
  // bodyClassName is accepted for API parity with <Panel bodyClassName>; the
  // bo-cardBody wrapper is not introduced here so that <Card>'s outer
  // container stays a single <div> (existing callers rely on `padding={false}`
  // and direct-child layout). When you need a styled body slot, apply
  // bo-cardBody/--noPadding via the outer `className` prop instead.
  return (
    <div data-slot="card-div"
      className={cn(
        variantClasses[variant],
        padding && "p-4",
        bodyClassName,
        className,
      )}
      {...rest}
    >
      {header && <div className={cn("bo-cardHead", headerClassName)}>{header}</div>}
      {children}
      {footer && <div className={cn("bo-cardFoot", footerClassName)}>{footer}</div>}
    </div>
  );
}
