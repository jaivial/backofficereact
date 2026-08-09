import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { POSNoCashDayModal, formatSpanishLongDate } from "./POSNoCashDayModal";

describe("formatSpanishLongDate", () => {
  it("writes the month out in Spanish", () => {
    expect(formatSpanishLongDate("2026-02-17")).toBe("17 de febrero de 2026");
  });

  it("leaves a malformed value alone rather than inventing a date", () => {
    expect(formatSpanishLongDate("mañana")).toBe("mañana");
  });
});

describe("POSNoCashDayModal", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ success: true, items: [] }))));
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  it("names the day it is gating", () => {
    render(<POSNoCashDayModal date="2026-02-17" onOpenDay={async () => true} onPickDate={() => {}} />);
    expect(screen.getByTestId("pos-no-cash-day-title")).toHaveTextContent("No hay caja abierta para el día 17 de febrero de 2026");
  });

  // The float is optional and most tills start the day empty, so an untouched
  // field must open the day rather than block it.
  it("opens with a zero float when the field is left empty", async () => {
    const onOpenDay = vi.fn(async () => true);
    render(<POSNoCashDayModal date="2026-02-17" onOpenDay={onOpenDay} onPickDate={() => {}} />);
    fireEvent.click(screen.getByTestId("pos-no-cash-day-open"));
    await waitFor(() => expect(onOpenDay).toHaveBeenCalledWith(0));
  });

  it("sends the float in cents", async () => {
    const onOpenDay = vi.fn(async () => true);
    render(<POSNoCashDayModal date="2026-02-17" onOpenDay={onOpenDay} onPickDate={() => {}} />);
    fireEvent.change(screen.getByTestId("pos-no-cash-day-float"), { target: { value: "150,50" } });
    fireEvent.click(screen.getByTestId("pos-no-cash-day-open"));
    await waitFor(() => expect(onOpenDay).toHaveBeenCalledWith(15050));
  });

  it("refuses a negative float instead of opening the day with it", async () => {
    const onOpenDay = vi.fn(async () => true);
    render(<POSNoCashDayModal date="2026-02-17" onOpenDay={onOpenDay} onPickDate={() => {}} />);
    fireEvent.change(screen.getByTestId("pos-no-cash-day-float"), { target: { value: "-20" } });
    fireEvent.click(screen.getByTestId("pos-no-cash-day-open"));
    await waitFor(() => expect(onOpenDay).not.toHaveBeenCalled());
  });

  // The backend refuses to open a day while earlier ones are unsealed. That
  // refusal is the whole point of the check, so it has to reach the user.
  it("shows the reason the backend refused", () => {
    render(<POSNoCashDayModal date="2026-02-17" error="Hay días anteriores sin cerrar" onOpenDay={async () => true} onPickDate={() => {}} />);
    expect(screen.getByTestId("pos-no-cash-day-error")).toHaveTextContent("Hay días anteriores sin cerrar");
  });

  // It is a gate, not a notice: dismissing it would leave the sell screen
  // usable with no cash day to book the sales against.
  it("cannot be dismissed", () => {
    render(<POSNoCashDayModal date="2026-02-17" onOpenDay={async () => true} onPickDate={() => {}} />);
    expect(screen.queryByRole("button", { name: "Cerrar" })).toBeNull();
    fireEvent.click(screen.getByTestId("pos-no-cash-day-backdrop"));
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.getByTestId("pos-no-cash-day-modal")).toBeInTheDocument();
  });

  it("reveals the day picker on demand", async () => {
    render(<POSNoCashDayModal date="2026-02-17" onOpenDay={async () => true} onPickDate={() => {}} />);
    fireEvent.click(screen.getByTestId("pos-no-cash-day-pick"));
    await waitFor(() => expect(screen.getByTestId("pos-no-cash-day-picker")).toBeInTheDocument());
  });
});
