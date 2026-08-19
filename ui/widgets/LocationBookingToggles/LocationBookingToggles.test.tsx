import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { LocationBookingToggles } from "./LocationBookingToggles";

describe("LocationBookingToggles (default variant)", () => {
  it("renders both switches and fires global patch", async () => {
    const user = userEvent.setup();
    const onSetGlobal = vi.fn();
    render(
      <LocationBookingToggles
        variant="default"
        allowFloorReservation={false}
        allowSalonReservation={false}
        onSetGlobal={onSetGlobal}
      />,
    );

    await user.click(screen.getByRole("switch", { name: "Permitir reserva de planta" }));
    expect(onSetGlobal).toHaveBeenCalledWith({ allowFloorReservation: true });

    await user.click(screen.getByRole("switch", { name: "Permitir reserva de salón" }));
    expect(onSetGlobal).toHaveBeenCalledWith({ allowSalonReservation: true });
  });

  it("shows the both-off note only when both flags are off", () => {
    const { rerender } = render(
      <LocationBookingToggles variant="default" allowFloorReservation={false} allowSalonReservation={false} />,
    );
    expect(screen.getByText(/no elige ubicación/i)).toBeTruthy();

    rerender(
      <LocationBookingToggles variant="default" allowFloorReservation={true} allowSalonReservation={false} />,
    );
    expect(screen.queryByText(/no elige ubicación/i)).toBeNull();
  });
});

describe("LocationBookingToggles (day variant)", () => {
  it("uses plain switches showing the global default when inheriting", async () => {
    const user = userEvent.setup();
    const onSetOverride = vi.fn();
    render(
      <LocationBookingToggles
        variant="day"
        allowFloorReservation={true}
        allowSalonReservation={false}
        global={{ allowFloorReservation: true, allowSalonReservation: false }}
        onSetOverride={onSetOverride}
      />,
    );

    // Hints expose the inherited global values, no third "inherit" control.
    expect(screen.getByText("Valor global: activado")).toBeTruthy();
    expect(screen.getByText("Valor global: desactivado")).toBeTruthy();
    expect(screen.queryByRole("group")).toBeNull();

    await user.click(screen.getByRole("switch", { name: "Permitir reserva de salón" }));
    expect(onSetOverride).toHaveBeenCalledWith({ allowSalonReservation: true });
  });
});
