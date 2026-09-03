import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FileScan, X } from "lucide-react";

import { Button } from "../../../../../ui/actions/Button";
import { InlineAlert } from "../../../../../ui/feedback/InlineAlert";
import { StatusBadge } from "../../../../../ui/feedback/StatusBadge";
import { FormField } from "../../../../../ui/inputs/FormField";
import { Modal } from "../../../../../ui/overlays/Modal";

type StockDocumentItem = {
  id: number;
  name: string;
  displayUnit: { id: number; code: string; label: string; factorToBase: number };
};

type StockDocumentWarehouse = { id: number; name: string; isDefault: boolean };

type DocumentSummary = {
  id: number;
  documentType: "INVOICE" | "RECIPE";
  source: string;
  status: string;
  supplierName: string;
  documentNumber: string;
  documentDate: string;
  confidence: number;
  model?: string;
  createdAt: string;
  originalAvailable?: boolean;
};

type DocumentLine = {
  id: number;
  lineNo: number;
  description: string;
  code: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  total: number;
  matchedStockItemId?: number;
  matchedUnitId?: number;
  matchedStockItemName?: string;
  confidence: number;
  status: "OK" | "NEEDS_MATCH" | "IGNORED";
};

type DocumentDetail = DocumentSummary & {
  lines: DocumentLine[];
  extraction?: { name?: string; yieldQuantity?: number; yieldUnit?: string };
};

async function documentRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (!(init?.body instanceof FormData)) headers.set("Content-Type", "application/json");
  const response = await fetch(`/api/admin/stock${path}`, { ...init, credentials: "include", headers });
  const body = await response.json();
  if (!response.ok || !body.success) throw new Error(body.message || "Error procesando documento");
  return body as T;
}

export function StockDocumentsPanel({ items, warehouses }: { items: StockDocumentItem[]; warehouses: StockDocumentWarehouse[] }) {
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [documentType, setDocumentType] = useState<"INVOICE" | "RECIPE">("INVOICE");
  const [file, setFile] = useState<File | null>(null);
  const [selected, setSelected] = useState<DocumentDetail | null>(null);
  const [warehouseId, setWarehouseId] = useState(0);
  const [recipeName, setRecipeName] = useState("");
  const [recipeOutputItemId, setRecipeOutputItemId] = useState(0);
  const [recipeOutputQuantity, setRecipeOutputQuantity] = useState("1");
  const [lineExpiries, setLineExpiries] = useState<Record<number, string>>({});
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const selectedWarehouseId = useMemo(() => warehouseId || warehouses.find((warehouse) => warehouse.isDefault)?.id || 0, [warehouseId, warehouses]);
  const itemById = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);

  const loadDocuments = useCallback(async () => {
    try {
      const data = await documentRequest<{ documents: DocumentSummary[] }>("/documents");
      setDocuments(data.documents || []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudieron cargar los documentos");
    }
  }, []);

  useEffect(() => { void loadDocuments(); }, [loadDocuments]);

  const openDocument = useCallback(async (id: number) => {
    setError("");
    try {
      const data = await documentRequest<{ document: DocumentDetail }>(`/documents/${id}`);
      setSelected(data.document);
      setRecipeName(data.document.extraction?.name || "");
      setRecipeOutputQuantity(String(data.document.extraction?.yieldQuantity || 1));
      setRecipeOutputItemId(0);
      setLineExpiries({});
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo abrir el documento");
    }
  }, []);

  const upload = useCallback(async () => {
    if (!file) { setError("Selecciona un PDF o una imagen"); return; }
    setUploading(true);
    setError("");
    setNotice("");
    const form = new FormData();
    form.set("documentType", documentType);
    form.set("file", file);
    try {
      const result = await documentRequest<{ id: number }>("/documents/upload", { method: "POST", body: form });
      setFile(null);
      setNotice("Extracción terminada. Revisa cada línea antes de confirmar.");
      await loadDocuments();
      await openDocument(result.id);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo extraer el documento");
    } finally {
      setUploading(false);
    }
  }, [documentType, file, loadDocuments, openDocument]);

  const deleteOriginal=useCallback(async()=>{if(!selected||!window.confirm("Eliminar original privado? La extracción revisada se conserva."))return;setSaving(true);setError("");try{await documentRequest(`/documents/${selected.id}/original`,{method:"DELETE"});setSelected({...selected,originalAvailable:false});setDocuments(current=>current.map(item=>item.id===selected.id?{...item,originalAvailable:false}:item));setNotice("Original privado eliminado.")}catch(reason){setError(reason instanceof Error?reason.message:"No se pudo eliminar el original")}finally{setSaving(false)}},[selected]);

  const updateLine = useCallback((lineId: number, patch: Partial<DocumentLine>) => {
    setSelected((current) => current ? { ...current, lines: current.lines.map((line) => line.id === lineId ? { ...line, ...patch } : line) } : current);
  }, []);

  const mapLineItem = useCallback((lineId: number, itemId: number) => {
    const item = itemById.get(itemId);
    updateLine(lineId, item ? { matchedStockItemId: item.id, matchedUnitId: item.displayUnit.id, matchedStockItemName: item.name, status: "OK" } : { matchedStockItemId: undefined, matchedUnitId: undefined, matchedStockItemName: "", status: "NEEDS_MATCH" });
  }, [itemById, updateLine]);

  const saveReview = useCallback(async () => {
    if (!selected) return;
    setSaving(true);
    setError("");
    try {
      await documentRequest(`/documents/${selected.id}/review`, {
        method: "PATCH",
        body: JSON.stringify({ supplierName: selected.supplierName, documentNumber: selected.documentNumber, documentDate: selected.documentDate, lines: selected.lines }),
      });
      setNotice("Revisión guardada.");
      await loadDocuments();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo guardar la revisión");
    } finally {
      setSaving(false);
    }
  }, [loadDocuments, selected]);

  const confirmInvoice = useCallback(async () => {
    if (!selected || !selectedWarehouseId) { setError("Selecciona un almacén"); return; }
    setSaving(true);
    setError("");
    try {
      const expiries: Record<string, string> = {};
      for (const line of selected.lines) {
        const expiry = lineExpiries[line.id];
        if (line.status !== "IGNORED" && line.matchedStockItemId && expiry) expiries[String(line.id)] = expiry;
      }
      await documentRequest(`/documents/${selected.id}/confirm-invoice`, { method: "POST", body: JSON.stringify({ warehouseId: selectedWarehouseId, lineExpiries: expiries, idempotencyKey: crypto.randomUUID() }) });
      setNotice("Factura confirmada. Compra añadida al stock.");
      setSelected(null);
      await loadDocuments();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo confirmar la factura");
    } finally {
      setSaving(false);
    }
  }, [lineExpiries, loadDocuments, selected, selectedWarehouseId]);

  const confirmRecipe = useCallback(async () => {
    if (!selected) return;
    const outputItem = itemById.get(recipeOutputItemId);
    const outputQuantity = Number(recipeOutputQuantity);
    if (!outputItem || !recipeName.trim() || !Number.isFinite(outputQuantity) || outputQuantity <= 0) {
      setError("Completa nombre, elaboración resultante y rendimiento");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await documentRequest(`/documents/${selected.id}/confirm-recipe`, { method: "POST", body: JSON.stringify({ name: recipeName.trim(), outputItemId: outputItem.id, outputQuantity, outputUnitId: outputItem.displayUnit.id }) });
      setNotice("Escandallo confirmado y receta creada.");
      setSelected(null);
      await loadDocuments();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo confirmar el escandallo");
    } finally {
      setSaving(false);
    }
  }, [itemById, loadDocuments, recipeName, recipeOutputItemId, recipeOutputQuantity, selected]);

  const reject = useCallback(async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await documentRequest(`/documents/${selected.id}/reject`, { method: "POST" });
      setSelected(null);
      setNotice("Documento rechazado.");
      await loadDocuments();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo rechazar el documento");
    } finally {
      setSaving(false);
    }
  }, [loadDocuments, selected]);

  const pendingCount = useMemo(() => documents.filter((document) => document.status === "NEEDS_REVIEW").length, [documents]);

  return (
    <section className="bo-panel" aria-labelledby="stock-ocr-title" data-ui="stock-ocr-panel">
      <div className="bo-panelHead" data-ui="stock-ocr-header">
        <div data-ui="stock-ocr-heading">
          <h2 id="stock-ocr-title" className="bo-panelTitle" data-ui="stock-ocr-title">
            <FileScan className="bo-ico" size={18} aria-hidden="true" data-ui="stock-ocr-title-icon" />
            OCR documentos
          </h2>
          <p className="bo-panelMeta" data-ui="stock-ocr-subtitle">PDF, foto o captura. Siempre requiere revisión.</p>
        </div>
        <StatusBadge variant={pendingCount ? "warning" : "neutral"} size="sm" data-ui="stock-ocr-pending">{pendingCount} pendientes</StatusBadge>
      </div>

      <div className="bo-panelBody bo-stockForm" data-ui="stock-ocr-body">
        <div className="bo-stockToolbar" data-ui="stock-ocr-upload-row">
          <FormField label="Tipo" htmlFor="stock-ocr-type">
            <select id="stock-ocr-type" className="bo-input" value={documentType} onChange={(event) => setDocumentType(event.target.value as "INVOICE" | "RECIPE")} data-testid="stock-ocr-type">
              <option value="INVOICE" data-ui="stock-ocr-type-invoice">Factura</option>
              <option value="RECIPE" data-ui="stock-ocr-type-recipe">Escandallo</option>
            </select>
          </FormField>
          <FormField className="bo-stockFilterField" label="Documento" htmlFor="stock-ocr-file">
            <input id="stock-ocr-file" className="bo-input bo-input--file" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={(event) => setFile(event.target.files?.[0] || null)} data-testid="stock-ocr-file" />
          </FormField>
          <Button variant="primary" disabled={!file || uploading} onClick={() => void upload()} data-testid="stock-ocr-upload">{uploading ? "Analizando…" : "Extraer"}</Button>
        </div>

        {error ? <InlineAlert kind="error" title="OCR" message={error} /> : null}
        {notice ? <InlineAlert kind="success" title="OCR" message={notice} /> : null}

        <div className="bo-tableWrap" data-ui="stock-ocr-list-wrap">
          <table className="bo-table" data-ui="stock-ocr-list">
            <caption className="sr-only" data-ui="stock-ocr-caption">Documentos extraídos</caption>
            <thead data-ui="stock-ocr-list-head">
              <tr data-ui="stock-ocr-list-head-row">
                <th scope="col" data-ui="stock-ocr-list-type">Tipo</th>
                <th scope="col" data-ui="stock-ocr-list-reference">Referencia</th>
                <th scope="col" data-ui="stock-ocr-list-status">Estado</th>
                <th className="end" scope="col" data-ui="stock-ocr-list-action">Acción</th>
              </tr>
            </thead>
            <tbody data-ui="stock-ocr-list-body">
              {documents.map((document) => (
                <tr key={document.id} data-ui="stock-ocr-document-row">
                  <td data-ui="stock-ocr-document-type">{document.documentType === "INVOICE" ? "Factura" : "Escandallo"}</td>
                  <td data-ui="stock-ocr-document-reference">{document.supplierName || document.documentNumber || `Documento ${document.id}`}</td>
                  <td data-ui="stock-ocr-document-status">{document.status}</td>
                  <td className="end" data-ui="stock-ocr-document-action">
                    <Button variant="ghost" size="sm" onClick={() => void openDocument(document.id)} data-testid={`stock-ocr-open-${document.id}`}>Revisar</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={selected !== null} title="Revisión OCR" onClose={() => setSelected(null)} size="lg">
        {selected ? (
          <div className="bo-stockForm" data-ui="stock-ocr-review">
            <div className="bo-stockSubsectionHead" data-ui="stock-ocr-review-header">
              <div data-ui="stock-ocr-review-heading">
                <h2 className="bo-panelTitle" data-ui="stock-ocr-review-title">Revisión {selected.documentType === "INVOICE" ? "de factura" : "de escandallo"}</h2>
                <p className="bo-stockNote" data-ui="stock-ocr-review-confidence">Confianza {selected.model || "OCR"}: {Math.round(selected.confidence * 100)}%</p>
              </div>
              {selected.originalAvailable ? (
                <span className="bo-stockRowActions" data-ui="stock-ocr-original-actions">
                  <a className="bo-btn bo-btn--ghost bo-btn--sm" href={`/api/admin/stock/documents/${selected.id}/original`} data-testid="stock-ocr-original-download">Descargar original privado</a>
                  <Button variant="danger" size="sm" disabled={saving} onClick={()=>void deleteOriginal()} data-testid="stock-ocr-original-delete">Eliminar original</Button>
                </span>
              ) : null}
            </div>

            {selected.documentType === "INVOICE" ? (
              <div className="bo-stockFormGrid bo-stockFormGrid--3" data-ui="stock-ocr-review-metadata">
                <FormField label="Proveedor" htmlFor="stock-ocr-supplier">
                  <input id="stock-ocr-supplier" className="bo-input" value={selected.supplierName} onChange={(event) => setSelected({ ...selected, supplierName: event.target.value })} data-ui="stock-ocr-supplier" />
                </FormField>
                <FormField label="Número" htmlFor="stock-ocr-number">
                  <input id="stock-ocr-number" className="bo-input" value={selected.documentNumber} onChange={(event) => setSelected({ ...selected, documentNumber: event.target.value })} data-ui="stock-ocr-number" />
                </FormField>
                <FormField label="Fecha" htmlFor="stock-ocr-date">
                  <input id="stock-ocr-date" className="bo-input" type="date" value={selected.documentDate} onChange={(event) => setSelected({ ...selected, documentDate: event.target.value })} data-ui="stock-ocr-date" />
                </FormField>
              </div>
            ) : (
              <div className="bo-stockFormGrid bo-stockFormGrid--3" data-ui="stock-ocr-recipe-metadata">
                <FormField label="Nombre" htmlFor="stock-ocr-recipe-name">
                  <input id="stock-ocr-recipe-name" className="bo-input" value={recipeName} onChange={(event) => setRecipeName(event.target.value)} data-testid="stock-ocr-recipe-name" />
                </FormField>
                <FormField label="Elaboración resultante" htmlFor="stock-ocr-recipe-output">
                  <select id="stock-ocr-recipe-output" className="bo-input" value={recipeOutputItemId} onChange={(event) => setRecipeOutputItemId(Number(event.target.value))} data-testid="stock-ocr-recipe-output">
                    <option value={0} data-ui="stock-ocr-recipe-output-empty">Selecciona artículo</option>
                    {items.map((item) => <option key={item.id} value={item.id} data-ui="stock-ocr-recipe-output-option">{item.name}</option>)}
                  </select>
                </FormField>
                <FormField label="Rendimiento" htmlFor="stock-ocr-recipe-yield">
                  <input id="stock-ocr-recipe-yield" className="bo-input" inputMode="decimal" value={recipeOutputQuantity} onChange={(event) => setRecipeOutputQuantity(event.target.value)} data-testid="stock-ocr-recipe-yield" />
                </FormField>
              </div>
            )}

            <div className="bo-stockRowList" data-ui="stock-ocr-lines">
              {selected.lines.map((line) => (
                <article className="bo-stockMovement" key={line.id} data-ui="stock-ocr-line">
                  <div className="bo-stockMovementTop" data-ui="stock-ocr-line-heading">
                    <strong data-ui="stock-ocr-line-description">{line.description}</strong>
                    <span className="bo-stockRowMeta" data-ui="stock-ocr-line-confidence">{Math.round(line.confidence * 100)}%</span>
                  </div>
                  <div className="bo-stockFormGrid bo-stockFormGrid--3" data-ui="stock-ocr-line-fields">
                    <FormField label="Cantidad" htmlFor={`stock-ocr-line-quantity-${line.id}`}>
                      <input id={`stock-ocr-line-quantity-${line.id}`} className="bo-input" inputMode="decimal" value={line.quantity} onChange={(event) => updateLine(line.id, { quantity: Number(event.target.value) })} data-ui="stock-ocr-line-quantity" />
                    </FormField>
                    <FormField label="Unidad OCR" htmlFor={`stock-ocr-line-unit-${line.id}`}>
                      <input id={`stock-ocr-line-unit-${line.id}`} className="bo-input" value={line.unit} onChange={(event) => updateLine(line.id, { unit: event.target.value })} data-ui="stock-ocr-line-unit" />
                    </FormField>
                    <FormField label="Artículo" htmlFor={`stock-ocr-item-${line.id}`}>
                      <select id={`stock-ocr-item-${line.id}`} className="bo-input" value={line.matchedStockItemId || 0} onChange={(event) => mapLineItem(line.id, Number(event.target.value))} data-testid={`stock-ocr-item-${line.id}`}>
                        <option value={0} data-ui="stock-ocr-line-item-empty">Sin asignar</option>
                        {items.map((item) => <option key={item.id} value={item.id} data-ui="stock-ocr-line-item-option">{item.name} · {item.displayUnit.label}</option>)}
                      </select>
                    </FormField>
                    {selected.documentType === "INVOICE" && line.matchedStockItemId && line.status !== "IGNORED" ? (
                      <FormField label="Caducidad" htmlFor={`stock-ocr-line-expiry-${line.id}`}>
                        <input id={`stock-ocr-line-expiry-${line.id}`} className="bo-input" type="date" value={lineExpiries[line.id] || ""} onChange={(event) => setLineExpiries((current) => ({ ...current, [line.id]: event.target.value }))} data-ui="stock-ocr-line-expiry" data-testid={`stock-ocr-line-expiry-${line.id}`} />
                      </FormField>
                    ) : null}
                  </div>
                  <label className="bo-stockCheckbox" data-ui="stock-ocr-line-ignore-label">
                    <input type="checkbox" checked={line.status === "IGNORED"} onChange={(event) => updateLine(line.id, { status: event.target.checked ? "IGNORED" : line.matchedStockItemId ? "OK" : "NEEDS_MATCH" })} data-ui="stock-ocr-line-ignore" />
                    Ignorar línea
                  </label>
                </article>
              ))}
            </div>

            <div className="bo-stockFormActions" data-ui="stock-ocr-review-actions">
              <Button variant="danger" disabled={saving} onClick={() => void reject()} data-ui="stock-ocr-reject">Rechazar</Button>
              <Button variant="secondary" disabled={saving} onClick={() => void saveReview()} data-testid="stock-ocr-save-review">Guardar revisión</Button>
              {selected.documentType === "INVOICE" ? (
                <>
                  <label className="sr-only" htmlFor="stock-ocr-warehouse" data-ui="stock-ocr-warehouse-label">Almacén</label>
                  <select id="stock-ocr-warehouse" className="bo-input" value={selectedWarehouseId} onChange={(event) => setWarehouseId(Number(event.target.value))} data-ui="stock-ocr-warehouse">
                    {warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id} data-ui="stock-ocr-warehouse-option">{warehouse.name}</option>)}
                  </select>
                  <Button variant="primary" disabled={saving || selected.lines.some((line) => line.status === "NEEDS_MATCH")} onClick={() => void confirmInvoice()} data-testid="stock-ocr-confirm">Confirmar compra</Button>
                </>
              ) : (
                <Button variant="primary" disabled={saving || selected.lines.some((line) => line.status === "NEEDS_MATCH")} onClick={() => void confirmRecipe()} data-testid="stock-ocr-confirm-recipe">Crear receta</Button>
              )}
            </div>
          </div>
        ) : <p className="bo-stockNote" data-ui="stock-ocr-review-empty">Cargando…</p>}
      </Modal>
    </section>
  );
}
