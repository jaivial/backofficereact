import React from "react";

import { FoodDishCard } from "../../../../../ui/widgets/food/FoodDishCard";
import type { Product, StockStatus } from "../../hooks/usePOSRegister";

/** Product tiles as dish-cards in a 2-column grid. One-tap add. No price on the card. */
export function POSProductGrid({ products, busy, readOnly = false, onAdd, stockStatus }: {
  products: Product[];
  busy: boolean;
  /** Sealed day: tiles become view-only, no add. */
  readOnly?: boolean;
  onAdd: (product: Product) => void;
  stockStatus?: Record<string, StockStatus>;
}) {
  return (
    <section className="pos-products" aria-label="Productos" data-testid="pos-product-grid">
      {products.map((product) => {
        const status = stockStatus?.[String(product.id)];
        return (
          <FoodDishCard
            testId={`pos-product-${product.id}`}
            title={product.name}
            key={product.id}
            inactive={!product.isActive}
            stockBadge={status === "out" ? { tone: "danger", label: "Sin stock" } : status === "low" ? { tone: "yellow", label: "Stock bajo" } : undefined}
            openAriaLabel={`Añadir ${product.name}`}
            onOpen={busy || readOnly ? undefined : () => onAdd(product)}
          />
        );
      })}
    </section>
  );
}
