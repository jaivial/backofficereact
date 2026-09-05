import { useCallback, useState } from "react";
import { useAtomValue } from "jotai";
import { UtensilsCrossed } from "lucide-react";
import { FloatingActionButton } from "../../../ui/actions/FloatingActionButton";
import { hasSectionAccess } from "../../../lib/access-policy";
import { sessionAtom } from "../../../state/atoms";

import { FOOD_ENTRIES } from "./@foodType/constants/index";
import { FoodItemModal } from "./_components/FoodItemModal";
import { FoodCreatePickerModal, type CreateFoodType } from "./_components/FoodCreatePickerModal";
import { WineModal } from "./_components/WineModal";

type CreateStep = "picker" | CreateFoodType | null;

export default function Page() {
  const [createStep, setCreateStep] = useState<CreateStep>(null);
  const session = useAtomValue(sessionAtom);
  const closeCreate = useCallback(() => setCreateStep(null), []);
  const canOpenMenus = !!session && hasSectionAccess(
    session.user.role,
    "menus",
    session.user.sectionAccess,
    session.user.roleImportance,
    session.user.appVersion,
  );

  return (
    <section className="bo-foodHome" aria-label="Categorias de comida" data-ui="food-hub-section" data-testid="food-hub-section">
      <div className="bo-foodHub" data-ui="food-hub-container" data-testid="food-hub-container">
        <div className="bo-foodHubGrid" data-ui="food-hub-grid" data-testid="food-hub-grid">
          {FOOD_ENTRIES.map((entry) => {
            const EntryIcon = entry.icon;
            return (
              <a
                key={entry.type}
                className="bo-foodHubCard"
                href={`/app/comida/${entry.type}`}
                aria-label={`Abrir ${entry.label}`}
                data-ui="food-hub-card"
                data-testid={`food-hub-card-${entry.type}`}
              >
                <EntryIcon className="bo-foodHubIcon" size={20} aria-hidden="true" data-ui="food-hub-icon" data-testid={`food-hub-icon-${entry.type}`} />
                <span className="bo-foodHubLabel" data-ui="food-hub-label" data-testid={`food-hub-label-${entry.type}`}>{entry.label}</span>
                <span className="bo-foodHubHint" data-ui="food-hub-hint" data-testid={`food-hub-hint-${entry.type}`}>{entry.hint}</span>
              </a>
            );
          })}
          {canOpenMenus ? (
            <a
              className="bo-foodHubCard"
              href="/app/comida/menus"
              aria-label="Abrir Menus"
              data-ui="food-hub-card"
              data-testid="food-hub-card-menus"
            >
              <UtensilsCrossed className="bo-foodHubIcon" size={20} aria-hidden="true" data-ui="food-hub-icon" data-testid="food-hub-icon-menus" />
              <span className="bo-foodHubLabel" data-ui="food-hub-label" data-testid="food-hub-label-menus">Menus</span>
              <span className="bo-foodHubHint" data-ui="food-hub-hint" data-testid="food-hub-hint-menus">Gestiona los menus del restaurante</span>
            </a>
          ) : null}
        </div>
      </div>

      <FloatingActionButton
        aria-label="Crear elemento de comida"
        onClick={() => setCreateStep("picker")}
        data-ui="food-hub-fab"
        data-testid="food-hub-create-fab"
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
