import React, { useCallback, useRef, useState } from "react";
import { Sparkles, Upload } from "lucide-react";

import { Button } from "../../../../../ui/actions/Button";
import { InlineAlert } from "../../../../../ui/feedback/InlineAlert";
import { Popover } from "../../../../../ui/overlays/Popover";
import { compressImageToWebP, isValidImageFile } from "../../../../../lib/imageCompressor";
import { sheetsApi, type SheetStep } from "./sheetsApi";

// How a step gets its picture: upload one, or have the AI draw it from the text
// the user already wrote.
//
// An upload is compressed client-side to WebP <=100 KB and then offered to the
// AI enhancer, exactly like the dish image advisor. AI work is queued; the
// finished URL arrives over the WebSocket, so this popover only starts the job.

type Props = {
  open: boolean;
  anchorRef: React.RefObject<HTMLElement | null>;
  sheetId: number;
  step: SheetStep;
  onClose: () => void;
  /** Called once work is queued or an upload landed, so the list can refresh. */
  onQueued: () => void;
  className?: string;
};

/** The step's own words are the prompt: nobody should describe the dish twice. */
function promptFromStep(step: SheetStep): string {
  return [step.title, step.description].map((part) => part.trim()).filter(Boolean).join(". ");
}

export function StepImagePopover({
  open,
  anchorRef,
  sheetId,
  step,
  onClose,
  onQueued,
  className,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // Set once a file has been compressed and is waiting for the enhance choice.
  const [pending, setPending] = useState<{ file: File; preview: string } | null>(null);

  const prompt = promptFromStep(step);

  const reset = useCallback(() => {
    setPending(null);
    setError("");
    setBusy(false);
  }, []);

  const handleFile = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!isValidImageFile(file)) {
      setError("Formato no valido. Usa JPG, PNG o WebP.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      // Compressed before it leaves the browser so a 6 MB phone photo never
      // travels over the network.
      const dataUrl = await compressImageToWebP(file, 100);
      const base64 = dataUrl.split(",")[1] ?? "";
      const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
      const webp = new File([bytes], "step.webp", { type: "image/webp" });
      setPending({ file: webp, preview: dataUrl });
    } catch {
      setError("No se pudo procesar la imagen");
    } finally {
      setBusy(false);
    }
  }, []);

  const upload = useCallback(
    async (thenEnhance: boolean) => {
      if (!pending) return;
      setBusy(true);
      setError("");
      try {
        await sheetsApi.uploadStepImage(sheetId, step.id, pending.file);
        if (thenEnhance) {
          // Enhancement edits what is now the step's image, so the upload has
          // to be stored first.
          await sheetsApi.createStepImageJob(sheetId, step.id, { mode: "AI_ENHANCE" });
        }
        onQueued();
        reset();
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudo subir la imagen");
        setBusy(false);
      }
    },
    [onClose, onQueued, pending, reset, sheetId, step.id],
  );

  const generate = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      await sheetsApi.createStepImageJob(sheetId, step.id, { mode: "AI_GENERATE", prompt });
      onQueued();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo generar la imagen");
    } finally {
      setBusy(false);
    }
  }, [onClose, onQueued, prompt, sheetId, step.id]);

  return (
    <Popover
      open={open}
      anchorRef={anchorRef}
      onClose={() => {
        reset();
        onClose();
      }}
      ariaLabel={`Imagen del paso ${step.stepNo}`}
      widthPx={320}
      className={className}
      data-testid="step-image-popover"
    >
      <div data-slot="stepImagePopover-popover-head" className="bo-popover__head">
        <h4 data-slot="stepImagePopover-popover-title" className="bo-popover__title">Imagen del paso {step.stepNo}</h4>
      </div>

      <div data-slot="stepImagePopover-popover-body" className="bo-popover__body">
        {error ? <InlineAlert kind="error" title={error} /> : null}

        <input data-testid="archivo-de-imagen"
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          aria-label="Archivo de imagen"
          className="sr-only"
          onChange={(event) => void handleFile(event)}
        />

        {pending ? (
          <>
            <img className="bo-stepImagePreview" src={pending.preview} alt="Imagen optimizada" />
            <p data-slot="stepImagePopover-muted" className="bo-muted">
              Mejorar la foto con IA puede hacer la ficha mas clara para la cocina. La imagen ya
              esta optimizada en WebP.
            </p>
            <div data-slot="stepImagePopover-stepImageChoice" className="bo-stepImageChoice">
              <Button variant="ghost" disabled={busy} onClick={() => void upload(false)}>
                Continuar sin mejorar
              </Button>
              <Button variant="primary" disabled={busy} onClick={() => void upload(true)}>
                {busy ? "Procesando..." : "Mejorar con IA"}
              </Button>
            </div>
          </>
        ) : (
          <>
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload size={14} aria-hidden="true" />
              Subir imagen
            </Button>
            <Button
              variant="primary"
              // Without any text there is nothing to draw from, so the provider
              // would be paid to guess.
              disabled={busy || prompt === ""}
              onClick={() => void generate()}
            >
              <Sparkles size={14} aria-hidden="true" />
              Generar con IA
            </Button>
            {prompt === "" ? (
              <p data-slot="stepImagePopover-popover-empty" className="bo-popover__empty">
                Escribe el titulo o la descripcion del paso para poder generar la imagen.
              </p>
            ) : null}
          </>
        )}
      </div>
    </Popover>
  );
}
