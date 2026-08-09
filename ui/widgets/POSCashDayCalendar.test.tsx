import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { POSCashDayCalendar } from "./POSCashDayCalendar";
import { MonthCalendar } from "./MonthCalendar";
import type { CalendarDay } from "../../api/types";

const day = (date: string, status: "OPEN" | "CLOSED", totalGrossCents: number) => ({
  id: Number(date.slice(-2)), date, status, openedBy: 7, openedByName: "Ana",
  closedBy: null, closedByName: "", openingCashCents: 0, openedAt: `${date}T08:00:00Z`,
  closedAt: null, forcedOpen: false, notes: null, totalGrossCents, ticketCount: 3, covers: 8,
});

const noop = () => {};
const base = { year: 2026, month: 3, selectedDateISO: "2026-03-07", onSelectDate: noop, onPrevMonth: noop, onNextMonth: noop };

function mockList(items: unknown[]) {
  return vi.fn(async (input: RequestInfo | URL) => {
    void input;
    return new Response(JSON.stringify({ success: true, items }));
  });
}

describe("POSCashDayCalendar", () => {
  beforeEach(() => { vi.stubGlobal("fetch", mockList([])); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it("asks only for the month on show", async () => {
    const fetchMock = mockList([]);
    vi.stubGlobal("fetch", fetchMock);
    render(<POSCashDayCalendar {...base} />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain("from=2026-03-01");
    expect(url).toContain("to=2026-03-31");
  });

  it("labels each day with its state and takings", async () => {
    vi.stubGlobal("fetch", mockList([day("2026-03-05", "CLOSED", 128400), day("2026-03-07", "OPEN", 4250)]));
    render(<POSCashDayCalendar {...base} />);
    await waitFor(() => expect(screen.getByTestId("month-calendar-day-5")).toHaveTextContent("Cerrado"));
    expect(screen.getByTestId("month-calendar-day-5")).toHaveTextContent("1284");
    expect(screen.getByTestId("month-calendar-day-7")).toHaveTextContent("Abierto");
    expect(screen.getByTestId("month-calendar-day-7")).toHaveTextContent("43");
  });

  it("tones the cells by cash state and dims the days with no till", async () => {
    vi.stubGlobal("fetch", mockList([day("2026-03-05", "CLOSED", 100), day("2026-03-07", "OPEN", 200)]));
    render(<POSCashDayCalendar {...base} />);
    await waitFor(() => expect(screen.getByTestId("month-calendar-day-5")).toHaveClass("is-cashClosed"));
    expect(screen.getByTestId("month-calendar-day-7")).toHaveClass("is-cashOpen");
    expect(screen.getByTestId("month-calendar-day-9")).toHaveClass("is-noCash");
  });

  // The reservations palette answers a different question; painting both on the
  // same cell would make neither readable.
  it("never paints the reservations occupancy tones", async () => {
    vi.stubGlobal("fetch", mockList([day("2026-03-07", "OPEN", 999999)]));
    const { container } = render(<POSCashDayCalendar {...base} />);
    await waitFor(() => expect(screen.getByTestId("month-calendar-day-7")).toHaveClass("is-cashOpen"));
    expect(container.querySelectorAll("[class*='occ-']")).toHaveLength(0);
  });

  // Opening the till must repaint its own cell without waiting for the month
  // request to be issued again.
  it("lets the live day override the month payload", async () => {
    vi.stubGlobal("fetch", mockList([day("2026-03-07", "CLOSED", 100)]));
    const { rerender } = render(<POSCashDayCalendar {...base} />);
    await waitFor(() => expect(screen.getByTestId("month-calendar-day-7")).toHaveTextContent("Cerrado"));
    rerender(<POSCashDayCalendar {...base} liveDay={day("2026-03-07", "OPEN", 50000) as never} />);
    expect(screen.getByTestId("month-calendar-day-7")).toHaveTextContent("Abierto");
    expect(screen.getByTestId("month-calendar-day-7")).toHaveClass("is-cashOpen");
  });

  // A month that fails to load must still let the user reach a day that exists.
  it("keeps the days selectable when the month request fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("network down"); }));
    const onSelectDate = vi.fn();
    render(<POSCashDayCalendar {...base} onSelectDate={onSelectDate} />);
    await waitFor(() => expect(screen.getByTestId("month-calendar-day-9")).toHaveClass("is-noCash"));
    fireEvent.click(screen.getByTestId("month-calendar-day-9"));
    expect(onSelectDate).toHaveBeenCalledWith("2026-03-09");
  });
});

// The POS props are additive: /app/reservas and /app/reservas/tables render the
// same component and must be untouched by them.
describe("MonthCalendar without the POS props", () => {
  const days: CalendarDay[] = [
    { date: "2026-03-05", total_people: 30, limit: 60, is_open: true } as CalendarDay,
    { date: "2026-03-06", total_people: 0, limit: 60, is_open: false } as CalendarDay,
  ];

  it("keeps the pax ratio and the occupancy tone", () => {
    render(<MonthCalendar year={2026} month={3} days={days} selectedDateISO="2026-03-05" onSelectDate={noop} onPrevMonth={noop} onNextMonth={noop} loading={false} />);
    expect(screen.getByTestId("month-calendar-day-5")).toHaveTextContent("30/60");
    expect(screen.getByTestId("month-calendar-day-5")).toHaveClass("occ-50");
  });

  it("keeps the lock on a closed day", () => {
    const { container } = render(<MonthCalendar year={2026} month={3} days={days} selectedDateISO="2026-03-05" onSelectDate={noop} onPrevMonth={noop} onNextMonth={noop} loading={false} />);
    expect(screen.getByTestId("month-calendar-day-6")).toHaveClass("is-closed");
    expect(container.querySelector("[data-testid='month-calendar-day-6'] .bo-ico")).not.toBeNull();
  });
});
