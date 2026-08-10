import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children?: React.ReactNode }) => React.createElement("div", { "data-testid": "responsive-container" }, children),
  PieChart: ({ children }: { children?: React.ReactNode }) => React.createElement("div", { "data-testid": "pie-chart" }, children),
  Pie: () => React.createElement("div", { "data-testid": "pie" }),
  Cell: () => null,
  Tooltip: () => null,
  Legend: () => null,
}));

import { HourSplitConfig } from "./HourSplitConfig";

const baseProps = {
  enabled: true,
  dailyLimit: 100,
  activeHours: ["13:00", "13:30", "14:00", "14:30", "15:00"],
  percentages: { "13:00": 20, "13:30": 20, "14:00": 20, "14:30": 20, "15:00": 20 },
  bookingsByHour: { "13:00": 4, "13:30": 2, "14:00": 0, "14:30": 0, "15:00": 0 },
  onToggleEnabled: vi.fn(),
  onCommitPercentages: vi.fn().mockResolvedValue(true),
  pushToast: vi.fn(),
};

describe("HourSplitConfig", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders the grid of cards when enabled", () => {
    render(<HourSplitConfig {...baseProps} />);
    expect(screen.getByTestId("hour-split-config")).toBeInTheDocument();
    expect(screen.getByTestId("hour-split-card-13:00")).toBeInTheDocument();
    expect(screen.getByTestId("hour-split-card-15:00")).toBeInTheDocument();
  });

  it("hides cards when disabled", () => {
    render(<HourSplitConfig {...baseProps} enabled={false} />);
    expect(screen.queryByTestId("hour-split-card-13:00")).toBeNull();
  });

  it("rebalances siblings on percentage edit and debounces commit", async () => {
    vi.useRealTimers();
    const onCommit = vi.fn().mockResolvedValue(true);
    const pushToast = vi.fn();
    render(<HourSplitConfig {...baseProps} onCommitPercentages={onCommit} pushToast={pushToast} />);

    fireEvent.change(screen.getByLabelText("Porcentaje para la hora 13:00"), { target: { value: "40" } });

    await waitFor(() => {
      expect(onCommit).toHaveBeenCalledTimes(1);
    });
    const committed = onCommit.mock.calls[0][0];
    expect(committed["13:00"]).toBe(40);
    // Remaining 60 spread across 4 siblings.
    const siblingsSum = committed["13:30"] + committed["14:00"] + committed["14:30"] + committed["15:00"];
    expect(Math.abs(siblingsSum - 60)).toBeLessThanOrEqual(0.05);
    expect(pushToast).toHaveBeenCalledWith(expect.objectContaining({ kind: "success" }));
  });

  it("fires onToggleEnabled when switch flips", () => {
    render(<HourSplitConfig {...baseProps} />);
    fireEvent.click(screen.getByTestId("hour-split-toggle"));
    expect(baseProps.onToggleEnabled).toHaveBeenCalledWith(false);
  });

  it("reset redistributes equally", async () => {
    vi.useRealTimers();
    const onCommit = vi.fn().mockResolvedValue(true);
    render(<HourSplitConfig {...baseProps} onCommitPercentages={onCommit} />);
    fireEvent.click(screen.getByTestId("hour-split-reset"));
    await waitFor(() => expect(onCommit).toHaveBeenCalled());
    const committed = onCommit.mock.calls[0][0];
    for (const h of baseProps.activeHours) {
      expect(committed[h]).toBe(20);
    }
  });
});
