// Hairline UI · chat-notice · MIT License
// Vendored from Hairline UI (https://hairlineui.com/ui), copy translated to Spanish for the campaign builder chat (campaign_html_builder_ai_v1).
// Copyright (c) 2026 Hairline UI · https://hairlineui.com/license#components

"use client";

import * as React from "react";
import { AlertCircle, ChevronDown, Hourglass, Layers, RotateCcw, WifiOff } from "lucide-react";
import { NumberRoll } from "./number-roll";
import { StatusButton } from "./status-button";
import { TextMorph } from "./text-morph";

/* ─────────────────────────────────────────────────────────
 * CHAT NOTICE: the moments an AI app has to say no
 *
 *   error       the answer failed; Retry opens a spinner and
 *               morphs to "Retrying" while it runs
 *   offline     no connection; "Reconnecting" opens in
 *   rate-limit  out of messages; the countdown rolls down to
 *               the reset, then the hourglass blurs into a check
 *               that draws itself and the words morph to "You can
 *               send messages again"
 *   context     the chat is too long; start fresh with a summary
 *
 * Calm, inline and specific: what happened, what happens next,
 * and the one action that helps. Technical details fold away.
 * ───────────────────────────────────────────────────────── */

export type ChatNoticeKind = "error" | "offline" | "rate-limit" | "context";

export interface ChatNoticeProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  kind: ChatNoticeKind;
  title?: string;
  description?: string;
  /** Rate limit: when sending is allowed again (ms). Shows a live countdown. */
  resetAt?: number;
  onReset?: () => void;
  onRetry?: () => void;
  /** Shows a spinner on Retry, or "Reconnecting" when offline. */
  retrying?: boolean;
  onUpgrade?: () => void;
  upgradeLabel?: string;
  /** Context: start a new chat carrying a summary of this one. */
  onSummarize?: () => void;
  onNewChat?: () => void;
  /** Technical details, e.g. an error message or request ID. */
  details?: string;
}

const MORPH = "cubic-bezier(0.16,1,0.3,1)";
const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40";
const BUTTON = `inline-flex h-7 items-center gap-1.5 rounded-full px-3 text-[12px] font-medium transition-[background-color,color,transform] duration-300 active:scale-[0.97] ${FOCUS}`;
const SECONDARY = `cursor-pointer ${BUTTON} text-foreground shadow-[inset_0_0_0_1px_var(--border)] hover:bg-accent`;
const PRIMARY = `cursor-pointer ${BUTTON} bg-primary text-primary-foreground hover:bg-primary/90`;
const TWO_DIGITS = { minimumIntegerDigits: 2 };

const reducedQuery = "(prefers-reduced-motion: reduce)";
const subscribeReduced = (onChange: () => void) => {
  const query = window.matchMedia(reducedQuery);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
};
const useReducedMotion = () =>
  React.useSyncExternalStore(subscribeReduced, () => window.matchMedia(reducedQuery).matches, () => false);

/** Icons trade places through a blur: the old one shrinks away as the new one grows in. */
const swap = (on: boolean, reduced: boolean): React.CSSProperties => ({
  opacity: on ? 1 : 0,
  transform: on ? "none" : "scale(0.6)",
  filter: on ? "none" : "blur(3px)",
  transition: reduced ? "none" : `opacity 260ms ${MORPH}, transform 380ms ${MORPH}, filter 260ms ${MORPH}`,
});

/** A piece of a line that opens out of nothing and folds back into it. */
function Reveal({ show, reduced, className = "", children, id }: { show: boolean; reduced: boolean; className?: string; children: React.ReactNode; id: string }) {
  return (
    <span
      aria-hidden={!show || undefined}
      className={`inline-grid align-bottom ${className}`}
      data-testid={id}
      style={{
        gridTemplateColumns: show ? "1fr" : "0fr",
        opacity: show ? 1 : 0,
        filter: show ? "none" : "blur(3px)",
        transition: reduced ? "none" : `grid-template-columns 460ms ${MORPH}, opacity ${show ? "320ms" : "160ms"} ${MORPH}, filter 320ms ${MORPH}`,
      }}
    >
      <span className="min-w-0 whitespace-nowrap [clip-path:inset(-4px_-2px)]" data-testid={`${id}-clip`}>{children}</span>
    </span>
  );
}

function useCountdown(resetAt: number | undefined, onReset?: () => void) {
  // Unknown until mounted, so the first paint never claims the limit has already reset.
  const [now, setNow] = React.useState<number | null>(null);
  const fired = React.useRef(false);
  React.useEffect(() => {
    if (resetAt === undefined) return;
    fired.current = false;
    const tick = () => {
      const t = Date.now();
      setNow(t);
      if (t >= resetAt && !fired.current) {
        fired.current = true;
        onReset?.();
      }
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [resetAt, onReset]);
  return resetAt === undefined || now === null ? undefined : Math.max(0, resetAt - now);
}

/** "4:59" rolling down a second at a time ("1h 05m" when it's over an hour); seconds roll back 00 → 59 like a clock. */
function Countdown({ ms, reduced, id }: { ms: number; reduced: boolean; id: string }) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const hours = Math.floor(s / 3600);
  const minutes = hours ? Math.floor((s % 3600) / 60) : Math.floor(s / 60);
  return (
    <span className="inline-flex items-baseline tabular-nums" data-testid={id}>
      <Reveal show={hours > 0} reduced={reduced} id={`${id}-hours-fold`}>
        <NumberRoll value={hours} suffix="h" duration={600} data-testid={`${id}-hours`} />
        &nbsp;
      </Reveal>
      <NumberRoll value={minutes} suffix={hours ? "m" : ""} format={hours ? TWO_DIGITS : undefined} direction="down" duration={600} data-testid={`${id}-minutes`} />
      <Reveal show={!hours} reduced={reduced} id={`${id}-seconds-fold`}>
        :<NumberRoll value={s % 60} format={TWO_DIGITS} direction="down" duration={600} data-testid={`${id}-seconds`} />
      </Reveal>
    </span>
  );
}

export function ChatNotice({
  kind,
  title,
  description,
  resetAt,
  onReset,
  onRetry,
  retrying = false,
  onUpgrade,
  upgradeLabel = "Mejorar plan",
  onSummarize,
  onNewChat,
  details,
  className = "",
  ...props
}: ChatNoticeProps) {
  const reduced = useReducedMotion();
  const left = useCountdown(kind === "rate-limit" ? resetAt : undefined, onReset);
  const ready = left === 0;
  const [detailsOpen, setDetailsOpen] = React.useState(false);
  const detailsId = React.useId();
  const counting = kind === "rate-limit" && description === undefined && resetAt !== undefined && !ready;

  const preset = {
    error: {
      title: "Algo ha fallado",
      description: "La respuesta no ha terminado. Tu mensaje está a salvo.",
    },
    offline: {
      title: "Sin conexión",
      description: "Seguiremos donde lo dejaste cuando vuelva la conexión.",
    },
    "rate-limit": {
      title: ready ? "Ya puedes volver a escribir" : "Has alcanzado el límite",
      description: ready ? "El límite se ha restablecido." : resetAt !== undefined ? "Se restablece en" : "Se restablecerá pronto.",
    },
    context: {
      title: "La conversación es muy larga",
      description: "Los mensajes antiguos pueden olvidarse. Empieza de nuevo para mantener las respuestas precisas.",
    },
  }[kind];

  const iconKey = kind === "rate-limit" && ready ? "ready" : kind;
  const id = (props as { "data-testid"?: string })["data-testid"] ?? "hl-chat-notice";
  const icons: Record<string, React.ReactNode> = {
    error: <AlertCircle className="size-4 text-red-500" data-testid={`${id}-icon-error`} />,
    offline: <WifiOff className="size-4 text-muted-foreground" data-testid={`${id}-icon-offline`} />,
    "rate-limit": <Hourglass className="size-4 text-amber-500" data-testid={`${id}-icon-rate-limit`} />,
    ready: (
      <svg viewBox="0 0 16 16" fill="none" className="size-4 text-emerald-600 dark:text-emerald-400" data-testid={`${id}-icon-ready`}>
        <path
          d="M3.5 8.5 6.5 11.5 12.5 4.5"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          pathLength={1}
          strokeDasharray={1}
          style={{ strokeDashoffset: iconKey === "ready" ? 0 : 1, transition: iconKey === "ready" && !reduced ? `stroke-dashoffset 420ms ${MORPH} 140ms` : "none" }}
        />
      </svg>
    ),
    context: <Layers className="size-4 text-muted-foreground" data-testid={`${id}-icon-context`} />,
  };
  const shownIcons = kind === "rate-limit" ? ["rate-limit", "ready"] : [kind];
  const resetsAt = resetAt !== undefined && left !== undefined ? new Date(resetAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : undefined;

  return (
    // Laid out by its own width, not the screen's, so it reads right in a narrow column too.
    <div className="w-full" data-testid={`${id}-outer`}>
      {/* Its natural width where the parent sizes to its content, without forcing it on narrow screens. */}
      <div aria-hidden="true" data-natural-width className="grid h-0" style={{ gridTemplateColumns: "minmax(0, 560px)" }} data-testid={`${id}-sizer`} />
      <div className="@container w-full" data-testid={`${id}-container`}>
        <div
          role={kind === "error" ? "alert" : "status"}
          className={`flex flex-col gap-3 rounded-xl border border-border bg-background px-3.5 py-3 animate-[ui-fade-up_320ms_cubic-bezier(0.23,1,0.32,1)_both] motion-reduce:animate-none @[36rem]:flex-row @[36rem]:items-start ${className}`}
          data-testid={id}
          {...props}
        >
          <div className="flex min-w-0 flex-1 gap-3" data-testid={`${id}-main`}>
            <span aria-hidden="true" className="relative mt-0.5 flex size-4 shrink-0" data-testid={`${id}-icons`}>
              {shownIcons.map((k) => (
                <span key={k} className="absolute inset-0 flex items-center justify-center" style={swap(k === iconKey, reduced)} data-testid={`${id}-icon-slot-${k}`}>
                  {icons[k]}
                </span>
              ))}
            </span>
            <div className="min-w-0" data-testid={`${id}-texts`}>
              <p className="text-[13px] font-medium leading-5 text-foreground" data-testid={`${id}-title`}>
                <TextMorph animateWidth={false} data-testid={`${id}-title-text`}>{title ?? preset.title}</TextMorph>
              </p>
              <p className="text-[12.5px] leading-5 text-muted-foreground" data-testid={`${id}-description`}>
                <TextMorph animateWidth={false} data-testid={`${id}-description-text`}>{description ?? preset.description}</TextMorph>
                {kind === "rate-limit" && description === undefined && resetAt !== undefined && (
                  // The ticking digits are hidden from screen readers (the notice is a live region); they hear the time it resets instead.
                  <Reveal show={counting && left !== undefined} reduced={reduced} id={`${id}-countdown-fold`}>
                    <span aria-hidden="true" data-testid={`${id}-countdown-text`}>
                      &nbsp;
                      {left !== undefined && <Countdown ms={left} reduced={reduced} id={`${id}-countdown`} />}.
                    </span>
                    {resetsAt && counting && <span className="sr-only" data-testid={`${id}-countdown-sr`}> at {resetsAt}</span>}
                  </Reveal>
                )}
                {kind === "offline" && (
                  <Reveal show={retrying} reduced={reduced} id={`${id}-reconnecting-fold`}>
                    <span className="ml-1.5 inline-flex items-center gap-1.5 text-foreground/70" data-testid={`${id}-reconnecting`}>
                      <span
                        aria-hidden="true"
                        data-testid={`${id}-reconnecting-dot`}
                        className={`size-1.5 rounded-full bg-amber-500 motion-reduce:animate-none ${retrying ? "animate-[ui-breathe_1.4s_ease-in-out_infinite]" : ""}`}
                      />
                      Reconnecting
                    </span>
                  </Reveal>
                )}
              </p>
              {details && (
                <>
                  <button
                    type="button"
                    aria-expanded={detailsOpen}
                    aria-controls={detailsId}
                    onClick={() => setDetailsOpen((o) => !o)}
                    className={`cursor-pointer mt-1.5 flex items-center gap-1 rounded text-[11.5px] text-muted-foreground transition-colors hover:text-foreground ${FOCUS}`}
                    data-testid={`${id}-details-toggle`}
                  >
                    <TextMorph data-testid={`${id}-details-toggle-label`}>{detailsOpen ? "Ocultar detalles" : "Ver detalles"}</TextMorph>
                    <ChevronDown
                      data-testid={`${id}-details-toggle-icon`}
                      aria-hidden="true"
                      className="size-3 transition-transform duration-300 motion-reduce:transition-none"
                      style={{ transform: detailsOpen ? "rotate(180deg)" : "none", transitionTimingFunction: MORPH }}
                    />
                  </button>
                  <div
                    id={detailsId}
                    inert={!detailsOpen}
                    className="grid"
                    style={{
                      gridTemplateRows: detailsOpen ? "1fr" : "0fr",
                      opacity: detailsOpen ? 1 : 0,
                      transition: reduced ? "none" : `grid-template-rows 420ms ${MORPH}, opacity ${detailsOpen ? "320ms" : "160ms"} ${MORPH}`,
                    }}
                    data-testid={`${id}-details-fold`}
                  >
                    <div className="min-h-0 overflow-hidden" data-testid={`${id}-details-clip`}>
                      <p className="pt-1 break-all font-mono text-[11px] leading-5 text-muted-foreground" data-testid={`${id}-details`}>{details}</p>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2 pl-7 @[36rem]:pl-0" data-testid={`${id}-actions`}>
            {(kind === "error" || kind === "offline") && onRetry && (
              <StatusButton
                variant="outline"
                size="sm"
                icon={<RotateCcw data-testid={`${id}-retry-icon`} />}
                status={retrying ? "pending" : "idle"}
                labels={kind === "offline" ? { idle: "Probar ahora", pending: "Probando" } : { idle: "Reintentar", pending: "Reintentando" }}
                data-testid={`${id}-retry`}
                onClick={onRetry}
              />
            )}
            {kind === "rate-limit" && onUpgrade && (
              // Folds away once the limit has reset.
              <Reveal show={!ready} reduced={reduced} id={`${id}-upgrade-fold`}>
                <span className="block p-0.5" data-testid={`${id}-upgrade-pad`}>
                  <button type="button" inert={ready} onClick={onUpgrade} className={PRIMARY} data-testid={`${id}-upgrade`}>
                    {upgradeLabel}
                  </button>
                </span>
              </Reveal>
            )}
            {kind === "context" && onNewChat && (
              <button type="button" onClick={onNewChat} className={SECONDARY} data-testid={`${id}-new-chat`}>
                New chat
              </button>
            )}
            {kind === "context" && onSummarize && (
              <button type="button" onClick={onSummarize} className={PRIMARY} data-testid={`${id}-summarize`}>
                Continue with summary
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
