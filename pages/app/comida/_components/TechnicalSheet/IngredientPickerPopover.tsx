import React, { useCallback, useEffect, useState } from "react";
import { Search } from "lucide-react";

import { Button } from "../../../../../ui/actions/Button";
import { InlineAlert } from "../../../../../ui/feedback/InlineAlert";
import { Popover } from "../../../../../ui/overlays/Popover";
import { sheetsApi } from "./sheetsApi";

// Search the stock catalogue and attach one item to the sheet as an ingredient.
//
// It searches stock items rather than the comida catalogue because stock is
// what a recipe actually consumes; the backfill made every catalogue product a
// stock item, so both are reachable from here.

type StockSearchItem = {
  id: number;
  name: string;
  sku: string;
  baseUnit: string;
  displayUnit?: { id: number; code: string; label: string };
};

type Props = {
  open: boolean;
  anchorRef: React.RefObject<HTMLElement | null>;
  sheetId: number;
  onClose: () => void;
  onAdded: () => void;
  className?: string;
};

export function IngredientPickerPopover({
  open,
  anchorRef,
  sheetId,
  onClose,
  onAdded,
  className,
}: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<StockSearchItem[]>([]);
  const [searched, setSearched] = useState(false);
  const [selected, setSelected] = useState<StockSearchItem | null>(null);
  const [quantity, setQuantity] = useState("");
  const [waste, setWaste] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Debounced so typing does not fire a request per keystroke.
  useEffect(() => {
    if (!open) return;
    const term = query.trim();
    if (term.length < 2) {
      setResults([]);
      setSearched(false);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/admin/stock/items?q=${encodeURIComponent(term)}&pageSize=20`,
          { credentials: "include" },
        );
        const body = await response.json();
        if (cancelled) return;
        setResults(Array.isArray(body.items) ? body.items : []);
        setSearched(true);
      } catch {
        if (!cancelled) {
          setError("No se pudo buscar en el inventario");
          setSearched(true);
        }
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [open, query]);

  // Reopening should not show the previous search or a half-filled form.
  useEffect(() => {
    if (open) return;
    setQuery("");
    setResults([]);
    setSearched(false);
    setSelected(null);
    setQuantity("");
    setWaste("");
    setError("");
  }, [open]);

  const quantityValue = Number(quantity.replace(",", "."));
  const canAdd = selected != null && Number.isFinite(quantityValue) && quantityValue > 0 && !busy;

  const add = useCallback(async () => {
    if (!selected || !canAdd) return;
    setBusy(true);
    setError("");
    try {
      await sheetsApi.addComponent(sheetId, {
        stockItemId: selected.id,
        quantity: quantityValue,
        unitId: selected.displayUnit?.id,
        wastePct: Number(waste.replace(",", ".")) || 0,
      });
      onAdded();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo anadir el ingrediente");
    } finally {
      setBusy(false);
    }
  }, [canAdd, onAdded, onClose, quantityValue, selected, sheetId, waste]);

  return (
    <Popover
      open={open}
      anchorRef={anchorRef}
      onClose={onClose}
      ariaLabel="Anadir ingrediente"
      // Sized to its results: a short product name should not be padded out to a
      // fixed width, and a long one should have room up to the cap.
      minWidthPx={300}
      maxWidthPx={420}
      className={className}
      data-testid="ingredient-picker-popover"
    >
      <div className="bo-popover__head">
        <h4 className="bo-popover__title">Anadir ingrediente</h4>
      </div>

      <div className="bo-popover__body">
        <div className="bo-sheetSearchField">
          <Search size={14} aria-hidden="true" />
          <input
            type="search"
            className="bo-input"
            aria-label="Buscar producto"
            placeholder="Buscar producto..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>

        {error ? <InlineAlert kind="error" title={error} /> : null}

        {searched && results.length === 0 ? (
          <p className="bo-popover__empty">Ningun producto coincide con la busqueda.</p>
        ) : null}

        {results.length > 0 ? (
          <ul className="bo-sheetSearchList">
            {results.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className={`bo-sheetSearchItem${selected?.id === item.id ? " is-selected" : ""}`}
                  aria-pressed={selected?.id === item.id}
                  onClick={() => setSelected(item)}
                >
                  <span className="bo-sheetSearchItem__name">{item.name}</span>
                  <span className="bo-sheetSearchItem__unit">
                    {item.displayUnit?.code || item.baseUnit}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        {selected ? (
          <div className="bo-sheetSearchForm">
            <div className="bo-field">
              <label className="bo-label" htmlFor="ingredient-qty">
                Cantidad ({selected.displayUnit?.code || selected.baseUnit})
              </label>
              <input
                id="ingredient-qty"
                type="number"
                min="0"
                step="0.01"
                className="bo-input"
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
                placeholder="0"
              />
            </div>
            <div className="bo-field">
              <label className="bo-label" htmlFor="ingredient-waste">
                Merma (%)
              </label>
              <input
                id="ingredient-waste"
                type="number"
                min="0"
                max="99"
                step="0.1"
                className="bo-input"
                value={waste}
                onChange={(event) => setWaste(event.target.value)}
                placeholder="0"
              />
            </div>
          </div>
        ) : null}

        <Button
          className="bo-sheetSearchSubmit"
          variant="primary"
          disabled={!canAdd}
          onClick={() => void add()}
        >
          {busy ? "Anadiendo..." : "Anadir ingrediente"}
        </Button>
      </div>
    </Popover>
  );
}
