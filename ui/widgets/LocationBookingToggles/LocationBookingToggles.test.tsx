import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { LocationBookingToggles } from "./LocationBookingToggles";

const baseConfig = {
  date: "2099-02-10",
  global: { allowFloorReservation: true, allowSalonReservation: false },
  override: { allowFloorReservation: null, allowSalonReservation: null },
  effective: { allowFloorReservation: true, allowSalonReservation: false },
};

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
  it("renders tri-state options with the inherited global value", () => {
    render(
      <LocationBookingToggles
        variant="day"
        allowFloorReservation={true}
        allowSalonReservation={false}
        override={baseConfig.override}
        global={baseConfig.global}
      />,
    );

    // Inherit buttons expose the global value as a hint.
    expect(screen.getByText("Heredar (sí)")).toBeTruthy();
    expect(screen.getByText("Heredar (no)")).toBeTruthy();
  });

  it("fires inherit / on / off overrides", async () => {
    const user = userEvent.setup();
    const onSetOverride = vi.fn();
    render(
      <LocationBookingToggles
        variant="day"
        allowFloorReservation={true}
        allowSalonReservation={false}
        override={baseConfig.override}
        global={baseConfig.global}
        onSetOverride={onSetOverride}
      />,
    );

    await user.click(screen.getAllByText(/^Heredar/)[0].closest("button")!);
    expect(onSetOverride).toHaveBeenCalledWith({ allowFloorReservation: null });

    await user.click(screen.getAllByText("Sí")[1].closest("button")!);
    expect(onSetOverride).toHaveBeenCalledWith({ allowSalonReservation: true });

    await user.click(screen.getAllByText("No")[0].closest("button")!);
    expect(onSetOverride).toHaveBeenCalledWith({ allowFloorReservation: false });
  });
});
