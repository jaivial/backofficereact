import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ImageOff, Plus, Search } from "lucide-react";

import { InlineAlert } from "../../../../../ui/feedback/InlineAlert";
import { Select } from "../../../../../ui/inputs/Select";
import { sheetsApi, type SheetSummary } from "./sheetsApi";

// Browse the technical sheets before committing to one.
//
// Choosing "Preparado" used to create a sheet immediately, which meant every
// mis-click left a draft behind and reusing an existing preparation was hidden
// behind a secondary button. Browsing first makes reuse the obvious path and
// creation an explicit act.

type Props = {
  onPick: (sheet: SheetSummary) => void;
  onCreate: () => void;
  productName?: string;
  /**
   * When true, "Crear ficha tecnica" is disabled. Picking an existing sheet
   * stays available: reuse never creates anything, so it does not depend on
   * the form fields a new sheet would be born with.
   */
  createDisabled?: boolean;
};

const STATUS_OPTIONS = [
  { value: "", label: "Cualquier estado" },
  { value: "PUBLISHED", label: "Publicada" },
  { value: "DRAFT", label: "Borrador" },
];

export function TechnicalSheetBrowser({ onPick, onCreate, productName = "", createDisabled = false }: Props) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [categories, setCategories] = useState<{ id: number; name: string }[]>([]);
  const [sheets, setSheets] = useState<SheetSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/stock/categories", { credentials: "include" })
      .then((response) => response.json())
      .then((body) => {
        if (cancelled) return;
        const list = Array.isArray(body.categories) ? body.categories : [];
        setCategories(list.filter((entry: { isActive?: boolean }) => entry.isActive !== false));
      })
      // A missing category list only costs one filter, so it is not surfaced as
      // an error over the results.
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  // Debounced so typing does not fire a request per keystroke.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(() => {
      sheetsApi
        .list({
          q: query.trim(),
          status: status as "" | "DRAFT" | "PUBLISHED",
          categoryId: categoryId ? Number(categoryId) : null,
        })
        .then((body) => {
          if (!cancelled) {
            setSheets(body.sheets ?? []);
            setError("");
          }
        })
        .catch((err: Error) => {
          if (!cancelled) setError(err.message || "No se pudieron cargar las fichas tecnicas");
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [categoryId, query, status]);

  const categoryOptions = useMemo(
    () => [
      { value: "", label: "Todas las categorias" },
      ...categories.map((entry) => ({ value: String(entry.id), label: entry.name })),
    ],
    [categories],
  );

  const summarise = useCallback((sheet: SheetSummary) => {
    const parts = [`${sheet.portions} raciones`];
    if (sheet.componentCount > 0) parts.push(`${sheet.componentCount} ingredientes`);
    if (sheet.stepCount > 0) parts.push(`${sheet.stepCount} pasos`);
    if (sheet.categoryName) parts.push(sheet.categoryName);
    return parts.join(" · ");
  }, []);

  return (
    <div
      className="bo-stack bo-sheetBrowser animate-boFadeIn"
      data-ui="technical-sheet-browser"
      data-testid="technical-sheet-browser"
    >
      <div data-slot="technicalSheetBrowser-sheetBrowser-head" className="bo-sheetBrowser__head">
        <div data-slot="technicalSheetBrowser-sheetBrowser-filters" className="bo-sheetBrowser__filters">
          <div data-slot="technicalSheetBrowser-sheetSearchField" className="bo-sheetSearchField">
            <Search size={14} aria-hidden="true" />
            <input data-testid="buscar-ficha-tecnica"
              type="search"
              className="bo-input"
              aria-label="Buscar ficha tecnica"
              placeholder={productName ? `Buscar ficha para ${productName}...` : "Buscar ficha..."}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <Select
            value={categoryId}
            onChange={setCategoryId}
            options={categoryOptions}
            ariaLabel="Categoria"
          />
          <Select value={status} onChange={setStatus} options={STATUS_OPTIONS} ariaLabel="Estado" />
        </div>

        {/* Top right, so it is found without scrolling past the results. */}
        <button
          type="button"
          className="bo-btn bo-btn--primary bo-sheetBrowser__create"
          data-role="sheet-browser-create"
          onClick={onCreate}
          disabled={createDisabled}
        >
          <Plus size={14} aria-hidden="true" />
          Crear ficha tecnica
        </button>
      </div>

      {error ? <InlineAlert kind="error" title={error} /> : null}

      {loading ? (
        <p className="bo-sheetHint" data-role="sheet-browser-loading">
          Cargando fichas tecnicas...
        </p>
      ) : null}

      {!loading && sheets.length === 0 ? (
        <p className="bo-sheetHint" data-role="sheet-browser-empty">
          No hay fichas tecnicas que coincidan. Crea una nueva para empezar.
        </p>
      ) : null}

      {sheets.length > 0 ? (
        <ul className="bo-sheetCardGrid" data-ui="sheet-browser-list">
          {sheets.map((sheet) => (
            <li data-slot="technicalSheetBrowser-li" key={sheet.id}>
              <button
                type="button"
                className="bo-sheetCard"
                data-testid={`sheet-card-${sheet.id}`}
                data-role="sheet-browser-card"
                onClick={() => onPick(sheet)}
              >
                <span data-slot="technicalSheetBrowser-sheetCard-media" className="bo-sheetCard__media">
                  {sheet.imageUrl ? (
                    <img src={sheet.imageUrl} alt="" loading="lazy" />
                  ) : (
                    <span data-slot="technicalSheetBrowser-sheetCard-placeholder" className="bo-sheetCard__placeholder" aria-hidden="true">
                      <ImageOff size={18} />
                    </span>
                  )}
                </span>
                <span data-slot="technicalSheetBrowser-sheetCard-body" className="bo-sheetCard__body">
                  <span data-slot="technicalSheetBrowser-sheetCard-name" className="bo-sheetCard__name">{sheet.name}</span>
                  <span data-slot="technicalSheetBrowser-sheetCard-meta" className="bo-sheetCard__meta">{summarise(sheet)}</span>
                  {/* Status in words, not colour alone. */}
                  <span data-slot="technicalSheetBrowser-span"
                    className={`bo-sheetCard__status bo-sheetCard__status--${sheet.status.toLowerCase()}`}
                  >
                    {sheet.status === "DRAFT" ? "Borrador" : "Publicada"}
                  </span>
                  {/* Stating the reuse count is what makes picking a shared sheet
                      an informed choice rather than a surprise. */}
                  {sheet.usageCount > 0 ? (
                    <span data-slot="technicalSheetBrowser-sheetCard-usage" className="bo-sheetCard__usage">
                      Usada por {sheet.usageCount} producto{sheet.usageCount === 1 ? "" : "s"}
                    </span>
                  ) : null}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
