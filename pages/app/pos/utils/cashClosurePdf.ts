import autoTable from "jspdf-autotable";

export type CashClosureSummary = {
  shiftId: number;
  terminalKey: string;
  status: string;
  openedAt?: string;
  closedAt?: string | null;
  openingCashCents: number;
  salesGrossCents: number;
  refundsCents: number;
  netSalesCents: number;
  discountsCents: number;
  surchargesCents: number;
  tipsCents: number;
  cashSalesCents: number;
  cashTipsCents: number;
  cardSalesCents: number;
  cardTipsCents: number;
  bankSalesCents: number;
  bankTipsCents: number;
  otherSalesCents: number;
  otherTipsCents: number;
  cashRefundsCents: number;
  cashInCents: number;
  cashOutCents: number;
  expectedCashCents: number;
  countedCashCents?: number | null;
  differenceCents?: number | null;
  ticketCount: number;
  voidedTicketCount: number;
  covers: number;
  openVisitCount: number;
  openTicketCount: number;
};

const money = (cents: number | null | undefined) => new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format((cents || 0) / 100);
const date = (value?: string | null) => value ? new Date(value).toLocaleString("es-ES") : "-";

export async function downloadCashClosurePdf(input: { closureType: "X" | "Y" | "Z"; summary: CashClosureSummary; generatedAt?: Date }): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const { closureType, summary } = input;
  const generatedAt = input.generatedAt || new Date();
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(`CIERRE ${closureType}`, 14, 18);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`Turno ${summary.shiftId} · Terminal ${summary.terminalKey} · Generado ${date(generatedAt.toISOString())}`, 14, 25);
  doc.text(`Apertura ${date(summary.openedAt)} · Estado ${summary.status}`, 14, 30);

  autoTable(doc, {
    startY: 37,
    head: [["Resumen", "Importe"]],
    body: [
      ["Fondo inicial", money(summary.openingCashCents)], ["Ventas", money(summary.salesGrossCents)],
      ["Reembolsos", money(summary.refundsCents)], ["Ventas netas", money(summary.netSalesCents)],
      ["Descuentos", money(summary.discountsCents)], ["Recargos", money(summary.surchargesCents)],
      ["Propinas", money(summary.tipsCents)], ["Efectivo esperado", money(summary.expectedCashCents)],
      ["Efectivo contado", summary.countedCashCents == null ? "-" : money(summary.countedCashCents)],
      ["Diferencia", summary.differenceCents == null ? "-" : money(summary.differenceCents)],
    ],
    theme: "grid",
    styles: { fontSize: 9 },
    headStyles: { fillColor: [88, 70, 150] },
    columnStyles: { 1: { halign: "right" } },
  });
  const y = (doc as any).lastAutoTable?.finalY + 8 || 110;
  autoTable(doc, {
    startY: y,
    head: [["Medio", "Ventas", "Propinas"]],
    body: [["Efectivo", money(summary.cashSalesCents), money(summary.cashTipsCents)], ["Tarjeta", money(summary.cardSalesCents), money(summary.cardTipsCents)], ["Banco", money(summary.bankSalesCents), money(summary.bankTipsCents)], ["Otro", money(summary.otherSalesCents), money(summary.otherTipsCents)]],
    theme: "grid", styles: { fontSize: 9 }, headStyles: { fillColor: [48, 150, 173] },
    columnStyles: { 1: { halign: "right" }, 2: { halign: "right" } },
  });
  const y2 = (doc as any).lastAutoTable?.finalY + 8 || 150;
  doc.setFontSize(9);
  doc.text(`Tickets cobrados: ${summary.ticketCount} · Anulados: ${summary.voidedTicketCount} · Comensales: ${summary.covers}`, 14, y2);
  doc.text(`Entradas de caja: ${money(summary.cashInCents)} · Salidas: ${money(summary.cashOutCents)}`, 14, y2 + 6);
  doc.save(`cierre-${closureType}-turno-${summary.shiftId}.pdf`);
}
