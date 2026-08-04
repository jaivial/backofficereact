import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { TechnicalSheetPicker } from "./TechnicalSheetPicker";

const SHEETS = [
  { id: 1, name: "Salsa brava", status: "PUBLISHED", portions: 10, imageUrl: "", usageCount: 2 },
  { id: 2, name: "Masa de pizza", status: "DRAFT", portions: 4, imageUrl: "", usageCount: 0 },
];

function mockFetch(overrides: Record<string, unknown> = {}) {
  global.fetch = vi.fn(async (url: string, init?: RequestInit) => {
    const href = String(url);
    if (href.includes("/duplicate")) {
      return { ok: true, json: async () => ({ success: true, sheetId: 99, ...overrides }) };
    }
    if (init?.method === "PATCH") {
      return { ok: true, json: async () => ({ success: true }) };
    }
    return { ok: true, json: async () => ({ success: true, sheets: SHEETS }) };
  }) as unknown as typeof fetch;
}

describe("TechnicalSheetPicker", () => {
  beforeEach(() => mockFetch());

  it("lists the tenant's sheets", async () => {
    render(<TechnicalSheetPicker itemId={5} onLinked={vi.fn()} onClose={vi.fn()} />);
    await waitFor(() => expect(screen.getByText("Salsa brava")).toBeTruthy());
    expect(screen.getByText("Masa de pizza")).toBeTruthy();
  });

  // A sheet already used elsewhere is the dangerous case: editing it after a
  // direct link would change other dishes too.
  it("warns how many products already use a sheet", async () => {
    render(<TechnicalSheetPicker itemId={5} onLinked={vi.fn()} onClose={vi.fn()} />);
    await waitFor(() => expect(screen.getByText("Salsa brava")).toBeTruthy());
    expect(screen.getByText(/2 producto/i)).toBeTruthy();
  });

  it("duplicates the sheet so edits stay local to this product", async () => {
    const calls: string[] = [];
    global.fetch = vi.fn(async (url: string) => {
      calls.push(String(url));
      if (String(url).includes("/duplicate")) {
        return { ok: true, json: async () => ({ success: true, sheetId: 99 }) };
      }
      return { ok: true, json: async () => ({ success: true, sheets: SHEETS }) };
    }) as unknown as typeof fetch;

    const onLinked = vi.fn();
    render(<TechnicalSheetPicker itemId={5} onLinked={onLinked} onClose={vi.fn()} />);
    await waitFor(() => expect(screen.getByText("Salsa brava")).toBeTruthy());

    fireEvent.click(screen.getAllByRole("button", { name: /duplicar y editar/i })[0]);

    await waitFor(() => expect(onLinked).toHaveBeenCalledWith(99));
    expect(calls.some((c) => c.includes("/technical-sheets/1/duplicate"))).toBe(true);
  });

  it("links the original sheet directly when that is what the user chose", async () => {
    const onLinked = vi.fn();
    render(<TechnicalSheetPicker itemId={5} onLinked={onLinked} onClose={vi.fn()} />);
    await waitFor(() => expect(screen.getByText("Masa de pizza")).toBeTruthy());

    fireEvent.click(screen.getAllByRole("button", { name: /vincular directamente/i })[1]);

    await waitFor(() => expect(onLinked).toHaveBeenCalledWith(2));
  });

  it("reports an empty result instead of showing a blank panel", async () => {
    global.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({ success: true, sheets: [] }),
    })) as unknown as typeof fetch;

    render(<TechnicalSheetPicker itemId={5} onLinked={vi.fn()} onClose={vi.fn()} />);
    await waitFor(() => expect(screen.getByText(/no hay fichas/i)).toBeTruthy());
  });
});
