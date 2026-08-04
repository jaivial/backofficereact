import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AnalyticsOverview, AnalyticsOverviewParams } from "../../../api/types";
import { AnalyticsDashboard } from "./functionalComponents/AnalyticsDashboard/AnalyticsDashboard";

vi.mock("lucide-react", () => {
  const icon = (name: string) => (props: Record<string, unknown>) => React.createElement("span", { "data-icon": name, ...props });
  return {
    AlertTriangle: icon("alert-triangle"),
    ArrowDown: icon("arrow-down"),
    ArrowDownRight: icon("arrow-down-right"),
    ArrowRight: icon("arrow-right"),
    ArrowUpRight: icon("arrow-up-right"),
    BarChart3: icon("bar-chart-3"),
    Building2: icon("building-2"),
    Calculator: icon("calculator"),
    CircleHelp: icon("circle-help"),
    Database: icon("database"),
    Filter: icon("filter"),
    FilterX: icon("filter-x"),
    Landmark: icon("landmark"),
    LoaderCircle: icon("loader-circle"),
    Percent: icon("percent"),
    PieChart: icon("pie-chart"),
    Receipt: icon("receipt"),
    ReceiptText: icon("receipt-text"),
    RefreshCcw: icon("refresh"),
    ShoppingCart: icon("shopping-cart"),
    SlidersHorizontal: icon("sliders-horizontal"),
    TrendingUp: icon("trending-up"),
    UserRound: icon("user-round"),
    Users: icon("users"),
    Utensils: icon("utensils"),
    Wallet: icon("wallet"),
    WalletCards: icon("wallet-cards"),
    ChevronDown: icon("chevron-down"),
    ChevronUp: icon("chevron-up"),
  };
});

const overview = {
  success: true,
  currency: "EUR",
  from: "2026-07-01",
  to: "2026-07-31",
  granularity: "day",
  summary: {
    invoicedRevenueEUR: 1000,
    posRevenueEUR: 500,
    posRefundsEUR: 20,
    totalRevenueEUR: 1500,
    costOfGoodsEUR: 120,
    costOfGoodsLabel: "",
    stockPurchasesEUR: 300,
    stockPurchasesLabel: "",
    wasteCostEUR: 8,
    wasteCostLabel: "N/D",
    identifiedPeople: 40,
    wasteQuantity: 3,
    costCoverage: { knownQuantity: 8, totalQuantity: 10, percent: 80 },
    stockPurchaseCoverage: { knownQuantity: 12, totalQuantity: 12, percent: 100 },
  },
  comparison: null,
  series: [
    {
      from: "2026-07-01",
      to: "2026-07-01",
      summary: {
        invoicedRevenueEUR: 1000,
        posRevenueEUR: 500,
        posRefundsEUR: 20,
        totalRevenueEUR: 1500,
        costOfGoodsEUR: 120,
        costOfGoodsLabel: "",
        stockPurchasesEUR: 300,
        stockPurchasesLabel: "",
        wasteCostEUR: 8,
        wasteCostLabel: "",
        identifiedPeople: 40,
        wasteQuantity: 3,
        costCoverage: { knownQuantity: 8, totalQuantity: 10, percent: 80 },
        stockPurchaseCoverage: { knownQuantity: 12, totalQuantity: 12, percent: 100 },
      },
    },
  ],
  wasteBreakdown: [{ reason: "RECIPE_WASTE", quantity: 3, knownCostEUR: 8, unknownQuantity: 1, costLabel: "N/D" }],
  topItems: [{ name: "Vino tinto", quantity: 4, revenueEUR: 60 }],
  paymentMethods: [{ method: "Tarjeta", amountEUR: 800, count: 12 }],
  dayOfWeek: [{ day: "Vie", revenueEUR: 400, covers: 18 }],
  hourlyDistribution: [{ hour: "21:00", covers: 14, revenueEUR: 300 }],
  revenueByCategory: [{ category: "Vinos", amountEUR: 500, percentage: 33.33 }],
  dataQuality: {
    currency: "EUR",
    nonEurDocuments: 0,
    unidentifiedDocuments: 2,
    costCoverage: { knownQuantity: 8, totalQuantity: 10, percent: 80 },
    stockPurchaseCoverage: { knownQuantity: 12, totalQuantity: 12, percent: 100 },
    unknownCostQuantity: 2,
    unknownPurchaseQuantity: 0,
    wasteCostCoverage: { knownQuantity: 2, totalQuantity: 3, percent: 66.67 },
    unknownWasteQuantity: 1,
    refreshRequired: false,
  },
} satisfies AnalyticsOverview;

const params: AnalyticsOverviewParams = {
  from: "2026-07-01",
  to: "2026-07-31",
  granularity: "day",
  compare: "previous",
};

function renderDashboard(overrides: Partial<React.ComponentProps<typeof AnalyticsDashboard>> = {}) {
  const onParamsChange = vi.fn<(next: AnalyticsOverviewParams) => void>();
  const onRefresh = vi.fn();
  render(
    React.createElement(AnalyticsDashboard, {
      overview,
      params,
      loading: false,
      error: null,
      onParamsChange,
      onRefresh,
      ...overrides,
    }),
  );
  return { onParamsChange, onRefresh };
}

describe("AnalyticsDashboard", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders separate EUR revenue, identified people, average spend and quality coverage", () => {
    renderDashboard();

    expect(screen.getByTestId("analytics-populated")).toBeInTheDocument();
    expect(screen.getByTestId("analytics-invoiced-revenue")).toHaveTextContent("1.000,00 €");
    expect(screen.getByTestId("analytics-pos-revenue")).toHaveTextContent("500,00 €");
    expect(screen.getByTestId("analytics-identified-people")).toHaveTextContent("40");
    expect(screen.getByTestId("analytics-average-spend")).toHaveTextContent("37,50 €");
    expect(screen.getByTestId("analytics-stock-purchases")).toHaveTextContent("300,00 €");
    expect(screen.getByTestId("analytics-quality")).toHaveTextContent("80%");
    expect(screen.getByTestId("analytics-waste-breakdown")).toHaveTextContent("RECIPE_WASTE");
    expect(screen.getByTestId("analytics-waste-cost")).toHaveTextContent("N/D");
  });

  it("renders error state and explicit empty state when there is no data", () => {
    const emptyOverview = { ...overview, summary: { ...overview.summary, totalRevenueEUR: 0, identifiedPeople: 0, wasteQuantity: 0, costOfGoodsEUR: null, stockPurchasesEUR: null, wasteCostEUR: null, costCoverage: { knownQuantity: 0, totalQuantity: 0, percent: 0 }, stockPurchaseCoverage: { knownQuantity: 0, totalQuantity: 0, percent: 0 } }, series: [], wasteBreakdown: [], topItems: [], paymentMethods: [], dayOfWeek: [], hourlyDistribution: [], revenueByCategory: [], dataQuality: { ...overview.dataQuality, refreshRequired: true } };
    const { rerender } = render(
      React.createElement(AnalyticsDashboard, {
        overview: emptyOverview,
        params,
        loading: false,
        error: null,
        onParamsChange: vi.fn(),
        onRefresh: vi.fn(),
      }),
    );
    expect(screen.getByTestId("analytics-empty-state")).toBeInTheDocument();

    rerender(
      React.createElement(AnalyticsDashboard, {
        overview: null,
        params,
        loading: false,
        error: "No autorizado",
        onParamsChange: vi.fn(),
        onRefresh: vi.fn(),
      }),
    );
    expect(screen.getByTestId("analytics-error")).toHaveTextContent("No autorizado");

    rerender(
      React.createElement(AnalyticsDashboard, {
        overview: null,
        params,
        loading: false,
        error: null,
        onParamsChange: vi.fn(),
        onRefresh: vi.fn(),
      }),
    );
    expect(screen.queryByTestId("analytics-populated")).not.toBeInTheDocument();
    expect(screen.queryByTestId("analytics-empty-state")).not.toBeInTheDocument();
  });

  it("changes filters and refreshes selected range", () => {
    const { onParamsChange, onRefresh } = renderDashboard();

    fireEvent.click(screen.getByTestId("analytics-filters-toggle"));
    fireEvent.change(screen.getByTestId("analytics-granularity"), { target: { value: "month" } });
    fireEvent.click(screen.getByTestId("analytics-compare"));
    fireEvent.click(screen.getByTestId("analytics-refresh"));

    expect(onParamsChange).toHaveBeenCalledWith({ ...params, granularity: "month" });
    expect(onParamsChange).toHaveBeenCalledWith({ ...params, compare: undefined });
    expect(onRefresh).toHaveBeenCalledWith();
  });

  it("renders loading state", () => {
    renderDashboard({ loading: true });
    expect(screen.getByTestId("analytics-loading")).toBeInTheDocument();
  });
});
