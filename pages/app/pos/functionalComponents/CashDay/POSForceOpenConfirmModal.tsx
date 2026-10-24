import { createPortal } from "react-dom";
import { AlertTriangle } from "lucide-react";
import React from "react";

import { posPortalRoot } from "../../utils/portal";

export type POSForceOpenConfirmModalProps = {
  count: number;
  busy?: boolean;
  /** Why the last attempt failed (403 without pos.shift.manage, network...). Shown inside this dialog, which is the one on top. */
  error?: string;
  onCancel: () => void;
  onConfirm: () => void;
};

/**
 * Second confirmation before force-opening a day while earlier days remain
 * unsealed. Stacks over `POSUnclosedDaysModal` via its own portal. The backend
 * records `forced_open`; this dialog is the gate that makes that flag a
 * deliberate act rather than a stray click.
 */
export function POSForceOpenConfirmModal({ count, busy, error, onCancel, onConfirm }: POSForceOpenConfirmModalProps) {
  const singular = count <= 1;
  // No DOM during SSR: render nothing there instead of crashing the page.
  const root = posPortalRoot();
  if (!root) return null;
  return createPortal(
    <div className="pos-forceConfirm__overlay" data-testid="pos-force-confirm-overlay">
      <div className="pos-forceConfirm" role="alertdialog" aria-labelledby="pos-force-confirm-title" aria-describedby={error ? "pos-force-confirm-desc pos-force-confirm-error" : "pos-force-confirm-desc"} data-testid="pos-force-confirm">
        <AlertTriangle size={28} className="pos-forceConfirm__icon" />
        <h3 id="pos-force-confirm-title" data-testid="pos-force-confirm-title" className="pos-forceConfirm__title">
          {singular ? "¿Abrir sin cerrar el día anterior?" : "¿Abrir sin cerrar los días anteriores?"}
        </h3>
        <p data-slot="pOSForceOpenConfirmModal-pos-forceConfirm-desc" id="pos-force-confirm-desc" className="pos-forceConfirm__desc">
          {singular
            ? "Vas a abrir este día sin haber cerrado el anterior. Lo recomendado es cerrarlo antes."
            : "Vas a abrir este día sin haber cerrado varios días anteriores. Lo recomendado es cerrarlos antes."}
        </p>
        {error ? <p id="pos-force-confirm-error" className="pos-unclosedModal__error" role="alert" data-testid="pos-force-confirm-error">{error}</p> : null}
        <div data-slot="pOSForceOpenConfirmModal-pos-forceConfirm-actions" className="pos-forceConfirm__actions">
          <button type="button" className="pos-forceConfirm__cancel" onClick={onCancel} disabled={busy} data-testid="pos-force-confirm-cancel">
            Cancelar
          </button>
          <button type="button" className="pos-forceConfirm__confirm" onClick={onConfirm} disabled={busy} data-testid="pos-force-confirm-ok">
            Abrir día igualmente
          </button>
        </div>
      </div>
    </div>,
    root,
  );
}
