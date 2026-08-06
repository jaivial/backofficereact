import { useEffect, useLayoutEffect, useRef, useCallback, useState } from "react";
import { gsap } from "gsap";
import {
  ComposerPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
} from "@assistant-ui/react";
import { MarkdownTextPrimitive } from "@assistant-ui/react-markdown";
import { useAtom } from "jotai";
import { ThinkingOrb } from "thinking-orbs";
import { 
  ArrowUpIcon, 
  CopyIcon,
  RefreshCwIcon,
  ArrowDownIcon,
  XIcon,
} from "lucide-react";

import { forkyOpenAtom } from "../../state/atoms";
import { ForkyRuntimeProvider } from "./forkyRuntime";
import { useForkyVisualState, type ForkyVisualState } from "./forkyStatus";
import type { OrbState } from "thinking-orbs";

// ---------------------------------------------------------------------------
// Surface utilities (assistant-ui/elements default style)
// ---------------------------------------------------------------------------
const paper = "bg-foreground/[0.04]";
const floating = "bg-popover shadow-lg shadow-black/10 border border-foreground/[0.08]";
const ghostButton = "flex items-center justify-center rounded-lg text-white/35 transition-colors hover:bg-white/[0.06] hover:text-white/55";
const mono = "font-mono text-[0.85em]";

// ---------------------------------------------------------------------------
// State mapping
// ---------------------------------------------------------------------------
function mapVisualStateToOrbState(state: ForkyVisualState): OrbState {
  switch (state) {
    case "think": return "working";
    case "talk": return "composing";
    case "greet":
    case "happy": return "shaping";
    case "bend_active": return "listening";
    case "idle":
    default: return "breathing";
  }
}

// ---------------------------------------------------------------------------
// Typing Indicator (assistant-ui/elements/typing-indicator)
// ---------------------------------------------------------------------------
const DOT_DELAYS = ["-0.32s", "-0.16s", "0s"];

function TypingIndicator({ variant = "bubble", className }: { variant?: "bubble" | "bare"; className?: string }) {
  const dots = (
    <div
      role="status"
      aria-label="Forky está escribiendo"
      className={`flex gap-1 ${variant === "bare" ? className ?? "" : ""}`}
    >
      {DOT_DELAYS.map((delay) => (
        <span
          key={delay}
          aria-hidden
          className="size-1.5 animate-bounce rounded-full bg-foreground/40 motion-reduce:animate-none"
          style={{ animationDelay: delay, animationDuration: "1.1s" }}
        />
      ))}
    </div>
  );

  if (variant === "bare") return dots;

  return (
    <div className={`${paper} w-fit rounded-full px-4 py-3.5 ${className ?? ""}`}>
      {dots}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Thinking Indicator (assistant-ui/elements/thinking-indicator)
// ---------------------------------------------------------------------------
function ThinkingIndicator({ label, elapsed, className }: { label: string; elapsed?: string; className?: string }) {
  return (
    <div className={`flex items-center gap-2.5 text-sm text-foreground/55 ${className ?? ""}`}>
      <span
        aria-hidden
        className="size-1.5 shrink-0 animate-pulse rounded-full bg-blue-500 motion-reduce:animate-none dark:bg-blue-400"
      />
      <span
        key={label}
        className="animate-in fade-in slide-in-from-bottom-1 relative inline-block leading-none duration-300"
      >
        <span>{label}</span>
        <span
          aria-hidden
          className="shimmer pointer-events-none absolute inset-0 motion-reduce:animate-none"
        >
          {label}
        </span>
      </span>
      {elapsed !== undefined && (
        <span className={`${mono} text-foreground/30 tabular-nums`}>
          {elapsed}
        </span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Loading state while assistant is generating
// ---------------------------------------------------------------------------
function AssistantLoading() {
  const [elapsed, setElapsed] = useState(0);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed((e) => e + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const elapsedStr = elapsed > 0 ? `${elapsed}s` : undefined;

  return (
    <div 
      data-testid="forky-assistant-loading" 
      className="animate-in fade-in py-4"
    >
      <ThinkingIndicator label="Pensando..." elapsed={elapsedStr} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Message Components (assistant-ui/elements/message-pair style)
// ---------------------------------------------------------------------------
function ForkyMarkdownText() {
  return <MarkdownTextPrimitive />;
}

function AssistantMessage() {
  const [copied, setCopied] = useState(false);
  const [mounted, setMounted] = useState(false);
  const messageRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  const handleCopy = useCallback(() => {
    const text = messageRef.current?.textContent;
    if (text) {
      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, []);

  return (
    <MessagePrimitive.Root 
      data-testid="forky-assistant-message"
      className="group/message flex gap-3 py-4"
    >
      {/* ThinkingOrb avatar */}
      <div className="mt-1 shrink-0" style={{ transform: "scale(0.7)", transformOrigin: "top left", width: 45, height: 45 }}>
        {mounted && <ThinkingOrb state="solving" size={64} theme="auto" />}
      </div>
      <div className="min-w-0 flex-1">
        <div 
          ref={messageRef}
          data-testid="forky-assistant-message-text" 
          className="text-sm leading-relaxed text-slate-800 [&_p]:my-0 dark:text-slate-100"
        >
          <MessagePrimitive.Parts components={{ Text: ForkyMarkdownText }} />
        </div>
        {/* Actions - appear on hover */}
        <div className="flex items-center gap-1 pt-2 opacity-0 transition-opacity group-focus-within/message:opacity-100 group-hover/message:opacity-100 motion-reduce:transition-none">
          <button
            type="button"
            aria-label={copied ? "Copiado" : "Copiar respuesta"}
            onClick={handleCopy}
            className="flex size-7 items-center justify-center rounded-lg bg-slate-900/5 text-slate-500 backdrop-blur-sm transition-colors hover:bg-slate-900/10 hover:text-slate-800 dark:bg-white/[0.06] dark:text-white/50 dark:hover:bg-white/[0.1] dark:hover:text-white/70"
            style={{ border: "none" }}
          >
            {copied ? (
              <span className="text-[10px] text-emerald-500">✓</span>
            ) : (
              <CopyIcon className="size-3.5" />
            )}
          </button>
          <button
            type="button"
            aria-label="Regenerar respuesta"
            className="flex size-7 items-center justify-center rounded-lg bg-slate-900/5 text-slate-500 backdrop-blur-sm transition-colors hover:bg-slate-900/10 hover:text-slate-800 dark:bg-white/[0.06] dark:text-white/50 dark:hover:bg-white/[0.1] dark:hover:text-white/70"
            style={{ border: "none" }}
          >
            <RefreshCwIcon className="size-3.5" />
          </button>
        </div>
      </div>
    </MessagePrimitive.Root>
  );
}

function UserMessage() {
  return (
    <MessagePrimitive.Root 
      data-testid="forky-user-message"
      className="flex w-full flex-col gap-5 py-4"
    >
      <div
        data-testid="forky-user-message-text" 
        className={`${paper} max-w-[85%] self-end rounded-2xl px-3.5 py-2 text-sm text-slate-800 dark:text-white/90`}
      >
        <MessagePrimitive.Parts />
      </div>
    </MessagePrimitive.Root>
  );
}

// ---------------------------------------------------------------------------
// Empty State (inspired by assistant-ui/elements/empty-state)
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
      className="flex h-full flex-col items-center justify-center gap-8 px-6 text-center"
    >
      {/* Large breathing orb */}
      {mounted && (
        <div className="animate-in fade-in zoom-in-95 duration-500">
          <ThinkingOrb state="breathing" size={64} theme="auto" />
        </div>
      )}

      {/* Greeting */}
      <h2 
        data-testid="forky-empty-title"
        className="animate-in fade-in slide-in-from-bottom-1 fill-mode-both text-2xl font-light tracking-tight text-slate-900 duration-500 dark:text-white/90 motion-reduce:animate-none"
        style={{ animationDelay: "150ms" }}
      >
        ¿En qué puedo ayudarte?
      </h2>

      {/* Suggestion chips - clickable to start conversation */}
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
              className="animate-in fade-in slide-in-from-bottom-2 fill-mode-both cursor-pointer rounded-full border border-slate-200 bg-white px-4 py-2 text-[13px] text-slate-600 shadow-sm transition-colors duration-500 hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:shadow-none dark:hover:border-white/20 dark:hover:bg-white/10 dark:hover:text-white motion-reduce:animate-none"
              style={{ animationDelay: `${250 + i * 70}ms` }}
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
// Composer - assistant-ui style
// ---------------------------------------------------------------------------
function ChatComposer() {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleInput = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
  }, []);

  // Handle Enter to send, Shift+Enter for new line
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      // Find and click the send button
      const form = e.currentTarget.closest("form");
      const sendButton = form?.querySelector<HTMLButtonElement>('[data-testid="forky-composer-send"]');
      if (sendButton && !sendButton.disabled) {
        sendButton.click();
      }
    }
  }, []);

  return (
    <ComposerPrimitive.Root 
      data-testid="forky-composer-root"
      className="px-3 pb-4 pt-2 md:px-4"
      onSubmit={(e) => e.preventDefault()}
    >
      <div 
        data-testid="forky-composer-row" 
        className={`${paper} relative mx-auto flex w-full max-w-3xl flex-col gap-2 rounded-[24px] p-2.5`}
      >
        <ComposerPrimitive.Input
          ref={textareaRef}
          data-testid="forky-composer-input"
          rows={1}
          placeholder="Pregunta lo que quieras"
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          className="min-h-11 w-full resize-none bg-transparent px-3 text-[15px] text-slate-900 caret-violet-500 placeholder:text-slate-400 focus:outline-none dark:text-white/90 dark:caret-violet-400 dark:placeholder:text-white/35"
          style={{ border: "none", outline: "none", boxShadow: "none" }}
        />
        <div className="flex items-center justify-end px-1">
          <ComposerPrimitive.Send asChild>
            <button
              type="button"
              data-testid="forky-composer-send"
              aria-label="Enviar mensaje"
              className="grid size-8 place-items-center rounded-full bg-violet-600 text-white transition-colors hover:bg-violet-700 disabled:bg-violet-300 disabled:text-white/60 dark:bg-white/[0.06] dark:text-white/30 dark:hover:bg-white/[0.09] dark:hover:text-white/50 dark:disabled:bg-white/[0.04] dark:disabled:text-white/20 dark:[&:not(:disabled)]:bg-white/90 dark:[&:not(:disabled)]:text-slate-900"
              style={{ border: "none" }}
            >
              <ArrowUpIcon className="size-4" strokeWidth={2} />
            </button>
          </ComposerPrimitive.Send>
        </div>
      </div>
      <p 
        data-testid="forky-composer-disclaimer" 
        className="mx-auto mt-2 max-w-3xl text-center text-[11px] text-slate-400 dark:text-white/20"
      >
        Forky puede cometer errores. Verifica información importante.
      </p>
    </ComposerPrimitive.Root>
  );
}

// ---------------------------------------------------------------------------
// Scroll Anchor (inspired by assistant-ui/elements/scroll-anchor)
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
      className={`${floating} animate-in fade-in slide-in-from-bottom-2 absolute inset-x-0 bottom-20 z-20 mx-auto flex w-fit items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs text-slate-600 shadow-slate-300/30 transition-transform duration-200 hover:-translate-y-px dark:text-slate-200 dark:shadow-black/10`}
    >
      <ArrowDownIcon className="size-3 opacity-60" />
      {newCount} {newCount === 1 ? "mensaje nuevo" : "mensajes nuevos"}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Chat Pane
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
        {/* Chat panel */}
        <div 
          data-testid="forky-chat-panel" 
          className="relative flex min-h-0 w-full flex-col overflow-hidden bg-gradient-to-b from-white to-slate-100 backdrop-blur-xl md:w-auto md:min-w-[768px] md:max-w-4xl md:rounded-3xl md:border md:border-slate-200/80 md:shadow-2xl md:shadow-slate-300/50 dark:from-slate-900/95 dark:to-slate-950/95 dark:md:border-white/10 dark:md:shadow-black/50"
        >
          {/* Close button */}
          <div
            role="button"
            tabIndex={0}
            onClick={onClose}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onClose(); }}
            data-testid="forky-close-button"
            className="absolute right-3 top-3 z-20 flex size-8 cursor-pointer items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-900/5 hover:text-slate-800 dark:text-white/40 dark:hover:bg-white/10 dark:hover:text-white/80"
            aria-label="Cerrar asistente"
          >
            <XIcon className="size-5" />
          </div>
          
          {/* Top fade gradient */}
          <div 
            aria-hidden 
            className="pointer-events-none absolute inset-x-0 top-0 z-10 h-8 bg-gradient-to-b from-white/95 to-transparent dark:from-slate-900/95 md:rounded-t-3xl" 
          />
          
          <div 
            data-testid="forky-chat-body" 
            className="relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden"
          >
            <ThreadPrimitive.Root data-testid="forky-thread-root" className="flex h-full min-h-0 flex-col">
              <ThreadPrimitive.Viewport 
                ref={viewportRef}
                data-testid="forky-thread-viewport"
                className="min-h-0 flex-1 overflow-y-auto px-4 py-4 pt-8 md:px-5"
              >
                <ThreadPrimitive.Empty>
                  <EmptyState />
                </ThreadPrimitive.Empty>
                <div data-testid="forky-messages-container" className="flex flex-col gap-1">
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
