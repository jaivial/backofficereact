import type { RestaurantProfile, Ticket, TicketLine, Visit } from "../types/register";

export type ComandaPdfInput = {
  generatedAt: Date;
  ticket: Ticket;
  visit: Visit;
  restaurant?: RestaurantProfile | null;
  operatorName?: string;
  tagNamesById?: Record<number, string>;
};

const PAGE_WIDTH = 105;
const PAGE_HEIGHT = 148;
const MARGIN = 8;
const CENTER_X = PAGE_WIDTH / 2;
const BOTTOM_LIMIT = PAGE_HEIGHT - MARGIN;
const LINE_STEP = 4;
const LINE_STEP_SMALL = 3.5;
const LOGO_WIDTH = 32;
const LOGO_MAX_HEIGHT = 20;
const QUANTITY_X = MARGIN;
const PRODUCT_X = MARGIN + 9;
const UNIT_X = PAGE_WIDTH - MARGIN - 22;
const TOTAL_X = PAGE_WIDTH - MARGIN;
const PRODUCT_WIDTH = UNIT_X - PRODUCT_X - 2;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const GRAY_LIGHT = "#f5f5f5";
const GRAY_RULE = "#cccccc";

const CHANNEL_LABELS: Record<string, string> = { BAR: "Barra", TAKEAWAY: "Para llevar", DELIVERY: "A domicilio", DINE_IN: "Sala" };
const GREETING = "Gracias por su visita. ¡Hasta pronto!";

function money(cents: number): string {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format((cents || 0) / 100);
}

function quantity(value: number): string {
  return new Intl.NumberFormat("es-ES", { maximumFractionDigits: 3 }).format(value);
}

function rateLabel(rate: number): string {
  return new Intl.NumberFormat("es-ES", { maximumFractionDigits: 2 }).format(rate);
}

function ticketLabel(ticket: Ticket): string {
  return ticket.ticketNumber?.trim() || `ticket-${ticket.id}`;
}

function visitLabel(visit: Visit): string {
  return visit.tableName?.trim() || CHANNEL_LABELS[visit.channel || ""] || visit.channel || `Visita ${visit.id}`;
}

function lineExtras(line: TicketLine, tagNamesById: Record<number, string>): string[] {
  const extras: string[] = [];
  if (line.comped) extras.push(line.compReason?.trim() ? `INVITADA · ${line.compReason.trim()}` : "INVITADA");
  if (line.notes?.trim()) extras.push(`Nota: ${line.notes.trim()}`);
  const tagNames = (line.tagIds || []).map((id) => tagNamesById[id]).filter((name): name is string => Boolean(name));
  if (tagNames.length) extras.push(`Etiquetas: ${tagNames.join(", ")}`);
  return extras;
}

/**
 * Splits the charged total across the VAT rates present on the ticket. Line
 * gross amounts are scaled to the ticket total so ticket-level discounts and
 * surcharges stay inside the breakdown, and the last rate absorbs the rounding
 * remainder so bases plus taxes always add up to the printed total.
 */
export function vatBreakdown(lines: TicketLine[], totalGrossCents: number): Array<{ rate: number; baseCents: number; taxCents: number }> {
  const grossByRate = new Map<number, number>();
  let linesGross = 0;
  for (const line of lines) {
    if (!line.vatRate) continue;
    grossByRate.set(line.vatRate, (grossByRate.get(line.vatRate) || 0) + line.lineTotalGrossCents);
    linesGross += line.lineTotalGrossCents;
  }
  if (!grossByRate.size || linesGross <= 0 || totalGrossCents <= 0) return [];

  const rates = [...grossByRate.keys()].sort((a, b) => a - b);
  let remaining = totalGrossCents;
  return rates.map((rate, index) => {
    const gross = index === rates.length - 1 ? remaining : Math.round((grossByRate.get(rate) || 0) * totalGrossCents / linesGross);
    remaining -= gross;
    const baseCents = Math.round(gross / (1 + rate / 100));
    return { rate, baseCents, taxCents: gross - baseCents };
  });
}

function loadLogo(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image();
    let settled = false;
    const finish = (value: HTMLImageElement | null) => { if (!settled) { settled = true; resolve(value); } };
    const timer = setTimeout(() => finish(null), 2500);
    image.crossOrigin = "anonymous";
    image.onload = () => { clearTimeout(timer); finish(image); };
    image.onerror = () => { clearTimeout(timer); finish(null); };
    image.src = src;
  });
}

function logoFormat(src: string): string {
  const extension = src.split("?")[0]?.split(".").pop()?.toUpperCase() || "";
  return ["PNG", "JPEG", "JPG", "WEBP"].includes(extension) ? (extension === "JPG" ? "JPEG" : extension) : "PNG";
}

export async function downloadComandaPdf(input: ComandaPdfInput): Promise<void> {
  const activeLines = input.ticket.lines.filter((line) => line.status !== "VOIDED");
  if (!activeLines.length) throw new Error("La comanda no tiene líneas activas.");

  const tagNamesById = input.tagNamesById || {};
  const restaurant = input.restaurant || null;
  const logo = restaurant?.logoUrl?.trim() ? await loadLogo(restaurant.logoUrl.trim()) : null;
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a6" });
  let cursor = MARGIN;

  const setTextColor = (color: string) => { if (typeof doc.setTextColor === "function") doc.setTextColor(color); };
  const setFillColor = (color: string) => { if (typeof doc.setFillColor === "function") doc.setFillColor(color); };
  const setDrawColor = (color: string) => { if (typeof doc.setDrawColor === "function") doc.setDrawColor(color); };
  const setLineWidth = (width: number) => { if (typeof doc.setLineWidth === "function") doc.setLineWidth(width); };
  const rect = (x: number, y: number, w: number, h: number, style: string) => { if (typeof doc.rect === "function") doc.rect(x, y, w, h, style); };

  const write = (value: string, x: number, options?: { align?: "right" | "center"; size?: number; bold?: boolean; italic?: boolean; color?: string }) => {
    doc.setFontSize(options?.size || 9);
    doc.setFont("helvetica", options?.bold ? "bold" : options?.italic ? "oblique" : "normal");
    setTextColor(options?.color || "#000000");
    doc.text(value, x, cursor, options?.align ? { align: options.align } : undefined);
    setTextColor("#000000");
  };

  const rule = (style: "single" | "double" | "thick" = "single") => {
    setDrawColor(GRAY_RULE);
    if (style === "double") {
      setLineWidth(0.2);
      doc.line(MARGIN, cursor, PAGE_WIDTH - MARGIN, cursor);
      doc.line(MARGIN, cursor + 1, PAGE_WIDTH - MARGIN, cursor + 1);
      cursor += LINE_STEP + 1;
    } else if (style === "thick") {
      setLineWidth(0.5);
      doc.line(MARGIN, cursor, PAGE_WIDTH - MARGIN, cursor);
      cursor += LINE_STEP;
    } else {
      setLineWidth(0.2);
      doc.line(MARGIN, cursor, PAGE_WIDTH - MARGIN, cursor);
      cursor += LINE_STEP;
    }
    setDrawColor("#000000");
    setLineWidth(0.2);
  };

  const rowBg = (height: number, fill = GRAY_LIGHT) => {
    setFillColor(fill);
    rect(MARGIN, cursor - 3, CONTENT_WIDTH, height, "F");
  };

  const breakPage = (needed: number) => {
    if (cursor + needed <= BOTTOM_LIMIT) return;
    doc.addPage();
    cursor = MARGIN;
    write(`${ticketLabel(input.ticket)} (cont.)`, MARGIN, { size: 8, bold: true });
    cursor += LINE_STEP + 1;
  };

  if (logo) {
    const height = Math.min(LOGO_WIDTH * (logo.height / logo.width || 0.5), LOGO_MAX_HEIGHT);
    doc.addImage(logo, logoFormat(restaurant?.logoUrl || ""), CENTER_X - LOGO_WIDTH / 2, cursor, LOGO_WIDTH, height);
    cursor += height + 4;
  } else {
    write("COMANDA", CENTER_X, { size: 16, bold: true, align: "center" });
    cursor += 6;
  }

  if (restaurant?.name?.trim()) { write(restaurant.name.trim(), CENTER_X, { size: 11, bold: true, align: "center" }); cursor += LINE_STEP + 0.5; }
  if (restaurant?.taxId?.trim()) { write(`CIF/NIF: ${restaurant.taxId.trim()}`, CENTER_X, { size: 7, align: "center", color: "#555555" }); cursor += LINE_STEP_SMALL; }
  if (restaurant?.address?.trim()) {
    for (const row of doc.splitTextToSize(restaurant.address.trim(), CONTENT_WIDTH) as string[]) { write(row, CENTER_X, { size: 7, align: "center", color: "#555555" }); cursor += LINE_STEP_SMALL; }
  }
  if (restaurant?.phone?.trim()) { write(`Tel. ${restaurant.phone.trim()}`, CENTER_X, { size: 7, align: "center", color: "#555555" }); cursor += LINE_STEP_SMALL; }
  cursor += 2;

  rule("double");
  const dateStr = input.generatedAt.toLocaleDateString("es-ES");
  const timeStr = input.generatedAt.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
  write(ticketLabel(input.ticket), MARGIN, { size: 9, bold: true });
  write(`${dateStr} ${timeStr}`, TOTAL_X, { size: 8, align: "right" });
  cursor += LINE_STEP;
  rule();

  write(visitLabel(input.visit), MARGIN, { size: 10, bold: true });
  cursor += LINE_STEP;
  const visitDetails: string[] = [];
  if (input.visit.covers > 0) visitDetails.push(`${input.visit.covers} pax`);
  if (input.visit.customerName?.trim()) visitDetails.push(input.visit.customerName.trim());
  if (visitDetails.length) { write(visitDetails.join(" · "), MARGIN, { size: 8, color: "#444444" }); cursor += LINE_STEP; }
  if (input.operatorName?.trim()) { write(`Atendido por: ${input.operatorName.trim()}`, MARGIN, { size: 7, italic: true, color: "#666666" }); cursor += LINE_STEP_SMALL; }
  cursor += 2;

  rule("thick");
  rowBg(LINE_STEP, "#e8e8e8");
  write("Ud", QUANTITY_X, { size: 7, bold: true });
  write("Producto", PRODUCT_X, { size: 7, bold: true });
  write("P.Unit", UNIT_X, { size: 7, bold: true });
  write("Total", TOTAL_X, { size: 7, bold: true, align: "right" });
  cursor += LINE_STEP;
  rule();

  let lineIndex = 0;
  for (const line of activeLines) {
    const nameRows: string[] = doc.splitTextToSize(line.productName, PRODUCT_WIDTH);
    const extras = lineExtras(line, tagNamesById);
    const rowHeight = (nameRows.length + extras.length) * LINE_STEP;
    breakPage(rowHeight);

    if (lineIndex % 2 === 1) rowBg(rowHeight);

    write(quantity(line.quantity), QUANTITY_X, { size: 8, bold: true });
    write(nameRows[0] || "", PRODUCT_X, { size: 8 });
    write(money(line.unitPriceGrossCents), UNIT_X, { size: 8, color: "#666666" });
    write(money(line.lineTotalGrossCents), TOTAL_X, { size: 8, bold: true, align: "right" });
    cursor += LINE_STEP;
    for (const row of nameRows.slice(1)) { write(row, PRODUCT_X, { size: 8 }); cursor += LINE_STEP; }
    for (const extra of extras) {
      for (const row of doc.splitTextToSize(extra, PRODUCT_WIDTH) as string[]) { write(row, PRODUCT_X, { size: 7, italic: true, color: "#555555" }); cursor += LINE_STEP; }
    }
    lineIndex++;
  }

  const breakdown = vatBreakdown(activeLines, input.ticket.totalGrossCents);
  const totalBaseCents = breakdown.reduce((sum, entry) => sum + entry.baseCents, 0);
  const totalTaxCents = breakdown.reduce((sum, entry) => sum + entry.taxCents, 0);
  const hasVat = breakdown.length > 0;

  const totalsHeight = LINE_STEP * (5 + (input.ticket.discountCents ? 1 : 0) + (input.ticket.surchargeCents ? 1 : 0) + (hasVat ? breakdown.length + 1 : 0));
  breakPage(totalsHeight);
  cursor += 2;
  rule("thick");

  if (input.ticket.discountCents) {
    write("Descuento", MARGIN, { size: 8, color: "#444444" });
    write(`-${money(input.ticket.discountCents)}`, TOTAL_X, { size: 8, align: "right", color: "#009900" });
    cursor += LINE_STEP;
  }
  if (input.ticket.surchargeCents) {
    write("Recargo", MARGIN, { size: 8, color: "#444444" });
    write(money(input.ticket.surchargeCents), TOTAL_X, { size: 8, align: "right" });
    cursor += LINE_STEP;
  }

  if (hasVat) {
    write("Total sin IVA", MARGIN, { size: 8 });
    write(money(totalBaseCents), TOTAL_X, { size: 8, align: "right" });
    cursor += LINE_STEP;
    for (const entry of breakdown) {
      write(`IVA ${rateLabel(entry.rate)}%`, MARGIN, { size: 8 });
      write(money(entry.taxCents), TOTAL_X, { size: 8, align: "right" });
      cursor += LINE_STEP;
    }
  }

  cursor += 1;
  rowBg(LINE_STEP + 2, "#e0e0e0");
  write("Total precio final", MARGIN, { size: 11, bold: true });
  write(money(input.ticket.totalGrossCents), TOTAL_X, { size: 11, bold: true, align: "right" });
  cursor += LINE_STEP + 3;

  breakPage(LINE_STEP);
  rule();
  write(GREETING, CENTER_X, { size: 8, italic: true, align: "center", color: "#555555" });

  doc.save(`comanda-${ticketLabel(input.ticket).replace(/[^\w.-]+/g, "-")}.pdf`);
}
