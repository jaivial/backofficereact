import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { usePOSRegister, money, request, type Table, type TicketLine } from "../../hooks/usePOSRegister";
import { POSCategoryPanel } from "./POSCategoryPanel";
import { POSProductGrid } from "./POSProductGrid";
import { POSTicketPanel } from "./POSTicketPanel";
import { POSKeypad } from "./POSKeypad";
import { POSControlRail, RAIL_FEATURES, type RailFeatureKey } from "./POSControlRail";
import { ConfirmDialog } from "../../../../../ui/overlays/ConfirmDialog";
import { splitShares } from "../../utils/splitShares";
import { POSPromptModal } from "./POSPromptModal";
import { POSMultiSelectDialog } from "./POSMultiSelectDialog";
import { POSDialog } from "./POSDialog";
import { POSMoveLineDialog } from "./POSMoveLineDialog";
import { POSTableTile } from "./POSTableTile";
import { downloadComandaPdf } from "../../utils/comandaPdf";
import { createClient } from "../../../../../api/client";
import type { POSCashDay, POSCashDayTotals } from "../../../../../api/types";

type KeypadContext = { kind: "quantity" } | { kind: "cash" } | { kind: "discount" } | { kind: "covers" };

/** Human-readable age of a parked comanda, or "—" when no timestamp was provided. */
function ageLabel(openedAt?: string): string {
  if (!openedAt) return "—";
  const minutes = Math.max(0, Math.round((Date.now() - new Date(openedAt).getTime()) / 60000));
  return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}

/**
 * Visual sell screen. Layout:
 *   [ column: [ticket | keypad] over [categories | products] ] [ control rail ]
 */
export function POSSellScreen({ date, readOnly = false, cashDay = null, totals = null, cashDayError = "", onCloseDay }: { date?: string | null; readOnly?: boolean; cashDay?: POSCashDay | null; totals?: POSCashDayTotals | null; cashDayError?: string; onCloseDay?: (params: { countedCashCents: number; notes?: string; discrepancyReason?: string }) => Promise<boolean> } = {}) {
  const register = usePOSRegister(date);
  const [category, setCategory] = useState("");
  const [keypadValue, setKeypadValue] = useState("");
  const [keypadContext, setKeypadContext] = useState<KeypadContext>({ kind: "quantity" });
  const [selectedLineId, setSelectedLineId] = useState(0);
  const [showTables, setShowTables] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [checkoutKeypad, setCheckoutKeypad] = useState(false);
  const [lineToVoid, setLineToVoid] = useState<TicketLine | null>(null);
  const [lineToMove, setLineToMove] = useState<TicketLine | null>(null);
  const [voidOrderOpen, setVoidOrderOpen] = useState(false);
  const [voidOrderReason, setVoidOrderReason] = useState("");
  const [discountOpen, setDiscountOpen] = useState(false);
  const [discountMode, setDiscountMode] = useState<"amount" | "percent">("amount");
  const [discountValue, setDiscountValue] = useState("");
  const [discountReason, setDiscountReason] = useState("");
  const [divideOpen, setDivideOpen] = useState(false);
  const [divideGuests, setDivideGuests] = useState("2");
  const [prompt, setPrompt] = useState<RailFeatureKey | null>(null);
  const [areaFilter, setAreaFilter] = useState(0);
  const [ticketExpanded, setTicketExpanded] = useState(false);
  const [multiSelectIds, setMultiSelectIds] = useState<number[]>([]);
  const [comandaBusy, setComandaBusy] = useState(false);
  const comandaInFlight = useRef(false);
  const [keypadMultiplierQty, setKeypadMultiplierQty] = useState<number | null>(null);
  const [closeDayError, setCloseDayError] = useState("");

  const categories = useMemo(() => {
    const names = new Set<string>();
    for (const product of register.products) if (product.isActive && product.categoryName) names.add(product.categoryName);
    return [...names].sort((a, b) => a.localeCompare(b, "es"));
  }, [register.products]);

  const visibleProducts = useMemo(
    () => register.filteredProducts.filter((product) => !category || product.categoryName === category),
    [category, register.filteredProducts],
  );

  const keypadNumber = useMemo(() => Number(keypadValue.replace(",", ".")) || 0, [keypadValue]);

  const selectLine = useCallback((line: TicketLine) => {
    setSelectedLineId(line.id);
    setKeypadContext({ kind: "quantity" });
    // Selecting a line is inspection only. Never seed the shared keypad value:
    // it is read as a price override by the explicit add-product flow.
    setKeypadValue("");
    setKeypadMultiplierQty(null);
  }, []);

  const confirmKeypad = useCallback(() => {
    if (readOnly) return;
    if (keypadContext.kind === "quantity") {
      const line = register.activeTicketLines.find((entry) => entry.id === selectedLineId);
      if (line && keypadNumber > 0) void register.setLineQuantity(line, keypadNumber);
    } else if (keypadContext.kind === "cash") {
      register.setCash(keypadValue.replace(",", "."));
      setShowCheckout(true);
    } else if (keypadContext.kind === "discount") {
      setDiscountMode("amount");
      setDiscountValue(keypadValue.replace(",", "."));
      setDiscountOpen(true);
    } else if (keypadContext.kind === "covers") {
      if (keypadNumber > 0) register.setCovers(String(Math.round(keypadNumber)));
    }
    setKeypadValue("");
  }, [keypadContext.kind, keypadNumber, keypadValue, readOnly, register, selectedLineId]);

  const confirmVoidLine = useCallback(async () => {
    if (!lineToVoid) return;
    await register.voidLine(lineToVoid);
    setLineToVoid(null);
  }, [lineToVoid, register]);

  const discountCents = useMemo(() => {
    const value = Number(discountValue.replace(",", ".")) || 0;
    if (value <= 0) return 0;
    return discountMode === "percent"
      ? Math.round((register.ticketTotal * Math.min(value, 100)) / 100)
      : Math.round(value * 100);
  }, [discountMode, discountValue, register.ticketTotal]);

  const divideShares = useMemo(() => splitShares(register.ticketTotal, Math.round(Number(divideGuests) || 0)), [divideGuests, register.ticketTotal]);

  const selectTable = useCallback((table: Table) => {
    if (readOnly) return;
    if (register.visit) {
      if (table.id === register.visit.tableId) { setShowTables(false); return; }
      void register.moveVisitToTable(table).then(() => setShowTables(false));
      return;
    }
    if (table.occupied) {
      const current = register.visits.find((entry) => entry.tableId === table.id);
      if (current) { void register.restoreVisit(current); setShowTables(false); }
      return;
    }
    register.setSelectedTable(table);
  }, [readOnly, register]);

  const selectedLine = useMemo(
    () => register.activeTicketLines.find((line) => line.id === selectedLineId) || null,
    [register.activeTicketLines, selectedLineId],
  );

  useEffect(() => { setSelectedLineId(0); }, [register.ticket?.id, register.visit?.id]);

  const visibleTables = useMemo(
    () => register.tables.filter((table) => !areaFilter || table.areaId === areaFilter),
    [areaFilter, register.tables],
  );

  const parkedVisits = useMemo(() => register.visits.filter((entry) => entry.parked), [register.visits]);
  const openVisits = useMemo(() => register.visits.filter((entry) => entry.status === "OPEN"), [register.visits]);
  const openVisitCount = openVisits.length;
  const openVisitTotalCents = useMemo(
    () => openVisits.reduce((sum, entry) => sum + (entry.totalGrossCents || entry.ticket?.totalGrossCents || 0), 0),
    [openVisits],
  );
  const tableTotals = useMemo(() => {
    const totalsByTable = new Map<number, number>();
    for (const entry of register.visits) if (entry.tableId) totalsByTable.set(entry.tableId, entry.totalGrossCents || entry.ticket?.totalGrossCents || 0);
    return totalsByTable;
  }, [register.visits]);
  const eligibleReservations = useMemo(() => register.reservations.filter((entry) => !entry.visitId), [register.reservations]);
  const mergeableVisits = useMemo(
    () => register.visits.filter((entry) => entry.status === "OPEN" && entry.channel === "DINE_IN" && !entry.parked && entry.id !== register.visit?.id),
    [register.visit?.id, register.visits],
  );

  const closePrompt = useCallback(() => setPrompt(null), []);

  useEffect(() => {
    if (showTables && !register.visit) void register.loadReservations();
  }, [register.loadReservations, register.visit, showTables]);

  const closeTables = useCallback(() => { setShowTables(false); setAreaFilter(0); }, []);

  const openPrompt = useCallback((key: RailFeatureKey) => {
    register.setError("");
    if (key === "tags") void register.loadTags();
    if (key === "tags") setMultiSelectIds(selectedLine?.tagIds || []);
    else if (key === "juntar-mesas") setMultiSelectIds([]);
    setPrompt(key);
  }, [register, selectedLine]);

  const saveTags = useCallback(async () => {
    if (!selectedLine) return false;
    const previous = new Set(selectedLine.tagIds || []);
    const next = new Set(multiSelectIds);
    for (const tag of register.tags) {
      if (previous.has(tag.id) !== next.has(tag.id) && !await register.toggleLineTag(selectedLine, tag.id, next.has(tag.id))) return false;
    }
    setPrompt(null);
    return true;
  }, [multiSelectIds, register, selectedLine]);

  const runPrompt = useCallback(async (key: RailFeatureKey, values: Record<string, string>, option: string) => {
    const amount = Number((values.value || "").replace(",", ".")) || 0;
    let succeeded = false;
    switch (key) {
      case "aparcar": succeeded = await register.parkVisit(true, values.note || ""); break;
      case "recargo": succeeded = await register.applyAdjustment("SURCHARGE", option === "percent" ? "PERCENT" : "AMOUNT", option === "percent" ? amount : Math.round(amount * 100), values.reason || ""); break;
      case "invita": if (selectedLine) succeeded = await register.compLine(selectedLine, !selectedLine.comped, values.reason || ""); break;
      case "comentario": if (selectedLine) succeeded = await register.setLineNote(selectedLine, values.note || ""); break;
      case "cajon": succeeded = await register.openDrawer(option || "NO_SALE", values.note || ""); break;
      case "cliente": succeeded = await register.setVisitCustomer(values.customerName || "", values.customerTaxId || ""); break;
      case "empleado": succeeded = await register.setTicketOperator(Number(values.operatorMemberId) || 0); break;
      case "propina":
        // The tip rides on top of the sale: it never changes the ticket total.
        register.setTipCents(Math.round(amount * 100));
        setShowCheckout(true);
        succeeded = true;
        break;
      default: break;
    }
    if (succeeded) setPrompt(null);
  }, [register, selectedLine]);

  const printComanda = useCallback(async () => {
    if (!register.ticket || !register.visit || !register.activeTicketLines.length || comandaInFlight.current) return;
    comandaInFlight.current = true;
    setComandaBusy(true);
    register.setError("");
    try {
      await downloadComandaPdf({
        generatedAt: new Date(),
        ticket: register.ticket,
        visit: register.visit,
        restaurant: register.restaurant,
        operatorName: register.operators.find((entry) => entry.id === register.ticket?.operatorMemberId)?.displayName,
        tagNamesById: Object.fromEntries(register.tags.map((tag) => [tag.id, tag.name])),
      });
      register.setMessage("Comanda descargada.");
    } catch (reason) {
      register.setError(reason instanceof Error ? reason.message : "No se pudo generar la comanda.");
    } finally {
      comandaInFlight.current = false;
      setComandaBusy(false);
    }
  }, [register]);

  // Cierre X / Y: a shift snapshot (X) or intermediate cut (Y). One POST, no
  // modal — neither takes operator input. Z stays on the reports card where it
  // seals the day and needs counted cash.
  const runCierre = useCallback(async (closureType: "X" | "Y") => {
    const shiftId = register.currentShift?.id;
    if (!shiftId) { register.setError("Abre un turno antes de generar un cierre."); return; }
    register.setError("");
    try {
      await request<{ closureId: number }>("/cash/closures", { method: "POST", body: JSON.stringify({ shiftId, closureType, idempotencyKey: `${shiftId}-${closureType}-${Date.now()}` }) });
      register.setMessage(`Cierre ${closureType} generado.`);
    } catch (reason) {
      register.setError(reason instanceof Error ? reason.message : `No se pudo generar el cierre ${closureType}.`);
    }
  }, [register]);

  // Bulk close: pay every open ticket for the business date with one method,
  // the precondition that unblocks the day close.
  const runBulkClose = useCallback(async (paymentMethod: string) => {
    if (!date) return false;
    register.setError("");
    register.setMessage("");
    setComandaBusy(true);
    try {
      const result = await createClient().pos.cashDays.bulkCheckout({ date, paymentMethod, idempotencyKey: `bulk-${date}-${paymentMethod}-${Date.now()}`, closeVisits: true });
      if (!result.success) throw new Error(result.message);
      register.setMessage(`Cerradas ${result.closedTickets} cuenta(s)${result.skippedTickets ? ` · ${result.skippedTickets} sin importe` : ""} · ${money(result.totalGrossCents)}.`);
      await register.load();
      return true;
    } catch (reason) {
      register.setError(reason instanceof Error ? reason.message : "No se pudo cerrar las mesas.");
      return false;
    } finally { setComandaBusy(false); }
  }, [date, register]);

  const runCloseDay = useCallback(async (values: Record<string, string>) => {
    if (!onCloseDay) return false;
    const countedCashCents = Math.round((Number((values.countedCash || "").replace(",", ".")) || 0) * 100);
    setCloseDayError("");
    const ok = await onCloseDay({ countedCashCents, discrepancyReason: values.discrepancyReason || "" });
    if (ok) { register.setMessage("Día cerrado."); return true; }
    // ponytail: cash-day hook returns only a boolean; surface a generic cause.
    // The rail guard already blocks the common OPEN_POS_ITEMS case, so this path
    // is mainly counted-cash discrepancies, which the operator retries inline.
    setCloseDayError(cashDayError || "No se pudo cerrar el día. Revisa el efectivo contado.");
    return false;
  }, [cashDayError, onCloseDay, register]);

  const quickCashOptions = useMemo(() => {
    const exact = register.amountDueCents / 100;
    const notes = [5, 10, 20, 50].filter((note) => note > exact);
    return [{ key: "exact", label: "Exacto", value: exact }, ...notes.map((note) => ({ key: String(note), label: `${note} €`, value: note }))];
  }, [register.amountDueCents]);

  const disabledReasons = useMemo<Partial<Record<RailFeatureKey, string>>>(() => {
    const reasons: Partial<Record<RailFeatureKey, string>> = {};
    // A sealed day is a signed Z closure: nothing on the rail may touch it.
    if (readOnly) {
      for (const feature of RAIL_FEATURES) reasons[feature.key] = "Día cerrado: solo consulta.";
      return reasons;
    }
    if (!register.hasPendingKitchenLines) reasons.cocina = "No hay líneas pendientes de enviar a cocina.";
    if (!register.activeTicketLines.length || comandaBusy) reasons.comanda = "No hay líneas en la cuenta.";
    if (!register.ticket) {
      const ticketKeys: RailFeatureKey[] = ["total", "borrar-comanda", "descuento", "separar-comanda", "dividir-comanda", "recargo", "invita", "comentario", "aparcar", "juntar-mesas", "cliente", "empleado", "tags", "propina"];
      for (const key of ticketKeys) reasons[key] = "Abre una cuenta para usar esta acción.";
    }
    if (!selectedLine || (selectedLine.status && selectedLine.status !== "ACTIVE")) {
      reasons.invita = "Selecciona una línea de la cuenta.";
      reasons.comentario = "Selecciona una línea de la cuenta.";
      reasons.tags = "Selecciona una línea de la cuenta.";
    }
    if (register.visit) {
      reasons.barra = "Ya hay una cuenta abierta.";
      reasons.llevar = "Ya hay una cuenta abierta.";
    }
    // Cierre X/Y and the bulk sweep all attribute to the open shift, so they
    // share the cajón gate.
    if (register.settings.requireOpenShift && register.currentShift?.status !== "OPEN") {
      reasons.cajon = "Abre un turno antes de usar el cajón.";
      reasons["cierre-x"] = "Abre un turno antes de generar el cierre.";
      reasons["cierre-y"] = "Abre un turno antes de generar el cierre.";
      reasons["cerrar-mesas"] = "Abre un turno antes de cerrar las mesas.";
    }
    // "Cerrar día" is the user's hard requirement: blocked while any table is
    // still open, and blocked when there is no open cash day to seal.
    if (openVisitCount > 0 || cashDay?.status !== "OPEN") reasons["cerrar-dia"] = openVisitCount > 0 ? `Cierra ${openVisitCount} mesa(s) antes de cerrar el día.` : "No hay un día de caja abierto.";
    return reasons;
  }, [cashDay?.status, comandaBusy, openVisitCount, readOnly, register.activeTicketLines.length, register.currentShift?.status, register.hasPendingKitchenLines, register.settings.requireOpenShift, register.ticket, register.visit, selectedLine]);

  const confirmMoveLine = useCallback((targetId: number, quantity: number) => {
    if (!lineToMove) return;
    register.setSplitTargetId(targetId);
    void register.moveLine(lineToMove, quantity, targetId);
    setLineToMove(null);
  }, [lineToMove, register]);

  const closeDiscount = useCallback(() => { setDiscountOpen(false); setDiscountValue(""); setDiscountReason(""); }, []);

  const confirmDiscount = useCallback(async () => {
    await register.applyDiscount(discountCents, discountReason);
    setDiscountOpen(false); setDiscountValue(""); setDiscountReason("");
  }, [discountCents, discountReason, register]);

  const closeVoidOrder = useCallback(() => { setVoidOrderOpen(false); setVoidOrderReason(""); }, []);

  const confirmVoidOrder = useCallback(async () => {
    await register.voidOrder(voidOrderReason.trim() || "Sin motivo indicado");
    setVoidOrderOpen(false);
    setVoidOrderReason("");
  }, [register, voidOrderReason]);

  const toggleTicketExpanded = useCallback(() => setTicketExpanded((current) => !current), []);

  const handleAddProduct = useCallback((product: Parameters<typeof register.addProduct>[0]) => {
    if (register.settings.stockMode === "LIVE" && register.productStock[String(product.id)] === "out") {
      register.setError(`Sin stock: ${product.name} no disponible.`);
      return;
    }
    const priceValue = Number(keypadValue.replace(",", ".")) || 0;
    const hasMultiplier = keypadMultiplierQty != null && keypadMultiplierQty > 0;
    const hasPrice = priceValue > 0;

    let options: { quantity?: number; unitPriceOverrideCents?: number } | undefined;

    if (hasMultiplier && hasPrice) {
      // qty × price flow: 3 × 6 → product = 3 units at €6 each
      options = { quantity: keypadMultiplierQty, unitPriceOverrideCents: Math.round(priceValue * 100) };
    } else if (hasMultiplier) {
      // qty × (no price) flow: 3 × → product = 3 units at catalog price
      options = { quantity: keypadMultiplierQty };
    } else if (hasPrice) {
      // price override only: 2,00 → product = 1 unit at €2
      options = { unitPriceOverrideCents: Math.round(priceValue * 100) };
    }

    void register.addProduct(product, options);

    // Reset keypad state
    setKeypadValue("");
    setKeypadMultiplierQty(null);
  }, [keypadMultiplierQty, keypadValue, register]);

  const handleKeypadMultiplier = useCallback((qty: number) => {
    setKeypadMultiplierQty(qty);
  }, []);

  const clearKeypadMultiplier = useCallback(() => {
    setKeypadMultiplierQty(null);
  }, []);

  const railAction = useCallback((key: RailFeatureKey) => {
    switch (key) {
      case "mesa": setShowTables(true); break;
      case "total": if (register.ticket) { register.setError(""); setKeypadContext({ kind: "cash" }); setShowCheckout(true); } break;
      case "comanda": void printComanda(); break;
      case "cocina": void register.sendKitchen(); break;
      case "descuento": if (register.ticket) { register.setError(""); setKeypadContext({ kind: "discount" }); setDiscountOpen(true); } break;
      case "separar-comanda": void register.createSplitTicket(); break;
      case "borrar-comanda": if (register.ticket) { register.setError(""); setVoidOrderOpen(true); } break;
      case "dividir-comanda": if (register.ticket) { register.setError(""); setDivideOpen(true); } break;
      case "salon": setAreaFilter(0); setShowTables(true); break;
      case "barra": void register.openBar(); break;
      case "llevar": void register.openTakeaway(); break;
      case "cierre-x": void runCierre("X"); break;
      case "cierre-y": void runCierre("Y"); break;
      case "cerrar-mesas": register.setError(""); setPrompt("cerrar-mesas"); break;
      case "cerrar-dia": if (onCloseDay && cashDay?.status === "OPEN") { register.setError(""); setCloseDayError(""); setPrompt("cerrar-dia"); } break;
      case "aparcar": case "recargo": case "invita": case "comentario": case "cajon":
      case "cliente": case "empleado": case "juntar-mesas": case "tags": case "propina":
        openPrompt(key); break;
      default: register.setMessage(`Función "${key}" disponible próximamente.`); break;
    }
  }, [cashDay?.status, onCloseDay, openPrompt, printComanda, register, runCierre]);

  const contextLabel = keypadContext.kind === "quantity" ? "Cantidad" : keypadContext.kind === "cash" ? "Efectivo" : keypadContext.kind === "discount" ? "Descuento €" : "Comensales";

  return (
    <div className="pos-sell" data-ui="pos-sell-screen" data-testid="pos-sell-screen" data-readonly={readOnly ? "true" : undefined}>
      <div className="pos-sell__top" data-testid="pos-sell-top">
        {readOnly ? <div className="pos-sell__alert" role="status" data-ui="pos-readonly-notice" data-testid="pos-readonly-notice">Día cerrado: solo consulta.</div> : null}
        {register.error ? <div className="pos-sell__alert" role="alert" data-ui="pos-error" data-testid="pos-error">{register.error}</div> : null}
        {register.message ? <div className="pos-sell__alert pos-sell__alert--success" role="status" data-pos-message="success" data-testid="pos-message">{register.message}</div> : null}
        {register.lastPaidTicket ? (
          <div className="pos-sell__status" data-ui="pos-last-receipt" data-testid="pos-last-receipt">
            Recibo no fiscal · {register.lastPaidTicket.ticketNumber} · {money(register.lastPaidTicket.totalGrossCents)}
            <button className="pos-modal__secondary" type="button" onClick={() => window.print()} data-ui="pos-last-receipt-print" data-testid="pos-last-receipt-print" style={{ marginLeft: "0.5rem" }}>Imprimir</button>
          </div>
        ) : null}
      </div>
      <div className="pos-sell__body" data-testid="pos-sell-body">
        <div className="pos-sell__work" data-testid="pos-sell-work">
          <div className={ticketExpanded ? "pos-sell__row pos-sell__row--register is-expanded" : "pos-sell__row pos-sell__row--register"} data-testid="pos-sell-row-register">
            <POSTicketPanel onRequestTable={() => setShowTables(true)}
              expanded={ticketExpanded}
              onToggleExpand={toggleTicketExpanded}
              ticket={register.ticket}
              visit={register.visit}
              operators={register.operators}
              tags={register.tags}
              activeTicketLines={register.activeTicketLines}
              selectedLineId={selectedLineId}
              onSelectLine={selectLine}
              onLineQuantity={(line, quantity) => void register.setLineQuantity(line, quantity)}
              onVoidLine={setLineToVoid}
              splitTickets={register.openSplitTickets}
              sentKitchenQuantities={register.sentKitchenQuantities}
              onSelectTicket={register.switchTicket}
              onMoveLine={setLineToMove}
              canMoveLine={register.otherOpenSplitTickets.length > 0}
              onMergeSplitTickets={() => void register.mergeSplitTickets()}
              onDeleteEmptyTicket={(t) => void register.voidEmptyTicket(t)}
              busy={register.busy}
              readOnly={readOnly}
            />
            <POSKeypad value={keypadValue} onChange={setKeypadValue} contextLabel={contextLabel} onConfirm={confirmKeypad} confirmLabel="OK" onMultiplier={handleKeypadMultiplier} multiplierQty={keypadMultiplierQty} onClearMultiplier={clearKeypadMultiplier} readOnly={readOnly} />
          </div>
          <div className="pos-sell__row pos-sell__row--catalog" data-testid="pos-sell-row-catalog" hidden={ticketExpanded}>
            <POSCategoryPanel categories={categories} active={category} onSelect={setCategory} />
            <div className="pos-catalog__main" data-testid="pos-catalog-main">
              <div className="pos-search" data-testid="pos-search">
                <input type="search" value={register.query} onChange={(event) => register.setQuery(event.target.value)} placeholder="Buscar producto…" aria-label="Buscar producto" data-pos-command="search-products" data-testid="pos-product-search" />
                {register.query ? <button className="pos-modal__secondary pos-search__clear" type="button" onClick={() => register.setQuery("")} aria-label="Limpiar búsqueda" data-testid="pos-product-search-clear">×</button> : null}
              </div>
              <POSProductGrid products={visibleProducts} disabled={!register.ticket} readOnly={readOnly} pendingProductId={register.pendingProductId} onAdd={handleAddProduct} stockStatus={register.settings.stockMode === "OFF" ? undefined : register.productStock} />
            </div>
          </div>
        </div>
        <POSControlRail onAction={railAction} disabledReasons={disabledReasons} readOnly={readOnly} />
      </div>

      <ConfirmDialog
        open={Boolean(lineToVoid)}
        title="Anular línea"
        message={lineToVoid ? `¿Anular ${lineToVoid.quantity} × ${lineToVoid.productName} (${money(lineToVoid.lineTotalGrossCents)}) de la cuenta?` : ""}
        confirmText="Anular"
        cancelText="Cancelar"
        danger
        busy={register.busy}
        onClose={() => setLineToVoid(null)}
        onConfirm={confirmVoidLine}
      />

      {showTables ? (
        <POSDialog testId="pos-tables" title={register.visit ? "Cambiar mesa" : "Mesas"} busy={register.busy} error={register.error} onClose={closeTables} headerTestId="pos-tables-modal-header" titleTestId="pos-tables-modal-title">
          {register.areas.length ? (
            <div className="pos-modal__modes pos-modal__areas" role="group" aria-label="Salones" data-testid="pos-areas">
              <button className="pos-modal__secondary" type="button" aria-pressed={areaFilter === 0} onClick={() => setAreaFilter(0)} data-testid="pos-area-all">Todos</button>
              {register.areas.map((area) => (
                <button className="pos-modal__secondary" type="button" key={area.id} aria-pressed={areaFilter === area.id} onClick={() => setAreaFilter(area.id)} data-testid={`pos-area-${area.id}`}>{area.name}</button>
              ))}
            </div>
          ) : null}
          {register.reservationsLoading ? <p className="pos-modal__pending" role="status" data-testid="pos-reservations-loading">Cargando reservas de hoy...</p> : null}
          {!register.reservationsLoading && register.reservationsLoaded && !eligibleReservations.length ? <p className="pos-modal__empty" data-testid="pos-reservations-empty">No hay reservas para hoy.</p> : null}
          {!register.reservationsLoading && eligibleReservations.length ? <p className="pos-modal__pending" data-testid="pos-reservations-available">{eligibleReservations.length} reserva(s) disponible(s) para hoy.</p> : null}
          {parkedVisits.length && !register.visit ? (
            <section className="pos-parked" data-testid="pos-parked-section">
              <h3 className="pos-parked__title" data-testid="pos-parked-title">Aparcadas ({parkedVisits.length})</h3>
              <div className="pos-modal__modes pos-parked__list" role="group" aria-label="Comandas aparcadas" data-testid="pos-parked-list">
                {parkedVisits.map((entry) => (
                  <button className="pos-modal__secondary pos-parkedVisit" type="button" key={entry.id} disabled={register.busy} onClick={() => { void register.restoreParkedVisit(entry.id).then((restored) => { if (restored) closeTables(); }); }} data-testid={`pos-parked-${entry.id}`}>
                    <strong data-ui={`pos-parked-title-${entry.id}`}>{entry.tableName || entry.channel || `Visita ${entry.id}`}</strong>
                    <span data-ui={`pos-parked-note-${entry.id}`}>{entry.parkedNote || "Sin nota"}</span>
                    <span data-ui={`pos-parked-summary-${entry.id}`}>{entry.covers} comensales · {money(entry.totalGrossCents || 0)}</span>
                    <span data-ui={`pos-parked-age-${entry.id}`} data-testid={`pos-parked-age-${entry.id}`}>{ageLabel(entry.openedAt)}</span>
                  </button>
                ))}
              </div>
            </section>
          ) : null}
          <div className="pos-modal__tables" data-testid="pos-table-grid">
            {visibleTables.map((table) => (
              <POSTableTile table={table} key={table.id} totalCents={table.occupied ? tableTotals.get(table.id) : undefined} onSelect={selectTable} />
            ))}
          </div>
          {!visibleTables.length ? <p className="pos-modal__empty" data-testid="pos-tables-empty">No hay mesas en esta zona.</p> : null}
          {register.selectedTable && !register.visit ? (
            <div className="pos-modal__confirm" data-testid="pos-tables-confirm">
              {eligibleReservations.length ? (
                <label className="pos-modal__covers" data-testid="pos-reservation-field">Reserva
                  <select value={register.bookingId} onChange={(event) => register.selectReservation(Number(event.target.value))} data-testid="pos-reservation-select">
                    <option value={0} data-testid="pos-reservation-none">Sin reserva</option>
                    {eligibleReservations.map((item) => (
                      <option value={item.id} key={item.id} data-testid={`pos-reservation-${item.id}`}>{item.reservationTime} · {item.customerName} · {item.partySize}</option>
                    ))}
                  </select>
                </label>
              ) : null}
              <label className="pos-modal__covers" data-testid="pos-covers-field">Comensales
                <input inputMode="numeric" value={register.covers} onChange={(event) => register.setCovers(event.target.value)} aria-label="Comensales" data-testid="pos-covers-input" />
              </label>
              <button className="pos-modal__primary" type="button" disabled={register.busy} onClick={() => { void register.openVisit().then(() => setShowTables(false)); }} data-testid="pos-open-visit">
                Abrir {register.selectedTable.name}
              </button>
            </div>
          ) : null}
        </POSDialog>
      ) : null}

      {prompt === "aparcar" ? (
        <POSPromptModal testId="pos-park" title="Aparcar comanda" confirmLabel="Aparcar" busy={register.busy} error={register.error}
          fields={[{ name: "note", label: "Nota (opcional)", placeholder: "Esperando postre..." }]}
          onClose={closePrompt} onConfirm={(values, option) => void runPrompt("aparcar", values, option)} />
      ) : null}

      {prompt === "recargo" ? (
        <POSPromptModal testId="pos-surcharge" title="Recargo" confirmLabel="Aplicar recargo" busy={register.busy} error={register.error}
          options={[{ value: "amount", label: "€" }, { value: "percent", label: "%" }]} optionsLabel="Tipo de recargo" initialOption="amount"
          fields={[
            { name: "value", label: "Importe", inputMode: "decimal", required: true },
            { name: "reason", label: "Motivo", placeholder: "Terraza, servicio...", required: true },
          ]}
          validate={(values, option) => { const value = Number((values.value || "").replace(",", ".")); return !Number.isFinite(value) || value <= 0 || (option === "percent" && value > 100) ? "Introduce un recargo válido." : null; }}
          summary={(values, option) => { const value = Number((values.value || "").replace(",", ".")) || 0; const surcharge = option === "percent" ? Math.round(register.ticketTotal * value / 100) : Math.round(value * 100); return `Base ${money(register.ticketTotal)} · Descuento ${money(register.ticket?.discountCents || 0)} · Recargo ${money(Math.max(surcharge, 0))} · Total ${money(register.ticketTotal + Math.max(surcharge, 0))}`; }}
          onClose={closePrompt} onConfirm={(values, option) => void runPrompt("recargo", values, option)} />
      ) : null}

      {prompt === "invita" ? (
        <POSPromptModal testId="pos-comp" title={selectedLine?.comped ? "Quitar invitación" : "Invitar línea"} confirmLabel={selectedLine?.comped ? "Restaurar precio" : "Invitar"} busy={register.busy} error={register.error}
          fields={[{ name: "reason", label: "Motivo", placeholder: "Invitación de la casa", required: !selectedLine?.comped }]}
          summary={() => selectedLine ? selectedLine.comped ? `${selectedLine.productName} recuperará su precio.` : `${selectedLine.quantity} × ${selectedLine.productName} pasará a 0,00 €` : "Selecciona una línea de la cuenta."}
          onClose={closePrompt} onConfirm={(values, option) => void runPrompt("invita", values, option)} />
      ) : null}

      {prompt === "comentario" ? (
        <POSPromptModal testId="pos-note" title="Comentario" confirmLabel="Guardar comentario" busy={register.busy} error={register.error}
          fields={[{ name: "note", label: "Comentario", kind: "textarea", placeholder: "Sin cebolla, poco hecho...", initialValue: selectedLine?.notes ?? "" }]}
          summary={() => selectedLine ? `Se añadirá a ${selectedLine.productName}` : "Selecciona una línea de la cuenta."}
          onClose={closePrompt} onConfirm={(values, option) => void runPrompt("comentario", values, option)} />
      ) : null}

      {prompt === "cajon" ? (
        <POSPromptModal testId="pos-drawer" title="Abrir cajón" confirmLabel="Abrir cajón" busy={register.busy} error={register.error}
          options={[{ value: "NO_SALE", label: "Sin venta" }, { value: "CHANGE", label: "Cambio" }, { value: "COUNT", label: "Arqueo" }]}
          optionsLabel="Motivo" initialOption="NO_SALE"
          fields={[{ name: "note", label: "Nota (opcional)" }]}
          onClose={closePrompt} onConfirm={(values, option) => void runPrompt("cajon", values, option)} />
      ) : null}

      {prompt === "cliente" ? (
        <POSPromptModal testId="pos-customer" title="Cliente" confirmLabel="Guardar cliente" busy={register.busy} error={register.error}
          fields={[
            { name: "customerName", label: "Nombre", initialValue: register.visit?.customerName ?? "", required: true },
            { name: "customerTaxId", label: "NIF/CIF", initialValue: register.visit?.customerTaxId ?? "" },
          ]}
          onClose={closePrompt} onConfirm={(values, option) => void runPrompt("cliente", values, option)} />
      ) : null}

      {prompt === "empleado" ? (
        <POSPromptModal testId="pos-operator" title="Empleado" confirmLabel="Asignar empleado" busy={register.busy} error={register.error}
          fields={[{ name: "operatorMemberId", label: "Empleado", kind: "select", initialValue: String(register.ticket?.operatorMemberId || ""), options: [{ value: "", label: "Sin asignar" }, ...register.operators.map((entry) => ({ value: String(entry.id), label: entry.displayName }))] }]}
          onClose={closePrompt} onConfirm={(values, option) => void runPrompt("empleado", values, option)} />
      ) : null}

      {prompt === "propina" ? (
        <POSPromptModal testId="pos-tip" title="Propina" confirmLabel="Añadir propina" busy={register.busy} error={register.error}
          fields={[{ name: "value", label: "Propina €", inputMode: "decimal", required: true }]}
          validate={(values) => Number((values.value || "").replace(",", ".")) < 0 || !Number.isFinite(Number((values.value || "").replace(",", "."))) ? "Introduce una propina válida." : null}
          summary={(values) => `Se cobrará ${money(register.ticketTotal + Math.round((Number((values.value || "").replace(",", ".")) || 0) * 100))} en total`}
          onClose={closePrompt} onConfirm={(values, option) => void runPrompt("propina", values, option)} />
      ) : null}

      {prompt === "juntar-mesas" ? <POSMultiSelectDialog testId="pos-merge" title="Juntar mesas" confirmLabel="Juntar en esta cuenta" busy={register.busy} error={register.error} emptyLabel="No hay otras mesas abiertas." selectedIds={multiSelectIds} onChange={setMultiSelectIds} onClose={closePrompt} onConfirm={() => { void register.mergeVisits(multiSelectIds).then((merged) => { if (merged) closePrompt(); }); }} entries={mergeableVisits.map((entry) => ({ id: entry.id, label: entry.tableName || `Visita ${entry.id}`, detail: `${entry.covers} comensales · ${entry.ticket?.lines.length || 0} líneas · ${money(entry.totalGrossCents || entry.ticket?.totalGrossCents || 0)}`, covers: entry.covers, amountCents: entry.totalGrossCents }))} /> : null}

      {prompt === "tags" ? <POSMultiSelectDialog testId="pos-tags" title="Etiquetas" confirmLabel="Guardar etiquetas" allowEmptySelection busy={register.busy} error={register.error} emptyLabel="No hay etiquetas disponibles." selectedIds={multiSelectIds} onChange={setMultiSelectIds} onClose={closePrompt} onConfirm={() => void saveTags()} entries={register.tags.filter((tag) => tag.isActive !== false || selectedLine?.tagIds?.includes(tag.id)).map((tag) => ({ id: tag.id, label: tag.name }))} /> : null}

      {prompt === "cerrar-mesas" ? (
        <POSPromptModal testId="pos-bulk-close" title="Cerrar todas las mesas abiertas" confirmLabel="Cerrar mesas" busy={register.busy || comandaBusy} error={register.error}
          options={[{ value: "CASH", label: "Efectivo" }, { value: "CARD", label: "Tarjeta" }]} optionsLabel="Método de cobro" initialOption="CASH"
          summary={() => openVisitCount > 0 ? (
            <span data-testid="pos-bulk-close-summary">
              {openVisitCount} mesa(s) · {money(openVisitTotalCents)} · {openVisits.map((entry) => entry.tableName || entry.channel || `Visita ${entry.id}`).join(", ")}. Se cerrarán.
            </span>
          ) : "No hay mesas abiertas para cerrar."}
          onClose={closePrompt} onConfirm={(_values, option) => { void runBulkClose(option).then((ok) => { if (ok) closePrompt(); }); }} />
      ) : null}

      {prompt === "cerrar-dia" ? (
        <POSPromptModal testId="pos-close-day" title="Cerrar día de caja" confirmLabel="Cerrar día" busy={register.busy} error={closeDayError || register.error}
          fields={[
            { name: "countedCash", label: "Efectivo contado €", inputMode: "decimal", required: true },
            { name: "discrepancyReason", label: "Motivo descuadre (si lo hay)" },
          ]}
          validate={(values) => Number((values.countedCash || "").replace(",", ".")) < 0 || !Number.isFinite(Number((values.countedCash || "").replace(",", "."))) ? "Introduce el efectivo contado." : null}
          summary={() => `${totals ? `Ventas del día ${money(totals.totalGrossCents)}` : "Sin totales"}${cashDayError || closeDayError ? ` · ${cashDayError || closeDayError}` : ""}`}
          onClose={() => { setCloseDayError(""); closePrompt(); }} onConfirm={(values) => { void runCloseDay(values).then((ok) => { if (ok) closePrompt(); }); }} />
      ) : null}

      {divideOpen && register.ticket ? (
        <POSDialog testId="pos-divide" title="Dividir comanda" busy={register.busy} error={register.error} onClose={() => setDivideOpen(false)}>
          <div className="pos-modal__confirm" data-testid="pos-divide-body">
            <label className="pos-modal__covers" htmlFor="pos-divide-guests" data-testid="pos-divide-guests-field">Comensales
              <input id="pos-divide-guests" inputMode="numeric" value={divideGuests} onChange={(event) => setDivideGuests(event.target.value)} data-ui="pos-divide-guests" data-testid="pos-divide-guests" />
            </label>
            <p className="pos-modal__pending" data-testid="pos-divide-share">Cada uno paga {money(divideShares[0] || 0)}</p>
            <p className="pos-modal__pending" data-testid="pos-divide-shares">{divideShares.map((share) => money(share)).join(" + ")}</p>
            <p className="pos-modal__pending" id="pos-divide-partial-help" data-testid="pos-divide-partial-help">El cobro parcial aún no está disponible. Cobra la cuenta completa o separa las líneas en cuentas para cobrarlas por separado.</p>
            <button className="pos-modal__primary" type="button" disabled title="Cobro parcial aún no disponible" aria-describedby="pos-divide-partial-help" data-testid="pos-divide-collect">Cobrar una parte</button>
          </div>
        </POSDialog>
      ) : null}

      {discountOpen && register.ticket ? (
        <POSDialog testId="pos-discount" title="Descuento" busy={register.busy} error={register.error} onClose={closeDiscount}>
          <div className="pos-modal__confirm" data-testid="pos-discount-body">
            <div className="pos-modal__modes" role="group" aria-label="Tipo de descuento" data-testid="pos-discount-modes">
              <button className="pos-modal__secondary" type="button" aria-pressed={discountMode === "amount"} onClick={() => setDiscountMode("amount")} data-testid="pos-discount-mode-amount">€</button>
              <button className="pos-modal__secondary" type="button" aria-pressed={discountMode === "percent"} onClick={() => setDiscountMode("percent")} data-testid="pos-discount-mode-percent">%</button>
            </div>
            <label className="pos-modal__covers" htmlFor="pos-discount-amount" data-testid="pos-discount-amount-field">{discountMode === "percent" ? "Porcentaje" : "Importe €"}
              <input id="pos-discount-amount" inputMode="decimal" value={discountValue} onChange={(event) => setDiscountValue(event.target.value)} data-ui="pos-discount-amount" data-testid="pos-discount-amount" />
            </label>
            <label className="pos-modal__covers" htmlFor="pos-discount-reason" data-testid="pos-discount-reason-field">Motivo
              <input id="pos-discount-reason" value={discountReason} onChange={(event) => setDiscountReason(event.target.value)} placeholder="Fidelidad, incidencia..." data-ui="pos-discount-reason" data-testid="pos-discount-reason" />
            </label>
            <p className="pos-modal__pending" data-testid="pos-discount-preview">Descuento {money(discountCents)} · Total {money(Math.max(register.ticketTotal - discountCents, 0))}</p>
            <button className="pos-modal__primary" type="button" disabled={register.busy || discountCents <= 0 || !discountReason.trim()} onClick={() => void confirmDiscount()} data-pos-command="discount" data-testid="pos-discount-confirm">Aplicar descuento</button>
          </div>
        </POSDialog>
      ) : null}

      {voidOrderOpen && register.ticket ? (
        <POSDialog testId="pos-void-order" title="Borrar comanda" busy={register.busy} error={register.error} onClose={closeVoidOrder}>
          <div className="pos-modal__confirm" data-testid="pos-void-order-body">
            <p className="pos-modal__pending" data-testid="pos-void-order-summary">
              Se anularán {register.activeTicketLines.length} línea(s) por {money(register.ticketTotal)} y se cancelará la mesa.
            </p>
            <label className="pos-modal__covers" htmlFor="pos-void-order-reason" data-testid="pos-void-order-reason-field">Motivo
              <input
                id="pos-void-order-reason"
                value={voidOrderReason}
                onChange={(event) => setVoidOrderReason(event.target.value)}
                placeholder="Error de comanda, cliente se va..."
                data-ui="pos-void-order-reason"
                data-testid="pos-void-order-reason"
              />
            </label>
            <button
              className="pos-modal__primary"
              type="button"
              disabled={register.busy}
              onClick={() => void confirmVoidOrder()}
              data-pos-command="void-order"
              data-testid="pos-void-order-confirm"
            >
              Borrar comanda
            </button>
          </div>
        </POSDialog>
      ) : null}

      <POSMoveLineDialog
        line={lineToMove}
        targets={register.otherOpenSplitTickets}
        tableName={register.visit?.tableName}
        busy={register.busy}
        error={register.error}
        onClose={() => setLineToMove(null)}
        onConfirm={confirmMoveLine}
      />

      {showCheckout && register.ticket ? (
        <POSDialog testId="pos-checkout" title={`Cobrar · ${money(register.amountDueCents)}`} busy={register.busy} error={register.error} onClose={() => { setShowCheckout(false); setCheckoutKeypad(false); }}>
          <div className="pos-modal__payments" data-testid="pos-checkout-payments">
            <label data-testid="pos-cash-field">Efectivo<input inputMode="decimal" value={register.cash} onChange={(event) => register.setCash(event.target.value)} data-ui="pos-cash" data-testid="pos-cash" /></label>
            <label data-testid="pos-card-field">Tarjeta<input inputMode="decimal" value={register.card} onChange={(event) => register.setCard(event.target.value)} data-ui="pos-card" data-testid="pos-card" /></label>
            {Number(register.card) > 0 ? <label data-testid="pos-card-reference-field">Referencia terminal<input value={register.cardReference} onChange={(event) => register.setCardReference(event.target.value)} data-ui="pos-card-reference" data-testid="pos-card-reference" /></label> : null}
            <div className="pos-modal__modes" role="group" aria-label="Efectivo rápido" data-testid="pos-quick-cash">
              {quickCashOptions.map((option) => (
                <button className="pos-modal__secondary" type="button" key={option.key} onClick={() => register.setCash(option.value.toFixed(2))} data-testid={`pos-quick-cash-${option.key}`}>{option.label}</button>
              ))}
            </div>
            <button className="pos-modal__secondary" type="button" aria-pressed={checkoutKeypad} onClick={() => setCheckoutKeypad((current) => !current)} data-testid="pos-checkout-keypad-toggle">{checkoutKeypad ? "Ocultar teclado" : "Usar teclado"}</button>
            {checkoutKeypad ? <POSKeypad value={register.cash} onChange={register.setCash} contextLabel="Efectivo" onConfirm={() => setCheckoutKeypad(false)} confirmLabel="Listo" readOnly={readOnly} testIdPrefix="pos-checkout-" /> : null}
            <p className="pos-modal__pending" data-testid="pos-checkout-sale">Venta {money(register.ticketTotal)}</p>
            {register.tipCents > 0 ? <p className="pos-modal__pending" data-testid="pos-checkout-tip">Propina {money(register.tipCents)}</p> : null}
            <p className="pos-modal__pending" data-testid="pos-checkout-due">Total a cobrar {money(register.amountDueCents)}</p>
            <p className="pos-modal__pending" data-testid="pos-checkout-pending">Pendiente {money(Math.max(register.amountDueCents - register.paymentTotal, 0))}</p>
            <p className="pos-modal__pending" data-testid="pos-checkout-change">Cambio {money(register.changeDue)}</p>
            <button className="pos-modal__primary" type="button" disabled={register.busy || register.paymentTotal < register.amountDueCents || register.ticketTotal < 0} onClick={() => { void register.checkout().then((paid) => { if (paid) { setShowCheckout(false); setCheckoutKeypad(false); } }); }} data-pos-command="checkout" data-testid="pos-checkout-confirm">
              Cobrar y cerrar
            </button>
          </div>
        </POSDialog>
      ) : null}
    </div>
  );
}
