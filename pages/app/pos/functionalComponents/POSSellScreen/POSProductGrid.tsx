import React from "react";

import { FoodDishCard } from "../../../../../ui/widgets/food/FoodDishCard";
import { money } from "../../utils/money";
import type { Pack, Product, StockStatus } from "../../hooks/usePOSRegister";

/** Product tiles as dish-cards in a 2-column grid. One-tap add, with price and per-tile pending. */
export function POSProductGrid({ products, packs = [], disabled = false, readOnly = false, pendingProductId = null, pendingPackId = null, onAdd, onAddPack, stockStatus }: {
  products: Product[];
  /** Fixed-price menus, shown alongside the dishes they expand into. */
  packs?: Pack[];
  /** Grid-level gate (e.g. no open ticket). */
  disabled?: boolean;
  /** Sealed day: tiles become view-only, no add. */
  readOnly?: boolean;
  /** Only this product is locked while its add request is in flight. */
  pendingProductId?: number | null;
  /** Only this pack is locked while its request is in flight. */
  pendingPackId?: number | null;
  onAdd: (product: Product) => void;
  /** A pack tap opens its slot picker instead of adding a line directly. */
  onAddPack?: (pack: Pack) => void;
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
            // The waiter has to answer "does this contain nuts?" while ringing,
            // not after the plate is up. The full list stays in the title so a
            // truncated row still names every allergen on hover.
            secondaryMeta={product.allergens?.length ? <span className="pos-allergens" title={`Alérgenos: ${product.allergens.join(", ")}`} data-testid={`pos-product-allergens-${product.id}`}><span aria-hidden="true" className="pos-allergens__mark">⚠</span>{product.allergens.join(" · ")}</span> : undefined}
            openAriaLabel={product.allergens?.length ? `Añadir ${product.name}. Alérgenos: ${product.allergens.join(", ")}` : `Añadir ${product.name}`}
            onOpen={disabled || readOnly || pending ? undefined : () => onAdd(product)}
          />
        );
      })}
      {packs.length > 0 ? (
        <>
          <h3 className="pos-products__packHeading" data-testid="pos-pack-heading">Menús</h3>
          {packs.map((pack) => {
            const pending = pendingPackId === pack.id;
            return (
              <FoodDishCard
                testId={`pos-pack-${pack.id}`}
                title={pack.name}
                key={`pack-${pack.id}`}
                priceLabel={money(pack.priceGrossCents)}
                stockBadge={pending ? { tone: "yellow", label: "Añadiendo…" } : undefined}
                openAriaLabel={`Añadir ${pack.name}`}
                onOpen={disabled || readOnly || pending || !onAddPack ? undefined : () => onAddPack(pack)}
              />
            );
          })}
        </>
      ) : null}
    </section>
  );
}
