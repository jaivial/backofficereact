import React, { useState } from "react";

import { toSvgString } from "../../../../lib/qr/core";
import { exportSvg, printSvg } from "../../../../lib/qr/export";
import { Button } from "../../../../ui/actions/Button";
import { useToasts } from "../../../../ui/feedback/useToasts";
import { QrCode } from "../../../../ui/qr/QrCode";

export type QrGeneralTabProps = {
  website: string;
};

/**
 * "General QR" tab — a plain QR pointing to the restaurant website, ready to
 * download (PNG/PDF) or print for customers.
 *
 * Observational points:
 *  - `qr-page:generate` → preview container (QR generation).
 *  - `qr-page:export`   → download/print actions, emitted by `lib/qr/export`.
 */
export function QrGeneralTab({ website }: QrGeneralTabProps): React.ReactElement {
  const [url, setUrl] = useState(website);
  const [busy, setBusy] = useState<null | "png" | "pdf" | "print">(null);
  const { pushToast } = useToasts();

  async function run(action: "png" | "pdf" | "print") {
    if (busy) return;
    setBusy(action);
    try {
      const svg = await toSvgString(url, { size: 1024 });
      if (action === "print") printSvg(svg);
      else await exportSvg(svg, { format: action, filename: "qr-general" });
      pushToast({ kind: "success", title: "Listo", message: "El QR se ha generado correctamente." });
    } catch (e) {
      pushToast({ kind: "error", title: "No se pudo generar el QR", message: e instanceof Error ? e.message : undefined });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="qr-grid" data-testid="qr-general-tab" data-ui="qr-general-tab">
      <div className="qr-panel" data-testid="qr-general-controls" data-slot="qr-general-controls">
        <label className="qr-field" data-testid="qr-general-url-label" data-slot="qr-general-url-label">
          <span data-slot="qr-general-url-caption">Enlace del QR</span>
          <input
            className="qr-input"
            type="url"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://tu-restaurante.com"
            data-testid="qr-general-url-input"
            data-slot="qr-general-url-input"
            data-coord-id="qr-page:website-fetch"
          />
        </label>
        <p className="qr-hint" data-testid="qr-general-hint" data-slot="qr-general-hint">
          Este QR apunta a la pagina web configurada. Puedes ajustarlo antes de descargarlo.
        </p>
        <div className="qr-actions" data-testid="qr-general-actions" data-slot="qr-general-actions">
          <Button variant="primary" onClick={() => void run("png")} disabled={busy !== null} data-testid="qr-general-download-png">
            Descargar PNG
          </Button>
          <Button variant="secondary" onClick={() => void run("pdf")} disabled={busy !== null} data-testid="qr-general-download-pdf">
            Descargar PDF
          </Button>
          <Button variant="secondary" onClick={() => void run("print")} disabled={busy !== null} data-testid="qr-general-print">
            Imprimir
          </Button>
        </div>
      </div>

      <div className="qr-previewCard" data-testid="qr-general-preview" data-slot="qr-general-preview" data-coord-id="qr-page:generate">
        <QrCode value={url} size={320} alt="Codigo QR de la pagina web" data-testid="qr-general-code" />
      </div>
    </div>
  );
}
