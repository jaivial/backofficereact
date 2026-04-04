import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { FoodItemCard } from "./FoodItemCard";
import { expectAllElementsHaveDataAttr } from "../../../../lib/test/assertDataAttrs";

const wineItem = {
  num: 1,
  tipo: "TINTO",
  nombre: "Test Wine",
  precio: 12.5,
  descripcion: "A test",
  bodega: "Bodega",
  denominacion_origen: "Rioja",
  graduacion: 13.5,
  anyo: "2020",
  active: true,
  has_foto: false,
};

describe("FoodItemCard data-* attributes (wine)", () => {
  it("all rendered HTML elements have a semantic data-* attribute", () => {
    const { container } = render(
      <FoodItemCard
        item={wineItem}
        foodType="vinos"
        onOpen={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onToggle={vi.fn()}
      />,
    );
    expectAllElementsHaveDataAttr(container);
  });
});
