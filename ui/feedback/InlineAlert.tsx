import React from "react";

export function InlineAlert({
  kind,
  title,
  message,
}: {
  kind: "error" | "success" | "info";
  title: string;
  message?: string;
}) {
  const variantClass = {
    error: "border-danger/30 bg-danger/10",
    success: "border-success/30 bg-success/10",
    info: "border-white/[0.06] bg-white/[0.02]",
  }[kind];

  return (
    <div className={`p-4 rounded-lg border ${variantClass}`} role="status" aria-live="polite" aria-label={title}>
      <div className="text-sm font-semibold text-foreground">{title}</div>
      {message ? <div className="text-sm text-muted mt-1">{message}</div> : null}
    </div>
  );
}
