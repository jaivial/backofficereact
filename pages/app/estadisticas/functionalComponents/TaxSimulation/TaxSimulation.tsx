import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Building2, Calculator, ChevronDown, ChevronUp, Landmark, Percent, ReceiptText, SlidersHorizontal, TrendingUp, UserRound, Wallet } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import { createClient } from "../../../../../api/client";
import { cn } from "../../../../../ui/shadcn/utils";
import { Tabs } from "../../../../../ui/nav/Tabs";
import {
  bandPositionPercent,
  computeSimulation,
  ENTITY_DESCRIPTIONS,
  findGrossBand,
  GROSS_BANDS,
  IVA_DEFAULT,
  type EntityType,
  type TaxAssumptions,
} from "./taxCalc";

const ENTITY_OPTIONS: Array<{ value: EntityType; label: string; icon: React.ReactNode }> = [
  { value: "autonomo", label: "Autónomo", icon: <UserRound className="h-4 w-4" aria-hidden="true" /> },
  { value: "sl", label: "SL", icon: <Building2 className="h-4 w-4" aria-hidden="true" /> },
  { value: "sl_new", label: "SL nueva", icon: <Building2 className="h-4 w-4" aria-hidden="true" /> },
  { value: "sl_micro", label: "SL micropyme", icon: <Building2 className="h-4 w-4" aria-hidden="true" /> },
  { value: "sa", label: "SA", icon: <Landmark className="h-4 w-4" aria-hidden="true" /> },
];

const FLOW_COLORS = {
  iva: "var(--bo-color-info)",
  income: "var(--bo-color-warning)",
  social: "var(--bo-color-danger)",
  net: "var(--bo-color-success)",
};

const EUR = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" });
const PCT = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 1 });

function fmt(value: number | null | undefined): string {
  return value === null || value === undefined || !Number.isFinite(value) ? "N/D" : EUR.format(value);
}

function fmtPct(value: number): string {
  return `${PCT.format(value)}%`;
}

interface TaxSimulationProps {
  grossRevenue: number;
  stockPurchases: number;
  className?: string;
  "data-ui"?: string;
}

export function TaxSimulation({ grossRevenue, stockPurchases, className, "data-ui": dataUi }: TaxSimulationProps) {
  const [entityType, setEntityType] = useState<EntityType>("sl");
  const userTouchedEntityRef = useRef(false);

  // Default the entity type to the one saved in Settings (per restaurant).
  // The user can still switch tabs here without persisting that change.
  useEffect(() => {
    let cancelled = false;
    const api = createClient({ baseUrl: "" });
    api.config
      .getRestaurantInfo()
      .then((response) => {
        if (cancelled || !response.success || userTouchedEntityRef.current) return;
        setEntityType(response.restaurantInfo.tipoEmpresa);
      })
      .catch(() => {
        // Keep the default when the settings endpoint is unavailable.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const [firstProfitYear, setFirstProfitYear] = useState(false);
  const [grossIncludesIva, setGrossIncludesIva] = useState(true);
  const [includeSocialSecurity, setIncludeSocialSecurity] = useState(true);
  const [otherExpenses, setOtherExpenses] = useState(0);
  const [foodRate, setFoodRate] = useState(IVA_DEFAULT.foodRate);
  const [drinkRate, setDrinkRate] = useState(IVA_DEFAULT.drinkRate);
  const [foodShare, setFoodShare] = useState(IVA_DEFAULT.foodShare);
  const [assumptionsOpen, setAssumptionsOpen] = useState(false);
  const reduceMotion = useReducedMotion();

  const assumptions: TaxAssumptions = useMemo(
    () => ({
      iva: { foodRate, drinkRate, foodShare },
      grossIncludesIva,
      includeSocialSecurity,
      otherDeductibleExpenses: otherExpenses,
      stockPurchases,
    }),
    [foodRate, drinkRate, foodShare, grossIncludesIva, includeSocialSecurity, otherExpenses, stockPurchases],
  );

  const simulation = useMemo(
    () => computeSimulation(grossRevenue, assumptions, entityType, firstProfitYear),
    [grossRevenue, assumptions, entityType, firstProfitYear],
  );

  const band = useMemo(() => findGrossBand(grossRevenue), [grossRevenue]);
  const bandPct = useMemo(() => bandPositionPercent(grossRevenue), [grossRevenue]);

  const assumptionsSummary = useMemo(() => {
    const parts: string[] = [];
    parts.push(grossIncludesIva ? "con IVA" : "sin IVA");
    parts.push(`${Math.round(foodShare * 100)}% comida (${fmtPct(foodRate * 100)})`);
    if (otherExpenses > 0) parts.push(fmt(otherExpenses) + " gastos");
    if (entityType === "autonomo" && includeSocialSecurity) parts.push("con SS");
    if (entityType === "sl_new" && firstProfitYear) parts.push("1er año");
    return parts.join(" · ");
  }, [grossIncludesIva, foodShare, foodRate, otherExpenses, entityType, includeSocialSecurity, firstProfitYear]);

  const ivaIsPositive = simulation.iva.ivaDue > 0;
  const ivaDue = ivaIsPositive ? simulation.iva.ivaDue : 0;

  const flowSegments = useMemo(() => {
    const segments = [
      { key: "iva", label: "IVA a liquidar", value: ivaDue, color: FLOW_COLORS.iva },
      { key: "income", label: entityType === "autonomo" ? "IRPF" : "Imp. Sociedades", value: simulation.incomeTax.taxDue, color: FLOW_COLORS.income },
      ...(simulation.socialSecurity > 0 ? [{ key: "social", label: "Cuota autónomos", value: simulation.socialSecurity, color: FLOW_COLORS.social }] : []),
      { key: "net", label: "Neto estimado", value: Math.max(0, simulation.net), color: FLOW_COLORS.net },
    ];
    return segments;
  }, [ivaDue, entityType, simulation.incomeTax.taxDue, simulation.socialSecurity, simulation.net]);

  const grossForFlow = Math.max(1, simulation.gross);

  const handleOtherExpensesChange = useCallback((value: string) => {
    const parsed = Number(value.replace(/[^\d.-]/g, ""));
    setOtherExpenses(Number.isFinite(parsed) && parsed >= 0 ? parsed : 0);
  }, []);

  const handleFoodShareChange = useCallback((value: string) => {
    const parsed = Number(value.replace(/[^\d.]/g, ""));
    setFoodShare(Number.isFinite(parsed) ? Math.min(100, Math.max(0, parsed)) / 100 : 0);
  }, []);

  const toggleAssumptions = useCallback(() => setAssumptionsOpen((prev) => !prev), []);

  // Hover popover state — one shared anchor rect, keyed by target
  const [popover, setPopover] = useState<{ target: "flow"; key: string } | { target: "band" } | null>(null);
  const [popoverRect, setPopoverRect] = useState<{ top: number; left: number; bottom: number } | null>(null);
  const flowBarRef = useRef<HTMLDivElement | null>(null);

  const handleFlowSegmentEnter = useCallback((key: string, event: React.MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setPopoverRect({ top: rect.top, left: rect.left, bottom: rect.bottom });
    setPopover({ target: "flow", key });
  }, []);

  const handleBandEnter = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setPopoverRect({ top: rect.top, left: rect.left, bottom: rect.bottom });
    setPopover({ target: "band" });
  }, []);

  const handlePopoverLeave = useCallback(() => {
    setPopover(null);
    setPopoverRect(null);
  }, []);

  const hoveredFlowSegment = useMemo(
    () => (popover && popover.target === "flow" ? flowSegments.find((segment) => segment.key === popover.key) ?? null : null),
    [popover, flowSegments],
  );

  const bandLabel = useMemo(() => band.to === null ? `${fmt(band.from)} €+` : `${fmt(band.from)} – ${fmt(band.to)}`, [band]);

  return (
    <section className={cn("rounded-2xl border border-[var(--bo-border)] bg-[var(--bo-surface)] p-4 shadow-[var(--bo-shadow-soft)] sm:p-6", className)} data-ui={dataUi ?? "tax-simulation"}>
      {/* Header */}
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <span className="rounded-lg bg-[var(--bo-bg-selected)] p-2 text-[var(--bo-accent)]" aria-hidden="true"><Calculator className="h-4 w-4" /></span>
            <h2 className="text-base font-semibold" style={{ margin: 0 }}>Simulación fiscal</h2>
          </div>
          <p className="mt-[0.4rem] max-w-2xl text-xs leading-5 text-[var(--bo-muted)]">
            Desglose de IVA, IRPF/IS y cuota de autónomos sobre los ingresos del periodo. Sin costes de negocio.
          </p>
        </div>

        {/* Entity tabs — same UI as reservas/POS */}
        <div className="w-full shrink-0 lg:w-auto" data-ui="tax-entity-selector">
          <Tabs
            mode="button"
            ariaLabel="Tipo de entidad"
            activeId={entityType}
            onNavigate={(_href, id) => {
              userTouchedEntityRef.current = true;
              setEntityType(id as EntityType);
            }}
            className="bo-tabs--reservas w-full flex-row rounded-xl lg:w-auto"
            tabs={ENTITY_OPTIONS.map((option) => ({ id: option.value, label: option.label, href: "#", icon: option.icon }))}
          />
        </div>
      </div>

      {/* Entity description */}
      <div className="rounded-xl border border-[var(--bo-border)] bg-[var(--bo-surface-3)] px-3 py-2.5 text-xs leading-5 text-[var(--bo-muted)]" data-ui="tax-entity-description">
        {ENTITY_DESCRIPTIONS[entityType]}
      </div>

      {/* Assumptions collapsible — glass style matching entity tabs */}
      <div className="bo-tabs bo-tabs--glass mt-4 flex w-full flex-col items-stretch gap-0 overflow-visible rounded-xl" style={{ padding: 0 }} data-ui="tax-assumptions">
        <button
          type="button"
          className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-3 text-sm font-medium text-[var(--bo-text)] transition-colors hover:bg-[color-mix(in_srgb,var(--bo-accent)_8%,transparent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--bo-accent)]"
          style={{ background: "none", border: "none" }}
          onClick={toggleAssumptions}
          aria-expanded={assumptionsOpen}
          aria-controls="tax-assumptions-body"
          aria-label={assumptionsOpen ? "Colapsar supuestos" : "Expandir supuestos"}
          data-ui="tax-assumptions-toggle"
        >
          <span className="flex min-w-0 items-center gap-2" data-ui="tax-assumptions-title">
            <SlidersHorizontal className={cn("h-4 w-4 shrink-0 transition-colors", assumptionsOpen ? "text-[var(--bo-accent)]" : "text-[var(--bo-muted)]")} aria-hidden="true" />
            <span className="truncate" data-ui="tax-assumptions-title-text">Supuestos del cálculo</span>
            <span className="hidden truncate rounded-full border border-[var(--bo-border-2)] bg-[var(--bo-surface-3)] px-2 py-0.5 text-xs font-normal text-[var(--bo-muted)] sm:inline" data-ui="tax-assumptions-summary">
              {assumptionsSummary}
            </span>
          </span>
          <span
            className={cn(
              "grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-[var(--bo-border-2)] bg-[var(--bo-surface-3)] transition-colors",
              assumptionsOpen && "border-[var(--bo-accent)] text-[var(--bo-accent)]",
            )}
            aria-hidden="true"
            data-ui="tax-assumptions-chevron"
          >
            {assumptionsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </span>
        </button>

        <AnimatePresence initial={false}>
          {assumptionsOpen ? (
            <motion.div
              key="assumptions-body"
              id="tax-assumptions-body"
              style={{ overflow: "hidden" }}
              initial={reduceMotion ? { opacity: 1, height: "auto" } : { opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={reduceMotion ? { opacity: 1, height: "auto" } : { opacity: 0, height: 0 }}
              transition={reduceMotion ? { duration: 0 } : { duration: 0.25, ease: "easeInOut" }}
              data-ui="tax-assumptions-body"
            >
              <div className="grid gap-3 border-t border-[var(--bo-border)] p-3 sm:grid-cols-2 lg:grid-cols-4" data-ui="tax-assumptions-grid">
                <label className="flex min-h-10 items-center gap-2 rounded-lg border border-[var(--bo-border-2)] bg-[var(--bo-surface-3)] px-3 text-sm text-[var(--bo-muted)]" data-ui="tax-assumption-iva-included">
                  <input type="checkbox" className="h-4 w-4 accent-[var(--bo-accent)]" checked={grossIncludesIva} onChange={(e) => setGrossIncludesIva(e.target.checked)} aria-label="Los ingresos incluyen IVA" data-ui="tax-assumption-iva-included-input" />
                  <span data-ui="tax-assumption-iva-included-label">Ingresos con IVA incluido</span>
                </label>

                {entityType === "autonomo" ? (
                  <label className="flex min-h-10 items-center gap-2 rounded-lg border border-[var(--bo-border-2)] bg-[var(--bo-surface-3)] px-3 text-sm text-[var(--bo-muted)]" data-ui="tax-assumption-ss">
                    <input type="checkbox" className="h-4 w-4 accent-[var(--bo-accent)]" checked={includeSocialSecurity} onChange={(e) => setIncludeSocialSecurity(e.target.checked)} aria-label="Incluir cuota de autónomos" data-ui="tax-assumption-ss-input" />
                    <span data-ui="tax-assumption-ss-label">Incluir cuota de autónomos</span>
                  </label>
                ) : (
                  <label className="flex min-h-10 items-center gap-2 rounded-lg border border-[var(--bo-border-2)] bg-[var(--bo-surface-3)] px-3 text-sm text-[var(--bo-muted)]" data-ui="tax-assumption-first-year">
                    <input type="checkbox" className="h-4 w-4 accent-[var(--bo-accent)]" checked={firstProfitYear} onChange={(e) => setFirstProfitYear(e.target.checked)} disabled={entityType !== "sl_new"} aria-label="Primer ejercicio con beneficios" data-ui="tax-assumption-first-year-input" />
                    <span data-ui="tax-assumption-first-year-label">Primer ejercicio con beneficios</span>
                  </label>
                )}

                <label className="flex min-w-0 flex-col gap-1.5" data-ui="tax-assumption-expenses">
                  <span className="text-xs font-medium text-[var(--bo-muted)]" data-ui="tax-assumption-expenses-label">Otros gastos deducibles (€)</span>
                  <input
                    type="number"
                    min={0}
                    className="h-9 rounded-lg border border-[var(--bo-border-2)] bg-[var(--bo-surface-3)] px-3 text-sm text-[var(--bo-text)] outline-none transition-[border-color,box-shadow] duration-[var(--bo-transition-base)] focus-visible:border-[var(--bo-accent)] focus-visible:ring-2 focus-visible:ring-[var(--bo-accent)]/30"
                    value={otherExpenses}
                    onChange={(e) => handleOtherExpensesChange(e.target.value)}
                    placeholder="0"
                    aria-label="Otros gastos deducibles"
                    data-ui="tax-assumption-expenses-input"
                  />
                </label>

                <label className="flex min-w-0 flex-col gap-1.5" data-ui="tax-assumption-food-share">
                  <span className="text-xs font-medium text-[var(--bo-muted)]" data-ui="tax-assumption-food-share-label">% comida (resto bebidas)</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    className="h-9 rounded-lg border border-[var(--bo-border-2)] bg-[var(--bo-surface-3)] px-3 text-sm text-[var(--bo-text)] outline-none transition-[border-color,box-shadow] duration-[var(--bo-transition-base)] focus-visible:border-[var(--bo-accent)] focus-visible:ring-2 focus-visible:ring-[var(--bo-accent)]/30"
                    value={Math.round(foodShare * 100)}
                    onChange={(e) => handleFoodShareChange(e.target.value)}
                    aria-label="Porcentaje de comida"
                    data-ui="tax-assumption-food-share-input"
                  />
                </label>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      {/* Money flow bar */}
      <div className="mt-5 rounded-xl border border-[var(--bo-border)] bg-[var(--bo-surface-3)] p-4" data-ui="tax-flow">
        <div className="flex flex-wrap items-center justify-between gap-2" data-ui="tax-flow-head">
          <span className="text-xs font-semibold uppercase tracking-wide text-[var(--bo-muted)]" data-ui="tax-flow-title">¿A dónde va cada euro?</span>
          <span className="text-xs text-[var(--bo-faint)]" data-ui="tax-flow-gross">{fmt(simulation.gross)} de ingresos brutos</span>
        </div>
        <div ref={flowBarRef} className="mt-3 flex h-8 w-full overflow-hidden rounded-lg" data-ui="tax-flow-bar">
          {flowSegments.map((segment) => (
            <div
              key={segment.key}
              className={cn("h-full min-w-[2px] transition-[filter] duration-[var(--bo-transition-base)] hover:brightness-110", segment.value === 0 && "min-w-0")}
              style={{ width: `${Math.max(segment.value, 0) / grossForFlow * 100}%`, backgroundColor: segment.color }}
              onMouseEnter={(event) => handleFlowSegmentEnter(segment.key, event)}
              onMouseLeave={handlePopoverLeave}
              data-ui={`tax-flow-segment-${segment.key}`}
            />
          ))}
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4" data-ui="tax-flow-legend">
          {flowSegments.map((segment) => (
            <div key={segment.key} className="flex items-center justify-between gap-2 rounded-lg border border-[var(--bo-border)] bg-[var(--bo-surface)] px-2.5 py-2" data-ui={`tax-flow-legend-${segment.key}`}>
              <div className="flex min-w-0 items-center gap-2" data-ui={`tax-flow-legend-name-${segment.key}`}>
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: segment.color }} aria-hidden="true" data-ui={`tax-flow-legend-dot-${segment.key}`} />
                <span className="truncate text-xs text-[var(--bo-muted)]" data-ui={`tax-flow-legend-label-${segment.key}`}>{segment.label}</span>
              </div>
              <span className="shrink-0 text-xs font-semibold" data-ui={`tax-flow-legend-value-${segment.key}`}>
                {segment.value > 0 ? fmt(segment.value) : "0,00 €"}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Stat cards */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" data-ui="tax-stats">
        <StatCard label="Ingresos brutos" value={fmt(simulation.gross)} detail={grossIncludesIva ? "IVA incluido" : "Base imponible"} icon={<ReceiptText className="h-4 w-4" aria-hidden="true" />} testId="tax-gross" data-ui="tax-gross-card" />
        <div className="cursor-help" onMouseEnter={handleBandEnter} onMouseLeave={handlePopoverLeave} data-ui="tax-band-card-wrap">
          <StatCard label="Tramo de facturación" value={band.label} detail={bandLabel} icon={<TrendingUp className="h-4 w-4" aria-hidden="true" />} testId="tax-band" data-ui="tax-band-card" />
        </div>
        <StatCard label="Total impuestos" value={fmt(simulation.totalTaxes)} detail={`IVA + ${entityType === "autonomo" ? "IRPF" : "IS"}${simulation.socialSecurity > 0 ? " + SS" : ""}`} icon={<Percent className="h-4 w-4" aria-hidden="true" />} testId="tax-total-taxes" tone="danger" data-ui="tax-total-taxes-card" />
        <StatCard label="Neto estimado" value={fmt(simulation.net)} detail={`${fmtPct(simulation.keptRate * 100)} de los ingresos`} icon={<Wallet className="h-4 w-4" aria-hidden="true" />} testId="tax-net" tone="success" data-ui="tax-net-card" />
      </div>

      {/* Detail sections */}
      <div className="mt-5 grid gap-5 lg:grid-cols-2" data-ui="tax-detail-grid">
        {/* IVA breakdown */}
        <div className="rounded-xl border border-[var(--bo-border)] p-4" data-ui="tax-iva-section">
          <h3 className="text-sm font-semibold" style={{ margin: 0 }} data-ui="tax-iva-title">Desglose del IVA</h3>
          <div className="mt-3 flex flex-col gap-2" data-ui="tax-iva-list">
            <DetailRow label="Base imponible" value={fmt(simulation.iva.base)} note="Importe sin IVA" data-ui="tax-iva-base" />
            <DetailRow label="IVA repercutido" value={fmt(simulation.iva.ivaCollected)} note={`${fmtPct(foodShare * 100)}% comida al ${fmtPct(foodRate * 100)} · ${fmtPct((1 - foodShare) * 100)}% bebidas al ${fmtPct(drinkRate * 100)}`} data-ui="tax-iva-collected" />
            <DetailRow label="IVA soportado" value={fmt(simulation.iva.ivaPurchases)} note="Deducible de compras de stock" data-ui="tax-iva-supported" />
          </div>
          <div className={cn("mt-3 flex items-center justify-between rounded-lg border px-3 py-2.5 text-sm", ivaIsPositive ? "border-[var(--bo-border-2)] bg-[var(--bo-surface-3)]" : "border-[var(--bo-color-success)]/40 bg-[var(--bo-color-success)]/10")} data-ui="tax-iva-due">
            <span className="text-xs text-[var(--bo-muted)]" data-ui="tax-iva-due-label">{ivaIsPositive ? "IVA a liquidar (modelo 303)" : "Crédito de IVA a compensar"}</span>
            <strong className={cn("font-semibold", ivaIsPositive ? "text-[var(--bo-text)]" : "text-[var(--bo-on-surface-success)]")} data-testid="tax-iva-due" data-ui="tax-iva-due-value">
              {fmt(Math.abs(simulation.iva.ivaDue))}
            </strong>
          </div>
        </div>

        {/* Taxes breakdown */}
        <div className="rounded-xl border border-[var(--bo-border)] p-4" data-ui="tax-taxes-section">
          <h3 className="text-sm font-semibold" style={{ margin: 0 }} data-ui="tax-taxes-title">Impuestos aplicados</h3>
          <div className="mt-3 flex flex-col gap-2" data-ui="tax-taxes-list">
            <DetailRow label="IVA a liquidar" value={fmt(ivaDue)} note={ivaIsPositive ? "Repercutido − soportado" : "Crédito a favor"} data-ui="tax-tax-iva" />
            <DetailRow label={entityType === "autonomo" ? "IRPF (progresivo)" : "Impuesto de Sociedades"} value={fmt(simulation.incomeTax.taxDue)} note={`${fmtPct(simulation.incomeTax.effectiveRate * 100)} tipo efectivo sobre beneficio`} data-ui="tax-tax-income" />
            {simulation.socialSecurity > 0 ? <DetailRow label="Cuota autónomos (SS)" value={fmt(simulation.socialSecurity)} note="12 mensualidades estimadas" data-ui="tax-tax-social" /> : null}
          </div>
          <div className="mt-3 flex items-center justify-between rounded-lg border border-[var(--bo-border-2)] bg-[var(--bo-surface-3)] px-3 py-2.5 text-sm" data-ui="tax-tax-total">
            <span className="text-xs text-[var(--bo-muted)]" data-ui="tax-tax-total-label">Total impuestos</span>
            <strong className="font-semibold text-[var(--bo-on-surface-danger)]" data-ui="tax-tax-total-value">{fmt(simulation.totalTaxes)}</strong>
          </div>
        </div>
      </div>

      {/* Net summary */}
      <div className="mt-5 rounded-2xl border border-[var(--bo-accent)]/40 bg-[var(--bo-bg-selected)]/40 p-4" data-ui="tax-net-summary">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between" data-ui="tax-net-summary-row">
          <div data-ui="tax-net-summary-copy">
            <div className="flex items-center gap-2 text-xs font-medium text-[var(--bo-muted)]" data-ui="tax-net-summary-label">
              <Wallet className="h-4 w-4 text-[var(--bo-accent)]" aria-hidden="true" />
              <span data-ui="tax-net-summary-label-text">Neto estimado tras impuestos (sin costes de negocio)</span>
            </div>
            <p className="mt-1 text-xs leading-5 text-[var(--bo-faint)]" data-ui="tax-net-summary-note">
              Pendiente de descontar stock, personal, alquiler, luz, gas y agua.
            </p>
          </div>
          <div className="flex items-baseline gap-2" data-ui="tax-net-summary-value-row">
            <span className="text-3xl font-bold tracking-tight" data-testid="tax-net-summary-value" data-ui="tax-net-summary-value">{fmt(simulation.net)}</span>
            <span className="text-sm font-medium text-[var(--bo-accent-2)]" data-ui="tax-net-summary-rate">{fmtPct(simulation.keptRate * 100)} retenido</span>
          </div>
        </div>
      </div>

      {/* Disclaimer */}
      <p className="mt-4 flex items-start gap-2 text-xs leading-5 text-[var(--bo-faint)]" data-ui="tax-disclaimer">
        <Percent className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>
          Estimación orientativa. Tipos de sociedades confirmados: IS 25% general, 15% nueva creación (Ley 27/2014, art. 29) y 19/21% micropyme (Ley 7/2024; 17/20% desde 2027). IRPF: escala conjunta estatal + autonómica media de la campaña 2025/2026 (19–47%); la parte autonómica real varía por CCAA. IVA 10% comida / 21% bebidas. Cuota autónomos RETA 200–590 €/mes sin MEI (BOE-A-2026-7296; el MEI al 0,9% añade ~6–46 €/mes). No incluye mínimo personal ni deducciones. No es asesoramiento fiscal.
        </span>
      </p>

      {/* Hover popovers */}
      {typeof document !== "undefined" && popover && popoverRect ? (
        createPortal(
          <div
            className="pointer-events-none fixed z-[10000] w-72"
            style={{ top: popoverRect.bottom + 8, left: Math.min(Math.max(8, popoverRect.left), typeof window !== "undefined" ? window.innerWidth - 296 : 8) }}
            role="tooltip"
            data-ui="tax-popover"
          >
            {popover.target === "flow" && hoveredFlowSegment ? (
              <FlowPopover segment={hoveredFlowSegment} gross={simulation.gross} data-ui="tax-popover-flow" />
            ) : null}
            {popover.target === "band" ? <BandPopover currentGross={grossRevenue} currentBand={band} data-ui="tax-popover-band" /> : null}
          </div>,
          document.body,
        )
      ) : null}
    </section>
  );
}

function FlowPopover({ segment, gross, "data-ui": dataUi }: { segment: { key: string; label: string; value: number; color: string }; gross: number; "data-ui"?: string }) {
  const pct = gross > 0 ? (segment.value / gross) * 100 : 0;
  return (
    <div className="rounded-xl border border-[var(--bo-border)] bg-[var(--bo-surface)] p-3 shadow-[var(--bo-shadow-soft)]" data-ui={dataUi}>
      <div className="flex items-center gap-2" data-ui={`${dataUi}-head`}>
        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: segment.color }} aria-hidden="true" data-ui={`${dataUi}-dot`} />
        <span className="text-xs font-semibold uppercase tracking-wide text-[var(--bo-muted)]" data-ui={`${dataUi}-label`}>{segment.label}</span>
      </div>
      <div className="mt-2 flex items-baseline justify-between gap-3" data-ui={`${dataUi}-values`}>
        <span className="text-lg font-semibold" data-ui={`${dataUi}-amount`}>{segment.value > 0 ? fmt(segment.value) : "0,00 €"}</span>
        <span className="text-sm font-medium text-[var(--bo-accent-2)]" data-ui={`${dataUi}-pct`}>{fmtPct(pct)}</span>
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[var(--bo-border)]" data-ui={`${dataUi}-track`}>
        <div className="h-full rounded-full" style={{ width: `${Math.min(100, pct)}%`, backgroundColor: segment.color }} data-ui={`${dataUi}-fill`} />
      </div>
      <p className="mt-2 text-xs leading-4 text-[var(--bo-faint)]" data-ui={`${dataUi}-hint`}>
        {pct.toFixed(1)}% de {fmt(gross)} de ingresos brutos.
      </p>
    </div>
  );
}

function BandPopover({ currentGross, currentBand, "data-ui": dataUi }: { currentGross: number; currentBand: { label: string; from: number; to: number | null }; "data-ui"?: string }) {
  return (
    <div className="rounded-xl border border-[var(--bo-border)] bg-[var(--bo-surface)] p-3 shadow-[var(--bo-shadow-soft)]" data-ui={dataUi}>
      <div className="flex items-center gap-2" data-ui={`${dataUi}-head`}>
        <TrendingUp className="h-4 w-4 text-[var(--bo-accent)]" aria-hidden="true" data-ui={`${dataUi}-icon`} />
        <span className="text-xs font-semibold uppercase tracking-wide text-[var(--bo-muted)]" data-ui={`${dataUi}-label`}>Tramos de facturación</span>
      </div>
      <div className="mt-2 flex flex-col gap-1" data-ui={`${dataUi}-list`}>
        {GROSS_BANDS.map((item) => {
          const active = item.label === currentBand.label;
          return (
            <div
              key={item.label}
              className={cn(
                "flex items-center justify-between gap-3 rounded-lg border px-2.5 py-1.5 text-sm",
                active ? "border-[var(--bo-accent)] bg-[var(--bo-bg-selected)] text-[var(--bo-text)]" : "border-transparent text-[var(--bo-muted)]",
              )}
              aria-current={active ? "true" : undefined}
              data-ui={`${dataUi}-band-${item.label.toLowerCase()}`}
            >
              <div className="flex min-w-0 items-center gap-2" data-ui={`${dataUi}-band-name-${item.label.toLowerCase()}`}>
                {active ? <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--bo-accent)]" aria-hidden="true" data-ui={`${dataUi}-band-active-dot`} /> : null}
                <span className="truncate font-medium" data-ui={`${dataUi}-band-label-${item.label.toLowerCase()}`}>{item.label}</span>
              </div>
              <span className="shrink-0 text-xs text-[var(--bo-faint)]" data-ui={`${dataUi}-band-range-${item.label.toLowerCase()}`}>
                {item.to === null ? `${fmt(item.from)} €+` : `${fmt(item.from)} – ${fmt(item.to)}`}
              </span>
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-xs leading-4 text-[var(--bo-faint)]" data-ui={`${dataUi}-hint`}>
        Estás en <strong className="font-semibold text-[var(--bo-accent)]" data-ui={`${dataUi}-current`}>{currentBand.label}</strong> con {fmt(currentGross)} brutos.
      </p>
    </div>
  );
}

function StatCard({ label, value, detail, icon, testId, tone, "data-ui": dataUi }: { label: string; value: string; detail: string; icon: React.ReactNode; testId: string; tone?: "success" | "danger"; "data-ui"?: string }) {
  const valueClass = tone === "success" ? "text-[var(--bo-on-surface-success)]" : tone === "danger" ? "text-[var(--bo-on-surface-danger)]" : "text-[var(--bo-text)]";
  return (
    <div className="rounded-xl border border-[var(--bo-border)] bg-[var(--bo-surface-3)] p-4" data-testid={testId} data-ui={dataUi}>
      <div className="flex items-center justify-between gap-2" data-ui={`${dataUi}-head`}>
        <span className="text-xs font-medium text-[var(--bo-muted)]" data-ui={`${dataUi}-label`}>{label}</span>
        <span className="rounded-lg bg-[var(--bo-bg-selected)] p-1.5 text-[var(--bo-accent)]" aria-hidden="true" data-ui={`${dataUi}-icon`}>{icon}</span>
      </div>
      <div className={cn("mt-2 text-2xl font-semibold tracking-tight", valueClass)} data-ui={`${dataUi}-value`}>{value}</div>
      <div className="mt-1 text-xs text-[var(--bo-faint)]" data-ui={`${dataUi}-detail`}>{detail}</div>
    </div>
  );
}

function DetailRow({ label, value, note, "data-ui": dataUi }: { label: string; value: string; note: string; "data-ui"?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-[var(--bo-border)] bg-[var(--bo-surface-3)] px-3 py-2.5 text-sm" data-ui={dataUi}>
      <div className="min-w-0" data-ui={`${dataUi}-copy`}>
        <div className="font-medium" data-ui={`${dataUi}-label`}>{label}</div>
        <div className="text-xs text-[var(--bo-faint)]" data-ui={`${dataUi}-note`}>{note}</div>
      </div>
      <strong className="shrink-0 font-semibold" data-ui={`${dataUi}-value`}>{value}</strong>
    </div>
  );
}
