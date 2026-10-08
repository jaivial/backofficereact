import React, { useEffect, useState } from "react";

import { POSDialog } from "./POSDialog";
import { money, request, type Ticket } from "../../hooks/usePOSRegister";
import { usePOSCustomers, type POSCustomerDraft } from "../../hooks/usePOSCustomers";

const EMPTY: POSCustomerDraft = { displayName: "", phone: "", email: "", taxId: "", notes: "" };

function day(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });
}

/**
 * "Who is this guest, and what do they usually have?" for the check on screen.
 * The link is per CHECK, so on a table split one check per comensal each check
 * can belong to its own person. The history is the server's, derived from paid
 * checks; this dialog never computes money itself.
 */
export function POSGuestHistoryDialog({ ticket, canErase, onClose, onLinked }: {
  ticket: Ticket;
  /** Anonymising is a settings-level action; the button only shows for those who can. */
  canErase?: boolean;
  onClose: () => void;
  onLinked: (ticket: Ticket) => void;
}) {
  const customers = usePOSCustomers();
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<"view" | "search" | "edit">(ticket.customerId ? "view" : "search");
  const [draft, setDraft] = useState<POSCustomerDraft>(EMPTY);
  /** The guest being edited; undefined when the form creates a new one. */
  const [editingId, setEditingId] = useState<number | undefined>(undefined);
  const [linkError, setLinkError] = useState("");
  const { open, search } = customers;

  useEffect(() => { if (ticket.customerId) void open(ticket.customerId); }, [open, ticket.customerId]);
  useEffect(() => {
    if (mode !== "search") return;
    const handle = window.setTimeout(() => void search(query), 250);
    return () => window.clearTimeout(handle);
  }, [mode, query, search]);

  const link = async (customerId: number) => {
    setLinkError("");
    try {
      const data = await request<{ ticket: Ticket }>(`/tickets/${ticket.id}/customer`, { method: "POST", body: JSON.stringify({ customerId }) });
      onLinked(data.ticket);
      if (customerId) { await open(customerId); setMode("view"); } else { customers.setProfile(null); setMode("search"); }
    } catch (reason) { setLinkError(reason instanceof Error ? reason.message : "No se pudo asociar el cliente"); }
  };

  const profile = customers.profile;
  const error = linkError || customers.error;
  const label = ticket.guestLabel ? `Historial · ${ticket.guestLabel}` : "Historial del comensal";

  return (
    <POSDialog testId="pos-guest-history" title={label} busy={customers.busy} error={error} onClose={onClose}>
      <div className="pos-modal__confirm" data-testid="pos-guest-history-body">
        {mode === "view" && profile ? (
          <>
            <div className="pos-modal__choice" data-testid="pos-guest-history-profile">
              <span>
                <strong data-testid="pos-guest-history-name">{profile.displayName}</strong>
                <small>{[profile.phone, profile.email, profile.taxId].filter(Boolean).join(" · ") || "Sin datos de contacto"}</small>
              </span>
            </div>
            {profile.notes ? <p className="pos-modal__pending" role="note" data-testid="pos-guest-history-notes"><strong>Notas:</strong> {profile.notes}</p> : null}
            <p className="pos-modal__pending" data-testid="pos-guest-history-stats">
              {profile.stats.visits} visita(s) · {profile.stats.checks} cuenta(s) · gastado {money(profile.stats.spentCents)} · media {money(profile.stats.averageCheckCents)} · última {day(profile.stats.lastVisitAt)}
            </p>
            {profile.favourites.length ? (
              <p className="pos-modal__pending" data-testid="pos-guest-history-favourites">Suele pedir: {profile.favourites.map((entry) => `${entry.productName} (${entry.quantity})`).join(", ")}</p>
            ) : <p className="pos-modal__pending">Aún sin cuentas pagadas.</p>}
            {profile.history.length ? (
              <ul className="pos-modal__choices" aria-label="Últimas cuentas" data-testid="pos-guest-history-list">
                {profile.history.map((entry) => (
                  <li className="pos-modal__choice" key={entry.ticketId} data-testid={`pos-guest-history-ticket-${entry.ticketId}`}>
                    <span><strong>{entry.ticketNumber}</strong><small>{day(entry.serviceDate)}{entry.tableName ? ` · Mesa ${entry.tableName}` : ""} · {entry.status === "OPEN" ? "abierta" : money(entry.totalGrossCents - entry.refundedCents)}</small></span>
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="pos-modal__modes">
              <button className="pos-modal__secondary" type="button" onClick={() => { setDraft({ displayName: profile.displayName, phone: profile.phone, email: profile.email, taxId: profile.taxId, notes: profile.notes }); setEditingId(profile.id); setMode("edit"); }} data-testid="pos-guest-history-edit">Editar</button>
              <button className="pos-modal__secondary" type="button" onClick={() => void link(0)} data-testid="pos-guest-history-unlink">Quitar de esta cuenta</button>
              {canErase ? <button className="pos-modal__secondary" type="button" onClick={() => { if (window.confirm(`¿Anonimizar a ${profile.displayName}? Se borran sus datos personales y notas; las cuentas pagadas se conservan.`)) void customers.anonymise(profile.id).then((done) => { if (done) { setMode("search"); onLinked({ ...ticket, customerId: null, customerName: "", customerNotes: "" }); } }); }} data-testid="pos-guest-history-erase">Anonimizar</button> : null}
            </div>
          </>
        ) : null}

        {mode === "search" ? (
          <>
            <label className="pos-modal__covers" htmlFor="pos-guest-history-q">
              Buscar por nombre, teléfono, email o NIF
              <input id="pos-guest-history-q" autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Ana, 600…" data-testid="pos-guest-history-q" />
            </label>
            <ul className="pos-modal__choices" aria-label="Clientes" data-testid="pos-guest-history-results">
              {customers.results.map((entry) => (
                <li key={entry.id}>
                  <button className="pos-modal__choice" type="button" style={{ width: "100%", textAlign: "left" }} onClick={() => void link(entry.id)} data-testid={`pos-guest-history-pick-${entry.id}`}>
                    <span><strong>{entry.displayName}</strong><small>{[entry.phone, entry.email].filter(Boolean).join(" · ")}{entry.visits ? ` · ${entry.visits} visita(s), última ${day(entry.lastVisitAt)}` : " · sin visitas pagadas"}</small></span>
                  </button>
                </li>
              ))}
            </ul>
            {!customers.results.length && query.trim() ? <p className="pos-modal__empty">Sin resultados.</p> : null}
            <button className="pos-modal__secondary" type="button" onClick={() => { const looksLikePhone = /^[+\d\s().-]{6,}$/.test(query.trim()); setDraft({ ...EMPTY, displayName: looksLikePhone ? "" : query.trim(), phone: looksLikePhone ? query.trim() : "" }); setEditingId(undefined); setMode("edit"); }} data-testid="pos-guest-history-new">Nuevo cliente</button>
          </>
        ) : null}

        {mode === "edit" ? (
          <>
            {(["displayName", "phone", "email", "taxId"] as const).map((field) => (
              <label className="pos-modal__covers" htmlFor={`pos-guest-history-${field}`} key={field}>
                {{ displayName: "Nombre", phone: "Teléfono", email: "Email", taxId: "NIF/CIF" }[field]}
                <input id={`pos-guest-history-${field}`} inputMode={field === "phone" ? "tel" : field === "email" ? "email" : "text"} value={draft[field]} onChange={(event) => setDraft((current) => ({ ...current, [field]: event.target.value }))} data-testid={`pos-guest-history-${field}`} />
              </label>
            ))}
            <label className="pos-modal__covers" htmlFor="pos-guest-history-notesInput">
              Notas (preferencias, alergias)
              <textarea id="pos-guest-history-notesInput" maxLength={1000} value={draft.notes} onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))} data-testid="pos-guest-history-notesInput" />
            </label>
            <p className="pos-modal__pending">Una alergia es un dato de salud (RGPD art. 9): apúntala solo si el cliente lo pide; «Anonimizar» la borra.</p>
            {customers.existing ? <button className="pos-modal__secondary" type="button" onClick={() => void link(customers.existing!.id)} data-testid="pos-guest-history-use-existing">Usar {customers.existing.displayName}</button> : null}
            <div className="pos-modal__modes">
              <button className="pos-modal__secondary" type="button" onClick={() => setMode(editingId && profile ? "view" : "search")} data-testid="pos-guest-history-cancel">Cancelar</button>
              <button className="pos-modal__primary" type="button" disabled={customers.busy || !draft.displayName.trim()} onClick={() => void customers.save(draft, editingId).then((saved) => { if (saved) { if (saved.id !== ticket.customerId) void link(saved.id); else setMode("view"); } })} data-testid="pos-guest-history-save">Guardar</button>
            </div>
          </>
        ) : null}
      </div>
    </POSDialog>
  );
}
