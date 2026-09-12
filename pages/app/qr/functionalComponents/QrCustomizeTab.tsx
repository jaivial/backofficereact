import React, { useEffect, useMemo, useState } from "react";

import { toDataUrl } from "../../../../lib/qr/core";
import { exportSvg, downloadSvg, printSvg } from "../../../../lib/qr/export";
import { QR_RATIOS } from "../../../../lib/qr/ratios";
import { QR_TEMPLATES, buildTemplateSvg, type QrTemplateCategory } from "../../../../lib/qr/templates";
import { Button } from "../../../../ui/actions/Button";
import { useToasts } from "../../../../ui/feedback/useToasts";
import { Select } from "../../../../ui/inputs/Select";
import { QrTemplateFrame } from "../../../../ui/qr/QrTemplateFrame";

export type QrCustomizeTabProps = {
  website: string;
};

const CATEGORY_LABELS: Record<QrTemplateCategory, string> = {
  "photo-frame": "Marcos de foto",
  "instagram-post": "Instagram post",
  "instagram-story": "Instagram story",
  minimal: "Minimal",
  classic: "Clasico",
  menu: "Menu",
};

const CATEGORIES = Object.keys(CATEGORY_LABELS) as QrTemplateCategory[];

type CustomizeAction = "png" | "jpeg" | "pdf" | "svg" | "print";

/**
 * "Personalizar" tab — picks a base template + aspect ratio, adds an optional
 * caption/brand and exports the composed SVG as photo, PDF, SVG or print.
 *
 * Observational points:
 *  - `qr-page:generate` → preview container (QR generation).
 *  - `qr-page:export`   → actions toolbar (exports emit `qr-export:*`).
 */
export function QrCustomizeTab({ website }: QrCustomizeTabProps): React.ReactElement {
  const [url, setUrl] = useState(website);
  const [templateId, setTemplateId] = useState(QR_TEMPLATES[0].id);
  const [ratioId, setRatioId] = useState(QR_RATIOS[0].id);
  const [category, setCategory] = useState<QrTemplateCategory>(QR_TEMPLATES[0].category);
  const [caption, setCaption] = useState("");
  const [brand, setBrand] = useState("");
  const [svg, setSvg] = useState<string | null>(null);
  const [busy, setBusy] = useState<CustomizeAction | null>(null);
  const { pushToast } = useToasts();

  const visibleTemplates = useMemo(
    () => QR_TEMPLATES.filter((template) => template.category === category),
    [category],
  );
  const ratioOptions = useMemo(
    () => QR_RATIOS.map((ratio) => ({ value: ratio.id, label: ratio.label })),
    [],
  );

  useEffect(() => {
    let active = true;
    setSvg(null);
    toDataUrl(url, { size: 1024 })
      .then((qrDataUrl) => {
        if (!active) return;
        setSvg(buildTemplateSvg({ templateId, ratioId, qrDataUrl, caption, brand }));
      })
      .catch(() => {
        if (active) setSvg(null);
      });
    return () => {
      active = false;
    };
  }, [url, templateId, ratioId, caption, brand]);

  const filename = `qr-${templateId}-${ratioId}`;

  async function run(action: CustomizeAction) {
    if (!svg || busy) return;
    setBusy(action);
    try {
      if (action === "print") printSvg(svg);
      else if (action === "svg") downloadSvg(svg, filename);
      else await exportSvg(svg, { format: action, filename });
      pushToast({ kind: "success", title: "Listo", message: "El QR personalizado se ha generado." });
    } catch (e) {
      pushToast({ kind: "error", title: "No se pudo exportar", message: e instanceof Error ? e.message : undefined });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="qr-customize" data-testid="qr-customize-tab" data-ui="qr-customize-tab">
      <div className="qr-panel" data-testid="qr-customize-controls" data-slot="qr-customize-controls">
        <label className="qr-field" data-testid="qr-customize-url-label" data-slot="qr-customize-url-label">
          <span data-slot="qr-customize-url-caption">Enlace del QR</span>
          <input
            className="qr-input"
            type="url"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://tu-restaurante.com"
            data-testid="qr-customize-url-input"
            data-slot="qr-customize-url-input"
            data-coord-id="qr-page:website-fetch"
          />
        </label>

        <div className="qr-field" data-testid="qr-customize-categories" data-slot="qr-customize-categories">
          <span data-testid="qr-customize-categories-caption" data-slot="qr-customize-categories-caption">Categorias</span>
          <div className="qr-chips" data-testid="qr-customize-category-list" data-slot="qr-customize-category-list">
            {CATEGORIES.map((id) => (
              <Button
                key={id}
                variant={id === category ? "primary" : "secondary"}
                size="sm"
                onClick={() => setCategory(id)}
                aria-pressed={id === category}
                data-testid={`qr-customize-category-${id}`}
              >
                {CATEGORY_LABELS[id]}
              </Button>
            ))}
          </div>
        </div>

        <div className="qr-field" data-testid="qr-customize-templates" data-slot="qr-customize-templates">
          <span data-testid="qr-customize-templates-caption" data-slot="qr-customize-templates-caption">Plantilla</span>
          <div className="qr-templateGrid" data-testid="qr-customize-template-list" data-slot="qr-customize-template-list">
            {visibleTemplates.map((template) => (
              <button
                key={template.id}
                type="button"
                className={`qr-templateCard${template.id === templateId ? " is-active" : ""}`}
                aria-pressed={template.id === templateId}
                onClick={() => setTemplateId(template.id)}
                data-testid={`qr-customize-template-${template.id}`}
                data-template-id={template.id}
              >
                <span className="qr-swatch" style={{ background: template.accent }} data-testid={`qr-customize-template-swatch-${template.id}`} data-slot="qr-customize-template-swatch" />
                <span data-testid={`qr-customize-template-name-${template.id}`} data-slot="qr-customize-template-name">{template.name}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="qr-field" data-testid="qr-customize-ratio" data-slot="qr-customize-ratio">
          <span data-testid="qr-customize-ratio-caption" data-slot="qr-customize-ratio-caption">Formato</span>
          <Select
            value={ratioId}
            onChange={setRatioId}
            options={ratioOptions}
            ariaLabel="Formato"
            data-testid="qr-customize-ratio-select"
          />
        </div>

        <label className="qr-field" data-testid="qr-customize-caption-label" data-slot="qr-customize-caption-label">
          <span data-slot="qr-customize-caption-caption">Texto (opcional)</span>
          <input
            className="qr-input"
            type="text"
            value={caption}
            onChange={(event) => setCaption(event.target.value)}
            placeholder="Escanéame"
            data-testid="qr-customize-caption-input"
            data-slot="qr-customize-caption-input"
          />
        </label>

        <label className="qr-field" data-testid="qr-customize-brand-label" data-slot="qr-customize-brand-label">
          <span data-slot="qr-customize-brand-caption">Marca (opcional)</span>
          <input
            className="qr-input"
            type="text"
            value={brand}
            onChange={(event) => setBrand(event.target.value)}
            placeholder="Villa Carmen"
            data-testid="qr-customize-brand-input"
            data-slot="qr-customize-brand-input"
          />
        </label>
      </div>

      <div className="qr-previewCard" data-testid="qr-customize-preview-card" data-slot="qr-customize-preview-card" data-coord-id="qr-page:generate">
        {svg ? (
          <QrTemplateFrame svg={svg} className="qr-frame" data-testid="qr-customize-preview" />
        ) : (
          <div className="qr-frame qr-frame--empty" data-testid="qr-customize-preview-placeholder" data-slot="qr-customize-preview-placeholder">
            Generando vista previa…
          </div>
        )}
      </div>

      <div className="qr-actions qr-actions--full" data-testid="qr-customize-actions" data-slot="qr-customize-actions" data-coord-id="qr-page:export">
        <Button variant="primary" onClick={() => void run("png")} disabled={!svg || busy !== null} data-testid="qr-customize-download-png">
          Descargar PNG
        </Button>
        <Button variant="primary" onClick={() => void run("jpeg")} disabled={!svg || busy !== null} data-testid="qr-customize-download-jpeg">
          Descargar JPEG
        </Button>
        <Button variant="secondary" onClick={() => void run("pdf")} disabled={!svg || busy !== null} data-testid="qr-customize-download-pdf">
          Descargar PDF
        </Button>
        <Button variant="secondary" onClick={() => void run("svg")} disabled={!svg || busy !== null} data-testid="qr-customize-download-svg">
          Descargar SVG
        </Button>
        <Button variant="secondary" onClick={() => void run("print")} disabled={!svg || busy !== null} data-testid="qr-customize-print">
          Imprimir
        </Button>
      </div>
    </div>
  );
}
