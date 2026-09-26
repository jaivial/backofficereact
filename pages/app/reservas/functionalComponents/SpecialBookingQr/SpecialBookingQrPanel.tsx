import React, { useState } from "react";
import { Download } from "lucide-react";

import { PdfPreview } from "../../../../../ui/pdf/PdfPreview";
import type { BookingQrInfo } from "./useBookingQr";

/**
 * QR image + payment receipt preview with download, shared by the reservas
 * modal and the booking QR page. Coordination id: special_booking_qr_v1
 */
export function SpecialBookingQrPanel({ bookingId, info, error, testId }: { bookingId: number; info: BookingQrInfo | null; error: string | null; testId: string }) {
  const [tab, setTab] = useState<"qr" | "pdf">("qr");
  if (error) return <p className="bo-muted" data-testid={`${testId}-error`}>{error}</p>;
  if (!info) return <p className="bo-muted" data-testid={`${testId}-loading`}>Cargando…</p>;
  const hasPdf = Boolean(info.receipt_url);
  return (
    <div className="bo-specialQrPanel" data-testid={testId}>
      <div className="bo-displayToggle" role="tablist" aria-label="QR o comprobante" data-slot="special-qr-tabs">
        <button type="button" role="tab" aria-selected={tab === "qr"} className={`bo-displayToggleBtn${tab === "qr" ? " is-active" : ""}`} onClick={() => setTab("qr")} data-testid={`${testId}-tab-qr`}>QR</button>
        <button type="button" role="tab" aria-selected={tab === "pdf"} className={`bo-displayToggleBtn${tab === "pdf" ? " is-active" : ""}`} onClick={() => setTab("pdf")} disabled={!hasPdf} data-testid={`${testId}-tab-pdf`}>Comprobante PDF</button>
      </div>
      {tab === "qr" ? (
        info.qr_url ? (
          <div className="bo-specialQrImage" data-slot="special-qr-image">
            <img src={info.qr_url} alt={`QR reserva #${bookingId}`} width={240} height={240} data-testid={`${testId}-img`} />
            <a className="bo-btn bo-btn--ghost" href={info.qr_url} download={`qr-reserva-${bookingId}.png`} target="_blank" rel="noreferrer" data-testid={`${testId}-qr-download`}>
              <Download className="bo-ico" /> Descargar QR
            </a>
          </div>
        ) : (
          <p className="bo-muted" data-testid={`${testId}-no-qr`}>QR no disponible (CDN no configurado).</p>
        )
      ) : hasPdf ? (
        <div className="bo-specialQrPdf" data-slot="special-qr-pdf">
          <a className="bo-btn bo-btn--primary" href={info.receipt_url} download target="_blank" rel="noreferrer" data-testid={`${testId}-pdf-download`}>
            <Download className="bo-ico" /> Descargar comprobante
          </a>
          <PdfPreview url={info.receipt_url} testId={`${testId}-pdf-preview`} />
        </div>
      ) : null}
    </div>
  );
}
