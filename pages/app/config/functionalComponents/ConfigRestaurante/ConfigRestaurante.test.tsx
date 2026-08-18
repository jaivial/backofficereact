import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ConfigDefaults, ConfigFloor } from "../../../../../api/types";
import { ConfigRestauranteContent } from "./ConfigRestaurante";

const mSetDefaults = vi.fn();
const mSetDefaultFloors = vi.fn();
const onFloorsChanged = vi.fn();
const onDefaultsChanged = vi.fn();

vi.mock("lucide-react", () => new Proxy({}, { get: (_t, name: string) => () => null }));

vi.mock("vike-react/usePageContext", () => ({
  usePageContext: () => ({ urlParsed: { search: {} } }),
}));

vi.mock("motion/react", () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  motion: { div: ({ children }: { children: React.ReactNode }) => <div>{children}</div> },
  useReducedMotion: () => false,
}));

const baseDefaults: ConfigDefaults = {
  openingMode: "both",
  morningHours: ["13:00"],
  nightHours: ["20:00"],
  dailyLimit: 45,
  mesasDeDosLimit: "10",
  mesasDeTresLimit: "8",
  weekdayOpen: { monday: false, tuesday: false, wednesday: false, thursday: true, friday: true, saturday: true, sunday: true },
} as unknown as ConfigDefaults;

const baseFloors: ConfigFloor[] = [
  { id: 1, floorNumber: 0, name: "Planta baja", isGround: true, active: true },
  { id: 2, floorNumber: 1, name: "Planta 1", isGround: false, active: true },
];

function renderContent(overrides: Partial<Parameters<typeof ConfigRestauranteContent>[0]> = {}) {
  const busySetter = vi.fn();
  render(
    <ConfigRestauranteContent
      defaults={baseDefaults}
      floors={baseFloors}
      busy={false}
      setBusy={busySetter}
      setError={vi.fn()}
      api={{ config: { setDefaults: mSetDefaults, setDefaultFloors: mSetDefaultFloors } } as never}
      pushToast={vi.fn()}
      onFloorsChanged={onFloorsChanged}
      onDefaultsChanged={onDefaultsChanged}
      {...overrides}
    />,
  );
}

describe("ConfigRestaurante optimistic UI", () => {
  beforeEach(() => {
    mSetDefaults.mockReset();
    mSetDefaultFloors.mockReset();
    onFloorsChanged.mockReset();
    onDefaultsChanged.mockReset();
  });

  it("notifies floors change optimistically on count increase (before await)", async () => {
    const user = userEvent.setup();
    mSetDefaultFloors.mockImplementation(() => new Promise(() => {})); // never resolves
    renderContent();

    await user.click(screen.getByRole("button", { name: "Añadir planta" }));

    expect(onFloorsChanged).toHaveBeenCalledTimes(1);
    const optimistic = onFloorsChanged.mock.calls[0][0] as ConfigFloor[];
    expect(optimistic).toHaveLength(3);
    expect(optimistic[2].floorNumber).toBe(2);
  });

  it("notifies floors change on toggle with the toggled active state", async () => {
    const user = userEvent.setup();
    mSetDefaultFloors.mockResolvedValue({ success: true });
    renderContent();

    const switches = screen.getAllByRole("switch");
    await user.click(switches[0]);

    await waitFor(() => expect(onFloorsChanged).toHaveBeenCalledTimes(1));
    const optimistic = onFloorsChanged.mock.calls[0][0] as ConfigFloor[];
    expect(optimistic[0].active).toBe(false);
    expect(optimistic[1].active).toBe(true);
  });

  it("rolls back floors change when the API fails and reports the error", async () => {
    const user = userEvent.setup();
    const setError = vi.fn();
    mSetDefaultFloors.mockResolvedValue({ success: false, message: "boom" });
    renderContent({ setError });

    await user.click(screen.getByRole("button", { name: "Añadir planta" }));

    await waitFor(() => expect(setError).toHaveBeenCalledWith(expect.stringContaining("boom")));
    // rollback notification with original floors
    expect(onFloorsChanged).toHaveBeenLastCalledWith(baseFloors);
  });

  it("notifies defaults patch optimistically when saving mesas limit", async () => {
    const user = userEvent.setup();
    mSetDefaults.mockResolvedValue({ success: true });
    renderContent();

    await user.click(screen.getAllByRole("button", { name: "Aumentar mesas de 2" })[0]);

    await waitFor(() => expect(onDefaultsChanged).toHaveBeenCalled());
    expect(onDefaultsChanged).toHaveBeenLastCalledWith({ mesasDeDosLimit: "11" });
  });
});
