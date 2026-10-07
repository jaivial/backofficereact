import React, { useEffect, useState } from "react";
import { POSDialog } from "./POSDialog";
import type { Ticket } from "../../types/register";

/**
 * "One account per guest": name a check.
 *
 * Used in two places, because they are the same decision at two moments:
 *   - when separating the comanda, so the new check is created already named;
 *   - when renaming an existing separated check.
 *
 * The name is OPTIONAL on purpose. A table that wants to pay apart but has no
 * wish to hand over names is a completely normal table; making the name
 * required would just train staff to type something meaningless. Clearing the
 * field and saving removes the name again.
 */
export function POSGuestDialog({ ticket, title, confirmText, onClose, onSave }: {
  /** The check being named, or null when the name is for a check yet to be created. */
  ticket: Ticket | null;
  title: string;
  confirmText: string;
  onClose: () => void;
  /** Resolves true when the name was stored (or deliberately left empty). */
  onSave: (guestLabel: string) => Promise<boolean>;
}) {
  const [value, setValue] = useState(ticket?.guestLabel ?? "");
  const [busy, setBusy] = useState(false);

  // Re-seed when the dialog is opened for a different check, so renaming does
  // not show the previous guest's name.
  useEffect(() => { setValue(ticket?.guestLabel ?? ""); }, [ticket?.id]);

  const save = async () => {
    setBusy(true);
    try { if (await onSave(value.trim())) onClose(); } finally { setBusy(false); }
  };

  return (
    <POSDialog testId="pos-guest" title={title} busy={busy} onClose={onClose}>
      <div className="pos-guest" data-testid="pos-guest-dialog">
        <label className="pos-guest__label" htmlFor="pos-guest-input">
          Comensal
          <input
            id="pos-guest-input"
            autoFocus
            value={value}
            maxLength={60}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={(event) => { if (event.key === "Enter") void save(); }}
            placeholder="Nombre del comensal (opcional)"
            data-ui="pos-guest-input"
            data-testid="pos-guest-input"
          />
        </label>
        <p className="pos-guest__hint" data-testid="pos-guest-hint">
          Aparece en la pestaña de la cuenta y en el ticket. Déjalo vacío para una cuenta sin nombre.
        </p>
        <div className="pos-guest__actions">
          <button type="button" className="pos-modal__secondary" onClick={onClose} disabled={busy} data-testid="pos-guest-cancel">Cancelar</button>
          <button type="button" className="pos-fiscal__primary" onClick={() => void save()} disabled={busy} data-ui="pos-guest-save" data-testid="pos-guest-save">
            {confirmText}
          </button>
        </div>
      </div>
    </POSDialog>
  );
}
