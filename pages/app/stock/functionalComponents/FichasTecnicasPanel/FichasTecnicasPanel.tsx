import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, ChefHat, ClipboardList } from "lucide-react";

import { usePageContext } from "vike-react/usePageContext";
import { Button } from "../../../../../ui/actions/Button";
import { EmptyState } from "../../../../../ui/feedback/EmptyState";
import { InlineAlert } from "../../../../../ui/feedback/InlineAlert";
import { LoadingSpinner } from "../../../../../ui/feedback/LoadingSpinner";
import { StatusBadge } from "../../../../../ui/feedback/StatusBadge";
import { TechnicalSheetEditor } from "../../../comida/_components/TechnicalSheet/TechnicalSheetEditor";
import {
  sheetsApi,
  type SheetSummary,
} from "../../../comida/_components/TechnicalSheet/sheetsApi";

// "Fichas tecnicas" tab: a card per elaborated product (every plato/postre that
// has a DRAFT/ACTIVE technical sheet). Clicking a card opens that sheet's editor
// in the SAME UI used to create it, addressed by the ?ficha=<id> URL query so
// the view is shareable / deep-linkable.

function sheetStatusLabel(status: string): string {
  if (status === "PUBLISHED") return "Publicada";
  return "Borrador";
}

function useFichaQuery(): [number | null, (id: number | null) => void] {
  const pageContext = usePageContext();
  const initial = Number(pageContext.urlParsed.search.ficha || "");
  const [selectedId, setSelectedId] = useState<number | null>(Number.isFinite(initial) && initial > 0 ? initial : null);

  const update = useCallback((id: number | null) => {
    setSelectedId(id);
    const url = new URL(window.location.href);
    if (id == null) url.searchParams.delete("ficha");
    else url.searchParams.set("ficha", String(id));
    window.history.pushState({}, "", url.pathname + url.search);
  }, []);

  return [selectedId, update];
}

export function FichasTecnicasPanel() {
  const [sheets, setSheets] = useState<SheetSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useFichaQuery();

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await sheetsApi.list();
      setSheets(data.sheets || []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudieron cargar las fichas tecnicas");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const selectedSheet = useMemo(
    () => (selectedId == null ? null : sheets.find((sheet) => sheet.id === selectedId) ?? null),
    [selectedId, sheets],
  );

  if (selectedId != null) {
    return (
      <section className="bo-panel" aria-label="Ficha tecnica" data-ui="ficha-tecnica-detail">
        <div className="bo-panelHead" data-ui="ficha-detail-header">
          <button
            type="button"
            className="bo-stockIconBtn"
            aria-label="Volver a las fichas tecnicas"
            onClick={() => setSelectedId(null)}
            data-testid="ficha-back"
          >
            <ArrowLeft size={18} aria-hidden="true" />
          </button>
          <h2 className="bo-panelTitle" data-ui="ficha-detail-title">
            {selectedSheet?.name || "Ficha tecnica"}
          </h2>
          {selectedSheet ? (
            <StatusBadge variant={selectedSheet.status === "PUBLISHED" ? "success" : "neutral"} size="sm" data-ui="ficha-detail-status">
              {sheetStatusLabel(selectedSheet.status)}
            </StatusBadge>
          ) : null}
        </div>
        <div className="bo-panelBody" data-ui="ficha-detail-body">
          {selectedSheet ? (
            <TechnicalSheetEditor sheetId={selectedSheet.id} sheetName={selectedSheet.name} />
          ) : (
            <LoadingSpinner centered size="sm" label="Cargando ficha tecnica…" />
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="bo-panel" aria-label="Fichas tecnicas" data-ui="fichas-tecnicas">
      <div className="bo-panelHead" data-ui="fichas-header">
        <h2 className="bo-panelTitle" data-ui="fichas-title">Fichas tecnicas</h2>
        <span className="bo-stockMuted" data-ui="fichas-count">{sheets.length} fichas</span>
      </div>
      <div className="bo-panelBody" data-ui="fichas-body">
        {error ? <InlineAlert kind="error" title={error} /> : null}
        {loading ? (
          <LoadingSpinner centered size="sm" label="Cargando fichas tecnicas…" />
        ) : sheets.length === 0 ? (
          <EmptyState
            icon={<ClipboardList size={32} aria-hidden="true" />}
            title="Sin fichas tecnicas"
            description="Los platos y postres elaborados apareceran aqui como fichas tecnicas."
            data-ui="fichas-empty"
          />
        ) : (
          <div className="bo-stockGrid" data-ui="fichas-grid">
            {sheets.map((sheet) => (
              <article
                key={sheet.id}
                className="bo-card bo-stockItemCard"
                data-ui="ficha-card"
                role="button"
                tabIndex={0}
                onClick={() => setSelectedId(sheet.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setSelectedId(sheet.id);
                  }
                }}
              >
                <div className="bo-stockItemHead" data-ui="ficha-card-header">
                  <div data-ui="ficha-card-heading">
                    <h3 className="bo-stockItemName" data-ui="ficha-card-name">{sheet.name}</h3>
                    <p className="bo-stockItemMeta" data-ui="ficha-card-meta">
                      {sheet.categoryName || "Elaborado"}
                      {sheet.status ? ` · ${sheetStatusLabel(sheet.status)}` : ""}
                    </p>
                  </div>
                  <ChefHat size={18} className="bo-stockCardIco" aria-hidden="true" data-ui="ficha-card-icon" />
                </div>
                <div className="bo-stockItemMeta" data-ui="ficha-card-stats">
                  {sheet.componentCount} ingredientes · {sheet.stepCount} pasos
                  {sheet.allergens?.length ? ` · ${sheet.allergens.length} alergenos` : ""}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
