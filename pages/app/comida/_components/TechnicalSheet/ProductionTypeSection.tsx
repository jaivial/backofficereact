import React, { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft } from "lucide-react";

import { ProductionTypeToggle, type ProductionType } from "./ProductionTypeToggle";
import { TechnicalSheetBrowser } from "./TechnicalSheetBrowser";
import { TechnicalSheetEditor } from "./TechnicalSheetEditor";
import { sheetsApi, type SheetOutputUnit, type SheetSummary } from "./sheetsApi";
import { InlineAlert } from "../../../../../ui/feedback/InlineAlert";

// The "Tipo de producto" section, shared by every product editor.
//
// The switch is ALWAYS rendered: it is the entry point to technical sheets, so
// hiding it for any product type would silently remove the feature there. When
// the product is Preparado, the three subtabs render inline, in the same modal,
// rather than behind another dialog.

type Props = {
  /** Null while the product is being created: there is no id to link a sheet to yet. */
  itemId: number | null;
  productionType: ProductionType;
  stockRecipeId: number | null;
  onChange: (next: ProductionType) => void;
  onSheetLinked?: (sheetId: number) => void;
  /**
   * Reports the whole chosen sheet so the product form can be filled from it.
   * Separate from onSheetLinked, which only needs the id.
   */
  onSheetPicked?: (sheet: SheetSummary) => void;
  /** The open sheet's effective allergens, so the product grid can follow them. */
  onSheetAllergensChange?: (effective: string[]) => void;
  /** Which catalogue table the id belongs to; wine and postres are separate. */
  source?: "comida" | "vinos" | "postres";
  productName?: string;
  /**
   * Output-unit details applied when a new sheet is created from here (stock
   * creation). Omitted for existing products: their sheet already exists.
   */
  sheetOutputUnit?: SheetOutputUnit;
  /**
   * When true, creating a new sheet is disabled (picking an existing one is
   * still allowed). Stock creation uses it while the form's unit data is not
   * valid enough to persist into a brand-new sheet.
   */
  sheetCreateDisabled?: boolean;
  disabled?: boolean;
};

export function ProductionTypeSection({
  itemId,
  productionType,
  stockRecipeId,
  onChange,
  onSheetLinked,
  onSheetPicked,
  onSheetAllergensChange,
  source = "comida",
  productName = "",
  sheetOutputUnit,
  sheetCreateDisabled = false,
  disabled,
}: Props) {
  const [creating, setCreating] = useState(false);
  // The sheet this section is showing. The parent is still told via
  // onSheetLinked and remains the source of truth, but holding it here means the
  // editor can open immediately instead of waiting for a round trip.
  const [openSheetId, setOpenSheetId] = useState<number | null>(null);
  // True once this section has shown the list, which is what makes "Volver"
  // meaningful: there is somewhere to go back to.
  const [browsing, setBrowsing] = useState(false);
  const [createError, setCreateError] = useState("");
  // Guards a second create while the first is in flight, which would leave an
  // orphan sheet behind.
  const creatingRef = useRef(false);

  const isPreparado = productionType === "MANUFACTURED";
  // A product that arrived already linked opens straight into its sheet: asking
  // it to browse again would hide the recipe behind a search box.
  //
  // `browsing` wins over the parent's link, because the parent records the link
  // the moment a sheet is chosen; without this, "Volver" could never show the
  // list again.
  const activeSheetId = browsing ? openSheetId : stockRecipeId ?? openSheetId;

  // Switching back to Materia prima forgets the sheet that was open, so
  // returning to Preparado starts from the list rather than a stale editor.
  useEffect(() => {
    if (!isPreparado) {
      setOpenSheetId(null);
      setBrowsing(false);
      setCreateError("");
      return;
    }
    // Preparado on a product with no sheet lands on the list, so from here on
    // there is a list to go back to.
    if (stockRecipeId == null) setBrowsing(true);
  }, [isPreparado, stockRecipeId]);

  const pickSheet = useCallback(
    (sheet: SheetSummary) => {
      setOpenSheetId(sheet.id);
      // The parent fills the product form from the sheet and persists the link.
      onSheetPicked?.(sheet);
      onSheetLinked?.(sheet.id);
    },
    [onSheetLinked, onSheetPicked],
  );

  const createSheet = useCallback(() => {
    if (creatingRef.current) return;
    creatingRef.current = true;
    setCreating(true);
    setCreateError("");

    // A saved product uses the idempotent server endpoint, which creates AND
    // links in one call - doing that client-side in two steps raced with itself
    // and left orphan sheets behind. An unsaved product still gets its sheet
    // now; the parent links it on save.
    const request =
      itemId != null
        ? sheetsApi
            .ensureForProduct(itemId, productName.trim() || "Ficha tecnica", source)
            .then((ensured) => ensured.sheetId)
        : sheetsApi
            .create(productName.trim() || "Ficha tecnica", 1, sheetOutputUnit)
            .then((created) => created.sheetId);

    request
      .then((sheetId) => {
        setOpenSheetId(sheetId);
        onSheetLinked?.(sheetId);
      })
      .catch((err: Error) => {
        setCreateError(err.message || "No se pudo crear la ficha tecnica");
      })
      .finally(() => {
        creatingRef.current = false;
        setCreating(false);
      });
  }, [itemId, onSheetLinked, productName, sheetOutputUnit, source]);

  return (
    <section
      className="bo-productionSection"
      data-ui="production-type-section"
      data-testid="production-type-section"
    >
      <span className="bo-label" data-role="production-section-label">
        Tipo de producto
      </span>

      <ProductionTypeToggle
        itemId={itemId ?? 0}
        productionType={productionType}
        stockRecipeId={stockRecipeId}
        source={source}
        onChange={onChange}
        // A product with no id cannot be persisted yet; the choice is still
        // captured and applied when the product is first saved.
        deferSave={itemId == null}
        disabled={disabled}
      />

      {isPreparado && activeSheetId == null ? (
        <div data-slot="productionTypeSection-stack" className="bo-stack">
          {createError ? <InlineAlert kind="error" title={createError} /> : null}
          {creating ? (
            <p className="bo-sheetHint" data-role="production-section-creating">
              Creando la ficha tecnica...
            </p>
          ) : (
            <TechnicalSheetBrowser
              onPick={pickSheet}
              onCreate={createSheet}
              productName={productName}
              createDisabled={sheetCreateDisabled}
            />
          )}
        </div>
      ) : null}

      {/* The subtabs live inside this section, so the whole sheet can be built
          without leaving the product editor. */}
      {isPreparado && activeSheetId != null ? (
        <div
          className="bo-productionSection__sheet animate-boFadeIn"
          data-ui="production-section-sheet"
        >
          {/* Back to the list. Only offered when the product is not already
              committed to this sheet, otherwise "back" would suggest the link
              can be undone by navigating. */}
          {openSheetId != null ? (
            <button
              type="button"
              className="bo-btn bo-btn--ghost bo-sheetBack"
              aria-label="Volver a la lista de fichas tecnicas"
              data-role="sheet-back"
              onClick={() => {
                setOpenSheetId(null);
                setCreateError("");
              }}
            >
              <ChevronLeft size={16} aria-hidden="true" />
              Volver
            </button>
          ) : null}
          <TechnicalSheetEditor
            sheetId={activeSheetId}
            sheetName={productName}
            onAllergensChange={onSheetAllergensChange}
          />
        </div>
      ) : null}
    </section>
  );
}
