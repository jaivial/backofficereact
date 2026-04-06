import type { TaxReport, CustomerStatement } from "../../../../api/types";
import { CURRENCY_SYMBOLS } from "../../../../api/types";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

type ToastLike = { show: (msg: string) => void };
type PushToastLike = (t: { kind: "success" | "error" | "info"; title: string; message?: string }) => void;

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatNumber(num: number): string {
  return num.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function exportCustomerStatementPDF(
  statement: CustomerStatement,
  dateFrom: string,
  dateTo: string,
  pushToast: PushToastLike,
  errorToast: ToastLike,
) {
  const doc = new jsPDF();
  const currency = CURRENCY_SYMBOLS.EUR;

  doc.setFontSize(18);
  doc.text("Estado de Cuenta", 14, 22);
  doc.setFontSize(10);
  doc.text(`Cliente: ${statement.customer_name}`, 14, 30);
  if (statement.customer_dni_cif) doc.text(`DNI/CIF: ${statement.customer_dni_cif}`, 14, 36);
  if (statement.customer_email) doc.text(`Email: ${statement.customer_email}`, 14, 42);
  doc.text(`Periodo: ${formatDate(statement.date_from)} - ${formatDate(statement.date_to)}`, 14, 48);
  doc.text(`Fecha de generación: ${new Date(statement.generated_at).toLocaleString("es-ES")}`, 14, 54);

  let currentY = 65;
  doc.setFontSize(12);
  doc.text("Saldo Inicial", 14, currentY);
  doc.setFontSize(10);
  doc.text(`${currency}${formatNumber(statement.opening_balance)}`, 14, currentY + 6);
  currentY += 15;

  doc.setFontSize(12);
  doc.text("Resumen", 14, currentY);

  autoTable(doc, {
    startY: currentY + 5,
    head: [["Concepto", "Importe"]],
    body: [
      ["Total Facturado", `${currency}${formatNumber(statement.summary.total_invoiced)}`],
      ["Total Pagado", `${currency}${formatNumber(statement.summary.total_paid)}`],
      ["Total Pendiente", `${currency}${formatNumber(statement.summary.total_pending)}`],
      ["Total Vencido", `${currency}${formatNumber(statement.summary.total_overdue)}`],
      ["Facturas", `${statement.summary.invoice_count}`],
      ["Pagos", `${statement.summary.payment_count}`],
    ],
    theme: "striped",
  });

  currentY = (doc as any).lastAutoTable?.finalY + 15;

  if (statement.invoices.length > 0) {
    doc.setFontSize(12);
    doc.text("Facturas", 14, currentY);
    autoTable(doc, {
      startY: currentY + 5,
      head: [["Factura", "Fecha", "Descripción", "Importe", "Tipo/Estado"]],
      body: statement.invoices.map(inv => [
        inv.invoice_number || `#${inv.id}`,
        formatDate(inv.invoice_date),
        inv.description,
        `${currency}${formatNumber(inv.total)}`,
        inv.is_credit_note ? "NC" : inv.status,
      ]),
      theme: "striped",
    });
    currentY = (doc as any).lastAutoTable?.finalY + 15;
  }

  if (statement.payments.length > 0) {
    doc.setFontSize(12);
    doc.text("Pagos", 14, currentY);
    autoTable(doc, {
      startY: currentY + 5,
      head: [["Factura", "Fecha", "Método", "Importe"]],
      body: statement.payments.map(pay => [
        pay.invoice_number || `#${pay.invoice_id}`,
        formatDate(pay.payment_date),
        pay.payment_method,
        `${currency}${formatNumber(pay.amount)}`,
      ]),
      theme: "striped",
    });
    currentY = (doc as any).lastAutoTable?.finalY + 15;
  }

  doc.setFontSize(12);
  doc.text("Saldo Final", 14, currentY);
  doc.setFontSize(10);
  doc.text(`${currency}${formatNumber(statement.closing_balance)}`, 14, currentY + 6);
  doc.setFontSize(8);
  doc.text("Generado por Villa Carmen Backoffice", 14, 285);

  const safeName = statement.customer_name.replace(/[^a-zA-Z0-9]/g, "_");
  doc.save(`estado_cuenta_${safeName}_${dateFrom}_${dateTo}.pdf`);
  pushToast({ kind: "success", title: "Éxito", message: "PDF exportado correctamente" });
}

export function exportCustomerStatementCSV(
  statement: CustomerStatement,
  dateFrom: string,
  dateTo: string,
  pushToast: PushToastLike,
  errorToast: ToastLike,
) {
  const lines: string[] = [];
  lines.push("ESTADO DE CUENTA");
  lines.push(`Cliente,${statement.customer_name}`);
  if (statement.customer_dni_cif) lines.push(`DNI/CIF,${statement.customer_dni_cif}`);
  if (statement.customer_email) lines.push(`Email,${statement.customer_email}`);
  lines.push(`Periodo,${statement.date_from},${statement.date_to}`);
  lines.push(`Fecha generación,${statement.generated_at}`);
  lines.push("");
  lines.push("RESUMEN");
  lines.push(`Saldo inicial,${formatNumber(statement.opening_balance)}`);
  lines.push(`Total facturado,${formatNumber(statement.summary.total_invoiced)}`);
  lines.push(`Total pagado,${formatNumber(statement.summary.total_paid)}`);
  lines.push(`Total pendiente,${formatNumber(statement.summary.total_pending)}`);
  lines.push(`Total vencido,${formatNumber(statement.summary.total_overdue)}`);
  lines.push(`Saldo final,${formatNumber(statement.closing_balance)}`);
  lines.push("");
  lines.push("FACTURAS");
  lines.push("Número,Fecha,Descripción,Importe,IVA,Tipo,Estado");
  statement.invoices.forEach(inv => {
    lines.push(`${inv.invoice_number || ""},${inv.invoice_date},${inv.description},${inv.total},${inv.iva_amount},${inv.is_credit_note ? "NC" : "Factura"},${inv.status}`);
  });
  lines.push("");
  lines.push("PAGOS");
  lines.push("Factura,Fecha,Método,Importe,Notas");
  statement.payments.forEach(pay => {
    lines.push(`${pay.invoice_number || ""},${pay.payment_date},${pay.payment_method},${pay.amount},${pay.notes || ""}`);
  });

  const csv = lines.join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const safeName = statement.customer_name.replace(/[^a-zA-Z0-9]/g, "_");
  link.href = url;
  link.download = `estado_cuenta_${safeName}_${dateFrom}_${dateTo}.csv`;
  link.click();
  URL.revokeObjectURL(url);
  pushToast({ kind: "success", title: "Éxito", message: "CSV exportado correctamente" });
}

export function exportIVAPDF(
  report: TaxReport,
  includeCreditNotes: boolean,
  pushToast: PushToastLike,
  errorToast: ToastLike,
) {
  const doc = new jsPDF();
  const currency = CURRENCY_SYMBOLS.EUR;

  doc.setFontSize(18);
  doc.text("Resumen de IVA", 14, 22);
  doc.setFontSize(10);
  doc.text(`Periodo: ${formatDate(report.date_from)} - ${formatDate(report.date_to)}`, 14, 30);
  doc.text(`Fecha de generación: ${new Date(report.generated_at).toLocaleString("es-ES")}`, 14, 36);

  doc.setFontSize(12);
  doc.text("Resumen", 14, 48);

  autoTable(doc, {
    startY: 52,
    head: [["Concepto", "Importe"]],
    body: [
      ["Base imponible", `${currency}${formatNumber(report.summary.total_base)}`],
      ["IVA acumulado", `${currency}${formatNumber(report.summary.total_iva)}`],
      ["Total", `${currency}${formatNumber(report.summary.total)}`],
      ["Facturas", `${report.summary.invoice_count}`],
      ...(includeCreditNotes ? [
        ["Notas de crédito", `${report.summary.credit_note_count}`],
        ["Base notas de crédito", `${currency}${formatNumber(report.summary.credit_note_base)}`],
        ["IVA notas de crédito", `${currency}${formatNumber(report.summary.credit_note_iva)}`],
        ["Base neta", `${currency}${formatNumber(report.summary.net_base)}`],
        ["IVA neto", `${currency}${formatNumber(report.summary.net_iva)}`],
        ["Total neto", `${currency}${formatNumber(report.summary.net_total)}`],
      ] : []),
    ],
    theme: "striped",
  });

  const finalY = (doc as any).lastAutoTable?.finalY || 100;
  doc.setFontSize(12);
  doc.text("Desglose por tipo de IVA", 14, finalY + 15);

  autoTable(doc, {
    startY: finalY + 20,
    head: [["Tipo IVA", "Base", "IVA", "Importe", "Facturas"]],
    body: report.breakdown_by_rate.map(b => [
      `${b.iva_rate}%`,
      `${currency}${formatNumber(b.base_amount)}`,
      `${currency}${formatNumber(b.iva_amount)}`,
      `${currency}${formatNumber(b.base_amount + b.iva_amount)}`,
      `${b.invoice_count}`,
    ]),
    theme: "striped",
  });

  if (includeCreditNotes && report.breakdown_by_rate.some(b => b.credit_note_count > 0)) {
    const finalY2 = (doc as any).lastAutoTable?.finalY || 150;
    doc.setFontSize(12);
    doc.text("Notas de crédito por tipo de IVA", 14, finalY2 + 15);
    autoTable(doc, {
      startY: finalY2 + 20,
      head: [["Tipo IVA", "Notas crédito", "Base", "IVA"]],
      body: report.breakdown_by_rate.filter(b => b.credit_note_count > 0).map(b => [
        `${b.iva_rate}%`,
        `${b.credit_note_count}`,
        `${currency}${formatNumber(b.credit_note_base)}`,
        `${currency}${formatNumber(b.credit_note_iva)}`,
      ]),
      theme: "striped",
    });
  }

  doc.setFontSize(8);
  doc.text("Generado por Villa Carmen Backoffice", 14, 285);
  doc.save(`iva-report-${report.date_from}-${report.date_to}.pdf`);
  pushToast({ kind: "success", title: "Éxito", message: "PDF exportado correctamente" });
}

export function exportIVACSV(
  report: TaxReport,
  includeCreditNotes: boolean,
  pushToast: PushToastLike,
  errorToast: ToastLike,
) {
  const lines: string[] = [];
  lines.push("RESUMEN DE IVA");
  lines.push(`Periodo,${report.date_from},${report.date_to}`);
  lines.push(`Fecha generación,${report.generated_at}`);
  lines.push("");
  lines.push("RESUMEN");
  lines.push(`Base imponible,${formatNumber(report.summary.total_base)}`);
  lines.push(`IVA acumulado,${formatNumber(report.summary.total_iva)}`);
  lines.push(`Total,${formatNumber(report.summary.total)}`);
  lines.push(`Número de facturas,${report.summary.invoice_count}`);
  if (includeCreditNotes) {
    lines.push("");
    lines.push("NOTAS DE CRÉDITO");
    lines.push(`Número de notas de crédito,${report.summary.credit_note_count}`);
    lines.push(`Base notas de crédito,${formatNumber(report.summary.credit_note_base)}`);
    lines.push(`IVA notas de crédito,${formatNumber(report.summary.credit_note_iva)}`);
    lines.push("");
    lines.push("NETO");
    lines.push(`Base neta,${formatNumber(report.summary.net_base)}`);
    lines.push(`IVA neto,${formatNumber(report.summary.net_iva)}`);
    lines.push(`Total neto,${formatNumber(report.summary.net_total)}`);
  }
  lines.push("");
  lines.push("DESGLOSE POR TIPO DE IVA");
  lines.push("Tipo IVA,Base,IVA,Importe,Facturas");
  report.breakdown_by_rate.forEach(b => {
    lines.push(`${b.iva_rate}%,${formatNumber(b.base_amount)},${formatNumber(b.iva_amount)},${formatNumber(b.base_amount + b.iva_amount)},${b.invoice_count}`);
  });

  if (includeCreditNotes && report.breakdown_by_rate.some(b => b.credit_note_count > 0)) {
    lines.push("");
    lines.push("NOTAS DE CRÉDITO POR TIPO");
    lines.push("Tipo IVA,Notas crédito,Base,IVA");
    report.breakdown_by_rate.filter(b => b.credit_note_count > 0).forEach(b => {
      lines.push(`${b.iva_rate}%,${b.credit_note_count},${formatNumber(b.credit_note_base)},${formatNumber(b.credit_note_iva)}`);
    });
  }

  const csv = lines.join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `iva-report-${report.date_from}-${report.date_to}.csv`;
  link.click();
  URL.revokeObjectURL(url);
  pushToast({ kind: "success", title: "Éxito", message: "Excel (CSV) exportado correctamente" });
}
