import React from "react";

import { FoodDishCard } from "../../../../../ui/widgets/food/FoodDishCard";
import { money } from "../../utils/money";
import type { Product, StockStatus } from "../../hooks/usePOSRegister";

/** Product tiles as dish-cards in a 2-column grid. One-tap add, with price and per-tile pending. */
export function POSProductGrid({ products, disabled = false, readOnly = false, pendingProductId = null, onAdd, stockStatus }: {
  products: Product[];
  /** Grid-level gate (e.g. no open ticket). */
  disabled?: boolean;
  /** Sealed day: tiles become view-only, no add. */
  readOnly?: boolean;
  /** Only this product is locked while its add request is in flight. */
  pendingProductId?: number | null;
  onAdd: (product: Product) => void;
  stockStatus?: Record<string, StockStatus>;
}) {
  return (
    <section className="pos-products" aria-label="Productos" data-testid="pos-product-grid">
      {products.map((product) => {
        const status = stockStatus?.[String(product.id)];
        const pending = pendingProductId === product.id;
        return (
          <FoodDishCard
            testId={`pos-product-${product.id}`}
            title={product.name}
            key={product.id}
            inactive={!product.isActive}
            priceLabel={money(product.priceGrossCents)}
            stockBadge={status === "out" ? { tone: "danger", label: "Sin stock" } : status === "low" ? { tone: "yellow", label: "Stock bajo" } : pending ? { tone: "yellow", label: "Añadiendo…" } : undefined}
            openAriaLabel={`Añadir ${product.name}`}
            onOpen={disabled || readOnly || pending ? undefined : () => onAdd(product)}
          />
        );
      })}
    </section>
  );
}
