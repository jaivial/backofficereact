import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// Stub Recharts (jsdom can't measure SVG containers).
vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children?: React.ReactNode }) => React.createElement("div", { "data-testid": "responsive-container" }, children),
  PieChart: ({ children }: { children?: React.ReactNode }) => React.createElement("div", { "data-testid": "pie-chart" }, children),
  Pie: () => React.createElement("div", { "data-testid": "pie" }),
  Cell: () => null,
  Tooltip: () => null,
  Legend: () => null,
}));

import { HourSplitCard } from "./HourSplitCard";

describe("HourSplitCard", () => {
  it("renders hour, percentage and bookings", () => {
    render(
      <HourSplitCard
        hour="13:30"
        percentage={20}
        bookings={4}
        capacity={20}
        dailyLimit={100}
        mode="percentage"
        onChange={() => {}}
        onModeChange={() => {}}
      />,
    );
    expect(screen.getByTestId("hour-split-card-13:30")).toBeInTheDocument();
    expect(screen.getByText("13:30")).toBeInTheDocument();
    expect(screen.getByText("4 reservados")).toBeInTheDocument();
    expect(screen.getByLabelText("Porcentaje para la hora 13:30")).toHaveValue(20);
  });

  it("emits onChange with the new percentage in pct mode", () => {
    const onChange = vi.fn();
    render(
      <HourSplitCard
        hour="13:30"
        percentage={20}
        bookings={0}
        capacity={20}
        dailyLimit={100}
        mode="percentage"
        onChange={onChange}
        onModeChange={() => {}}
      />,
    );
    fireEvent.change(screen.getByLabelText("Porcentaje para la hora 13:30"), { target: { value: "40" } });
    expect(onChange).toHaveBeenCalledWith("13:30", 40, "percentage");
  });

  it("emits onChange with the new people count in people mode", () => {
    const onChange = vi.fn();
    render(
      <HourSplitCard
        hour="13:30"
        percentage={20}
        bookings={0}
        capacity={20}
        dailyLimit={100}
        mode="people"
        onChange={onChange}
        onModeChange={() => {}}
      />,
    );
    fireEvent.change(screen.getByLabelText("Personas para la hora 13:30"), { target: { value: "34" } });
    expect(onChange).toHaveBeenCalledWith("13:30", 34, "people");
  });

  it("clamps input to the allowed max", () => {
    const onChange = vi.fn();
    render(
      <HourSplitCard
        hour="13:30"
        percentage={20}
        bookings={0}
        capacity={20}
        dailyLimit={100}
        mode="percentage"
        onChange={onChange}
        onModeChange={() => {}}
      />,
    );
    fireEvent.change(screen.getByLabelText("Porcentaje para la hora 13:30"), { target: { value: "999" } });
    expect(onChange).toHaveBeenCalledWith("13:30", 100, "percentage");
  });

  it("propagates mode toggle", () => {
    const onModeChange = vi.fn();
    render(
      <HourSplitCard
        hour="13:30"
        percentage={20}
        bookings={0}
        capacity={20}
        dailyLimit={100}
        mode="percentage"
        onChange={() => {}}
        onModeChange={onModeChange}
      />,
    );
    fireEvent.click(screen.getByTestId("hour-split-mode-px-13:30"));
    expect(onModeChange).toHaveBeenCalledWith("people");
  });
});
