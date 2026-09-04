import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Camera, Keyboard } from "lucide-react";

import { InlineAlert } from "../../../../../ui/feedback/InlineAlert";
import { FormField } from "../../../../../ui/inputs/FormField";
import { Select } from "../../../../../ui/inputs/Select";
import { Modal } from "../../../../../ui/overlays/Modal";
import { ProductionTypeSection } from "../../../comida/_components/TechnicalSheet/ProductionTypeSection";
import type { ProductionType } from "../../../comida/_components/TechnicalSheet/ProductionTypeToggle";

// Creation dialog for stock articles. The first step asks HOW the article is
// born: "Escanear documento" opens the camera and lets MiniMax vision turn a
// photographed albaran/etiqueta into a name, or "Anadir manualmente" opens the
// regular form. Materia prima creates a plain RAW stock item; Preparado requires
// a ficha tecnica - the sheet create already produces the output stock article
// server-side, so the modal only closes once one exists.

type Step = "choice" | "manual" | "scan";

const DIMENSION_OPTIONS = [
  { value: "MASS", label: "Masa" },
  { value: "VOLUME", label: "Volumen" },
  { value: "COUNT", label: "Unidades" },
];

async function createRawItem(input: {
  name: string;
  baseDimension: string;
  displayUnitCode: string;
  displayUnitFactor: number;
}): Promise<void> {
  const response = await fetch("/api/admin/stock/items", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: input.name,
      kind: "RAW",
      baseDimension: input.baseDimension,
      isTracked: true,
      deductionSource: "BOTH_MANUAL",
      displayUnitCode: input.displayUnitCode,
      displayUnitLabel: input.displayUnitCode,
      displayUnitFactor: input.displayUnitFactor,
    }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.success) {
    throw new Error(body.message || "No se pudo crear el articulo");
  }
}

export function StockItemModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void | Promise<void>;
}) {
  const [step, setStep] = useState<Step>("choice");
  const [nombre, setNombre] = useState("");
  const [dimension, setDimension] = useState("MASS");
  const [unidad, setUnidad] = useState("kg");
  const [factor, setFactor] = useState("1000");
  const [productionType, setProductionType] = useState<ProductionType>("RAW");
  const [stockRecipeId, setStockRecipeId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Camera / OCR state.
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [scanError, setScanError] = useState("");
  const [scanning, setScanning] = useState(false);
  const [captured, setCaptured] = useState<string | null>(null);

  // Fresh form on every open; the sheet link belongs to this creation only.
  useEffect(() => {
    if (!open) return;
    setStep("choice");
    setNombre("");
    setDimension("MASS");
    setUnidad("kg");
    setFactor("1000");
    setProductionType("RAW");
    setStockRecipeId(null);
    setError("");
    setScanError("");
    setScanning(false);
    setCaptured(null);
    setSaving(false);
  }, [open]);

  // Camera lifecycle: only active while on the scan step.
  useEffect(() => {
    if (!open || step !== "scan") return;
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => undefined);
        }
      } catch {
        setScanError("No se pudo acceder a la camara. Usa \"Anadir manualmente\".");
      }
    })();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, [open, step]);

  const captureAndScan = useCallback(async () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) {
      setScanError("La camara aun no esta lista");
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setScanError("No se pudo capturar la imagen");
      return;
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    setCaptured(dataUrl);
    setScanning(true);
    setScanError("");
    try {
      const response = await fetch("/api/admin/stock/ocr-scan", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: dataUrl }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.success) {
        throw new Error(body.message || "No se pudo leer el documento");
      }
      const name = body.extraction?.name;
      if (name) setNombre(String(name));
      setStep("manual");
    } catch (reason) {
      setScanError(reason instanceof Error ? reason.message : "Error de OCR");
    } finally {
      setScanning(false);
    }
  }, []);

  const isPreparado = productionType === "MANUFACTURED";
  // A sheet's output item is created server-side with the current unit data,
  // so those fields must be valid before a sheet can be created. The submit
  // path re-validates as a backstop, but the create button inside the sheet
  // browser is gated on the same rule.
  const factorNum = Number(factor);
  const unit = unidad.trim();
  const unitValid = Number.isFinite(factorNum) && factorNum > 0 && unit !== "";
  // Once a sheet exists, the output unit is fixed on the server: editing these
  // fields afterwards would only change what a *future* sheet would use, so
  // they are locked to stop the form and the article from disagreeing.
  const sheetLocked = stockRecipeId != null;
  // The user must build the ficha first: a Preparado article without a recipe
  // cannot be produced, so the form stays blocked until one exists.
  const missingSheet = isPreparado && !sheetLocked;

  const outputUnit = useMemo(
    () => ({
      baseDimension: dimension,
      displayUnitCode: unit,
      displayUnitLabel: unit,
      displayUnitFactor: factorNum,
    }),
    [dimension, factor, unidad],
  );

  const submit = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      const name = nombre.trim();
      if (!name) {
        setError("El nombre es obligatorio");
        return;
      }
      if (isPreparado && stockRecipeId == null) {
        setError("Crea o selecciona una ficha tecnica antes de crear el articulo");
        return;
      }
      if (!Number.isFinite(factorNum) || factorNum <= 0) {
        setError("El factor base debe ser mayor que cero");
        return;
      }
      if (!unit) {
        setError("La unidad visible es obligatoria");
        return;
      }
      setSaving(true);
      setError("");
      try {
        if (!isPreparado) {
          await createRawItem({
            name,
            baseDimension: dimension,
            displayUnitCode: unit,
            displayUnitFactor: factorNum,
          });
        }
        // Preparado: the ficha already created its output article on the
        // server; nothing else to persist here.
        onClose();
        await onCreated();
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "No se pudo crear el articulo");
      } finally {
        setSaving(false);
      }
    },
    [dimension, factor, isPreparado, nombre, onClose, onCreated, stockRecipeId, unidad],
  );

  return (
    <Modal open={open} title={step === "scan" ? "Escanear documento" : "Nuevo articulo"} onClose={onClose} size="lg">
      {step === "choice" ? (
        <div className="bo-stockChoice" data-ui="stock-item-choice">
          <button
            type="button"
            className="bo-card bo-stockChoiceCard"
            data-ui="stock-choice-scan"
            data-testid="stock-choice-scan"
            onClick={() => setStep("scan")}
          >
            <Camera size={28} className="bo-stockChoiceIco" aria-hidden="true" />
            <strong className="bo-stockChoiceTitle">Escanear documento</strong>
            <span data-slot="stockItemModal-stockChoiceHint" className="bo-stockChoiceHint">Foto de un albaran o etiqueta; MiniMax rellena el nombre.</span>
          </button>
          <button
            type="button"
            className="bo-card bo-stockChoiceCard"
            data-ui="stock-choice-manual"
            data-testid="stock-choice-manual"
            onClick={() => setStep("manual")}
          >
            <Keyboard size={28} className="bo-stockChoiceIco" aria-hidden="true" />
            <strong className="bo-stockChoiceTitle">Anadir manualmente</strong>
            <span data-slot="stockItemModal-stockChoiceHint" className="bo-stockChoiceHint">Crea el articulo a mano con todos sus datos.</span>
          </button>
        </div>
      ) : null}

      {step === "scan" ? (
        <div className="bo-stockScan" data-ui="stock-item-scan">
          <div className="bo-stockScanStage" data-ui="stock-scan-stage">
            <video ref={videoRef} className="bo-stockScanVideo" data-ui="stock-scan-video" playsInline muted />
            {captured ? <img src={captured} alt="Captura" className="bo-stockScanPreview" data-ui="stock-scan-preview" /> : null}
          </div>
          {scanError ? <InlineAlert kind="error" title={scanError} /> : null}
          <div data-slot="stockItemModal-foodModal-actions" className="bo-foodModal-actions">
            <button type="button" className="bo-btn bo-btn--ghost" onClick={() => setStep("choice")} disabled={scanning} data-testid="stock-scan-back">
              Volver
            </button>
            <button type="button" className="bo-btn bo-btn--primary" onClick={() => void captureAndScan()} disabled={scanning} data-testid="stock-scan-capture">
              {scanning ? "Leyendo…" : "Capturar y leer"}
            </button>
          </div>
        </div>
      ) : null}

      {step === "manual" ? (
        <form className="bo-stockForm" onSubmit={submit} data-ui="stock-item-dialog">
          <div data-ui="food-modal-grid" className="bo-foodModal-grid">
            <div data-slot="food-modal-fields" className="bo-foodModal-fields">
              <FormField label="Nombre" htmlFor="stock-item-name" required>
                <input
                  id="stock-item-name"
                  className="bo-input"
                  value={nombre}
                  onChange={(event) => setNombre(event.target.value)}
                  placeholder="Nombre del articulo"
                  required
                  data-testid="stock-item-name"
                />
              </FormField>

              <FormField label="Dimensión" htmlFor="stock-item-dimension">
                {/* Reusable dropdown, not the native select. */}
                <Select
                  value={dimension}
                  onChange={setDimension}
                  options={DIMENSION_OPTIONS}
                  ariaLabel="Dimensión"
                  disabled={sheetLocked}
                  data-testid="stock-item-dimension"
                />
              </FormField>

              <div className="bo-stockFormGrid bo-stockFormGrid--2" data-ui="stock-item-unit-row">
                <FormField label="Unidad visible" htmlFor="stock-item-unit" required>
                  <input
                    id="stock-item-unit"
                    className="bo-input"
                    value={unidad}
                    onChange={(event) => setUnidad(event.target.value)}
                    required
                    disabled={sheetLocked}
                    data-testid="stock-item-unit"
                  />
                </FormField>
                <FormField label="Factor base" htmlFor="stock-item-factor" required>
                  <input
                    id="stock-item-factor"
                    className="bo-input"
                    inputMode="decimal"
                    value={factor}
                    onChange={(event) => setFactor(event.target.value)}
                    required
                    disabled={sheetLocked}
                    data-testid="stock-item-factor"
                  />
                </FormField>
              </div>

              <ProductionTypeSection
                itemId={null}
                productionType={productionType}
                stockRecipeId={stockRecipeId}
                productName={nombre}
                onChange={(next) => {
                  setProductionType(next);
                  // Back to Materia prima releases the sheet link: the article is
                  // bought and sold as-is, so it must not keep a recipe.
                  if (next === "RAW") setStockRecipeId(null);
                }}
                onSheetLinked={(sheetId) => setStockRecipeId(sheetId)}
                sheetCreateDisabled={isPreparado && !unitValid}
                sheetOutputUnit={outputUnit}
              />

              {sheetLocked ? (
                <p className="bo-sheetHint" data-role="stock-item-sheet-locked-hint">
                  La unidad de salida queda fijada al crear la ficha tecnica.
                </p>
              ) : null}

              {isPreparado && !unitValid && !sheetLocked ? (
                <p className="bo-sheetHint" data-role="stock-item-unit-hint">
                  Introduce una unidad visible y un factor base validos para crear la ficha tecnica.
                </p>
              ) : null}

              {missingSheet && unitValid ? (
                <p className="bo-sheetHint" data-role="stock-item-sheet-hint">
                  Crea o selecciona una ficha tecnica para crear el articulo.
                </p>
              ) : null}

              {error ? <InlineAlert kind="error" title={error} /> : null}
            </div>
          </div>

          <div data-slot="food-modal-actions" className="bo-foodModal-actions">
            <button
              data-role="food-modal-cancel-btn"
              type="button"
              className="bo-btn bo-btn--ghost"
              onClick={onClose}
              disabled={saving}
            >
              Cancelar
            </button>
            <button
              data-role="food-modal-submit-btn"
              type="submit"
              className="bo-btn bo-btn--primary mx-0"
              disabled={saving || missingSheet}
              data-testid="stock-create-item"
            >
              {saving ? "Creando..." : "Crear artículo"}
            </button>
          </div>
        </form>
      ) : null}
    </Modal>
  );
}
