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
  // same cell would make neither readable. Driven through MonthCalendar with a
  // payload that does produce a tone, so the assertion can actually fail.
  it("never paints the reservations occupancy tones", () => {
    const busy: CalendarDay[] = [
      { date: "2026-03-05", total_people: 55, limit: 60, is_open: true } as CalendarDay,
      { date: "2026-03-06", total_people: 0, limit: 60, is_open: false } as CalendarDay,
    ];
    const { container } = render(
      <MonthCalendar
        year={2026} month={3} days={busy} selectedDateISO="2026-03-05"
        onSelectDate={noop} onPrevMonth={noop} onNextMonth={noop} loading={false}
        dayClassName={() => "is-noCash"}
      />,
    );
    expect(container.querySelectorAll("[class*='occ-']")).toHaveLength(0);
    expect(screen.getByTestId("month-calendar-day-6")).not.toHaveClass("is-closed");
    expect(screen.getByTestId("month-calendar-day-5")).toHaveClass("is-noCash");
  });

  // MonthCalendar's own name reads "abierto" for every cell here, because no
  // reservations payload is passed — the opposite of what a day with no till
  // shows on screen.
  it("names each day by its cash state, not by the reservations default", async () => {
    vi.stubGlobal("fetch", mockList([day("2026-03-05", "CLOSED", 128400), day("2026-03-07", "OPEN", 4250)]));
    render(<POSCashDayCalendar {...base} />);
    await waitFor(() => expect(screen.getByTestId("month-calendar-day-5")).toHaveAttribute("aria-label", expect.stringContaining("caja cerrada")));
    expect(screen.getByTestId("month-calendar-day-7")).toHaveAttribute("aria-label", expect.stringContaining("caja abierta"));
    expect(screen.getByTestId("month-calendar-day-9")).toHaveAttribute("aria-label", "2026-03-09: sin caja");
    expect(screen.getByTestId("month-calendar-day-9").getAttribute("aria-label")).not.toContain("abierto");
  });

  // `.bo-mcal--glass .bo-mcalCell.is-selected.is-open` in stepper.css paints the
  // selected day the reservations green. Every cell here would carry `is-open`,
  // so the selected day would claim the till was open on a day it never was.
  it("carries none of the reservations state classes", async () => {
    vi.stubGlobal("fetch", mockList([day("2026-03-07", "CLOSED", 100)]));
    render(<POSCashDayCalendar {...base} />);
    await waitFor(() => expect(screen.getByTestId("month-calendar-day-7")).toHaveClass("is-cashClosed"));
    expect(screen.getByTestId("month-calendar")).toHaveClass("bo-mcal--cash");
    expect(screen.getByTestId("month-calendar-day-7")).toHaveClass("is-selected");
    expect(screen.getByTestId("month-calendar-day-7")).not.toHaveClass("is-open");
    expect(screen.getByTestId("month-calendar-day-9")).not.toHaveClass("is-open");
    expect(screen.getByTestId("month-calendar-day-9")).not.toHaveClass("is-closed");
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

  it("keeps the reservations state classes", () => {
    render(<MonthCalendar year={2026} month={3} days={days} selectedDateISO="2026-03-05" onSelectDate={noop} onPrevMonth={noop} onNextMonth={noop} loading={false} />);
    expect(screen.getByTestId("month-calendar-day-5")).toHaveClass("is-open");
    expect(screen.getByTestId("month-calendar-day-6")).toHaveClass("is-closed");
  });

  it("keeps the lock on a closed day", () => {
    const { container } = render(<MonthCalendar year={2026} month={3} days={days} selectedDateISO="2026-03-05" onSelectDate={noop} onPrevMonth={noop} onNextMonth={noop} loading={false} />);
    expect(screen.getByTestId("month-calendar-day-6")).toHaveClass("is-closed");
    expect(container.querySelector("[data-testid='month-calendar-day-6'] .bo-ico")).not.toBeNull();
  });
});
