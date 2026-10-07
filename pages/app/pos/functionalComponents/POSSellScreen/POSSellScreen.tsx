import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { POSSelect } from "../POSSelect/POSSelect";

import { usePOSRegister, money, request, type Table, type TicketLine } from "../../hooks/usePOSRegister";
import { POSCategoryPanel } from "./POSCategoryPanel";
import { POSProductGrid } from "./POSProductGrid";
import { POSTicketPanel } from "./POSTicketPanel";
import { POSKeypad } from "./POSKeypad";
import { POSClosureDialog } from "../CashControl/POSClosureDialog";
import { POSControlRail, RAIL_FEATURES, type RailFeatureKey } from "./POSControlRail";
import { ConfirmDialog } from "../../../../../ui/overlays/ConfirmDialog";
import { splitShares } from "../../utils/splitShares";
import { POSPromptModal } from "./POSPromptModal";
import { POSMultiSelectDialog } from "./POSMultiSelectDialog";
import { POSDialog } from "./POSDialog";
import { useCheckoutTenders } from "../../hooks/useCheckoutTenders";
import { POS_PAYMENT_METHODS, POS_PAYMENT_METHOD_LABELS, formatTenderInput, tenderedCentsOf, type POSPaymentMethod } from "../../utils/paymentMethods";
import { POSMoveLineDialog } from "./POSMoveLineDialog";
import { POSModifierPicker } from "./POSModifierPicker";
import { POSPackPicker } from "./POSPackPicker";
import { POSRecallDialog } from "./POSRecallDialog";
import { POSPinDialog } from "./POSPinDialog";
import { printTicketReceipt } from "./printReceipt";
import { POSTableTile } from "./POSTableTile";
import { POSDayBillingDialog } from "./POSDayBillingDialog";
import { POSFiscalDialog } from "./POSFiscalDialog";
import { POSGuestDialog } from "./POSGuestDialog";
import { POSOfflineBar } from "./POSOfflineBar";
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

/** Legacy test ids kept so the first cash and card split lines stay addressable. */
function legacyTenderId(entry: { id: string; method: POSPaymentMethod }, entries: { id: string; method: POSPaymentMethod }[]): string | null {
  if (entry.method === "CASH" && entries.find((item) => item.method === "CASH")?.id === entry.id) return "pos-cash";
  if (entry.method === "CARD" && entries.find((item) => item.method === "CARD")?.id === entry.id) return "pos-card";
  return null;
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
  const [checkoutMethod, setCheckoutMethod] = useState<POSPaymentMethod>("CASH");
  const tenders = useCheckoutTenders({ saleTotalCents: register.ticketTotal, tipCents: register.tipCents });
  const [checkoutKeypad, setCheckoutKeypad] = useState(false);
  const [lineToVoid, setLineToVoid] = useState<TicketLine | null>(null);
  const [lineToMove, setLineToMove] = useState<TicketLine | null>(null);
  /** A product with modifier groups awaiting the guest's choice. */
  const [productToModify, setProductToModify] = useState<Parameters<typeof register.addProduct>[0] | null>(null);
  const [packToAdd, setPackToAdd] = useState<Parameters<typeof register.addPack>[0] | null>(null);
  const [showRecall, setShowRecall] = useState(false);
  const [showPinSetup, setShowPinSetup] = useState(false);
  const [pinApproval, setPinApproval] = useState(false);
  const [pinError, setPinError] = useState("");
  const [voidOrderOpen, setVoidOrderOpen] = useState(false);
  const [voidOrderReason, setVoidOrderReason] = useState("");
  const [discountOpen, setDiscountOpen] = useState(false);
  const [discountMode, setDiscountMode] = useState<"amount" | "percent">("amount");
  const [discountValue, setDiscountValue] = useState("");
  const [discountReason, setDiscountReason] = useState("");
  const [divideOpen, setDivideOpen] = useState(false);
  const [divideGuests, setDivideGuests] = useState("2");
  const [prompt, setPrompt] = useState<RailFeatureKey | null>(null);
  // "create" names a check that does not exist yet; "rename" names the current one.
  const [guestDialog, setGuestDialog] = useState<"create" | "rename" | null>(null);
  const [areaFilter, setAreaFilter] = useState(0);
  const [ticketExpanded, setTicketExpanded] = useState(false);
  const [syncingOffline, setSyncingOffline] = useState(false);
  const [multiSelectIds, setMultiSelectIds] = useState<number[]>([]);
  const [comandaBusy, setComandaBusy] = useState(false);
  const comandaInFlight = useRef(false);
  const closeDayInFlight = useRef(false);
  const [keypadMultiplierQty, setKeypadMultiplierQty] = useState<number | null>(null);
  const [closeDayError, setCloseDayError] = useState("");
  const [closeDayBusy, setCloseDayBusy] = useState(false);
  const [billingOpen, setBillingOpen] = useState(false);

  const categories = useMemo(() => {
    const names = new Set<string>();
    for (const product of register.products) if (product.isActive && product.categoryName) names.add(product.categoryName);
    return [...names].sort((a, b) => a.localeCompare(b, "es"));
  }, [register.products]);

  const visibleProducts = useMemo(
    () => register.filteredProducts.filter((product) => !category || product.categoryName === category),
    [category, register.filteredProducts],
  );

  // Packs are not category members — a menú del día spans several — so they
  // follow the search text but are never hidden by the category strip.
  const visiblePacks = useMemo(() => {
    const needle = register.query.trim().toLowerCase();
    return register.packs.filter((pack) => !needle || pack.name.toLowerCase().includes(needle));
  }, [register.packs, register.query]);

  const keypadNumber = useMemo(() => Number(keypadValue.replace(",", ".")) || 0, [keypadValue]);

  const selectLine = useCallback((line: TicketLine) => {
    setSelectedLineId(line.id);
    setKeypadContext({ kind: "quantity" });
    // Selecting a line is inspection only. Never seed the shared keypad value:
    // it is read as a price override by the explicit add-product flow.
    setKeypadValue("");
    setKeypadMultiplierQty(null);
  }, []);

  /** Cash keypad and quick-amount buttons feed the first cash split line. */
  const cashKeypadEntry = tenders.entries.find((entry) => entry.method === "CASH") ?? tenders.entries[0] ?? null;
  const applyQuickCash = useCallback((value: number) => {
    if (cashKeypadEntry) tenders.updateEntry(cashKeypadEntry.id, { amount: value.toFixed(2) });
  }, [cashKeypadEntry, tenders]);

  const confirmKeypad = useCallback(() => {
    if (readOnly) return;
    if (keypadContext.kind === "quantity") {
      const line = register.activeTicketLines.find((entry) => entry.id === selectedLineId);
      if (line && keypadNumber > 0) void register.setLineQuantity(line, keypadNumber);
    } else if (keypadContext.kind === "cash") {
      applyQuickCash(keypadNumber);
      setShowCheckout(true);
    } else if (keypadContext.kind === "discount") {
      setDiscountMode("amount");
      setDiscountValue(keypadValue.replace(",", "."));
      setDiscountOpen(true);
    } else if (keypadContext.kind === "covers") {
      if (keypadNumber > 0) register.setCovers(String(Math.round(keypadNumber)));
    }
    setKeypadValue("");
  }, [applyQuickCash, keypadContext.kind, keypadNumber, keypadValue, readOnly, register, selectedLineId]);

  const confirmVoidLine = useCallback(async () => {
    if (!lineToVoid) return;
    // A void is the one action that takes money off a bill, so it is signed: the
    // manager's PIN is verified first and their name travels with the request.
    // A terminal whose staff have no PIN still works, it just skips the signature.
    if (!register.hasPin) {
      setPinError("");
      setPinApproval(true);
      return;
    }
    await register.voidLine(lineToVoid);
    setLineToVoid(null);
  }, [lineToVoid, register]);

  const approveVoid = useCallback(async (payload: { pin: string }) => {
    if (!lineToVoid) return;
    // Verified twice on purpose: once here so the dialog can refuse a wrong PIN
    // without touching the ticket, and again on the void itself, because the
    // server is the only place that can be trusted to check it.
    try {
      await register.verifyPin(payload.pin);
      setPinError("");
    } catch (failure) {
      // Kept in local state: the shared error belongs to the till, not to a
      // dialog the waiter is about to dismiss.
      setPinError(failure instanceof Error ? failure.message : "PIN incorrecto");
      return;
    }
    setPinApproval(false);
    await register.voidLine(lineToVoid, "Anulado con PIN de jefe", payload.pin);
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
  // Knowing whether this user has a PIN decides if a void asks for a manager, so it is
  // fetched once when the till opens rather than on the first void.
  useEffect(() => { void register.loadPinStatus(); }, [register.loadPinStatus]);
  // The strip shows what the kitchen has not got, so it follows the open ticket.
  useEffect(() => { void register.loadCourses(); }, [register.loadCourses, register.ticket?.id]);

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

  // Cierre X / Y open a preview dialog: X is the cumulative shift reading, Y a
  // partial cut since the previous Y. Z stays on the reports card where it
  // seals the shift and needs counted cash.
  const [closureDialog, setClosureDialog] = useState<"X" | "Y" | null>(null);
  const runCierre = useCallback((closureType: "X" | "Y") => {
    if (!register.currentShift?.id) { register.setError("Abre un turno antes de generar un cierre."); return; }
    register.setError("");
    setClosureDialog(closureType);
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
    if (!onCloseDay || closeDayInFlight.current) return false;
    closeDayInFlight.current = true;
    setCloseDayBusy(true);
    try {
      const countedCashCents = Math.round((Number((values.countedCash || "").replace(",", ".")) || 0) * 100);
      setCloseDayError("");
      const ok = await onCloseDay({ countedCashCents, discrepancyReason: values.discrepancyReason || "" });
      if (ok) { register.setMessage("Día cerrado."); return true; }
      // ponytail: cash-day hook returns only a boolean; surface a generic cause.
      // The rail guard already blocks the common OPEN_POS_ITEMS case, so this path
      // is mainly counted-cash discrepancies, which the operator retries inline.
      setCloseDayError(cashDayError || "No se pudo cerrar el día. Revisa el efectivo contado.");
      return false;
    } finally {
      closeDayInFlight.current = false;
      setCloseDayBusy(false);
    }
  }, [cashDayError, onCloseDay, register]);

  const quickCashOptions = useMemo(() => {
    const exact = register.amountDueCents / 100;
    const notes = [5, 10, 20, 50].filter((note) => note > exact);
    return [{ key: "exact", label: "Exacto", value: exact }, ...notes.map((note) => ({ key: String(note), label: `${note} €`, value: note }))];
  }, [register.amountDueCents]);

  /** "Exacto" never over-charges: it only fills what the other lines leave open. */
  const applyQuickCashExact = useCallback(() => {
    if (!cashKeypadEntry) return;
    const target = tenders.fillTargetFor(cashKeypadEntry.id);
    if (target > 0) tenders.updateEntry(cashKeypadEntry.id, { amount: formatTenderInput(target) });
  }, [cashKeypadEntry, tenders]);


  const disabledReasons = useMemo<Partial<Record<RailFeatureKey, string>>>(() => {
    const reasons: Partial<Record<RailFeatureKey, string>> = {};
    // A sealed day is a signed Z closure: nothing on the rail may touch it.
    if (readOnly) {
      // Facturación only reads, so it stays available on a sealed day.
      for (const feature of RAIL_FEATURES) if (!feature.readOnlySafe) reasons[feature.key] = "Día cerrado: solo consulta.";
      if (!date) reasons.facturacion = "Día de caja no determinado.";
      return reasons;
    }
    if (!date) reasons.facturacion = "Día de caja no determinado.";
    if (!register.hasPendingKitchenLines) reasons.cocina = "No hay líneas pendientes de enviar a cocina.";
    if (!register.activeTicketLines.length) reasons.comanda = "No hay líneas en la cuenta.";
    else if (comandaBusy) reasons.comanda = "Generando comanda…";
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
    if (!openVisitCount) reasons["cerrar-mesas"] = "No hay mesas abiertas para cerrar.";
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
  }, [cashDay?.status, comandaBusy, date, openVisitCount, readOnly, register.activeTicketLines.length, register.currentShift?.status, register.hasPendingKitchenLines, register.settings.requireOpenShift, register.ticket, register.visit, selectedLine]);

  const confirmMoveLine = useCallback((targetId: number, quantity: number) => {
    if (!lineToMove) return;
    register.setSplitTargetId(targetId);
    void register.moveLine(lineToMove, quantity, targetId);
    setLineToMove(null);
  }, [lineToMove, register]);

  const closeCheckout = useCallback(() => {
    setShowCheckout(false);
    setCheckoutKeypad(false);
    tenders.clear();
  }, [tenders]);

  const confirmCheckout = useCallback(() => {
    void register.checkout(register.tipCents, tenders.allocations).then((paid) => {
      if (paid) closeCheckout();
    });
  }, [closeCheckout, register, tenders]);

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
    // A product with modifier groups needs the guest's choice first: the price
    // of the line is not final until the extras are picked.
    if (product.modifierGroups?.length) {
      setProductToModify(product);
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

  const handleConfirmModifiers = useCallback((modifiers: { modifierOptionId: number; quantity: number }[]) => {
    if (!productToModify) return;
    // The pending qty x price multiplier is honoured, but the pending price
    // override is not: the picker already showed the price the guest is
    // agreeing to, and a hidden override underneath it would be a surprise on
    // the receipt. An override typed by mistake can be cleared with "C".
    const quantity = keypadMultiplierQty && keypadMultiplierQty > 0 ? keypadMultiplierQty : undefined;
    void register.addProduct(productToModify, { modifiers, ...(quantity ? { quantity } : {}) });
    setProductToModify(null);
    setKeypadValue("");
    setKeypadMultiplierQty(null);
  }, [keypadMultiplierQty, productToModify, register]);

  const handleAddPack = useCallback((pack: Parameters<typeof register.addPack>[0]) => {
    // The pack price is fixed, so a keypad price typed by mistake has nowhere to
    // go: clear it rather than silently selling the menu at the catalog price
    // while the operator believes otherwise.
    setKeypadValue("");
    setKeypadMultiplierQty(null);
    setPackToAdd(pack);
  }, []);

  const handleConfirmPack = useCallback((selection: { quantity: number; choices: Record<string, number> }) => {
    if (!packToAdd) return;
    void register.addPack(packToAdd, selection);
    setPackToAdd(null);
  }, [packToAdd, register]);

  const handleKeypadMultiplier = useCallback((qty: number) => {
    setKeypadMultiplierQty(qty);
  }, []);

  const clearKeypadMultiplier = useCallback(() => {
    setKeypadMultiplierQty(null);
  }, []);

  const railAction = useCallback((key: RailFeatureKey) => {
    switch (key) {
      case "mesa": setShowTables(true); break;
      case "mi-pin": void register.loadPinStatus().then(() => setShowPinSetup(true)); break;
      case "total": if (register.ticket) { register.setError(""); setKeypadContext({ kind: "cash" }); setShowCheckout(true); } break;
      case "comanda": void printComanda(); break;
      case "cocina": void register.sendKitchen(); break;
      case "descuento": if (register.ticket) { register.setError(""); setKeypadContext({ kind: "discount" }); setDiscountOpen(true); } break;
      case "separar-comanda": if (register.visit) { register.setError(""); setGuestDialog("create"); } break;
      case "borrar-comanda": if (register.ticket) { register.setError(""); setVoidOrderOpen(true); } break;
      case "dividir-comanda": if (register.ticket) { register.setError(""); setDivideOpen(true); } break;
      case "salon": setAreaFilter(0); setShowTables(true); break;
      case "barra": void register.openBar(); break;
      case "llevar": void register.openTakeaway(); break;
      case "facturacion": if (date) setBillingOpen(true); break;
      case "cierre-x": runCierre("X"); break;
      case "cierre-y": runCierre("Y"); break;
      // Fiscal documents live on their own rail action: they are a document the
      // guest may ask for, not an edit of the comanda.
      case "factura": register.setError(""); setPrompt("factura"); break;
      case "cerrar-mesas": register.setError(""); setPrompt("cerrar-mesas"); break;
      case "cerrar-dia": if (onCloseDay && cashDay?.status === "OPEN") { register.setError(""); setCloseDayError(""); setPrompt("cerrar-dia"); } break;
      case "aparcar": case "recargo": case "invita": case "comentario": case "cajon":
      case "cliente": case "empleado": case "juntar-mesas": case "tags": case "propina":
        openPrompt(key); break;
      default: register.setMessage(`Función "${key}" disponible próximamente.`); break;
    }
  }, [cashDay?.status, date, onCloseDay, openPrompt, printComanda, register, runCierre]);

  const contextLabel = keypadContext.kind === "quantity" ? "Cantidad" : keypadContext.kind === "cash" ? "Efectivo" : keypadContext.kind === "discount" ? "Descuento €" : "Comensales";

  return (
    <div className="pos-sell" data-ui="pos-sell-screen" data-testid="pos-sell-screen" data-readonly={readOnly ? "true" : undefined}>
      <div className="pos-sell__top" data-testid="pos-sell-top">
        {readOnly ? <div className="pos-sell__alert" role="status" data-ui="pos-readonly-notice" data-testid="pos-readonly-notice">Día cerrado: solo consulta.</div> : null}
        <POSOfflineBar online={register.online} entries={register.offlineEntries} notice={register.offlineNotice} syncing={syncingOffline} onSync={() => { setSyncingOffline(true); void register.flushOffline().finally(() => setSyncingOffline(false)); }} />
        {/* Feedback now travels through the POS toast portal (see POSToastProvider);
            the inline banners used to sit here and pushed the order down. */}
        <span className="sr-only" role="status" aria-live="polite" data-ui="pos-message-sink" data-testid="pos-message">{register.message}</span>
        <span className="sr-only" role="alert" aria-live="assertive" data-ui="pos-error-sink" data-testid="pos-error">{register.error}</span>
        {register.lastPaidTicket ? (
          <div className="pos-sell__status" data-ui="pos-last-receipt" data-testid="pos-last-receipt">
            Recibo no fiscal · {register.lastPaidTicket.ticketNumber} · {money(register.lastPaidTicket.totalGrossCents)}
            <button className="pos-modal__secondary" type="button" onClick={() => {
              if (!register.lastPaidTicket) return;
              try {
                printTicketReceipt({
                  ticket: register.lastPaidTicket,
                  visit: register.visit,
                  restaurant: register.restaurant,
                  operatorName: register.operators.find((entry) => entry.id === register.lastPaidTicket?.operatorMemberId)?.displayName,
                  payments: register.lastPaidPayments,
                });
              } catch (reason) {
                register.setError(reason instanceof Error ? reason.message : "No se pudo imprimir el recibo.");
              }
            }} data-ui="pos-last-receipt-print" data-testid="pos-last-receipt-print" style={{ marginLeft: "0.5rem" }}>Imprimir</button>
          </div>
        ) : null}
      </div>
      <div className="pos-sell__body" data-testid="pos-sell-body">
        <div className="pos-sell__work" data-testid="pos-sell-work">
          <div className={ticketExpanded ? "pos-sell__row pos-sell__row--register is-expanded" : "pos-sell__row pos-sell__row--register"} data-testid="pos-sell-row-register">
            <POSTicketPanel courses={register.courses} activeCourse={register.activeCourse} onSelectCourse={register.setActiveCourse} onFireCourse={(course) => void register.fireCourse(course)} onRequestTable={() => setShowTables(true)} onRequestRecall={() => { void register.loadRecallCandidates(); setShowRecall(true); }}
              expanded={ticketExpanded}
              onToggleExpand={toggleTicketExpanded}
              ticket={register.ticket}
              visit={register.visit}
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
              onRenameTicket={(target) => {
                // Rename the check whose pencil was pressed, not whichever one
                // happens to be active: the panel shows every split tab at once.
                register.switchTicket(target);
                register.setError("");
                setGuestDialog("rename");
              }}
              busy={register.busy}
              readOnly={readOnly}
            />
            <POSKeypad value={keypadValue} onChange={setKeypadValue} contextLabel={contextLabel} onConfirm={confirmKeypad} confirmLabel="OK" onMultiplier={handleKeypadMultiplier} multiplierQty={keypadMultiplierQty} onClearMultiplier={clearKeypadMultiplier} readOnly={readOnly} resetKey={`${keypadContext.kind}:${selectedLineId}`} />
          </div>
          <div className="pos-sell__row pos-sell__row--catalog" data-testid="pos-sell-row-catalog" hidden={ticketExpanded}>
            <POSCategoryPanel categories={categories} active={category} onSelect={setCategory} />
            <div className="pos-catalog__main" data-testid="pos-catalog-main">
              <div className="pos-search" data-testid="pos-search">
                <input type="search" value={register.query} onChange={(event) => register.setQuery(event.target.value)} placeholder="Buscar producto…" aria-label="Buscar producto" data-pos-command="search-products" data-testid="pos-product-search" />
                {register.query ? <button className="pos-modal__secondary pos-search__clear" type="button" onClick={() => register.setQuery("")} aria-label="Limpiar búsqueda" data-testid="pos-product-search-clear">×</button> : null}
              </div>
              <POSProductGrid products={visibleProducts} packs={visiblePacks} disabled={!register.ticket || register.busy} readOnly={readOnly} pendingProductId={register.pendingProductId} onAdd={handleAddProduct} onAddPack={handleAddPack} stockStatus={register.settings.stockMode === "OFF" ? undefined : register.productStock} />
            </div>
          </div>
        </div>
        <POSControlRail onAction={railAction} disabledReasons={disabledReasons} readOnly={readOnly} />
      </div>

      {billingOpen && date ? <POSDayBillingDialog date={date} onClose={() => setBillingOpen(false)} /> : null}

      {prompt === "factura" ? <POSFiscalDialog ticket={register.ticket} visit={register.visit} online={register.online} onClose={closePrompt} /> : null}

      {guestDialog ? (
        <POSGuestDialog
          ticket={guestDialog === "rename" ? register.ticket : null}
          title={guestDialog === "rename" ? "Nombre del comensal" : "Separar comanda"}
          confirmText={guestDialog === "rename" ? "Guardar" : "Separar"}
          onClose={() => setGuestDialog(null)}
          onSave={async (label) => {
            if (guestDialog === "rename") return register.setTicketGuestLabel(label);
            await register.createSplitTicket(label);
            return true;
          }}
        />
      ) : null}

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
                <div className="pos-modal__covers" data-testid="pos-reservation-field">Reserva
                  <POSSelect value={register.bookingId} onChange={register.selectReservation} options={[{ value: 0, label: "Sin reserva" }, ...eligibleReservations.map((item) => ({ value: item.id, label: `${item.reservationTime} · ${item.customerName} · ${item.partySize}` }))]} ariaLabel="Reserva" testId="pos-reservation-select" />
                </div>
              ) : null}
              <label className="pos-modal__covers" data-testid="pos-covers-field">Comensales
                <input inputMode="numeric" value={register.covers} onChange={(event) => register.setCovers(event.target.value)} aria-label="Comensales" data-testid="pos-covers-input" />
              </label>
              <button className="pos-modal__primary" type="button" disabled={register.busy} onClick={() => { void register.openVisit().then((opened) => { if (opened) setShowTables(false); }); }} data-testid="pos-open-visit">
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
        <POSPromptModal testId="pos-note" title="Comentario" confirmLabel="Guardar comentario" busy={register.busy || register.commandBusy} error={register.error}
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
        <POSPromptModal testId="pos-customer" title="Cliente" confirmLabel="Guardar cliente" busy={register.busy || register.commandBusy} error={register.error}
          fields={[
            { name: "customerName", label: "Nombre", initialValue: register.visit?.customerName ?? "", required: true },
            { name: "customerTaxId", label: "NIF/CIF", initialValue: register.visit?.customerTaxId ?? "" },
          ]}
          onClose={closePrompt} onConfirm={(values, option) => void runPrompt("cliente", values, option)} />
      ) : null}

      {prompt === "empleado" ? (
        <POSPromptModal testId="pos-operator" title="Empleado" confirmLabel="Asignar empleado" busy={register.busy || register.commandBusy} error={register.error}
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

      {prompt === "tags" ? <POSMultiSelectDialog testId="pos-tags" title="Etiquetas" confirmLabel="Guardar etiquetas" allowEmptySelection busy={register.busy || register.commandBusy} error={register.error} emptyLabel="No hay etiquetas disponibles." selectedIds={multiSelectIds} onChange={setMultiSelectIds} onClose={closePrompt} onConfirm={() => void saveTags()} entries={register.tags.filter((tag) => tag.isActive !== false || selectedLine?.tagIds?.includes(tag.id)).map((tag) => ({ id: tag.id, label: tag.name }))} /> : null}

      {prompt === "cerrar-mesas" ? (
        <POSPromptModal testId="pos-bulk-close" title="Cerrar todas las mesas abiertas" confirmLabel="Cerrar mesas" busy={register.busy || comandaBusy} error={register.error}
          options={[{ value: "CASH", label: "Efectivo" }, { value: "CARD", label: "Tarjeta" }]} optionsLabel="Método de cobro" initialOption="CASH"
          validate={() => openVisitCount === 0 ? "No hay mesas abiertas para cerrar." : null}
          summary={() => openVisitCount > 0 ? (
            <span data-testid="pos-bulk-close-summary-detail">
              {openVisitCount} mesa(s) · {money(openVisitTotalCents)} · {openVisits.map((entry) => entry.tableName || entry.channel || `Visita ${entry.id}`).join(", ")}. Se cerrarán.
            </span>
          ) : "No hay mesas abiertas para cerrar."}
          onClose={closePrompt} onConfirm={(_values, option) => { void runBulkClose(option).then((ok) => { if (ok) closePrompt(); }); }} />
      ) : null}

      {prompt === "cerrar-dia" ? (
        <POSPromptModal testId="pos-close-day" title="Cerrar día de caja" confirmLabel="Cerrar día" busy={register.busy || closeDayBusy} error={closeDayError || register.error}
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
        <POSDialog testId="pos-discount" title="Descuento" busy={register.busy || register.commandBusy} error={register.error} onClose={closeDiscount}>
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
            <button className="pos-modal__primary" type="button" disabled={register.busy || register.commandBusy || discountCents <= 0 || !discountReason.trim()} onClick={() => void confirmDiscount()} data-pos-command="discount" data-testid="pos-discount-confirm">Aplicar descuento</button>
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

      {showPinSetup ? (

        <POSPinDialog

          title={register.hasPin ? "Cambiar mi PIN" : "Crear mi PIN"}

          description={register.hasPin ? "Necesitas el PIN actual para cambiarlo." : "Un PIN de 4 a 6 dígitos. Cada persona del sala firma con el suyo."}

          confirmLabel="Guardar PIN"

          busy={register.busy}

          error={register.error || undefined}

          requireExisting={register.hasPin}

          onClose={() => setShowPinSetup(false)}

          onSubmit={(value) => void register.setPin(value.pin, value.currentPin).then(() => setShowPinSetup(false))}

        />

      ) : null}

      {pinApproval && lineToVoid ? (

        <POSPinDialog

          title="Anular línea"

          description={`Pide el PIN de un jefe para anular "{lineToVoid.name}".`}

          confirmLabel="Anular con PIN"

          busy={register.busy}

          onClose={() => setPinApproval(false)}

          onSubmit={approveVoid}

        />

      ) : null}


      {showRecall ? (

        <POSRecallDialog

          tickets={register.recallTickets}

          busy={register.busy}

          error={register.error || undefined}

          onClose={() => setShowRecall(false)}

          onPick={(sourceTicketId) => { void register.recallTicket(sourceTicketId); setShowRecall(false); }}

        />

      ) : null}


      <POSPackPicker

        pack={packToAdd}

        busy={register.busy}

        error={register.error || undefined}

        onClose={() => setPackToAdd(null)}

        onConfirm={handleConfirmPack}

      />


      <POSModifierPicker
        product={productToModify}
        busy={register.busy}
        error={register.error}
        onClose={() => setProductToModify(null)}
        onConfirm={handleConfirmModifiers}
      />

      <POSMoveLineDialog
        line={lineToMove}
        targets={register.otherOpenSplitTickets}
        allTickets={register.openSplitTickets}
        tableName={register.visit?.tableName}
        busy={register.busy}
        error={register.error}
        onClose={() => setLineToMove(null)}
        onConfirm={confirmMoveLine}
      />

      {closureDialog && register.currentShift?.id ? (
        <POSClosureDialog closureType={closureDialog} shiftId={register.currentShift.id} onClose={() => setClosureDialog(null)} onGenerated={register.setMessage} />
      ) : null}

      {showCheckout && register.ticket ? (
        <POSDialog testId="pos-checkout" title={`Cobrar · ${money(tenders.amountDueCents)}`} ariaLabel="Cobro" busy={register.busy} error={register.error} onClose={closeCheckout}>
          <div className="pos-checkout" data-testid="pos-checkout-body">
            <section className="pos-checkout__summary" aria-label="Importes del cobro" data-testid="pos-checkout-summary">
              <div className="pos-checkout__amount">
                <span className="pos-checkout__amountLabel">Total a cobrar</span>
                <strong className="pos-checkout__amountValue" data-testid="pos-checkout-due">{money(tenders.amountDueCents)}</strong>
              </div>
              <dl className="pos-checkout__figures">
                <div className="pos-checkout__figure">
                  <dt>Venta</dt>
                  <dd data-testid="pos-checkout-sale">{money(register.ticketTotal)}</dd>
                </div>
                {register.tipCents > 0 ? (
                  <div className="pos-checkout__figure">
                    <dt>Propina</dt>
                    <dd data-testid="pos-checkout-tip">{money(register.tipCents)}</dd>
                  </div>
                ) : null}
                <div className="pos-checkout__figure">
                  <dt>Entregado</dt>
                  <dd data-testid="pos-checkout-paid">{money(tenders.paidCents)}</dd>
                </div>
                <div className="pos-checkout__figure pos-checkout__figure--pending" data-testid="pos-checkout-pending">
                  <dt>Pendiente</dt>
                  <dd>{money(tenders.remaining)}</dd>
                </div>
                <div className="pos-checkout__figure pos-checkout__figure--change" data-testid="pos-checkout-change">
                  <dt>Cambio</dt>
                  <dd>{money(tenders.changeCents)}</dd>
                </div>
              </dl>
              {tenders.overCents > 0 ? <p className="pos-checkout__note" data-testid="pos-checkout-over">Entregado de más {money(tenders.overCents)}</p> : null}
              <div className="pos-checkout__progress" role="progressbar" aria-valuemin={0} aria-valuemax={tenders.amountDueCents} aria-valuenow={Math.min(tenders.paidCents, tenders.amountDueCents)} aria-label="Importe entregado" data-testid="pos-checkout-progress">
                <span className="pos-checkout__progressFill" style={{ width: `${tenders.amountDueCents > 0 ? Math.min(100, Math.round((tenders.paidCents / tenders.amountDueCents) * 100)) : 0}%` }} />
              </div>
            </section>

            <section className="pos-checkout__splits" aria-label="Pagos por método" data-testid="pos-checkout-payments">
              <header className="pos-checkout__splitsHeader">
                <h3 className="pos-checkout__splitsTitle">Pagos</h3>
                <div className="pos-modal__modes" role="group" aria-label="Añadir método de pago" data-testid="pos-checkout-methods">
                  {POS_PAYMENT_METHODS.map((method) => (
                    <button className="pos-modal__secondary" type="button" key={method} disabled={readOnly} onClick={() => { setCheckoutMethod(method); tenders.addEntry(method); }} data-testid={`pos-checkout-method-${method}`}>
                      {POS_PAYMENT_METHOD_LABELS[method]}
                    </button>
                  ))}
                </div>
              </header>

              <ul className="pos-checkout__list">
                {tenders.entries.map((entry, index) => (
                  <li className="pos-checkout__row" key={entry.id} data-testid={`pos-checkout-split-${entry.id}`}>
                    <label className="pos-checkout__method" htmlFor={`pos-checkout-method-select-${entry.id}`}>
                      <span className="bo-srOnly">Método</span>
                      <select
                        id={`pos-checkout-method-select-${entry.id}`}
                        value={entry.method}
                        disabled={readOnly}
                        onChange={(event) => tenders.updateEntry(entry.id, { method: event.target.value as POSPaymentMethod })}
                        data-ui="pos-checkout-split-method"
                        data-testid={`pos-checkout-split-method-${entry.id}`}
                      >
                        {POS_PAYMENT_METHODS.map((method) => (
                          <option key={method} value={method}>{POS_PAYMENT_METHOD_LABELS[method]}</option>
                        ))}
                      </select>
                    </label>
                    <label className="pos-checkout__amountField" htmlFor={`pos-checkout-amount-${entry.id}`}>
                      <span className="bo-srOnly">Importe {POS_PAYMENT_METHOD_LABELS[entry.method]}</span>
                      <input
                        id={`pos-checkout-amount-${entry.id}`}
                        inputMode="decimal"
                        value={entry.amount}
                        placeholder="0,00"
                        disabled={readOnly}
                        onChange={(event) => tenders.updateEntry(entry.id, { amount: event.target.value })}
                        data-ui="pos-checkout-split-amount"
                        data-testid={legacyTenderId(entry, tenders.entries) ?? `pos-checkout-split-amount-${entry.id}`}
                      />
                    </label>
                    <button className="pos-checkout__fill" type="button" disabled={readOnly || tenders.fillTargetFor(entry.id) <= 0} onClick={() => tenders.fillRemaining(entry.id)} title={`Completar con ${POS_PAYMENT_METHOD_LABELS[entry.method]} hasta ${money(tenders.fillTargetFor(entry.id))}`} data-testid={`pos-checkout-fill-${entry.id}`}>
                      Completar {money(tenders.fillTargetFor(entry.id))}
                    </button>
                    <button className="pos-checkout__remove" type="button" disabled={readOnly || tenders.entries.length <= 1} onClick={() => tenders.removeEntry(entry.id)} aria-label={`Quitar pago ${index + 1} de ${POS_PAYMENT_METHOD_LABELS[entry.method]}`} data-testid={`pos-checkout-split-remove-${entry.id}`}>
                      ×
                    </button>
                  </li>
                ))}
              </ul>

              <div className="pos-checkout__actions">
                <button className="pos-modal__secondary" type="button" disabled={readOnly} onClick={() => tenders.addEntry(checkoutMethod)} data-testid="pos-checkout-add-split">
                  Añadir pago
                </button>
                <button className="pos-modal__secondary" type="button" aria-pressed={checkoutKeypad} onClick={() => setCheckoutKeypad((current) => !current)} data-testid="pos-checkout-keypad-toggle">
                  {checkoutKeypad ? "Ocultar teclado" : "Usar teclado"}
                </button>
              </div>

              {checkoutKeypad && cashKeypadEntry ? <POSKeypad value={cashKeypadEntry.amount} onChange={(next) => tenders.updateEntry(cashKeypadEntry.id, { amount: next.replace(",", ".") })} contextLabel="Efectivo" onConfirm={() => setCheckoutKeypad(false)} confirmLabel="Listo" readOnly={readOnly} testIdPrefix="pos-checkout-" /> : null}

              <div className="pos-modal__modes" role="group" aria-label="Efectivo rápido" data-testid="pos-quick-cash">
                {quickCashOptions.map((option) => (
                  <button className="pos-modal__secondary" type="button" key={option.key} onClick={() => (option.key === "exact" ? applyQuickCashExact() : applyQuickCash(option.value))} data-testid={`pos-quick-cash-${option.key}`}>{option.label}</button>
                ))}
              </div>

              {tenders.entries.some((entry) => entry.method === "CARD" && tenderedCentsOf(entry.amount) > 0) ? (
                <label className="pos-checkout__reference" htmlFor="pos-card-reference" data-testid="pos-card-reference-field">
                  Referencia terminal
                  <input id="pos-card-reference" value={register.cardReference} onChange={(event) => register.setCardReference(event.target.value)} data-ui="pos-card-reference" data-testid="pos-card-reference" />
                </label>
              ) : null}
            </section>
          </div>

          <footer className="pos-checkout__footer">
            <button className="pos-modal__primary" type="button" disabled={register.busy || !tenders.canConfirm || !tenders.changeResolved || register.ticketTotal < 0} onClick={confirmCheckout} data-pos-command="checkout" data-testid="pos-checkout-confirm">
              {tenders.remaining > 0 ? `Falta ${money(tenders.remaining)}` : "Cobrar y cerrar"}
            </button>
          </footer>
        </POSDialog>
      ) : null}
    </div>
  );
}
