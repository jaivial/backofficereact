import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import type { POSCashDay } from "../../../../../api/types";
import { POSUnclosedDaysModal } from "./POSUnclosedDaysModal";

const day = (over: Partial<POSCashDay> = {}): POSCashDay => ({
  id: 5,
  date: "2026-02-16",
  status: "OPEN",
  openedBy: 3,
  openedByName: "Lucía",
  closedBy: null,
  closedByName: "",
  openingCashCents: 0,
  openedAt: "2026-02-16T08:30:00Z",
  closedAt: null,
  forcedOpen: false,
  notes: null,
  totalGrossCents: 123456,
  ticketCount: 9,
  covers: 42,
  ...over,
});

describe("POSUnclosedDaysModal", () => {
  it("renders one card per unsealed day with all its figures", () => {
    const onOpenDay = vi.fn(async () => true);
    render(<POSUnclosedDaysModal date="2026-02-17" unclosedPrevious={[day(), day({ id: 6, date: "2026-02-15", openedByName: "Marcos", totalGrossCents: 0, covers: 0 })]} onOpenDay={onOpenDay} onPickDate={() => {}} />);
    const cards = screen.getAllByTestId("pos-unclosed-card");
    expect(cards).toHaveLength(2);
    // es-ES EUR inserts a narrow no-break space between amount and currency, so
    // assert on the card text rather than an exact string match.
    expect(cards[0]).toHaveTextContent("16 de febrero de 2026");
    expect(cards[0]).toHaveTextContent("Lucía");
    expect(cards[0].textContent).toMatch(/1234,56/);
    expect(cards[0].textContent).toMatch(/€/);
    expect(cards[0]).toHaveTextContent("Afluencia");
    expect(cards[0]).toHaveTextContent("42");
  });

  it("jumps to the unsealed day via Ver día", () => {
    const onPickDate = vi.fn();
    render(<POSUnclosedDaysModal date="2026-02-17" unclosedPrevious={[day()]} onOpenDay={async () => true} onPickDate={onPickDate} />);
    fireEvent.click(screen.getByTestId("pos-unclosed-view-day"));
    expect(onPickDate).toHaveBeenCalledWith("2026-02-16");
  });

  it("force-opens today only after the second confirmation", async () => {
    const onOpenDay = vi.fn(async () => true);
    render(<POSUnclosedDaysModal date="2026-02-17" unclosedPrevious={[day()]} onOpenDay={onOpenDay} onPickDate={() => {}} />);
    // The confirm is not on screen until the force button is pressed.
    expect(screen.queryByTestId("pos-force-confirm")).toBeNull();
    fireEvent.click(screen.getByTestId("pos-unclosed-force-open"));
    fireEvent.click(await screen.findByTestId("pos-force-confirm-ok"));
    await waitFor(() => expect(onOpenDay).toHaveBeenCalledWith(0, true));
  });

  it("lets the operator back out of the force confirmation", () => {
    const onOpenDay = vi.fn(async () => true);
    render(<POSUnclosedDaysModal date="2026-02-17" unclosedPrevious={[day()]} onOpenDay={onOpenDay} onPickDate={() => {}} />);
    fireEvent.click(screen.getByTestId("pos-unclosed-force-open"));
    fireEvent.click(screen.getByTestId("pos-force-confirm-cancel"));
    expect(screen.queryByTestId("pos-force-confirm")).toBeNull();
    expect(onOpenDay).not.toHaveBeenCalled();
  });

  it("surfaces a backend refusal", () => {
    render(<POSUnclosedDaysModal date="2026-02-17" unclosedPrevious={[day()]} error="No se pudo abrir la caja" onOpenDay={async () => true} onPickDate={() => {}} />);
    expect(screen.getByTestId("pos-unclosed-error")).toHaveTextContent("No se pudo abrir la caja");
  });

  it("links to Informes to close the pending days", () => {
    render(<POSUnclosedDaysModal date="2026-02-17" unclosedPrevious={[day()]} onOpenDay={async () => true} onPickDate={() => {}} />);
    expect(screen.getByTestId("pos-unclosed-go-reports")).toHaveAttribute("href", "/app/pos?section=reports");
  });
});
