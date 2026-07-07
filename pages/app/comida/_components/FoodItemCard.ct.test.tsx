/**
 * Component test for FoodItemCard.
 * Uses vitest + @testing-library/react (jsdom environment).
 * Run with: bun test pages/app/comida/_components/FoodItemCard.ct.test.tsx
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { FoodItemCard } from "./FoodItemCard";
import type { FoodItem, Vino } from "../../../../api/types";

vi.mock("lucide-react", () => ({
  PencilLine: () => <span data-testid="pencil-icon" />,
  Trash2: () => <span data-testid="trash-icon" />,
  Upload: () => <span data-testid="upload-icon" />,
  UtensilsCrossed: () => <span data-testid="utensils-icon" />,
}));

const WINE_ITEM: Vino = {
  num: 10,
  tipo: "TINTO",
  nombre: "Rioja Reserva",
  precio: 18.5,
  descripcion: "A full-bodied red wine",
  bodega: "Bodega Test",
  denominacion_origen: "Rioja",
  graduacion: 13.5,
  anyo: "2018",
  active: true,
  has_foto: false,
};

const PLATO_ITEM: FoodItem = {
  num: 1,
  tipo: "PRINCIPIO",
  nombre: "Paella Valenciana",
  precio: 12.0,
  descripcion: "Arroz con azafran",
  titulo: "Paella Valenciana",
  suplemento: 0,
  alergenos: [],
  categoria: "Arroces",
  active: true,
  has_foto: false,
};

describe("FoodItemCard", () => {
  it("renders wine item correctly", () => {
    const { container } = render(
      <FoodItemCard
        item={WINE_ITEM}
        foodType="vinos"
        onOpen={() => {}}
        onEdit={() => {}}
        onDelete={() => {}}
        onToggle={() => {}}
      />
    );

    expect(container.textContent).toContain("Rioja Reserva");
  });

  it("renders plato item correctly", () => {
    const { container } = render(
      <FoodItemCard
        item={PLATO_ITEM}
        foodType="platos"
        onOpen={() => {}}
        onEdit={() => {}}
        onDelete={() => {}}
        onToggle={() => {}}
      />
    );

    expect(container.textContent).toContain("Paella Valenciana");
  });

  it("shows edit and delete buttons", () => {
    const { container } = render(
      <FoodItemCard
        item={WINE_ITEM}
        foodType="vinos"
        onOpen={() => {}}
        onEdit={() => {}}
        onDelete={() => {}}
        onToggle={() => {}}
      />
    );

    const editBtn = container.querySelector('[data-role="food-card-edit-btn"]');
    const deleteBtn = container.querySelector('[data-role="food-card-delete-btn"]');
    expect(editBtn).toBeInTheDocument();
    expect(deleteBtn).toBeInTheDocument();
  });

  it("toggle button calls onToggle", () => {
    const onToggle = vi.fn();
    const { container } = render(
      <FoodItemCard
        item={WINE_ITEM}
        foodType="vinos"
        onOpen={() => {}}
        onEdit={() => {}}
        onDelete={() => {}}
        onToggle={onToggle}
      />
    );

    const toggle = container.querySelector('[role="switch"]');
    expect(toggle).toBeInTheDocument();
    fireEvent.click(toggle!);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("busy state disables the toggle", () => {
    const { container } = render(
      <FoodItemCard
        item={WINE_ITEM}
        foodType="vinos"
        busy={true}
        onOpen={() => {}}
        onEdit={() => {}}
        onDelete={() => {}}
        onToggle={() => {}}
      />
    );

    const toggle = container.querySelector('[role="switch"]');
    expect(toggle).toBeInTheDocument();
    expect(toggle).toBeDisabled();
  });

  it("renders the media region by default (showMedia defaults to true)", () => {
    const { container } = render(
      <FoodItemCard
        item={PLATO_ITEM}
        foodType="platos"
        onOpen={() => {}}
        onEdit={() => {}}
        onDelete={() => {}}
        onToggle={() => {}}
      />,
    );
    expect(container.querySelector('[data-ui="dish-card-media"]')).toBeInTheDocument();
    expect(container.textContent).toContain("Paella Valenciana");
  });

  it("forwards showMedia=false to FoodDishCard and hides the media region", () => {
    const { container } = render(
      <FoodItemCard
        item={PLATO_ITEM}
        foodType="platos"
        onOpen={() => {}}
        onEdit={() => {}}
        onDelete={() => {}}
        onToggle={() => {}}
        showMedia={false}
      />,
    );
    expect(container.querySelector('[data-ui="dish-card-media"]')).toBeNull();
    expect(container.textContent).toContain("Paella Valenciana");
  });
});
