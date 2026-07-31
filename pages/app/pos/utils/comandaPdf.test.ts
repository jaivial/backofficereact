import { beforeEach, describe, expect, it, vi } from "vitest";

import { downloadComandaPdf } from "./comandaPdf";
import type { Ticket, Visit } from "../types/register";

const texts: string[] = [];
const saved: string[] = [];
const options: Record<string, unknown>[] = [];
const images: unknown[][] = [];
let pages = 1;

vi.mock("jspdf", () => ({
  jsPDF: class {
    constructor(config: Record<string, unknown>) { options.push(config); }
    setFontSize() { return this; }
    setFont() { return this; }
    line() { return this; }
    splitTextToSize(value: string, width: number) {
      const size = Math.max(Math.floor(width * 2), 1);
      const chunks: string[] = [];
      for (let index = 0; index < value.length; index += size) chunks.push(value.slice(index, index + size));
      return chunks.length ? chunks : [""];
    }
    text(value: string | string[]) { for (const entry of Array.isArray(value) ? value : [value]) texts.push(entry); return this; }
    addImage(...args: unknown[]) { images.push(args); return this; }
    addPage() { pages += 1; return this; }
    save(name: string) { saved.push(name); return this; }
  },
}));

function stubImage(behaviour: "load" | "error") {
  vi.stubGlobal("Image", class {
    width = 200;
    height = 100;
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    set src(_value: string) {
      queueMicrotask(() => (behaviour === "load" ? this.onload?.() : this.onerror?.()));
    }
  });
}

const ticket = (overrides: Partial<Ticket> = {}): Ticket => ({
  id: 11,
  ticketNumber: "TPV-20260730-0001",
  version: 3,
  status: "OPEN",
  totalGrossCents: 2150,
  subtotalGrossCents: 2150,
  lines: [
    { id: 12, productId: 3, productName: "Agua", quantity: 2, unitPriceGrossCents: 250, lineTotalGrossCents: 500, vatRate: 10, status: "ACTIVE" },
    { id: 13, productId: 4, productName: "Arroz a banda", quantity: 1, unitPriceGrossCents: 1650, lineTotalGrossCents: 1650, vatRate: 10, status: "ACTIVE", notes: "Sin cebolla", tagIds: [2, 9] },
    { id: 14, productId: 6, productName: "Café solo", quantity: 1, unitPriceGrossCents: 160, lineTotalGrossCents: 160, vatRate: 10, status: "VOIDED" },
  ],
  ...overrides,
});

const visit = (overrides: Partial<Visit> = {}): Visit => ({ id: 10, channel: "DINE_IN", tableId: 7, tableName: "Mesa 1", covers: 4, status: "OPEN", ...overrides });

const restaurant = { name: "Alqueria Villa Carmen", taxId: "B12345678", address: "Carrer de la Séquia 2", phone: "+34692747052", logoUrl: "https://cdn.test/logo.webp" };

const input = (overrides: Record<string, unknown> = {}) => ({
  generatedAt: new Date("2026-07-30T13:45:00.000Z"),
  ticket: ticket(),
  visit: visit(),
  restaurant,
  tagNamesById: { 2: "Sin gluten" },
  ...overrides,
});

describe("downloadComandaPdf", () => {
  beforeEach(() => {
    texts.length = 0; saved.length = 0; options.length = 0; images.length = 0; pages = 1;
    stubImage("load");
  });

  it("prints the restaurant logo at the top on an A6 page", async () => {
    await downloadComandaPdf(input());
    expect(options[0]).toMatchObject({ format: "a6", orientation: "portrait", unit: "mm" });
    expect(images).toHaveLength(1);
    expect(texts).not.toContain("COMANDA");
  });

  it("falls back to the Comanda title when there is no logo", async () => {
    await downloadComandaPdf(input({ restaurant: { ...restaurant, logoUrl: "" } }));
    expect(images).toHaveLength(0);
    expect(texts).toContain("COMANDA");
  });

  it("falls back to the Comanda title when the logo cannot be loaded", async () => {
    stubImage("error");
    await downloadComandaPdf(input());
    expect(images).toHaveLength(0);
    expect(texts).toContain("COMANDA");
  });

  it("renders restaurant name, tax id, address and phone under the logo", async () => {
    await downloadComandaPdf(input());
    expect(texts).toContain("Alqueria Villa Carmen");
    expect(texts).toContain("CIF/NIF: B12345678");
    expect(texts).toContain("Carrer de la Séquia 2");
    expect(texts).toContain("Tel. +34692747052");
  });

  it("omits restaurant rows that are not configured", async () => {
    await downloadComandaPdf(input({ restaurant: { name: "Solo Nombre" } }));
    const joined = texts.join("|");
    expect(joined).toContain("Solo Nombre");
    expect(joined).not.toContain("CIF/NIF:");
    expect(joined).not.toContain("Tel.");
  });

  it("renders the ticket number and date/time", async () => {
    await downloadComandaPdf(input());
    expect(texts).toContain("TPV-20260730-0001");
    expect(texts.join("|")).toContain("30/7/2026");
  });

  it("renders visit context with table, covers and customer", async () => {
    await downloadComandaPdf(input({ visit: visit({ customerName: "Ana Ruiz" }), operatorName: "Luis" }));
    const joined = texts.join("|");
    expect(joined).toContain("Mesa 1");
    expect(joined).toContain("4");
    expect(joined).toContain("Ana Ruiz");
    expect(joined).toContain("Luis");
  });

  it("omits customer and employee rows when they are unknown", async () => {
    await downloadComandaPdf(input());
    const joined = texts.join("|");
    expect(joined).not.toContain("Cliente:");
    expect(joined).not.toContain("Atendido por:");
  });

  it("labels tableless visits by channel", async () => {
    await downloadComandaPdf(input({ visit: visit({ channel: "BAR", tableId: null, tableName: undefined, covers: 0 }) }));
    expect(texts.join("|")).toContain("Barra");
  });

  it("renders active lines with quantity, product, unit price and total", async () => {
    await downloadComandaPdf(input());
    const joined = texts.join("|");
    expect(joined).toContain("Agua");
    expect(joined).toContain("Arroz a banda");
    expect(joined).toContain("2,50");
    expect(joined).toContain("16,50");
  });

  it("excludes voided lines", async () => {
    await downloadComandaPdf(input());
    expect(texts.join("|")).not.toContain("Café solo");
  });

  it("renders notes and resolved tag names, ignoring unknown tags", async () => {
    await downloadComandaPdf(input());
    expect(texts.join("|")).toContain("Sin cebolla");
    expect(texts).toContain("Etiquetas: Sin gluten");
  });

  it("marks comped lines as invited with a zero charge", async () => {
    const comped = ticket({ lines: [{ id: 12, productName: "Agua", quantity: 1, unitPriceGrossCents: 250, lineTotalGrossCents: 0, vatRate: 10, status: "ACTIVE", comped: true, compReason: "Invitación de la casa" }], totalGrossCents: 0 });
    await downloadComandaPdf(input({ ticket: comped }));
    const joined = texts.join("|");
    expect(joined).toContain("INVITADA");
    expect(joined).toContain("Invitación de la casa");
    expect(joined).toContain("0,00");
  });

  it("renders discount and surcharge only when they are not zero", async () => {
    await downloadComandaPdf(input());
    expect(texts.join("|")).not.toContain("Descuento");
    texts.length = 0;
    await downloadComandaPdf(input({ ticket: ticket({ discountCents: 100, surchargeCents: 50 }) }));
    const joined = texts.join("|");
    expect(joined).toContain("Descuento");
    expect(joined).toContain("Recargo");
  });

  it("labels the total as VAT included and never prints the tip", async () => {
    await downloadComandaPdf(input({ ticket: ticket({ tipCents: 500 }) }));
    expect(texts).toContain("Total precio final");
    expect(texts.join("|")).toContain("21,50");
    expect(texts.join("|")).not.toContain("Propina");
  });

  it("shows VAT split with base, tax per rate, and final total", async () => {
    await downloadComandaPdf(input());
    expect(texts).toContain("Total sin IVA");
    // 21,50 € gross at 10% => base 19,55 € and tax 1,95 €.
    expect(texts).toContain("IVA 10%");
    expect(texts.join("|")).toContain("19,55");
    expect(texts.join("|")).toContain("1,95");
    expect(texts).toContain("Total precio final");
  });

  it("shows each VAT rate separately when multiple rates exist", async () => {
    const mixed = ticket({
      lines: [
        { id: 12, productName: "Agua", quantity: 1, unitPriceGrossCents: 1000, lineTotalGrossCents: 1000, vatRate: 10, status: "ACTIVE" },
        { id: 13, productName: "Vino", quantity: 1, unitPriceGrossCents: 1000, lineTotalGrossCents: 1000, vatRate: 21, status: "ACTIVE" },
      ],
      subtotalGrossCents: 2000,
      discountCents: 200,
      totalGrossCents: 1800,
    });
    await downloadComandaPdf(input({ ticket: mixed }));
    expect(texts).toContain("IVA 10%");
    expect(texts).toContain("IVA 21%");
    // Bases plus taxes must add up to the ticket total, never to the pre-discount subtotal.
    const amounts = texts.filter((entry) => entry.includes("€")).map((entry) => Number(entry.replace(/[^\d,]/g, "").replace(",", ".")));
    expect(amounts).toContain(18);
  });

  it("omits the VAT section when no line carries a rate", async () => {
    const noVat = ticket({ lines: [{ id: 12, productName: "Agua", quantity: 1, unitPriceGrossCents: 250, lineTotalGrossCents: 250, status: "ACTIVE" }], totalGrossCents: 250 });
    await downloadComandaPdf(input({ ticket: noVat }));
    expect(texts).not.toContain("Total sin IVA");
  });

  it("closes with a greeting message", async () => {
    await downloadComandaPdf(input());
    expect(texts.join("|")).toContain("Gracias por su visita");
  });

  it("saves the file using the sanitized ticket number", async () => {
    await downloadComandaPdf(input());
    expect(saved).toEqual(["comanda-TPV-20260730-0001.pdf"]);
  });

  it("falls back to the ticket id when there is no ticket number", async () => {
    await downloadComandaPdf(input({ ticket: ticket({ ticketNumber: undefined }) }));
    expect(saved).toEqual(["comanda-ticket-11.pdf"]);
  });

  it("adds pages when the lines do not fit on one page", async () => {
    const many = ticket({
      lines: Array.from({ length: 40 }, (_, index) => ({ id: 100 + index, productName: `Producto ${index}`, quantity: 1, unitPriceGrossCents: 100, lineTotalGrossCents: 100, vatRate: 10, status: "ACTIVE" })),
    });
    await downloadComandaPdf(input({ ticket: many }));
    expect(pages).toBeGreaterThan(1);
  });

  it("rejects a ticket without active lines and does not download", async () => {
    await expect(downloadComandaPdf(input({ ticket: ticket({ lines: [] }) }))).rejects.toThrow();
    expect(saved).toEqual([]);
  });

  it("never mutates the ticket or visit", async () => {
    const payload = input();
    const snapshot = JSON.stringify(payload);
    await downloadComandaPdf(payload);
    expect(JSON.stringify(payload)).toBe(snapshot);
  });
});
