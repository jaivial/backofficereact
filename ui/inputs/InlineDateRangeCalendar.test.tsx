import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { InlineDateRangeCalendar } from "./InlineDateRangeCalendar";

describe("InlineDateRangeCalendar", () => {
  it("renders the calendar directly, without a selector button, and shows the selected range summary", () => {
    render(<InlineDateRangeCalendar from="2026-08-29" to="2026-08-31" onChange={vi.fn()} />);

    expect(screen.queryByTestId("date-range-picker-btn")).toBeNull();
    expect(screen.getByTestId("inline-date-range-calendar")).toBeInTheDocument();
    expect(screen.getByTestId("inline-date-range-summary")).toHaveTextContent("29/08/2026 – 31/08/2026");
    expect(screen.getByTestId("inline-date-range-days")).toHaveTextContent("3 días activos");
  });

  it("keeps the first click as a local draft and emits only after the range is complete", () => {
    const onChange = vi.fn();
    render(<InlineDateRangeCalendar from="2026-08-10" to="2026-08-15" onChange={onChange} />);

    fireEvent.click(document.querySelector('button[data-date="2026-08-10"]') as Element);
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByTestId("inline-date-range-summary")).toHaveTextContent("10/08/2026");

    fireEvent.click(document.querySelector('button[data-date="2026-08-12"]') as Element);

    expect(onChange).toHaveBeenLastCalledWith({ from: "2026-08-10", to: "2026-08-12" });
  });
});
