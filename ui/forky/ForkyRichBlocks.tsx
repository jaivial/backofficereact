import { useMemo, useState } from "react";

// ---------------------------------------------------------------------------
// Forky rich blocks: generative widgets and document previews.
//
// Same protocol as forky-chart: the assistant emits a fenced block tagged
// `forky-widget` or `forky-doc` with a JSON payload, and the client renders a
// real component instead of raw text.
//
// `forky-widget` (OpenIntelligentUI-style generative UI): the assistant
// authors self-contained HTML/CSS and the client renders it inside a
// sandboxed iframe (scripts allowed, no same-origin access). The widget can
// pull CDN libraries (Chart.js, D3, Three.js) via script tags.
//
// `forky-doc`: a document preview card (invoice, report, PDF, sheet) with an
// optional inline iframe preview for PDF/HTML documents.
// ---------------------------------------------------------------------------

export interface ForkyWidgetSpec {
  title?: string;
  html: string;
  css?: string;
  height?: number;
}

export interface ForkyDocSpec {
  title: string;
  url: string;
  kind?: string;
  mime?: string;
}

const WIDGET_DEFAULT_HEIGHT = 320;
const WIDGET_MAX_HEIGHT = 640;

function parseJsonBlock<T>(text: string, tag: string, validate: (raw: Record<string, unknown>) => T | null): T | null {
  const match = text.match(new RegExp("```" + tag + "\\s*([\\s\\S]*?)```"));
  if (!match) return null;
  try {
    const raw = JSON.parse(match[1]);
    if (typeof raw !== "object" || raw === null) return null;
    return validate(raw as Record<string, unknown>);
  } catch {
    return null;
  }
}

export function parseForkyWidget(text: string): ForkyWidgetSpec | null {
  return parseJsonBlock(text, "forky-widget", (raw) => {
    if (typeof raw.html !== "string" || raw.html.trim().length === 0) return null;
    const height = typeof raw.height === "number" && Number.isFinite(raw.height)
      ? Math.min(Math.max(Math.round(raw.height), 120), WIDGET_MAX_HEIGHT)
      : undefined;
    return {
      title: typeof raw.title === "string" ? raw.title : undefined,
      html: raw.html,
      css: typeof raw.css === "string" ? raw.css : undefined,
      height,
    };
  });
}

export function parseForkyDoc(text: string): ForkyDocSpec | null {
  return parseJsonBlock(text, "forky-doc", (raw) => {
    if (typeof raw.title !== "string" || typeof raw.url !== "string") return null;
    if (!/^https?:\/\//.test(raw.url)) return null;
    return {
      title: raw.title,
      url: raw.url,
      kind: typeof raw.kind === "string" ? raw.kind : undefined,
      mime: typeof raw.mime === "string" ? raw.mime : undefined,
    };
  });
}

/** Remove rich fenced blocks so the prose renderer never shows raw JSON. */
export function stripForkyRichBlocks(text: string): string {
  return text.replace(/```forky-(?:widget|doc)\s*[\s\S]*?```/g, "");
}

function buildWidgetSrcDoc(spec: ForkyWidgetSpec): string {
  const css = spec.css ?? "";
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
html, body { margin: 0; padding: 0; background: transparent; color: #e6e6ef; font-family: ui-sans-serif, system-ui, sans-serif; }
${css}
</style>
</head>
<body>
${spec.html}
</body>
</html>`;
}

function ForkyWidgetView({ spec }: { spec: ForkyWidgetSpec }) {
  const srcDoc = useMemo(() => buildWidgetSrcDoc(spec), [spec]);
  const height = spec.height ?? WIDGET_DEFAULT_HEIGHT;
  return (
    <div data-testid="forky-widget" className="my-2 overflow-hidden rounded-[10px] border border-fui-line bg-fui-surface">
      {spec.title ? (
        <div className="border-b border-fui-line px-3 py-1.5 text-[11px] font-medium uppercase tracking-wide text-fui-muted">
          {spec.title}
        </div>
      ) : null}
      <iframe
        title={spec.title ?? "Visualización generada por Forky"}
        sandbox="allow-scripts"
        srcDoc={srcDoc}
        className="block w-full"
        style={{ height, border: 0, background: "transparent" }}
      />
    </div>
  );
}

const DOC_ICONS: Record<string, string> = {
  pdf: "PDF",
  invoice: "FAC",
  report: "REP",
  sheet: "XLS",
  image: "IMG",
};

function ForkyDocView({ spec }: { spec: ForkyDocSpec }) {
  const [open, setOpen] = useState(false);
  const isPdf = spec.mime === "application/pdf" || /\.pdf($|\?)/i.test(spec.url);
  const badge = DOC_ICONS[spec.kind ?? ""] ?? "DOC";
  return (
    <div data-testid="forky-doc" className="my-2 overflow-hidden rounded-[10px] border border-fui-line bg-fui-surface">
      <div className="flex items-center gap-3 px-3 py-2.5">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-[8px] bg-fui-accent-tint text-[10px] font-bold text-fui-accent">
          {badge}
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-medium text-fui-ink">{spec.title}</div>
          <div className="truncate text-[11px] text-fui-muted">{spec.url}</div>
        </div>
        {isPdf ? (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="shrink-0 rounded-[7px] border border-fui-line px-2 py-1 text-[11px] text-fui-muted hover:text-fui-ink"
          >
            {open ? "Cerrar" : "Vista previa"}
          </button>
        ) : null}
        <a
          href={spec.url}
          target="_blank"
          rel="noreferrer noopener"
          className="shrink-0 rounded-[7px] border border-fui-line px-2 py-1 text-[11px] text-fui-muted hover:text-fui-ink"
        >
          Abrir
        </a>
      </div>
      {open && isPdf ? (
        <iframe title={spec.title} src={spec.url} className="block w-full border-t border-fui-line" style={{ height: 420 }} />
      ) : null}
    </div>
  );
}

/** Slot: render a sandboxed generative widget when the message has a `forky-widget` block. */
export function ForkyWidget({ text }: { text: string }) {
  const spec = parseForkyWidget(text);
  if (!spec) return null;
  return <ForkyWidgetView spec={spec} />;
}

/** Slot: render a document preview card when the message has a `forky-doc` block. */
export function ForkyDoc({ text }: { text: string }) {
  const spec = parseForkyDoc(text);
  if (!spec) return null;
  return <ForkyDocView spec={spec} />;
}
