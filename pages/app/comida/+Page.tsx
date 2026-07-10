import { useCallback, useState } from "react";
import { FloatingActionButton } from "../../../ui/actions/FloatingActionButton";

import { FOOD_ENTRIES } from "./@foodType/constants/index";
import { FoodItemModal } from "./_components/FoodItemModal";
import { FoodCreatePickerModal, type CreateFoodType } from "./_components/FoodCreatePickerModal";
import { WineModal } from "./_components/WineModal";

type CreateStep = "picker" | CreateFoodType | null;

export default function Page() {
  const [createStep, setCreateStep] = useState<CreateStep>(null);
  const closeCreate = useCallback(() => setCreateStep(null), []);

  return (
    <section className="bo-foodHome" aria-label="Categorias de comida" data-ui="food-hub-section">
      <div className="bo-foodHub" data-ui="food-hub-container">
        <div className="bo-foodHubGrid" data-ui="food-hub-grid">
          {FOOD_ENTRIES.map((entry) => {
            const EntryIcon = entry.icon;
            return (
              <a
                key={entry.type}
                className="bo-foodHubCard"
                href={`/app/comida/${entry.type}`}
                aria-label={`Abrir ${entry.label}`}
                data-ui="food-hub-card"
              >
                <EntryIcon className="bo-foodHubIcon" size={20} aria-hidden="true" data-ui="food-hub-icon" />
                <span className="bo-foodHubLabel" data-ui="food-hub-label">{entry.label}</span>
                <span className="bo-foodHubHint" data-ui="food-hub-hint">{entry.hint}</span>
              </a>
            );
          })}
        </div>
      </div>

      <FloatingActionButton
        aria-label="Crear elemento de comida"
        onClick={() => setCreateStep("picker")}
        data-ui="food-hub-fab"
      />

      <FoodCreatePickerModal
        open={createStep === "picker"}
        onClose={closeCreate}
        onSelect={setCreateStep}
      />

      {createStep && createStep !== "picker" ? (
        createStep === "vinos" ? (
          <WineModal open wine={null} onClose={closeCreate} onSave={closeCreate} />
        ) : (
          <FoodItemModal
            open
            item={null}
            foodType={createStep}
            onClose={closeCreate}
            onSave={closeCreate}
          />
        )
      ) : null}
    </section>
  );
}
