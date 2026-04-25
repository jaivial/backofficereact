import React from "react";
import { Plus } from "lucide-react";
import { FloatingActionButton } from "../../../../ui/actions/FloatingActionButton";
import { FOOD_ENTRIES } from "./constants";
import { useComidaPageActions } from "./hooks";

export default function ComidaPage() {
  const { openCategory, openCreate } = useComidaPageActions();

  return (
    <section
      className="bo-foodHome"
      aria-label="Categorias de comida"
      data-ui="food-hub-section"
    >
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
                <EntryIcon
                  className="bo-foodHubIcon"
                  size={20}
                  aria-hidden="true"
                  data-ui="food-hub-icon"
                />
                <span className="bo-foodHubLabel" data-ui="food-hub-label">
                  {entry.label}
                </span>
                <span className="bo-foodHubHint" data-ui="food-hub-hint">
                  {entry.hint}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <FloatingActionButton
        icon={<Plus size={26} aria-hidden="true" data-ui="fab-icon" />}
        aria-label="Crear elemento de comida"
        onClick={openCreate}
        data-ui="food-hub-fab"
      />
    </section>
  );
}
