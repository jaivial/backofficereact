import React, { useMemo } from "react";
import { ImageOff } from "lucide-react";

import { cn } from "../../shadcn/utils";

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

const ALLERGEN_ICONS: Record<string, string> = {
  Gluten: "/media/images/gluten.png",
  Crustaceos: "/media/images/crustaceos.png",
  Huevos: "/media/images/huevos.png",
  Pescado: "/media/images/pescado.png",
  Cacahuetes: "/media/images/cacahuetes.png",
  Soja: "/media/images/soja.png",
  Leche: "/media/images/leche.png",
  "Frutos de cascara": "/media/images/frutoscascara.png",
  Apio: "/media/images/apio.png",
  Mostaza: "/media/images/mostaza.png",
  Sesamo: "/media/images/sesamo.png",
  Sulfitos: "/media/images/sulfitos.png",
  Altramuces: "/media/images/altramuces.png",
  Moluscos: "/media/images/moluscos.png",
};

const ALLERGEN_LABELS: Record<string, string> = {
  Gluten: "Gluten",
  Crustaceos: "Crustaceos",
  Huevos: "Huevos",
  Pescado: "Pescado",
  Cacahuetes: "Cacahuetes",
  Soja: "Soja",
  Leche: "Leche",
  "Frutos de cascara": "Frutos de cascara",
  Apio: "Apio",
  Mostaza: "Mostaza",
  Sesamo: "Sesamo",
  Sulfitos: "Sulfitos",
  Altramuces: "Altramuces",
  Moluscos: "Moluscos",
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
  const allergenKeys = useMemo(
    () =>
      Array.from(new Set((allergens || []).map((item) => String(item || "").trim()).filter((key) => key && Boolean(ALLERGEN_ICONS[key])))),
    [allergens],
  );

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

        {allergenKeys.length > 0 ? (
          <div className="bo-menuDishPreviewAllergens" aria-label="Alergenos" data-slot="menu-dish-preview-allergens">
            {allergenKeys.map((key) => (
              <img
                key={key}
                src={ALLERGEN_ICONS[key]}
                className="bo-menuDishPreviewAllergenIcon"
                alt={ALLERGEN_LABELS[key] || key}
                title={ALLERGEN_LABELS[key] || key}
                loading="lazy"
                decoding="async"
                data-slot="menu-dish-preview-allergen"
              />
            ))}
          </div>
        ) : null}

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
