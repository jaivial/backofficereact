import { createPortal } from "react-dom";
import { AlertTriangle } from "lucide-react";
import React from "react";

export type POSForceOpenConfirmModalProps = {
  count: number;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

/**
 * Second confirmation before force-opening a day while earlier days remain
 * unsealed. Stacks over `POSUnclosedDaysModal` via its own portal. The backend
 * records `forced_open`; this dialog is the gate that makes that flag a
 * deliberate act rather than a stray click.
 */
export function POSForceOpenConfirmModal({ count, busy, onCancel, onConfirm }: POSForceOpenConfirmModalProps) {
  const singular = count <= 1;
  return createPortal(
    <div className="pos-forceConfirm__overlay" data-testid="pos-force-confirm-overlay">
      <div className="pos-forceConfirm" role="alertdialog" aria-labelledby="pos-force-confirm-title" aria-describedby="pos-force-confirm-desc" data-testid="pos-force-confirm">
        <AlertTriangle size={28} className="pos-forceConfirm__icon" />
        <h3 id="pos-force-confirm-title" data-testid="pos-force-confirm-title" className="pos-forceConfirm__title">
          {singular ? "¿Abrir sin cerrar el día anterior?" : "¿Abrir sin cerrar los días anteriores?"}
        </h3>
        <p id="pos-force-confirm-desc" className="pos-forceConfirm__desc">
          {singular
            ? "Vas a abrir este día sin haber cerrado el anterior. Lo recomendado es cerrarlo antes."
            : "Vas a abrir este día sin haber cerrado varios días anteriores. Lo recomendado es cerrarlos antes."}
        </p>
        <div className="pos-forceConfirm__actions">
          <button type="button" className="pos-forceConfirm__cancel" onClick={onCancel} disabled={busy} data-testid="pos-force-confirm-cancel">
            Cancelar
          </button>
          <button type="button" className="pos-forceConfirm__confirm" onClick={onConfirm} disabled={busy} data-testid="pos-force-confirm-ok">
            Abrir día igualmente
          </button>
        </div>
      </div>
    </div>,
    document.getElementById("bo-portal") || document.body,
  );
}
