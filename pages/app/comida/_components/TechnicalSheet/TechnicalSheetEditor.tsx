import React, { useCallback, useEffect, useRef, useState } from "react";
import { ClipboardList, Coins, ListOrdered } from "lucide-react";

import { InlineAlert } from "../../../../../ui/feedback/InlineAlert";
import { Tabs } from "../../../../../ui/nav/Tabs";
import { TechnicalSheetCostTab } from "./TechnicalSheetCostTab";
import { TechnicalSheetInfoTab } from "./TechnicalSheetInfoTab";
import { TechnicalSheetRecipeTab } from "./TechnicalSheetRecipeTab";
import { useSheetImageSocket } from "./useSheetImageSocket";
import {
  sheetsApi,
  type SheetAllergens,
  type SheetComponent,
  type SheetCost,
  type SheetStep,
} from "./sheetsApi";

// The editor is the "ficha tecnica": three subtabs over one sheet. Cost is
// re-fetched whenever ingredients change, because a stale cost is the kind of
// error nobody notices until the month-end margin looks wrong.

type SubTab = "info" | "recipe" | "cost";

// href is unused in button mode but the shared TabItem type requires it.
const TABS = [
  { id: "info", label: "Informacion", href: "#", icon: <ClipboardList size={16} /> },
  { id: "recipe", label: "Receta", href: "#", icon: <ListOrdered size={16} /> },
  { id: "cost", label: "Coste", href: "#", icon: <Coins size={16} /> },
] as const;

export function TechnicalSheetEditor({
  sheetId,
  sheetName,
  onAllergensChange,
}: {
  sheetId: number;
  sheetName: string;
  /**
   * The sheet's effective allergens, reported whenever they change. A sheet's
   * allergens are the dish's allergens - they are what reaches the menu - so the
   * product form has to follow them rather than keeping a second opinion.
   */
  onAllergensChange?: (effective: string[]) => void;
}) {
  const [tab, setTab] = useState<SubTab>("info");
  const [components, setComponents] = useState<SheetComponent[]>([]);
  const [steps, setSteps] = useState<SheetStep[]>([]);
  const [cost, setCost] = useState<SheetCost | null>(null);
  const [allergens, setAllergens] = useState<SheetAllergens | null>(null);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    try {
      const [componentsBody, stepsBody, costBody, allergensBody] = await Promise.all([
        sheetsApi.components(sheetId),
        sheetsApi.steps(sheetId),
        sheetsApi.cost(sheetId),
        sheetsApi.allergens(sheetId),
      ]);
      setComponents(componentsBody.components ?? []);
      setSteps(stepsBody.steps ?? []);
      setCost(costBody.cost ?? null);
      setAllergens(allergensBody ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error cargando la ficha tecnica");
    }
  }, [sheetId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useSheetImageSocket(sheetId, reload);

  // Held in a ref so a new callback identity cannot re-fire the notification.
  const notifyAllergens = useRef(onAllergensChange);
  useEffect(() => {
    notifyAllergens.current = onAllergensChange;
  }, [onAllergensChange]);

  const effectiveKey = (allergens?.effective ?? []).join("|");
  useEffect(() => {
    if (allergens == null) return;
    notifyAllergens.current?.(allergens.effective ?? []);
    // Keyed by the joined list rather than the object, which is a new reference
    // on every reload and would notify endlessly.
  }, [effectiveKey, allergens]);

  const removeComponent = useCallback(
    async (componentId: number) => {
      await sheetsApi.removeComponent(sheetId, componentId);
      // Ingredients drive both cost and allergens, so everything is refreshed
      // together rather than patched locally and left to drift.
      await reload();
    },
    [reload, sheetId],
  );

  const toggleAllergen = useCallback(
    async (key: string, next: boolean) => {
      const added = new Set(allergens?.manualAdded ?? []);
      if (next) added.add(key);
      else added.delete(key);
      const updated = await sheetsApi.patchAllergens(sheetId, { added: [...added] });
      setAllergens(updated);
    },
    [allergens, sheetId],
  );

  const patchStep = useCallback(
    async (stepId: number, patch: { title?: string; description?: string }) => {
      await sheetsApi.patchStep(sheetId, stepId, patch);
      await reload();
    },
    [reload, sheetId],
  );

  const addStep = useCallback(async () => {
    await sheetsApi.addStep(sheetId, { title: "", description: "" });
    await reload();
  }, [reload, sheetId]);

  const removeStep = useCallback(
    async (stepId: number) => {
      await sheetsApi.removeStep(sheetId, stepId);
      await reload();
    },
    [reload, sheetId],
  );

  const moveStep = useCallback(
    async (stepId: number, direction: -1 | 1) => {
      const order = steps.map((step) => step.id);
      const index = order.indexOf(stepId);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= order.length) return;
      [order[index], order[target]] = [order[target], order[index]];
      // The server rejects a partial order, so the full sequence is always sent.
      await sheetsApi.reorderSteps(sheetId, order);
      await reload();
    },
    [reload, sheetId, steps],
  );

  return (
    <section
      className="bo-stack"
      aria-label={sheetName ? `Ficha tecnica de ${sheetName}` : "Ficha tecnica"}
      data-ui="technical-sheet-editor"
      data-testid="technical-sheet-editor"
    >
      {error ? <InlineAlert kind="error" title={error} /> : null}

      <Tabs
        tabs={TABS as unknown as { id: string; label: string; href: string; icon?: React.ReactNode }[]}
        activeId={tab}
        mode="button"
        ariaLabel="Secciones de la ficha tecnica"
        className="bo-tabs--sheet flex flex-row rounded-xl w-fit my-0 mx-auto"
        layoutId="boSheetTabIndicator"
        onNavigate={(_href, id) => setTab(id as SubTab)}
      />

      <div role="tabpanel" id={`sheet-panel-${tab}`} aria-labelledby={`sheet-tab-${tab}`}>
        {tab === "info" ? (
          <TechnicalSheetInfoTab
            sheetId={sheetId}
            components={components}
            allergens={allergens}
            onToggleAllergen={(key, next) => void toggleAllergen(key, next)}
            onRemoveComponent={(id) => void removeComponent(id)}
            onComponentsChanged={() => void reload()}
          />
        ) : null}
        {tab === "recipe" ? (
          <TechnicalSheetRecipeTab
            sheetId={sheetId}
            steps={steps}
            onAddStep={() => void addStep()}
            onRemoveStep={(id) => void removeStep(id)}
            onMoveStep={(id, direction) => void moveStep(id, direction)}
            onPatchStep={(id, patch) => void patchStep(id, patch)}
            onStepsChanged={() => void reload()}
          />
        ) : null}
        {tab === "cost" ? <TechnicalSheetCostTab cost={cost} /> : null}
      </div>
    </section>
  );
}
