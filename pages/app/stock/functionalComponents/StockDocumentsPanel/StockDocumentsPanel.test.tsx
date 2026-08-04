import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { StockDocumentsPanel } from "./StockDocumentsPanel";

vi.mock("lucide-react", () => ({
  FileScan: () => React.createElement("span", { "data-testid": "file-scan-icon" }),
  X: () => React.createElement("span", { "data-testid": "x-icon" }),
}));

const items = [{ id: 1, name: "Harina", displayUnit: { id: 2, code: "kg", label: "kg", factorToBase: 1000 } }];
const warehouses = [{ id: 7, name: "Principal", isDefault: true }];

const document = {
  id: 9,
  documentType: "INVOICE",
  source: "UPLOAD",
  status: "NEEDS_REVIEW",
  supplierName: "Proveedor",
  documentNumber: "F-1",
  documentDate: "2026-08-19",
  confidence: 0.91,
  model: "PaddleOCR-VL-1.6",
  originalAvailable: true,
  lines: [{ id: 11, lineNo: 1, description: "HARINA 25 KG", code: "HAR25", quantity: 1, unit: "saco", unitPrice: 20, total: 20, confidence: 0.9, status: "NEEDS_MATCH" }],
};

describe("StockDocumentsPanel", () => {
  beforeEach(() => {
    vi.stubGlobal("crypto", { randomUUID: () => "uuid" });
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/documents") && !init?.method) return new Response(JSON.stringify({ success: true, documents: [{ ...document, lines: undefined }] }));
      if (url.endsWith("/documents/9")) return new Response(JSON.stringify({ success: true, document }));
      if (url.endsWith("/documents/upload")) return new Response(JSON.stringify({ success: true, id: 9, extraction: {}, needsReview: true }), { status: 201 });
      if (url.includes("/review")) return new Response(JSON.stringify({ success: true }));
      if (url.includes("/confirm-invoice")) return new Response(JSON.stringify({ success: true, linesApplied: 1 }), { status: 201 });
      return new Response(JSON.stringify({ success: false, message: "Not found" }), { status: 404 });
    }));
  });

  it("uploads multimodal document with multipart form", async () => {
    render(<StockDocumentsPanel items={items} warehouses={warehouses} />);
    const file = new File(["image"], "invoice.png", { type: "image/png" });
    fireEvent.change(screen.getByTestId("stock-ocr-file"), { target: { files: [file] } });
    fireEvent.click(screen.getByTestId("stock-ocr-upload"));
    await waitFor(() => expect(fetch).toHaveBeenCalledWith(
      "/api/admin/stock/documents/upload",
      expect.objectContaining({ method: "POST", body: expect.any(FormData) }),
    ));
  });

  it("maps extracted line then confirms invoice", async () => {
    render(<StockDocumentsPanel items={items} warehouses={warehouses} />);
    fireEvent.click(await screen.findByTestId("stock-ocr-open-9"));
    await screen.findByText("HARINA 25 KG");
    fireEvent.change(screen.getByTestId("stock-ocr-item-11"), { target: { value: "1" } });
    fireEvent.click(screen.getByTestId("stock-ocr-save-review"));
    await waitFor(() => expect(fetch).toHaveBeenCalledWith(
      "/api/admin/stock/documents/9/review",
      expect.objectContaining({ method: "PATCH" }),
    ));
    fireEvent.click(screen.getByTestId("stock-ocr-confirm"));
    await waitFor(() => expect(fetch).toHaveBeenCalledWith(
      "/api/admin/stock/documents/9/confirm-invoice",
      expect.objectContaining({ method: "POST" }),
    ));
  });

  it("shows private original download and delete controls", async () => {
    render(<StockDocumentsPanel items={items} warehouses={warehouses} />);
    fireEvent.click(await screen.findByTestId("stock-ocr-open-9"));
    expect(await screen.findByTestId("stock-ocr-original-download")).toHaveAttribute("href", "/api/admin/stock/documents/9/original");
    expect(screen.getByTestId("stock-ocr-original-delete")).toBeInTheDocument();
  });

  it("shows extraction model provenance during review", async () => {
    render(<StockDocumentsPanel items={items} warehouses={warehouses} />);
    fireEvent.click(await screen.findByTestId("stock-ocr-open-9"));
    expect(await screen.findByText("Confianza PaddleOCR-VL-1.6: 91%")).toBeInTheDocument();
  });

  it("confirms reviewed OCR recipe", async () => {
    const recipeDocument = { ...document, documentType: "RECIPE", supplierName: "", documentNumber: "", extraction: { name: "Masa", yieldQuantity: 2 }, lines: document.lines };
    vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/documents") && !init?.method) return new Response(JSON.stringify({ success: true, documents: [{ ...recipeDocument, lines: undefined }] }));
      if (url.endsWith("/documents/9")) return new Response(JSON.stringify({ success: true, document: recipeDocument }));
      if (url.includes("/review")) return new Response(JSON.stringify({ success: true }));
      if (url.includes("/confirm-recipe")) return new Response(JSON.stringify({ success: true, recipeId: 3 }), { status: 201 });
      return new Response(JSON.stringify({ success: false }), { status: 404 });
    });
    render(<StockDocumentsPanel items={items} warehouses={warehouses} />);
    fireEvent.click(await screen.findByTestId("stock-ocr-open-9"));
    await screen.findByText("HARINA 25 KG");
    fireEvent.change(screen.getByTestId("stock-ocr-item-11"), { target: { value: "1" } });
    fireEvent.change(screen.getByTestId("stock-ocr-recipe-output"), { target: { value: "1" } });
    fireEvent.click(screen.getByTestId("stock-ocr-confirm-recipe"));
    await waitFor(() => expect(fetch).toHaveBeenCalledWith(
      "/api/admin/stock/documents/9/confirm-recipe",
      expect.objectContaining({ method: "POST" }),
    ));
  });
});
