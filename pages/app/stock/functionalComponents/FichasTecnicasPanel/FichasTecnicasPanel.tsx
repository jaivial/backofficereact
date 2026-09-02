import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ChevronRight, ChefHat, ClipboardList, Search as SearchIcon } from "lucide-react";

import { usePageContext } from "vike-react/usePageContext";
import { Button } from "../../../../../ui/actions/Button";
import { EmptyState } from "../../../../../ui/feedback/EmptyState";
import { InlineAlert } from "../../../../../ui/feedback/InlineAlert";
import { LoadingSpinner } from "../../../../../ui/feedback/LoadingSpinner";
import { StatusBadge } from "../../../../../ui/feedback/StatusBadge";
import { TechnicalSheetEditor } from "../../../comida/_components/TechnicalSheet/TechnicalSheetEditor";
import {
  sheetsApi,
  type SheetListFilters,
  type SheetSummary,
} from "../../../comida/_components/TechnicalSheet/sheetsApi";
import { useSheetImageSocket } from "../../../comida/_components/TechnicalSheet/useSheetImageSocket";
import { createClient } from "../../../../../api/client";

// "Fichas tecnicas" tab: a card per elaborated product (every plato/postre that
// has a DRAFT/ACTIVE technical sheet). Clicking a card opens that sheet's editor
// in the SAME UI used to create it, addressed by the ?ficha=<id> URL query so
// the view is shareable / deep-linkable.
//
// The grid pages server-side (page/pageSize, like the inventory tab) and
// hydrates its "show images" switch from the preferences the list response
// carries; toggling the switch persists it per user + active restaurant. The
// websocket only notifies: any image-job frame re-reads the current page over
// REST, which stays the source of truth.

const SHEETS_PAGE_SIZE = 24;

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

  // Pagination: page is 1-based; total/totalPages come from the server so the
  // pager knows where the end is without fetching everything.
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Whether each card renders its picture. Optimistic default until the list
  // response hydrates the stored preference once; after that the switcher is
  // the user's and is persisted on toggle.
  const [showImages, setShowImages] = useState(true);
  const prefsHydrated = useRef(false);
  // Snapshot of the last committed showImages value, so a failed persistence
  // can revert to the literal pre-click value rather than the inverted state
  // (which breaks if two .catch handlers queue back-to-back).
  const lastShownRef = useRef(showImages);

  const [categoryFilters, setCategoryFilters] = useState<{id: number; name: string}[]>([]);
  const [categoryId, setCategoryId] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<"" | "DRAFT" | "PUBLISHED">("");
  const [searchQuery, setSearchQuery] = useState("");
  // After the first successful list response, subsequent reloads render in
  // place (small "actualizando" hint next to the count) instead of blanking
  // the grid with a full spinner.
  const [refreshing, setRefreshing] = useState(false);

  // WS-driven reloads bump reloadCount; listing reloadCount in the effect's deps
  // routes ws frames through the same 250ms debounced fetch path as user-driven
  // filter changes, so burst frames coalesce and the cancelled-flag race guard
  // still applies between the two sources.
  const [reloadCount, setReloadCount] = useState(0);
  const triggerReload = useCallback(() => setReloadCount((value) => value + 1), []);

  useEffect(() => {
    let cancelled = false;
    const isInitial = !prefsHydrated.current;
    if (isInitial) {
      setLoading(true);
      setError("");
    } else {
      setRefreshing(true);
    }
    const fetchPage = async () => {
      try {
        const params: SheetListFilters = { page, pageSize: SHEETS_PAGE_SIZE };
        if (statusFilter) params.status = statusFilter;
        if (categoryId !== "") params.categoryId = Number(categoryId);
        if (searchQuery.trim()) params.q = searchQuery.trim();
        const data = await sheetsApi.list(params);
        if (cancelled) return;
        setSheets(data.sheets || []);
        setTotal(data.total ?? (data.sheets || []).length);
        setTotalPages(Math.max(1, data.totalPages ?? 1));
        if (!prefsHydrated.current) {
          prefsHydrated.current = true;
          // Absent preference means "never toggled": images stay on.
          setShowImages(data.preferences?.stockSheetsShowImages !== "0");
        }
      } catch (reason) {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "No se pudieron cargar las fichas tecnicas");
      } finally {
        if (!cancelled) {
          if (isInitial) setLoading(false);
          else setRefreshing(false);
        }
      }
    };
    const timer = setTimeout(fetchPage, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [categoryId, statusFilter, searchQuery, page, reloadCount]);

  // One socket per tenant: only while the grid is visible. When the ficha
  // editor opens, its own useSheetImageSocket takes the same connection.
  useSheetImageSocket({ enabled: selectedId == null }, triggerReload);

  // Fetch categories once
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

  // New filters mean a different list: back to the first page and drop any
  // open sheet so the grid is what the user sees. The first render is a no-op
  // — selectedId is already seeded from ?ficha=, and zeroing it on mount
  // would strip the deep-link before the URL reflects it.
  const firstFilterRender = useRef(true);
  useEffect(() => {
    if (firstFilterRender.current) {
      firstFilterRender.current = false;
      return;
    }
    setPage(1);
    setSelectedId(null);
  }, [categoryId, statusFilter, searchQuery, setSelectedId]);

  const api = useMemo(() => createClient(), []);

  const toggleShowImages = useCallback((next: boolean) => {
    // Snapshot the committed value before the optimistic flip so a failed
    // persistence reverts to the literal pre-click state even when two clicks
    // queue .catch handlers back-to-back (the old `(current) => !next` form
    // inverted each catch independently and could leave the toggle on a value
    // nobody asked for).
    const previous = lastShownRef.current;
    setShowImages(next);
    // PUT /api/admin/me/preferences has one client-side path; the
    // sheets-scoped duplicate was removed to share this endpoint with the
    // other preferences UIs in the backoffice.
    void api.auth.setPreference("stockSheetsShowImages", next ? "1" : "0").catch(() => {
      setShowImages(previous);
      setError("No se pudo guardar la preferencia");
    });
  }, [api.auth]);
  useEffect(() => {
    lastShownRef.current = showImages;
  }, [showImages]);

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

        {/* Show/hide the card pictures; persisted per user + restaurant. */}
        <label className="bo-fichasImagesToggle" data-ui="fichas-images-toggle">
          <input
            type="checkbox"
            role="switch"
            checked={showImages}
            onChange={(e) => toggleShowImages(e.target.checked)}
            data-ui="fichas-show-images"
            data-testid="fichas-show-images"
            aria-label="Mostrar imágenes"
          />
          <span>Mostrar imágenes</span>
        </label>
      </div>
    );
  };

  return (
    <section className="bo-panel" aria-label="Fichas tecnicas" data-ui="fichas-tecnicas">
      <div className="bo-panelHead" data-ui="fichas-header">
        <h2 className="bo-panelTitle" data-ui="fichas-title">Fichas tecnicas</h2>
        <span className="bo-stockMuted" data-ui="fichas-count">
          {refreshing ? `${total} fichas · actualizando` : `${total} fichas`}
        </span>
      </div>
      <div className="bo-panelBody" data-ui="fichas-body">
        {renderFiltersBar()}

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
                {showImages && sheet.imageUrl ? (
                  <img
                    className="bo-fichaCardImage"
                    src={sheet.imageUrl}
                    alt=""
                    loading="lazy"
                    data-ui="ficha-card-image"
                    data-testid="ficha-card-image"
                  />
                ) : null}
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

        {total > 0 ? (
          <nav className="bo-pager" aria-label="Paginación de fichas" data-ui="fichas-pagination">
            <span className="bo-pagerText" data-ui="fichas-page-count">Página {page} de {totalPages}</span>
            <div className="bo-pagerBtns" data-ui="fichas-pager-buttons">
              <Button variant="ghost" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} data-ui="fichas-page-previous" data-testid="fichas-page-previous">Anterior</Button>
              <Button variant="ghost" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)} data-ui="fichas-page-next" data-testid="fichas-page-next">Siguiente</Button>
            </div>
          </nav>
        ) : null}
      </div>
    </section>
  );
}
