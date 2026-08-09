import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { POSCashDayDatePicker } from "./POSCashDayDatePicker";

describe("POSCashDayDatePicker", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ success: true, items: [] }))));
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  const open = async () => {
    fireEvent.click(screen.getByTestId("picker"));
    await waitFor(() => expect(document.querySelector("[data-ui='date-picker-popover']")).not.toBeNull());
  };

  // Both calendars have to sit identically on screen, and the shell is chosen
  // by this exact class list.
  it("uses the same popover shell as the reservations picker", async () => {
    render(<POSCashDayDatePicker value="2026-03-07" onChange={() => {}} data-testid="picker" />);
    await open();
    const popover = document.querySelector("[data-ui='date-picker-popover']");
    expect(popover).toHaveClass("bo-datePop", "bo-datePop--glass", "bo-datePop--mcal");
  });

  it("opens on the month of the selected day", async () => {
    render(<POSCashDayDatePicker value="2026-03-07" onChange={() => {}} data-testid="picker" />);
    await open();
    expect(screen.getByTestId("month-calendar-header")).toHaveTextContent("Marzo");
  });

  it("emits the picked day and closes", async () => {
    const onChange = vi.fn();
    render(<POSCashDayDatePicker value="2026-03-07" onChange={onChange} data-testid="picker" />);
    await open();
    fireEvent.click(screen.getByTestId("month-calendar-day-12"));
    expect(onChange).toHaveBeenCalledWith("2026-03-12");
    await waitFor(() => expect(document.querySelector("[data-ui='date-picker-popover']")).toBeNull());
  });

  it("navigates months without emitting a date", async () => {
    const onChange = vi.fn();
    render(<POSCashDayDatePicker value="2026-01-07" onChange={onChange} data-testid="picker" />);
    await open();
    fireEvent.click(screen.getByTestId("month-calendar-prev"));
    await waitFor(() => expect(screen.getByTestId("month-calendar-header")).toHaveTextContent("Diciembre"));
    expect(screen.getByTestId("month-calendar-header")).toHaveTextContent("2025");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("closes on Escape", async () => {
    render(<POSCashDayDatePicker value="2026-03-07" onChange={() => {}} data-testid="picker" />);
    await open();
    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() => expect(document.querySelector("[data-ui='date-picker-popover']")).toBeNull());
  });

  // Clicks land on the calendar inside the portal, which is outside the
  // trigger's DOM subtree: a naive contains() check would close on every tap.
  it("stays open while the user works inside the popover", async () => {
    render(<POSCashDayDatePicker value="2026-03-07" onChange={() => {}} data-testid="picker" />);
    await open();
    fireEvent.pointerDown(screen.getByTestId("month-calendar-next"));
    expect(document.querySelector("[data-ui='date-picker-popover']")).not.toBeNull();
  });

  it("closes on a click outside", async () => {
    render(<POSCashDayDatePicker value="2026-03-07" onChange={() => {}} data-testid="picker" />);
    await open();
    fireEvent.pointerDown(document.body);
    await waitFor(() => expect(document.querySelector("[data-ui='date-picker-popover']")).toBeNull());
  });
});
