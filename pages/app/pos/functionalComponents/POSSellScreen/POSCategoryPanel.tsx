import React from "react";
import { FoodDishCard } from "../../../../../ui/widgets/food/FoodDishCard";

/** Category tiles rendered as dish-cards in a 2-column grid. One-tap filter. */
export function POSCategoryPanel({ categories, active, onSelect }: {
  categories: string[];
  active: string;
  onSelect: (category: string) => void;
}) {
  return (
    <section className="pos-categories" aria-label="Categorías" data-testid="pos-category-panel">
      <FoodDishCard
        testId="pos-category-all"
        title="Todo"
        showTitleRow
        openAriaLabel="Ver todas las categorías"
        onOpen={() => onSelect("")}
        className={active === "" ? "pos-dishCard--active" : undefined}
      />
      {categories.map((category) => (
        <FoodDishCard
          testId={`pos-category-${category}`}
          title={category}
          key={category}
          openAriaLabel={`Filtrar por ${category}`}
          onOpen={() => onSelect(category)}
          className={active === category ? "pos-dishCard--active" : undefined}
        />
      ))}
    </section>
  );
}
