import React from "react";

import { FoodDishCard } from "../../../../../ui/widgets/food/FoodDishCard";
import type { Product } from "../../hooks/usePOSRegister";

/** Product tiles as dish-cards in a 2-column grid. One-tap add. No price on the card. */
export function POSProductGrid({ products, busy, onAdd }: {
  products: Product[];
  busy: boolean;
  onAdd: (product: Product) => void;
}) {
  return (
    <section className="pos-products" aria-label="Productos" data-testid="pos-product-grid">
      {products.map((product) => (
        <FoodDishCard
          testId={`pos-product-${product.id}`}
          title={product.name}
          key={product.id}
          inactive={!product.isActive}
          openAriaLabel={`Añadir ${product.name}`}
          onOpen={busy ? undefined : () => onAdd(product)}
        />
      ))}
    </section>
  );
}
