/**
 * Component test for FoodList.
 * Uses vitest + @testing-library/react (jsdom environment).
 *
 * Note: FoodList imports icons from lucide-react (via constants).
 * For simplicity, this test only tests rendering behavior that doesn't
 * depend on the icon constants being resolved.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { FoodList } from "./FoodList";

const sampleItem = {
  num: 10,
  tipo: "TINTO",
  nombre: "Rioja Reserva",
  precio: 18.5,
  descripcion: "",
  bodega: "Bodega Test",
  denominacion_origen: "Rioja",
  graduacion: 13.5,
  anyo: "2018",
  active: true,
  has_foto: false,
} as any;

function makeProps(overrides: Partial<React.ComponentProps<typeof FoodList>> = {}) {
  return {
    items: [] as any[],
    loading: false,
    processing: false,
    foodType: "vinos" as const,
    page: 1,
    pageSize: 24,
    total: 0,
    totalPages: 1,
    showPagerBtns: false,
    singularLabel: "vino",
    onOpenDetail: vi.fn(),
    onOpenEdit: vi.fn(),
    onDelete: vi.fn(),
    onToggle: vi.fn(),
    onOpenCreate: vi.fn(),
    onPageChange: vi.fn(),
    onPageSizeChange: vi.fn(),
    listLabel: "vinos",
    ...overrides,
  };
}

describe("FoodList", () => {
  it("shows loading spinner when loading", () => {
    const { container } = render(<FoodList {...makeProps({ loading: true })} />);
    const loading = container.querySelector('[data-ui="food-list-loading"]');
    expect(loading).toBeInTheDocument();
  });

  it("shows empty state text when no items", () => {
    const { container } = render(<FoodList {...makeProps({ loading: false, items: [] })} />);
    const emptyText = container.querySelector('[data-role="food-list-empty-text"]');
    const emptyHint = container.querySelector('[data-role="food-list-empty-hint"]');
    expect(emptyText).toBeInTheDocument();
    expect(emptyHint).toBeInTheDocument();
    expect(emptyHint!.textContent).toMatch(/boton \+/);
  });

  it("renders pager info with correct page text", () => {
    const { container } = render(
      <FoodList {...makeProps({
        items: [sampleItem],
        page: 2,
        total: 15,
        totalPages: 2,
        showPagerBtns: true,
      })} />
    );

    const pagerInfo = container.querySelector('[data-role="food-list-pager-info"]');
    expect(pagerInfo).toBeInTheDocument();
    expect(pagerInfo!.textContent).toContain("Pagina 2");
    expect(pagerInfo!.textContent).toContain("15 resultados");
  });

  it("pager prev enabled and next disabled on last page", () => {
    const onPageChange = vi.fn();
    const { container } = render(
      <FoodList {...makeProps({
        items: [sampleItem],
        page: 2,
        total: 15,
        totalPages: 2,
        showPagerBtns: true,
        onPageChange,
      })} />
    );

    const prevBtn = container.querySelector('[data-role="food-list-pager-prev"]');
    const nextBtn = container.querySelector('[data-role="food-list-pager-next"]');
    expect(prevBtn).toBeInTheDocument();
    expect(nextBtn).toBeInTheDocument();
    expect(prevBtn).not.toBeDisabled();
    expect(nextBtn).toBeDisabled();
  });
});
