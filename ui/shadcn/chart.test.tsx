import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ChartContainer } from "./chart";

describe("ChartContainer", () => {
  it("exposes chart id and config CSS variables for Recharts", () => {
    render(
      React.createElement(
        ChartContainer,
        { id: "revenue", config: { invoiced: { label: "Facturado", color: "#b9a8ff" } } },
        React.createElement("div", { "data-ui": "chart-test-child" }),
      ),
    );

    expect(screen.getByTestId("chart-container")).toHaveAttribute("data-chart", "revenue");
    expect(screen.getByTestId("chart-container-style-revenue")).toHaveTextContent("--color-invoiced: #b9a8ff");
  });
});
