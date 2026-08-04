import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { PortionWastePanel } from "./PortionWastePanel";

const ITEMS = [
  { id: 1, name: "Paella (racion)", displayUnit: { id: 10, label: "ud", factorToBase: 1 } },
  { id: 2, name: "Salsa base", displayUnit: { id: 11, label: "ml", factorToBase: 1 } },
];
const WAREHOUSES = [{ id: 5, name: "Cocina" }];

function mockApi(onPost?: (body: unknown) => unknown) {
  global.fetch = vi.fn(async (url: string, init?: RequestInit) => {
    const href = String(url);
    if (init?.method === "POST") {
      const parsed = init.body ? JSON.parse(String(init.body)) : {};
      const result = onPost?.(parsed);
      return { ok: true, json: async () => result ?? { success: true } };
    }
    if (href.includes("/warehouses")) {
      return { ok: true, json: async () => ({ success: true, warehouses: WAREHOUSES }) };
    }
    return { ok: true, json: async () => ({ success: true, items: ITEMS }) };
  }) as unknown as typeof fetch;
}

describe("PortionWastePanel", () => {
  beforeEach(() => mockApi());

  it("requires a reason so waste can be analysed later", async () => {
    render(<PortionWastePanel />);
    await waitFor(() => expect(screen.getByTestId("portion-waste-item")).toBeTruthy());

    const reason = screen.getByTestId("portion-waste-reason") as HTMLSelectElement;
    // Every option must be a real reason; a blank default would let users record
    // waste with no cause, which makes the report useless.
    expect(reason.value).not.toBe("");
  });

  it("refuses a non-positive quantity instead of writing a meaningless movement", async () => {
    const posted: unknown[] = [];
    mockApi((body) => {
      posted.push(body);
      return { success: true };
    });
    render(<PortionWastePanel />);
    await waitFor(() => expect(screen.getByTestId("portion-waste-item")).toBeTruthy());

    fireEvent.change(screen.getByTestId("portion-waste-quantity"), { target: { value: "0" } });
    fireEvent.click(screen.getByRole("button", { name: /registrar merma/i }));

    await waitFor(() => expect(screen.getByText(/mayor que cero/i)).toBeTruthy());
    expect(posted).toHaveLength(0);
  });

  // Waste removes stock, so the quantity must be sent negative. Sending it
  // positive would ADD the wasted portions back to inventory.
  it("records waste as a negative movement", async () => {
    const posted: Record<string, unknown>[] = [];
    mockApi((body) => {
      posted.push(body as Record<string, unknown>);
      return { success: true };
    });
    render(<PortionWastePanel />);
    await waitFor(() => expect(screen.getByTestId("portion-waste-item")).toBeTruthy());

    fireEvent.change(screen.getByTestId("portion-waste-quantity"), { target: { value: "3" } });
    fireEvent.click(screen.getByRole("button", { name: /registrar merma/i }));

    await waitFor(() => expect(posted).toHaveLength(1));
    expect(posted[0].quantity).toBe(-3);
    expect(posted[0].type).toBe("WASTE");
    expect(posted[0].wasteReason).toBeTruthy();
  });

  // A retry must not deduct the same portions twice.
  it("sends an idempotency key with every submission", async () => {
    const posted: Record<string, unknown>[] = [];
    mockApi((body) => {
      posted.push(body as Record<string, unknown>);
      return { success: true };
    });
    render(<PortionWastePanel />);
    await waitFor(() => expect(screen.getByTestId("portion-waste-item")).toBeTruthy());

    fireEvent.change(screen.getByTestId("portion-waste-quantity"), { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: /registrar merma/i }));

    await waitFor(() => expect(posted).toHaveLength(1));
    expect(String(posted[0].idempotencyKey ?? "")).not.toBe("");
  });

  it("shows the server's rejection instead of pretending it worked", async () => {
    global.fetch = vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === "POST") {
        return { ok: false, json: async () => ({ success: false, message: "Stock insuficiente" }) };
      }
      if (String(url).includes("/warehouses")) {
        return { ok: true, json: async () => ({ success: true, warehouses: WAREHOUSES }) };
      }
      return { ok: true, json: async () => ({ success: true, items: ITEMS }) };
    }) as unknown as typeof fetch;

    render(<PortionWastePanel />);
    await waitFor(() => expect(screen.getByTestId("portion-waste-item")).toBeTruthy());
    fireEvent.change(screen.getByTestId("portion-waste-quantity"), { target: { value: "1" } });
    fireEvent.click(screen.getByRole("button", { name: /registrar merma/i }));

    await waitFor(() => expect(screen.getByText(/stock insuficiente/i)).toBeTruthy());
  });
});
