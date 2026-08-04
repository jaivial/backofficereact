import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { KitchenDisplay } from "./KitchenDisplay";

vi.mock("lucide-react", () => ({ RefreshCw: () => React.createElement("span", { "data-testid": "refresh-icon" }) }));

describe("KitchenDisplay", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/kitchen/queue")) return new Response(JSON.stringify({ success: true, items: [{ id: 4, ticketNumber: "TPV-4", tableName: "Mesa 2", status: "PENDING", createdAt: "2026-07-27T12:00:00Z", lines: [{ id: 8, productName: "Paella", quantity: 2, action: "ADD" }] }] }));
      if (url.endsWith("/kitchen/dispatches/4/status") && init?.method === "POST") return new Response(JSON.stringify({ success: true }));
      return new Response(JSON.stringify({ success: true, items: [] }));
    }));
  });

  it("renders dispatch and marks it ready", async () => {
    render(<KitchenDisplay />);
    expect(await screen.findByText("Paella × 2")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("kds-ready-4"));
    await waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/admin/pos/kitchen/dispatches/4/status", expect.objectContaining({ body: JSON.stringify({ status: "READY" }) })));
  });
});
