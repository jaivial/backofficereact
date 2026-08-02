import { lazy, Suspense, useEffect, useLayoutEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import {
  ComposerPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
} from "@assistant-ui/react";
import { MarkdownTextPrimitive } from "@assistant-ui/react-markdown";
import { useAtom } from "jotai";

import { forkyOpenAtom } from "../../state/atoms";
import type { ForkyState } from "./Forky3DViewer";
import { ForkyRuntimeProvider } from "./forkyRuntime";
import { useForkyVisualState } from "./forkyStatus";

// three.js only loads when the modal opens (kept out of the main bundle).
const Forky3DViewer = lazy(() =>
  import("./Forky3DViewer").then((m) => ({ default: m.Forky3DViewer }))
);

function ForkyMarkdownText() {
  return <MarkdownTextPrimitive />;
}

function AssistantMessage() {
  return (
    <MessagePrimitive.Root className="flex max-w-[85%] items-end gap-2.5">
      <img
        src="/assets/forky/forky-preview.png"
        alt=""
        className="h-8 w-8 shrink-0 rounded-full object-cover"
      />
      <div className="rounded-2xl rounded-bl-sm border border-white/10 bg-white/[0.07] px-3.5 py-2.5 text-[13.5px] leading-relaxed text-[var(--bo-ink)]">
        <MessagePrimitive.Parts components={{ Text: ForkyMarkdownText }} />
      </div>
    </MessagePrimitive.Root>
  );
}

function UserMessage() {
  return (
    <MessagePrimitive.Root className="flex max-w-[85%] items-end justify-end gap-2.5 self-end">
      <div className="rounded-2xl rounded-br-sm bg-[var(--bo-accent)]/85 px-3.5 py-2.5 text-[13.5px] leading-relaxed text-white">
        <MessagePrimitive.Parts />
      </div>
    </MessagePrimitive.Root>
  );
}

function ChatPane({ onClose }: { onClose: () => void }) {
  const visualState = useForkyVisualState();
  const [greeting, setGreeting] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setGreeting(false), 1600);
    return () => clearTimeout(timer);
  }, []);

  const forkyState: ForkyState = greeting ? "greet" : visualState;

  return (
    <div className="relative h-full min-h-0 w-full overflow-hidden p-3 sm:p-5" data-testid="forky-chat-surface">
      <div
        data-testid="forky-floating-model"
        className="pointer-events-none absolute bottom-2 right-2 z-20 h-[42vh] w-[min(42vw,26rem)] min-w-44 sm:bottom-5 sm:right-5 sm:h-[58vh] sm:w-[min(44vw,32rem)]"
      >
        <Suspense fallback={null}>
          <Forky3DViewer state={forkyState} />
        </Suspense>
      </div>
      <div className="relative z-10 grid h-full min-h-0 w-full grid-rows-[minmax(0,1fr)] md:grid-cols-[minmax(0,1fr)_minmax(22rem,38rem)]">
        <div className="hidden min-h-0 md:block" aria-hidden="true" />
        <div className="flex min-h-0 flex-col overflow-hidden rounded-[2rem] border border-white/15 bg-[#110d1d]/75 shadow-[0_24px_90px_rgba(8,4,20,0.52)] backdrop-blur-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5">
          <div className="flex items-center gap-2.5">
            <img
              src="/assets/forky/forky-preview.png"
              alt=""
              className="h-8 w-8 rounded-full object-cover"
            />
            <div>
              <p className="text-sm font-semibold text-[var(--bo-ink)]">Forky</p>
              <p className="text-[11px] text-[var(--bo-muted)]">Asistente de Villa Carmen</p>
            </div>
          </div>
          <button
            type="button"
            data-testid="forky-close"
            aria-label="Cerrar asistente"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--bo-muted)] transition-colors hover:bg-white/10 hover:text-[var(--bo-ink)] focus-visible:outline-2 focus-visible:outline-[var(--bo-accent)]"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5"
              aria-hidden="true"
            >
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <div data-testid="forky-composer" className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <ThreadPrimitive.Root className="flex h-full min-h-0 flex-col">
            <ThreadPrimitive.Viewport className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
              <ThreadPrimitive.Empty>
                <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
                  <img
                    src="/assets/forky/forky-preview.png"
                    alt=""
                    className="h-16 w-16 rounded-full object-cover opacity-90"
                  />
                  <p className="text-sm font-medium text-[var(--bo-ink)]">
                    ¡Hola! Soy Forky, tu asistente.
                  </p>
                  <p className="max-w-xs text-xs text-[var(--bo-muted)]">
                    Pregúntame sobre el restaurante, reservas, horarios o lo que necesites.
                  </p>
                </div>
              </ThreadPrimitive.Empty>
              <div className="flex flex-col gap-3">
                <ThreadPrimitive.Messages
                  components={{ AssistantMessage, UserMessage }}
                />
              </div>
            </ThreadPrimitive.Viewport>

            <ComposerPrimitive.Root className="border-t border-white/10 px-3 py-2.5">
              <div className="flex items-end gap-2">
                <ComposerPrimitive.Input
                  data-testid="forky-composer-input"
                  rows={2}
                  placeholder="Escribe un mensaje…"
                  className="max-h-40 min-h-11 flex-1 resize-none rounded-xl border border-white/10 bg-black/25 px-3.5 py-2.5 text-sm text-[var(--bo-ink)] placeholder:text-[var(--bo-faint)] focus:border-[var(--bo-accent)] focus:outline-none"
                />
                <ComposerPrimitive.Send
                  asChild
                  className="flex h-11 items-center justify-center rounded-xl bg-[var(--bo-accent)] px-4 text-white transition-opacity hover:opacity-90 disabled:opacity-40"
                >
                  <button type="button" aria-label="Enviar mensaje">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-5 w-5"
                      aria-hidden="true"
                    >
                      <path d="M12 19V5M5 12l7-7 7 7" />
                    </svg>
                  </button>
                </ComposerPrimitive.Send>
              </div>
            </ComposerPrimitive.Root>
          </ThreadPrimitive.Root>
        </div>
      </div>
    </div>
    </div>
  );
}

/**
 * Full-viewport assistant modal (100dvh): Forky 3D viewer + assistant-ui chat.
 * Opens/closes via forkyOpenAtom; Esc closes; focus is trapped inside.
 */
export function ForkyModal() {
  const [open, setOpen] = useAtom(forkyOpenAtom);
  const overlayRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!open || !overlayRef.current) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(overlayRef.current, { opacity: 0 }, { opacity: 1, duration: 0.28, ease: "power2.out" });
      gsap.fromTo("[data-testid='forky-chat-surface']", { opacity: 0, y: 18, scale: 0.985 }, { opacity: 1, y: 0, scale: 1, duration: 0.42, ease: "power3.out", delay: 0.04 });
      gsap.fromTo("[data-testid='forky-floating-model']", { opacity: 0, x: 22, y: 24, scale: 0.92 }, { opacity: 1, x: 0, y: 0, scale: 1, duration: 0.5, ease: "back.out(1.3)", delay: 0.08 });
    }, overlayRef);
    return () => ctx.revert();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener("keydown", onKeyDown, true);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.body.style.overflow = "";
    };
  }, [open, setOpen]);

  useEffect(() => {
    if (!open) return;
    const overlay = overlayRef.current;
    if (!overlay) return;
    const focusables = () =>
      Array.from(
        overlay.querySelectorAll<HTMLElement>(
          'button, textarea, input, select, a[href], [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => !el.hasAttribute("disabled"));
    const first = focusables()[0];
    const composer = overlay.querySelector<HTMLElement>('[data-testid="forky-composer-input"]');
    (composer ?? first)?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const items = focusables();
      if (items.length === 0) return;
      const firstEl = items[0];
      const lastEl = items[items.length - 1];
      if (event.shiftKey && document.activeElement === firstEl) {
        event.preventDefault();
        lastEl.focus();
      } else if (!event.shiftKey && document.activeElement === lastEl) {
        event.preventDefault();
        firstEl.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-label="Asistente Forky"
      data-testid="forky-modal"
      className="fixed inset-0 z-[100] h-[100dvh] w-screen bg-[#0b0b12]/90 backdrop-blur-sm"
    >
      <ForkyRuntimeProvider>
        <ChatPane onClose={() => setOpen(false)} />
      </ForkyRuntimeProvider>
    </div>
  );
}
