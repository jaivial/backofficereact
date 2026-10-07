import React, { useMemo } from "react";
import { ArrowRightLeft, History, Merge, Minus, Plus, Receipt, Trash2, Users, X } from "lucide-react";
import { StatusBadge } from "../../../../../ui/feedback/StatusBadge";
import { cn } from "../../../../../ui/shadcn/utils";
import { money, type Tag, type Ticket, type TicketLine, type Visit } from "../../hooks/usePOSRegister";

export function POSTicketPanel({ ticket, visit, tags = [], activeTicketLines, selectedLineId, onSelectLine, onLineQuantity, onVoidLine, onRequestTable, expanded = false, onToggleExpand, onRequestRecall, splitTickets = [], sentKitchenQuantities = {}, onSelectTicket, onMoveLine, canMoveLine = false, onMergeSplitTickets, onDeleteEmptyTicket, busy = false, readOnly = false }: {
  ticket: Ticket | null;
  visit: Visit | null;
  tags?: Tag[];
  activeTicketLines: TicketLine[];
  selectedLineId: number;
  onSelectLine: (line: TicketLine) => void;
  onLineQuantity: (line: TicketLine, quantity: number) => void;
  onVoidLine: (line: TicketLine) => void;
  onRequestTable?: () => void;
  expanded?: boolean;
  onToggleExpand?: () => void;
  /** Opens the "traer una cuenta" picker; hidden when the ticket is not open. */
  onRequestRecall?: () => void;
  splitTickets?: Ticket[];
  sentKitchenQuantities?: Record<number, number>;
  onSelectTicket?: (next: Ticket) => void;
  onMoveLine?: (line: TicketLine) => void;
  /** Whether another open split ticket exists to move the line to. */
  canMoveLine?: boolean;
  onMergeSplitTickets?: () => void;
  onDeleteEmptyTicket?: (ticket: Ticket) => void;
  busy?: boolean;
  /** Sealed day: the ticket is query-only, so every line action stays disabled. */
  readOnly?: boolean;
}) {
  const isOpen = (ticket?.status ?? visit?.status) === "OPEN";
  // Most recently changed line first, so the product the operator just touched
  // is where their thumb already is.
  //
  // `updatedAt` is absent on payloads that predate it, and that means "we do not
  // know", not "oldest": those lines keep the server order instead of being
  // guessed at. The sort is stable in modern engines, so equal timestamps also
  // preserve the incoming order and the list never wobbles between renders.
  // An absent or unparseable value means "unknown", and unknown must never sort
  // as newest: Date.parse returns NaN, which would corrupt the comparison.
  const recency = (line: TicketLine): number => {
    const parsed = Date.parse(line.updatedAt || "");
    return Number.isFinite(parsed) ? parsed : 0;
  };
  const linesByRecency = useMemo(() => {
    if (!activeTicketLines.some((line) => recency(line) > 0)) return activeTicketLines;
    return [...activeTicketLines].sort((a, b) => {
      const left = recency(a);
      const right = recency(b);
      if (left === right) return 0;
      if (left === 0) return 1;
      if (right === 0) return -1;
      return right - left;
    });
  }, [activeTicketLines]);

  // A pack expands into a parent line plus component lines. Listing them flat
  // shows the guest a paid menu followed by four 0,00 € plates they never
  // ordered, so components are nested under their parent and shown read-only.
  const componentsByParent = useMemo(() => {
    const out = new Map<number, TicketLine[]>();
    for (const line of activeTicketLines) {
      if (line.parentLineId == null) continue;
      const bucket = out.get(line.parentLineId);
      if (bucket) bucket.push(line);
      else out.set(line.parentLineId, [line]);
    }
    return out;
  }, [activeTicketLines]);
  const topLevelLines = useMemo(() => linesByRecency.filter((line) => line.parentLineId == null), [linesByRecency]);
  const openSplitTickets = useMemo(() => splitTickets.filter((t) => t.status === "OPEN"), [splitTickets]);
  const currentTicketIsEmpty = useMemo(() => ticket && !ticket.lines.filter((line) => line.status !== "VOIDED").length, [ticket]);
  return (
    <section
      className={cn("pos-ticketPanel", !ticket && "is-empty", expanded && "pos-ticketPanel--expanded")}
      aria-label={ticket ? "Cuenta" : "Cuenta — toca para abrir mesa"}
      data-testid="pos-ticket-panel"
      onClick={ticket ? undefined : onRequestTable}
      {...(ticket ? {} : { role: "button", tabIndex: 0 })}
      {...(ticket ? {} : { onKeyDown: (e: React.KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onRequestTable?.(); } } })}
    >
      <header className="pos-ticketPanel__header" data-testid="pos-ticket-header">
        <h2 className="pos-ticketPanel__title" data-testid="pos-ticket-title"><Receipt className="mr-2 inline h-4 w-4" aria-hidden="true" data-testid="pos-ticket-title-icon" />Cuenta{ticket?.ticketNumber ? ` · ${ticket.ticketNumber}` : ""}</h2>
        {onRequestRecall && ticket?.status !== "PAID" && !readOnly ? (
          <button className="pos-ticketPanel__recall" type="button" onClick={onRequestRecall} title="Traer una cuenta ya cerrada" data-testid="pos-recall-open" disabled={busy}>
            <History className="h-4 w-4" aria-hidden="true" />
            <span>Traer cuenta</span>
          </button>
        ) : null}
        {visit ? (
          <span className="pos-ticketPanel__meta" data-ui="pos-ticket-meta" data-testid="pos-ticket-meta">
            <StatusBadge variant={isOpen ? "success" : "neutral"} size="sm" data-ui="pos-ticket-status" data-testid="pos-ticket-status">{isOpen ? "Abierta" : "Cerrada"}</StatusBadge>
            <span className="pos-ticketPanel__covers" data-ui="pos-ticket-covers" data-testid="pos-ticket-covers"><Users className="mr-1 inline h-4 w-4" aria-hidden="true" data-testid="pos-ticket-covers-icon" />{visit.covers}</span>
          </span>
        ) : null}
      </header>
      {ticket ? (
        <>
          {splitTickets.length > 1 ? (
            <div className="pos-ticketPanel__tabs" role="tablist" aria-label="Cuentas separadas" data-testid="pos-split-tabs">
              {splitTickets.map((entry, index) => {
                const isEmpty = !entry.lines.filter((line) => line.status !== "VOIDED").length;
                return (
                  <button
                    className={cn("pos-ticketPanel__tab", entry.id === ticket.id && "is-active", isEmpty && "is-empty")}
                    type="button"
                    role="tab"
                    key={entry.id}
                    aria-selected={entry.id === ticket.id}
                    onClick={() => onSelectTicket?.(entry)}
                    data-testid={`pos-split-tab-${entry.id}`}
                  >
                    {`Cuenta ${index + 1}`} · {money(entry.totalGrossCents)}
                    {isEmpty && entry.id === ticket.id && onDeleteEmptyTicket ? (
                      <span
                        className="pos-ticketPanel__tabDelete"
                        role="button"
                        tabIndex={0}
                        title="Eliminar cuenta vacía"
                        onClick={(event) => { event.stopPropagation(); onDeleteEmptyTicket(entry); }}
                        onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.stopPropagation(); event.preventDefault(); onDeleteEmptyTicket(entry); } }}
                        data-testid={`pos-split-delete-${entry.id}`}
                      >
                        <X className="h-3 w-3" aria-hidden="true" />
                      </span>
                    ) : null}
                  </button>
                );
              })}
              {openSplitTickets.length > 1 && onMergeSplitTickets ? (
                <button
                  className="pos-ticketPanel__tabMerge"
                  type="button"
                  disabled={busy || readOnly}
                  onClick={onMergeSplitTickets}
                  title="Reagrupar todas las cuentas"
                  aria-label="Reagrupar todas las cuentas"
                  data-testid="pos-split-merge"
                >
                  <Merge className="h-4 w-4" aria-hidden="true" />
                  <span data-slot="pOSTicketPanel-span">Reagrupar</span>
                </button>
              ) : null}
            </div>
          ) : null}
          <div className="pos-ticketPanel__lines" data-testid="pos-ticket-lines">
            {topLevelLines.map((line) => (
              <div
                className={line.id === selectedLineId ? "pos-line pos-line--selected" : "pos-line"}
                key={line.id}
                onClick={() => onSelectLine(line)}
                onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelectLine(line); } }}
                role="button"
                tabIndex={0}
                aria-pressed={line.id === selectedLineId}
                data-testid={`pos-line-${line.id}`}
              >
                <div className="pos-line__actions" data-testid={`pos-line-actions-${line.id}`}>
                  <button className="pos-line__qtyBtn" type="button" disabled={readOnly} onClick={(event) => { event.stopPropagation(); if (line.quantity <= 1) { onVoidLine(line); return; } onLineQuantity(line, line.quantity - 1); }} aria-label={line.quantity <= 1 ? `Anular ${line.productName}` : `Restar ${line.productName}`} title={line.quantity <= 1 ? "Anular línea" : undefined} data-testid={`pos-line-minus-${line.id}`}><Minus className="h-4 w-4" aria-hidden="true" data-testid={`pos-line-minus-icon-${line.id}`} /></button>
                  <span className="pos-line__qty" data-testid={`pos-line-qty-${line.id}`}>{line.quantity}</span>
                  <button className="pos-line__qtyBtn" type="button" disabled={readOnly} onClick={(event) => { event.stopPropagation(); onLineQuantity(line, line.quantity + 1); }} aria-label={`Sumar ${line.productName}`} data-testid={`pos-line-plus-${line.id}`}><Plus className="h-4 w-4" aria-hidden="true" data-testid={`pos-line-plus-icon-${line.id}`} /></button>
                </div>
                <div className="pos-line__main" data-testid={`pos-line-main-${line.id}`}>
                  <strong className="pos-line__name" data-testid={`pos-line-name-${line.id}`}>{line.productName}</strong>
                  {(sentKitchenQuantities[line.id] || 0) >= line.quantity ? (
                    <StatusBadge variant="neutral" size="sm" data-ui="pos-line-sent" data-testid={`pos-line-sent-${line.id}`}>Cocina</StatusBadge>
                  ) : null}
                  {line.comped ? <StatusBadge variant="warning" size="sm" data-ui={`pos-line-comp-${line.id}`} data-testid={`pos-line-comp-${line.id}`}>Invitada{line.compReason ? ` · ${line.compReason}` : ""}</StatusBadge> : null}
                </div>
                {(line.modifiers || []).length ? (
                  <ul className="pos-line__modifiers" data-testid={`pos-line-modifiers-${line.id}`}>
                    {line.modifiers?.map((modifier) => (
                      <li key={`${line.id}-${modifier.modifierOptionId ?? modifier.name}`} data-testid={`pos-line-modifier-${line.id}-${modifier.modifierOptionId ?? modifier.name}`}>
                        {modifier.quantity > 1 ? `${modifier.quantity} × ` : ""}{modifier.name}
                        {modifier.priceDeltaCents !== 0 ? <span className="pos-line__modifierPrice">{modifier.priceDeltaCents > 0 ? `+${money(modifier.priceDeltaCents)}` : money(modifier.priceDeltaCents)}</span> : null}
                      </li>
                    ))}
                  </ul>
                ) : null}
                {(componentsByParent.get(line.id) || []).length ? (
                  <ul className="pos-line__components" data-testid={`pos-line-components-${line.id}`}>
                    {(componentsByParent.get(line.id) || []).map((component) => (
                      <li key={component.id} data-testid={`pos-line-component-${component.id}`}>
                        <span className="pos-line__componentName">{component.quantity > 1 ? `${component.quantity} × ` : ""}{component.productName}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
                {line.notes ? <p className="pos-line__note" data-testid={`pos-line-note-${line.id}`}>{line.notes}</p> : null}
                {(line.tagIds || []).length ? <div className="pos-line__tags" data-testid={`pos-line-tags-${line.id}`}>{line.tagIds?.map((tagId) => <span key={tagId} data-ui={`pos-line-tag-${line.id}-${tagId}`}>{tags.find((tag) => tag.id === tagId)?.name || `#${tagId}`}</span>)}</div> : null}
                <span className="pos-line__total" data-testid={`pos-line-total-${line.id}`}>{money(line.lineTotalGrossCents)}</span>
                {splitTickets.length > 1 && onMoveLine ? (
                  <button className="pos-line__move" type="button" disabled={readOnly || !canMoveLine} onClick={(event) => { event.stopPropagation(); onMoveLine(line); }} aria-label={`Mover ${line.productName} a otra cuenta`} title={canMoveLine ? "Mover a otra cuenta" : "No hay otra cuenta abierta"} data-pos-command="move-line" data-testid={`pos-line-move-${line.id}`}><ArrowRightLeft className="h-4 w-4" aria-hidden="true" data-testid={`pos-line-move-icon-${line.id}`} /></button>
                ) : null}
                <button className="pos-line__void" type="button" disabled={readOnly} onClick={(event) => { event.stopPropagation(); onVoidLine(line); }} aria-label={`Anular ${line.productName}`} title="Anular" data-testid={`pos-line-void-${line.id}`}><Trash2 className="h-4 w-4" aria-hidden="true" data-testid={`pos-line-void-icon-${line.id}`} /></button>
              </div>
            ))}
          </div>
          <footer
            className="pos-ticketPanel__total"
            data-ui="pos-total-row"
            data-testid="pos-total-row"
            role="button"
            tabIndex={0}
            aria-expanded={expanded}
            aria-label={expanded ? "Contraer cuenta" : "Ampliar cuenta"}
            onDoubleClick={onToggleExpand}
            onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onToggleExpand?.(); } }}
          >
            <span data-testid="pos-total-label">Total</span>
            <strong data-testid="pos-total-value">{money(ticket.totalGrossCents)}</strong>
          </footer>
          <POSTicketBreakdown ticket={ticket} />
        </>
      ) : (
        <p className="pos-ticketPanel__empty" data-testid="pos-ticket-empty">Selecciona mesa o pulsa Mesa para empezar.</p>
      )}
    </section>
  );
}

/** Subtotal, adjustments and VAT included, shown only when they differ from the plain total. */
function POSTicketBreakdown({ ticket }: { ticket: Ticket }) {
  const rows = [
    { key: "subtotal", label: "Subtotal", cents: ticket.subtotalGrossCents ?? 0, show: (ticket.discountCents || ticket.surchargeCents) ? true : false },
    { key: "discount", label: "Descuento", cents: -(ticket.discountCents ?? 0), show: Boolean(ticket.discountCents) },
    { key: "surcharge", label: "Recargo", cents: ticket.surchargeCents ?? 0, show: Boolean(ticket.surchargeCents) },
    { key: "tax", label: "IVA incluido", cents: ticket.taxCents ?? 0, show: Boolean(ticket.taxCents) },
  ].filter((row) => row.show);
  if (!rows.length) return null;
  return (
    <dl className="pos-ticketPanel__breakdown" data-ui="pos-ticket-breakdown" data-testid="pos-ticket-breakdown">
      {rows.map((row) => (
        <div className="pos-ticketPanel__breakdownRow" key={row.key} data-testid={`pos-ticket-breakdown-${row.key}`}>
          <dt data-testid={`pos-ticket-breakdown-${row.key}-label`}>{row.label}</dt>
          <dd data-testid={`pos-ticket-breakdown-${row.key}-value`}>{money(row.cents)}</dd>
        </div>
      ))}
    </dl>
  );
}
