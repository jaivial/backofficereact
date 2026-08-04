import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { POSAdminPanel } from "./POSAdminPanel";

vi.mock("lucide-react", () => ({ Plus: () => React.createElement("span", { "data-testid": "plus-icon" }), RefreshCw: () => React.createElement("span", { "data-testid": "refresh-icon" }) }));

describe("POSAdminPanel", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/products") && init?.method === "POST") return new Response(JSON.stringify({ success: true, id: 8 }), { status: 201 });
      return new Response(JSON.stringify({ success: true, items: [], shift: null }));
    }));
  });
  it("creates a manual POS product", async () => {
    render(<POSAdminPanel mode="catalog" onChanged={() => undefined} />);
    fireEvent.change(screen.getByLabelText("Nombre producto TPV"), { target: { value: "Servicio pan" } });
    fireEvent.change(screen.getByLabelText("Precio producto TPV"), { target: { value: "2.5" } });
    fireEvent.click(screen.getByTestId("pos-admin-create-product"));
    await waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/admin/pos/products", expect.objectContaining({ method: "POST", body: expect.stringContaining('"priceGrossCents":250') })));
  });
});
