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
    <Modal open={effectiveOpen} title={title} onClose={handleClose}>
      <div className="flex items-center justify-between mb-4">
        <div className="text-base font-semibold text-foreground">{title}</div>
        <button className="text-muted hover:text-foreground text-xl leading-none w-8 h-8 flex items-center justify-center" type="button" onClick={handleClose} aria-label="Close">
          ×
        </button>
      </div>
      <div className="text-sm text-muted mb-6">{message}</div>
      <div className="flex justify-end gap-3">
        <button className="h-10 px-4 rounded-lg border border-transparent bg-transparent text-sm font-bold text-foreground hover:bg-white/[0.06] transition-colors duration-150 disabled:opacity-55 disabled:cursor-not-allowed" type="button" onClick={handleClose} disabled={busy}>
          {effectiveCancelText}
        </button>
        <button
          className={`h-10 px-4 rounded-lg border font-bold text-sm transition-all duration-150 disabled:opacity-55 disabled:cursor-not-allowed ${danger ? "border-danger/35 bg-danger/14 text-foreground hover:bg-danger/24 hover:border-danger/50" : "border-primary/30 bg-primary/16 text-foreground hover:bg-primary/24 hover:border-primary/40"}`}
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
