import React from "react";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { POSNoCashDayModal, formatSpanishLongDate, parseCashFloatCents } from "./POSNoCashDayModal";

describe("formatSpanishLongDate", () => {
  it("writes the month out in Spanish", () => {
    expect(formatSpanishLongDate("2026-02-17")).toBe("17 de febrero de 2026");
  });

  it("leaves a malformed value alone rather than inventing a date", () => {
    expect(formatSpanishLongDate("mañana")).toBe("mañana");
  });
});

// A float is typed on whatever keypad the till has, so both separators have to
// land on the same amount.
describe("parseCashFloatCents", () => {
  it.each([
    ["", 0],
    ["0", 0],
    ["150,50", 15050],
    ["150.50", 15050],
    ["12,34", 1234],
    ["1.500", 150000],
    ["1,500", 150000],
    ["1.234,56", 123456],
    ["1,234.56", 123456],
    [" 80 € ", 8000],
    ["0,5", 50],
    ["1.5", 150],
    ["100.000,00", 10000000],
    ["5,", 500],
    ["0,005", 1],
    ["0,100", 10],
    ["0.100", 10],
    ["12,345", 1234500],
  ])("reads %j as %i cents", (raw, cents) => {
    expect(parseCashFloatCents(raw)).toBe(cents);
  });

  // A slipped keypress must not be read as a thousands separator: "1..50"
  // parsed as grouping would open the till on 150 € instead of 1,50 €.
  it.each(["-20", "abc", "--1", "1..2", "1..50", "1.2.3", "12.34.56", "1,50,00", ".", ",", "1,999,99"])(
    "refuses %j",
    (raw) => { expect(parseCashFloatCents(raw)).toBeNull(); },
  );

  it("refuses an amount no till would ever hold", () => {
    expect(parseCashFloatCents("999999999999999999,99")).toBeNull();
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

  // Refusing in silence would leave the only actionable button in the gate
  // looking broken, so the refusal has to say why.
  it("refuses a negative float and says so instead of opening the day", async () => {
    const onOpenDay = vi.fn(async () => true);
    render(<POSNoCashDayModal date="2026-02-17" onOpenDay={onOpenDay} onPickDate={() => {}} />);
    fireEvent.change(screen.getByTestId("pos-no-cash-day-float"), { target: { value: "-20" } });
    fireEvent.click(screen.getByTestId("pos-no-cash-day-open"));
    await waitFor(() => expect(screen.getByTestId("pos-no-cash-day-error")).toHaveTextContent("importe válido"));
    expect(onOpenDay).not.toHaveBeenCalled();
    expect(screen.getByTestId("pos-no-cash-day-float")).toHaveAttribute("aria-invalid", "true");
  });

  it("clears its own complaint as soon as the field is edited", async () => {
    render(<POSNoCashDayModal date="2026-02-17" onOpenDay={async () => true} onPickDate={() => {}} />);
    fireEvent.change(screen.getByTestId("pos-no-cash-day-float"), { target: { value: "-20" } });
    fireEvent.click(screen.getByTestId("pos-no-cash-day-open"));
    await waitFor(() => expect(screen.getByTestId("pos-no-cash-day-error")).toBeInTheDocument());
    fireEvent.change(screen.getByTestId("pos-no-cash-day-float"), { target: { value: "20" } });
    expect(screen.queryByTestId("pos-no-cash-day-error")).toBeNull();
  });

  it("puts the caret in the float field, which is what it wants filled", () => {
    render(<POSNoCashDayModal date="2026-02-17" onOpenDay={async () => true} onPickDate={() => {}} />);
    expect(screen.getByTestId("pos-no-cash-day-float")).toHaveFocus();
  });

  // The backend refuses to open a day while earlier ones are unsealed. That
  // refusal is the whole point of the check, so it has to reach the user.
  it("shows the reason the backend refused", () => {
    render(<POSNoCashDayModal date="2026-02-17" error="Hay días anteriores sin cerrar" onOpenDay={async () => true} onPickDate={() => {}} />);
    expect(screen.getByTestId("pos-no-cash-day-error")).toHaveTextContent("Hay días anteriores sin cerrar");
  });

  // It is a gate, not a notice: dismissing it would leave the sell screen usable
  // with no cash day to book the sales against. Covering the page would be just
  // as wrong the other way, stranding the operator away from Informes, which is
  // where an earlier unsealed day has to be closed before this one can open.
  it("offers no way out of itself and does not seize the page", () => {
    render(<POSNoCashDayModal date="2026-02-17" onOpenDay={async () => true} onPickDate={() => {}} />);
    const gate = screen.getByTestId("pos-no-cash-day-modal");
    expect(screen.queryByRole("button", { name: /Cerrar|Cancelar|Descartar/ })).toBeNull();
    expect(gate).not.toHaveAttribute("aria-modal");
    expect(gate).not.toHaveAttribute("role", "dialog");
  });

  // jsdom loads no stylesheet, so getComputedStyle would report "static"
  // whatever the CSS said. The sheet itself is the only honest witness.
  it("is not styled as an overlay", () => {
    const css = readFileSync("components/styles/features/pos/cash-day.css", "utf8");
    const block = css.slice(css.indexOf(".pos-cashGate {"));
    expect(block.slice(0, block.indexOf("}"))).not.toMatch(/position:\s*(fixed|absolute)/);
  });

  it("offers the day picker without a detour", () => {
    render(<POSNoCashDayModal date="2026-02-17" onOpenDay={async () => true} onPickDate={() => {}} />);
    expect(screen.getByTestId("pos-no-cash-day-picker")).toBeInTheDocument();
  });
});
