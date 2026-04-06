import React from "react";
import type { PdfTemplateType, RestaurantInvoiceSettings } from "../../../../../api/types";
import { PDF_TEMPLATE_OPTIONS } from "../../../../../api/types";

interface PdfTemplatePanelProps {
  invoiceSettings: RestaurantInvoiceSettings;
  busy: boolean;
  onSettingsChange: React.Dispatch<React.SetStateAction<RestaurantInvoiceSettings>>;
  onSave: () => Promise<void>;
}

export function PdfTemplatePanel({ invoiceSettings, busy, onSettingsChange, onSave }: PdfTemplatePanelProps) {
  return (
    <div className="bo-panel" aria-label="Plantilla de PDF" data-ui="pdfTemplate-panel">
      <div className="bo-panelHead" data-slot="panelHead">
        <div className="bo-panelTitle" data-ui="panelTitle">Plantilla de PDF</div>
        <div className="bo-panelMeta" data-ui="panelMeta">Selecciona el diseno predeterminado para las facturas</div>
      </div>
      <div className="bo-panelBody" data-slot="panelBody">
        <div className="bo-stack">
          <div className="bo-mutedText" style={{ marginBottom: 16 }} data-ui="description">
            Elige el diseno que se utilizara por defecto al generar los PDFs de las facturas. Los usuarios podran elegir una plantilla diferente al crear cada factura.
          </div>

          <div className="bo-pdfTemplateOptions" data-ui="templateOptions">
            {PDF_TEMPLATE_OPTIONS.map((template) => (
              <label
                key={template.value}
                className={`bo-pdfTemplateCard ${invoiceSettings.defaultPdfTemplate === template.value ? "bo-pdfTemplateCard--selected" : ""}`}
                data-ui={`templateCard-${template.value}`}
              >
                <input
                  type="radio"
                  name="pdfTemplate"
                  value={template.value}
                  checked={invoiceSettings.defaultPdfTemplate === template.value}
                  onChange={(e) => onSettingsChange((p) => ({ ...p, defaultPdfTemplate: e.target.value as PdfTemplateType }))}
                  className="bo-pdfTemplateRadio"
                  data-slot="templateRadio"
                />
                <div className="bo-pdfTemplateCardContent" data-slot="templateCardContent">
                  <div className="bo-pdfTemplateCardTitle" data-slot="templateTitle">{template.label}</div>
                  <div className="bo-pdfTemplateCardDesc" data-slot="templateDesc">{template.description}</div>
                </div>
                {invoiceSettings.defaultPdfTemplate === template.value && (
                  <div className="bo-pdfTemplateCardCheck" data-slot="templateCheck">✓</div>
                )}
              </label>
            ))}
          </div>

          <div className="bo-row" data-slot="actions">
            <button className="bo-btn bo-btn--primary" type="button" onClick={onSave} disabled={busy} data-role="saveBtn">
              Guardar configuracion
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
