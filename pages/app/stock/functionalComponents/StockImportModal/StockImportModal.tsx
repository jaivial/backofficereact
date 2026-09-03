import React, { useEffect, useRef, useState } from "react";
import { Download, FileUp } from "lucide-react";

import { Button } from "../../../../../ui/actions/Button";
import { InlineAlert } from "../../../../../ui/feedback/InlineAlert";
import { LoadingSpinner } from "../../../../../ui/feedback/LoadingSpinner";
import { StatusBadge } from "../../../../../ui/feedback/StatusBadge";
import { Modal } from "../../../../../ui/overlays/Modal";

type ImportRow = {
  row: number;
  name: string;
  sku: string;
  category: string;
  kind: string;
  dimension: string;
  unitCode: string;
  unitLabel: string;
  unitFactor: number;
  isTracked: boolean;
  deductionSource: string;
  errors: string[];
};

type Phase = "pick" | "preview" | "result";

const TEMPLATE_CSV = [
  "name,sku,category,kind,dimension,unit,factor,tracked,deduction_source",
  "Harina de trigo,SKU-001,Materias primas,RAW,MASS,kg,1000,true,BOTH_MANUAL",
  "Aceite de oliva virgen,SKU-002,Despensa,RAW,VOLUME,l,1000,true,BOTH_MANUAL",
  "Limonada casera 1L,SKU-003,Bebidas,FINISHED,COUNT,ud,1,true,SALE",
  "Guantes nitrilo,SKU-004,Limpieza,CONSUMABLE,COUNT,ud,1,false,BOTH_MANUAL",
].join("\n");

const PREVIEW_ROW_LIMIT = 100;

function downloadTemplate() {
  const blob = new Blob(["﻿" + TEMPLATE_CSV], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "plantilla-stock.csv";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

type StockImportModalProps = {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
};

export function StockImportModal({ open, onClose, onImported }: StockImportModalProps) {
  const [phase, setPhase] = useState<Phase>("pick");
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [validRows, setValidRows] = useState(0);
  const [invalidRows, setInvalidRows] = useState(0);
  const [created, setCreated] = useState(0);
  const [skipped, setSkipped] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setPhase("pick");
      setFile(null);
      setRows([]);
      setValidRows(0);
      setInvalidRows(0);
      setCreated(0);
      setSkipped(0);
      setError("");
      setBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [open]);

  async function post(confirm: boolean) {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const data = new FormData();
      data.append("file", file);
      if (confirm) data.append("confirm", "1");
      const response = await fetch("/api/admin/stock/items/import", { method: "POST", body: data, credentials: "include" });
      const body = await response.json();
      if (!response.ok || !body.success) throw new Error(body.message || "No se pudo importar el archivo");
      if (confirm) {
        setCreated(body.created || 0);
        setSkipped(body.skipped || 0);
        setPhase("result");
        onImported();
      } else {
        setRows(body.rows || []);
        setValidRows(body.validRows || 0);
        setInvalidRows(body.invalidRows || 0);
        setPhase("preview");
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo importar el archivo");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Importar artículos" size="lg">
      <div className="bo-stockImport" data-ui="stock-import" data-testid="stock-import">
        {error ? <InlineAlert kind="error" title="Importación" message={error} /> : null}

        {phase === "pick" ? (
          <div className="bo-stockImportPick" data-ui="stock-import-pick">
            <p className="bo-mutedText" data-ui="stock-import-pick-help">
              Sube un CSV con tus artículos. Descarga la plantilla para ver el formato exacto de columnas
              (nombre, SKU, categoría, tipo, dimensión, unidad, factor, seguimiento y descuento).
            </p>
            <button type="button" className="bo-stockImportTemplate" onClick={downloadTemplate} data-ui="stock-import-template" data-testid="stock-import-template">
              <Download className="bo-ico" size={16} aria-hidden="true" data-ui="stock-import-template-icon" />
              Descargar plantilla CSV
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="bo-input"
              onChange={(event) => setFile(event.target.files?.[0] || null)}
              data-ui="stock-import-file"
              data-testid="stock-import-file"
            />
            <div className="bo-stockImportActions" data-ui="stock-import-pick-actions">
              <Button variant="ghost" onClick={onClose} data-ui="stock-import-cancel" data-testid="stock-import-cancel">Cancelar</Button>
              <Button variant="primary" disabled={!file || busy} onClick={() => void post(false)} data-ui="stock-import-analyze" data-testid="stock-import-analyze">
                <FileUp className="bo-ico" size={16} aria-hidden="true" data-ui="stock-import-analyze-icon" />
                Analizar archivo
              </Button>
            </div>
          </div>
        ) : null}

        {phase === "preview" ? (
          <div className="bo-stockImportPreview" data-ui="stock-import-preview">
            <div className="bo-stockImportSummary" data-ui="stock-import-summary">
              <StatusBadge variant="success" size="sm" data-ui="stock-import-valid-count" data-testid="stock-import-valid-count">{validRows} válidas</StatusBadge>
              <StatusBadge variant={invalidRows > 0 ? "danger" : "neutral"} size="sm" data-ui="stock-import-invalid-count" data-testid="stock-import-invalid-count">{invalidRows} con errores</StatusBadge>
            </div>
            <div className="bo-stockTableScroll" data-ui="stock-import-table-wrap">
              <table className="bo-table" data-ui="stock-import-table" data-testid="stock-import-table">
                <thead data-ui="stock-import-table-head">
                  <tr data-ui="stock-import-table-head-row">
                    <th scope="col" data-ui="stock-import-th-row">#</th>
                    <th scope="col" data-ui="stock-import-th-name">Nombre</th>
                    <th scope="col" data-ui="stock-import-th-sku">SKU</th>
                    <th scope="col" data-ui="stock-import-th-kind">Tipo</th>
                    <th scope="col" data-ui="stock-import-th-unit">Unidad</th>
                    <th scope="col" data-ui="stock-import-th-errors">Errores</th>
                  </tr>
                </thead>
                <tbody data-ui="stock-import-table-body">
                  {rows.slice(0, PREVIEW_ROW_LIMIT).map((row) => (
                    <tr key={row.row} className={row.errors.length > 0 ? "bo-stockImportRowInvalid" : undefined} data-ui="stock-import-row" data-testid={`stock-import-row-${row.row}`}>
                      <td data-ui="stock-import-row-number">{row.row}</td>
                      <td data-ui="stock-import-row-name">{row.name || "—"}</td>
                      <td data-ui="stock-import-row-sku">{row.sku || "—"}</td>
                      <td data-ui="stock-import-row-kind">{row.kind}</td>
                      <td data-ui="stock-import-row-unit">{row.unitLabel || row.unitCode || "—"}</td>
                      <td data-ui="stock-import-row-errors">{row.errors.length > 0 ? row.errors.join(", ") : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {rows.length > PREVIEW_ROW_LIMIT ? (
              <p className="bo-mutedText" data-ui="stock-import-preview-truncated">Mostrando las primeras {PREVIEW_ROW_LIMIT} filas de {rows.length}.</p>
            ) : null}
            <div className="bo-stockImportActions" data-ui="stock-import-preview-actions">
              <Button variant="ghost" disabled={busy} onClick={() => setPhase("pick")} data-ui="stock-import-back" data-testid="stock-import-back">Volver</Button>
              <Button variant="primary" disabled={validRows === 0 || busy} onClick={() => void post(true)} data-ui="stock-import-confirm" data-testid="stock-import-confirm">
                Importar {validRows} artículo{validRows === 1 ? "" : "s"}
              </Button>
            </div>
          </div>
        ) : null}

        {phase === "result" ? (
          <div className="bo-stockImportResult" data-ui="stock-import-result">
            <InlineAlert kind="success" title="Importación completada" message={`${created} artículo${created === 1 ? "" : "s"} creado${created === 1 ? "" : "s"}, ${skipped} omitido${skipped === 1 ? "" : "s"}.`} />
            {busy ? <LoadingSpinner centered size="sm" /> : null}
            <div className="bo-stockImportActions" data-ui="stock-import-result-actions">
              <Button variant="primary" onClick={onClose} data-ui="stock-import-done" data-testid="stock-import-done">Cerrar</Button>
            </div>
          </div>
        ) : null}

        {busy && phase !== "result" ? <LoadingSpinner centered size="sm" label="Procesando archivo…" /> : null}
      </div>
    </Modal>
  );
}
