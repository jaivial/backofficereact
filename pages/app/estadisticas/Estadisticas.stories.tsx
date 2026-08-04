import type { Meta, StoryObj } from "@storybook/react";

import type { AnalyticsOverview } from "../../../api/types";
import Page from "./+Page";

const overview: AnalyticsOverview = {
  success: true,
  currency: "EUR",
  from: "2026-07-01",
  to: "2026-07-31",
  granularity: "day",
  summary: {
    invoicedRevenueEUR: 28450,
    posRevenueEUR: 12680,
    posRefundsEUR: 420,
    totalRevenueEUR: 41130,
    costOfGoodsEUR: 9850,
    costOfGoodsLabel: "N/D",
    stockPurchasesEUR: 14800,
    stockPurchasesLabel: "",
    wasteCostEUR: 390,
    wasteCostLabel: "N/D",
    identifiedPeople: 612,
    wasteQuantity: 84,
    costCoverage: { knownQuantity: 780, totalQuantity: 910, percent: 85.71 },
    stockPurchaseCoverage: { knownQuantity: 1120, totalQuantity: 1180, percent: 94.92 },
  },
  comparison: {
    from: "2026-06-01",
    to: "2026-06-30",
    summary: {
      invoicedRevenueEUR: 25100,
      posRevenueEUR: 11300,
      posRefundsEUR: 210,
      totalRevenueEUR: 36400,
      costOfGoodsEUR: 9100,
      costOfGoodsLabel: "N/D",
      stockPurchasesEUR: 13700,
      stockPurchasesLabel: "",
      wasteCostEUR: 420,
      wasteCostLabel: "N/D",
      identifiedPeople: 574,
      wasteQuantity: 92,
      costCoverage: { knownQuantity: 700, totalQuantity: 860, percent: 81.39 },
      stockPurchaseCoverage: { knownQuantity: 1020, totalQuantity: 1100, percent: 92.73 },
    },
    deltaPercent: { invoicedRevenueEUR: 13.35, posRevenueEUR: 12.21, totalRevenueEUR: 13.0, identifiedPeople: 6.62, wasteQuantity: -8.69 },
  },
  series: [
    { from: "2026-07-01", to: "2026-07-07", summary: { ...({} as AnalyticsOverview["summary"]), invoicedRevenueEUR: 6500, posRevenueEUR: 2900, totalRevenueEUR: 9400, costOfGoodsEUR: 2200, wasteCostEUR: 85, identifiedPeople: 145, wasteQuantity: 18, costOfGoodsLabel: "", wasteCostLabel: "", costCoverage: { knownQuantity: 180, totalQuantity: 200, percent: 90 }, posRefundsEUR: 70 } },
    { from: "2026-07-08", to: "2026-07-14", summary: { ...({} as AnalyticsOverview["summary"]), invoicedRevenueEUR: 7200, posRevenueEUR: 3100, totalRevenueEUR: 10300, costOfGoodsEUR: 2500, wasteCostEUR: 110, identifiedPeople: 162, wasteQuantity: 21, costOfGoodsLabel: "", wasteCostLabel: "", costCoverage: { knownQuantity: 195, totalQuantity: 230, percent: 84.78 }, posRefundsEUR: 110 } },
    { from: "2026-07-15", to: "2026-07-21", summary: { ...({} as AnalyticsOverview["summary"]), invoicedRevenueEUR: 6800, posRevenueEUR: 3000, totalRevenueEUR: 9800, costOfGoodsEUR: 2450, wasteCostEUR: 95, identifiedPeople: 151, wasteQuantity: 23, costOfGoodsLabel: "", wasteCostLabel: "", costCoverage: { knownQuantity: 200, totalQuantity: 240, percent: 83.33 }, posRefundsEUR: 120 } },
    { from: "2026-07-22", to: "2026-07-31", summary: { ...({} as AnalyticsOverview["summary"]), invoicedRevenueEUR: 7950, posRevenueEUR: 3680, totalRevenueEUR: 11630, costOfGoodsEUR: 2700, wasteCostEUR: 100, identifiedPeople: 154, wasteQuantity: 22, costOfGoodsLabel: "", wasteCostLabel: "", costCoverage: { knownQuantity: 205, totalQuantity: 240, percent: 85.42 }, posRefundsEUR: 120 } },
  ],
  wasteBreakdown: [
    { reason: "RECIPE_WASTE", quantity: 42, knownCostEUR: 180, unknownQuantity: 8, costLabel: "N/D" },
    { reason: "PRODUCTION_VARIANCE", quantity: 27, knownCostEUR: 110, unknownQuantity: 4, costLabel: "N/D" },
    { reason: "WASTE", quantity: 15, knownCostEUR: 100, unknownQuantity: 1, costLabel: "N/D" },
  ],
  dataQuality: {
    currency: "EUR",
    nonEurDocuments: 3,
    unidentifiedDocuments: 28,
    costCoverage: { knownQuantity: 780, totalQuantity: 910, percent: 85.71 },
    unknownCostQuantity: 130,
    stockPurchaseCoverage: { knownQuantity: 1120, totalQuantity: 1180, percent: 94.92 },
    unknownPurchaseQuantity: 60,
    wasteCostCoverage: { knownQuantity: 71, totalQuantity: 84, percent: 84.52 },
    unknownWasteQuantity: 13,
    refreshRequired: false,
  },
};

const shell = (data: Record<string, unknown>) => ({
  layout: "fullscreen" as const,
  appShell: { title: "Estadísticas", pathname: "/app/estadisticas", data },
});

const meta = {
  title: "Pages/Estadisticas",
  component: Page,
  tags: ["autodocs"],
  parameters: shell({}),
} satisfies Meta<typeof Page>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Populated: Story = {
  name: "Populated with comparison and quality coverage",
  parameters: shell({
    params: { from: "2026-07-01", to: "2026-07-31", granularity: "week", compare: "previous" },
    overview: { ...overview, granularity: "week" },
    error: null,
  }),
};

export const Empty: Story = {
  name: "Empty period",
  parameters: shell({
    params: { from: "2026-08-01", to: "2026-08-31", granularity: "day", compare: "previous" },
    overview: { ...overview, from: "2026-08-01", to: "2026-08-31", summary: { ...overview.summary, totalRevenueEUR: 0, identifiedPeople: 0, wasteQuantity: 0, costOfGoodsEUR: null, stockPurchasesEUR: null, wasteCostEUR: null, costCoverage: { knownQuantity: 0, totalQuantity: 0, percent: 0 }, stockPurchaseCoverage: { knownQuantity: 0, totalQuantity: 0, percent: 0 } }, series: [], wasteBreakdown: [], dataQuality: { ...overview.dataQuality, refreshRequired: true } },
    error: null,
  }),
};

export const Error: Story = {
  name: "Error",
  parameters: shell({
    params: { from: "2026-07-01", to: "2026-07-31", granularity: "day", compare: "previous" },
    overview: null,
    error: "No autorizado",
  }),
};
