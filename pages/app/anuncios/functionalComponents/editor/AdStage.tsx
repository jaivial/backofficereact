import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, Loader2, RotateCcw, X } from "lucide-react";
import type { RestaurantAdDesignContainer } from "../../../../../api/types";
import type { BuilderDevice } from "../../../../../ui/htmlBuilder/BuilderCanvas";
import { BORDER_PREFLIGHT_CSS, EMAIL_RESET_CSS, fetchDesignCss } from "../../../../../ui/htmlBuilder/css";
import { AD_DEFAULT_OVERLAY, stepIdsOf, stepShownOn, todayMadrid, type AdDraft } from "./adDesign";

/*
 * Where an ad lives (ads_html_editor_v1): a window centred over the restaurant
 * website. The editor canvas and the preview draw that same scene at the real
 * size of a desktop, tablet or phone screen with the numbers of the public
 * popover (preactvillacarmen PublicHtmlAdPopover, .publicAdOverlay) and the
 * external plugin: 20px of screen margin, a 6px blur on the website, the
 * window at most 80% of the screen tall, the light close chip top-right and
 * the "Volver" pill top-left on a step.
 */

export const AD_VIEWPORT: Record<BuilderDevice, { width: number; height: number; label: string }> = {
  desktop: { width: 1280, height: 800, label: "Escritorio" },
  tablet: { width: 820, height: 1180, label: "Tablet" },
  mobile: { width: 390, height: 844, label: "Móvil" },
};
export const AD_DEVICE_WIDTHS: Record<BuilderDevice, number> = { desktop: 1280, tablet: 820, mobile: 390 };
export const AD_SCREEN_MARGIN = 20;
export const AD_BACKDROP_BLUR = 6;
export const AD_WINDOW_MAX_HEIGHT = 0.8;

export function adSheetWidth(device: BuilderDevice, container: RestaurantAdDesignContainer): number {
  return Math.min(container.max_width ?? 560, AD_VIEWPORT[device].width - AD_SCREEN_MARGIN * 2);
}

/** Absolute website URL (the setting may lack the scheme). */
export function websiteBase(website: string): string {
  const raw = website.trim().replace(/\/+$/, "");
  if (!raw) return "";
  return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
}

/**
 * Home page of the website without its own ads (vc_ads=0), the editor
 * backdrop. vc_preview=1 is what lets the backoffice frame the site (the
 * website proxy only relaxes X-Frame-Options for preview URLs).
 */
export function backdropUrl(website: string): string {
  const base = websiteBase(website);
  return base ? `${base}/?vc_preview=1&vc_ads=0` : "";
}

/** The restaurant website behind the ad; a neutral page mock without one. */
export function WebsiteBackdrop({ website, testId }: { website: string; testId: string }) {
  const src = backdropUrl(website);
  if (!src) {
    return (
      <div className="grid h-full w-full content-start gap-6 bg-[#f4f1ea] p-10" aria-hidden="true" data-testid={`${testId}-mock`}>
        <div className="h-14 rounded-lg bg-[#e3ddd0]" data-testid={`${testId}-mock-nav`} />
        <div className="h-72 rounded-2xl bg-[#d8d1c1]" data-testid={`${testId}-mock-hero`} />
        <div className="grid grid-cols-3 gap-6" data-testid={`${testId}-mock-row`}>
          <div className="h-40 rounded-xl bg-[#e3ddd0]" data-testid={`${testId}-mock-a`} />
          <div className="h-40 rounded-xl bg-[#e3ddd0]" data-testid={`${testId}-mock-b`} />
          <div className="h-40 rounded-xl bg-[#e3ddd0]" data-testid={`${testId}-mock-c`} />
        </div>
      </div>
    );
  }
  // Decoration only: the home runs, but can neither navigate the editor nor open popups.
  return (
    <iframe
      src={src}
      title="Web del restaurante"
      tabIndex={-1}
      aria-hidden="true"
      sandbox="allow-scripts allow-same-origin"
      className="block h-full w-full border-0 bg-white"
      loading="lazy"
      data-testid={`${testId}-site`}
    />
  );
}

// Light chips with a dark glyph, as on the website (.publicAdClose / .publicAdBack).
const CHIP = "rounded-full bg-[rgba(255,253,248,0.92)] text-[#24342b] shadow-[0_1px_4px_rgba(0,0,0,0.25)]";
const CLOSE = `absolute right-[14px] top-3 grid size-9 place-items-center ${CHIP}`;
const BACK = `absolute left-[14px] top-3 inline-flex items-center gap-0.5 px-3.5 py-2 text-base font-semibold leading-tight ${CHIP}`;

/** Close and back chips of the public window, drawn over the sheet. */
export function AdChrome({ back, testId }: { back: boolean; testId: string }) {
  return (
    <>
      {back && (
        <span className={BACK} data-testid={`${testId}-back`}>
          <ChevronLeft size={16} aria-hidden="true" data-testid={`${testId}-back-icon`} /> Volver
        </span>
      )}
      <span className={CLOSE} data-testid={`${testId}-close`}>
        <X size={20} aria-hidden="true" data-testid={`${testId}-close-icon`} />
      </span>
    </>
  );
}

/** Bridge of the preview pages: same messages as the public render. */
const PREVIEW_BRIDGE = `(function(){var step=document.documentElement.getAttribute("data-step")||"";
function post(m){m.type="vc-ad";m.step=step;parent.postMessage(m,"*")}
var last=0;function height(){var b=document.body,h=Math.ceil(Math.max(b.scrollHeight,b.offsetHeight,document.documentElement.scrollHeight));if(h!==last){last=h;post({event:"height",height:h})}}
window.addEventListener("load",height);if(window.ResizeObserver){new ResizeObserver(height).observe(document.body)}height();
window.addEventListener("message",function(e){var d=e.data;if(d&&d.type==="vc-ad-measure"){last=0;height()}});
document.addEventListener("click",function(e){var t=e.target;if(!t||!t.closest)return;var card=t.closest("[data-ad-step]");
if(card){e.preventDefault();post({event:"step",target:card.getAttribute("data-ad-step")});return}
var a=t.closest("a[href]");if(a&&(a.getAttribute("href")||"").charAt(0)==="#")e.preventDefault()});})();`;

function previewDoc(html: string, css: string, step: string, hiddenCss = ""): string {
  return (
    `<!doctype html><html lang="es" data-step="${step.replace(/"/g, "")}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><base target="_blank">` +
    // Never scrolls (same as the public render): the iframe follows the posted height.
    `<style>html,body{margin:0;padding:0;background:transparent;overflow:hidden}[data-ad-step]{cursor:pointer}${BORDER_PREFLIGHT_CSS}${EMAIL_RESET_CSS}${css}${hiddenCss}</style></head>` +
    `<body>${html}<script>${PREVIEW_BRIDGE}</script></body></html>`
  );
}

function useWidth(ref: React.RefObject<HTMLElement | null>): number {
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setWidth(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return width;
}

type Props = {
  draft: AdDraft;
  device: BuilderDevice;
  website: string;
  coordId: string;
  /** Step shown first ("" = main page). */
  initialStep?: string;
  /** Dates of the ad: the preview of a day outside them says so. */
  adRange?: { starts_at: string | null; ends_at: string | null };
};

/**
 * Interactive preview of the unsaved ad: the website at the device size, the
 * dimming overlay and the window with the real page (Tailwind compiled by the
 * same endpoint as the canvas). Cards open their step, "Volver" goes back and
 * the close chip hides the ad until "Mostrar de nuevo".
 */
export function AdLivePreview({ draft, device, website, coordId, initialStep = "", adRange }: Props) {
  const testId = "ad-preview";
  const hostRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const available = useWidth(hostRef);
  const viewport = AD_VIEWPORT[device];
  const scale = available ? Math.min(1, Math.max(0.2, (available - 16) / viewport.width)) : 0;
  const [step, setStep] = useState(initialStep);
  const [open, setOpen] = useState(true);
  const [height, setHeight] = useState(240);
  const [doc, setDoc] = useState<{ html: string; error: string }>({ html: "", error: "" });
  const live = useMemo(() => new Set(stepIdsOf(draft.kind === "multiple" ? draft.main : "")), [draft.kind, draft.main]);
  const page = step && live.has(step) ? draft.steps[step]?.html ?? "" : draft.main;
  const current = step && live.has(step) ? step : "";
  // The day previewed: the website hides the cards out of their dates that
  // day (and the whole ad out of its own dates).
  const [day, setDay] = useState(todayMadrid);
  const hiddenIds = useMemo(() => Array.from(live).filter((id) => !stepShownOn(draft.steps[id], day)), [day, draft.steps, live]);
  const hiddenCss = current ? "" : hiddenIds.map((id) => `[data-ad-step="${id.replace(/[^A-Za-z0-9_-]/g, "")}"]{display:none!important}`).join("");
  const adOff = Boolean(adRange?.starts_at && adRange.ends_at && (day < adRange.starts_at || day > adRange.ends_at));
  const noCards = draft.kind === "multiple" && live.size > 0 && hiddenIds.length === live.size;
  const offReason = adOff ? "Ese día el anuncio está fuera de sus fechas: no aparece en la web." : noCards ? "Ese día ninguna tarjeta está en sus fechas: el anuncio no aparece en la web." : "";

  useEffect(() => {
    let alive = true;
    const controller = new AbortController();
    setDoc((prev) => ({ html: prev.html, error: "" }));
    fetchDesignCss(page, coordId, controller.signal)
      .then((css) => alive && setDoc({ html: previewDoc(page, css, current, hiddenCss), error: "" }))
      .catch((err: unknown) => alive && !controller.signal.aborted && setDoc({ html: "", error: err instanceof Error ? err.message : "No se pudo preparar la vista previa" }));
    return () => {
      alive = false;
      controller.abort();
    };
  }, [page, current, coordId, hiddenCss]);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.source !== frameRef.current?.contentWindow) return;
      const m = e.data as { type?: string; event?: string; height?: number; target?: string; step?: string } | null;
      if (!m || m.type !== "vc-ad") return;
      if (m.event === "height" && typeof m.height === "number" && m.height > 0) setHeight(m.height);
      if (m.event === "step" && m.target) {
        setHeight(240);
        setStep(String(m.target));
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  const c = draft.container;
  const sheet = adSheetWidth(device, c);
  const maxHeight = Math.round(viewport.height * AD_WINDOW_MAX_HEIGHT);
  return (
    <div ref={hostRef} className="grid w-full justify-items-center gap-3" data-testid={testId} data-device={device} data-step={current || "main"}>
      {scale > 0 && (
        <div className="relative overflow-hidden rounded-md shadow-[0_18px_50px_rgba(0,0,0,0.45)] ring-1 ring-white/10" style={{ width: viewport.width * scale, height: viewport.height * scale }} data-testid={`${testId}-screen`}>
          <div className="absolute left-0 top-0 origin-top-left" style={{ width: viewport.width, height: viewport.height, transform: `scale(${scale})` }} data-testid={`${testId}-viewport`}>
            <WebsiteBackdrop website={website} testId={`${testId}-backdrop`} />
            {open && offReason && (
              <div className="absolute inset-x-0 top-1/3 mx-auto w-fit max-w-[80%] rounded-xl bg-black/75 px-5 py-4 text-center text-base text-white" data-testid={`${testId}-off`}>
                {offReason}
              </div>
            )}
            {open && !offReason && (
              <div
                className="absolute inset-0 flex items-center justify-center"
                style={{ background: c.overlay || AD_DEFAULT_OVERLAY, padding: AD_SCREEN_MARGIN, backdropFilter: `blur(${AD_BACKDROP_BLUR}px)` }}
                data-testid={`${testId}-overlay`}
              >
                <div
                  className="relative w-full overflow-hidden shadow-[0_24px_80px_rgba(0,0,0,0.28)]"
                  style={{ maxWidth: sheet, borderRadius: c.radius ?? 24, background: c.background || "#ffffff" }}
                  data-testid={`${testId}-window`}
                >
                  {current && (
                    <button
                      type="button"
                      onClick={() => {
                        setHeight(240);
                        setStep("");
                      }}
                      className={`z-[4] cursor-pointer border-0 ${BACK}`}
                      data-testid={`${testId}-back`}
                    >
                      <ChevronLeft size={16} aria-hidden="true" data-testid={`${testId}-back-icon`} /> Volver
                    </button>
                  )}
                  <button type="button" aria-label="Cerrar anuncio" onClick={() => setOpen(false)} className={`z-[4] cursor-pointer border-0 ${CLOSE}`} data-testid={`${testId}-close`}>
                    <X size={20} aria-hidden="true" data-testid={`${testId}-close-icon`} />
                  </button>
                  <div className="overflow-auto overscroll-contain" style={{ maxHeight }} data-testid={`${testId}-scroll`}>
                  {doc.html ? (
                    <iframe
                      ref={frameRef}
                      title="Vista previa del anuncio"
                      srcDoc={doc.html}
                      sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"
                      onLoad={() => frameRef.current?.contentWindow?.postMessage({ type: "vc-ad-measure" }, "*")}
                      className="block w-full border-0 bg-transparent"
                      style={{ height }}
                      data-testid={`${testId}-frame`}
                    />
                  ) : (
                    <p className="m-0 grid min-h-[200px] place-items-center p-6 text-center text-sm text-gray-500" data-testid={`${testId}-wait`}>
                      {doc.error || <Loader2 size={20} className="animate-spin" aria-label="Preparando la vista previa" data-testid={`${testId}-wait-icon`} />}
                    </p>
                  )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-bo-muted" data-testid={`${testId}-meta`}>
        <span data-testid={`${testId}-meta-size`}>
          {viewport.label} · {viewport.width} × {viewport.height} · ventana {sheet}px
        </span>
        <label className="inline-flex items-center gap-1.5" data-testid={`${testId}-day`}>
          <span data-testid={`${testId}-day-caption`}>Ver el día</span>
          <input
            type="date"
            className="bo-input h-8 px-2 text-xs"
            value={day}
            onChange={(e) => e.currentTarget.value && setDay(e.currentTarget.value)}
            aria-label="Día que se previsualiza"
            data-testid={`${testId}-day-input`}
          />
        </label>
        {hiddenIds.length > 0 && !noCards && (
          <span className="text-[var(--bo-on-surface-warning)]" data-testid={`${testId}-day-hidden`}>
            {hiddenIds.length === 1 ? "1 tarjeta oculta ese día" : `${hiddenIds.length} tarjetas ocultas ese día`}
          </span>
        )}
        {!open && (
          <button
            type="button"
            onClick={() => {
              setStep("");
              setOpen(true);
            }}
            className="bo-btn bo-btn--ghost bo-btn--sm inline-flex items-center gap-1"
            data-testid={`${testId}-reopen`}
          >
            <RotateCcw size={13} aria-hidden="true" data-testid={`${testId}-reopen-icon`} /> Mostrar de nuevo
          </button>
        )}
      </div>
    </div>
  );
}
