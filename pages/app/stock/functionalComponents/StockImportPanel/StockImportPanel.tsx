import React, { useCallback, useState } from "react";

import { Button } from "../../../../../ui/actions/Button";
import { InlineAlert } from "../../../../../ui/feedback/InlineAlert";
import { FormField } from "../../../../../ui/inputs/FormField";

type ImportRow = { row: number; name: string; sku?: string; dimension: string; unitCode: string; unitFactor: number; isTracked: boolean; errors?: string[] };

async function importFile(file: File, confirm: boolean) {
  const form = new FormData();
  form.set("file", file);
  if (confirm) form.set("confirm", "1");
  const response = await fetch("/api/admin/stock/items/import", { method: "POST", credentials: "include", body: form });
  const body = await response.json();
  if (!response.ok || !body.success) throw new Error(body.message || "No se pudo importar");
  return body;
}

export function StockImportPanel({ onImported }: { onImported: () => void | Promise<void> }) {
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const preview = useCallback(async () => {
    if (!file) return;
    setBusy(true); setError(""); setMessage("");
    try { const result = await importFile(file, false); setRows(result.rows || []); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo leer el fichero"); }
    finally { setBusy(false); }
  }, [file]);

  const confirm = useCallback(async () => {
    if (!file) return;
    setBusy(true); setError("");
    try { const result = await importFile(file, true); setRows([]); setFile(null); setMessage(`${result.created} artículos creados`); await onImported(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo importar"); }
    finally { setBusy(false); }
  }, [file, onImported]);

  const validRows = rows.filter((row) => !row.errors?.length).length;

  return (
    <details className="bo-panel bo-stockDetails" data-ui="stock-import-panel">
      <summary className="bo-stockDetailsSummary" data-ui="stock-import-summary">Importar catálogo CSV/XLSX</summary>
      <div className="bo-stockDetailsBody" data-ui="stock-import-body">
        <p className="bo-stockNote" data-ui="stock-import-help">Columnas: nombre/name, sku, categoría, kind, dimension, unidad/unit, factor, seguimiento.</p>

        <div className="bo-stockToolbar" data-ui="stock-import-controls">
          <FormField className="bo-stockFilterField" label="Fichero" htmlFor="stock-import-file">
            <input id="stock-import-file" className="bo-input bo-input--file" type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(event) => { setFile(event.target.files?.[0] || null); setRows([]); }} data-testid="stock-import-file" />
          </FormField>
          <Button variant="secondary" disabled={!file || busy} onClick={() => void preview()} data-testid="stock-import-preview">Vista previa</Button>
          {rows.length ? <Button variant="primary" disabled={busy || validRows === 0} onClick={() => void confirm()} data-testid="stock-import-confirm">Importar {validRows}</Button> : null}
        </div>

        {error ? <InlineAlert kind="error" title="Importación" message={error} /> : null}
        {message ? <InlineAlert kind="success" title="Importación" message={message} /> : null}

        {rows.length ? (
          <div className="bo-tableWrap" data-ui="stock-import-preview-wrap">
            <table className="bo-table" data-ui="stock-import-table">
              <caption className="sr-only" data-ui="stock-import-caption">Vista previa de importación</caption>
              <thead data-ui="stock-import-head">
                <tr data-ui="stock-import-head-row">
                  <th scope="col" data-ui="stock-import-head-row-number">Fila</th>
                  <th scope="col" data-ui="stock-import-head-name">Artículo</th>
                  <th scope="col" data-ui="stock-import-head-unit">Unidad</th>
                  <th scope="col" data-ui="stock-import-head-result">Resultado</th>
                </tr>
              </thead>
              <tbody data-ui="stock-import-body-rows">
                {rows.map((row) => (
                  <tr key={row.row} data-ui="stock-import-row">
                    <td data-ui="stock-import-row-number">{row.row}</td>
                    <td data-ui="stock-import-row-name">{row.name}{row.sku ? ` · ${row.sku}` : ""}</td>
                    <td data-ui="stock-import-row-unit">{row.unitCode} × {row.unitFactor}</td>
                    <td className={row.errors?.length ? "bo-stockTextDanger" : "bo-stockTextSuccess"} data-ui="stock-import-row-result">{row.errors?.join(", ") || "Listo"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </details>
  );
}
