import React, { useEffect, useMemo, useState } from "react";
import { History } from "lucide-react";

import { POSDialog } from "./POSDialog";
import { money } from "../../hooks/usePOSRegister";
import type { TicketSummary } from "../../types/register";

/**
 * Picks a recent ticket to copy onto the open one.
 *
 * The list is the day's tickets newest first, because the guest who just wants
 * "the same again" is nearly always the most recent one. Only finished tickets
 * are offered: recalling the ticket already on screen would copy it onto itself.
 */
export function POSRecallDialog({ tickets = [], busy = false, error, onClose, onPick }: {
  tickets: TicketSummary[];
  busy?: boolean;
  error?: string;
  onClose: () => void;
  onPick: (sourceTicketId: number) => void;
}) {
  const [selected, setSelected] = useState<number | null>(null);

  useEffect(() => {
    setSelected(null);
  }, []);

  // Only tickets that have something to bring back, and not the one on screen.
  const candidates = useMemo(() => tickets.filter((entry) => entry.status !== "OPEN"), [tickets]);

  return (
    <POSDialog testId="pos-recall" title="Traer una cuenta" busy={busy} error={error} onClose={onClose}>
      <div className="pos-recallList" data-testid="pos-recall-list" role="radiogroup" aria-label="Cuentas cerradas de hoy">
        {candidates.length === 0 ? (
          <p className="pos-recallEmpty" data-testid="pos-recall-empty">No hay cuentas cerradas hoy para traer.</p>
        ) : (
          candidates.map((entry) => {
            const entrySelected = selected === entry.id;
            return (
              <button
                className={`pos-recallItem${entrySelected ? " is-selected" : ""}`}
                type="button"
                role="radio"
                aria-checked={entrySelected}
                key={entry.id}
                disabled={busy}
                onClick={() => setSelected(entry.id)}
                data-testid={`pos-recall-item-${entry.id}`}
              >
                <span className="pos-recallItem__table">
                  <History className="h-4 w-4" aria-hidden="true" />
                  {entry.tableName ? `Mesa ${entry.tableName}` : "Sin mesa"}
                </span>
                <span className="pos-recallItem__meta">
                  {entry.ticketNumber}{entry.covers ? ` · ${entry.covers} comensales` : ""}
                </span>
                <span className="pos-recallItem__total">{money(entry.totalGrossCents)}</span>
              </button>
            );
          })
        )}
      </div>
      <footer className="pos-modal__footer">
        <button className="pos-modal__primary" type="button" disabled={busy || selected == null} onClick={() => selected != null && onPick(selected)} data-testid="pos-recall-confirm">
          Traer cuenta
        </button>
      </footer>
    </POSDialog>
  );
}
