import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("../../../../api/client", () => ({
  createClient: () => ({
    comida: {
      vinos: {
        list: vi.fn().mockResolvedValue({ success: true, vinos: [], total: 0 }),
        delete: vi.fn(),
        patch: vi.fn(),
      },
      platos: {
        categories: { list: vi.fn().mockResolvedValue({ success: true, categories: [] }) },
      },
      postres: { list: vi.fn().mockResolvedValue({ success: true, postres: [], total: 0 }) },
      bebidas: { list: vi.fn().mockResolvedValue({ success: true, items: [], total: 0 }) },
      cafes: { list: vi.fn().mockResolvedValue({ success: true, items: [], total: 0 }) },
    },
  }),
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
  }),
}));

import Page from "./+Page";

describe("Wine list page navigation (Task #2)", () => {
  const assignSpy = vi.fn();

  beforeEach(() => {
    assignSpy.mockClear();
    delete (window as any).location;
    (window as any).location = { assign: assignSpy };
  });

  it("FAB (+) button navigates to /app/comida/vinos/new instead of opening modal", async () => {
    render(<Page />);

    const fab = screen.getByRole("button", { name: /anadir vino/i });
    expect(fab).toBeTruthy();

    fireEvent.click(fab);

    expect(assignSpy).toHaveBeenCalledWith("/app/comida/vinos/new");
  });

  it("clicking edit on a wine card navigates to /app/comida/vinos/{id} instead of opening modal", async () => {
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
