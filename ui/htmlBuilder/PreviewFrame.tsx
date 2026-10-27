import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Monitor, Smartphone, Tablet } from "lucide-react";
import { cn } from "../shadcn/utils";
import { DEVICE_WIDTH, type BuilderDevice } from "./BuilderCanvas";

/*
 * Read-only preview of the compiled email (campaign_html_builder_v1): the exact
 * document SMTP sends, rendered at the real width of a desktop, tablet or phone
 * and scaled to fit. Same-origin only (to measure its height), never scripts.
 */

export const DEVICES: { id: BuilderDevice; label: string; Icon: typeof Monitor }[] = [
  { id: "desktop", label: "Escritorio", Icon: Monitor },
  { id: "tablet", label: "Tablet", Icon: Tablet },
  { id: "mobile", label: "Móvil", Icon: Smartphone },
];

/** Desktop / tablet / mobile switch shared by the builder toolbar and the preview tab. */
export function DeviceSwitch({ value, onChange, testId, widths = DEVICE_WIDTH }: { value: BuilderDevice; onChange: (d: BuilderDevice) => void; testId: string; widths?: Record<BuilderDevice, number> }) {
  return (
    <div role="radiogroup" aria-label="Dispositivo" className="inline-flex items-center gap-0.5 rounded-bo-md border border-bo-border bg-bo-surface-3 p-0.5" data-testid={testId}>
      {DEVICES.map((d) => (
        <button
          key={d.id}
          type="button"
          role="radio"
          aria-checked={value === d.id}
          title={`${d.label} (${widths[d.id]}px)`}
          onClick={() => onChange(d.id)}
          className={cn(
            "inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-[7px] border-0 px-2.5 text-xs font-medium transition-colors",
            value === d.id ? "bg-bo-surface-2 text-bo-text shadow-[0_1px_0_rgba(255,255,255,0.06)_inset]" : "bg-transparent text-bo-muted hover:text-bo-text",
          )}
          data-testid={`${testId}-${d.id}`}
        >
          <d.Icon size={15} aria-hidden="true" data-testid={`${testId}-${d.id}-icon`} />
          <span className="hidden sm:inline" data-testid={`${testId}-${d.id}-label`}>{d.label}</span>
        </button>
      ))}
    </div>
  );
}

type Props = { html: string; device: BuilderDevice; testId: string; className?: string };

export function PreviewFrame({ html, device, testId, className }: Props) {
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const [height, setHeight] = useState(480);
  const [available, setAvailable] = useState(800);
  // Bumped on every load: a new srcDoc is a new document to observe.
  const [loads, setLoads] = useState(0);
  const width = DEVICE_WIDTH[device];
  const scale = Math.min(1, Math.max(0.2, available / width));

  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setAvailable(el.clientWidth));
    ro.observe(el);
    setAvailable(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const measure = useCallback(() => {
    const doc = frameRef.current?.contentDocument;
    if (doc?.body) setHeight(Math.max(doc.body.scrollHeight, 320));
  }, []);

  useEffect(() => {
    const doc = frameRef.current?.contentDocument;
    if (!doc?.body) return;
    measure();
    const view = frameRef.current?.contentWindow as (Window & { ResizeObserver?: typeof ResizeObserver }) | null;
    const ro = new (view?.ResizeObserver ?? ResizeObserver)(() => measure());
    ro.observe(doc.body);
    // A preview, not a browser: links must not navigate the frame away.
    const stopLinks = (e: MouseEvent) => {
      if ((e.target as Element | null)?.closest?.("a")) e.preventDefault();
    };
    doc.addEventListener("click", stopLinks);
    return () => {
      ro.disconnect();
      doc.removeEventListener("click", stopLinks);
    };
  }, [html, device, measure, loads]);

  return (
    <div ref={boxRef} className={cn("w-full", className)} data-testid={testId} data-observe={testId} data-device={device}>
      <div
        className="relative mx-auto overflow-hidden rounded-md bg-white shadow-[0_18px_50px_rgba(0,0,0,0.35)] ring-1 ring-white/10"
        style={{ width: width * scale, height: height * scale }}
        data-testid={`${testId}-box`}
      >
        <iframe
          ref={frameRef}
          title="Previsualización del email"
          srcDoc={html}
          sandbox="allow-same-origin"
          onLoad={() => {
            measure();
            setLoads((n) => n + 1);
          }}
          scrolling="no"
          className="block origin-top-left border-0"
          style={{ width, height, transform: `scale(${scale})` }}
          data-testid={`${testId}-iframe`}
        />
      </div>
    </div>
  );
}
