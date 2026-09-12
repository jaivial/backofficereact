import React, { useState } from "react";
import { Download, FileImage, FileText, Printer, Settings2 } from "lucide-react";

import { toSvgString } from "../../../../lib/qr/core";
import { exportSvg, printSvg } from "../../../../lib/qr/export";
import { Button } from "../../../../ui/actions/Button";
import { useToasts } from "../../../../ui/feedback/useToasts";
import { DropdownMenu } from "../../../../ui/inputs/DropdownMenu";
import { QrCode } from "../../../../ui/qr/QrCode";

export type QrGeneralTabProps = {
  website: string;
};

type GeneralAction = "png" | "pdf" | "print";

/**
 * "General QR" tab — plain QR pointing to the restaurant website.
 * Minimal layout: preview + a download dropdown; the link editor stays
 * collapsed behind the "Opciones" button.
 *
 * Observational points:
 *  - `qr-page:website-fetch` → default link (from Admin config).
 *  - `qr-page:generate`      → preview container.
 *  - `qr-page:export`        → download/print actions (emit `qr-export:*`).
 */
export function QrGeneralTab({ website }: QrGeneralTabProps): React.ReactElement {
  const [url, setUrl] = useState(website);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [busy, setBusy] = useState<GeneralAction | null>(null);
  const { pushToast } = useToasts();

  async function run(action: GeneralAction) {
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
    <div className="qr-screen" data-testid="qr-general-tab" data-ui="qr-general-tab">
      <div className="qr-previewCard" data-testid="qr-general-preview" data-slot="qr-general-preview" data-coord-id="qr-page:generate">
        <QrCode value={url} size={300} alt="Codigo QR de la pagina web" data-testid="qr-general-code" />
      </div>

      <p className="qr-caption" data-testid="qr-general-default-url" data-slot="qr-general-default-url">
        {url || "Sin enlace configurado"}
      </p>

      <div className="qr-toolbar" data-testid="qr-general-actions" data-slot="qr-general-actions" data-coord-id="qr-page:export">
        <Button
          variant={optionsOpen ? "primary" : "secondary"}
          size="sm"
          onClick={() => setOptionsOpen((open) => !open)}
          aria-expanded={optionsOpen}
          data-testid="qr-general-options-toggle"
        >
          <Settings2 size={16} strokeWidth={1.8} data-testid="qr-general-options-icon" />
          Opciones
        </Button>
        <DropdownMenu
          label="Descargar"
          triggerClassName="bo-btn bo-btn--primary bo-btn--sm"
          triggerDataSlot="qr-general-download"
          triggerContent={
            <>
              <Download size={16} strokeWidth={1.8} data-testid="qr-general-download-icon" />
              Descargar
            </>
          }
          items={[
            { id: "png", label: "PNG", icon: <FileImage size={16} strokeWidth={1.8} />, onSelect: () => void run("png") },
            { id: "pdf", label: "PDF", icon: <FileText size={16} strokeWidth={1.8} />, onSelect: () => void run("pdf") },
            { id: "print", label: "Imprimir", icon: <Printer size={16} strokeWidth={1.8} />, onSelect: () => void run("print") },
          ]}
        />
      </div>

      {optionsOpen ? (
        <div className="qr-options" data-testid="qr-general-options" data-slot="qr-general-options">
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
        </div>
      ) : null}
    </div>
  );
}
