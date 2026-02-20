import React, { useMemo } from "react";
import { PencilLine, Trash2 } from "lucide-react";

import type { FoodItem, Vino } from "../../../../api/types";
import { Switch } from "../../../../ui/shadcn/Switch";
import { FoodDishCard } from "../../../../ui/widgets/food/FoodDishCard";
import type { FoodType } from "./foodTypes";

interface FoodItemCardProps {
  item: FoodItem | Vino;
  foodType: FoodType;
  busy?: boolean;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
}

function formatEuro(price: number): string {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(Number(price || 0));
}

export const FoodItemCard = React.memo(function FoodItemCard({
  item,
  foodType,
  busy,
  onOpen,
  onEdit,
  onDelete,
  onToggle,
}: FoodItemCardProps) {
  const isWine = foodType === "vinos";

  const secondaryMeta = useMemo(() => {
    if (isWine) {
      const wine = item as Vino;
      const parts = [wine.tipo, wine.denominacion_origen].filter(Boolean);
      return parts.join(" · ");
    }

    const food = item as FoodItem;
    if (foodType === "platos") {
      const badgeParts = [food.categoria || food.tipo, food.suplemento && food.suplemento > 0 ? `+${formatEuro(food.suplemento)}` : ""].filter(Boolean);
      return badgeParts.join(" · ");
    }
    return [food.tipo, food.categoria].filter(Boolean).join(" · ");
  }, [foodType, isWine, item]);

  const extraMeta = useMemo(() => {
    if (isWine) {
      const wine = item as Vino;
      return [wine.bodega, wine.anyo].filter(Boolean).join(" · ");
    }
    const food = item as FoodItem;
    if (food.alergenos?.length) {
      return `${food.alergenos.length} alergenos`;
    }
    return "";
  }, [isWine, item]);

  return (
    <FoodDishCard
      title={item.nombre}
      imageUrl={item.foto_url}
      inactive={!item.active}
      primaryMeta={secondaryMeta}
      secondaryMeta={extraMeta}
      priceLabel={formatEuro(item.precio)}
      onOpen={onOpen}
      openAriaLabel={`Abrir detalle de ${item.nombre}`}
      footerActions={(
        <>
          <Switch
            checked={!!item.active}
            onCheckedChange={onToggle}
            disabled={busy}
            aria-label={`Activar ${item.nombre}`}
            onClick={(e: React.MouseEvent<HTMLElement>) => e.stopPropagation()}
          />
          <button
            className="bo-btn bo-btn--ghost bo-btn--sm bo-foodCardIconBtn"
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            aria-label={`Editar ${item.nombre}`}
            title="Editar"
            disabled={busy}
          >
            <PencilLine size={14} />
          </button>
          <button
            className="bo-btn bo-btn--ghost bo-btn--danger bo-btn--sm bo-foodCardIconBtn"
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            aria-label={`Eliminar ${item.nombre}`}
            title="Eliminar"
            disabled={busy}
          >
            <Trash2 size={14} />
          </button>
        </>
      )}
    />
  );
});
