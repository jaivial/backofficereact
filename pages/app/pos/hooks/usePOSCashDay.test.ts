import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { isValidPOSDate, usePOSCashDay } from "./usePOSCashDay";

const openDay = {
  id: 900, date: "2026-03-07", status: "OPEN", openedBy: 7, openedByName: "Ana",
  closedBy: null, closedByName: "", openingCashCents: 0, openedAt: "2026-03-07T08:00:00Z",
  closedAt: null, forcedOpen: false, notes: null,
  totalGrossCents: 12500, ticketCount: 4, covers: 9,
};

class FakeSocket {
  static last: FakeSocket | null = null;
  static created = 0;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  closed = false;
  constructor(public url: string) {
    FakeSocket.last = this;
    FakeSocket.created += 1;
  }
  close() {
    this.closed = true;
    this.onclose?.();
  }
  emit(payload: unknown) {
    this.onmessage?.({ data: JSON.stringify(payload) });
  }
}

function mockCurrent(body: Record<string, unknown>) {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/pos/cash-days/current")) return new Response(JSON.stringify({ success: true, ...body }));
    if (url.includes("/pos/cash-days")) return new Response(JSON.stringify({ success: true, cashDay: openDay }));
    return new Response(JSON.stringify({ success: false, message: `unexpected ${url}` }), { status: 500 });
  });
}

describe("isValidPOSDate", () => {
  it("accepts a strict calendar date", () => {
    expect(isValidPOSDate("2026-03-07")).toBe(true);
  });

  // A hand-edited URL must never reach the API as a silent empty filter, and a
  // date that does not exist must not roll over into the next month.
  it.each([null, undefined, "", "2026-3-7", "07-03-2026", "hoy", "2026-02-30", "2026-13-01"])("rejects %s", (value) => {
    expect(isValidPOSDate(value as string | null)).toBe(false);
  });
});

describe("usePOSCashDay", () => {
  beforeEach(() => {
    FakeSocket.last = null;
    FakeSocket.created = 0;
    vi.stubGlobal("WebSocket", FakeSocket as unknown as typeof WebSocket);
  });

  // The suite has no unstubGlobals, so a WebSocket left replaced here would
  // follow the worker into whatever file runs next.
  afterEach(() => { vi.unstubAllGlobals(); });

  it("loads the requested date", async () => {
    const fetchMock = mockCurrent({ date: "2026-03-07", cashDay: openDay, unclosedPrevious: [] });
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => usePOSCashDay("2026-03-07"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.cashDay?.id).toBe(900);
    expect(result.current.totals).toEqual({ date: "2026-03-07", totalGrossCents: 12500, ticketCount: 4, covers: 9 });
    expect(result.current.readOnly).toBe(false);
    expect(String(fetchMock.mock.calls[0][0])).toContain("date=2026-03-07");
    // The till reloads on every shift change, so the busiest screen of the POS
    // must not pay for the same answer twice.
    expect(fetchMock.mock.calls.filter((call) => String(call[0]).includes("/current"))).toHaveLength(1);
  });

  // The cutoff means the business date is not always today's calendar date, so
  // the hook asks instead of recomputing the rule in the browser.
  it("takes the business date from the backend when none is requested", async () => {
    const fetchMock = mockCurrent({ date: "2026-03-06", cashDay: null, unclosedPrevious: [] });
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => usePOSCashDay(null));
    await waitFor(() => expect(result.current.date).toBe("2026-03-06"));
    expect(String(fetchMock.mock.calls[0][0])).not.toContain("date=");
  });

  it("marks a closed day as read only", async () => {
    vi.stubGlobal("fetch", mockCurrent({ date: "2026-03-07", cashDay: { ...openDay, status: "CLOSED" }, unclosedPrevious: [] }));
    const { result } = renderHook(() => usePOSCashDay("2026-03-07"));
    await waitFor(() => expect(result.current.readOnly).toBe(true));
  });

  it("applies an opening pushed over the socket", async () => {
    vi.stubGlobal("fetch", mockCurrent({ date: "2026-03-07", cashDay: null, unclosedPrevious: [] }));
    const { result } = renderHook(() => usePOSCashDay("2026-03-07"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => { FakeSocket.last?.emit({ type: "pos_cash_day_opened", data: { cashDay: openDay } }); });
    expect(result.current.cashDay?.id).toBe(900);
  });

  it("updates the running total without refetching", async () => {
    const fetchMock = mockCurrent({ date: "2026-03-07", cashDay: openDay, unclosedPrevious: [] });
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => usePOSCashDay("2026-03-07"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    const callsBefore = fetchMock.mock.calls.length;
    act(() => { FakeSocket.last?.emit({ type: "pos_cash_day_totals", data: { date: "2026-03-07", totalGrossCents: 20000, ticketCount: 6, covers: 12 } }); });
    expect(result.current.totals?.totalGrossCents).toBe(20000);
    expect(result.current.cashDay?.totalGrossCents).toBe(20000);
    expect(fetchMock.mock.calls.length).toBe(callsBefore);
  });

  // Every till in the restaurant shares this socket, so an event for another
  // day must not rewrite the figures of the one on screen.
  it("ignores events for a different date", async () => {
    vi.stubGlobal("fetch", mockCurrent({ date: "2026-03-07", cashDay: openDay, unclosedPrevious: [] }));
    const { result } = renderHook(() => usePOSCashDay("2026-03-07"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => { FakeSocket.last?.emit({ type: "pos_cash_day_totals", data: { date: "2026-03-06", totalGrossCents: 999, ticketCount: 1, covers: 1 } }); });
    expect(result.current.totals?.totalGrossCents).toBe(12500);
  });

  // Open/close payloads carry the bare day, without figures. Trusting them
  // would blank the takings on the very screen used to sign the Z closure.
  it("keeps the totals when a closure frame arrives without figures", async () => {
    vi.stubGlobal("fetch", mockCurrent({ date: "2026-03-07", cashDay: openDay, unclosedPrevious: [] }));
    const { result } = renderHook(() => usePOSCashDay("2026-03-07"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    const bare = { ...openDay, status: "CLOSED" } as Record<string, unknown>;
    delete bare.totalGrossCents; delete bare.ticketCount; delete bare.covers;
    act(() => { FakeSocket.last?.emit({ type: "pos_cash_day_closed", data: { cashDay: bare } }); });
    expect(result.current.readOnly).toBe(true);
    expect(result.current.totals?.totalGrossCents).toBe(12500);
    expect(result.current.cashDay?.totalGrossCents).toBe(12500);
  });

  // A pending day is by definition earlier than the one on screen, so the
  // warning would never clear if the event had to match the active date.
  it("drops a previous day closed from another till", async () => {
    const previous = { ...openDay, id: 899, date: "2026-03-06" };
    vi.stubGlobal("fetch", mockCurrent({ date: "2026-03-07", cashDay: openDay, unclosedPrevious: [previous] }));
    const { result } = renderHook(() => usePOSCashDay("2026-03-07"));
    await waitFor(() => expect(result.current.unclosedPrevious).toHaveLength(1));
    act(() => { FakeSocket.last?.emit({ type: "pos_cash_day_closed", data: { cashDay: { ...previous, status: "CLOSED" } } }); });
    expect(result.current.unclosedPrevious).toHaveLength(0);
    expect(result.current.cashDay?.id).toBe(900);
  });

  // A day forced open behind the one on screen becomes pending straight away,
  // otherwise the warning only appears after a manual refresh.
  it("adds a previous day forced open from another till", async () => {
    vi.stubGlobal("fetch", mockCurrent({ date: "2026-03-07", cashDay: openDay, unclosedPrevious: [] }));
    const { result } = renderHook(() => usePOSCashDay("2026-03-07"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => { FakeSocket.last?.emit({ type: "pos_cash_day_opened", data: { cashDay: { ...openDay, id: 899, date: "2026-03-06" } } }); });
    expect(result.current.unclosedPrevious.map((entry) => entry.date)).toEqual(["2026-03-06"]);
  });

  it("survives a malformed frame", async () => {
    vi.stubGlobal("fetch", mockCurrent({ date: "2026-03-07", cashDay: openDay, unclosedPrevious: [] }));
    const { result } = renderHook(() => usePOSCashDay("2026-03-07"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => { FakeSocket.last?.onmessage?.({ data: "<html>proxy error</html>" }); });
    expect(result.current.totals?.totalGrossCents).toBe(12500);
  });

  // Unmounting must not leave the socket reopening itself forever behind a
  // screen nobody is looking at.
  it("closes the socket on unmount and does not reconnect", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", mockCurrent({ date: "2026-03-07", cashDay: openDay, unclosedPrevious: [] }));
    const { unmount } = renderHook(() => usePOSCashDay("2026-03-07"));
    const socket = FakeSocket.last;
    unmount();
    expect(socket?.closed).toBe(true);
    await act(async () => { vi.advanceTimersByTime(120000); });
    expect(FakeSocket.created).toBe(1);
    vi.useRealTimers();
  });

  it("surfaces a failed opening instead of pretending it worked", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/current")) return new Response(JSON.stringify({ success: true, date: "2026-03-07", cashDay: null, unclosedPrevious: [] }));
      return new Response(JSON.stringify({ success: false, message: "Hay días anteriores sin cerrar" }), { status: 409 });
    }));
    const { result } = renderHook(() => usePOSCashDay("2026-03-07"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    let outcome = true;
    await act(async () => { outcome = await result.current.openDay(); });
    expect(outcome).toBe(false);
    expect(result.current.error).toBe("Hay días anteriores sin cerrar");
    expect(result.current.cashDay).toBeNull();
  });

  // FE-2 draws the pending-days warning off this list, so closing a day from
  // this very screen must not keep warning about the day just handled.
  it("drops a day from the pending list once it is closed here", async () => {
    const pending = { ...openDay, id: 899, date: "2026-03-06" };
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/current")) return new Response(JSON.stringify({ success: true, date: "2026-03-06", cashDay: pending, unclosedPrevious: [pending] }));
      return new Response(JSON.stringify({ success: true, cashDay: { ...pending, status: "CLOSED" } }));
    }));
    const { result } = renderHook(() => usePOSCashDay("2026-03-06"));
    await waitFor(() => expect(result.current.unclosedPrevious).toHaveLength(1));
    await act(async () => { await result.current.closeDay({ countedCashCents: 0 }); });
    expect(result.current.unclosedPrevious).toHaveLength(0);
    expect(result.current.readOnly).toBe(true);
  });

  it("explains a close with no open day instead of failing mutely", async () => {
    vi.stubGlobal("fetch", mockCurrent({ date: "2026-03-07", cashDay: null, unclosedPrevious: [] }));
    const { result } = renderHook(() => usePOSCashDay("2026-03-07"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    let outcome = true;
    await act(async () => { outcome = await result.current.closeDay({ countedCashCents: 0 }); });
    expect(outcome).toBe(false);
    expect(result.current.error).toBe("No hay caja abierta que cerrar");
  });
});
