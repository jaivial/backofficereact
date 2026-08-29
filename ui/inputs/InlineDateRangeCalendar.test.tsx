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

  it("emits a new range after selecting two dates", () => {
    const onChange = vi.fn();
    render(<InlineDateRangeCalendar from="2026-08-10" to="" onChange={onChange} />);

    fireEvent.click(document.querySelector('button[data-date="2026-08-12"]') as Element);

    expect(onChange).toHaveBeenLastCalledWith({ from: "2026-08-10", to: "2026-08-12" });
  });
});
