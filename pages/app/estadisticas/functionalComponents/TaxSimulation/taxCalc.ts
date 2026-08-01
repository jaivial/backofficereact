export type EntityType = "autonomo" | "sl" | "sl_new" | "sl_micro" | "sa";

export const ENTITY_LABELS: Record<EntityType, string> = {
  autonomo: "Autónomo (IRPF)",
  sl: "SL · tipo general",
  sl_new: "SL · nueva creación",
  sl_micro: "SL · micropyme",
  sa: "SA · tipo general",
};

export const ENTITY_DESCRIPTIONS: Record<EntityType, string> = {
  autonomo: "IRPF progresivo por tramos + cuota de autónomos (Seguridad Social)",
  sl: "Impuesto de Sociedades al 25% sobre el beneficio",
  sl_new: "Impuesto de Sociedades al 15% sobre los primeros 300.000 € (2 primeros ejercicios con beneficios)",
  sl_micro: "Impuesto de Sociedades al 19% sobre los primeros 50.000 € y 21% sobre el resto (INCN < 1 M €, 2026)",
  sa: "Impuesto de Sociedades al 25% sobre el beneficio",
};

export interface IvaAssumption {
  foodRate: number;
  drinkRate: number;
  foodShare: number;
}

export interface TaxAssumptions {
  iva: IvaAssumption;
  grossIncludesIva: boolean;
  otherDeductibleExpenses: number;
  includeSocialSecurity: boolean;
  stockPurchases: number;
}

export interface IvaBreakdown {
  gross: number;
  base: number;
  ivaCollected: number;
  ivaPurchases: number;
  ivaDue: number;
}

export interface TaxBracketSlice {
  label: string;
  rate: number;
  taxable: number;
  tax: number;
}

export interface IncomeTaxResult {
  taxableBase: number;
  taxDue: number;
  effectiveRate: number;
  slices: TaxBracketSlice[];
  entityType: EntityType;
}

export interface TaxSimulation {
  gross: number;
  iva: IvaBreakdown;
  incomeTax: IncomeTaxResult;
  socialSecurity: number;
  totalTaxes: number;
  net: number;
  keptRate: number;
}

export const IVA_DEFAULT: IvaAssumption = {
  foodRate: 0.1,
  drinkRate: 0.21,
  foodShare: 0.78,
};

export const GROSS_BANDS = [
  { label: "Micro", from: 0, to: 100_000 },
  { label: "Pequeña", from: 100_000, to: 250_000 },
  { label: "Media", from: 250_000, to: 500_000 },
  { label: "Grande", from: 500_000, to: null },
] as const;

// Escala IRPF 2026 = estatal (9,5–24,5 %) + media autonómica (~9,5 %). Aproximación:
// la parte autonómica real varía por CCAA (tope 45 % Madrid – 54 % Valencia).
const IRPF_BRACKETS_COMBINED_2026: Array<{ from: number; to: number | null; rate: number }> = [
  { from: 0, to: 12_450, rate: 0.19 },
  { from: 12_450, to: 20_200, rate: 0.24 },
  { from: 20_200, to: 35_200, rate: 0.3 },
  { from: 35_200, to: 60_000, rate: 0.37 },
  { from: 60_000, to: 300_000, rate: 0.45 },
  { from: 300_000, to: null, rate: 0.47 },
];

export const TAX_YEAR = 2026;

// Cuota RETA por rendimiento neto mensual — 2026 (congelada a 2025, RDL 16/2025). 15 tramos.
export const RETA_2026: Array<{ from: number; to: number | null; quota: number }> = [
  { from: 0, to: 670, quota: 200 },
  { from: 670, to: 900, quota: 220 },
  { from: 900, to: 1_166.7, quota: 260 },
  { from: 1_166.7, to: 1_300, quota: 291 },
  { from: 1_300, to: 1_500, quota: 294 },
  { from: 1_500, to: 1_700, quota: 294 },
  { from: 1_700, to: 1_850, quota: 350 },
  { from: 1_850, to: 2_030, quota: 370 },
  { from: 2_030, to: 2_330, quota: 390 },
  { from: 2_330, to: 2_760, quota: 415 },
  { from: 2_760, to: 3_190, quota: 440 },
  { from: 3_190, to: 3_620, quota: 465 },
  { from: 3_620, to: 4_050, quota: 490 },
  { from: 4_050, to: 6_000, quota: 530 },
  { from: 6_000, to: null, quota: 590 },
];

export function autonomoQuota(netMonthly: number): number {
  return RETA_2026.find((tier) => tier.to === null || netMonthly < tier.to)?.quota ?? RETA_2026[RETA_2026.length - 1].quota;
}

export function findGrossBand(gross: number): { label: string; from: number; to: number | null } {
  return GROSS_BANDS.find((band) => band.to === null || gross < band.to) ?? GROSS_BANDS[GROSS_BANDS.length - 1];
}

export function bandPositionPercent(gross: number): number {
  const max = 500_000;
  return Math.min(100, (gross / max) * 100);
}

export function computeIva(gross: number, iva: IvaAssumption): IvaBreakdown {
  const foodBase = (gross * iva.foodShare) / (1 + iva.foodRate);
  const drinkBase = (gross * (1 - iva.foodShare)) / (1 + iva.drinkRate);
  const base = foodBase + drinkBase;
  const ivaCollected = gross - base;
  return {
    gross,
    base,
    ivaCollected,
    ivaPurchases: 0,
    ivaDue: 0,
  };
}

export function computeIvaWithPurchases(gross: number, stockPurchases: number, iva: IvaAssumption): IvaBreakdown {
  const baseBreakdown = computeIva(gross, iva);
  const purchasesFood = (stockPurchases * iva.foodShare) / (1 + iva.foodRate);
  const purchasesDrink = (stockPurchases * (1 - iva.foodShare)) / (1 + iva.drinkRate);
  const ivaPurchases = stockPurchases - (purchasesFood + purchasesDrink);
  return {
    ...baseBreakdown,
    ivaPurchases,
    ivaDue: baseBreakdown.ivaCollected - ivaPurchases,
  };
}

export function computeIvaFromBase(base: number, iva: IvaAssumption): IvaBreakdown {
  const foodBase = base * iva.foodShare;
  const drinkBase = base * (1 - iva.foodShare);
  const ivaCollected = foodBase * iva.foodRate + drinkBase * iva.drinkRate;
  return {
    gross: base + ivaCollected,
    base,
    ivaCollected,
    ivaPurchases: 0,
    ivaDue: 0,
  };
}

function progressiveIrfp(taxableBase: number): { tax: number; slices: TaxBracketSlice[] } {
  let tax = 0;
  const slices: TaxBracketSlice[] = [];
  for (const bracket of IRPF_BRACKETS_COMBINED_2026) {
    if (taxableBase <= bracket.from) break;
    const taxable = Math.min(taxableBase, bracket.to ?? Number.POSITIVE_INFINITY) - bracket.from;
    const sliceTax = taxable * bracket.rate;
    tax += sliceTax;
    slices.push({ label: `${bracket.from.toLocaleString("es-ES")} €${bracket.to ? ` – ${bracket.to.toLocaleString("es-ES")} €` : " €+"}`, rate: bracket.rate, taxable, tax: sliceTax });
  }
  return { tax, slices };
}

export function computeIncomeTax(taxableBase: number, entityType: EntityType, firstProfitYear = false): IncomeTaxResult {
  if (entityType === "autonomo") {
    const { tax, slices } = progressiveIrfp(Math.max(0, taxableBase));
    return {
      taxableBase: Math.max(0, taxableBase),
      taxDue: tax,
      effectiveRate: taxableBase > 0 ? tax / taxableBase : 0,
      slices,
      entityType,
    };
  }

  if (entityType === "sl_micro") {
    // Micropyme 2026 (INCN < 1 M €): 19 % primeros 50.000 € de base, 21 % resto.
    const slices: TaxBracketSlice[] = [];
    const first = Math.min(Math.max(0, taxableBase), 50_000);
    const rest = Math.max(0, taxableBase - 50_000);
    if (first > 0) slices.push({ label: "Primeros 50.000 € · 19%", rate: 0.19, taxable: first, tax: first * 0.19 });
    if (rest > 0) slices.push({ label: "Exceso · 21%", rate: 0.21, taxable: rest, tax: rest * 0.21 });
    const taxDue = slices.reduce((acc, slice) => acc + slice.tax, 0);
    return {
      taxableBase,
      taxDue,
      effectiveRate: taxableBase > 0 ? taxDue / taxableBase : 0,
      slices,
      entityType,
    };
  }

  const rate = entityType === "sl_new" && firstProfitYear ? 0.15 : 0.25;
  const isNewCompany = entityType === "sl_new" && firstProfitYear;
  const slices: TaxBracketSlice[] = [];
  if (isNewCompany && taxableBase > 300_000) {
    slices.push({ label: "Primeros 300.000 € · 15%", rate: 0.15, taxable: 300_000, tax: 300_000 * 0.15 });
    slices.push({ label: "Exceso · 25%", rate: 0.25, taxable: taxableBase - 300_000, tax: (taxableBase - 300_000) * 0.25 });
  } else {
    slices.push({ label: `${Math.round(rate * 100)}% sobre beneficio`, rate, taxable: taxableBase, tax: taxableBase * rate });
  }
  const taxDue = slices.reduce((acc, slice) => acc + slice.tax, 0);
  return {
    taxableBase,
    taxDue,
    effectiveRate: taxableBase > 0 ? taxDue / taxableBase : 0,
    slices,
    entityType,
  };
}

export function computeSimulation(gross: number, assumptions: TaxAssumptions, entityType: EntityType, firstProfitYear = false): TaxSimulation {
  const iva = assumptions.grossIncludesIva
    ? computeIvaWithPurchases(gross, assumptions.stockPurchases, assumptions.iva)
    : (() => {
        const baseBreakdown = computeIvaFromBase(gross, assumptions.iva);
        const purchasesFood = (assumptions.stockPurchases * assumptions.iva.foodShare) / (1 + assumptions.iva.foodRate);
        const purchasesDrink = (assumptions.stockPurchases * (1 - assumptions.iva.foodShare)) / (1 + assumptions.iva.drinkRate);
        const ivaPurchases = assumptions.stockPurchases - (purchasesFood + purchasesDrink);
        return { ...baseBreakdown, ivaPurchases, ivaDue: baseBreakdown.ivaCollected - ivaPurchases };
      })();

  const incomeBase = assumptions.grossIncludesIva ? iva.base : gross;
  const taxableBase = incomeBase - assumptions.stockPurchases - assumptions.otherDeductibleExpenses;
  const incomeTax = computeIncomeTax(taxableBase, entityType, firstProfitYear);

  const socialSecurity =
    entityType === "autonomo" && assumptions.includeSocialSecurity ? autonomoQuota(taxableBase / 12) * 12 : 0;

  const ivaDueEffective = Math.max(0, iva.ivaDue);
  const totalTaxes = incomeTax.taxDue + socialSecurity + ivaDueEffective;
  const net = gross - totalTaxes;

  return {
    gross,
    iva,
    incomeTax,
    socialSecurity,
    totalTaxes,
    net,
    keptRate: gross > 0 ? net / gross : 0,
  };
}
