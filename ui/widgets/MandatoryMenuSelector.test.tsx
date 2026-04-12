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

// Mock Select component
vi.mock("../inputs/Select", () => ({
  Select: ({ value, onChange, options, ariaLabel }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; ariaLabel?: string }) =>
    React.createElement("select", {
      value,
      onChange: (e: React.ChangeEvent<HTMLSelectElement>) => onChange(e.target.value),
      "data-testid": "mock-select",
      "aria-label": ariaLabel,
    }, options.map((o) => React.createElement("option", { key: o.value, value: o.value }, o.label))),
}));

function queryByDataUI(container: HTMLElement, value: string) {
  return container.querySelector(`[data-ui="${value}"]`);
}

const mockMenus = [
  { id: 1, menu_title: "Menu del Dia", menu_type: "closed_conventional" },
  { id: 2, menu_title: "Menu Grupo A", menu_type: "closed_group" },
  { id: 3, menu_title: "Menu Especial", menu_type: "special" },
  { id: 4, menu_title: "Carta del Dia", menu_type: "a_la_carte" },
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
    const { container } = render(React.createElement(MandatoryMenuSelector, defaultProps));
    // Empty state shows data-ui="add-first-menu-btn"
    expect(queryByDataUI(container, "add-first-menu-btn")).toBeInTheDocument();
    expect(screen.getByTestId("plus-icon")).toBeInTheDocument();
  });

  it("shows delete button only when more than one menu selected", () => {
    // Only one menu - no delete button
    const { rerender, container } = render(
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
    const { container } = render(
      React.createElement(MandatoryMenuSelector, {
        menus: [],
        selectedMenuIds: [],
        menuChooseMain: [],
        onChange: vi.fn(),
      })
    );
    expect(container.textContent).toMatch(/No hay men/i);
    // The "add first menu" button should be disabled
    const addBtn = queryByDataUI(container, "add-first-menu-btn") as HTMLButtonElement | null;
    if (addBtn) expect(addBtn.disabled).toBe(true);
  });
});

describe("MandatoryMenuSelector add row behavior", () => {
  it("calls onChange with first menu id when add button is clicked", () => {
    const onChange = vi.fn();
    const { container } = render(
      React.createElement(MandatoryMenuSelector, {
        menus: mockMenus,
        selectedMenuIds: [],
        menuChooseMain: [],
        onChange,
      })
    );

    // Click the "add first menu" button in empty state
    const addBtn = queryByDataUI(container, "add-first-menu-btn") as HTMLButtonElement;
    fireEvent.click(addBtn);

    expect(onChange).toHaveBeenCalledWith([1], []);
  });

  it("skips already selected menus when adding new row", () => {
    const onChange = vi.fn();
    const { container } = render(
      React.createElement(MandatoryMenuSelector, {
        menus: mockMenus,
        selectedMenuIds: [1],
        menuChooseMain: [],
        onChange,
      })
    );

    // Click the "add another" button (visible when menus > selected)
    const addBtn = queryByDataUI(container, "add-menu-btn") as HTMLButtonElement;
    fireEvent.click(addBtn);

    // Should add menu id 2 (first unselected menu)
    expect(onChange).toHaveBeenCalledWith([1, 2], []);
  });
});
