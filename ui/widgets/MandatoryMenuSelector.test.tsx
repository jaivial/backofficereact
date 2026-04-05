import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MandatoryMenuSelector } from "./MandatoryMenuSelector";
import * as React from "react";

// Mock lucide-react icons
vi.mock("lucide-react", () => ({
  Plus: () => React.createElement("span", { "data-testid": "plus-icon" }, "Plus"),
  Trash2: () => React.createElement("span", { "data-testid": "trash-icon" }, "Trash2"),
  ChevronDown: () => React.createElement("span", { "data-testid": "chevron-down" }, "ChevronDown"),
}));

const mockMenus = [
  { id: 1, menu_title: "Menu del Día", menu_type: "closed_conventional" },
  { id: 2, menu_title: "Menú Grupo A", menu_type: "closed_group" },
  { id: 3, menu_title: "Menú Especial", menu_type: "special" },
  { id: 4, menu_title: "Carta del Día", menu_type: "a_la_carte" },
];

describe("MandatoryMenuSelector", () => {
  const defaultProps = {
    menus: mockMenus,
    selectedMenuIds: [] as number[],
    menuChooseMain: [] as number[],
    onChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders empty state when no menus selected", () => {
    render(React.createElement(MandatoryMenuSelector, defaultProps));
    expect(screen.queryByTestId("plus-icon")).toBeInTheDocument();
    expect(screen.getByText("Añadir menu")).toBeInTheDocument();
  });

  it("shows delete button only when more than one menu selected", () => {
    // Only one menu - no delete button
    const { rerender } = render(
      React.createElement(MandatoryMenuSelector, {
        ...defaultProps,
        selectedMenuIds: [1],
        onChange: vi.fn(),
      })
    );
    expect(screen.queryByTestId("trash-icon")).not.toBeInTheDocument();
    
    // Two menus - should show delete buttons
    rerender(
      React.createElement(MandatoryMenuSelector, {
        ...defaultProps,
        selectedMenuIds: [1, 2],
        onChange: vi.fn(),
      })
    );
    expect(screen.getAllByTestId("trash-icon")).toHaveLength(2);
  });

  it("shows no menus message when menus array is empty", () => {
    render(
      React.createElement(MandatoryMenuSelector, {
        menus: [],
        selectedMenuIds: [],
        menuChooseMain: [],
        onChange: vi.fn(),
      })
    );
    expect(screen.getByText("No hay menus disponibles")).toBeInTheDocument();
    expect(screen.queryByText("Añadir menu")).not.toBeInTheDocument();
  });
});

describe("MandatoryMenuSelector add row behavior", () => {
  it("calls onChange with first menu id when add button is clicked", () => {
    const onChange = vi.fn();    
    render(
      React.createElement(MandatoryMenuSelector, {
        menus: mockMenus,
        selectedMenuIds: [],
        menuChooseMain: [],
        onChange,
      })
    );
    
    fireEvent.click(screen.getByText("Añadir menu"));
    
    expect(onChange).toHaveBeenCalledWith([1], []);
  });

  it("skips already selected menus when adding new row", () => {
    const onChange = vi.fn();
    
    render(
      React.createElement(MandatoryMenuSelector, {
        menus: mockMenus,
        selectedMenuIds: [1],
        menuChooseMain: [],
        onChange,
      })
    );
    
    fireEvent.click(screen.getByText("Añadir menu"));
    
    // Should add menu id 2 (first unselected menu)
    expect(onChange).toHaveBeenCalledWith([1, 2], []);
  });
});
