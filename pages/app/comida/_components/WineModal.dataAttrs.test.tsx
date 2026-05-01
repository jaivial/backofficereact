import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { WineModal } from "./WineModal";
import { expectAllElementsHaveDataAttr } from "../../../../lib/test/assertDataAttrs";

vi.mock("../../../../api/client", () => ({
  createClient: () => ({
    comida: {
      vinos: { create: vi.fn(), patch: vi.fn() },
    },
  }),
}));

describe("WineModal data-* attributes", () => {
  it("all rendered HTML elements have a semantic data-* attribute when open with no wine", () => {
    const { container } = render(
      <WineModal open={true} wine={null} onClose={vi.fn()} onSave={vi.fn()}>,
    );
    const portal = container.querySelector("[data-role='dialog']") || container;
    expectAllElementsHaveDataAttr(portal as HTMLElement);
  });

  it("all rendered HTML elements have a semantic data-* attribute when open with existing wine", () => {
    const wine = {
      num: 1,
      tipo: "TINTO",
      nombre: "Test Wine",
      precio: 12.5,
      descripcion: "A test wine",
      bodega: "Test Bodega",
      denominacion_origen: "Rioja",
      graduacion: 13.5,
      anyo: "2020",
      active: true,
      has_foto: false,
    };
    const { container } = render(
      <WineModal open={true} wine={wine} onClose={vi.fn()} onSave={vi.fn()}>,
    );
    const portal = container.querySelector("[data-role='dialog']") || container;
    expectAllElementsHaveDataAttr(portal as HTMLElement);
  });
});
