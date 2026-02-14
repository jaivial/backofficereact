import React from "react";

import { Modal } from "./Modal";

export function ConfirmDialog({
  open,
  title,
  message,
  confirmText,
  cancelText,
  danger,
  onClose,
  onConfirm,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmText: string;
  cancelText?: string;
  danger?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal open={open} title={title} onClose={onClose}>
      <div className="bo-modalHead">
        <div className="bo-modalTitle">{title}</div>
        <button className="bo-modalX" type="button" onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>
      <div className="bo-modalBody">{message}</div>
      <div className="bo-modalActions">
        <button className="bo-btn bo-btn--ghost" type="button" onClick={onClose}>
          {cancelText || "Volver"}
        </button>
        <button className={`bo-btn bo-btn--primary${danger ? " bo-btn--danger" : ""}`} type="button" onClick={onConfirm}>
          {confirmText}
        </button>
      </div>
    </Modal>
  );
}

