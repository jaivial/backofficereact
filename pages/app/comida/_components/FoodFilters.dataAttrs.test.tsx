import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { FoodFilters } from "./FoodFilters";
import { expectAllElementsHaveDataAttr } from "../../../../lib/test/assertDataAttrs";

const noop = () => {};

describe("FoodFilters data-* attributes", () => {
  it("all rendered HTML elements have a semantic data-* attribute when collapsed", () => {
    const { container } = render(
      <FoodFilters
        foodType="vinos"
        search=""
        onSearchChange={noop}
        tipoFilter=""
        onTipoChange={noop}
        tipoOptions={[{ value: "", label: "Todos" }]}
        activeFilter="all"
        onActiveChange={noop}
        categoryFilter=""
        onCategoryChange={noop}
        categoryOptions={[]}
        alergenoFilter=""
        onAlergenoChange={noop}
        alergenoOptions={[]}
        suplementoFilter="all"
        onSuplementoChange={noop}
        onReset={noop}
        count={10}
        showImages={true}
        onShowImagesChange={noop}
      />,
    );
    expectAllElementsHaveDataAttr(container);
  });

  it("all rendered HTML elements have a semantic data-* attribute when expanded", () => {
    const { container, getByRole } = render(
      <FoodFilters
        foodType="vinos"
        search=""
        onSearchChange={noop}
        tipoFilter=""
        onTipoChange={noop}
        tipoOptions={[{ value: "", label: "Todos" }, { value: "TINTO", label: "Tinto" }]}
        activeFilter="all"
        onActiveChange={noop}
        categoryFilter=""
        onCategoryChange={noop}
        categoryOptions={[]}
        alergenoFilter=""
        onAlergenoChange={noop}
        alergenoOptions={[]}
        suplementoFilter="all"
        onSuplementoChange={noop}
        onReset={noop}
        count={10}
        showImages={true}
        onShowImagesChange={noop}
      />,
    );
    fireEvent.click(getByRole("button", { name: /expandir filtros/i }));
    expectAllElementsHaveDataAttr(container);
  });
});
