import React, { type HTMLAttributes, type ReactNode } from "react";
import { cn } from "../shadcn/utils";

type PanelProps = Omit<HTMLAttributes<HTMLDivElement>, "title"> & {
  variant?: "default" | "glass";
  title?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  headClassName?: string;
  bodyClassName?: string;
};

export function Panel({
  variant,
  title,
  meta,
  actions,
  className,
  headClassName,
  bodyClassName,
  children,
  ...rest
}: PanelProps) {
  const hasHead = title || meta || actions;
  return (
    <div className={cn("bo-panel", variant === "glass" && "bo-panel--glass", className)} {...rest}>
      {hasHead && (
        <div className={cn("bo-panelHead", headClassName)} data-slot="panel-head">
          {title && <div className="bo-panelTitle" data-slot="panel-title">{title}</div>}
          {meta && <div className="bo-panelMeta" data-slot="panel-meta">{meta}</div>}
          {actions}
        </div>
      )}
      <div className={cn("bo-panelBody", bodyClassName)} data-slot="panel-body">
        {children}
      </div>
    </div>
  );
}
