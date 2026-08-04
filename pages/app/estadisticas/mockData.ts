import type { AnalyticsOverview, AnalyticsSummary, AnalyticsSeriesPoint, AnalyticsWasteBreakdownEntry, AnalyticsDataQuality, AnalyticsComparison } from "../../../api/types";

// Helper to generate series data for the last N periods
function generateSeries(granularity: "day" | "week" | "month", count: number): AnalyticsSeriesPoint[] {
  const baseDate = new Date("2026-07-01");
  const series: AnalyticsSeriesPoint[] = [];

  for (let i = 0; i < count; i++) {
    const from = new Date(baseDate);
    const to = new Date(baseDate);

    if (granularity === "day") {
      from.setDate(from.getDate() + i);
      to.setDate(to.getDate() + i);
    } else if (granularity === "week") {
      from.setDate(from.getDate() + i * 7);
      to.setDate(to.getDate() + i * 7 + 6);
    } else {
      from.setMonth(from.getMonth() + i);
      to.setMonth(to.getMonth() + i + 1);
      to.setDate(to.getDate() - 1);
    }

    // Generate realistic restaurant data with some variation
    const dayOfWeek = from.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const baseRevenue = isWeekend ? 4500 : 2800;
    const variance = 0.7 + Math.random() * 0.6;

    const invoicedRevenueEUR = Math.round(baseRevenue * variance * 0.65);
    const posRevenueEUR = Math.round(baseRevenue * variance * 0.35);
    const posRefundsEUR = Math.round(posRevenueEUR * 0.02);
    const totalRevenueEUR = invoicedRevenueEUR + posRevenueEUR - posRefundsEUR;
    const identifiedPeople = Math.round((invoicedRevenueEUR + posRevenueEUR) / 45);
    const costOfGoodsEUR = Math.round(totalRevenueEUR * 0.32);
    const stockPurchasesEUR = Math.round(totalRevenueEUR * 0.28);
    const wasteCostEUR = Math.round(totalRevenueEUR * 0.04);
    const wasteQuantity = Math.round(wasteCostEUR / 8);

    series.push({
      from: from.toISOString().split("T")[0],
      to: to.toISOString().split("T")[0],
      summary: {
        invoicedRevenueEUR,
        posRevenueEUR,
        posRefundsEUR,
        totalRevenueEUR,
        costOfGoodsEUR,
        costOfGoodsLabel: "conocido",
        stockPurchasesEUR,
        stockPurchasesLabel: "conocido",
        wasteCostEUR,
        wasteCostLabel: "conocido",
        identifiedPeople,
        wasteQuantity,
        costCoverage: { knownQuantity: 92, totalQuantity: 100, percent: 92 },
        stockPurchaseCoverage: { knownQuantity: 88, totalQuantity: 100, percent: 88 },
      },
    });
  }

  return series;
}

// Generate waste breakdown by reason
function generateWasteBreakdown(): AnalyticsWasteBreakdownEntry[] {
  return [
    { reason: "Caducidad", quantity: 45, knownCostEUR: 234.50, unknownQuantity: 3, costLabel: "conocido" },
    { reason: "Deterioro", quantity: 28, knownCostEUR: 156.20, unknownQuantity: 2, costLabel: "conocido" },
    { reason: "Error de producción", quantity: 18, knownCostEUR: 98.40, unknownQuantity: 0, costLabel: "conocido" },
    { reason: "Rotura", quantity: 12, knownCostEUR: 67.80, unknownQuantity: 1, costLabel: "conocido" },
    { reason: "Devolución cliente", quantity: 8, knownCostEUR: 45.20, unknownQuantity: 0, costLabel: "conocido" },
    { reason: "Otros", quantity: 5, knownCostEUR: 24.90, unknownQuantity: 2, costLabel: "parcial" },
  ];
}

// Generate data quality metrics
function generateDataQuality(): AnalyticsDataQuality {
  return {
    currency: "EUR",
    nonEurDocuments: 2,
    unidentifiedDocuments: 14,
    costCoverage: { knownQuantity: 1847, totalQuantity: 2000, percent: 92.35 },
    unknownCostQuantity: 153,
    stockPurchaseCoverage: { knownQuantity: 1620, totalQuantity: 1850, percent: 87.57 },
    unknownPurchaseQuantity: 230,
    wasteCostCoverage: { knownQuantity: 108, totalQuantity: 116, percent: 93.10 },
    unknownWasteQuantity: 8,
    refreshRequired: false,
  };
}

// Generate comparison data
function generateComparison(currentSummary: AnalyticsSummary): AnalyticsComparison {
  // Previous period had slightly lower numbers
  const factor = 0.85 + Math.random() * 0.1;
  return {
    from: "2026-06-01",
    to: "2026-06-30",
    summary: {
      invoicedRevenueEUR: Math.round(currentSummary.invoicedRevenueEUR * factor),
      posRevenueEUR: Math.round(currentSummary.posRevenueEUR * factor),
      posRefundsEUR: Math.round(currentSummary.posRefundsEUR * factor),
      totalRevenueEUR: Math.round(currentSummary.totalRevenueEUR * factor),
      costOfGoodsEUR: Math.round((currentSummary.costOfGoodsEUR ?? 0) * factor),
      costOfGoodsLabel: "conocido",
      stockPurchasesEUR: Math.round((currentSummary.stockPurchasesEUR ?? 0) * factor),
      stockPurchasesLabel: "conocido",
      wasteCostEUR: Math.round((currentSummary.wasteCostEUR ?? 0) * factor),
      wasteCostLabel: "conocido",
      identifiedPeople: Math.round(currentSummary.identifiedPeople * factor),
      wasteQuantity: Math.round(currentSummary.wasteQuantity * factor),
      costCoverage: { knownQuantity: 89, totalQuantity: 100, percent: 89 },
      stockPurchaseCoverage: { knownQuantity: 85, totalQuantity: 100, percent: 85 },
    },
    deltaPercent: {
      invoicedRevenueEUR: Math.round((1 / factor - 1) * 100 * 10) / 10,
      posRevenueEUR: Math.round((1 / factor - 1) * 100 * 10) / 10,
      totalRevenueEUR: Math.round((1 / factor - 1) * 100 * 10) / 10,
      identifiedPeople: Math.round((1 / factor - 1) * 100 * 10) / 10,
      stockPurchasesEUR: Math.round((1 / factor - 1) * 100 * 10) / 10,
      costOfGoodsEUR: Math.round((1 / factor - 1) * 100 * 10) / 10,
      wasteCostEUR: Math.round((1 / factor - 1) * 100 * 10) / 10,
    },
  };
}

// Aggregate series into summary
function aggregateSeries(series: AnalyticsSeriesPoint[]): AnalyticsSummary {
  const totals = series.reduce(
    (acc, point) => ({
      invoicedRevenueEUR: acc.invoicedRevenueEUR + point.summary.invoicedRevenueEUR,
      posRevenueEUR: acc.posRevenueEUR + point.summary.posRevenueEUR,
      posRefundsEUR: acc.posRefundsEUR + point.summary.posRefundsEUR,
      totalRevenueEUR: acc.totalRevenueEUR + point.summary.totalRevenueEUR,
      costOfGoodsEUR: acc.costOfGoodsEUR + (point.summary.costOfGoodsEUR ?? 0),
      stockPurchasesEUR: acc.stockPurchasesEUR + (point.summary.stockPurchasesEUR ?? 0),
      wasteCostEUR: acc.wasteCostEUR + (point.summary.wasteCostEUR ?? 0),
      identifiedPeople: acc.identifiedPeople + point.summary.identifiedPeople,
      wasteQuantity: acc.wasteQuantity + point.summary.wasteQuantity,
    }),
    {
      invoicedRevenueEUR: 0,
      posRevenueEUR: 0,
      posRefundsEUR: 0,
      totalRevenueEUR: 0,
      costOfGoodsEUR: 0,
      stockPurchasesEUR: 0,
      wasteCostEUR: 0,
      identifiedPeople: 0,
      wasteQuantity: 0,
    },
  );

  return {
    ...totals,
    costOfGoodsLabel: "conocido",
    stockPurchasesLabel: "conocido",
    wasteCostLabel: "conocido",
    costCoverage: { knownQuantity: 1847, totalQuantity: 2000, percent: 92.35 },
    stockPurchaseCoverage: { knownQuantity: 1620, totalQuantity: 1850, percent: 87.57 },
  };
}

// Main mock data generator
export function generateMockOverview(options?: {
  granularity?: "day" | "week" | "month" | "quarter" | "year";
  periodCount?: number;
  includeComparison?: boolean;
}): AnalyticsOverview {
  // Map quarter/year to month for series generation (mock simplification)
  const inputGranularity = options?.granularity ?? "day";
  const granularity: "day" | "week" | "month" = inputGranularity === "quarter" || inputGranularity === "year" ? "month" : inputGranularity;
  const periodCount = options?.periodCount ?? (granularity === "day" ? 30 : granularity === "week" ? 12 : 6);
  const includeComparison = options?.includeComparison ?? true;

  const series = generateSeries(granularity, periodCount);
  const summary = aggregateSeries(series);
  const wasteBreakdown = generateWasteBreakdown();
  const dataQuality = generateDataQuality();
  const comparison = includeComparison ? generateComparison(summary) : null;

  return {
    success: true,
    currency: "EUR",
    from: series[0]?.from ?? "2026-07-01",
    to: series[series.length - 1]?.to ?? "2026-07-31",
    granularity: inputGranularity,
    summary,
    comparison,
    series,
    wasteBreakdown,
    dataQuality,
    topItems: MOCK_TOP_ITEMS.map((item) => ({ name: item.name, quantity: item.quantity, revenueEUR: item.revenue })),
    paymentMethods: MOCK_PAYMENT_METHODS.map((entry) => ({ method: entry.method, amountEUR: entry.amount, count: entry.count })),
    dayOfWeek: MOCK_DAY_OF_WEEK.map((entry) => ({ day: entry.day, revenueEUR: entry.revenue, covers: entry.covers })),
    hourlyDistribution: MOCK_HOURLY_DISTRIBUTION.map((entry) => ({ hour: entry.hour, covers: entry.covers, revenueEUR: entry.revenue })),
    revenueByCategory: MOCK_REVENUE_BY_CATEGORY.map((entry) => ({ category: entry.category, amountEUR: entry.amount, percentage: entry.percentage })),
  };
}

// Additional mock data for extra charts
export type RevenueByCategory = { category: string; amount: number; percentage: number };
export type PaymentMethodBreakdown = { method: string; amount: number; count: number };
export type TopSellingItem = { name: string; quantity: number; revenue: number };
export type HourlyDistribution = { hour: string; covers: number; revenue: number };

export const MOCK_REVENUE_BY_CATEGORY: RevenueByCategory[] = [
  { category: "Arroces", amount: 28450, percentage: 32 },
  { category: "Pescados", amount: 18920, percentage: 21 },
  { category: "Carnes", amount: 15680, percentage: 18 },
  { category: "Entrantes", amount: 12340, percentage: 14 },
  { category: "Postres", amount: 8560, percentage: 10 },
  { category: "Bebidas", amount: 4520, percentage: 5 },
];

export const MOCK_PAYMENT_METHODS: PaymentMethodBreakdown[] = [
  { method: "Tarjeta", amount: 52340, count: 342 },
  { method: "Efectivo", amount: 18920, count: 156 },
  { method: "Transferencia", amount: 12450, count: 28 },
  { method: "Bizum", amount: 4760, count: 67 },
];

export const MOCK_TOP_ITEMS: TopSellingItem[] = [
  { name: "Arroz a banda", quantity: 234, revenue: 8190 },
  { name: "Paella mixta", quantity: 198, revenue: 7920 },
  { name: "Lubina a la sal", quantity: 156, revenue: 6240 },
  { name: "Arroz negro", quantity: 145, revenue: 5075 },
  { name: "Fideuà", quantity: 132, revenue: 4620 },
  { name: "Chuletón", quantity: 98, revenue: 4900 },
  { name: "Gambas al ajillo", quantity: 187, revenue: 2805 },
  { name: "Tarta de queso", quantity: 245, revenue: 1960 },
];

export const MOCK_HOURLY_DISTRIBUTION: HourlyDistribution[] = [
  { hour: "12:00", covers: 12, revenue: 540 },
  { hour: "13:00", covers: 45, revenue: 2025 },
  { hour: "14:00", covers: 78, revenue: 3510 },
  { hour: "15:00", covers: 56, revenue: 2520 },
  { hour: "16:00", covers: 23, revenue: 1035 },
  { hour: "20:00", covers: 18, revenue: 810 },
  { hour: "21:00", covers: 67, revenue: 3015 },
  { hour: "22:00", covers: 89, revenue: 4005 },
  { hour: "23:00", covers: 34, revenue: 1530 },
];

// Day of week performance
export type DayOfWeekPerformance = { day: string; revenue: number; covers: number; avgTicket: number };

export const MOCK_DAY_OF_WEEK: DayOfWeekPerformance[] = [
  { day: "Lun", revenue: 3240, covers: 72, avgTicket: 45 },
  { day: "Mar", revenue: 2890, covers: 64, avgTicket: 45.2 },
  { day: "Mié", revenue: 3120, covers: 69, avgTicket: 45.2 },
  { day: "Jue", revenue: 3560, covers: 79, avgTicket: 45.1 },
  { day: "Vie", revenue: 5890, covers: 118, avgTicket: 49.9 },
  { day: "Sáb", revenue: 7230, covers: 145, avgTicket: 49.9 },
  { day: "Dom", revenue: 6450, covers: 129, avgTicket: 50 },
];

// Margin analysis
export type MarginCategory = { category: string; revenue: number; cost: number; margin: number; marginPct: number };

export const MOCK_MARGINS: MarginCategory[] = [
  { category: "Arroces", revenue: 28450, cost: 8535, margin: 19915, marginPct: 70 },
  { category: "Pescados", revenue: 18920, cost: 7568, margin: 11352, marginPct: 60 },
  { category: "Carnes", revenue: 15680, cost: 5488, margin: 10192, marginPct: 65 },
  { category: "Entrantes", revenue: 12340, cost: 3702, margin: 8638, marginPct: 70 },
  { category: "Postres", revenue: 8560, cost: 1712, margin: 6848, marginPct: 80 },
  { category: "Bebidas", revenue: 4520, cost: 1356, margin: 3164, marginPct: 70 },
];

// Pre-generated mock for immediate use (declared after the arrays it references)
export const MOCK_OVERVIEW = generateMockOverview({ granularity: "day", periodCount: 30, includeComparison: true });
