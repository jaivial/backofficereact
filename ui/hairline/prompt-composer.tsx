// Hairline UI · prompt-composer · MIT License
// Vendored from Hairline UI (https://hairlineui.com/ui), copy translated to Spanish for the campaign builder chat (campaign_html_builder_ai_v1).
// Copyright (c) 2026 Hairline UI · https://hairlineui.com/license#components

"use client";

import * as React from "react";
import { ArrowUp, Paperclip, Square } from "lucide-react";
import { NumberRoll } from "./number-roll";

/* ─────────────────────────────────────────────────────────
 * PROMPT COMPOSER: where the conversation starts
 *
 *   ready      type; Enter sends, Shift+Enter adds a line
 *   submitted  sent: the arrow blurs into a spinner
 *   streaming  the spinner blurs into Stop
 *   error      ready to try again
 *   disabled   with a reason, e.g. a rate limit, folding open
 *              above the field
 *
 * Near the limit a counter opens in and rolls as you type;
 * attachments fold open above the field as the first one lands.
 *
 * status takes useChat's status as is. Files come in through the
 * paperclip, paste or drag and drop; render them as chips in the
 * attachments slot. The toolbar slot fits a mode switcher.
 * ───────────────────────────────────────────────────────── */

export type ComposerStatus = "ready" | "submitted" | "streaming" | "error";

export interface PromptComposerProps extends Omit<React.FormHTMLAttributes<HTMLFormElement>, "onSubmit" | "defaultValue"> {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  onSubmit: (value: string) => void;
  onStop?: () => void;
  /** Pass useChat's status straight through. */
  status?: ComposerStatus;
  placeholder?: string;
  disabled?: boolean;
  /** Shown above the input while disabled, e.g. "You've reached today's limit." */
  disabledReason?: React.ReactNode;
  /** Enables the paperclip, paste and drop. */
  onFilesSelected?: (files: File[]) => void;
  accept?: string;
  /** Attachment chips, shown above the text. */
  attachments?: React.ReactNode;
  /** Controls at the bottom left, e.g. a mode switcher. */
  toolbar?: React.ReactNode;
  maxLength?: number;
  /** Allow sending with no text, e.g. when files are attached. */
  allowEmpty?: boolean;
  autoFocus?: boolean;
}

const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40";
const MORPH = "cubic-bezier(0.16,1,0.3,1)";

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

/** A block that folds open to its height and shut again, keeping what it showed while it closes. */
function Fold({ show, reduced, children, testId }: { show: boolean; reduced: boolean; children: React.ReactNode; testId: string }) {
  const [last, setLast] = React.useState(children);
  if (show && children !== last) setLast(children);
  return (
    <div
      aria-hidden={!show || undefined}
      inert={!show}
      className="grid"
      data-testid={testId}
      style={{
        gridTemplateRows: show ? "1fr" : "0fr",
        opacity: show ? 1 : 0,
        transition: reduced ? "none" : `grid-template-rows 380ms ${MORPH}, opacity ${show ? "280ms" : "140ms"} ${MORPH}`,
      }}
    >
      <div className="min-h-0 overflow-hidden" data-testid={`${testId}-clip`}>{show ? children : last}</div>
    </div>
  );
}

export function PromptComposer({
  value,
  defaultValue = "",
  onValueChange,
  onSubmit,
  onStop,
  status = "ready",
  placeholder = "Pide un cambio",
  disabled = false,
  disabledReason,
  onFilesSelected,
  accept,
  attachments,
  toolbar,
  maxLength,
  allowEmpty = false,
  autoFocus,
  className = "",
  ...props
}: PromptComposerProps) {
  const reduced = useReducedMotion();
  const [own, setOwn] = React.useState(defaultValue);
  const [dragging, setDragging] = React.useState(false);
  const text = value ?? own;
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const busy = status === "submitted" || status === "streaming";
  const canSend = !disabled && !busy && (allowEmpty || text.trim().length > 0) && (maxLength === undefined || text.length <= maxLength);

  const setText = (next: string) => {
    if (value === undefined) setOwn(next);
    onValueChange?.(next);
  };

  // Grow with the text, up to a scrolling maximum.
  React.useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [text]);

  const submit = () => {
    if (!canSend) return;
    onSubmit(text);
    if (value === undefined) setOwn("");
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  };

  const takeFiles = (list: FileList | null) => {
    if (!list || list.length === 0 || !onFilesSelected) return false;
    onFilesSelected(Array.from(list));
    return true;
  };

  const action = busy ? (status === "streaming" && onStop ? "stop" : "wait") : "send";
  const id = (props as { "data-testid"?: string })["data-testid"] ?? "hl-prompt-composer";

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      onDragOver={(e) => {
        if (!onFilesSelected || !e.dataTransfer.types.includes("Files")) return;
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false);
      }}
      onDrop={(e) => {
        if (!onFilesSelected) return;
        e.preventDefault();
        setDragging(false);
        takeFiles(e.dataTransfer.files);
      }}
      className={`relative rounded-2xl border bg-background transition-colors focus-within:border-foreground/25 ${
        dragging ? "border-dashed border-foreground/40" : "border-border"
      } ${className}`}
      data-testid={id}
      {...props}
    >
      <Fold show={Boolean(disabled && disabledReason)} reduced={reduced} testId={`${id}-disabled-fold`}>
        <div className="border-b border-border px-3.5 py-2 text-[12px] text-muted-foreground" data-testid={`${id}-disabled-reason`}>{disabledReason}</div>
      </Fold>

      <Fold show={Boolean(attachments)} reduced={reduced} testId={`${id}-attachments-fold`}>
        <div className="flex flex-wrap gap-2 px-3 pt-3" data-testid={`${id}-attachments`}>{attachments}</div>
      </Fold>

      <textarea
        ref={textareaRef}
        rows={1}
        value={text}
        autoFocus={autoFocus}
        disabled={disabled}
        placeholder={placeholder}
        aria-label={placeholder}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKeyDown}
        data-testid={`${id}-input`}
        onPaste={(e) => {
          if (takeFiles(e.clipboardData.files) && !e.clipboardData.getData("text")) e.preventDefault();
        }}
        className="block max-h-[200px] w-full resize-none overflow-y-auto bg-transparent px-3.5 pb-1 pt-3 text-[14px] leading-6 text-foreground outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-60"
      />

      <div className="flex items-center gap-1.5 px-2 pb-2 pt-1" data-testid={`${id}-bar`}>
        {onFilesSelected && (
          <>
            <button
              type="button"
              aria-label="Adjuntar archivos"
              disabled={disabled}
              onClick={() => fileRef.current?.click()}
              className={`cursor-pointer disabled:cursor-default flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40 ${FOCUS}`}
              data-testid={`${id}-attach`}
            >
              <Paperclip className="size-4" data-testid={`${id}-attach-icon`} />
            </button>
            <input
              ref={fileRef}
              type="file"
              multiple
              accept={accept}
              className="hidden"
              data-testid={`${id}-file-input`}
              onChange={(e) => {
                takeFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </>
        )}
        {toolbar}

        <div className="ml-auto flex items-center gap-2.5" data-testid={`${id}-end`}>
          {maxLength !== undefined && (
            // Opens in near the limit and rolls as you type; red once you're over.
            <span
              aria-hidden={text.length <= maxLength * 0.8 || undefined}
              className="grid"
              style={{
                gridTemplateColumns: text.length > maxLength * 0.8 ? "1fr" : "0fr",
                opacity: text.length > maxLength * 0.8 ? 1 : 0,
                transition: reduced ? "none" : `grid-template-columns 380ms ${MORPH}, opacity 260ms ${MORPH}`,
              }}
              data-testid={`${id}-counter`}
            >
              <span
                data-testid={`${id}-counter-text`}
                className={`flex min-w-0 items-baseline overflow-hidden whitespace-nowrap font-mono text-[11px] tabular-nums transition-colors duration-300 ${
                  text.length > maxLength ? "text-red-500" : "text-muted-foreground"
                }`}
              >
                <NumberRoll value={text.length} duration={300} data-testid={`${id}-counter-value`} />/{maxLength}
              </span>
            </span>
          )}
          <button
            type={action === "send" ? "submit" : "button"}
            aria-label={action === "stop" ? "Detener" : action === "wait" ? "Enviando" : "Enviar"}
            data-testid={`${id}-send`}
            disabled={action === "send" ? !canSend : action === "wait"}
            onClick={action === "stop" ? onStop : undefined}
            className={`cursor-pointer disabled:cursor-default relative flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground transition-[opacity,transform] duration-200 active:scale-95 disabled:opacity-35 ${FOCUS}`}
          >
            <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center" style={swap(action === "send", reduced)} data-testid={`${id}-send-arrow`}>
              <ArrowUp className="size-4" data-testid={`${id}-send-arrow-icon`} />
            </span>
            <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center" style={swap(action === "stop", reduced)} data-testid={`${id}-send-stop`}>
              <Square fill="currentColor" className="size-3" data-testid={`${id}-send-stop-icon`} />
            </span>
            <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center" style={swap(action === "wait", reduced)} data-testid={`${id}-send-wait`}>
              {/* Spins only while it's showing. */}
              <span className={`size-3.5 rounded-full border-[1.5px] border-current/35 border-t-current motion-reduce:animate-none ${action === "wait" ? "animate-spin" : ""}`} data-testid={`${id}-send-spinner`} />
            </span>
          </button>
        </div>
      </div>

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-2xl bg-background/85 text-[13px] font-medium text-foreground"
        style={{ opacity: dragging ? 1 : 0, transition: reduced ? "none" : `opacity 200ms ${MORPH}` }}
        data-testid={`${id}-drop-overlay`}
      >
        Suelta los archivos para adjuntarlos
      </div>
    </form>
  );
}
