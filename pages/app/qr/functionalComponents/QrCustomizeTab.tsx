import React, { useEffect, useMemo, useState } from "react";
import { Download, FileCode, FileImage, FileText, LayoutTemplate, Printer, Settings2 } from "lucide-react";

import { toDataUrl } from "../../../../lib/qr/core";
import { exportSvg, downloadSvg, printSvg } from "../../../../lib/qr/export";
import { QR_RATIOS } from "../../../../lib/qr/ratios";
import { QR_TEMPLATES, buildTemplateSvg, type QrTemplateCategory } from "../../../../lib/qr/templates";
import { Button } from "../../../../ui/actions/Button";
import { useToasts } from "../../../../ui/feedback/useToasts";
import { DropdownMenu } from "../../../../ui/inputs/DropdownMenu";
import { Select } from "../../../../ui/inputs/Select";
import { QrEmptyState } from "../../../../ui/qr/QrEmptyState";
import { QrTemplateFrame } from "../../../../ui/qr/QrTemplateFrame";

export type QrCustomizeTabProps = {
  website: string;
};

const CATEGORY_LABELS: Record<QrTemplateCategory, string> = {
  "photo-frame": "Marcos",
  "instagram-post": "Post",
  "instagram-story": "Story",
  minimal: "Minimal",
  classic: "Clasico",
  menu: "Menu",
};

const CATEGORIES = Object.keys(CATEGORY_LABELS) as QrTemplateCategory[];

type CustomizeAction = "png" | "jpeg" | "pdf" | "svg" | "print";

/**
 * "Personalizar" tab — pick a template + aspect ratio, then export.
 * Minimal layout: preview + three buttons; template picker and the remaining
 * options stay collapsed until requested.
 *
 * The QR bitmap is cached separately from the composed SVG so editing the
 * caption/brand only re-renders the frame, never the QR itself.
 *
 * Observational points:
 *  - `qr-page:website-fetch` → default link (from Admin config).
 *  - `qr-page:generate`      → preview container.
 *  - `qr-page:export`        → download/print actions (emit `qr-export:*`).
 */
export function QrCustomizeTab({ website }: QrCustomizeTabProps): React.ReactElement {
  const [url, setUrl] = useState(website);
  const [templateId, setTemplateId] = useState(QR_TEMPLATES[0].id);
  const [ratioId, setRatioId] = useState(QR_RATIOS[0].id);
  const [category, setCategory] = useState<QrTemplateCategory>(QR_TEMPLATES[0].category);
  const [caption, setCaption] = useState("");
  const [brand, setBrand] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [svg, setSvg] = useState<string | null>(null);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(!website);
  const [busy, setBusy] = useState<CustomizeAction | null>(null);
  const { pushToast } = useToasts();
  const hasUrl = url.trim().length > 0;

  const activeTemplate = useMemo(
    () => QR_TEMPLATES.find((template) => template.id === templateId) ?? QR_TEMPLATES[0],
    [templateId],
  );
  const visibleTemplates = useMemo(
    () => QR_TEMPLATES.filter((template) => template.category === category),
    [category],
  );
  const ratioOptions = useMemo(
    () => QR_RATIOS.map((ratio) => ({ value: ratio.id, label: ratio.label })),
    [],
  );

  // QR bitmap: only depends on the link.
  useEffect(() => {
    if (!hasUrl) {
      setQrDataUrl(null);
      return;
    }
    let active = true;
    toDataUrl(url, { size: 1024 })
      .then((dataUrl) => {
        if (active) setQrDataUrl(dataUrl);
      })
      .catch(() => {
        if (active) setQrDataUrl(null);
      });
    return () => {
      active = false;
    };
  }, [url, hasUrl]);

  // Composed frame: depends on the QR bitmap plus the template/caption inputs.
  useEffect(() => {
    if (!qrDataUrl) {
      setSvg(null);
      return;
    }
    setSvg(buildTemplateSvg({ templateId, ratioId, qrDataUrl, caption, brand }));
  }, [qrDataUrl, templateId, ratioId, caption, brand]);

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
    <div className="qr-screen" data-testid="qr-customize-tab" data-ui="qr-customize-tab">
      <div className="qr-previewCard" data-testid="qr-customize-preview-card" data-slot="qr-customize-preview-card" data-coord-id="qr-page:generate">
        {!hasUrl ? (
          <QrEmptyState
            message="Sin enlace para generar el QR"
            hint="Configura la web del restaurante en Ajustes o edítala en Opciones."
            data-testid="qr-customize-empty"
          />
        ) : svg ? (
          <QrTemplateFrame svg={svg} className="qr-frame" data-testid="qr-customize-preview" />
        ) : (
          <div className="qr-frame qr-frame--empty" data-testid="qr-customize-preview-placeholder" data-slot="qr-customize-preview-placeholder">
            Generando vista previa…
          </div>
        )}
      </div>

      {hasUrl ? (
        <p className="qr-caption" data-testid="qr-customize-active-template" data-slot="qr-customize-active-template">
          {activeTemplate.name}
        </p>
      ) : null}

      <div className="qr-toolbar" data-testid="qr-customize-actions" data-slot="qr-customize-actions" data-coord-id="qr-page:export" aria-busy={busy !== null}>
        <Button
          variant={templatesOpen ? "primary" : "secondary"}
          size="sm"
          onClick={() => setTemplatesOpen((open) => !open)}
          aria-expanded={templatesOpen}
          data-testid="qr-customize-templates-toggle"
        >
          <LayoutTemplate size={16} strokeWidth={1.8} data-testid="qr-customize-templates-icon" />
          Plantilla
        </Button>
        <Button
          variant={optionsOpen ? "primary" : "secondary"}
          size="sm"
          onClick={() => setOptionsOpen((open) => !open)}
          aria-expanded={optionsOpen}
          data-testid="qr-customize-options-toggle"
        >
          <Settings2 size={16} strokeWidth={1.8} data-testid="qr-customize-options-icon" />
          Opciones
        </Button>
        <DropdownMenu
          label="Descargar"
          triggerClassName="bo-btn bo-btn--primary bo-btn--sm"
          triggerDataSlot="qr-customize-download"
          triggerDataTestId="qr-customize-download"
          triggerContent={
            <>
              <Download size={16} strokeWidth={1.8} data-testid="qr-customize-download-icon" />
              Descargar
            </>
          }
          items={[
            { id: "png", label: "PNG", testId: "qr-customize-download-png", icon: <FileImage size={16} strokeWidth={1.8} />, onSelect: () => void run("png") },
            { id: "jpeg", label: "JPEG", testId: "qr-customize-download-jpeg", icon: <FileImage size={16} strokeWidth={1.8} />, onSelect: () => void run("jpeg") },
            { id: "pdf", label: "PDF", testId: "qr-customize-download-pdf", icon: <FileText size={16} strokeWidth={1.8} />, onSelect: () => void run("pdf") },
            { id: "svg", label: "SVG", testId: "qr-customize-download-svg", icon: <FileCode size={16} strokeWidth={1.8} />, onSelect: () => void run("svg") },
            { id: "print", label: "Imprimir", testId: "qr-customize-print", icon: <Printer size={16} strokeWidth={1.8} />, onSelect: () => void run("print") },
          ]}
        />
      </div>

      {templatesOpen ? (
        <div className="qr-options" data-testid="qr-customize-templates" data-slot="qr-customize-templates" role="group" aria-label="Plantillas del QR">
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
      ) : null}

      {optionsOpen ? (
        <div className="qr-options" data-testid="qr-customize-options" data-slot="qr-customize-options" role="group" aria-label="Opciones del QR">
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
      ) : null}
    </div>
  );
}
