/**
 * QR export helpers: raster (PNG/JPEG), PDF and print.
 *
 * Browser-only module. Every public entry point guards SSR and never touches
 * `window`/`document` on the server.
 *
 * Observational points: every temporary element created for a transfer carries
 * `data-coord-id="qr-export:<format>"` plus `data-observe="qr-export-*"` so the
 * export operation can be traced end-to-end from the DOM.
 */

import { jsPDF } from "jspdf";

export type QrExportFormat = "png" | "jpeg" | "pdf";

export type QrExportOptions = {
  format: QrExportFormat;
  /** File name WITHOUT extension. */
  filename: string;
  /** Optional raster width in px. Defaults to the SVG's own width. */
  targetWidth?: number;
  /** JPEG quality 0..1. Default 0.92. */
  jpegQuality?: number;
};

// ---------------------------------------------------------------------------
// Coordination ids (observational points crossing UI boundaries)
// ---------------------------------------------------------------------------

const QR_EXPORT_COORD_PREFIX = "qr-export";

/** Coordination id observed by the DOM for a given export format. */
function exportCoordId(format: QrExportFormat | "svg" | "print"): string {
  return `${QR_EXPORT_COORD_PREFIX}:${format}`;
}

// ---------------------------------------------------------------------------
// SVG measurement
// ---------------------------------------------------------------------------

const PX_PER_UNIT: Record<string, number> = {
  px: 1,
  pt: 96 / 72,
  pc: 16,
  mm: 96 / 25.4,
  cm: 96 / 2.54,
  in: 96,
};

function lengthToPx(value?: string): number {
  const match = value?.trim().match(/^([+]?[\d.]+(?:e[-+]?\d+)?)\s*([a-z%]*)$/i);
  if (!match) return 0;
  const factor = PX_PER_UNIT[(match[2] || "px").toLowerCase()];
  const amount = Number(match[1]);
  return factor && Number.isFinite(amount) && amount > 0 ? amount * factor : 0;
}

function rootTag(svg: string): string {
  return svg.match(/<svg\b[^>]*>/i)?.[0] ?? "";
}

function attr(tag: string, name: string): string | undefined {
  return tag.match(new RegExp(`(?:^|\\s)${name}\\s*=\\s*["']([^"']*)["']`, "i"))?.[1];
}

/** Parses width/height from an SVG string. Returns { width: 0, height: 0 } if unknown. */
export function svgDimensions(svg: string): { width: number; height: number } {
  const tag = rootTag(svg);
  const width = lengthToPx(attr(tag, "width"));
  const height = lengthToPx(attr(tag, "height"));
  if (width > 0 && height > 0) return { width, height };

  const viewBox = attr(tag, "viewBox")?.trim().split(/[\s,]+/).map(Number);
  if (viewBox?.length === 4 && viewBox[2] > 0 && viewBox[3] > 0) {
    return { width: width > 0 ? width : viewBox[2], height: height > 0 ? height : viewBox[3] };
  }
  return { width: 0, height: 0 };
}

/** Makes sure the root <svg> declares explicit pixel dimensions so canvas can rasterize it. */
function ensureSize(svg: string, width: number, height: number): string {
  return svg.replace(/<svg\b[^>]*>/i, (tag) => {
    let sized = tag;
    if (!/(?:^|\s)width\s*=/i.test(tag)) sized = sized.replace(/<svg/i, `<svg width="${width}"`);
    if (!/(?:^|\s)height\s*=/i.test(tag)) sized = sized.replace(/<svg/i, `<svg height="${height}"`);
    return sized;
  });
}

// ---------------------------------------------------------------------------
// Browser primitives
// ---------------------------------------------------------------------------

function assertBrowser(): void {
  if (typeof window === "undefined" || typeof document === "undefined") {
    throw new Error("qr-export: browser-only API");
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("qr-export: unable to rasterize the QR SVG"));
    image.src = src;
  });
}

async function rasterize(
  svg: string,
  format: "png" | "jpeg",
  targetWidth?: number,
  quality = 0.92,
): Promise<string> {
  assertBrowser();
  const natural = svgDimensions(svg);
  if (!natural.width || !natural.height) {
    throw new Error("qr-export: cannot determine QR SVG dimensions");
  }

  const width = Math.max(1, Math.round(targetWidth || natural.width));
  const height = Math.max(1, Math.round((width / natural.width) * natural.height));
  const blobUrl = URL.createObjectURL(
    new Blob([ensureSize(svg, natural.width, natural.height)], { type: "image/svg+xml;charset=utf-8" }),
  );

  try {
    const image = await loadImage(blobUrl);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("qr-export: canvas 2D context unavailable");

    ctx.imageSmoothingEnabled = false;
    if (format === "jpeg") {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);
    }
    ctx.drawImage(image, 0, 0, width, height);
    return canvas.toDataURL(format === "jpeg" ? "image/jpeg" : "image/png", quality);
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
}

/** Creates a hidden anchor carrying the coordination id and clicks it. */
function triggerDownload(href: string, filename: string, format: QrExportFormat | "svg"): void {
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = filename;
  anchor.rel = "noopener";
  anchor.style.display = "none";
  anchor.setAttribute("data-coord-id", exportCoordId(format));
  anchor.setAttribute("data-observe", "qr-export-download");
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Rasterizes the SVG to a PNG data URL using a canvas. Browser only. */
export function svgToPngDataUrl(svg: string, targetWidth?: number): Promise<string> {
  return rasterize(svg, "png", targetWidth);
}

/** Triggers a browser download and returns the data URL used. */
export async function exportSvg(svg: string, options: QrExportOptions): Promise<string> {
  assertBrowser();
  const { format, filename, targetWidth, jpegQuality = 0.92 } = options;

  if (format === "pdf") {
    const dataUrl = await rasterize(svg, "png", targetWidth);
    const natural = svgDimensions(svg);
    const rasterWidth = targetWidth || natural.width;
    const toMm = (px: number) => (px * 25.4) / 96;
    const pageWidth = toMm(rasterWidth);
    const pageHeight = toMm((rasterWidth / natural.width) * natural.height);
    const pdf = new jsPDF({
      unit: "mm",
      format: [pageWidth, pageHeight],
      orientation: pageWidth >= pageHeight ? "landscape" : "portrait",
    });
    pdf.addImage(dataUrl, "PNG", 0, 0, pageWidth, pageHeight);
    pdf.save(`${filename}.pdf`);
    return dataUrl;
  }

  const dataUrl = await rasterize(svg, format, targetWidth, jpegQuality);
  triggerDownload(dataUrl, `${filename}.${format}`, format);
  return dataUrl;
}

/** Downloads the raw SVG file. */
export function downloadSvg(svg: string, filename: string): void {
  assertBrowser();
  const blobUrl = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
  triggerDownload(blobUrl, `${filename}.svg`, "svg");
  window.setTimeout(() => URL.revokeObjectURL(blobUrl), 0);
}

/** Opens a hidden iframe with the SVG and calls print on it. */
export function printSvg(svg: string): void {
  assertBrowser();
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>@page{margin:0}html,body{margin:0}body{display:flex;align-items:center;justify-content:center}svg{width:100%;height:auto}</style></head><body>${svg}</body></html>`;
  const blobUrl = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));

  const frame = document.createElement("iframe");
  frame.setAttribute("data-coord-id", exportCoordId("print"));
  frame.setAttribute("data-observe", "qr-export-print");
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;pointer-events:none;";

  const cleanup = () => {
    URL.revokeObjectURL(blobUrl);
    frame.remove();
  };

  frame.onload = () => {
    const win = frame.contentWindow;
    if (win) {
      win.focus();
      win.print();
    }
    window.setTimeout(cleanup, 1500);
  };

  frame.src = blobUrl;
  document.body.appendChild(frame);
  window.setTimeout(cleanup, 30000);
}
