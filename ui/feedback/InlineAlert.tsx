import React from "react";
import { cn } from "../shadcn/utils";

export function InlineAlert({
  kind,
  title,
  message,
  className,
}: {
  kind: "error" | "success" | "info";
  title: string;
  message?: string;
  className?: string;
}) {
  const cls =
    kind === "error"
      ? "bo-alert bo-alert--glass bo-alert--error"
      : kind === "success"
        ? "bo-alert bo-alert--glass bo-alert--success"
        : "bo-alert bo-alert--glass";
  return (
    <div className={cn(cls, className)} role="status" aria-live="polite" aria-label={title} data-ui="inline-alert">
      <div className="bo-alertTitle" data-slot="alert-title">{title}</div>
      {message ? <div className="bo-alertMsg" data-slot="alert-message">{message}</div> : null}
    </div>
  );
}
