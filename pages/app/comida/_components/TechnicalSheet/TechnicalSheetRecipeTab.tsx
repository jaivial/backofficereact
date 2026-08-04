import React from "react";
import { Plus } from "lucide-react";

import { Button } from "../../../../../ui/actions/Button";
import { StepCard } from "./StepCard";
import type { SheetStep } from "./sheetsApi";

// Receta: the ordered method. Steps are numbered by the server and always
// contiguous, so the number shown here is the number the kitchen will say out
// loud.

type Props = {
  sheetId: number;
  steps: SheetStep[];
  onAddStep: () => void;
  onRemoveStep: (stepId: number) => void;
  onMoveStep: (stepId: number, direction: -1 | 1) => void;
  onPatchStep: (stepId: number, patch: { title?: string; description?: string }) => void;
  onStepsChanged: () => void;
};

export function TechnicalSheetRecipeTab({
  sheetId,
  steps,
  onAddStep,
  onRemoveStep,
  onMoveStep,
  onPatchStep,
  onStepsChanged,
}: Props) {
  return (
    <div className="bo-stack" data-ui="sheet-recipe-tab" data-testid="sheet-recipe-tab">
      {steps.length === 0 ? (
        <p className="bo-sheetHint" data-role="sheet-steps-empty">
          Esta ficha aun no tiene pasos de elaboracion. <br></br>  Anade el primero para describir como se
          prepara el plato.
        </p>
      ) : (
        <ol className="bo-stepList">
          {steps.map((step, index) => (
            <StepCard
              key={step.id}
              sheetId={sheetId}
              step={step}
              isFirst={index === 0}
              isLast={index === steps.length - 1}
              onPatchStep={onPatchStep}
              onRemoveStep={onRemoveStep}
              onMoveStep={onMoveStep}
              onStepsChanged={onStepsChanged}
            />
          ))}
        </ol>
      )}

      {/* The action sits after the content: the list is what the user reads
          first, and the button follows what it adds to. */}
      <div className="bo-sheetTabActions">
        <Button variant="primary" onClick={onAddStep} className="!mx-auto">
          <Plus size={14} aria-hidden="true" />
          Anadir paso
        </Button>
      </div>
    </div>
  );
}
