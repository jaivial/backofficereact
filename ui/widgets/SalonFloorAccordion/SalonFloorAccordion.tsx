import React, { useState } from "react";
import { ChevronDown, Pencil, Trash2 } from "lucide-react";

import type { ConfigFloor, ConfigSalon } from "../../../api/types";
import { Switch } from "../../shadcn/Switch";
import { salonCapacityText } from "../../../pages/app/config/helpers/salonsHelpers";

/**
 * Floor card with accordion body listing its salones.
 *
 * variant="status" — the header keeps the floor activation switch and the
 * salones below are read-only (name + capacity).
 * variant="manage" — no floor switch; each salón carries its own activation
 * switch plus edit and delete actions.
 *
 * Used by both /app/config (global) and /app/reservas/config (per-date).
 */
export type SalonFloorAccordionProps = {
  floor: ConfigFloor;
  salons: ConfigSalon[];
  variant: "status" | "manage";
  busy?: boolean;
  /** variant="status": persist the floor activation. */
  onFloorToggle?: (next: boolean) => void;
  /** variant="manage": persist a salón activation change. */
  onSalonToggle?: (salon: ConfigSalon, next: boolean) => void;
  onEdit?: (salon: ConfigSalon) => void;
  onDelete?: (salon: ConfigSalon) => void;
  defaultOpen?: boolean;
  testIdPrefix: string;
};

export function SalonFloorAccordion({
  floor,
  salons,
  variant,
  busy,
  onFloorToggle,
  onSalonToggle,
  onEdit,
  onDelete,
  defaultOpen = false,
  testIdPrefix,
}: SalonFloorAccordionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const isStatus = variant === "status";
  const floorId = floor.id;

  return (
    <div
      className={`bo-configSalonFloorCard${open ? " is-open" : ""}`}
      data-testid={`${testIdPrefix}-floor-card-${floorId}`}
    >
      <div className="bo-floorSalonCard" data-testid={`${testIdPrefix}-floor-card-info-${floor.floorNumber}`}>
        <button
          type="button"
          className="bo-floorAccordionTrigger"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={`Salones de ${floor.name}`}
          disabled={busy}
          data-testid={`${testIdPrefix}-floor-accordion-trigger-${floorId}`}
        >
          <span className="bo-floorAccordionTriggerInfo">
            <span className="bo-floorCardName" data-testid={`${testIdPrefix}-floor-name-${floor.floorNumber}`}>
              {floor.name}
            </span>
            <span className="bo-floorCardHint" data-testid={`${testIdPrefix}-floor-hint-${floor.floorNumber}`}>
              {salons.length} {salons.length === 1 ? "salón" : "salones"}
            </span>
          </span>
          <ChevronDown className="bo-floorAccordionChevron" aria-hidden />
        </button>

        {isStatus ? (
          <div className="bo-floorSalonCardState" data-testid={`${testIdPrefix}-floor-state-${floor.floorNumber}`}>
            <span className="bo-floorSalonCardStatus" data-testid={`${testIdPrefix}-floor-status-${floor.floorNumber}`}>
              {floor.active ? "Activa" : "Inactiva"}
            </span>
            <Switch
              checked={floor.active}
              disabled={busy}
              onCheckedChange={(checked) => onFloorToggle?.(checked)}
              aria-label={`Activar o desactivar ${floor.name}`}
              data-testid={`${testIdPrefix}-floor-switch-${floorId}`}
            />
          </div>
        ) : null}
      </div>

      {open ? (
        salons.length === 0 ? (
          <p className="bo-configSalonEmpty" data-testid={`${testIdPrefix}-floor-empty-${floorId}`}>
            Sin salones en esta planta.
          </p>
        ) : (
          <ul className="bo-configSalonList" data-testid={`${testIdPrefix}-floor-salon-list-${floorId}`}>
            {salons.map((salon) => (
              <li
                key={salon.id}
                className="bo-configSalonRow"
                data-testid={`${testIdPrefix}-salon-row-${salon.id}`}
              >
                <div className="bo-configSalonInfo">
                  <span className="bo-configSalonName" data-testid={`${testIdPrefix}-salon-name-${salon.id}`}>
                    {salon.name}
                  </span>
                  <span className="bo-configSalonMeta" data-testid={`${testIdPrefix}-salon-meta-${salon.id}`}>
                    {salonCapacityText(salon)}
                    {!salon.isActive ? " · Inactivo" : ""}
                  </span>
                </div>
                {isStatus ? null : (
                  <div className="bo-configSalonActions" data-testid={`${testIdPrefix}-salon-actions-${salon.id}`}>
                    <Switch
                      checked={salon.isActive}
                      disabled={busy}
                      onCheckedChange={(checked) => onSalonToggle?.(salon, checked)}
                      aria-label={`Activar o desactivar ${salon.name}`}
                      data-testid={`${testIdPrefix}-salon-switch-${salon.id}`}
                    />
                    <button
                      type="button"
                      className="bo-iconButton"
                      onClick={() => onEdit?.(salon)}
                      disabled={busy}
                      aria-label={`Editar ${salon.name}`}
                      data-testid={`${testIdPrefix}-salon-edit-${salon.id}`}
                    >
                      <Pencil className="bo-ico" aria-hidden />
                    </button>
                    <button
                      type="button"
                      className="bo-iconButton bo-iconButton--danger"
                      onClick={() => onDelete?.(salon)}
                      disabled={busy}
                      aria-label={`Eliminar ${salon.name}`}
                      data-testid={`${testIdPrefix}-salon-delete-${salon.id}`}
                    >
                      <Trash2 className="bo-ico" aria-hidden />
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )
      ) : null}
    </div>
  );
}
