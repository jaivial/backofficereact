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
  const cls = kind === "error" ? "bo-alert bo-alert--error" : kind === "success" ? "bo-alert bo-alert--success" : "bo-alert";
  return (
    <div className={cls} role="status" aria-label={title}>
      <div className="bo-alertTitle">{title}</div>
      {message ? <div className="bo-alertMsg">{message}</div> : null}
    </div>
  );
}

