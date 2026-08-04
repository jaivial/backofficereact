import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { StockImportPanel } from "./StockImportPanel";

describe("StockImportPanel", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const form = init?.body as FormData;
      if (form.get("confirm") === "1") return new Response(JSON.stringify({ success: true, created: 1, skipped: 0 }), { status: 201 });
      return new Response(JSON.stringify({ success: true, preview: true, validRows: 1, invalidRows: 0, rows: [{ row: 2, name: "Harina", sku: "HAR", dimension: "MASS", unitCode: "kg", unitFactor: 1000, isTracked: true, kind: "RAW", deductionSource: "BOTH_MANUAL" }] }));
    }));
  });

  it("previews then confirms CSV import", async () => {
    const onImported = vi.fn();
    render(<StockImportPanel onImported={onImported} />);
    fireEvent.change(screen.getByTestId("stock-import-file"), { target: { files: [new File(["csv"], "items.csv", { type: "text/csv" })] } });
    fireEvent.click(screen.getByTestId("stock-import-preview"));
    expect(await screen.findByText(/Harina/)).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("stock-import-confirm"));
    await waitFor(() => expect(onImported).toHaveBeenCalledWith());
    expect(screen.getByText("1 artículos creados")).toBeInTheDocument();
  });
});
