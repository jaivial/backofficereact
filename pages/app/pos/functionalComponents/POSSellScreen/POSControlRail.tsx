import React from "react";

export type RailFeatureKey =
  | "total" | "cerrar-mesas" | "comanda" | "aparcar" | "mesa" | "salon" | "juntar-mesas" | "borrar-comanda"
  | "combinado" | "cliente" | "cocina" | "cajon" | "descuento" | "recargo"
  | "invita" | "empleado" | "separar-comanda" | "tags" | "barra" | "comentario"
  | "dividir-comanda" | "suplemento" | "propina" | "pack" | "cierre-x" | "cierre-y" | "cerrar-dia";

export const RAIL_FEATURES: Array<{ key: RailFeatureKey; label: string; accent?: boolean }> = [
  { key: "total", label: "Total", accent: true },
  { key: "cerrar-mesas", label: "Cerrar mesas", accent: true },
  { key: "comanda", label: "Comanda" },
  { key: "aparcar", label: "Aparcar" },
  { key: "mesa", label: "Mesa" },
  { key: "salon", label: "Salón" },
  { key: "juntar-mesas", label: "Juntar mesas" },
  { key: "borrar-comanda", label: "Borrar comanda" },
  { key: "combinado", label: "Combinado" },
  { key: "cliente", label: "Cliente" },
  { key: "cocina", label: "Cocina" },
  { key: "cajon", label: "Cajón" },
  { key: "descuento", label: "Descuento" },
  { key: "recargo", label: "Recargo" },
  { key: "invita", label: "Invita" },
  { key: "empleado", label: "Empleado" },
  { key: "separar-comanda", label: "Separar comanda" },
  { key: "tags", label: "Tags" },
  { key: "barra", label: "Barra" },
  { key: "comentario", label: "Comentario" },
  { key: "dividir-comanda", label: "Dividir comanda" },
  { key: "suplemento", label: "Suplemento" },
  { key: "propina", label: "Propina" },
  { key: "pack", label: "Pack" },
  { key: "cierre-x", label: "Cierre X" },
  { key: "cierre-y", label: "Cierre Y" },
  { key: "cerrar-dia", label: "Cerrar día", accent: true },
];

export function POSControlRail({ onAction, disabledKeys = [], readOnly = false }: { onAction: (key: RailFeatureKey) => void; disabledKeys?: RailFeatureKey[]; /** Sealed day: disable every rail action. */ readOnly?: boolean }) {
  return (
    <nav className="pos-rail" aria-label="Acciones TPV" data-testid="pos-control-rail">
      {RAIL_FEATURES.map((feature) => (
        <button
          className={feature.accent ? "pos-rail__btn pos-rail__btn--accent" : "pos-rail__btn"}
          type="button"
          key={feature.key}
          disabled={readOnly || disabledKeys.includes(feature.key)}
          onClick={() => onAction(feature.key)}
          data-testid={`pos-rail-${feature.key}`}
        >
          {feature.label}
        </button>
      ))}
    </nav>
  );
}
