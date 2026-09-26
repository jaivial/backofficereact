import React, { useEffect, useMemo, useRef, useState } from "react";

/**
 * Client-only PDF preview (react-pdf). pdfjs touches `window`, so the library
 * is imported lazily after mount and SSR renders a plain placeholder. Pages fit
 * the container width (capped at `maxWidth`) so it never scrolls sideways.
 * Coordination id: special_booking_qr_v1, special_booking_receipt_proxy_v1
 */
type ReactPdfModule = typeof import("react-pdf");

export function PdfPreview({ url, maxWidth = 560, testId }: { url: string; maxWidth?: number; testId: string }) {
  const [mod, setMod] = useState<ReactPdfModule | null>(null);
  const [pages, setPages] = useState(0);
  const [failed, setFailed] = useState(false);
  const [width, setWidth] = useState(maxWidth);
  const boxRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let alive = true;
    void import("react-pdf").then((m) => {
      m.pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
      if (alive) setMod(m);
    });
    return () => { alive = false; };
  }, []);

  // A new receipt URL gets a fresh attempt.
  useEffect(() => { setFailed(false); setPages(0); }, [url]);

  useEffect(() => {
    const el = boxRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.min(maxWidth, Math.floor(entry.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, [maxWidth, mod]);

  // Session cookie travels with the same-origin proxy request.
  const file = useMemo(() => ({ url, withCredentials: true }), [url]);

  if (failed) {
    return <p className="bo-muted" data-testid={`${testId}-error`}>No se pudo previsualizar el PDF. Puedes descargarlo con el botón de arriba.</p>;
  }
  if (!mod) {
    return <p className="bo-muted" data-testid={`${testId}-loading`}>Cargando PDF…</p>;
  }
  const { Document, Page } = mod;
  return (
    <div ref={boxRef} className="bo-pdfPreview" data-testid={testId}>
      <Document
        file={file}
        onLoadSuccess={(doc) => setPages(doc.numPages)}
        onLoadError={(e) => { console.error("[special_booking_receipt_proxy_v1] pdf load failed", e); setFailed(true); }}
        loading={<p className="bo-muted" data-testid={`${testId}-doc-loading`}>Cargando PDF…</p>}
      >
        {Array.from({ length: pages }, (_, i) => (
          <Page key={i} pageNumber={i + 1} width={width} renderAnnotationLayer={false} renderTextLayer={false} />
        ))}
      </Document>
    </div>
  );
}
