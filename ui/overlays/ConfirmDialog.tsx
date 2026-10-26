import React from "react";
import { cn } from "../shadcn/utils";
import { childTestId } from "../lib/testId";

import { Modal } from "./Modal";

export function ConfirmDialog({
  open,
  isOpen,
  title,
  message,
  confirmText,
  confirmLabel,
  cancelText,
  cancelLabel,
  danger,
  onClose,
  onCancel,
  onConfirm,
  busy,
  className,
  testId,
}: {
  open?: boolean;
  isOpen?: boolean;
  title: string;
  message: React.ReactNode;
  confirmText?: string;
  confirmLabel?: string;
  cancelText?: string;
  cancelLabel?: string;
  danger?: boolean;
  onClose?: () => void;
  onCancel?: () => void;
  onConfirm: () => void | Promise<void>;
  busy?: boolean;
  className?: string;
  /** Unique test id of the dialog; every inner element derives its own. */
  testId?: string;
}) {
  const effectiveOpen = open ?? isOpen ?? false;
  const handleClose = onClose ?? onCancel ?? (() => {});
  const effectiveConfirmText = confirmText ?? confirmLabel ?? "Confirmar";
  const effectiveCancelText = cancelText ?? cancelLabel ?? "Volver";

  return (
    <Modal hideClose open={effectiveOpen} title={title} onClose={handleClose} className={cn("bo-modal--confirm", className)} testId={testId}>
      <div data-slot="modal-head" className="bo-modalHead" data-testid={childTestId(testId, "head")}>
        <div data-ui="modal-title" className="bo-modalTitle" data-testid={childTestId(testId, "title")}>{title}</div>
        <button data-ui="close-modal-btn" className="bo-modalX" type="button" onClick={handleClose} aria-label="Close" data-testid={childTestId(testId, "x")}>
          ×
        </button>
      </div>
      <div data-slot="modal-body" className="bo-modalBody" data-testid={childTestId(testId, "body")}>{message}</div>
      <div data-slot="modal-actions" className="bo-modalActions" data-testid={childTestId(testId, "actions")}>
        <button data-ui="cancel-btn" className="bo-btn bo-btn--ghost" type="button" onClick={handleClose} disabled={busy} data-testid={childTestId(testId, "cancel")}>
          {effectiveCancelText}
        </button>
        <button
          data-ui="confirm-btn"
          className={cn("bo-btn", "bo-btn--primary", danger && "bo-btn--danger")}
          type="button"
          onClick={() => void onConfirm()}
          disabled={busy}
          data-testid={childTestId(testId, "confirm")}
        >
          {busy ? "Procesando..." : effectiveConfirmText}
        </button>
      </div>
    </Modal>
  );
}
