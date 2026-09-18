import React, { forwardRef, useCallback, useLayoutEffect, useRef } from "react";

// Coordination id: booking_commentary_autogrow_v1 - the height follows the
// content lines: it fits the text when there is text, and falls back to
// minRows when empty. Capped at maxRows with internal scroll beyond that.

type AutoGrowTextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  minRows?: number;
  maxRows?: number;
};

export const AutoGrowTextarea = forwardRef<HTMLTextAreaElement, AutoGrowTextareaProps>(function AutoGrowTextarea(
  { minRows = 2, maxRows = 10, style, ...rest },
  forwardedRef,
) {
  const innerRef = useRef<HTMLTextAreaElement | null>(null);

  const setRefs = useCallback(
    (el: HTMLTextAreaElement | null) => {
      innerRef.current = el;
      if (typeof forwardedRef === "function") forwardedRef(el);
      else if (forwardedRef) forwardedRef.current = el;
    },
    [forwardedRef],
  );

  const fit = useCallback(() => {
    const el = innerRef.current;
    if (!el) return;
    el.style.height = "auto";
    const line = parseFloat(window.getComputedStyle(el).lineHeight) || 0;
    const min = line > 0 ? line * Math.max(1, minRows) : 0;
    const max = line > 0 ? line * Math.max(minRows, maxRows) : Number.POSITIVE_INFINITY;
    el.style.height = `${Math.min(Math.max(el.scrollHeight, min), max)}px`;
    el.style.overflowY = el.scrollHeight > max ? "auto" : "hidden";
  }, [minRows, maxRows]);

  // Runs after every render so controlled value changes refit with no extra
  // wiring at the call site. Instant (no transition) by design.
  useLayoutEffect(() => {
    fit();
  });

  return <textarea {...rest} ref={setRefs} style={{ overflowY: "hidden", ...style }} />;
});
