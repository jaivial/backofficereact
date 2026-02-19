import React, { useCallback, useMemo } from "react";
import { PencilLine, Trash2 } from "lucide-react";

import type { FoodItem, Vino } from "../../../../api/types";
import { Switch } from "../../../../ui/shadcn/Switch";
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

  const onKeyDown = useCallback((e: React.KeyboardEvent<HTMLElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onOpen();
    }
  }, [onOpen]);

  const stopPropagation = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
  }, []);

  return (
    <article
      className="bo-memberCard bo-foodMemberCard"
      role="button"
      tabIndex={0}
      aria-label={`Abrir detalle de ${item.nombre}`}
      onClick={onOpen}
      onKeyDown={onKeyDown}
    >
      <div className="bo-foodMemberMedia" aria-hidden="true">
        {item.foto_url ? <img src={item.foto_url} alt="" loading="lazy" decoding="async" /> : <div className="bo-foodMemberMediaPlaceholder" />}
      </div>

      <div className="bo-foodMemberBody">
        <div className="bo-foodMemberTitleRow">
          <h3 className="bo-foodMemberTitle">{item.nombre}</h3>
          {!item.active ? <span className="bo-badge bo-badge--danger">Inactivo</span> : null}
        </div>

        {secondaryMeta ? <div className="bo-foodMemberMeta">{secondaryMeta}</div> : null}
        {extraMeta ? <div className="bo-foodMemberSubMeta">{extraMeta}</div> : null}

        <div className="bo-foodMemberFooter">
          <span className="bo-foodMemberPrice">{formatEuro(item.precio)}</span>
          <div className="bo-foodMemberActions">
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
                stopPropagation(e);
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
                stopPropagation(e);
                onDelete();
              }}
              aria-label={`Eliminar ${item.nombre}`}
              title="Eliminar"
              disabled={busy}
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      </div>
    </article>
  );
});
