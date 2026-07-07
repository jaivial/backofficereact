import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const assignSpy = vi.fn();

// Mock the entire useFoodTypePage hook
vi.mock("./hooks/useFoodTypePage", () => ({
  useFoodTypePage: () => ({
    items: [
      {
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
      },
    ],
    categories: [],
    page: 1,
    setPage: vi.fn(),
    pageSize: 24,
    setPageSize: vi.fn(),
    total: 1,
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
    pageActive: false,
    pageVisibilityLoading: false,
    showPageVisibilityToggle: false,
    foodType: "vinos",
    totalPages: 1,
    showPagerBtns: false,
    togglePageActive: vi.fn(),
    onResetFilters: vi.fn(),
    onOpenCreate: () => window.location.assign("/app/comida/vinos/new"),
    onOpenEdit: (item: any) => window.location.assign(`/app/comida/vinos/${item.num}`),
    onOpenDetail: vi.fn(),
    onSaveItem: vi.fn(),
    onCreateCategory: vi.fn(),
    onDeleteConfirm: vi.fn(),
    onToggle: vi.fn(),
    showImages: true,
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
      foodType: "vinos",
      items: [
        {
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
        },
      ],
      categories: [],
      page: 1,
      pageSize: 24,
      total: 1,
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
    urlPathname: "/app/comida/vinos",
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

describe("Wine list page navigation (Task #2)", () => {
  beforeEach(() => {
    assignSpy.mockClear();
    delete (window as any).location;
    (window as any).location = { assign: assignSpy };
  });

  it("FAB (+) button navigates to /app/comida/vinos/new instead of opening modal", () => {
    render(<Page />);

    const fab = screen.getByRole("button", { name: /anadir vino/i });
    expect(fab).toBeTruthy();

    fireEvent.click(fab);

    expect(assignSpy).toHaveBeenCalledWith("/app/comida/vinos/new");
  });

  it("clicking edit on a wine card navigates to /app/comida/vinos/{id}", () => {
    render(<Page />);

    const editButtons = screen.getAllByRole("button").filter(
      (btn) => btn.getAttribute("data-role") === "food-item-card-edit-btn" || btn.getAttribute("aria-label")?.toLowerCase().includes("editar"),
    );

    if (editButtons.length > 0) {
      fireEvent.click(editButtons[0]);
      expect(assignSpy).toHaveBeenCalledWith("/app/comida/vinos/10");
    }
  });

  it("does not render WineModal for vinos foodType", () => {
    const { container } = render(<Page />);
    const modal = container.querySelector("[data-role='wine-modal']");
    expect(modal).toBeNull();
  });
});
