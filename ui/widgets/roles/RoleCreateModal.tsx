import React, { useEffect, useMemo, useState } from "react";

import { Select } from "../../inputs/Select";
import { Slider } from "../../inputs/Slider";
import { Modal } from "../../overlays/Modal";
import { cn } from "../../shadcn/utils";
import { RoleIcon } from "./RoleIcon";

const ALL_SECTIONS = [
  { key: "reservas", label: "Reservas" },
  { key: "menus", label: "Menus" },
  { key: "miembros", label: "Miembros" },
  { key: "horarios", label: "Horarios" },
  { key: "ajustes", label: "Ajustes" },
  { key: "fichaje", label: "Fichaje" },
] as const;

const ICON_OPTIONS = [
  { value: "badge-check", label: "Insignia" },
  { value: "shield-user", label: "Escudo" },
  { value: "clipboard-list", label: "Checklist" },
  { value: "utensils", label: "Cubiertos" },
  { value: "utensils-crossed", label: "Cocina" },
  { value: "flame", label: "Fuego" },
  { value: "glass-water", label: "Sala" },
  { value: "users-round", label: "Equipo" },
  { value: "user-round-plus", label: "Ayudante" },
  { value: "route", label: "Runner" },
  { value: "coffee", label: "Café" },
  { value: "droplets", label: "Limpieza" },
] as const;

export type CreateRoleInput = {
  label: string;
  importance: number;
  iconKey: string;
  permissions: string[];
};

function sanitizeImportance(raw: number, maxAllowed: number): number {
  if (!Number.isFinite(raw)) return Math.min(50, maxAllowed);
  const rounded = Math.round(raw);
  if (rounded < 0) return 0;
  if (rounded > maxAllowed) return maxAllowed;
  return rounded;
}

export function RoleCreateModal({
  open,
  onClose,
  onCreate,
  busy,
  actorImportance,
  className,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (input: CreateRoleInput) => Promise<void>;
  busy: boolean;
  actorImportance: number;
  className?: string;
}) {
  const maxAllowed = Math.max(0, actorImportance - 1);
  const [label, setLabel] = useState("");
  const [importance, setImportance] = useState(Math.min(50, maxAllowed));
  const [iconKey, setIconKey] = useState("badge-check");
  const [permissions, setPermissions] = useState<string[]>(["fichaje"]);

  useEffect(() => {
    if (!open) return;
    setLabel("");
    setImportance(Math.min(50, maxAllowed));
    setIconKey("badge-check");
    setPermissions(["fichaje"]);
  }, [maxAllowed, open]);

  const iconOptions = useMemo(
    () =>
      ICON_OPTIONS.map((opt) => ({
        value: opt.value,
        label: opt.label,
        icon: <RoleIcon roleSlug="custom" iconKey={opt.value} size={15} strokeWidth={1.8} />,
      })),
    [],
  );

  const canSubmit = useMemo(() => {
    return label.trim().length >= 2 && permissions.length > 0 && sanitizeImportance(importance, maxAllowed) <= maxAllowed;
  }, [importance, label, maxAllowed, permissions.length]);

  return (
    <Modal open={open} title="Crear rol" onClose={onClose} widthPx={680}>
      <div className="bo-modalHead" data-slot="roleCreateModal-modalHead">
        <div className="bo-modalTitle" data-slot="roleCreateModal-modalTitle">Crear rol</div>
        <button className="bo-modalX" type="button" onClick={onClose} aria-label="Close" data-testid="role-create-close">
          ×
        </button>
      </div>

      <div className="bo-modalOutline" style={{ marginTop: 10 }} data-slot="roleCreateModal-modalOutline">
        <div className="bo-panel bo-roleCreatePanel" data-slot="roleCreateModal-roleCreatePanel">
          <div className="bo-panelHead" data-slot="roleCreateModal-panelHead">
            <div data-slot="roleCreateModal-div">
              <div className="bo-panelTitle" data-slot="roleCreateModal-panelTitle">Datos del rol</div>
              <div className="bo-panelMeta" data-slot="roleCreateModal-panelMeta">Importancia máxima permitida para tu sesión: {maxAllowed}</div>
            </div>
          </div>
          <div className="bo-panelBody bo-roleCreateBody" data-slot="roleCreateModal-roleCreateBody">
            <label className="bo-field bo-field--wide" data-slot="role-create-name-label">
              <div className="bo-label" data-slot="roleCreateModal-label">Nombre</div>
              <input className="bo-input" value={label} onChange={(ev) => setLabel(ev.target.value)} placeholder="Ej. Encargado de eventos" data-testid="role-create-name-input" />
            </label>

            <label className="bo-field bo-field--wide" data-slot="role-create-importance-label">
              <div className="bo-label" data-slot="roleCreateModal-label">Importancia (0-100)</div>
              <Slider value={importance} min={0} max={maxAllowed} onChange={setImportance} ariaLabel="Importancia del rol" />
            </label>

            <label className="bo-field bo-field--wide" data-slot="role-create-icon-label">
              <div className="bo-label" data-slot="roleCreateModal-label">Icono</div>
              <div className="bo-roleCreateIconRow" data-slot="roleCreateModal-roleCreateIconRow">
                <span className="bo-roleCreateIconPreview" aria-hidden="true" data-slot="roleCreateModal-roleCreateIconPreview">
                  <RoleIcon roleSlug="custom" iconKey={iconKey} size={20} strokeWidth={1.8} />
                </span>
                <Select
                  value={iconKey}
                  onChange={setIconKey}
                  options={iconOptions}
                  ariaLabel="Seleccionar icono"
                  className="bo-roleCreateIconSelect"
                  listMaxHeightPx={200}
                />
              </div>
            </label>

            <div className="bo-field bo-field--wide" data-slot="roleCreateModal-field--wide">
              <div className="bo-label" data-slot="roleCreateModal-label">Permisos</div>
              <div className="bo-chips" data-slot="roleCreateModal-chips">
                {ALL_SECTIONS.map((section) => {
                  const on = permissions.includes(section.key);
                  return (
                    <button
                      key={section.key}
                      type="button"
                      className={cn("bo-chip", on && "is-on")}
                      data-testid={`role-create-perm-${section.key}`}
                      onClick={() =>
                        setPermissions((prev) =>
                          prev.includes(section.key) ? prev.filter((x) => x !== section.key) : [...prev, section.key],
                        )
                      }
                    >
                      {section.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bo-modalActions" data-slot="roleCreateModal-modalActions">
        <button className="bo-btn bo-btn--ghost" type="button" onClick={onClose} data-testid="role-create-cancel">
          Cancelar
        </button>
        <button
          className="bo-btn bo-btn--primary"
          type="button"
          disabled={busy || !canSubmit}
          data-testid="role-create-submit"
          onClick={() =>
            void onCreate({
              label: label.trim(),
              importance: sanitizeImportance(importance, maxAllowed),
              iconKey,
              permissions,
            })
          }
        >
          Crear rol
        </button>
      </div>
    </Modal>
  );
}
