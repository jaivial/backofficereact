import React, { useMemo } from "react";
import { ArrowRightLeft, Merge, Minus, Plus, Receipt, Trash2, Users, X } from "lucide-react";
import { StatusBadge } from "../../../../../ui/feedback/StatusBadge";
import { cn } from "../../../../../ui/shadcn/utils";
import { money, type Operator, type Tag, type Ticket, type TicketLine, type Visit } from "../../hooks/usePOSRegister";

export function POSTicketPanel({ ticket, visit, operators = [], tags = [], activeTicketLines, selectedLineId, onSelectLine, onLineQuantity, onVoidLine, onRequestTable, expanded = false, onToggleExpand, splitTickets = [], sentKitchenQuantities = {}, onSelectTicket, onMoveLine, onMergeSplitTickets, onDeleteEmptyTicket, busy = false, readOnly = false }: {
  ticket: Ticket | null;
  visit: Visit | null;
  operators?: Operator[];
  tags?: Tag[];
  activeTicketLines: TicketLine[];
  selectedLineId: number;
  onSelectLine: (line: TicketLine) => void;
  onLineQuantity: (line: TicketLine, quantity: number) => void;
  onVoidLine: (line: TicketLine) => void;
  onRequestTable?: () => void;
  expanded?: boolean;
  onToggleExpand?: () => void;
  splitTickets?: Ticket[];
  sentKitchenQuantities?: Record<number, number>;
  onSelectTicket?: (next: Ticket) => void;
  onMoveLine?: (line: TicketLine) => void;
  onMergeSplitTickets?: () => void;
  onDeleteEmptyTicket?: (ticket: Ticket) => void;
  busy?: boolean;
  /** Sealed day: the ticket is query-only, so every line action stays disabled. */
  readOnly?: boolean;
}) {
  const isOpen = (ticket?.status ?? visit?.status) === "OPEN";
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
        {visit ? (
          <span className="pos-ticketPanel__meta" data-ui="pos-ticket-meta" data-testid="pos-ticket-meta">
            <StatusBadge variant={isOpen ? "success" : "neutral"} size="sm" data-ui="pos-ticket-status" data-testid="pos-ticket-status">{isOpen ? "Abierta" : "Cerrada"}</StatusBadge>
            <span className="pos-ticketPanel__covers" data-ui="pos-ticket-covers" data-testid="pos-ticket-covers"><Users className="mr-1 inline h-4 w-4" aria-hidden="true" data-testid="pos-ticket-covers-icon" />{visit.covers}</span>
          </span>
        ) : null}
      </header>
      {ticket ? (
        <>
          <div className="pos-ticketPanel__details" data-testid="pos-ticket-details">
            <span data-testid="pos-ticket-channel">{visit?.channel === "BAR" ? "Barra" : visit?.tableName || "Salón"}</span>
            {visit?.customerName ? <span data-testid="pos-ticket-customer">Cliente: {visit.customerName}{visit.customerTaxId ? ` · ${visit.customerTaxId}` : ""}</span> : null}
            {ticket.operatorMemberId ? <span data-testid="pos-ticket-operator">Empleado: {operators.find((entry) => entry.id === ticket.operatorMemberId)?.displayName || `#${ticket.operatorMemberId}`}</span> : null}
            {ticket.discountCents ? <span data-testid="pos-ticket-discount">Descuento: {money(ticket.discountCents)}</span> : null}
            {ticket.surchargeCents ? <span data-testid="pos-ticket-surcharge">Recargo: {money(ticket.surchargeCents)}</span> : null}
          </div>
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
            {activeTicketLines.map((line) => (
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
                  <button className="pos-line__qtyBtn" type="button" disabled={readOnly} onClick={(event) => { event.stopPropagation(); onLineQuantity(line, line.quantity - 1); }} aria-label={`Restar ${line.productName}`} data-testid={`pos-line-minus-${line.id}`}><Minus className="h-4 w-4" aria-hidden="true" data-testid={`pos-line-minus-icon-${line.id}`} /></button>
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
                {line.notes ? <p className="pos-line__note" data-testid={`pos-line-note-${line.id}`}>{line.notes}</p> : null}
                {(line.tagIds || []).length ? <div className="pos-line__tags" data-testid={`pos-line-tags-${line.id}`}>{line.tagIds?.map((tagId) => <span key={tagId} data-ui={`pos-line-tag-${line.id}-${tagId}`}>{tags.find((tag) => tag.id === tagId)?.name || `#${tagId}`}</span>)}</div> : null}
                <span className="pos-line__total" data-testid={`pos-line-total-${line.id}`}>{money(line.lineTotalGrossCents)}</span>
                {splitTickets.length > 1 && onMoveLine ? (
                  <button className="pos-line__move" type="button" disabled={readOnly} onClick={(event) => { event.stopPropagation(); onMoveLine(line); }} aria-label={`Mover ${line.productName} a otra cuenta`} title="Mover a otra cuenta" data-testid={`pos-line-move-${line.id}`}><ArrowRightLeft className="h-4 w-4" aria-hidden="true" data-testid={`pos-line-move-icon-${line.id}`} /></button>
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
        </>
      ) : (
        <p className="pos-ticketPanel__empty" data-testid="pos-ticket-empty">Selecciona mesa o pulsa Mesa para empezar.</p>
      )}
    </section>
  );
}
