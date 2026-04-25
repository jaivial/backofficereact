import React, { type HTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../shadcn/utils";

const badgeVariants = cva("bo-badge", {
  variants: {
    variant: {
      success: "bo-badge--success",
      danger: "bo-badge--danger",
      warning: "bo-badge--warning",
      info: "bo-badge--info",
      neutral: "",
    },
    size: {
      sm: "bo-badge--sm",
      md: "",
    },
  },
  defaultVariants: {
    variant: "neutral",
    size: "md",
  },
});

type StatusBadgeProps = HTMLAttributes<HTMLSpanElement> &
  VariantProps<typeof badgeVariants>;

export function StatusBadge({
  variant,
  size,
  className,
  children,
  ...rest
}: StatusBadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant, size }), className)} {...rest}>
      {children}
    </span>
  );
}
