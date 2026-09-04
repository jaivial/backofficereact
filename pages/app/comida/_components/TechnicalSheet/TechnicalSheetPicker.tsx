import React, { useCallback, useEffect, useState } from "react";

import { Button } from "../../../../../ui/actions/Button";
import { InlineAlert } from "../../../../../ui/feedback/InlineAlert";
import { FormField } from "../../../../../ui/inputs/FormField";
import { sheetsApi, type SheetSummary } from "./sheetsApi";

// Picking an existing sheet offers two very different actions on purpose
// (decision #5). "Duplicar y editar" is the safe default: the product gets its
// own copy, so tuning this dish can never silently change another one.
// "Vincular directamente" is offered because sometimes two products genuinely
// are the same preparation - but the usage count makes the consequence visible
// before the click, not after.

type Props = {
  itemId: number;
  onLinked: (sheetId: number) => void;
  onClose: () => void;
  /** Which catalogue the id belongs to; wine and postres are separate tables. */
  source?: "comida" | "vinos" | "postres";
};

export function TechnicalSheetPicker({ itemId, onLinked, onClose, source = "comida" }: Props) {
  const [query, setQuery] = useState("");
  const [sheets, setSheets] = useState<SheetSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    sheetsApi
      .list(query)
      .then((body) => {
        if (!cancelled) setSheets(body.sheets ?? []);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [query]);

  const link = useCallback(
    async (sheet: SheetSummary, duplicate: boolean) => {
      setBusyId(sheet.id);
      setError("");
      try {
        const targetId = duplicate
          ? (await sheetsApi.duplicate(sheet.id, `${sheet.name} (copia)`)).sheetId
          : sheet.id;
        await sheetsApi.setProductionType(itemId, "MANUFACTURED", targetId, source);
        onLinked(targetId);
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudo vincular la ficha");
      } finally {
        setBusyId(null);
      }
    },
    [itemId, onLinked, source],
  );

  return (
    <div className="bo-stack" data-ui="technical-sheet-picker" data-testid="technical-sheet-picker">
      <FormField label="Buscar ficha tecnica" htmlFor="sheet-search">
        <input data-testid="nombre-de-la-ficha"
          id="sheet-search"
          className="bo-input"
          type="search"
          value={query}
          placeholder="Nombre de la ficha"
          onChange={(event) => setQuery(event.currentTarget.value)}
        />
      </FormField>

      {error ? <InlineAlert kind="error" title={error} /> : null}

      {loading ? <p className="bo-muted">Cargando fichas tecnicas...</p> : null}

      {!loading && sheets.length === 0 ? (
        <p data-slot="technicalSheetPicker-muted" className="bo-muted">No hay fichas tecnicas que coincidan con la busqueda.</p>
      ) : null}

      <ul data-slot="technicalSheetPicker-sheetPicker-list" className="bo-sheetPicker__list">
        {sheets.map((sheet) => (
          <li data-slot="technicalSheetPicker-sheetPicker-item" key={sheet.id} className="bo-sheetPicker__item">
            <div data-slot="technicalSheetPicker-sheetPicker-info" className="bo-sheetPicker__info">
              <span data-slot="technicalSheetPicker-sheetPicker-name" className="bo-sheetPicker__name">{sheet.name}</span>
              <span data-slot="technicalSheetPicker-muted" className="bo-muted">
                {sheet.portions} raciones · {sheet.status === "DRAFT" ? "Borrador" : "Publicada"}
              </span>
              {/* Stating the reuse count up front is what makes the direct-link
                  option safe to offer at all. */}
              {sheet.usageCount > 0 ? (
                <span data-slot="technicalSheetPicker-sheetPicker-usage" className="bo-sheetPicker__usage">
                  Usada por {sheet.usageCount} producto{sheet.usageCount === 1 ? "" : "s"}: al
                  vincularla directamente, los cambios afectaran a todos.
                </span>
              ) : null}
            </div>
            <div data-slot="technicalSheetPicker-sheetPicker-actions" className="bo-sheetPicker__actions">
              <Button
                variant="primary"
                disabled={busyId === sheet.id}
                onClick={() => void link(sheet, true)}
              >
                Duplicar y editar
              </Button>
              <Button
                variant="ghost"
                disabled={busyId === sheet.id}
                onClick={() => void link(sheet, false)}
              >
                Vincular directamente
              </Button>
            </div>
          </li>
        ))}
      </ul>

      <div data-slot="technicalSheetPicker-row" className="bo-row">
        <Button variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}
