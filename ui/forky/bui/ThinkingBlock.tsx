"use client";

import { useState } from "react";
import StreamingText, { type StreamingToken } from "./StreamingText";

/* ─────────────────────────────────────────────────────────
 * THINKING BLOCK
 * A live thinking trace: a one-line header that shimmers while
 * the model thinks and settles into a muted summary once it
 * stops, over a collapsible body that grows with the deltas.
 * ───────────────────────────────────────────────────────── */

const STREAMING_LABEL = "Thinking";
const SETTLED_LABEL = "Thought";

/* the deltas as the tokens `StreamingText` reveals */
function toTokens(text: string): StreamingToken[] {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).map((word) => ({ text: word })) : [];
}

export default function ThinkingBlock({
  text,
  streaming = false,
  label,
}: {
  /** the thinking trace received so far */
  text: string;
  /** true while the model is still thinking - the trace stays open and shimmers */
  streaming?: boolean;
  /** overrides the header copy (defaults to `Thinking`, then `Thought` once settled) */
  label?: string;
}) {
  /* a manual toggle wins over the live default: open while thinking, settled shut after */
  const [manual, setManual] = useState<boolean | null>(null);
  const expanded = manual ?? streaming;
  const tokens = toTokens(text);

  return (
    <div
      data-testid="beautifului-thinking-block"
      data-streaming={streaming ? "true" : "false"}
      className="flex w-full flex-col"
    >
      {/* header - the line that survives the settle */}
      <button
        type="button"
        data-testid="beautifului-thinking-block-toggle"
        aria-expanded={expanded}
        onClick={() => setManual((current) => !(current ?? streaming))}
        className="-mx-1.5 flex w-fit items-center gap-2 rounded-control px-1.5 py-1 text-left
          transition-colors duration-100 hover:bg-hover-2"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill={streaming ? "var(--ink-2)" : "var(--ink-3)"}
          className="shrink-0 transition-colors duration-200"
        >
          <path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8z" />
        </svg>
        <span role="status" className="contents">
          {streaming ? (
            <span
              className="bg-clip-text text-[13px] font-medium whitespace-nowrap text-transparent"
              style={{
                backgroundImage:
                  "linear-gradient(90deg, var(--ink-3) 35%, var(--ink) 50%, var(--ink-3) 65%)",
                backgroundSize: "200% 100%",
                animation: "shimmer-text 1.4s linear infinite",
              }}
            >
              {label ?? STREAMING_LABEL}
            </span>
          ) : (
            <span
              className="text-[13px] text-ink-3"
              style={{ animation: "fade-in 350ms ease-out both" }}
            >
              {label ?? SETTLED_LABEL}
            </span>
          )}
        </span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--ink-3)"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="transition-transform duration-200"
          style={{ transform: expanded ? "rotate(0deg)" : "rotate(-90deg)" }}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {/* trace - the deltas grow it, the settle folds it back into the header */}
      <div
        className="grid transition-[grid-template-rows,opacity] duration-400"
        style={{
          gridTemplateRows: expanded ? "1fr" : "0fr",
          opacity: expanded ? 1 : 0,
          transitionTimingFunction: "cubic-bezier(0.23, 1, 0.32, 1)",
        }}
      >
        <div className="overflow-hidden">
          <div
            data-testid="beautifului-thinking-block-text"
            className="mt-0.5 ml-[5px] border-l border-line py-1 pl-4"
          >
            {tokens.length > 0 &&
              (streaming ? (
                <StreamingText content={tokens} loop={false} chrome={false} fill />
              ) : (
                <p className="text-[13px] leading-relaxed whitespace-pre-wrap text-ink-2">{text}</p>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}
