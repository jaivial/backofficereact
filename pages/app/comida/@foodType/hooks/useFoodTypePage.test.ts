import { describe, expect, it } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useFoodTypePage } from "./useFoodTypePage";

// Minimal mock for the API client
const mockApi = {
  comida: {
    platos: {
      list: async () => ({
        success: true,
        items: [
          { num: 1, nombre: "Test Plato", tipo: "PRINCIPAL", precio: 10, descripcion: "", titulo: "", suplemento: 0, alergenos: [], active: true, has_foto: false },
        ],
        total: 1,
      }),
      categories: {
        list: async () => ({ success: true, categories: [] }),
      },
    },
    bebidas: {
      list: async () => ({ success: true, items: [], total: 0 }),
      categories: {
        list: async () => ({ success: true, categories: [] }),
      },
    },
    cafes: {
      list: async () => ({ success: true, items: [], total: 0 }),
    },
    vinos: {
      list: async () => ({ success: true, vinos: [], total: 0 }),
    },
    postres: {
      list: async () => ({ success: true, postres: [], total: 0 }),
    },
  },
  settings: {
    getPageVisibility: async () => ({ success: true, cafe_page_active: true, bebidas_page_active: true }),
    setPageVisibility: async () => ({ success: true }),
  },
};

// Mock useToasts
const mockPushToast = vi.fn();
vi.mock("../../../../../ui/feedback/useToasts", () => ({
  useToasts: () => ({ pushToast: mockPushToast }),
}));

// Mock createClient
vi.mock("../../../../../api/client", () => ({
  createClient: () => mockApi,
}));

// Mock useComidaAIUnified
vi.mock("../../_components/hooks/useComidaAIUnified", () => ({
  useComidaAIUnified: () => {},
}));

describe("useFoodTypePage", () => {
  const defaultData = {
    foodType: "platos" as const,
    items: [],
    categories: [],
    page: 1,
    pageSize: 24,
    total: 0,
    filters: { search: "", tipo: "", active: "all" as const, category: "", alergeno: "", suplemento: "all" as const },
    error: null,
  };

  it("returns items from the hook (regression: items was missing from return)", async () => {
    const { result } = renderHook(() => useFoodTypePage({ data: defaultData }));

    // Initially should have empty items from SSR data
    expect(result.current.items).toBeDefined();
    expect(Array.isArray(result.current.items)).toBe(true);

    // Wait for the API call to complete
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    }, { timeout: 5000 });

    // After load, items should be populated
    expect(result.current.items.length).toBe(1);
    expect(result.current.items[0].nombre).toBe("Test Plato");
    expect(result.current.total).toBe(1);
  });

  it("returns categories", async () => {
    const { result } = renderHook(() => useFoodTypePage({ data: defaultData }));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    }, { timeout: 5000 });

    // categories should be defined (even if empty)
    expect(result.current.categories).toBeDefined();
    expect(Array.isArray(result.current.categories)).toBe(true);
  });

  it("shows loading state initially", () => {
    const { result } = renderHook(() => useFoodTypePage({ data: defaultData }));
    expect(result.current.loading).toBe(true);
  });

  it.each(["bebidas", "cafes", "vinos"] as const)("opens %s create modal", async (foodType) => {
    const { result } = renderHook(() => useFoodTypePage({ data: { ...defaultData, foodType } as any }));
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.onOpenCreate());

    expect(result.current.modalOpen).toBe(true);
    expect(result.current.editingItem).toBeNull();
  });
});
