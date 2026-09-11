import React from "react";

export type RailFeatureKey =
  | "total" | "cerrar-mesas" | "comanda" | "aparcar" | "mesa" | "salon" | "juntar-mesas" | "borrar-comanda"
  | "cliente" | "cocina" | "cajon" | "descuento" | "recargo"
  | "invita" | "empleado" | "separar-comanda" | "tags" | "barra" | "llevar" | "comentario"
  | "dividir-comanda" | "propina" | "cierre-x" | "cierre-y" | "cerrar-dia";

export type RailFeatureGroup = "cobro" | "cuenta" | "mesa" | "ajustes" | "cierre";

export const RAIL_GROUP_LABELS: Record<RailFeatureGroup, string> = {
  cobro: "Cobro",
  cuenta: "Cuenta",
  mesa: "Mesa",
  ajustes: "Ajustes",
  cierre: "Cierre",
};

export const RAIL_FEATURES: Array<{ key: RailFeatureKey; label: string; group: RailFeatureGroup; accent?: boolean }> = [
  { key: "total", label: "Total", group: "cobro", accent: true },
  { key: "comanda", label: "Comanda", group: "cuenta" },
  { key: "separar-comanda", label: "Separar comanda", group: "cuenta" },
  { key: "dividir-comanda", label: "Dividir comanda", group: "cuenta" },
  { key: "juntar-mesas", label: "Juntar mesas", group: "cuenta" },
  { key: "descuento", label: "Descuento", group: "cuenta" },
  { key: "recargo", label: "Recargo", group: "cuenta" },
  { key: "invita", label: "Invita", group: "cuenta" },
  { key: "comentario", label: "Comentario", group: "cuenta" },
  { key: "tags", label: "Tags", group: "cuenta" },
  { key: "propina", label: "Propina", group: "cuenta" },
  { key: "borrar-comanda", label: "Borrar comanda", group: "cuenta" },
  { key: "mesa", label: "Mesa", group: "mesa" },
  { key: "salon", label: "Salón", group: "mesa" },
  { key: "aparcar", label: "Aparcar", group: "mesa" },
  { key: "barra", label: "Barra", group: "mesa" },
  { key: "llevar", label: "Para llevar", group: "mesa" },
  { key: "cliente", label: "Cliente", group: "mesa" },
  { key: "empleado", label: "Empleado", group: "mesa" },
  { key: "cajon", label: "Cajón", group: "ajustes" },
  { key: "cerrar-mesas", label: "Cerrar mesas", group: "cierre", accent: true },
  { key: "cierre-x", label: "Cierre X", group: "cierre" },
  { key: "cierre-y", label: "Cierre Y", group: "cierre" },
  { key: "cerrar-dia", label: "Cerrar día", group: "cierre", accent: true },
];

export function POSControlRail({ onAction, disabledReasons = {}, readOnly = false }: {
  onAction: (key: RailFeatureKey) => void;
  /** Reason per disabled feature. Presence of a reason disables and explains the button. */
  disabledReasons?: Partial<Record<RailFeatureKey, string>>;
  /** Sealed day: disable every rail action. */
  readOnly?: boolean;
}) {
  return (
    <nav className="pos-rail" aria-label="Acciones TPV" data-testid="pos-control-rail">
      {(Object.keys(RAIL_GROUP_LABELS) as RailFeatureGroup[]).map((group) => (
        <div className="pos-rail__group" role="group" aria-label={RAIL_GROUP_LABELS[group]} key={group} data-testid={`pos-rail-group-${group}`}>
          <span className="pos-rail__groupLabel" data-testid={`pos-rail-group-label-${group}`}>{RAIL_GROUP_LABELS[group]}</span>
          {RAIL_FEATURES.filter((feature) => feature.group === group).map((feature) => {
            const reason = readOnly ? "Día cerrado: solo consulta." : disabledReasons[feature.key];
            return (
              <React.Fragment key={feature.key}>
                <button
                  className={feature.accent ? "pos-rail__btn pos-rail__btn--accent" : "pos-rail__btn"}
                  type="button"
                  disabled={Boolean(reason)}
                  title={reason}
                  aria-describedby={reason ? `pos-rail-reason-${feature.key}` : undefined}
                  onClick={() => onAction(feature.key)}
                  data-pos-command={feature.key}
                  data-testid={`pos-rail-${feature.key}`}
                >
                  {feature.label}
                </button>
                {reason ? <span id={`pos-rail-reason-${feature.key}`} className="pos-rail__reason" data-testid={`pos-rail-reason-${feature.key}`}>{reason}</span> : null}
              </React.Fragment>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
