import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Select } from "./Select";

vi.mock("lucide-react", () => ({
  ChevronDown: () => <svg data-slot="select-test-chevron" />,
}));

describe("Select", () => {
  it("shows placeholder without adding it to selectable options", () => {
    render(
      <Select
        value=""
        onChange={() => {}}
        options={[{ value: "12", label: "Menú degustación" }]}
        placeholder="Selecciona…"
        ariaLabel="Seleccionar menú"
      />,
    );

    const trigger = screen.getByRole("button", { name: "Seleccionar menú" });
    expect(trigger).toHaveTextContent("Selecciona…");

    fireEvent.click(trigger);

    expect(screen.getByRole("option", { name: "Menú degustación" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Selecciona…" })).not.toBeInTheDocument();
  });
});
