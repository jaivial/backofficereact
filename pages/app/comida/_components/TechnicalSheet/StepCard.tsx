import React, { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, ImagePlus, Trash2 } from "lucide-react";

import { StepImagePopover } from "./StepImagePopover";
import type { SheetStep } from "./sheetsApi";

// One step of the method: its number, its editable text, and its picture.
//
// Text is committed on blur rather than on every keystroke: a step description
// is a sentence, and saving per character would be a request per letter.

type Props = {
  sheetId: number;
  step: SheetStep;
  isFirst: boolean;
  isLast: boolean;
  onPatchStep: (stepId: number, patch: { title?: string; description?: string }) => void;
  onRemoveStep: (stepId: number) => void;
  onMoveStep: (stepId: number, direction: -1 | 1) => void;
  onStepsChanged: () => void;
};

export function StepCard({
  sheetId,
  step,
  isFirst,
  isLast,
  onPatchStep,
  onRemoveStep,
  onMoveStep,
  onStepsChanged,
}: Props) {
  const imageButtonRef = useRef<HTMLButtonElement | null>(null);
  const [imageOpen, setImageOpen] = useState(false);
  const [title, setTitle] = useState(step.title);
  const [description, setDescription] = useState(step.description);

  // Re-seeded only when the server sends different text, so a save in flight
  // does not snap the field back to what the user just replaced.
  useEffect(() => setTitle(step.title), [step.title]);
  useEffect(() => setDescription(step.description), [step.description]);

  const generating = step.generationStatus === "PENDING" || step.generationStatus === "RUNNING";

  return (
    <li className="bo-stepCard" data-ui="sheet-step-card" data-testid={`step-card-${step.id}`}>
      <span className="bo-stepCard__no" aria-hidden="true">
        {step.stepNo}
      </span>

      <div className="bo-stepCard__media">
        {generating ? (
          // A skeleton in the final 1:1 box, so the layout does not jump when
          // the picture lands.
          <div
            className="bo-stepCard__skeleton"
            role="status"
            aria-label={`Generando la imagen del paso ${step.stepNo}`}
            data-testid={`step-image-skeleton-${step.id}`}
          />
        ) : step.imageUrl ? (
          <img
            className="bo-stepCard__image"
            src={step.imageUrl}
            alt={`Paso ${step.stepNo}`}
            loading="lazy"
          />
        ) : (
          <button
            ref={imageButtonRef}
            type="button"
            className="bo-stepCard__imageAdd"
            aria-label={`Anadir imagen al paso ${step.stepNo}`}
            aria-expanded={imageOpen}
            onClick={() => setImageOpen((open) => !open)}
          >
            <ImagePlus size={22} aria-hidden="true" />
            <span>Anadir imagen</span>
          </button>
        )}

        {/* Replacing an existing picture stays possible without removing it first. */}
        {!generating && step.imageUrl ? (
          <button
            ref={imageButtonRef}
            type="button"
            className="bo-stepCard__imageChange"
            aria-label={`Cambiar imagen del paso ${step.stepNo}`}
            aria-expanded={imageOpen}
            onClick={() => setImageOpen((open) => !open)}
          >
            Cambiar
          </button>
        ) : null}
      </div>

      <div className="bo-stepCard__body">
        <label className="sr-only" htmlFor={`step-title-${step.id}`}>
          Titulo del paso {step.stepNo}
        </label>
        <input
          id={`step-title-${step.id}`}
          className="bo-input bo-stepCard__titleInput"
          value={title}
          placeholder={`Paso ${step.stepNo}`}
          onChange={(event) => setTitle(event.target.value)}
          onBlur={() => {
            if (title !== step.title) onPatchStep(step.id, { title });
          }}
        />

        <label className="sr-only" htmlFor={`step-desc-${step.id}`}>
          Descripcion del paso {step.stepNo}
        </label>
        <textarea
          id={`step-desc-${step.id}`}
          className="bo-textarea bo-stepCard__textInput"
          rows={3}
          value={description}
          placeholder="Que hay que hacer en este paso..."
          onChange={(event) => setDescription(event.target.value)}
          onBlur={() => {
            if (description !== step.description) onPatchStep(step.id, { description });
          }}
        />

        {step.generationStatus === "FAILED" ? (
          <p className="bo-stepCard__error" role="alert">
            No se pudo generar la imagen: {step.generationError}
          </p>
        ) : null}
      </div>

      <div className="!my-auto bo-stepCard__actions">
        <button
          type="button"
          className="bo-btn bo-btn--ghost bo-btn--icon"
          aria-label={`Subir paso ${step.stepNo}`}
          disabled={isFirst}
          onClick={() => onMoveStep(step.id, -1)}
        >
          <ArrowUp size={16} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="bo-btn bo-btn--ghost bo-btn--icon"
          aria-label={`Bajar paso ${step.stepNo}`}
          disabled={isLast}
          onClick={() => onMoveStep(step.id, 1)}
        >
          <ArrowDown size={16} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="bo-btn bo-btn--ghost bo-btn--icon"
          aria-label={`Eliminar paso ${step.stepNo}`}
          onClick={() => onRemoveStep(step.id)}
        >
          <Trash2 size={16} aria-hidden="true" />
        </button>
      </div>

      <StepImagePopover
        open={imageOpen}
        anchorRef={imageButtonRef}
        sheetId={sheetId}
        step={step}
        onClose={() => setImageOpen(false)}
        onQueued={onStepsChanged}
      />
    </li>
  );
}
