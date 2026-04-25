import React, { useCallback } from "react";
import { Plus } from "lucide-react";
import { FloatingActionButton } from "../../../ui/actions/FloatingActionButton";

import type { FoodEntry, FoodType } from "./@foodType/constants/index";
import { FOOD_ENTRIES } from "./@foodType/constants/index";

export default function Page() {
  const openCategory = useCallback((type: FoodType) => {
    window.location.href = `/app/comida/${type}`;
  }, []);

  const openCreate = useCallback(() => {
    window.location.href = "/app/comida/platos";
  }, []);

  return (
    <section className="bo-foodHome" aria-label="Categorias de comida" data-ui="food-hub-section">
      <div className="bo-foodHub" data-ui="food-hub-container">
        <div className="bo-foodHubGrid" role="list" data-ui="food-hub-grid">
          {FOOD_ENTRIES.map((entry) => {
            const EntryIcon = entry.icon;
            return (
              <button
                key={entry.type}
                className="bo-foodHubCard"
                type="button"
                role="listitem"
                onClick={() => openCategory(entry.type)}
                aria-label={`Abrir ${entry.label}`}
                data-ui="food-hub-card"
              >
                <EntryIcon className="bo-foodHubIcon" size={20} aria-hidden="true" data-ui="food-hub-icon" />
                <span className="bo-foodHubLabel" data-ui="food-hub-label">{entry.label}</span>
                <span className="bo-foodHubHint" data-ui="food-hub-hint">{entry.hint}</span>
              </button>
            );
          })}
        </div>
      </div>

      <FloatingActionButton aria-label="Crear elemento de comida" onClick={openCreate} data-ui="food-hub-fab" />
    </section>
  );
}
