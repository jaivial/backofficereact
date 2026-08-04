import React, { useMemo } from "react";
import { ImageOff } from "lucide-react";

import { cn } from "../../shadcn/utils";
import { AllergenIconList } from "../allergens/AllergenIconList";

type MenuDishPreviewCardProps = {
  title: string;
  description?: string | null;
  allergens?: string[];
  imageUrl?: string | null;
  supplementEnabled?: boolean;
  supplementPrice?: number | null;
  price?: number | null;
  className?: string;
};

function formatEuro(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  const out = rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(2);
  return `${out}EUR`;
}

export const MenuDishPreviewCard = React.memo(function MenuDishPreviewCard({
  title,
  description,
  allergens,
  imageUrl,
  supplementEnabled,
  supplementPrice,
  price,
  className,
}: MenuDishPreviewCardProps) {
  const supplementLabel = useMemo(() => {
    if (!supplementEnabled) return "";
    if (Number.isFinite(supplementPrice)) return `Suplemento +${formatEuro(Number(supplementPrice))}`;
    return "Suplemento";
  }, [supplementEnabled, supplementPrice]);

  const priceLabel = useMemo(() => {
    if (!Number.isFinite(price)) return "";
    return `+${formatEuro(Number(price))}`;
  }, [price]);

  return (
    <article className={cn("bo-menuDishPreviewCard", className)} data-testid="menu-dish-preview-card" data-slot="menu-dish-preview-card">
      <div className="bo-menuDishPreviewMedia" data-slot="menu-dish-preview-media">
        {imageUrl ? (
          <img src={imageUrl} alt="" loading="lazy" decoding="async" data-slot="menu-dish-preview-image" />
        ) : (
          <div className="bo-menuDishPreviewMediaPlaceholder" aria-hidden="true" data-slot="menu-dish-preview-media-placeholder">
            <ImageOff size={26} />
          </div>
        )}
      </div>

      <div className="bo-menuDishPreviewBody" data-slot="menu-dish-preview-body">
        <h3 className="bo-menuDishPreviewTitle" data-slot="menu-dish-preview-title">{title}</h3>
        {description ? <p className="bo-menuDishPreviewDescription" data-slot="menu-dish-preview-description">{description}</p> : null}

        <AllergenIconList allergens={allergens || []} className="bo-menuDishPreviewAllergens" />

        {supplementLabel || priceLabel ? (
          <div className="bo-menuDishPreviewMeta" data-slot="menu-dish-preview-meta">
            {supplementLabel ? <span className="bo-menuDishPreviewTag" data-slot="menu-dish-preview-tag">{supplementLabel}</span> : null}
            {priceLabel ? <span className="bo-menuDishPreviewTag" data-slot="menu-dish-preview-tag">{priceLabel}</span> : null}
          </div>
        ) : null}
      </div>
    </article>
  );
});
