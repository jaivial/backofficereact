import React, { useEffect, useState } from "react";

/**
 * Client-only PDF preview (react-pdf). pdfjs touches `window`, so the library
 * is imported lazily after mount and SSR renders a plain placeholder.
 * Coordination id: special_booking_qr_v1
 */
type ReactPdfModule = typeof import("react-pdf");

export function PdfPreview({ url, width = 560, testId }: { url: string; width?: number; testId: string }) {
  const [mod, setMod] = useState<ReactPdfModule | null>(null);
  const [pages, setPages] = useState(0);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    void import("react-pdf").then((m) => {
      m.pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
      if (alive) setMod(m);
    });
    return () => { alive = false; };
  }, []);

  if (failed) {
    return <p className="bo-muted" data-testid={`${testId}-error`}>No se pudo previsualizar el PDF.</p>;
  }
  if (!mod) {
    return <p className="bo-muted" data-testid={`${testId}-loading`}>Cargando PDF…</p>;
  }
  const { Document, Page } = mod;
  return (
    <div className="bo-pdfPreview" data-testid={testId}>
      <Document file={url} onLoadSuccess={(doc) => setPages(doc.numPages)} onLoadError={() => setFailed(true)} loading={<p className="bo-muted" data-testid={`${testId}-doc-loading`}>Cargando PDF…</p>}>
        {Array.from({ length: pages }, (_, i) => (
          <Page key={i} pageNumber={i + 1} width={width} renderAnnotationLayer={false} renderTextLayer={false} />
        ))}
      </Document>
    </div>
  );
}
