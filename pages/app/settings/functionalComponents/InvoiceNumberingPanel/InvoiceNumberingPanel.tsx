import React, { useMemo } from "react";
import type { RestaurantInvoiceSettings } from "../../../../../api/types";
import { Panel } from "../../../../../ui/shell/Panel";

interface InvoiceNumberingPanelProps {
  invoiceSettings: RestaurantInvoiceSettings;
  busy: boolean;
  onSettingsChange: React.Dispatch<React.SetStateAction<RestaurantInvoiceSettings>>;
  onSave: () => Promise<void>;
}

export function InvoiceNumberingPanel({ invoiceSettings, busy, onSettingsChange, onSave }: InvoiceNumberingPanelProps) {
  const previewInvoiceNumber = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const num = invoiceSettings.nextNumber;
    const paddedNum = String(num).padStart(invoiceSettings.format.paddingZeros, "0");
    const format = invoiceSettings.format.format;

    return format
      .replace("{YYYY}", String(year))
      .replace("{YY}", String(year).slice(-2))
      .replace("{0001}", paddedNum)
      .replace("{000}", paddedNum.slice(-3))
      .replace("{00}", paddedNum.slice(-2))
      .replace("{0}", paddedNum.slice(-1))
      .replace("{N}", String(num))
      .replace("{prefix}", invoiceSettings.format.prefix)
      .replace("{suffix}", invoiceSettings.format.suffix);
  }, [invoiceSettings]);

  return (
    <Panel title="Numeracion de facturas" meta="Configura el formato de los numeros de factura" aria-label="Numeracion de facturas" data-ui="invoiceNumbering-panel">
      <div className="bo-stack" data-slot="invoiceNumberingPanel-stack">
          <div className="bo-mutedText" style={{ marginBottom: 16 }} data-ui="tokensHint">
            Usa los siguientes tokens en el formato: {"{YYYY}"} (ano), {"{YY}"} (ano corto), {"{0001}"} (numero con ceros), {"{N}"} (numero sin padding), {"{prefix}"} (prefijo), {"{suffix}"} (sufijo)
          </div>

          <label className="bo-field" data-ui="formatField">
            <div className="bo-label" data-slot="fieldLabel">Formato</div>
            <input
              className="bo-input"
              value={invoiceSettings.format.format}
              onChange={(e) => onSettingsChange((p) => ({ ...p, format: { ...p.format, format: e.target.value } }))}
              placeholder="F-{YYYY}-{0001}"
              data-slot="fieldInput"
            />
          </label>

          <div className="bo-row" data-slot="prefixSuffixRow">
            <label className="bo-field" style={{ flex: 1 }} data-ui="prefixField">
              <div className="bo-label" data-slot="fieldLabel">Prefijo</div>
              <input
                className="bo-input"
                value={invoiceSettings.format.prefix}
                onChange={(e) => onSettingsChange((p) => ({ ...p, format: { ...p.format, prefix: e.target.value } }))}
                placeholder="F-"
                data-slot="fieldInput"
              />
            </label>

            <label className="bo-field" style={{ flex: 1 }} data-ui="suffixField">
              <div className="bo-label" data-slot="fieldLabel">Sufijo</div>
              <input
                className="bo-input"
                value={invoiceSettings.format.suffix}
                onChange={(e) => onSettingsChange((p) => ({ ...p, format: { ...p.format, suffix: e.target.value } }))}
                placeholder=""
                data-slot="fieldInput"
              />
            </label>
          </div>

          <div className="bo-row" data-slot="numberingRow">
            <label className="bo-field" style={{ flex: 1 }} data-ui="startingNumberField">
              <div className="bo-label" data-slot="fieldLabel">Numero inicial</div>
              <input
                className="bo-input"
                type="number"
                min="1"
                value={invoiceSettings.format.startingNumber}
                onChange={(e) => onSettingsChange((p) => ({ ...p, format: { ...p.format, startingNumber: parseInt(e.target.value) || 1 } }))}
                data-slot="fieldInput"
              />
            </label>

            <label className="bo-field" style={{ flex: 1 }} data-ui="paddingZerosField">
              <div className="bo-label" data-slot="fieldLabel">Digitos de relleno (0001)</div>
              <input
                className="bo-input"
                type="number"
                min="1"
                max="10"
                value={invoiceSettings.format.paddingZeros}
                onChange={(e) => onSettingsChange((p) => ({ ...p, format: { ...p.format, paddingZeros: parseInt(e.target.value) || 4 } }))}
                data-slot="fieldInput"
              />
            </label>
          </div>

          <label className="bo-field" data-ui="nextNumberField">
            <div className="bo-label" data-slot="fieldLabel">Proximo numero</div>
            <input
              className="bo-input"
              type="number"
              min="1"
              value={invoiceSettings.nextNumber}
              onChange={(e) => onSettingsChange((p) => ({ ...p, nextNumber: parseInt(e.target.value) || 1 }))}
              data-slot="fieldInput"
            />
            <div className="bo-mutedText" data-slot="fieldHint">El numero que se usara para la siguiente factura</div>
          </label>

          <div className="bo-field" style={{ padding: 16, backgroundColor: "var(--bo-bg-elevated)", borderRadius: 8, marginTop: 8 }} data-ui="previewCard">
            <div className="bo-label" data-slot="previewLabel">Vista previa del siguiente numero de factura</div>
            <div style={{ fontSize: 24, fontWeight: 600, marginTop: 8, fontFamily: "monospace" }} data-slot="previewNumber">{previewInvoiceNumber}</div>
          </div>

          <div className="bo-row" data-slot="actions">
            <button className="bo-btn bo-btn--primary" type="button" onClick={onSave} disabled={busy} data-role="saveBtn">
              Guardar configuracion
            </button>
          </div>
        </div>
    </Panel>
  );
}
