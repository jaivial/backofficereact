import { useCallback, useEffect, useMemo, useState } from "react";
import { allocatePayments } from "../utils/paymentAllocation";
import { parseAmount } from "../utils/money";
import { isValidCustomerTaxId, normalizeCustomerTaxId } from "../utils/customerTaxId";
import { usePOSCommand } from "./usePOSCommand";
import type { Area, Bootstrap, Operator, Product, Reservation, RestaurantProfile, Settings, ShiftSummary, StockStatus, Table, Tag, Ticket, TicketLine, Visit } from "../types/register";

export type { Area, Bootstrap, Operator, Product, Reservation, RestaurantProfile, Settings, ShiftSummary, StockStatus, Table, Tag, Ticket, TicketLine, Visit } from "../types/register";
export { money, parseAmount } from "../utils/money";

export const DEFAULT_SETTINGS: Settings = { isEnabled: false, stockMode: "OFF", coversMode: "MANUAL", timezone: "Europe/Madrid", businessDayCutoff: "05:00", autoCloseVisit: true, receiptPrefix: "TPV" };

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set("Content-Type", "application/json");
  const response = await fetch(`/api/admin/pos${path}`, { ...init, credentials: "include", headers });
  const body = await response.json();
  if (!response.ok || !body.success) throw new Error(body.message || "Error de TPV");
  return body as T;
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
  const [productStock, setProductStock] = useState<Record<string, StockStatus>>({});
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
  const [pendingProductId, setPendingProductId] = useState<number | null>(null);
  const { isInFlight, keyFor, clear, run, busy: commandBusy } = usePOSCommand();

  const load = useCallback(async () => {
    setError("");
    try {
      const data = await request<Bootstrap>(date ? `/bootstrap?date=${encodeURIComponent(date)}` : "/bootstrap");
      setSettings(data.settings || DEFAULT_SETTINGS); setProducts(data.products || []); setTables(data.tables || []); setAreas(data.areas || []); setRestaurant(data.restaurant || null); setVisits(data.visits || []); setOperators(data.operators || []); setCurrentShift(data.currentShift || null); setProductStock(data.productStock || {});
    } catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo cargar TPV"); }
  }, [date]);
  useEffect(() => { void load(); }, [load]);

  const filteredProducts = useMemo(() => products.filter((product) => product.isActive && product.name.toLowerCase().includes(query.trim().toLowerCase())), [products, query]);
  const ticketTotal = ticket?.totalGrossCents || 0;
  const activeTicketLines = useMemo(() => ticket?.lines.filter((line) => line.status !== "VOIDED") || [], [ticket]);
  const openSplitTickets = useMemo(() => splitTickets.filter((entry) => entry.status === "OPEN"), [splitTickets]);
  const otherOpenSplitTickets = useMemo(() => openSplitTickets.filter((entry) => entry.id !== ticket?.id), [openSplitTickets, ticket?.id]);
  const activeLineIds = useMemo(() => new Set(activeTicketLines.map((line) => line.id)), [activeTicketLines]);
  const pendingKitchenLines = useMemo(() => activeTicketLines.filter((line) => line.quantity !== (sentKitchenQuantities[line.id] ?? 0)), [activeTicketLines, sentKitchenQuantities]);
  const pendingKitchenVoids = useMemo(() => Object.keys(sentKitchenQuantities).map(Number).filter((id) => !activeLineIds.has(id)), [activeLineIds, sentKitchenQuantities]);
  const hasPendingKitchenLines = pendingKitchenLines.length > 0 || pendingKitchenVoids.length > 0;
  const cashTenderedCents = useMemo(() => { const value = parseAmount(cash); return Number.isFinite(value) && value >= 0 ? Math.round(value * 100) : -1; }, [cash]);
  const cardTenderedCents = useMemo(() => { const value = parseAmount(card); return Number.isFinite(value) && value >= 0 ? Math.round(value * 100) : -1; }, [card]);
  const paymentTotal = useMemo(() => cashTenderedCents >= 0 && cardTenderedCents >= 0 ? cashTenderedCents + cardTenderedCents : -1, [cardTenderedCents, cashTenderedCents]);
  const amountDueCents = ticketTotal + tipCents;
  const changeDue = useMemo(() => {
    if (paymentTotal < 0) return 0;
    try {
      const payments = allocatePayments({ saleTotalCents: ticketTotal, tipCents, cashTenderedCents: cashTenderedCents >= 0 ? cashTenderedCents : 0, cardTenderedCents: cardTenderedCents >= 0 ? cardTenderedCents : 0 });
      const cashApplied = payments.find((payment) => payment.method === "CASH");
      const cashAppliedCents = (cashApplied?.amountCents || 0) + (cashApplied?.tipCents || 0);
      return Math.max((cashTenderedCents >= 0 ? cashTenderedCents : 0) - cashAppliedCents, 0);
    } catch { return 0; }
  }, [cardTenderedCents, cashTenderedCents, paymentTotal, ticketTotal, tipCents]);

  const loadReservations = useCallback(async () => {
    setReservationsLoading(true); setReservationsLoaded(false);
    try { const data = await request<{ items: Reservation[] }>("/reservations/eligible"); setReservations(data.items || []); setReservationsLoaded(true); }
    catch (reason) { setReservations([]); setReservationsLoaded(true); setError(reason instanceof Error ? reason.message : "No se pudieron cargar reservas"); }
    finally { setReservationsLoading(false); }
  }, []);
  const selectReservation = useCallback((id: number) => { setBookingId(id); const reservation = reservations.find((item) => item.id === id); if (reservation) setCovers(String(reservation.partySize)); }, [reservations]);

  const openVisit = useCallback(async () => {
    if (!selectedTable || Number(covers) <= 0) { setError("Introduce los comensales."); return false; }
    setBusy(true); setError("");
    try {
      const data = await request<{ visit: Visit; ticket: Ticket }>("/visits", { method: "POST", body: JSON.stringify({ channel: "DINE_IN", tableId: selectedTable.id, bookingId: bookingId || undefined, covers: Number(covers), idempotencyKey: crypto.randomUUID() }) });
      setVisit(data.visit); setTicket(data.ticket); setSplitTickets([data.ticket]); setSentKitchenQuantities({}); setSelectedTable(null); setBookingId(0); setReservations([]); setMessage(`Mesa abierta con ${covers} comensales.`); await load(); return true;
    } catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo abrir la mesa"); return false; } finally { setBusy(false); }
  }, [bookingId, covers, load, selectedTable]);

  const openTakeaway = useCallback(async () => {
    if (visit || isInFlight("takeaway")) return false;
    setBusy(true); setError(""); setMessage("");
    try {
      const result = await run("takeaway", async (key) => {
        const data = await request<{ visit: Visit; ticket: Ticket }>("/visits", { method: "POST", body: JSON.stringify({ channel: "TAKEAWAY", covers: 0, idempotencyKey: key }) });
        setVisit(data.visit); setTicket(data.ticket); setSplitTickets([data.ticket]); setSentKitchenQuantities({}); setMessage("Venta para llevar abierta."); await load(); return true;
      });
      return result ?? false;
    } catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo abrir venta para llevar"); return false; } finally { setBusy(false); }
  }, [isInFlight, load, run, visit]);

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
    if (isInFlight("restore")) return false;
    setError("");
    try {
      return (await run("restore", async () => {
        await request(`/visits/${visitId}/park`, { method: "POST", body: JSON.stringify({ parked: false, note: "" }) });
        const data = await request<{ visit: Visit & { tickets: Ticket[] } }>(`/visits/${visitId}`);
        const openTicket = data.visit.tickets?.find((entry) => entry.status === "OPEN") || data.visit.tickets?.[0];
        setVisit(data.visit); setSplitTickets(data.visit.tickets || []); setTicket(openTicket || null); setSentKitchenQuantities({}); setTipCents(0); setMessage("Comanda recuperada."); await load(); return true;
      })) ?? false;
    } catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo recuperar la cuenta"); return false; }
  }, [isInFlight, load, run]);

  const switchTicket = useCallback((next: Ticket) => { setTicket(next); setSplitTargetId(0); setCash(""); setCard(""); setCardReference(""); setTipCents(0); }, []);
  const voidEmptyTicket = useCallback(async (next: Ticket) => { if (next.lines.filter((line) => line.status !== "VOIDED").length) return; try { await request(`/tickets/${next.id}/void`, { method: "POST", body: JSON.stringify({ reason: "Cuenta separada vacía" }) }); setSplitTickets((current) => current.filter((entry) => entry.id !== next.id)); if (ticket?.id === next.id) { const fallback = splitTickets.find((entry) => entry.id !== next.id && entry.status === "OPEN"); setTicket(fallback || null); } } catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo anular cuenta"); } }, [splitTickets, ticket]);
  const createSplitTicket = useCallback(async () => { if (!visit) return; try { const data = await request<{ ticket: Ticket }>(`/visits/${visit.id}/tickets`, { method: "POST", body: JSON.stringify({ idempotencyKey: crypto.randomUUID() }) }); setSplitTickets((current) => [...current, data.ticket]); setSplitTargetId(data.ticket.id); setMessage("Cuenta separada creada."); } catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo separar cuenta"); } }, [visit]);
  const moveLine = useCallback(async (line: TicketLine, quantity = line.quantity, targetId = splitTargetId) => { if (!ticket || !targetId) return; const moved = Math.min(Math.round(quantity), line.quantity); if (moved <= 0) return; try { const data = await request<{ sourceTicket: Ticket; targetTicket: Ticket }>(`/tickets/${ticket.id}/lines/${line.id}/move`, { method: "POST", body: JSON.stringify({ targetTicketId: targetId, quantity: moved, idempotencyKey: crypto.randomUUID() }) }); setTicket(data.sourceTicket); setSplitTickets((current) => current.map((entry) => entry.id === data.sourceTicket.id ? data.sourceTicket : entry.id === data.targetTicket.id ? data.targetTicket : entry)); return true; } catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo mover línea"); return false; } }, [splitTargetId, ticket]);

  const mergeSplitTickets = useCallback(async () => {
    if (!ticket || openSplitTickets.length <= 1 || isInFlight("merge-splits")) return false;
    setBusy(true); setError(""); setMessage("");
    try {
      const result = await run("merge-splits", async () => {
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
      });
      return result ?? false;
    } catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudieron reagrupar las cuentas"); return false; }
    finally { setBusy(false); }
  }, [isInFlight, openSplitTickets, run, ticket]);

  const clearRegister = useCallback(() => {
    setTicket(null); setVisit(null); setSplitTickets([]); setSplitTargetId(0);
    setSentKitchenQuantities({}); setCash(""); setCard(""); setCardReference(""); setTipCents(0);
  }, []);

  const parkVisit = useCallback(async (parked: boolean, note = "") => {
    if (!visit) return false;
    setBusy(true); setError(""); setMessage("");
    try {
      await request(`/visits/${visit.id}/park`, { method: "POST", body: JSON.stringify({ parked, note: note.trim() }) });
      if (parked) { clearRegister(); setMessage("Comanda aparcada."); } else setMessage("Comanda recuperada.");
      await load(); return true;
    } catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo aparcar la comanda"); return false; }
    finally { setBusy(false); }
  }, [clearRegister, load, visit]);

  const openBar = useCallback(async () => {
    if (visit || isInFlight("bar")) return false;
    setBusy(true); setError(""); setMessage("");
    try {
      const result = await run("bar", async (key) => {
        const data = await request<{ visit: Visit; ticket: Ticket }>("/visits", { method: "POST", body: JSON.stringify({ channel: "BAR", covers: 0, idempotencyKey: key }) });
        setVisit(data.visit); setTicket(data.ticket); setSplitTickets([data.ticket]); setSentKitchenQuantities({});
        setMessage("Venta de barra abierta."); await load(); return true;
      });
      return result ?? false;
    } catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo abrir la barra"); return false; }
    finally { setBusy(false); }
  }, [isInFlight, load, run, visit]);

  const mergeVisits = useCallback(async (sourceVisitIds: number[]) => {
    const uniqueSourceIds = [...new Set(sourceVisitIds)].filter((id) => id !== visit?.id);
    if (!visit || !uniqueSourceIds.length || isInFlight("merge")) return false;
    setBusy(true); setError(""); setMessage("");
    try {
      const result = await run("merge", async (key) => {
        const data = await request<{ ticket?: Ticket; tickets?: Ticket[]; visit?: Visit; covers?: number }>(`/visits/${visit.id}/merge`, { method: "POST", body: JSON.stringify({ sourceVisitIds: uniqueSourceIds, expectedVersion: ticket?.version, idempotencyKey: key }) });
        const authoritativeTickets = data.tickets || (data.ticket ? [data.ticket] : undefined);
        if (authoritativeTickets) { setSplitTickets(authoritativeTickets); setTicket(authoritativeTickets.find((entry) => entry.status === "OPEN") || authoritativeTickets[0] || null); }
        setVisit((current) => data.visit || (current && data.covers != null ? { ...current, covers: data.covers } : current));
        setMessage("Mesas juntadas."); await load(); return true;
      });
      return result ?? false;
    } catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudieron juntar las mesas"); return false; }
    finally { setBusy(false); }
  }, [isInFlight, load, run, ticket?.version, visit]);

  const applyAdjustment = useCallback(async (type: "DISCOUNT" | "SURCHARGE", mode: "AMOUNT" | "PERCENT", value: number, reason: string) => {
    if (!ticket) return false;
    const trimmed = reason.trim();
    if (!trimmed) { setError("Indica el motivo."); return false; }
    if (value <= 0) { setError("Introduce un importe válido."); return false; }
    const command = `adjustment-${type}`;
    if (isInFlight(command)) return false;
    setError(""); setMessage("");
    try {
      const result = await run(command, async (key) => {
        const common = { type, mode, reason: trimmed, expectedVersion: ticket.version, idempotencyKey: key };
        const body = mode === "PERCENT" ? { ...common, percent: value } : { ...common, amountCents: Math.round(value) };
        const data = await request<{ ticket: Ticket }>(`/tickets/${ticket.id}/adjustments`, { method: "POST", body: JSON.stringify(body) });
        setTicket(data.ticket); return true;
      });
      return result ?? false;
    } catch (reasonValue) { setError(reasonValue instanceof Error ? reasonValue.message : "No se pudo aplicar el ajuste"); return false; }
  }, [isInFlight, run, ticket]);

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
    if (!ticket || isInFlight("line-note")) return false;
    setError("");
    try {
      const result = await run("line-note", async () => {
        const data = await request<{ ticket: Ticket }>(`/tickets/${ticket.id}/lines/${line.id}`, { method: "PATCH", body: JSON.stringify({ quantity: line.quantity, notes: note.trim(), expectedVersion: ticket.version }) });
        setTicket(data.ticket); return true;
      });
      return result ?? false;
    } catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo guardar el comentario"); return false; }
  }, [isInFlight, run, ticket]);

  const openDrawer = useCallback(async (reason = "NO_SALE", note = "") => {
    if (settings.requireOpenShift && currentShift?.status !== "OPEN") { setError("Abre un turno antes de usar el cajón."); return false; }
    if (isInFlight("drawer")) return false;
    setError(""); setMessage("");
    try {
      const result = await run("drawer", async (key) => {
        await request("/drawer/open", { method: "POST", body: JSON.stringify({ reason, note: note.trim(), idempotencyKey: key }) });
        setMessage("Cajón abierto."); return true;
      });
      return result ?? false;
    } catch (reasonValue) { setError(reasonValue instanceof Error ? reasonValue.message : "No se pudo abrir el cajón"); return false; }
  }, [currentShift?.status, isInFlight, run, settings.requireOpenShift]);

  const setVisitCustomer = useCallback(async (customerName: string, customerTaxId: string) => {
    if (!visit || isInFlight("customer")) return false;
    setError("");
    const normalizedTaxId = normalizeCustomerTaxId(customerTaxId);
    if (!customerName.trim()) { setError("Indica el nombre del cliente."); return false; }
    if (!isValidCustomerTaxId(normalizedTaxId)) { setError("NIF/CIF no válido."); return false; }
    try {
      const result = await run("customer", async () => {
        const data = await request<{ visit?: Visit }>(`/visits/${visit.id}/customer`, { method: "PATCH", body: JSON.stringify({ customerName: customerName.trim(), customerTaxId: normalizedTaxId }) });
        setVisit((current) => data.visit || (current ? { ...current, customerName: customerName.trim(), customerTaxId: normalizedTaxId } : current));
        setMessage("Cliente asignado."); return true;
      });
      return result ?? false;
    } catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo asignar el cliente"); return false; }
  }, [isInFlight, run, visit]);

  const setTicketOperator = useCallback(async (operatorMemberId: number) => {
    if (!ticket || isInFlight("operator")) return false;
    if (operatorMemberId > 0 && !operators.some((entry) => entry.id === operatorMemberId && entry.isActive !== false)) { setError("Empleado no válido."); return false; }
    setError("");
    try {
      const result = await run("operator", async () => {
        const data = await request<{ ticket?: Ticket }>(`/tickets/${ticket.id}/operator`, { method: "PATCH", body: JSON.stringify({ operatorMemberId }) });
        setTicket((current) => data.ticket || (current ? { ...current, operatorMemberId } : current));
        setMessage("Empleado asignado."); return true;
      });
      return result ?? false;
    } catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo asignar el empleado"); return false; }
  }, [isInFlight, operators, run, ticket]);

  const toggleLineTag = useCallback(async (line: TicketLine, tagId: number, attach: boolean) => {
    if (!ticket || isInFlight("line-tag")) return false;
    setError("");
    try {
      const result = await run("line-tag", async () => {
        const data = await request<{ ticket?: Ticket }>(`/tickets/${ticket.id}/lines/${line.id}/tags`, { method: "POST", body: JSON.stringify({ tagId, attach }) });
        setTicket((current) => data.ticket || (current ? { ...current, lines: current.lines.map((entry) => entry.id === line.id ? { ...entry, tagIds: attach ? [...new Set([...(entry.tagIds || []), tagId])] : (entry.tagIds || []).filter((id) => id !== tagId) } : entry) } : current));
        setLineTags((current) => {
          const existing = current[line.id] || [];
          return { ...current, [line.id]: attach ? [...new Set([...existing, tagId])] : existing.filter((id) => id !== tagId) };
        }); return true;
      });
      return result ?? false;
    } catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo etiquetar"); return false; }
  }, [isInFlight, run, ticket]);

  const loadTags = useCallback(async () => {
    try { const data = await request<{ items: Tag[] }>("/tags"); setTags(data.items || []); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudieron cargar etiquetas"); }
  }, []);

  const addProduct = useCallback(async (product: Product, options?: { quantity?: number; unitPriceOverrideCents?: number }) => {
    if (!ticket) return;
    setBusy(true); setMessage(""); setPendingProductId(product.id);
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
    catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo añadir producto"); } finally { setBusy(false); setPendingProductId(null); }
  }, [ticket]);

  const voidLine = useCallback(async (line: TicketLine, reason = "Error al introducir") => {
    if (!ticket) return; const trimmed = reason.trim(); if (!trimmed) return;
    try { const data = await request<{ ticket: Ticket }>(`/tickets/${ticket.id}/lines/${line.id}/void`, { method: "POST", body: JSON.stringify({ reason: trimmed }) }); setTicket(data.ticket); }
    catch (reasonValue) { setError(reasonValue instanceof Error ? reasonValue.message : "No se pudo anular línea"); }
  }, [ticket]);

  const setLineQuantity = useCallback(async (line: TicketLine, quantity: number) => {
    if (!ticket || quantity <= 0) return;
    try { const data = await request<{ ticket: Ticket }>(`/tickets/${ticket.id}/lines/${line.id}`, { method: "PATCH", body: JSON.stringify({ quantity, expectedVersion: ticket.version }) }); setTicket(data.ticket); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo cambiar cantidad"); }
  }, [ticket]);

  const voidOrder = useCallback(async (reason: string) => {
    if (!ticket || !visit) return;
    const trimmed = reason.trim();
    if (!trimmed) return;
    setBusy(true); setError(""); setMessage("");
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
    } catch (reasonValue) {
      // A partial void leaves local lines stale; refresh before surfacing the
      // error so a retry does not re-void the lines the server already voided.
      await load();
      if (visit) await restoreVisit(visit);
      setError(reasonValue instanceof Error ? reasonValue.message : "No se pudo borrar la comanda");
    }
    finally { setBusy(false); }
  }, [load, restoreVisit, ticket, visit]);

  const applyDiscount = useCallback(async (amountCents: number, reason: string) => {
    if (!ticket || isInFlight("discount")) return false;
    const trimmed = reason.trim();
    const amount = Math.min(Math.max(Math.round(amountCents), 0), ticket.totalGrossCents + (ticket.discountCents || 0));
    if (amount > 0 && !trimmed) { setError("Indica el motivo del descuento."); return false; }
    setError("");
    try {
      const result = await run("discount", async () => {
        const data = await request<{ ticket: Ticket }>(`/tickets/${ticket.id}/discount`, { method: "POST", body: JSON.stringify({ amountCents: amount, reason: trimmed }) });
        setTicket(data.ticket); setDiscount(""); return true;
      });
      return result ?? false;
    } catch (reasonValue) { setError(reasonValue instanceof Error ? reasonValue.message : "No se pudo aplicar descuento"); return false; }
  }, [isInFlight, run, ticket]);

  const sendKitchen = useCallback(async () => {
    if (!ticket || !hasPendingKitchenLines) return;
    const changedCount = pendingKitchenLines.length + pendingKitchenVoids.length;
    setMessage("");
    try {
      await request(`/tickets/${ticket.id}/kitchen-dispatches`, { method: "POST", body: JSON.stringify({ idempotencyKey: crypto.randomUUID() }) });
      // The server snapshot only keeps active lines: drop voided ids and sync sent = current.
      setSentKitchenQuantities(Object.fromEntries(activeTicketLines.map((line) => [line.id, line.quantity])));
      setMessage(`Comanda enviada a cocina · ${changedCount} línea(s).`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo enviar a cocina"); }
  }, [activeTicketLines, hasPendingKitchenLines, pendingKitchenLines, pendingKitchenVoids, ticket]);

  const checkout = useCallback(async (requestedTipCents = tipCents) => {
    const checkoutDue = ticketTotal + requestedTipCents;
    if (!ticket || ticketTotal < 0 || paymentTotal < checkoutDue) { setError("El pago no cubre el total."); return false; }
    if (isInFlight("checkout")) return false;
    let allocations;
    try { allocations = allocatePayments({ saleTotalCents: ticketTotal, tipCents: requestedTipCents, cashTenderedCents: cashTenderedCents >= 0 ? cashTenderedCents : 0, cardTenderedCents: cardTenderedCents >= 0 ? cardTenderedCents : 0 }); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Importe no válido."); return false; }
    if (allocations.some((payment) => payment.method === "CARD") && !cardReference.trim()) { setError("Introduce referencia del terminal de tarjeta."); return false; }
    const payments = allocations.map((payment) => {
      const idempotencyKey = keyFor(`checkout-${ticket.id}-${payment.method}`);
      return payment.method === "CARD" ? { ...payment, provider: "STANDALONE", providerReference: cardReference.trim(), idempotencyKey } : { ...payment, idempotencyKey };
    });
    const paymentCommands = allocations.map((payment) => `checkout-${ticket.id}-${payment.method}`);
    setBusy(true); setMessage("");
    try {
      const result = await run("checkout", async (checkoutKey) => {
        const data = await request<{ ticket: Ticket; stockStatus?: string; visitClosed?: boolean; duplicate?: boolean }>(`/tickets/${ticket.id}/checkout`, { method: "POST", body: JSON.stringify({ idempotencyKey: checkoutKey, expectedVersion: ticket.version, payments, closeVisit: true }) });
        setMessage(data.stockStatus ? `Venta completada · stock ${data.stockStatus.toLowerCase()}.` : "Venta completada.");
        setLastPaidTicket(data.ticket);
        const nextOpen = splitTickets.find((entry) => entry.id !== ticket.id && entry.status === "OPEN") || null;
        // A replayed checkout (lost response) is a success: the visit was already closed.
        if (data.visitClosed || data.duplicate) { setTicket(null); setVisit(null); setSplitTickets([]); setSentKitchenQuantities({}); }
        else { setTicket(nextOpen); setSplitTickets((current) => current.map((entry) => entry.id === data.ticket.id ? data.ticket : entry)); }
        setCash(""); setCard(""); setCardReference(""); setTipCents(0);
        for (const command of paymentCommands) clear(command);
        await load(); return true;
      });
      return result ?? false;
    } catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo cobrar"); return false; }
    finally { setBusy(false); }
  }, [cardReference, cardTenderedCents, cashTenderedCents, clear, isInFlight, keyFor, load, paymentTotal, run, splitTickets, ticket, ticketTotal, tipCents]);

  return {
    settings, setSettings, products, tables, visits, ticket, visit, lastPaidTicket, productStock,
    splitTickets, splitTargetId, setSplitTargetId, selectedTable, setSelectedTable,
    covers, setCovers, reservations, reservationsLoading, reservationsLoaded, bookingId, query, setQuery,
    message, setMessage, error, setError, busy, commandBusy, pendingProductId,
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
