import React, { type HTMLAttributes, type ReactNode } from "react";
import { cn } from "../shadcn/utils";
import { childTestId } from "../lib/testId";

type EmptyStateProps = HTMLAttributes<HTMLDivElement> & {
  icon?: ReactNode;
  title?: string;
  description?: string;
  variant?: "default" | "tailwind";
};

export function EmptyState({
  icon,
  title,
  description,
  variant = "default",
  className,
  children,
  ...rest
}: EmptyStateProps) {
  const testId = (rest as { "data-testid"?: string })["data-testid"];
  return (
    <div data-slot="emptyState-div"
      className={cn(
        variant === "tailwind"
          ? "bg-[var(--bo-surface)] rounded-lg shadow-sm border border-[var(--bo-border)] p-12 text-center"
          : "bo-emptyState",
        className,
      )}
      {...rest}
    >
      {icon && <div className="bo-emptyStateIcon" data-testid={childTestId(testId, "icon")}>{icon}</div>}
      {title && <p className={variant === "tailwind" ? "text-[var(--bo-muted)] text-sm" : "bo-mutedText"} data-testid={childTestId(testId, "title")}>{title}</p>}
      {description && <p className={variant === "tailwind" ? "text-[var(--bo-faint)] text-xs mt-1" : "bo-mutedText"} data-testid={childTestId(testId, "description")}>{description}</p>}
      {children}
    </div>
  );
}
