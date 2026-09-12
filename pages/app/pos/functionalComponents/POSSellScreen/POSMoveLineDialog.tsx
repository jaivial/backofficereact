import React, { useEffect, useMemo, useState } from "react";

import { POSDialog } from "./POSDialog";
import { money, type Ticket, type TicketLine } from "../../hooks/usePOSRegister";

/**
 * Chooses the destination split ticket and the quantity for a line move.
 * Replaces the old always-first-target, always-full-quantity shortcut.
 */
export function POSMoveLineDialog({ line, targets, allTickets, tableName, busy = false, error, onClose, onConfirm }: {
  line: TicketLine | null;
  targets: Ticket[];
  /** Full split list, so the label matches the tab numbering (which counts the current ticket too). */
  allTickets?: Ticket[];
  tableName?: string;
  busy?: boolean;
  error?: string;
  onClose: () => void;
  onConfirm: (targetId: number, quantity: number) => void;
}) {
  const [targetId, setTargetId] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const maxQuantity = line?.quantity ?? 1;
  const numberById = useMemo(() => {
    const map = new Map<number, number>();
    (allTickets ?? targets).forEach((entry, index) => map.set(entry.id, index + 1));
    return map;
  }, [allTickets, targets]);

  useEffect(() => {
    if (!line) return;
    setTargetId(targets[0]?.id ?? 0);
    setQuantity(Math.max(1, line.quantity));
  }, [line, targets]);

  const canConfirm = useMemo(() => Boolean(line) && targetId > 0 && quantity >= 1 && quantity <= maxQuantity, [line, maxQuantity, quantity, targetId]);

  if (!line) return null;

  return (
    <POSDialog testId="pos-move" title={`Mover ${line.productName}`} busy={busy} error={error} onClose={onClose}>
      <div className="pos-modal__confirm" data-testid="pos-move-body">
        <div className="pos-modal__choices" role="radiogroup" aria-label="Cuenta destino" data-testid="pos-move-targets">
          {targets.map((target, index) => (
            <label className="pos-modal__choice" key={target.id} data-testid={`pos-move-target-${target.id}`}>
              <input type="radio" name="pos-move-target" checked={targetId === target.id} onChange={() => setTargetId(target.id)} data-testid={`pos-move-target-radio-${target.id}`} />
              <span>
                <strong data-testid={`pos-move-target-name-${target.id}`}>Cuenta {numberById.get(target.id) ?? index + 1}{tableName ? ` · ${tableName}` : ""}</strong>
                <small data-testid={`pos-move-target-total-${target.id}`}>{money(target.totalGrossCents)}</small>
              </span>
            </label>
          ))}
        </div>
        <div className="pos-modal__modes" role="group" aria-label="Cantidad a mover" data-testid="pos-move-qty-group">
          <button className="pos-modal__secondary" type="button" disabled={busy || quantity <= 1} onClick={() => setQuantity((current) => Math.max(1, current - 1))} aria-label="Restar cantidad" data-testid="pos-move-qty-minus">−</button>
          <span className="pos-modal__pending" data-testid="pos-move-qty">{quantity} / {maxQuantity}</span>
          <button className="pos-modal__secondary" type="button" disabled={busy || quantity >= maxQuantity} onClick={() => setQuantity((current) => Math.min(maxQuantity, current + 1))} aria-label="Sumar cantidad" data-testid="pos-move-qty-plus">+</button>
        </div>
        <button className="pos-modal__primary" type="button" disabled={busy || !canConfirm} onClick={() => onConfirm(targetId, quantity)} data-pos-command="move-line" data-testid="pos-move-confirm">Mover línea</button>
      </div>
    </POSDialog>
  );
}
