import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { POSCalendarModal } from "./POSCalendarModal";

vi.mock("lucide-react", async () => {
  const { createElement } = await import("react");
  const icon = (name: string) => (props: Record<string, unknown>) => createElement("span", { "data-icon": name, ...props });
  return { X: icon("x"), ChevronLeft: icon("chevron-left"), ChevronRight: icon("chevron-right") };
});

const tablesPayload = {
  success: true,
  date: "2026-02-10",
  readOnly: true,
  adjustedCovers: 30,
  tables: [
    {
      tableId: 7,
      tableName: "Mesa 1",
      covers: 4,
      totalGrossCents: 8800,
      visits: [{ visitId: 90, status: "CLOSED", covers: 4, channel: "DINE_IN", openedAt: "2026-02-10T13:00:00Z", closedAt: "2026-02-10T15:00:00Z", totalGrossCents: 8800, tickets: [{ id: 1, ticketNumber: "TPV-1", status: "PAID", totalGrossCents: 8800, refundedCents: 0 }] }],
    },
  ],
};

describe("POSCalendarModal", () => {
  it("loads and shows the per-table breakdown for the active day", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/tables")) return new Response(JSON.stringify(tablesPayload));
      // cash-days list (calendar widget) + any other call.
      return new Response(JSON.stringify({ success: true, items: [] }));
    }));

    render(<POSCalendarModal open onClose={() => {}} activeDate="2026-02-10" onChangeDate={() => {}} />);

    expect(await screen.findByTestId("pos-calendar-table-name-7")).toHaveTextContent("Mesa 1");
    expect(screen.getByTestId("pos-calendar-table-total-7").textContent).toMatch(/88/);
    expect(screen.getByTestId("pos-calendar-readonly")).toBeInTheDocument();
  });

  it("navigates to the selected day via Ir a este día", async () => {
    const onChangeDate = vi.fn();
    const onClose = vi.fn();
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/tables")) return new Response(JSON.stringify(tablesPayload));
      return new Response(JSON.stringify({ success: true, items: [] }));
    }));

    render(<POSCalendarModal open onClose={onClose} activeDate="2026-02-10" onChangeDate={onChangeDate} />);

    await screen.findByTestId("pos-calendar-table-name-7");
    fireEvent.click(screen.getByTestId("pos-calendar-goto"));
    await waitFor(() => {
      expect(onChangeDate).toHaveBeenCalledWith("2026-02-10");
      expect(onClose).toHaveBeenCalled();
    });
  });

  it("surfaces a backend refusal from the tables endpoint", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/tables")) return new Response(JSON.stringify({ success: false, message: "Día no encontrado" }));
      return new Response(JSON.stringify({ success: true, items: [] }));
    }));

    render(<POSCalendarModal open onClose={() => {}} activeDate="2026-02-10" onChangeDate={() => {}} />);

    expect(await screen.findByTestId("pos-calendar-error")).toHaveTextContent("Día no encontrado");
  });
});
