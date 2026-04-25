import React, { type HTMLAttributes, type ReactNode } from "react";
import { cn } from "../shadcn/utils";

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
  return (
    <div
      className={cn(
        variant === "tailwind"
          ? "bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center"
          : "bo-emptyState",
        className,
      )}
      {...rest}
    >
      {icon && <div className="bo-emptyStateIcon">{icon}</div>}
      {title && <p className={variant === "tailwind" ? "text-gray-500 text-sm" : "bo-mutedText"}>{title}</p>}
      {description && <p className={variant === "tailwind" ? "text-gray-400 text-xs mt-1" : "bo-mutedText"}>{description}</p>}
      {children}
    </div>
  );
}
