import React from "react";

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
}: {
  open?: boolean;
  isOpen?: boolean;
  title: string;
  message: string;
  confirmText?: string;
  confirmLabel?: string;
  cancelText?: string;
  cancelLabel?: string;
  danger?: boolean;
  onClose?: () => void;
  onCancel?: () => void;
  onConfirm: () => void | Promise<void>;
  busy?: boolean;
}) {
  const effectiveOpen = open ?? isOpen ?? false;
  const handleClose = onClose ?? onCancel ?? (() => {});
  const effectiveConfirmText = confirmText ?? confirmLabel ?? "Confirmar";
  const effectiveCancelText = cancelText ?? cancelLabel ?? "Volver";

  return (
    <Modal open={effectiveOpen} title={title} onClose={handleClose} className="bo-modal--confirm">
      <div className="bo-modalHead">
        <div className="bo-modalTitle">{title}</div>
        <button className="bo-modalX" type="button" onClick={handleClose} aria-label="Close">
          ×
        </button>
      </div>
      <div className="bo-modalBody">{message}</div>
      <div className="bo-modalActions">
        <button className="bo-btn bo-btn--ghost" type="button" onClick={handleClose} disabled={busy}>
          {effectiveCancelText}
        </button>
        <button
          className={`bo-btn bo-btn--primary${danger ? " bo-btn--danger" : ""}`}
          type="button"
          onClick={() => void onConfirm()}
          disabled={busy}
        >
          {busy ? "Procesando..." : effectiveConfirmText}
        </button>
      </div>
    </Modal>
  );
}
