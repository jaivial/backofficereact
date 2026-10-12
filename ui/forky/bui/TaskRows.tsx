"use client";

import type { CSSProperties } from "react";

/* ─────────────────────────────────────────────────────────
 * TASK ROWS — live agent task status (beautifului #06)
 *
 * Each row is one unit of agent work with a live status:
 *   running   accent spinner
 *   completed green check
 *   failed    red cross
 *   pending   muted hollow dot
 *
 * Variants: "list" (hairline-separated rows) and "capsule"
 * (status pill on the right). Theme comes from the bui-scope
 * tokens, so dark/light follow the app automatically.
 * ───────────────────────────────────────────────────────── */

export type TaskRowStatus = "running" | "completed" | "failed" | "pending";

export type TaskRow = {
  primary: string;
  secondary?: string;
  status: TaskRowStatus;
};

const SPIN_KEYFRAMES = "@keyframes bui-taskrows-spin { to { transform: rotate(360deg); } }";

function StatusMark({ status }: { status: TaskRowStatus }) {
  const base: CSSProperties = {
    width: 16,
    height: 16,
    flex: "0 0 16px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  };
  if (status === "running") {
    return (
      <span style={base} aria-label="en curso">
        <span
          style={{
            width: 12,
            height: 12,
            borderRadius: "50%",
            border: "2px solid var(--accent-tint)",
            borderTopColor: "var(--accent)",
            animation: "bui-taskrows-spin 0.8s linear infinite",
          }}
        />
      </span>
    );
  }
  if (status === "completed") {
    return (
      <span style={{ ...base, color: "var(--green)" }} aria-label="completada">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6L9 17l-5-5" />
        </svg>
      </span>
    );
  }
  if (status === "failed") {
    return (
      <span style={{ ...base, color: "var(--red)" }} aria-label="fallida">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </span>
    );
  }
  return (
    <span style={base} aria-label="pendiente">
      <span style={{ width: 8, height: 8, borderRadius: "50%", border: "1.5px solid var(--ink-3)" }} />
    </span>
  );
}

const STATUS_CAPSULE: Record<TaskRowStatus, { label: string; color: string; bg: string }> = {
  running: { label: "En curso", color: "var(--accent-ink)", bg: "var(--accent-tint)" },
  completed: { label: "Completada", color: "var(--green)", bg: "var(--green-tint)" },
  failed: { label: "Fallida", color: "var(--red)", bg: "var(--red-tint)" },
  pending: { label: "Pendiente", color: "var(--ink-3)", bg: "var(--hover)" },
};

export default function TaskRows({
  rows,
  variant = "list",
  testIdPrefix = "bui-taskrows",
}: {
  rows: TaskRow[];
  variant?: "list" | "capsule";
  testIdPrefix?: string;
}) {
  return (
    <div
      data-testid={testIdPrefix}
      style={{
        width: "100%",
        borderRadius: "var(--radius-card)",
        background: "var(--surface)",
        boxShadow: "var(--shadow-hairline)",
        overflow: "hidden",
        fontSize: 13,
        color: "var(--ink)",
      }}
    >
      <style>{SPIN_KEYFRAMES}</style>
      {rows.map((row, index) => (
        <div
          key={`${row.primary}-${index}`}
          data-testid={`${testIdPrefix}-row-${index}`}
          data-status={row.status}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "9px 12px",
            borderTop: index === 0 ? "none" : "1px solid var(--line)",
            opacity: row.status === "pending" ? 0.62 : 1,
          }}
        >
          <StatusMark status={row.status} />
          <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {row.primary}
          </span>
          {row.secondary ? (
            <span style={{ color: "var(--ink-3)", fontSize: 12, flex: "0 0 auto" }}>{row.secondary}</span>
          ) : null}
          {variant === "capsule" ? (
            <span
              style={{
                flex: "0 0 auto",
                fontSize: 11,
                fontWeight: 500,
                padding: "2px 8px",
                borderRadius: 999,
                color: STATUS_CAPSULE[row.status].color,
                background: STATUS_CAPSULE[row.status].bg,
              }}
            >
              {STATUS_CAPSULE[row.status].label}
            </span>
          ) : null}
        </div>
      ))}
    </div>
  );
}
