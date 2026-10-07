import React from "react";
import type { LucideIcon } from "lucide-react";
import { Archive, Banknote, ChefHat, Combine, FileText, Gift, HandCoins, IdCard, LayoutGrid, Lock, Map as MapIcon, MessageSquare, Percent, Receipt, Scissors, ShoppingBag, Split, Tags, Trash2, TrendingUp, UserRound, Wine, ListChecks, CirclePause, ChartPie, KeyRound } from "lucide-react";

export type RailFeatureKey =
  | "total" | "cerrar-mesas" | "comanda" | "aparcar" | "mesa" | "salon" | "juntar-mesas" | "borrar-comanda"
  | "cliente" | "cocina" | "cajon" | "descuento" | "recargo"
  | "invita" | "empleado" | "separar-comanda" | "tags" | "barra" | "llevar" | "comentario" | "mi-pin"
  | "dividir-comanda" | "propina" | "facturacion" | "cierre-x" | "cierre-y" | "cerrar-dia";

export type RailFeatureGroup = "cobro" | "cuenta" | "mesa" | "ajustes" | "cierre";

export const RAIL_GROUP_LABELS: Record<RailFeatureGroup, string> = {
  cobro: "Cobro",
  cuenta: "Cuenta",
  mesa: "Mesa",
  ajustes: "Ajustes",
  cierre: "Cierre",
};

/** One icon per rail command: a scannable glyph plus the label keeps dense tills readable. */
const RAIL_ICONS: Record<RailFeatureKey, LucideIcon> = {
  total: Banknote, comanda: ChefHat, "separar-comanda": Split, "dividir-comanda": Scissors, "juntar-mesas": Combine,
  descuento: Percent, recargo: TrendingUp, invita: Gift, comentario: MessageSquare, tags: Tags, propina: HandCoins,
  "borrar-comanda": Trash2, mesa: LayoutGrid, salon: MapIcon, aparcar: CirclePause, barra: Wine, llevar: ShoppingBag,
  cliente: IdCard, empleado: UserRound, cajon: Archive, cocina: ChefHat, "cerrar-mesas": ListChecks,
  facturacion: ChartPie, "mi-pin": KeyRound, "cierre-x": FileText, "cierre-y": Receipt, "cerrar-dia": Lock,
};

/** `readOnlySafe`: the command only reads, so a sealed day does not disable it. */
export const RAIL_FEATURES: Array<{ key: RailFeatureKey; label: string; group: RailFeatureGroup; accent?: boolean; danger?: boolean; readOnlySafe?: boolean }> = [
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
  { key: "borrar-comanda", label: "Borrar comanda", group: "cuenta", danger: true },
  { key: "mesa", label: "Mesa", group: "mesa" },
  { key: "salon", label: "Salón", group: "mesa" },
  { key: "aparcar", label: "Aparcar", group: "mesa" },
  { key: "barra", label: "Barra", group: "mesa" },
  { key: "llevar", label: "Para llevar", group: "mesa" },
  { key: "cliente", label: "Cliente", group: "mesa" },
  { key: "empleado", label: "Empleado", group: "mesa" },
  { key: "cajon", label: "Cajón", group: "ajustes" },
  { key: "mi-pin", label: "Mi PIN", group: "ajustes" },
  { key: "facturacion", label: "Facturación", group: "cierre", readOnlySafe: true },
  { key: "cerrar-mesas", label: "Cerrar mesas", group: "cierre", accent: true },
  { key: "cierre-x", label: "Cierre X", group: "cierre" },
  { key: "cierre-y", label: "Cierre Y", group: "cierre" },
  { key: "cerrar-dia", label: "Cerrar día", group: "cierre", accent: true },
];

export function POSControlRail({ onAction, disabledReasons = {}, readOnly = false }: {
  onAction: (key: RailFeatureKey) => void;
  /** Reason per disabled feature. Presence of a reason disables and explains the button. */
  disabledReasons?: Partial<Record<RailFeatureKey, string>>;
  /** Sealed day: disable every rail action except the read-only ones. */
  readOnly?: boolean;
}) {
  return (
    <nav className="pos-rail" aria-label="Acciones TPV" data-testid="pos-control-rail">
      {(Object.keys(RAIL_GROUP_LABELS) as RailFeatureGroup[]).map((group) => (
        <div className="pos-rail__group" role="group" aria-label={RAIL_GROUP_LABELS[group]} key={group} data-testid={`pos-rail-group-${group}`}>
          <span className="pos-rail__groupLabel" data-testid={`pos-rail-group-label-${group}`}>{RAIL_GROUP_LABELS[group]}</span>
          {RAIL_FEATURES.filter((feature) => feature.group === group).map((feature) => {
            const reason = readOnly && !feature.readOnlySafe ? "Día cerrado: solo consulta." : disabledReasons[feature.key];
            return (
              <React.Fragment key={feature.key}>
                <button
                  className={feature.accent ? "pos-rail__btn pos-rail__btn--accent" : feature.danger ? "pos-rail__btn pos-rail__btn--danger" : "pos-rail__btn"}
                  type="button"
                  disabled={Boolean(reason)}
                  title={reason}
                  aria-describedby={reason ? `pos-rail-reason-${feature.key}` : undefined}
                  onClick={() => onAction(feature.key)}
                  data-pos-command={feature.key}
                  data-testid={`pos-rail-${feature.key}`}
                >
                  {React.createElement(RAIL_ICONS[feature.key], { className: "pos-rail__icon", "aria-hidden": true, "data-testid": `pos-rail-icon-${feature.key}` } as React.ComponentProps<LucideIcon>)}
                  <span className="pos-rail__label" data-testid={`pos-rail-label-${feature.key}`}>{feature.label}</span>
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
