import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";

const mockState: { showImages: boolean } = { showImages: true };

vi.mock("./hooks/useFoodTypePage", () => ({
  useFoodTypePage: () => ({
    items: [],
    categories: [],
    page: 1,
    setPage: vi.fn(),
    pageSize: 24,
    setPageSize: vi.fn(),
    total: 0,
    search: "",
    setSearch: vi.fn(),
    tipoFilter: "",
    setTipoFilter: vi.fn(),
    activeFilter: "all",
    setActiveFilter: vi.fn(),
    categoryFilter: "",
    setCategoryFilter: vi.fn(),
    alergenoFilter: "",
    setAlergenoFilter: vi.fn(),
    suplementoFilter: "all",
    setSuplementoFilter: vi.fn(),
    loading: false,
    processing: false,
    modalOpen: false,
    setModalOpen: vi.fn(),
    editingItem: null,
    categoryModalOpen: false,
    setCategoryModalOpen: vi.fn(),
    categoryBusy: false,
    deleteConfirm: { open: false, item: null },
    setDeleteConfirm: vi.fn(),
    pageActive: true,
    pageVisibilityLoading: false,
    showPageVisibilityToggle: false,
    foodType: "platos",
    totalPages: 1,
    showPagerBtns: false,
    togglePageActive: vi.fn(),
    onResetFilters: vi.fn(),
    onOpenCreate: vi.fn(),
    onOpenEdit: vi.fn(),
    onOpenDetail: vi.fn(),
    onSaveItem: vi.fn(),
    onCreateCategory: vi.fn(),
    onDeleteConfirm: vi.fn(),
    onToggle: vi.fn(),
    showImages: mockState.showImages,
    setShowImages: vi.fn(),
  }),
}));

vi.mock("../../../../state/atoms", () => ({
  sessionAtom: { init: null },
  fichajeRealtimeAtom: { init: { activeEntry: null, wsConnected: false } },
  themeAtom: { init: "dark" },
}));

vi.mock("../../../../ui/feedback/useToasts", () => ({
  useToasts: () => ({ pushToast: vi.fn() }),
}));

vi.mock("../../../../ui/feedback/useErrorToast", () => ({
  useErrorToast: vi.fn(),
}));

vi.mock("vike-react/usePageContext", () => ({
  usePageContext: () => ({
    data: {
      foodType: "platos",
      items: [],
      categories: [],
      page: 1,
      pageSize: 24,
      total: 0,
      filters: {
        search: "",
        tipo: "",
        active: "all",
        category: "",
        alergeno: "",
        suplemento: "all",
      },
      error: null,
    },
    urlPathname: "/app/comida/platos",
  }),
}));

vi.mock("./hooks/useFilterOptions", () => ({
  useFilterOptions: () => ({
    tipoOptions: [],
    categoryOptions: [],
    alergenoOptions: [],
  }),
}));

import Page from "./+Page";

describe("Food list page — Mostrar imagenes toggle", () => {
  it("renders the mostrar imagenes switch when showImages is true", () => {
    mockState.showImages = true;
    render(<Page />);

    const toggle = screen.getByLabelText(/mostrar imagenes/i);
    expect(toggle).toBeInTheDocument();
    expect(toggle).toHaveAttribute("role", "switch");
  });

  it("renders the mostrar imagenes switch even when showImages is false (toggle controls cards, not itself)", () => {
    mockState.showImages = false;
    const { container } = render(<Page />);
    const switches = container.querySelectorAll('[data-ui="food-show-images-switch"]');
    expect(switches.length).toBe(1);
    expect(switches[0]).toHaveAttribute("role", "switch");
  });
});
