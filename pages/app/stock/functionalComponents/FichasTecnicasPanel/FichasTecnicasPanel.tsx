import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, ChevronRight, ChefHat, ClipboardList, LayoutList, Search as SearchIcon } from "lucide-react";

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

  // Filters state
  const [categoryFilters, setCategoryFilters] = useState<{id: number; name: string}[]>([]);
  const [categoryId, setCategoryId] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<"" | "DRAFT" | "PUBLISHED">("");
  const [searchQuery, setSearchQuery] = useState("");
  const [filtering, setFiltering] = useState(false);

  // Fetch categories on mount
  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/stock/categories", { credentials: "include" })
      .then((r) => r.json())
      .then((body) => {
        if (!cancelled && Array.isArray(body.categories)) {
          setCategoryFilters(body.categories.filter((c: any) => c.isActive !== false));
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // Debounced filter search via API
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    setFiltering(true);
    timer = setTimeout(async () => {
      try {
        setLoading(true);
        setError("");
        const params: Record<string, string> = {};
        if (statusFilter) params.status = statusFilter;
        if (categoryId && categoryId !== "") params.categoryId = categoryId;
        if (searchQuery.trim()) params.q = searchQuery.trim();
        const data = await sheetsApi.list(params);
        setSheets(data.sheets || []);
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "No se pudieron cargar las fichas tecnicas");
      } finally {
        setFiltering(false);
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [categoryId, statusFilter, searchQuery]);

  // Clear selectedId when filters change
  useEffect(() => { setSelectedId(null); }, [categoryId, statusFilter, searchQuery]);

  // Filter bar component
  const renderFiltersBar = () => {
    const categoryOptions = categoryFilters.map((cat) => ({ value: String(cat.id), label: cat.name }));
    return (
      <div className="bo-fichasFiltersBar" data-ui="fichas-filters">
        <select
          className="bo-input bo-fichasFilterSelect"
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          data-ui="fichas-filter-category"
          aria-label="Categoria"
        >
          <option value="">Todas las categorias</option>
          {categoryOptions.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
        </select>

        {/* Status segmented control */}
        <div className="bo-fichasStatusSeg" data-ui="fichas-filters-status">
          <button
            type="button"
            className={`bo-fichasSegBtn ${statusFilter === "" || statusFilter === undefined ? "is-active" : ""}`}
            data-ui="fichas-status-all"
            onClick={() => setStatusFilter("")}
          >
            Todos
          </button>
          <button
            type="button"
            className={`bo-fichasSegBtn ${statusFilter === "DRAFT" ? "is-active" : ""}`}
            data-ui="fichas-status-draft"
            onClick={() => setStatusFilter("DRAFT")}
          >
            Borrador
          </button>
          <button
            type="button"
            className={`bo-fichasSegBtn ${statusFilter === "PUBLISHED" ? "is-active" : ""}`}
            data-ui="fichas-status-published"
            onClick={() => setStatusFilter("PUBLISHED")}
          >
            Publicada
          </button>
        </div>

        <div className="bo-fichasSearchWrap" data-ui="fichas-filters-search">
          <SearchIcon size={16} className="bo-fichasSearchIco" aria-hidden="true" />
          <input
            className="bo-input bo-fichasSearchInput"
            placeholder="Buscar por nombre..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            data-ui="fichas-search-input"
            aria-label="Buscar ficha"
          />
        </div>
      </div>
    );
  };

  return (
    <section className="bo-panel" aria-label="Fichas tecnicas" data-ui="fichas-tecnicas">
      <div className="bo-panelHead" data-ui="fichas-header">
        <h2 className="bo-panelTitle" data-ui="fichas-title">Fichas tecnicas</h2>
        <span className="bo-stockMuted" data-ui="fichas-count">{sheets.length} fichas</span>
      </div>
      <div className="bo-panelBody" data-ui="fichas-body">
        {renderFiltersBar()}

        {error ? <InlineAlert kind="error" title={error} /> : null}
        {(loading || filtering) ? (
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
                <ChevronRight size={18} className="bo-fichaArrow" aria-hidden="true" data-ui="ficha-card-arrow" />
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
