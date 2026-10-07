import { money } from "../../hooks/usePOSRegister";
import { vatBreakdown } from "../../utils/comandaPdf";
import type { Ticket, TicketLine } from "../../types/register";
import type { RestaurantProfile, Visit } from "../../types/register";

/**
 * Renders the paid ticket as an 80 mm receipt in a print window of its own.
 *
 * `window.print()` on the till screen prints the whole POS — rail, product grid,
 * the guest's whole table — which is not a receipt. Opening a separate window
 * with nothing but the ticket means the printer gets a strip of paper and not a
 * screenshot of the till.
 *
 * The receipt deliberately shows the IVA breakdown by rate: a Spanish ticket
 * simplificada has to say what it charged and how much of it was tax, and the
 * POS already snapshots the rate per line.
 */
export function printTicketReceipt({ ticket, visit, restaurant, operatorName, generatedAt = new Date() }: {
  ticket: Ticket;
  visit?: Visit | null;
  restaurant?: RestaurantProfile | null;
  operatorName?: string;
  generatedAt?: Date;
}) {
  const topLevel = ticket.lines.filter((line) => !line.parentLineId && line.status !== "VOIDED");
  const componentsByParent = new Map<number, TicketLine[]>();
  for (const line of ticket.lines) {
    if (!line.parentLineId) continue;
    const list = componentsByParent.get(line.parentLineId) ?? [];
    list.push(line);
    componentsByParent.set(line.parentLineId, list);
  }

  // IVA is grouped by rate: two lines at 10% are one "10% x 2" line on the
  // receipt, the way a real till prints it.
  // `vatBreakdown` already knows how the POS stores rates (a whole percent, not
  // a fraction) and keeps the last bucket whole so the parts add back up to the
  // ticket total. Reusing it keeps the receipt and the comanda from drifting.
  const vatRows = vatBreakdown(topLevel, ticket.totalGrossCents)
    .filter((row) => row.taxCents > 0)
    .reverse()
    .map((row) => `<tr class="vat"><td>IVA ${row.rate}%</td><td>${money(row.taxCents)}</td></tr>`)
    .join("");

  const stamp = generatedAt.toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" });
  const address = [restaurant?.address, restaurant?.taxId].filter(Boolean).join(" · ");

  const rows = topLevel.map((line) => {
    const children = componentsByParent.get(line.id) ?? [];
    const unit = line.unitPriceGrossCents ?? 0;
    const childrenTotal = children.reduce((sum, child) => sum + (child.lineTotalGrossCents ?? 0), 0);
    return `<tr class="item"><td class="qty">${line.quantity}</td><td class="name">${escapeHtml(line.productName)}${
      children.length ? `<div class="sub">${children.map((child) => escapeHtml(child.productName)).join("<br>")}</div>` : ""
    }</td><td class="sum">${money(line.lineTotalGrossCents ?? 0)}</td></tr>${
      children.length && childrenTotal
        ? `<tr class="item sub-row"><td class="qty"></td><td class="name sub">Incluye platos</td><td class="sum">${money(childrenTotal)}</td></tr>`
        : ""
    }`;
  });

  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Recibo ${escapeHtml(ticket.ticketNumber ?? "")}</title>
<style>
  @page { size: 80mm auto; margin: 4mm; }
  * { box-sizing: border-box; }
  body { font: 12px/1.35 ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace; margin: 0; color: #000; background: #fff; }
  header { text-align: center; margin-bottom: 6px; }
  header .name { font-size: 14px; font-weight: 700; letter-spacing: 0.02em; }
  header .meta { font-size: 11px; }
  hr { border: 0; border-top: 1px dashed #000; margin: 5px 0; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 1px 0; vertical-align: top; }
  .qty { width: 18px; text-align: right; padding-right: 4px; }
  .name { word-break: break-word; }
  .sum { text-align: right; white-space: nowrap; }
  .item .sub { font-size: 11px; padding-left: 8px; }
  .sub-row td { font-size: 11px; }
  tfoot td { font-weight: 700; }
  .total td { font-size: 15px; padding-top: 3px; }
  .vat td { font-size: 11px; font-weight: 400; }
  footer { text-align: center; margin-top: 8px; font-size: 11px; }
  .thanks { font-weight: 700; margin-bottom: 3px; }
</style></head><body>
<header>
  <div class="name">${escapeHtml(restaurant?.name ?? "Restaurante")}</div>
  ${address ? `<div class="meta">${escapeHtml(address)}</div>` : ""}
</header>
<hr>
<div>Recibo simplificado</div>
<div>${escapeHtml(ticket.ticketNumber ?? "")}</div>
${visit?.tableName ? `<div>Mesa ${escapeHtml(visit.tableName)}${visit.covers ? ` · ${visit.covers} comensales` : ""}</div>` : ""}
<div>${stamp}</div>
${operatorName ? `<div>Atendió: ${escapeHtml(operatorName)}</div>` : ""}
<hr>
<table>
  <tbody>
${rows.join("\n")}
  </tbody>
  <tfoot>
    ${ticket.discountCents ? `<tr><td colspan="2">Descuento</td><td class="sum">-${money(ticket.discountCents)}</td></tr>` : ""}
    ${ticket.surchargeCents ? `<tr><td colspan="2">Recargo</td><td class="sum">${money(ticket.surchargeCents)}</td></tr>` : ""}
    ${vatRows}
    ${ticket.tipCents ? `<tr><td colspan="2">Propina</td><td class="sum">${money(ticket.tipCents)}</td></tr>` : ""}
    <tr class="total"><td colspan="2">TOTAL</td><td class="sum">${money(ticket.totalGrossCents)}</td></tr>
  </tfoot>
</table>
<hr>
<footer>
  <div class="thanks">¡Gracias!</div>
  <div>Conserve este recibo.</div>
</footer>
</body></html>`;

  const printWindow = window.open("", "_blank", "width=340,height=600");
  if (!printWindow) {
    // A popup blocker is the common case on a tablet in kiosk mode; say so
    // rather than printing the till screen as a fallback.
    throw new Error("El navegador bloqueó la ventana de impresión. Permite las ventanas emergentes para este sitio.");
  }
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  // A tick so Safari and Chrome have laid the 80mm layout out before printing.
  printWindow.setTimeout(() => printWindow.print(), 250);
}

/** The till prints to a thermal head, so anything that could break the layout escapes. */
function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] ?? char);
}
