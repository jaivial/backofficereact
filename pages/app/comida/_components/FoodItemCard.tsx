import React, { useCallback, useMemo } from "react";
import { PencilLine, Trash2 } from "lucide-react";

import type { FoodItem, Vino } from "../../../../api/types";
import { Switch } from "../../../../ui/shadcn/Switch";

type FoodType = "platos" | "bebidas" | "cafes" | "vinos";

interface FoodItemCardProps {
  item: FoodItem | Vino;
  foodType: FoodType;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
}

function formatEuro(price: number): string {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(price);
}

export const FoodItemCard = React.memo(function FoodItemCard({
  item,
  foodType,
  onEdit,
  onDelete,
  onToggle,
}: FoodItemCardProps) {
  const isWine = foodType === "vinos";

  const formatAlergenos = useCallback((alergenos?: string[]) => {
    if (!alergenos || alergenos.length === 0) return null;
    return alergenos.join(", ");
  }, []);

  const alergenosText = useMemo(() => {
    if (isWine) return null;
    return formatAlergenos((item as FoodItem).alergenos);
  }, [item, isWine, formatAlergenos]);

  const suplemento = useMemo(() => {
    if (isWine) return null;
    const sup = (item as FoodItem).suplemento;
    return sup && sup > 0 ? formatEuro(sup) : null;
  }, [item, isWine]);

  const fotoUrl = useMemo(() => {
    if (isWine) {
      // For wines, check has_foto - we need the full URL from API
      return (item as Vino).has_foto ? (item as Vino).has_foto : null;
    }
    return (item as FoodItem).foto_url || null;
  }, [item, isWine]);

  const wineSpecific = useMemo(() => {
    if (!isWine) return null;
    const w = item as Vino;
    return {
      bodega: w.bodega,
      denominacion: w.denominacion_origen,
      graduacion: w.graduacion,
      anyo: w.anyo,
    };
  }, [item, isWine]);

  const tipoLabel = useMemo(() => {
    return item.tipo || foodType;
  }, [item.tipo, foodType]);

  return (
    <article className="bo-foodCard" role="listitem">
      {/* Image */}
      <div className="bo-foodCard-image">
        {fotoUrl ? (
          <img src={fotoUrl} alt="" loading="lazy" decoding="async" />
        ) : (
          <div className="bo-foodCard-placeholder" />
        )}
      </div>

      {/* Content */}
      <div className="bo-foodCard-content">
        <div className="bo-foodCard-meta">
          <span className="bo-foodCard-tipo">{tipoLabel}</span>
          {!item.active && <span className="bo-foodCard-inactive">Inactivo</span>}
        </div>

        <h3 className="bo-foodCard-title">{item.nombre}</h3>

        {item.descripcion && (
          <p className="bo-foodCard-desc">{item.descripcion}</p>
        )}

        {/* Wine specific */}
        {isWine && wineSpecific && (
          <div className="bo-foodCard-wineMeta">
            {wineSpecific.bodega && <span className="bo-foodCard-wineBodega">{wineSpecific.bodega}</span>}
            {wineSpecific.denominacion && (
              <span className="bo-foodCard-wineDO">D.O. {wineSpecific.denominacion}</span>
            )}
            <div className="bo-foodCard-wineFacts">
              {wineSpecific.anyo && <span>{wineSpecific.anyo}</span>}
              {wineSpecific.graduacion && <span>{wineSpecific.graduacion}%</span>}
            </div>
          </div>
        )}

        {/* Alergenos */}
        {alergenosText && (
          <div className="bo-foodCard-alergenos">
            <span className="bo-foodCard-alergenosLabel">Alergenos:</span>
            {alergenosText}
          </div>
        )}
      </div>

      {/* Price and actions */}
      <div className="bo-foodCard-footer">
        <div className="bo-foodCard-price">
          {formatEuro(item.precio)}
          {suplemento && <span className="bo-foodCard-suplemento">+{suplemento}</span>}
        </div>

        <div className="bo-foodCard-actions">
          <Switch
            checked={!!item.active}
            onCheckedChange={onToggle}
            aria-label={`Activar ${item.nombre}`}
          />
          <button
            className="bo-btn bo-btn--ghost bo-btn--sm bo-foodCardIconBtn"
            type="button"
            onClick={onEdit}
            aria-label={`Editar ${item.nombre}`}
            title="Editar"
          >
            <PencilLine size={14} />
          </button>
          <button
            className="bo-btn bo-btn--ghost bo-btn--danger bo-btn--sm bo-foodCardIconBtn"
            type="button"
            onClick={onDelete}
            aria-label={`Eliminar ${item.nombre}`}
            title="Eliminar"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </article>
  );
});
