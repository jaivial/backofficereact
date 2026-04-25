import React, { useState } from "react";
import type { InvoiceRenumberAudit, InvoiceRenumberPreview, RestaurantInvoiceSettings } from "../../../../../api/types";
import { Select } from "../../../../../ui/inputs/Select";
import { ConfirmDialog } from "../../../../../ui/overlays/ConfirmDialog";
import { Panel } from "../../../../../ui/shell/Panel";

interface RenumberPanelProps {
  renumberStartingNumber: number;
  renumberGenerateByDate: boolean;
  renumberDateFormat: string;
  renumberPreview: InvoiceRenumberPreview[] | null;
  renumberHistory: InvoiceRenumberAudit[];
  renumberLoading: boolean;
  showConfirmApply: boolean;
  onStartingNumberChange: (v: number) => void;
  onGenerateByDateChange: (v: boolean) => void;
  onDateFormatChange: (v: string) => void;
  onPreview: () => void;
  onApply: () => void;
  onShowConfirmChange: (v: boolean) => void;
}

export function RenumberPanel({
  renumberStartingNumber,
  renumberGenerateByDate,
  renumberDateFormat,
  renumberPreview,
  renumberHistory,
  renumberLoading,
  showConfirmApply,
  onStartingNumberChange,
  onGenerateByDateChange,
  onDateFormatChange,
  onPreview,
  onApply,
  onShowConfirmChange,
}: RenumberPanelProps) {
  return (
    <Panel aria-label="Renumerar facturas" data-ui="renumber-panel" title="Renumerar facturas" meta="Reasigna numeros de factura de forma masiva">
        <div className="bo-stack" data-slot="renumberPanel-stack">
          <div className="bo-mutedText" style={{ marginBottom: 16 }} data-ui="description">
            Esta herramienta permite renumerar todas las facturas existentes. Se mantendra un registro de auditoria con los cambios realizados. Es recomendable previsualizar antes de aplicar.
          </div>

          <div className="bo-row" data-slot="startingNumberRow">
            <label className="bo-field" style={{ flex: 1 }} data-ui="startingNumberField">
              <div className="bo-label" data-slot="fieldLabel">Numero inicial</div>
              <input
                className="bo-input"
                type="number"
                min="1"
                value={renumberStartingNumber}
                onChange={(e) => onStartingNumberChange(parseInt(e.target.value) || 1)}
                data-slot="fieldInput"
              />
              <div className="bo-mutedText" data-slot="fieldHint">El numero desde el cual comenzar la renumeracion</div>
            </label>
          </div>

          <div className="bo-field" data-ui="generateByDateField">
            <label className="bo-checkbox" data-slot="checkboxLabel">
              <input
                type="checkbox"
                checked={renumberGenerateByDate}
                onChange={(e) => onGenerateByDateChange(e.target.checked)}
                data-slot="checkboxInput"
              />
              <span data-slot="checkboxText">Generar secuencia basada en fecha</span>
            </label>
            <div className="bo-mutedText" data-slot="fieldHint">Si esta marcado, las facturas se numeraran por ao/mes en lugar de una secuencia continua</div>
          </div>

          {renumberGenerateByDate && (
            <div className="bo-row" data-slot="dateFormatRow">
              <label className="bo-field" style={{ flex: 1 }} data-ui="dateFormatField">
                <div className="bo-label" data-slot="fieldLabel">Formato de fecha</div>
                <Select
                  value={renumberDateFormat}
                  onChange={(v: string) => onDateFormatChange(v)}
                  options={[
                    { value: "YYYY", label: "Anual (F-2026-0001)" },
                    { value: "YYYY-MM", label: "Mensual (F-2026-02-0001)" },
                  ]}
                  size="sm"
                  ariaLabel="Formato de fecha"
                  data-slot="dateFormatSelect"
                />
              </label>
            </div>
          )}

          <div className="bo-row" style={{ marginTop: 8 }} data-slot="previewRow">
            <button
              className="bo-btn bo-btn--secondary"
              type="button"
              onClick={() => void onPreview()}
              disabled={renumberLoading}
              data-role="previewBtn"
            >
              {renumberLoading ? "Cargando..." : "Previsualizar cambios"}
            </button>
          </div>

          {renumberPreview && renumberPreview.length > 0 && (
            <div className="bo-field" style={{ marginTop: 16 }} data-ui="previewTableField">
              <div className="bo-label" data-slot="fieldLabel">Previsualizacion ({renumberPreview.length} facturas)</div>
              <div style={{ maxHeight: 300, overflowY: "auto", border: "1px solid var(--bo-border)", borderRadius: 8, marginTop: 8 }} data-slot="previewTableWrap">
                <table className="bo-table" style={{ fontSize: 13 }} data-slot="previewTable">
                  <thead data-slot="tableHead">
                    <tr data-slot="headerRow">
                      <th data-slot="colCurrent">Factura Actual</th>
                      <th data-slot="colNew">Nuevo Numero</th>
                      <th data-slot="colCustomer">Cliente</th>
                      <th data-slot="colDate">Fecha</th>
                      <th data-slot="colAmount">Importe</th>
                    </tr>
                  </thead>
                  <tbody data-slot="tableBody">
                    {renumberPreview.slice(0, 50).map((item) => (
                      <tr key={item.invoice_id} data-slot={`previewRow-${item.invoice_id}`}>
                        <td data-slot="cellCurrent">{item.current_number || "-"}</td>
                        <td style={{ fontWeight: 600 }} data-slot="cellNew">{item.new_number}</td>
                        <td data-slot="cellCustomer">{item.customer_name}</td>
                        <td data-slot="cellDate">{item.invoice_date}</td>
                        <td data-slot="cellAmount">{item.amount.toFixed(2)} EUR</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {renumberPreview.length > 50 && (
                  <div className="bo-mutedText" style={{ padding: 8, textAlign: "center" }} data-slot="truncatedNote">
                    ... y {renumberPreview.length - 50} facturas mas
                  </div>
                )}
              </div>
            </div>
          )}

          {renumberPreview && renumberPreview.length > 0 && (
            <div className="bo-row" style={{ marginTop: 16 }} data-slot="applyRow">
              <button
                className="bo-btn bo-btn--primary"
                type="button"
                onClick={() => onShowConfirmChange(true)}
                disabled={renumberLoading}
                data-role="applyBtn"
              >
                Aplicar renumeracion
              </button>
            </div>
          )}

          <div className="bo-field" style={{ marginTop: 24 }} data-ui="historyField">
            <div className="bo-label" data-slot="fieldLabel">Historial de renumeraciones</div>
            {renumberHistory.length === 0 ? (
              <div className="bo-mutedText" style={{ marginTop: 8 }} data-slot="emptyHistory">No hay historial de renumeraciones</div>
            ) : (
              <div style={{ maxHeight: 200, overflowY: "auto", marginTop: 8 }} data-slot="historyList">
                {renumberHistory.map((audit) => (
                  <div key={audit.id} style={{ padding: "8px 0", borderBottom: "1px solid var(--bo-border)" }} data-slot={`auditItem-${audit.id}`}>
                    <div style={{ fontWeight: 600 }} data-slot="auditSummary">
                      {audit.affected_invoices} facturas renumeradas
                    </div>
                    <div className="bo-mutedText" data-slot="auditFormat">
                      Formato: {audit.previous_format} -&gt; {audit.new_format} | Inicio: {audit.starting_number}
                    </div>
                    <div className="bo-mutedText" data-slot="auditMeta">
                      Por: {audit.performed_by_name} | Fecha: {new Date(audit.performed_at).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      <ConfirmDialog
        isOpen={showConfirmApply}
        title="Confirmar renumeracion"
        message={`Estas seguro de que deseas renumerar ${renumberPreview?.length || 0} facturas? Esta accion no se puede deshacer y se creara un registro de auditoria.`}
        confirmLabel="Renumerar"
        cancelLabel="Cancelar"
        onConfirm={onApply}
        onCancel={() => onShowConfirmChange(false)}
        busy={renumberLoading}
      />
    </Panel>
  );
}
