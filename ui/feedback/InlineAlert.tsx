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
  const cls =
    kind === "error"
      ? "bo-alert bo-alert--glass bo-alert--error"
      : kind === "success"
        ? "bo-alert bo-alert--glass bo-alert--success"
        : "bo-alert bo-alert--glass";
  return (
    <div className={cls} role="status" aria-live="polite" aria-label={title}>
      <div className="bo-alertTitle">{title}</div>
      {message ? <div className="bo-alertMsg">{message}</div> : null}
    </div>
  );
}
