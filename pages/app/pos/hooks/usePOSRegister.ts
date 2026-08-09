import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { allocatePayments } from "../utils/paymentAllocation";
import { isValidCustomerTaxId, normalizeCustomerTaxId } from "../utils/customerTaxId";
import type { Area, Bootstrap, Operator, Product, Reservation, RestaurantProfile, Settings, ShiftSummary, Table, Tag, Ticket, TicketLine, Visit } from "../types/register";

export type { Area, Bootstrap, Operator, Product, Reservation, RestaurantProfile, Settings, ShiftSummary, Table, Tag, Ticket, TicketLine, Visit } from "../types/register";

export const DEFAULT_SETTINGS: Settings = { isEnabled: false, stockMode: "OFF", coversMode: "MANUAL", timezone: "Europe/Madrid", businessDayCutoff: "05:00", autoCloseVisit: true, receiptPrefix: "TPV" };

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set("Content-Type", "application/json");
  const response = await fetch(`/api/admin/pos${path}`, { ...init, credentials: "include", headers });
  const body = await response.json();
  if (!response.ok || !body.success) throw new Error(body.message || "Error de TPV");
  return body as T;
}

export function money(cents: number): string {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format((cents || 0) / 100);
}

/**
 * Register state for the POS sell screen: bootstrap data, current visit/ticket,
 * split tickets, payments and kitchen dispatch. Extracted from pos.tsx.
 */
export function usePOSRegister(date?: string | null) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [products, setProducts] = useState<Product[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [restaurant, setRestaurant] = useState<RestaurantProfile | null>(null);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [currentShift, setCurrentShift] = useState<ShiftSummary | null>(null);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [visit, setVisit] = useState<Visit | null>(null);
  const [lastPaidTicket, setLastPaidTicket] = useState<Ticket | null>(null);
  const [splitTickets, setSplitTickets] = useState<Ticket[]>([]);
  const [splitTargetId, setSplitTargetId] = useState(0);
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [covers, setCovers] = useState("2");
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [reservationsLoading, setReservationsLoading] = useState(false);
  const [reservationsLoaded, setReservationsLoaded] = useState(false);
  const [bookingId, setBookingId] = useState(0);
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [cash, setCash] = useState("");
  const [card, setCard] = useState("");
  const [cardReference, setCardReference] = useState("");
  const [discount, setDiscount] = useState("");
  const [sentKitchenQuantities, setSentKitchenQuantities] = useState<Record<number, number>>({});
  const [tags, setTags] = useState<Tag[]>([]);
  const [lineTags, setLineTags] = useState<Record<number, number[]>>({});
  const [tipCents, setTipCents] = useState(0);
  const checkoutInFlight = useRef(false);
  const commandInFlight = useRef(new Set<string>());
  const commandKeys = useRef(new Map<string, string>());

  const load = useCallback(async () => {
    setError("");
    try {
      const data = await request<Bootstrap>(date ? `/bootstrap?date=${encodeURIComponent(date)}` : "/bootstrap");
      setSettings(data.settings || DEFAULT_SETTINGS); setProducts(data.products || []); setTables(data.tables || []); setAreas(data.areas || []); setRestaurant(data.restaurant || null); setVisits(data.visits || []); setOperators(data.operators || []); setCurrentShift(data.currentShift || null);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo cargar TPV"); }
  }, [date]);
  useEffect(() => { void load(); }, [load]);

  const filteredProducts = useMemo(() => products.filter((product) => product.isActive && product.name.toLowerCase().includes(query.trim().toLowerCase())), [products, query]);
  const ticketTotal = ticket?.totalGrossCents || 0;
  const activeTicketLines = useMemo(() => ticket?.lines.filter((line) => line.status !== "VOIDED") || [], [ticket]);
  const openSplitTickets = useMemo(() => splitTickets.filter((entry) => entry.status === "OPEN"), [splitTickets]);
  const otherOpenSplitTickets = useMemo(() => openSplitTickets.filter((entry) => entry.id !== ticket?.id), [openSplitTickets, ticket?.id]);
  const pendingKitchenLines = useMemo(() => activeTicketLines.filter((line) => line.quantity > (sentKitchenQuantities[line.id] || 0)), [activeTicketLines, sentKitchenQuantities]);
  const hasPendingKitchenLines = pendingKitchenLines.length > 0;
  const paymentTotal = useMemo(() => {
    const cashValue = Number(cash || 0);
    const cardValue = Number(card || 0);
    return Number.isFinite(cashValue) && Number.isFinite(cardValue) && cashValue >= 0 && cardValue >= 0 ? Math.round((cashValue + cardValue) * 100) : -1;
  }, [card, cash]);
  const amountDueCents = ticketTotal + tipCents;
  const changeDue = useMemo(() => Math.max(paymentTotal - amountDueCents, 0), [amountDueCents, paymentTotal]);

  const loadReservations = useCallback(async () => {
    setReservationsLoading(true); setReservationsLoaded(false);
    try { const data = await request<{ items: Reservation[] }>("/reservations/eligible"); setReservations(data.items || []); setReservationsLoaded(true); }
    catch (reason) { setReservations([]); setReservationsLoaded(true); setError(reason instanceof Error ? reason.message : "No se pudieron cargar reservas"); }
    finally { setReservationsLoading(false); }
  }, []);
  const selectReservation = useCallback((id: number) => { setBookingId(id); const reservation = reservations.find((item) => item.id === id); if (reservation) setCovers(String(reservation.partySize)); }, [reservations]);

  const openVisit = useCallback(async () => {
    if (!selectedTable || Number(covers) <= 0) return;
    setBusy(true); setError("");
    try {
      const data = await request<{ visit: Visit; ticket: Ticket }>("/visits", { method: "POST", body: JSON.stringify({ channel: "DINE_IN", tableId: selectedTable.id, bookingId: bookingId || undefined, covers: Number(covers), idempotencyKey: crypto.randomUUID() }) });
      setVisit(data.visit); setTicket(data.ticket); setSplitTickets([data.ticket]); setSentKitchenQuantities({}); setSelectedTable(null); setBookingId(0); setReservations([]); setMessage(`Mesa abierta con ${covers} comensales.`); await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo abrir la mesa"); } finally { setBusy(false); }
  }, [bookingId, covers, load, selectedTable]);

  const openTakeaway = useCallback(async () => {
    setBusy(true); setError("");
    try { const data = await request<{ visit: Visit; ticket: Ticket }>("/visits", { method: "POST", body: JSON.stringify({ channel: "TAKEAWAY", covers: 0, idempotencyKey: crypto.randomUUID() }) }); setVisit(data.visit); setTicket(data.ticket); setSplitTickets([data.ticket]); setSentKitchenQuantities({}); setMessage("Venta para llevar abierta."); await load(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo abrir venta para llevar"); } finally { setBusy(false); }
  }, [load]);

  const moveVisitToTable = useCallback(async (table: Table) => {
    if (!visit || table.id === visit.tableId) return;
    if (table.occupied) { setError("La mesa está ocupada."); return; }
    setBusy(true); setError("");
    try {
      await request(`/visits/${visit.id}`, { method: "PATCH", body: JSON.stringify({ tableId: table.id, covers: visit.covers }) });
      setVisit((current) => current ? { ...current, tableId: table.id, tableName: table.name } : current);
      setMessage(`Comanda movida a ${table.name}.`);
      await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo cambiar de mesa"); }
    finally { setBusy(false); }
  }, [load, visit]);

  const restoreVisit = useCallback(async (openVisitEntry: Visit) => {
    try { const data = await request<{ visit: Visit & { tickets: Ticket[] } }>(`/visits/${openVisitEntry.id}`); const openTicket = data.visit.tickets?.find((entry) => entry.status === "OPEN") || data.visit.tickets?.[0]; setVisit(data.visit); setSplitTickets(data.visit.tickets || []); setTicket(openTicket || null); setSentKitchenQuantities({}); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo recuperar la cuenta"); }
  }, []);

  const restoreParkedVisit = useCallback(async (visitId: number) => {
    if (commandInFlight.current.has("restore")) return false;
    commandInFlight.current.add("restore"); setError("");
    try {
      await request(`/visits/${visitId}/park`, { method: "POST", body: JSON.stringify({ parked: false, note: "" }) });
      const data = await request<{ visit: Visit & { tickets: Ticket[] } }>(`/visits/${visitId}`);
      const openTicket = data.visit.tickets?.find((entry) => entry.status === "OPEN") || data.visit.tickets?.[0];
      setVisit(data.visit); setSplitTickets(data.visit.tickets || []); setTicket(openTicket || null); setSentKitchenQuantities({}); setTipCents(0); setMessage("Comanda recuperada."); await load(); return true;
    } catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo recuperar la cuenta"); return false; }
    finally { commandInFlight.current.delete("restore"); }
  }, [load]);

  const switchTicket = useCallback((next: Ticket) => { setTicket(next); setSplitTargetId(0); setCash(""); setCard(""); setCardReference(""); setTipCents(0); }, []);
  const voidEmptyTicket = useCallback(async (next: Ticket) => { if (next.lines.filter((line) => line.status !== "VOIDED").length) return; try { await request(`/tickets/${next.id}/void`, { method: "POST", body: JSON.stringify({ reason: "Cuenta separada vacía" }) }); setSplitTickets((current) => current.filter((entry) => entry.id !== next.id)); if (ticket?.id === next.id) { const fallback = splitTickets.find((entry) => entry.id !== next.id && entry.status === "OPEN"); setTicket(fallback || null); } } catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo anular cuenta"); } }, [splitTickets, ticket]);
  const createSplitTicket = useCallback(async () => { if (!visit) return; try { const data = await request<{ ticket: Ticket }>(`/visits/${visit.id}/tickets`, { method: "POST", body: JSON.stringify({ idempotencyKey: crypto.randomUUID() }) }); setSplitTickets((current) => [...current, data.ticket]); setSplitTargetId(data.ticket.id); setMessage("Cuenta separada creada."); } catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo separar cuenta"); } }, [visit]);
  const moveLine = useCallback(async (line: TicketLine, quantity = line.quantity) => { if (!ticket || !splitTargetId) return; const moved = Math.min(Math.round(quantity), line.quantity); if (moved <= 0) return; try { const data = await request<{ sourceTicket: Ticket; targetTicket: Ticket }>(`/tickets/${ticket.id}/lines/${line.id}/move`, { method: "POST", body: JSON.stringify({ targetTicketId: splitTargetId, quantity: moved, idempotencyKey: crypto.randomUUID() }) }); setTicket(data.sourceTicket); setSplitTickets((current) => current.map((entry) => entry.id === data.sourceTicket.id ? data.sourceTicket : entry.id === data.targetTicket.id ? data.targetTicket : entry)); } catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo mover línea"); } }, [splitTargetId, ticket]);

  const mergeSplitTickets = useCallback(async () => {
    if (!ticket || openSplitTickets.length <= 1) return false;
    if (commandInFlight.current.has("merge-splits")) return false;
    commandInFlight.current.add("merge-splits");
    setBusy(true); setError("");
    try {
      const sourceTickets = openSplitTickets.filter((t) => t.id !== ticket.id);
      let currentTicket = ticket;
      for (const sourceTicket of sourceTickets) {
        const activeLines = sourceTicket.lines.filter((line) => line.status !== "VOIDED");
        for (const line of activeLines) {
          const data = await request<{ sourceTicket: Ticket; targetTicket: Ticket }>(`/tickets/${sourceTicket.id}/lines/${line.id}/move`, { method: "POST", body: JSON.stringify({ targetTicketId: ticket.id, quantity: line.quantity, idempotencyKey: crypto.randomUUID() }) });
          currentTicket = data.targetTicket;
        }
        await request(`/tickets/${sourceTicket.id}/void`, { method: "POST", body: JSON.stringify({ reason: "Cuentas reagrupadas" }) });
      }
      setTicket(currentTicket);
      setSplitTickets([currentTicket]);
      setSplitTargetId(0);
      setMessage("Cuentas reagrupadas.");
      return true;
    } catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudieron reagrupar las cuentas"); return false; }
    finally { commandInFlight.current.delete("merge-splits"); setBusy(false); }
  }, [openSplitTickets, ticket]);

  const clearRegister = useCallback(() => {
    setTicket(null); setVisit(null); setSplitTickets([]); setSplitTargetId(0);
    setSentKitchenQuantities({}); setCash(""); setCard(""); setCardReference(""); setTipCents(0);
  }, []);

  const parkVisit = useCallback(async (parked: boolean, note = "") => {
    if (!visit) return false;
    setBusy(true); setError("");
    try {
      await request(`/visits/${visit.id}/park`, { method: "POST", body: JSON.stringify({ parked, note: note.trim() }) });
      if (parked) { clearRegister(); setMessage("Comanda aparcada."); } else setMessage("Comanda recuperada.");
      await load(); return true;
    } catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo aparcar la comanda"); return false; }
    finally { setBusy(false); }
  }, [clearRegister, load, visit]);

  const openBar = useCallback(async () => {
    if (visit || commandInFlight.current.has("bar")) return false;
    commandInFlight.current.add("bar");
    setBusy(true); setError("");
    try {
      const key = commandKeys.current.get("bar") || crypto.randomUUID(); commandKeys.current.set("bar", key);
      const data = await request<{ visit: Visit; ticket: Ticket }>("/visits", { method: "POST", body: JSON.stringify({ channel: "BAR", covers: 0, idempotencyKey: key }) });
      setVisit(data.visit); setTicket(data.ticket); setSplitTickets([data.ticket]); setSentKitchenQuantities({});
      setMessage("Venta de barra abierta."); commandKeys.current.delete("bar"); await load(); return true;
    } catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo abrir la barra"); return false; }
    finally { commandInFlight.current.delete("bar"); setBusy(false); }
  }, [load, visit]);

  const mergeVisits = useCallback(async (sourceVisitIds: number[]) => {
    const uniqueSourceIds = [...new Set(sourceVisitIds)].filter((id) => id !== visit?.id);
    if (!visit || !uniqueSourceIds.length || commandInFlight.current.has("merge")) return false;
    commandInFlight.current.add("merge");
    setBusy(true); setError("");
    try {
      const key = commandKeys.current.get("merge") || crypto.randomUUID(); commandKeys.current.set("merge", key);
      const data = await request<{ ticket?: Ticket; tickets?: Ticket[]; visit?: Visit; covers?: number }>(`/visits/${visit.id}/merge`, { method: "POST", body: JSON.stringify({ sourceVisitIds: uniqueSourceIds, expectedVersion: ticket?.version, idempotencyKey: key }) });
      const authoritativeTickets = data.tickets || (data.ticket ? [data.ticket] : undefined);
      if (authoritativeTickets) { setSplitTickets(authoritativeTickets); setTicket(authoritativeTickets.find((entry) => entry.status === "OPEN") || authoritativeTickets[0] || null); }
      setVisit((current) => data.visit || (current && data.covers != null ? { ...current, covers: data.covers } : current));
      commandKeys.current.delete("merge"); setMessage("Mesas juntadas."); await load(); return true;
    } catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudieron juntar las mesas"); return false; }
    finally { commandInFlight.current.delete("merge"); setBusy(false); }
  }, [load, ticket?.version, visit]);

  const applyAdjustment = useCallback(async (type: "DISCOUNT" | "SURCHARGE", mode: "AMOUNT" | "PERCENT", value: number, reason: string) => {
    if (!ticket) return false;
    const trimmed = reason.trim();
    if (!trimmed) { setError("Indica el motivo."); return false; }
    if (value <= 0) { setError("Introduce un importe válido."); return false; }
    const command = `adjustment-${type}`;
    if (commandInFlight.current.has(command)) return false;
    commandInFlight.current.add(command);
    setError("");
    try {
      const key = commandKeys.current.get(command) || crypto.randomUUID(); commandKeys.current.set(command, key);
      const common = { type, mode, reason: trimmed, expectedVersion: ticket.version, idempotencyKey: key };
      const body = mode === "PERCENT" ? { ...common, percent: value } : { ...common, amountCents: Math.round(value) };
      const data = await request<{ ticket: Ticket }>(`/tickets/${ticket.id}/adjustments`, { method: "POST", body: JSON.stringify(body) });
      setTicket(data.ticket); commandKeys.current.delete(command); return true;
    } catch (reasonValue) { setError(reasonValue instanceof Error ? reasonValue.message : "No se pudo aplicar el ajuste"); return false; }
    finally { commandInFlight.current.delete(command); }
  }, [ticket]);

  const compLine = useCallback(async (line: TicketLine, comped: boolean, reason = "") => {
    if (!ticket) return false;
    const trimmed = reason.trim();
    if (comped && !trimmed) { setError("Indica el motivo de la invitación."); return false; }
    setError("");
    try {
      const data = await request<{ ticket: Ticket }>(`/tickets/${ticket.id}/lines/${line.id}/comp`, { method: "POST", body: JSON.stringify({ comped, reason: trimmed, expectedVersion: ticket.version }) });
      setTicket(data.ticket); return true;
    } catch (reasonValue) { setError(reasonValue instanceof Error ? reasonValue.message : "No se pudo invitar la línea"); return false; }
  }, [ticket]);

  const setLineNote = useCallback(async (line: TicketLine, note: string) => {
    if (!ticket) return false;
    setError("");
    try {
      const data = await request<{ ticket: Ticket }>(`/tickets/${ticket.id}/lines/${line.id}`, { method: "PATCH", body: JSON.stringify({ quantity: line.quantity, notes: note.trim(), expectedVersion: ticket.version }) });
      setTicket(data.ticket); return true;
    } catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo guardar el comentario"); return false; }
  }, [ticket]);

  const openDrawer = useCallback(async (reason = "NO_SALE", note = "") => {
    if (settings.requireOpenShift && currentShift?.status !== "OPEN") { setError("Abre un turno antes de usar el cajón."); return false; }
    if (commandInFlight.current.has("drawer")) return false;
    commandInFlight.current.add("drawer");
    setError("");
    try {
      const key = commandKeys.current.get("drawer") || crypto.randomUUID(); commandKeys.current.set("drawer", key);
      await request("/drawer/open", { method: "POST", body: JSON.stringify({ reason, note: note.trim(), idempotencyKey: key }) });
      commandKeys.current.delete("drawer"); setMessage("Cajón abierto."); return true;
    } catch (reasonValue) { setError(reasonValue instanceof Error ? reasonValue.message : "No se pudo abrir el cajón"); return false; }
    finally { commandInFlight.current.delete("drawer"); }
  }, [currentShift?.status, settings.requireOpenShift]);

  const setVisitCustomer = useCallback(async (customerName: string, customerTaxId: string) => {
    if (!visit) return false;
    setError("");
    const normalizedTaxId = normalizeCustomerTaxId(customerTaxId);
    if (!customerName.trim()) { setError("Indica el nombre del cliente."); return false; }
    if (!isValidCustomerTaxId(normalizedTaxId)) { setError("NIF/CIF no válido."); return false; }
    try {
      const data = await request<{ visit?: Visit }>(`/visits/${visit.id}/customer`, { method: "PATCH", body: JSON.stringify({ customerName: customerName.trim(), customerTaxId: normalizedTaxId }) });
      setVisit((current) => data.visit || (current ? { ...current, customerName: customerName.trim(), customerTaxId: normalizedTaxId } : current));
      setMessage("Cliente asignado."); return true;
    } catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo asignar el cliente"); return false; }
  }, [visit]);

  const setTicketOperator = useCallback(async (operatorMemberId: number) => {
    if (!ticket) return false;
    if (operatorMemberId > 0 && !operators.some((entry) => entry.id === operatorMemberId && entry.isActive !== false)) { setError("Empleado no válido."); return false; }
    setError("");
    try {
      const data = await request<{ ticket?: Ticket }>(`/tickets/${ticket.id}/operator`, { method: "PATCH", body: JSON.stringify({ operatorMemberId }) });
      setTicket((current) => data.ticket || (current ? { ...current, operatorMemberId } : current));
      setMessage("Empleado asignado."); return true;
    } catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo asignar el empleado"); return false; }
  }, [operators, ticket]);

  const toggleLineTag = useCallback(async (line: TicketLine, tagId: number, attach: boolean) => {
    if (!ticket) return false;
    setError("");
    try {
      const data = await request<{ ticket?: Ticket }>(`/tickets/${ticket.id}/lines/${line.id}/tags`, { method: "POST", body: JSON.stringify({ tagId, attach }) });
      setTicket((current) => data.ticket || (current ? { ...current, lines: current.lines.map((entry) => entry.id === line.id ? { ...entry, tagIds: attach ? [...new Set([...(entry.tagIds || []), tagId])] : (entry.tagIds || []).filter((id) => id !== tagId) } : entry) } : current));
      setLineTags((current) => {
        const existing = current[line.id] || [];
        return { ...current, [line.id]: attach ? [...new Set([...existing, tagId])] : existing.filter((id) => id !== tagId) };
      }); return true;
    } catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo etiquetar"); return false; }
  }, [ticket]);

  const loadTags = useCallback(async () => {
    try { const data = await request<{ items: Tag[] }>("/tags"); setTags(data.items || []); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudieron cargar etiquetas"); }
  }, []);

  const addProduct = useCallback(async (product: Product, options?: { quantity?: number; unitPriceOverrideCents?: number }) => {
    if (!ticket) return;
    setBusy(true);
    const qty = options?.quantity ?? 1;
    const priceOverride = options?.unitPriceOverrideCents;
    // Merge into existing line only if the unit price matches:
    // - If price override: find line with same product AND same overridden price
    // - If no override: find line with same product AND catalog price
    const targetPrice = priceOverride ?? product.priceGrossCents;
    const existing = ticket.lines.find((line) => line.status !== "VOIDED" && (line.productId === product.id || (line.productId == null && line.productName === product.name)) && line.unitPriceGrossCents === targetPrice);
    try {
      const data = existing
        ? await request<{ ticket: Ticket }>(`/tickets/${ticket.id}/lines/${existing.id}`, { method: "PATCH", body: JSON.stringify({ quantity: existing.quantity + qty, expectedVersion: ticket.version }) })
        : await request<{ ticket: Ticket }>(`/tickets/${ticket.id}/lines`, { method: "POST", body: JSON.stringify({ productId: product.id, quantity: qty, ...(priceOverride != null && { unitPriceOverrideCents: priceOverride }), idempotencyKey: crypto.randomUUID() }) });
      setTicket(data.ticket);
    }
    catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo añadir producto"); } finally { setBusy(false); }
  }, [ticket]);

  const setLineQuantity = useCallback(async (line: TicketLine, quantity: number) => {
    if (!ticket || quantity <= 0) return;
    try { const data = await request<{ ticket: Ticket }>(`/tickets/${ticket.id}/lines/${line.id}`, { method: "PATCH", body: JSON.stringify({ quantity, expectedVersion: ticket.version }) }); setTicket(data.ticket); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo cambiar cantidad"); }
  }, [ticket]);

  const voidLine = useCallback(async (line: TicketLine, reason = "Error al introducir") => {
    if (!ticket) return; const trimmed = reason.trim(); if (!trimmed) return;
    try { const data = await request<{ ticket: Ticket }>(`/tickets/${ticket.id}/lines/${line.id}/void`, { method: "POST", body: JSON.stringify({ reason: trimmed }) }); setTicket(data.ticket); }
    catch (reasonValue) { setError(reasonValue instanceof Error ? reasonValue.message : "No se pudo anular línea"); }
  }, [ticket]);

  const voidOrder = useCallback(async (reason: string) => {
    if (!ticket || !visit) return;
    const trimmed = reason.trim();
    if (!trimmed) return;
    setBusy(true); setError("");
    try {
      for (const line of ticket.lines.filter((entry) => entry.status !== "VOIDED")) {
        await request(`/tickets/${ticket.id}/lines/${line.id}/void`, { method: "POST", body: JSON.stringify({ reason: trimmed }) });
      }
      await request(`/tickets/${ticket.id}/void`, { method: "POST", body: JSON.stringify({ reason: trimmed }) });
      await request(`/visits/${visit.id}/cancel`, { method: "POST", body: JSON.stringify({ reason: trimmed }) });
      setTicket(null); setVisit(null); setSplitTickets([]); setSplitTargetId(0); setSentKitchenQuantities({});
      setCash(""); setCard(""); setCardReference("");
      setMessage("Comanda borrada.");
      await load();
    } catch (reasonValue) { setError(reasonValue instanceof Error ? reasonValue.message : "No se pudo borrar la comanda"); }
    finally { setBusy(false); }
  }, [load, ticket, visit]);

  const applyDiscount = useCallback(async (amountCents: number, reason: string) => {
    if (!ticket) return;
    const trimmed = reason.trim();
    const amount = Math.min(Math.max(Math.round(amountCents), 0), ticket.totalGrossCents + (ticket.discountCents || 0));
    if (amount > 0 && !trimmed) { setError("Indica el motivo del descuento."); return; }
    setError("");
    try { const data = await request<{ ticket: Ticket }>(`/tickets/${ticket.id}/discount`, { method: "POST", body: JSON.stringify({ amountCents: amount, reason: trimmed }) }); setTicket(data.ticket); setDiscount(""); }
    catch (reasonValue) { setError(reasonValue instanceof Error ? reasonValue.message : "No se pudo aplicar descuento"); }
  }, [ticket]);

  const sendKitchen = useCallback(async () => {
    if (!ticket || !pendingKitchenLines.length) return;
    const dispatched = pendingKitchenLines.map((line) => [line.id, line.quantity] as const);
    try {
      await request(`/tickets/${ticket.id}/kitchen-dispatches`, { method: "POST", body: JSON.stringify({ idempotencyKey: crypto.randomUUID() }) });
      setSentKitchenQuantities((current) => ({ ...current, ...Object.fromEntries(dispatched) }));
      setMessage(`Comanda enviada a cocina · ${dispatched.length} línea(s).`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo enviar a cocina"); }
  }, [pendingKitchenLines, ticket]);

  const checkout = useCallback(async (requestedTipCents = tipCents) => {
    const checkoutDue = ticketTotal + requestedTipCents;
    if (!ticket || ticketTotal < 0 || paymentTotal < checkoutDue) { setError("El pago no cubre el total."); return false; }
    if (checkoutInFlight.current) return false;
    let allocations;
    try { allocations = allocatePayments({ saleTotalCents: ticketTotal, tipCents: requestedTipCents, cashTenderedCents: Math.round(Number(cash || 0) * 100), cardTenderedCents: Math.round(Number(card || 0) * 100) }); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Importe no válido."); return false; }
    if (allocations.some((payment) => payment.method === "CARD") && !cardReference.trim()) { setError("Introduce referencia del terminal de tarjeta."); return false; }
    const checkoutKey = commandKeys.current.get("checkout") || crypto.randomUUID(); commandKeys.current.set("checkout", checkoutKey);
    const payments = allocations.map((payment) => {
      const keyName = `checkout-${payment.method}`;
      const idempotencyKey = commandKeys.current.get(keyName) || crypto.randomUUID(); commandKeys.current.set(keyName, idempotencyKey);
      return payment.method === "CARD" ? { ...payment, provider: "STANDALONE", providerReference: cardReference.trim(), idempotencyKey } : { ...payment, idempotencyKey };
    });
    checkoutInFlight.current = true;
    setBusy(true);
    try { const data = await request<{ ticket: Ticket; stockStatus: string; visitClosed: boolean }>(`/tickets/${ticket.id}/checkout`, { method: "POST", body: JSON.stringify({ idempotencyKey: checkoutKey, expectedVersion: ticket.version, payments, closeVisit: true }) }); setMessage(`Venta completada · stock ${data.stockStatus.toLowerCase()}.`); setLastPaidTicket(data.ticket); const nextOpen = splitTickets.find((entry) => entry.id !== ticket.id && entry.status === "OPEN") || null; if (data.visitClosed) { setTicket(null); setVisit(null); setSplitTickets([]); setSentKitchenQuantities({}); } else { setTicket(nextOpen); setSplitTickets((current) => current.map((entry) => entry.id === data.ticket.id ? data.ticket : entry)); } setCash(""); setCard(""); setCardReference(""); setTipCents(0); commandKeys.current.delete("checkout"); commandKeys.current.delete("checkout-CASH"); commandKeys.current.delete("checkout-CARD"); await load(); return true; }
    catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo cobrar"); return false; } finally { checkoutInFlight.current = false; setBusy(false); }
  }, [card, cardReference, cash, load, paymentTotal, splitTickets, ticket, ticketTotal, tipCents]);

  return {
    settings, setSettings, products, tables, visits, ticket, visit, lastPaidTicket,
    splitTickets, splitTargetId, setSplitTargetId, selectedTable, setSelectedTable,
    covers, setCovers, reservations, reservationsLoading, reservationsLoaded, bookingId, query, setQuery,
    message, setMessage, error, setError, busy,
    cash, setCash, card, setCard, cardReference, setCardReference, discount, setDiscount,
    filteredProducts, ticketTotal, activeTicketLines, openSplitTickets, otherOpenSplitTickets, paymentTotal,
    pendingKitchenLines, hasPendingKitchenLines, sentKitchenQuantities,
    changeDue, amountDueCents, tipCents, setTipCents,
    areas, restaurant, operators, currentShift, tags, lineTags,
    load, loadReservations, selectReservation, openVisit, openTakeaway, restoreVisit, restoreParkedVisit, moveVisitToTable,
    parkVisit, openBar, mergeVisits, applyAdjustment, compLine, setLineNote, openDrawer,
    setVisitCustomer, setTicketOperator, toggleLineTag, loadTags,
    switchTicket, voidEmptyTicket, createSplitTicket, moveLine, mergeSplitTickets, addProduct,
    setLineQuantity, voidLine, voidOrder, applyDiscount, sendKitchen, checkout,
  };
}
