import type { Booking } from "../../api/types";
import { formatPhone } from "./format";

function parseDateString(dateStr: string): Date {
  const parts = String(dateStr).split("-");
  const y = Number(parts[0] || 0);
  const m = Number(parts[1] || 1);
  const d = Number(parts[2] || 1);
  return new Date(y, m - 1, d);
}

function formatDateForDisplay(dateStr: string): string {
  if (!dateStr) return "";
  const date = parseDateString(dateStr);
  const dayNames = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
  const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
  const dayOfWeek = dayNames[date.getDay()] || "";
  const day = date.getDate();
  const month = monthNames[date.getMonth()] || "";
  return `${dayOfWeek} ${day} de ${month}`;
}

function normalizeToArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (value === null || value === undefined) return [];
  if (typeof value === "string") {
    const v = value.trim();
    if (!v || v.toLowerCase() === "null") return [];
    if (v.startsWith("[")) {
      try {
        const parsed = JSON.parse(v);
        if (Array.isArray(parsed)) return parsed;
      } catch {
        // ignore
      }
    }
    return [v];
  }
  return [value];
}

function formatTimeHHMM(timeString: string | null | undefined): string {
  if (!timeString) return "";
  const s = String(timeString);
  if (s.includes(":")) {
    const parts = s.split(":");
    return `${String(parts[0] || "").padStart(2, "0")}:${String(parts[1] || "").padStart(2, "0")}`;
  }
  return s;
}

function formatArroz(typesValue: unknown, servingsValue: unknown, multiline: boolean): string {
  const types = normalizeToArray(typesValue);
  const servs = normalizeToArray(servingsValue);
  if (!types.length || !servs.length) return "-";

  const n = Math.min(types.length, servs.length);
  const parts: string[] = [];
  for (let i = 0; i < n; i++) {
    const type = String(types[i] ?? "").trim();
    const servings = Number(servs[i]);
    if (!type || !Number.isFinite(servings) || servings <= 0) continue;
    parts.push(`${type} x ${Math.trunc(servings)}`);
  }

  if (parts.length === 0) return "-";
  if (parts.length === 1) return parts[0] || "-";
  return multiline ? parts.map((p) => `• ${p}`).join("\n") : parts.join("; ");
}

function formatComments(commentary: string | null | undefined, specialMenu: boolean, multiline: boolean): string {
  if (!commentary || String(commentary).trim() === "") return "-";
  const text = String(commentary).trim();

  if (specialMenu && text.includes(",")) {
    const parts = text.split(",").map((p) => p.trim()).filter(Boolean);
    if (parts.length > 1) return multiline ? parts.map((p) => `• ${p}`).join("\n") : parts.join("; ");
  }
  return text;
}

function loadImage(src: string, timeoutMs: number): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    let done = false;

    const finish = (v: HTMLImageElement | null) => {
      if (done) return;
      done = true;
      resolve(v);
    };

    const t = window.setTimeout(() => finish(null), timeoutMs);
    img.onload = () => {
      window.clearTimeout(t);
      finish(img);
    };
    img.onerror = () => {
      window.clearTimeout(t);
      finish(null);
    };
    img.src = src;
  });
}

export async function downloadReservationsPDF(input: { dateISO: string; bookings: Booking[]; logoUrl: string }): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const autoTableMod = await import("jspdf-autotable");
  const autoTable = (autoTableMod as any).default || (autoTableMod as any);

  const formattedDate = formatDateForDisplay(input.dateISO);

  const headers = ["Mesa", "Nombre", "PX", "Hora", "Carros / Tronas", "Telefono", "Arroz", "Comentarios"];
  const body = input.bookings.map((b) => {
    const carros = Number(b.babyStrollers || 0) || 0;
    const tronas = Number(b.highChairs || 0) || 0;
    return [
      (b.table_number && b.table_number !== "null") ? String(b.table_number) : "",
      String(b.customer_name || ""),
      String(b.party_size ?? ""),
      formatTimeHHMM(b.reservation_time),
      `Carros: ${carros}\nTronas: ${tronas}`,
      formatPhone(b.contact_phone_country_code, b.contact_phone),
      formatArroz(b.arroz_type, b.arroz_servings, true),
      formatComments(b.commentary, Boolean(b.special_menu), true),
    ];
  });

  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();

  const logo = await loadImage(input.logoUrl, 2500);
  let startY = 30;

  if (logo) {
    try {
      const logoWidth = 40;
      const logoX = (pageWidth - logoWidth) / 2;
      const aspectRatio = logo.height / logo.width;
      const logoHeight = logoWidth * aspectRatio;

      // WEBP matches legacy usage. If unsupported, the call will throw and we'll fall back.
      (pdf as any).addImage(logo, "WEBP", logoX, 10, logoWidth, logoHeight);

      pdf.setFontSize(14);
      pdf.setTextColor(0, 0, 0);
      const text = `Reservas para ${formattedDate}`;
      const textWidth = (pdf as any).getStringUnitWidth(text) * 14 / (pdf as any).internal.scaleFactor;
      const textX = (pageWidth - textWidth) / 2;
      pdf.text(text, textX, 10 + logoHeight + 10);
      startY = 10 + logoHeight + 15;
    } catch {
      // ignore and use no-logo header below
    }
  }

  if (!logo) {
    pdf.setFontSize(16);
    pdf.setTextColor(0, 0, 0);
    const text = `Reservas para ${formattedDate}`;
    const textWidth = (pdf as any).getStringUnitWidth(text) * 16 / (pdf as any).internal.scaleFactor;
    const textX = (pageWidth - textWidth) / 2;
    pdf.text(text, textX, 20);
    startY = 30;
  }

  const tableWidth = pageWidth - 20;
  autoTable(pdf, {
    head: [headers],
    body,
    startY,
    theme: "grid",
    margin: { left: 10, right: 10 },
    styles: {
      fontSize: 8,
      cellPadding: 2,
      overflow: "linebreak",
      halign: "center",
      valign: "middle",
      lineWidth: 0.1,
      lineColor: [0, 0, 0],
    },
    headStyles: {
      halign: "center",
      valign: "middle",
      fillColor: [64, 192, 150],
      textColor: [255, 255, 255],
      fontStyle: "bold",
    },
    columnStyles: {
      0: { cellWidth: tableWidth * 0.07 },
      1: { cellWidth: tableWidth * 0.17 },
      2: { cellWidth: tableWidth * 0.05 },
      3: { cellWidth: tableWidth * 0.07 },
      4: { cellWidth: tableWidth * 0.10 },
      5: { cellWidth: tableWidth * 0.10 },
      6: { cellWidth: tableWidth * 0.24 },
      7: { cellWidth: tableWidth * 0.20 },
    },
  });

  pdf.save(`Reservas_${input.dateISO}.pdf`);
}
