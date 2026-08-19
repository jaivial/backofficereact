import { useEffect, useLayoutEffect, useRef, useCallback, useState } from "react";
import { gsap } from "gsap";
import {
  ActionBarPrimitive,
  ErrorPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
  useAui,
} from "@assistant-ui/react";
import { useAtom } from "jotai";

import { ForkyChart, stripForkyChartBlocks } from "./ForkyChart";
import { repairGfmTables } from "./repairGfmTables";
import { MarkdownText } from "../assistant-ui/markdown-text";
import { ThinkingOrb } from "thinking-orbs";
import { BuiIsland, LoadingState, PromptBar } from "./bui";
import {
  CopyIcon,
  RefreshCwIcon,
  ArrowDownIcon,
  XIcon,
} from "lucide-react";

import { forkyOpenAtom } from "../../state/atoms";
import { ForkyRuntimeProvider } from "./forkyRuntime";

// ---------------------------------------------------------------------------
// beautifului.dev design language (tokens in
// components/styles/features/forky/forky-bui.css, exposed as Tailwind
// utilities: bg-fui-surface, text-fui-ink, ...). The ThinkingOrb is kept as
// the assistant identity across every state. The literal beautifului.dev
// components (ui/forky/bui/) always render inside <BuiIsland>, which scopes
// their own stylesheet (forky-bui-island.css) so neither side leaks.
// ---------------------------------------------------------------------------

const actionBtn =
  "flex size-6 items-center justify-center rounded-[6px] text-fui-ink-3 transition-colors duration-100 hover:bg-fui-hover-2 hover:text-fui-ink-2";

// ---------------------------------------------------------------------------
// Loading state while assistant is generating — the literal beautifului.dev
// LoadingState (pixel-grid loader + shimmer label + mono elapsed timer).
// ---------------------------------------------------------------------------
function AssistantLoading() {
  return (
    <div
      data-testid="forky-assistant-loading"
      className="fui-anim flex w-fit py-2"
      style={{ animation: "fui-fade-in 300ms ease-out both" }}
    >
      <BuiIsland>
        <LoadingState label="Pensando" variant="Drive" />
      </BuiIsland>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Message components (beautifului "Chat" panel patterns)
// ---------------------------------------------------------------------------
// Strip ForkyChart JSON blocks (rendered separately) and repair the GFM table
// delimiter rows MiniMax intermittently mangles, so columnar data renders as a
// real table instead of literal pipes.
const forkyPreprocess = (text: string): string =>
  repairGfmTables(stripForkyChartBlocks(text));

function AssistantMessage() {
  const [copied, setCopied] = useState(false);
  const [mounted, setMounted] = useState(false);
  const messageRef = useRef<HTMLDivElement>(null);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => () => {
    if (copyTimerRef.current !== null) clearTimeout(copyTimerRef.current);
  }, []);

  const handleCopy = useCallback(() => {
    const text = messageRef.current?.textContent;
    if (!text) return;
    void navigator.clipboard.writeText(text).catch(() => undefined);
    setCopied(true);
    if (copyTimerRef.current !== null) clearTimeout(copyTimerRef.current);
    copyTimerRef.current = setTimeout(() => setCopied(false), 2000);
  }, []);

  return (
    <MessagePrimitive.Root
      data-testid="forky-assistant-message"
      className="group/message flex w-full flex-col gap-1.5 py-2.5"
      style={{ animation: "fui-fade-up 400ms cubic-bezier(0.23,1,0.32,1) both", transformOrigin: "top left" }}
    >
      {/* ThinkingOrb avatar — the assistant identity, kept from the old UI */}
      <div className="flex items-center gap-2" style={{ height: 28 }}>
        <div className="shrink-0" style={{ transform: "scale(0.42)", transformOrigin: "left center", width: 27, height: 27 }}>
          {mounted && <ThinkingOrb state="solving" size={64} theme="auto" />}
        </div>
        <span className="text-[12px] leading-[1.3] font-medium text-fui-ink">Forky</span>
      </div>
      <div
        ref={messageRef}
        data-testid="forky-assistant-message-text"
        className="min-w-0 pl-0 text-[13px] leading-relaxed text-fui-ink [&_p]:my-0"
      >
        <MessagePrimitive.Parts components={{ Text: ({ text }: { text: string }) => (
          <>
            <ForkyChart text={text} />
            <MarkdownText preprocess={forkyPreprocess} />
          </>
        ) }} />
        {/* A failed turn (WS/session/model error) must be visible: without
            this the message stays an empty bubble and the chat looks stuck. */}
        <MessagePrimitive.Error>
          <ErrorPrimitive.Root
            data-testid="forky-message-error"
            className="mt-1 flex items-center gap-2 rounded-[8px] bg-fui-red-tint px-3 py-2 text-[13px] text-fui-red"
          >
            <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-fui-red" />
            <ErrorPrimitive.Message className="block">
              No he podido responder. Revisa la conexión y vuelve a intentarlo.
            </ErrorPrimitive.Message>
          </ErrorPrimitive.Root>
        </MessagePrimitive.Error>
      </div>
      {/* Actions — appear on hover (beautifului streaming-text action row) */}
      <div className="flex items-center gap-0.5 pl-0 opacity-0 transition-opacity duration-300 group-focus-within/message:opacity-100 group-hover/message:opacity-100 motion-reduce:transition-none">
        <button
          type="button"
          aria-label={copied ? "Copiado" : "Copiar respuesta"}
          onClick={handleCopy}
          className={actionBtn}
          style={{ border: "none" }}
        >
          {copied ? (
            <span className="text-[11px] text-fui-green">✓</span>
          ) : (
            <CopyIcon className="size-3.5" />
          )}
        </button>
        {/* Reload regenerates the assistant message; ActionBarPrimitive
            disables itself while the thread is running or when reload is
            not available for this message. */}
        <ActionBarPrimitive.Reload
          className={actionBtn}
          style={{ border: "none" }}
          aria-label="Regenerar respuesta"
          data-testid="forky-regenerate-button"
        >
          <RefreshCwIcon className="size-3.5" />
        </ActionBarPrimitive.Reload>
      </div>
    </MessagePrimitive.Root>
  );
}

function UserMessage() {
  return (
    <MessagePrimitive.Root
      data-testid="forky-user-message"
      className="fui-anim flex justify-end pl-14 py-1"
      style={{ animation: "fui-fade-up 400ms cubic-bezier(0.23,1,0.32,1) both" }}
    >
      <div
        data-testid="forky-user-message-text"
        className="rounded-xl bg-fui-field px-3 py-1.5 text-[13px] leading-[1.4] text-fui-ink"
      >
        <MessagePrimitive.Parts />
      </div>
    </MessagePrimitive.Root>
  );
}

// ---------------------------------------------------------------------------
// Empty state — breathing orb kept, greeting + suggestion chips in BUI style.
// ---------------------------------------------------------------------------
const SUGGESTIONS = [
  "¿Cuántas reservas hay hoy?",
  "Muestra el menú del día",
  "¿Qué horarios tenemos?",
];

function EmptyState() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  return (
    <div
      data-testid="forky-empty-state"
      className="flex h-full flex-col items-center justify-center gap-7 px-6 text-center"
    >
      {/* Large breathing orb */}
      {mounted && (
        <div style={{ animation: "fui-fade-in 500ms ease-out both" }}>
          <ThinkingOrb state="breathing" size={64} theme="auto" />
        </div>
      )}

      {/* Greeting */}
      <h2
        data-testid="forky-empty-title"
        className="text-xl font-medium tracking-tight text-fui-ink"
        style={{ animation: "fui-fade-up 500ms cubic-bezier(0.23,1,0.32,1) 150ms both" }}
      >
        ¿En qué puedo ayudarte?
      </h2>

      {/* Suggestion chips (beautifului pill buttons) */}
      <div className="flex flex-wrap justify-center gap-2">
        {SUGGESTIONS.map((suggestion, i) => (
          <ThreadPrimitive.Suggestion
            key={suggestion}
            prompt={suggestion}
            send
            asChild
          >
            <div
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  (e.currentTarget as HTMLElement).click();
                }
              }}
              className="cursor-pointer rounded-[8px] bg-fui-surface px-3 py-1.5 text-[12.5px] font-medium text-fui-ink-2 transition-colors duration-200 hover:bg-fui-hover hover:text-fui-ink"
              style={{
                boxShadow: "var(--fui-shadow-btn)",
                animation: `fui-fade-up 400ms cubic-bezier(0.23,1,0.32,1) ${250 + i * 70}ms both`,
              }}
            >
              {suggestion}
            </div>
          </ThreadPrimitive.Suggestion>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Composer — the literal beautifului.dev PromptBar inside a BuiIsland. Sends
// through the assistant-ui composer runtime (setText + send), which queues
// the message when a run is already in flight.
// ---------------------------------------------------------------------------
function ChatComposer() {
  const aui = useAui();

  return (
    <div data-testid="forky-composer-root" className="shrink-0 p-1.5">
      <BuiIsland>
        <PromptBar
          demo={false}
          placeholder="Pregunta lo que quieras"
          onSend={(text) => {
            aui.composer.setText(text);
            aui.composer.send();
          }}
        />
      </BuiIsland>
      <p
        data-testid="forky-composer-disclaimer"
        className="mt-2 text-center text-[11px] text-fui-ink-3"
      >
        Forky puede cometer errores. Verifica información importante.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Scroll anchor (beautifului pill with card shadow)
// ---------------------------------------------------------------------------
function ScrollToBottomButton({
  onClick,
  newCount
}: {
  onClick: () => void;
  newCount: number;
}) {
  if (newCount === 0) return null;

  return (
    <button
      type="button"
      onClick={onClick}
      className="absolute inset-x-0 bottom-24 z-20 mx-auto flex w-fit items-center gap-1.5 rounded-full bg-fui-surface px-3.5 py-1.5 text-xs text-fui-ink-2 transition-transform duration-200 hover:-translate-y-px"
      style={{ boxShadow: "var(--fui-shadow-card)", animation: "fui-fade-up 300ms cubic-bezier(0.23,1,0.32,1) both" }}
    >
      <ArrowDownIcon className="size-3 opacity-60" />
      {newCount} {newCount === 1 ? "mensaje nuevo" : "mensajes nuevos"}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Chat pane — beautifului chat panel: rounded-[14px] surface card with a
// hairline header (title + close), scrolling body and the prompt bar below.
// ---------------------------------------------------------------------------
function ChatPane({ onClose }: { onClose: () => void }) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [newMessages, setNewMessages] = useState(0);

  // Track scroll position
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = viewport;
      const atBottom = scrollHeight - scrollTop - clientHeight < 50;
      setIsAtBottom(atBottom);
      if (atBottom) setNewMessages(0);
    };

    viewport.addEventListener("scroll", handleScroll);
    return () => viewport.removeEventListener("scroll", handleScroll);
  }, []);

  // Auto-scroll on new messages if at bottom
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const observer = new MutationObserver(() => {
      if (isAtBottom) {
        viewport.scrollTo({
          top: viewport.scrollHeight,
          behavior: "smooth",
        });
      } else {
        setNewMessages((n) => n + 1);
      }
    });

    observer.observe(viewport, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [isAtBottom]);

  const scrollToBottom = useCallback(() => {
    const viewport = viewportRef.current;
    if (viewport) {
      viewport.scrollTo({ top: viewport.scrollHeight, behavior: "smooth" });
    }
    setIsAtBottom(true);
    setNewMessages(0);
  }, []);

  return (
    <div
      data-testid="forky-chat-surface"
      className="relative h-full min-h-0 w-full overflow-hidden p-0 md:p-5"
    >
      <div data-testid="forky-chat-layout" className="relative z-10 flex h-full min-h-0 w-full items-stretch justify-center">
        {/* Chat panel (beautifului surface card) */}
        <div
          data-testid="forky-chat-panel"
          className="relative flex min-h-0 w-full flex-col overflow-hidden bg-fui-surface md:w-auto md:min-w-[720px] md:max-w-4xl md:rounded-[14px]"
          style={{ boxShadow: "var(--fui-shadow-card)" }}
        >
          {/* Header — hairline bar with title and close action */}
          <div className="flex shrink-0 items-center justify-between border-b border-fui-line p-1.5">
            <div className="flex items-center gap-2 pl-1">
              <span className="text-[13px] font-semibold text-fui-ink">Forky</span>
              <span className="text-[12px] text-fui-ink-3">Asistente del restaurante</span>
            </div>
            <div className="flex items-center gap-1">
              <div
                role="button"
                tabIndex={0}
                onClick={onClose}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onClose(); }}
                data-testid="forky-close-button"
                className="flex size-6 cursor-pointer items-center justify-center rounded-[6px] text-fui-ink-3 transition-colors duration-100 hover:bg-fui-hover hover:text-fui-ink-2"
                aria-label="Cerrar asistente"
              >
                <XIcon className="size-4" />
              </div>
            </div>
          </div>

          <div
            data-testid="forky-chat-body"
            className="relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden"
          >
            <ThreadPrimitive.Root data-testid="forky-thread-root" className="flex h-full min-h-0 flex-col">
              <ThreadPrimitive.Viewport
                ref={viewportRef}
                data-testid="forky-thread-viewport"
                className="min-h-0 flex-1 overflow-y-auto px-3 pt-2.5 pb-1"
              >
                <ThreadPrimitive.Empty>
                  <EmptyState />
                </ThreadPrimitive.Empty>
                <div data-testid="forky-messages-container" className="flex flex-col gap-2.5">
                  <ThreadPrimitive.Messages
                    components={{ AssistantMessage, UserMessage }}
                  />
                </div>
                <ThreadPrimitive.If running>
                  <AssistantLoading />
                </ThreadPrimitive.If>
              </ThreadPrimitive.Viewport>

              {/* Scroll to bottom indicator */}
              {!isAtBottom && newMessages > 0 && (
                <ScrollToBottomButton onClick={scrollToBottom} newCount={newMessages} />
              )}

              <ChatComposer />
            </ThreadPrimitive.Root>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Modal
// ---------------------------------------------------------------------------
export function ForkyModal() {
  const [open, setOpen] = useAtom(forkyOpenAtom);
  const overlayRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!open || !overlayRef.current) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        overlayRef.current,
        { opacity: 0 },
        { opacity: 1, duration: 0.3, ease: "power2.out" }
      );
      gsap.fromTo(
        "[data-testid='forky-chat-surface']",
        { opacity: 0, y: 24, scale: 0.96 },
        { opacity: 1, y: 0, scale: 1, duration: 0.4, ease: "power3.out", delay: 0.05 }
      );
    }, overlayRef);
    return () => ctx.revert();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const overlay = overlayRef.current;
    // Focus the composer on open so the user can start typing immediately.
    if (overlay) {
      const composer = overlay.querySelector<HTMLElement>("textarea");
      (composer ?? overlay.querySelector<HTMLElement>("button"))?.focus();
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        // The first Escape only closes an open @ // or model menu inside the
        // PromptBar (its menus render with shadow-raised); the modal closes on
        // the next one.
        if (overlayRef.current?.querySelector(".bui-scope .shadow-raised")) return;
        event.stopPropagation();
        setOpen(false);
        return;
      }
      if (event.key !== "Tab") return;
      const overlay = overlayRef.current;
      if (!overlay) return;
      const focusables = () =>
        Array.from(
          overlay.querySelectorAll<HTMLElement>(
            'button, textarea, input, select, a[href], [tabindex]:not([tabindex="-1"])'
          )
        ).filter((el) => !el.hasAttribute("disabled"));
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
    document.addEventListener("keydown", onKeyDown, true);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.body.style.overflow = "";
    };
  }, [open, setOpen]);

  if (!open) return null;

  const handleBackgroundClick = (e: React.MouseEvent) => {
    // Only close if clicking directly on the background, not on children
    if (e.target === e.currentTarget) {
      setOpen(false);
    }
  };

  return (
    <div
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-label="Asistente Forky"
      data-testid="forky-modal"
      className="fixed inset-0 z-[200] h-[100dvh] w-screen bg-slate-900/60 backdrop-blur-md dark:bg-slate-950/95"
      onClick={handleBackgroundClick}
    >
      <ForkyRuntimeProvider>
        <ChatPane onClose={() => setOpen(false)} />
      </ForkyRuntimeProvider>
    </div>
  );
}
