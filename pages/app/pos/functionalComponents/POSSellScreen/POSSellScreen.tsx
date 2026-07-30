import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";

import { usePOSRegister, money, type Table, type TicketLine } from "../../hooks/usePOSRegister";
import { POSCategoryPanel } from "./POSCategoryPanel";
import { POSProductGrid } from "./POSProductGrid";
import { POSTicketPanel } from "./POSTicketPanel";
import { POSKeypad } from "./POSKeypad";
import { POSControlRail, type RailFeatureKey } from "./POSControlRail";
import { ConfirmDialog } from "../../../../../ui/overlays/ConfirmDialog";
import { splitShares } from "../../utils/splitShares";
import { POSPromptModal } from "./POSPromptModal";
import { POSMultiSelectDialog } from "./POSMultiSelectDialog";
import { downloadComandaPdf } from "../../utils/comandaPdf";

type KeypadContext = { kind: "quantity" } | { kind: "cash" } | { kind: "discount" } | { kind: "covers" };

/**
 * Visual sell screen. Layout:
 *   [ column: [ticket | keypad] over [categories | products] ] [ control rail ]
 */
export function POSSellScreen() {
  const register = usePOSRegister();
  const [category, setCategory] = useState("");
  const [keypadValue, setKeypadValue] = useState("");
  const [keypadContext, setKeypadContext] = useState<KeypadContext>({ kind: "quantity" });
  const [selectedLineId, setSelectedLineId] = useState(0);
  const [showTables, setShowTables] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [lineToVoid, setLineToVoid] = useState<TicketLine | null>(null);
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
    setKeypadValue(String(line.quantity));
  }, []);

  const confirmKeypad = useCallback(() => {
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
  }, [keypadContext.kind, keypadNumber, keypadValue, register, selectedLineId]);

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

  const collectShare = useCallback(() => {
    const share = divideShares[0];
    if (!share) return;
    register.setCash((share / 100).toFixed(2));
    setDivideOpen(false);
    setShowCheckout(true);
  }, [divideShares, register]);

  const selectTable = useCallback((table: Table) => {
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
  }, [register]);

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

  const quickCashOptions = useMemo(() => {
    const exact = register.amountDueCents / 100;
    const notes = [5, 10, 20, 50].filter((note) => note > exact);
    return [{ key: "exact", label: "Exacto", value: exact }, ...notes.map((note) => ({ key: String(note), label: `${note} €`, value: note }))];
  }, [register.amountDueCents]);

  const disabledRailKeys = useMemo<RailFeatureKey[]>(() => {
    const keys: RailFeatureKey[] = [];
    if (!register.hasPendingKitchenLines) keys.push("cocina");
    if (!register.activeTicketLines.length || comandaBusy) keys.push("comanda");
    if (!register.ticket) keys.push("total", "borrar-comanda", "descuento", "separar-comanda", "dividir-comanda", "recargo", "invita", "comentario", "aparcar", "juntar-mesas", "cliente", "empleado", "tags", "propina");
    if (!selectedLine || (selectedLine.status && selectedLine.status !== "ACTIVE")) keys.push("invita", "comentario", "tags");
    if (register.visit) keys.push("barra");
    if (register.settings.requireOpenShift && register.currentShift?.status !== "OPEN") keys.push("cajon");
    return keys;
  }, [comandaBusy, register.activeTicketLines.length, register.currentShift?.status, register.hasPendingKitchenLines, register.settings.requireOpenShift, register.ticket, register.visit, selectedLine]);

  const moveLineToTarget = useCallback((line: TicketLine) => {
    const target = register.otherOpenSplitTickets[0];
    if (!target) return;
    register.setSplitTargetId(target.id);
    void register.moveLine(line);
  }, [register]);

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
      case "total": if (register.ticket) { setKeypadContext({ kind: "cash" }); setShowCheckout(true); } break;
      case "comanda": void printComanda(); break;
      case "cocina": void register.sendKitchen(); break;
      case "descuento": if (register.ticket) { setKeypadContext({ kind: "discount" }); setDiscountOpen(true); } break;
      case "separar-comanda": void register.createSplitTicket(); break;
      case "borrar-comanda": if (register.ticket) setVoidOrderOpen(true); break;
      case "dividir-comanda": if (register.ticket) setDivideOpen(true); break;
      case "salon": setAreaFilter(0); setShowTables(true); break;
      case "barra": void register.openBar(); break;
      case "aparcar": case "recargo": case "invita": case "comentario": case "cajon":
      case "cliente": case "empleado": case "juntar-mesas": case "tags": case "propina":
        openPrompt(key); break;
      case "combinado": case "suplemento": case "pack":
        register.setMessage("Configura modificadores y packs en Catálogo para usar esta función.");
        break;
      default: register.setMessage(`Función "${key}" disponible próximamente.`); break;
    }
  }, [openPrompt, printComanda, register]);

  const contextLabel = keypadContext.kind === "quantity" ? "Cantidad" : keypadContext.kind === "cash" ? "Efectivo" : keypadContext.kind === "discount" ? "Descuento €" : "Comensales";

  return (
    <div className="pos-sell" data-ui="pos-sell-screen" data-testid="pos-sell-screen">
      <div className="pos-sell__top" data-testid="pos-sell-top">
        {register.error ? <div className="pos-sell__alert" role="alert" data-ui="pos-error" data-testid="pos-error">{register.error}</div> : null}
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
              onMoveLine={moveLineToTarget}
            />
            <POSKeypad value={keypadValue} onChange={setKeypadValue} contextLabel={contextLabel} onConfirm={confirmKeypad} confirmLabel="OK" onMultiplier={handleKeypadMultiplier} multiplierQty={keypadMultiplierQty} onClearMultiplier={clearKeypadMultiplier} />
          </div>
          <div className="pos-sell__row pos-sell__row--catalog" data-testid="pos-sell-row-catalog" hidden={ticketExpanded}>
            <POSCategoryPanel categories={categories} active={category} onSelect={setCategory} />
            <POSProductGrid products={visibleProducts} busy={register.busy || !register.ticket} onAdd={handleAddProduct} />
          </div>
        </div>
        <POSControlRail onAction={railAction} disabledKeys={disabledRailKeys} />
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
        <div className="pos-modalBackdrop" role="presentation" onClick={closeTables} data-testid="pos-tables-backdrop">
          <div className="pos-modal" role="dialog" aria-modal="true" aria-label={register.visit ? "Cambiar mesa" : "Mesas"} onClick={(event) => event.stopPropagation()} data-testid="pos-tables-modal">
            <header className="pos-modal__header" data-testid="pos-tables-modal-header">
              <h2 data-testid="pos-tables-modal-title">{register.visit ? "Cambiar mesa" : "Mesas"}</h2>
               <button className="pos-modal__close" type="button" aria-label="Cerrar" onClick={closeTables} data-testid="pos-tables-close"><X className="h-4 w-4" aria-hidden="true" data-testid="pos-tables-close-icon" /></button>
            </header>
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
            <div className="pos-modal__tables" data-testid="pos-table-grid">
              {visibleTables.map((table) => (
                <button
                  className={table.occupied ? "pos-tableTile pos-tableTile--occupied" : "pos-tableTile"}
                  type="button"
                  key={table.id}
                  onClick={() => selectTable(table)}
                  data-testid={`pos-table-${table.id}`}
                >
                  <strong data-testid={`pos-table-name-${table.id}`}>{table.name}</strong>
                  <span data-testid={`pos-table-state-${table.id}`}>{table.occupied ? "Ocupada" : `${table.capacity} plazas`}</span>
                </button>
              ))}
            </div>
            {!visibleTables.length ? <p className="pos-modal__empty" data-testid="pos-tables-empty">No hay mesas en esta zona.</p> : null}
            {parkedVisits.length && !register.visit ? (
              <div className="pos-modal__modes" role="group" aria-label="Comandas aparcadas" data-testid="pos-parked-list">
                {parkedVisits.map((entry) => (
                  <button className="pos-modal__secondary pos-parkedVisit" type="button" key={entry.id} disabled={register.busy} onClick={() => { void register.restoreParkedVisit(entry.id).then((restored) => { if (restored) closeTables(); }); }} data-testid={`pos-parked-${entry.id}`}>
                    <strong data-ui={`pos-parked-title-${entry.id}`}>{entry.tableName || entry.channel || `Visita ${entry.id}`}</strong>
                    <span data-ui={`pos-parked-note-${entry.id}`}>{entry.parkedNote || "Sin nota"}</span>
                    <span data-ui={`pos-parked-summary-${entry.id}`}>{entry.covers} comensales · {money(entry.totalGrossCents || 0)}</span>
                  </button>
                ))}
              </div>
            ) : null}
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
          </div>
        </div>
      ) : null}

      {prompt === "aparcar" ? (
        <POSPromptModal testId="pos-park" title="Aparcar comanda" confirmLabel="Aparcar" busy={register.busy}
          fields={[{ name: "note", label: "Nota (opcional)", placeholder: "Esperando postre..." }]}
          onClose={closePrompt} onConfirm={(values, option) => void runPrompt("aparcar", values, option)} />
      ) : null}

      {prompt === "recargo" ? (
        <POSPromptModal testId="pos-surcharge" title="Recargo" confirmLabel="Aplicar recargo" busy={register.busy}
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
        <POSPromptModal testId="pos-comp" title={selectedLine?.comped ? "Quitar invitación" : "Invitar línea"} confirmLabel={selectedLine?.comped ? "Restaurar precio" : "Invitar"} busy={register.busy}
          fields={[{ name: "reason", label: "Motivo", placeholder: "Invitación de la casa", required: !selectedLine?.comped }]}
          summary={() => selectedLine ? selectedLine.comped ? `${selectedLine.productName} recuperará su precio.` : `${selectedLine.quantity} × ${selectedLine.productName} pasará a 0,00 €` : "Selecciona una línea de la cuenta."}
          onClose={closePrompt} onConfirm={(values, option) => void runPrompt("invita", values, option)} />
      ) : null}

      {prompt === "comentario" ? (
        <POSPromptModal testId="pos-note" title="Comentario" confirmLabel="Guardar comentario" busy={register.busy}
          fields={[{ name: "note", label: "Comentario", kind: "textarea", placeholder: "Sin cebolla, poco hecho...", initialValue: selectedLine?.notes ?? "" }]}
          summary={() => selectedLine ? `Se añadirá a ${selectedLine.productName}` : "Selecciona una línea de la cuenta."}
          onClose={closePrompt} onConfirm={(values, option) => void runPrompt("comentario", values, option)} />
      ) : null}

      {prompt === "cajon" ? (
        <POSPromptModal testId="pos-drawer" title="Abrir cajón" confirmLabel="Abrir cajón" busy={register.busy}
          options={[{ value: "NO_SALE", label: "Sin venta" }, { value: "CHANGE", label: "Cambio" }, { value: "COUNT", label: "Arqueo" }]}
          optionsLabel="Motivo" initialOption="NO_SALE"
          fields={[{ name: "note", label: "Nota (opcional)" }]}
          onClose={closePrompt} onConfirm={(values, option) => void runPrompt("cajon", values, option)} />
      ) : null}

      {prompt === "cliente" ? (
        <POSPromptModal testId="pos-customer" title="Cliente" confirmLabel="Guardar cliente" busy={register.busy}
          fields={[
            { name: "customerName", label: "Nombre", initialValue: register.visit?.customerName ?? "", required: true },
            { name: "customerTaxId", label: "NIF/CIF", initialValue: register.visit?.customerTaxId ?? "" },
          ]}
          onClose={closePrompt} onConfirm={(values, option) => void runPrompt("cliente", values, option)} />
      ) : null}

      {prompt === "empleado" ? (
        <POSPromptModal testId="pos-operator" title="Empleado" confirmLabel="Asignar empleado" busy={register.busy}
          fields={[{ name: "operatorMemberId", label: "Empleado", kind: "select", initialValue: String(register.ticket?.operatorMemberId || ""), options: [{ value: "", label: "Sin asignar" }, ...register.operators.map((entry) => ({ value: String(entry.id), label: entry.displayName }))] }]}
          onClose={closePrompt} onConfirm={(values, option) => void runPrompt("empleado", values, option)} />
      ) : null}

      {prompt === "propina" ? (
        <POSPromptModal testId="pos-tip" title="Propina" confirmLabel="Añadir propina" busy={register.busy}
          fields={[{ name: "value", label: "Propina €", inputMode: "decimal", required: true }]}
          validate={(values) => Number((values.value || "").replace(",", ".")) < 0 || !Number.isFinite(Number((values.value || "").replace(",", "."))) ? "Introduce una propina válida." : null}
          summary={(values) => `Se cobrará ${money(register.ticketTotal + Math.round((Number((values.value || "").replace(",", ".")) || 0) * 100))} en total`}
          onClose={closePrompt} onConfirm={(values, option) => void runPrompt("propina", values, option)} />
      ) : null}

      {prompt === "juntar-mesas" ? <POSMultiSelectDialog testId="pos-merge" title="Juntar mesas" confirmLabel="Juntar en esta cuenta" busy={register.busy} emptyLabel="No hay otras mesas abiertas." selectedIds={multiSelectIds} onChange={setMultiSelectIds} onClose={closePrompt} onConfirm={() => { void register.mergeVisits(multiSelectIds).then((merged) => { if (merged) closePrompt(); }); }} entries={mergeableVisits.map((entry) => ({ id: entry.id, label: entry.tableName || `Visita ${entry.id}`, detail: `${entry.covers} comensales · ${entry.ticket?.lines.length || 0} líneas · ${money(entry.totalGrossCents || entry.ticket?.totalGrossCents || 0)}`, covers: entry.covers, amountCents: entry.totalGrossCents }))} /> : null}

      {prompt === "tags" ? <POSMultiSelectDialog testId="pos-tags" title="Etiquetas" confirmLabel="Guardar etiquetas" allowEmptySelection busy={register.busy} emptyLabel="No hay etiquetas disponibles." selectedIds={multiSelectIds} onChange={setMultiSelectIds} onClose={closePrompt} onConfirm={() => void saveTags()} entries={register.tags.filter((tag) => tag.isActive !== false || selectedLine?.tagIds?.includes(tag.id)).map((tag) => ({ id: tag.id, label: tag.name }))} /> : null}

      {divideOpen && register.ticket ? (
        <div className="pos-modalBackdrop" role="presentation" onClick={() => setDivideOpen(false)} data-testid="pos-divide-backdrop">
          <div className="pos-modal" role="dialog" aria-modal="true" aria-label="Dividir comanda" onClick={(event) => event.stopPropagation()} data-testid="pos-divide-modal">
            <header className="pos-modal__header" data-testid="pos-divide-header">
              <h2 data-testid="pos-divide-title">Dividir comanda</h2>
              <button className="pos-modal__close" type="button" aria-label="Cerrar" onClick={() => setDivideOpen(false)} data-testid="pos-divide-close"><X className="h-4 w-4" aria-hidden="true" data-testid="pos-divide-close-icon" /></button>
            </header>
            <div className="pos-modal__confirm" data-testid="pos-divide-body">
              <label className="pos-modal__covers" htmlFor="pos-divide-guests" data-testid="pos-divide-guests-field">Comensales
                <input id="pos-divide-guests" inputMode="numeric" value={divideGuests} onChange={(event) => setDivideGuests(event.target.value)} data-ui="pos-divide-guests" data-testid="pos-divide-guests" />
              </label>
              <p className="pos-modal__pending" data-testid="pos-divide-share">Cada uno paga {money(divideShares[0] || 0)}</p>
              <p className="pos-modal__pending" data-testid="pos-divide-shares">{divideShares.map((share) => money(share)).join(" + ")}</p>
              <button className="pos-modal__primary" type="button" disabled={!divideShares.length} onClick={collectShare} data-testid="pos-divide-collect">Cobrar una parte</button>
            </div>
          </div>
        </div>
      ) : null}

      {discountOpen && register.ticket ? (
        <div className="pos-modalBackdrop" role="presentation" onClick={closeDiscount} data-testid="pos-discount-backdrop">
          <div className="pos-modal" role="dialog" aria-modal="true" aria-label="Descuento" onClick={(event) => event.stopPropagation()} data-testid="pos-discount-modal">
            <header className="pos-modal__header" data-testid="pos-discount-header">
              <h2 data-testid="pos-discount-title">Descuento</h2>
              <button className="pos-modal__close" type="button" aria-label="Cerrar" onClick={closeDiscount} data-testid="pos-discount-close"><X className="h-4 w-4" aria-hidden="true" data-testid="pos-discount-close-icon" /></button>
            </header>
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
              <button className="pos-modal__primary" type="button" disabled={register.busy || discountCents <= 0 || !discountReason.trim()} onClick={() => void confirmDiscount()} data-testid="pos-discount-confirm">Aplicar descuento</button>
            </div>
          </div>
        </div>
      ) : null}

      {voidOrderOpen && register.ticket ? (
        <div className="pos-modalBackdrop" role="presentation" onClick={closeVoidOrder} data-testid="pos-void-order-backdrop">
          <div className="pos-modal" role="dialog" aria-modal="true" aria-label="Borrar comanda" onClick={(event) => event.stopPropagation()} data-testid="pos-void-order-modal">
            <header className="pos-modal__header" data-testid="pos-void-order-header">
              <h2 data-testid="pos-void-order-title">Borrar comanda</h2>
              <button className="pos-modal__close" type="button" aria-label="Cerrar" onClick={closeVoidOrder} data-testid="pos-void-order-close"><X className="h-4 w-4" aria-hidden="true" data-testid="pos-void-order-close-icon" /></button>
            </header>
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
                data-testid="pos-void-order-confirm"
              >
                Borrar comanda
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showCheckout && register.ticket ? (
        <div className="pos-modalBackdrop" role="presentation" onClick={() => setShowCheckout(false)} data-testid="pos-checkout-backdrop">
          <div className="pos-modal" role="dialog" aria-modal="true" aria-label="Cobro" onClick={(event) => event.stopPropagation()} data-testid="pos-checkout-modal">
            <header className="pos-modal__header" data-testid="pos-checkout-header">
               <h2 data-testid="pos-checkout-title">Cobrar · {money(register.amountDueCents)}</h2>
              <button className="pos-modal__close" type="button" aria-label="Cerrar" onClick={() => setShowCheckout(false)} data-testid="pos-checkout-close"><X className="h-4 w-4" aria-hidden="true" data-testid="pos-checkout-close-icon" /></button>
            </header>
            <div className="pos-modal__payments" data-testid="pos-checkout-payments">
              <label data-testid="pos-cash-field">Efectivo<input inputMode="decimal" value={register.cash} onChange={(event) => register.setCash(event.target.value)} data-ui="pos-cash" data-testid="pos-cash" /></label>
              <label data-testid="pos-card-field">Tarjeta<input inputMode="decimal" value={register.card} onChange={(event) => register.setCard(event.target.value)} data-ui="pos-card" data-testid="pos-card" /></label>
              {Number(register.card) > 0 ? <label data-testid="pos-card-reference-field">Referencia terminal<input value={register.cardReference} onChange={(event) => register.setCardReference(event.target.value)} data-ui="pos-card-reference" data-testid="pos-card-reference" /></label> : null}
              <div className="pos-modal__modes" role="group" aria-label="Efectivo rápido" data-testid="pos-quick-cash">
                {quickCashOptions.map((option) => (
                  <button className="pos-modal__secondary" type="button" key={option.key} onClick={() => register.setCash(option.value.toFixed(2))} data-testid={`pos-quick-cash-${option.key}`}>{option.label}</button>
                ))}
              </div>
              <p className="pos-modal__pending" data-testid="pos-checkout-sale">Venta {money(register.ticketTotal)}</p>
              {register.tipCents > 0 ? <p className="pos-modal__pending" data-testid="pos-checkout-tip">Propina {money(register.tipCents)}</p> : null}
              <p className="pos-modal__pending" data-testid="pos-checkout-due">Total a cobrar {money(register.amountDueCents)}</p>
              <p className="pos-modal__pending" data-testid="pos-checkout-pending">Pendiente {money(Math.max(register.amountDueCents - register.paymentTotal, 0))}</p>
              <p className="pos-modal__pending" data-testid="pos-checkout-change">Cambio {money(register.changeDue)}</p>
              <button className="pos-modal__primary" type="button" disabled={register.busy || register.paymentTotal < register.amountDueCents || register.ticketTotal < 0} onClick={() => { void register.checkout().then((paid) => { if (paid) setShowCheckout(false); }); }} data-testid="pos-checkout-confirm">
                Cobrar y cerrar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
