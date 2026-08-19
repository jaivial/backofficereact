import { describe, it, expect, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

import { monthViewForDate, nextMonth, prevMonth, useMonthCalendar } from "./useMonthCalendar";

function apiWith(getMonth: ReturnType<typeof vi.fn>) {
  return { calendar: { getMonth } } as never;
}

describe("month view helpers", () => {
  it("derives the visible month from an ISO date", () => {
    expect(monthViewForDate("2026-08-18")).toEqual({ year: 2026, month: 8 });
  });

  it("wraps backwards across the year boundary", () => {
    expect(prevMonth({ year: 2026, month: 1 })).toEqual({ year: 2025, month: 12 });
    expect(prevMonth({ year: 2026, month: 8 })).toEqual({ year: 2026, month: 7 });
  });

  it("wraps forwards across the year boundary", () => {
    expect(nextMonth({ year: 2026, month: 12 })).toEqual({ year: 2027, month: 1 });
    expect(nextMonth({ year: 2026, month: 8 })).toEqual({ year: 2026, month: 9 });
  });
});

describe("useMonthCalendar", () => {
  it("loads the month of the selected date", async () => {
    const day = { date: "2026-08-18", booking_count: 3, total_people: 12, limit: 45, is_open: true };
    const getMonth = vi.fn().mockResolvedValue({ success: true, data: [day] });
    const { result } = renderHook(() => useMonthCalendar(apiWith(getMonth), "2026-08-18"));

    expect(result.current.year).toBe(2026);
    expect(result.current.month).toBe(8);
    await waitFor(() => expect(result.current.days).toEqual([day]));
    expect(getMonth).toHaveBeenCalledWith({ year: 2026, month: 8 });
    expect(result.current.loading).toBe(false);
  });

  it("refetches when navigating months", async () => {
    const getMonth = vi.fn().mockResolvedValue({ success: true, data: [] });
    const { result } = renderHook(() => useMonthCalendar(apiWith(getMonth), "2026-01-10"));
    await waitFor(() => expect(getMonth).toHaveBeenCalledTimes(1));

    act(() => result.current.onPrevMonth());
    await waitFor(() => expect(getMonth).toHaveBeenLastCalledWith({ year: 2025, month: 12 }));
    expect(result.current.month).toBe(12);
    expect(result.current.year).toBe(2025);
  });

  it("follows the selected date into another month", async () => {
    const getMonth = vi.fn().mockResolvedValue({ success: true, data: [] });
    const { result, rerender } = renderHook(({ date }) => useMonthCalendar(apiWith(getMonth), date), {
      initialProps: { date: "2026-08-18" },
    });
    await waitFor(() => expect(getMonth).toHaveBeenCalledTimes(1));

    rerender({ date: "2026-09-02" });
    await waitFor(() => expect(getMonth).toHaveBeenLastCalledWith({ year: 2026, month: 9 }));
  });

  it("keeps the days empty when the request fails", async () => {
    const getMonth = vi.fn().mockResolvedValue({ success: false, message: "boom" });
    const { result } = renderHook(() => useMonthCalendar(apiWith(getMonth), "2026-08-18"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.days).toEqual([]);
  });
});
