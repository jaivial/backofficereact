import React, { useEffect } from "react";
import { X } from "lucide-react";

/**
 * Reusable POS modal shell: backdrop, dialog semantics, Escape/backdrop close
 * (ignored while busy), header with title + close, an inline error slot and an
 * optional footer. Every POS modal renders through it so `data-testid` and
 * accessibility stay consistent across the sell screen.
 */
export function POSDialog({ testId, title, ariaLabel, busy = false, error, onClose, children, footer, headerTestId, titleTestId }: {
  testId: string;
  title: string;
  /** Stable accessible name when the visible title is dynamic (e.g. amount). */
  ariaLabel?: string;
  busy?: boolean;
  error?: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** Overrides for modals whose historical test ids predate the ${testId}-* convention. */
  headerTestId?: string;
  titleTestId?: string;
}) {
  useEffect(() => {
    if (busy) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      // Escape must not discard typed input while the operator edits a field.
      const tag = (event.target as HTMLElement | null)?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;
      onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [busy, onClose]);

  return (
    <div className="pos-modalBackdrop" role="presentation" onClick={busy ? undefined : onClose} data-testid={`${testId}-backdrop`}>
      <div className="pos-modal" role="dialog" aria-modal="true" aria-label={ariaLabel ?? title} onClick={(event) => event.stopPropagation()} data-testid={`${testId}-modal`}>
        <header className="pos-modal__header" data-testid={headerTestId ?? `${testId}-header`}>
          <h2 data-testid={titleTestId ?? `${testId}-title`}>{title}</h2>
          <button className="pos-modal__close" type="button" aria-label="Cerrar" disabled={busy} onClick={onClose} data-testid={`${testId}-close`}>
            <X className="h-4 w-4" aria-hidden="true" data-testid={`${testId}-close-icon`} />
          </button>
        </header>
        {error ? <p className="pos-modal__error" role="alert" data-testid={`${testId}-error`}>{error}</p> : null}
        {children}
        {footer}
      </div>
    </div>
  );
}
