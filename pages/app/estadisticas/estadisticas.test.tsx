import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import Page from "./estadisticas";

vi.mock("vike-react/usePageContext", () => ({
  usePageContext: () => ({ data: { params: { from: "", to: "", granularity: "day", compare: "previous" }, overview: null, error: null } }),
}));
vi.mock("../../../api/client", () => ({ createClient: () => ({ analytics: {} }) }));
vi.mock("lucide-react", () => ({
  MessageCircle: () => <span data-ui="mock-message-icon" />,
  Search: () => <span data-ui="mock-search-icon" />,
  TrendingUp: () => <span data-ui="mock-trending-icon" />,
  Users: () => <span data-ui="mock-users-icon" />,
}));
vi.mock("./functionalComponents/AffluenceDashboard/AffluenceDashboard", () => ({
  AffluenceDashboard: () => <div data-testid="mock-affluence" data-ui="mock-affluence" />,
}));
vi.mock("./functionalComponents/AnalyticsDashboard/AnalyticsDashboard", () => ({
  AnalyticsDashboard: () => <div data-testid="mock-analytics" data-ui="mock-analytics" />,
}));
vi.mock("./functionalComponents/MessagingDashboard/MessagingDashboard", () => ({
  MessagingDashboard: () => <div data-testid="mock-messaging" data-ui="mock-messaging" />,
}));
vi.mock("./functionalComponents/SearchConsoleDashboard/SearchConsoleDashboard", () => ({
  SearchConsoleDashboard: () => <div data-testid="mock-search-console" data-ui="mock-search-console" />,
}));

describe("Estadísticas tabs", () => {
  it("opens Search Console only inside the private analytics tab", () => {
    render(<Page />);

    expect(screen.getByTestId("mock-affluence")).toBeInTheDocument();
    expect(screen.queryByTestId("mock-search-console")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Búsqueda orgánica" }));
    expect(screen.getByTestId("mock-search-console")).toBeInTheDocument();
    expect(screen.queryByTestId("mock-affluence")).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Búsqueda orgánica" })).toHaveAttribute("aria-selected", "true");
  });
});
