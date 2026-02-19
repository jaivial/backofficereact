import React, { useMemo } from "react";
import { ChevronLeft } from "lucide-react";
import { usePageContext } from "vike-react/usePageContext";

import type { FoodItem, Vino } from "../../../../../api/types";
import type { Data } from "./+data";
import { useErrorToast } from "../../../../../ui/feedback/useErrorToast";
import { FOOD_TYPE_LABELS } from "../../_components/foodTypes";

function formatEuro(value: number): string {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(Number(value || 0));
}

export default function Page() {
  const pageContext = usePageContext();
  const data = pageContext.data as Data;
  useErrorToast(data.error);

  const item = data.item;
  const foodType = data.foodType;

  const isWine = foodType === "vinos";
  const title = useMemo(() => {
    if (!item) return "Detalle no disponible";
    return item.nombre || `Elemento #${data.foodId}`;
  }, [data.foodId, item]);

  const backHref = `/app/comida/${foodType}`;

  return (
    <section aria-label="Detalle comida" className="bo-content-grid bo-memberDetailPage">
      <button className="bo-menuBackBtn" type="button" onClick={() => window.location.assign(backHref)}>
        <ChevronLeft size={16} />
        Volver a {FOOD_TYPE_LABELS[foodType]}
      </button>

      {!item ? (
        <div className="bo-panel">
          <div className="bo-panelHead">
            <div className="bo-panelTitle">Elemento no disponible</div>
            <div className="bo-panelMeta">No se pudo cargar el detalle solicitado.</div>
          </div>
        </div>
      ) : (
        <div className="bo-panel bo-foodDetailPanel">
          <div className="bo-panelHead bo-foodDetailHead">
            <div>
              <div className="bo-panelTitle">{title}</div>
              <div className="bo-panelMeta">
                {FOOD_TYPE_LABELS[foodType]} · #{item.num}
              </div>
            </div>
            <div className="bo-foodDetailPrice">{formatEuro(item.precio)}</div>
          </div>

          <div className="bo-foodDetailGrid">
            <div className="bo-foodDetailField">
              <span className="bo-foodDetailLabel">Tipo</span>
              <span>{item.tipo || "-"}</span>
            </div>
            <div className="bo-foodDetailField">
              <span className="bo-foodDetailLabel">Estado</span>
              <span>{item.active ? "Activo" : "Inactivo"}</span>
            </div>

            {!isWine ? (
              <>
                <div className="bo-foodDetailField">
                  <span className="bo-foodDetailLabel">Categoria</span>
                  <span>{(item as FoodItem).categoria || "-"}</span>
                </div>
                <div className="bo-foodDetailField">
                  <span className="bo-foodDetailLabel">Suplemento</span>
                  <span>{formatEuro((item as FoodItem).suplemento || 0)}</span>
                </div>
              </>
            ) : (
              <>
                <div className="bo-foodDetailField">
                  <span className="bo-foodDetailLabel">Bodega</span>
                  <span>{(item as Vino).bodega || "-"}</span>
                </div>
                <div className="bo-foodDetailField">
                  <span className="bo-foodDetailLabel">D.O.</span>
                  <span>{(item as Vino).denominacion_origen || "-"}</span>
                </div>
              </>
            )}

            <div className="bo-foodDetailField bo-foodDetailField--full">
              <span className="bo-foodDetailLabel">Descripcion</span>
              <span>{item.descripcion || "-"}</span>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
