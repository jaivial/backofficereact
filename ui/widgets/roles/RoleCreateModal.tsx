import React, { useEffect, useMemo, useState } from "react";

import { Select } from "../../inputs/Select";
import { Slider } from "../../inputs/Slider";
import { Modal } from "../../overlays/Modal";
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
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (input: CreateRoleInput) => Promise<void>;
  busy: boolean;
  actorImportance: number;
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
      <div className="flex items-center justify-between pb-4 border-b border-white/[0.06]">
        <div className="text-lg font-semibold text-foreground">Crear rol</div>
        <button className="w-8 h-8 flex items-center justify-center text-2xl text-muted-foreground hover:text-foreground" type="button" onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>

      <div className="mt-[10px]">
        <div className="rounded-lg border border-white/[0.06] bg-white/[0.02]">
          <div className="p-4 border-b border-white/[0.06]">
            <div>
              <div className="text-sm font-semibold text-foreground mb-1">Datos del rol</div>
              <div className="text-xs text-muted-foreground">Importancia máxima permitida para tu sesión: {maxAllowed}</div>
            </div>
          </div>
          <div className="p-4 space-y-4">
            <label className="block">
              <div className="text-xs text-muted-foreground font-medium mb-2">Nombre</div>
              <input className="w-full h-10 px-3 rounded-lg border border-white/[0.06] bg-white/[0.03] text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/40" value={label} onChange={(ev) => setLabel(ev.target.value)} placeholder="Ej. Encargado de eventos" />
            </label>

            <label className="block">
              <div className="text-xs text-muted-foreground font-medium mb-2">Importancia (0-100)</div>
              <Slider value={importance} min={0} max={maxAllowed} onChange={setImportance} ariaLabel="Importancia del rol" />
            </label>

            <label className="block">
              <div className="text-xs text-muted-foreground font-medium mb-2">Icono</div>
              <div className="flex items-center gap-3">
                <span className="w-10 h-10 flex items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.03]" aria-hidden="true">
                  <RoleIcon roleSlug="custom" iconKey={iconKey} size={20} strokeWidth={1.8} />
                </span>
                <Select
                  value={iconKey}
                  onChange={setIconKey}
                  options={iconOptions}
                  ariaLabel="Seleccionar icono"
                  className="flex-1"
                  listMaxHeightPx={200}
                />
              </div>
            </label>

            <div className="block">
              <div className="text-xs text-muted-foreground font-medium mb-2">Permisos</div>
              <div className="flex flex-wrap gap-2">
                {ALL_SECTIONS.map((section) => {
                  const on = permissions.includes(section.key);
                  return (
                    <button
                      key={section.key}
                      type="button"
                      className={`inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${on ? "bg-primary text-primary-foreground" : "bg-white/[0.04] text-foreground hover:bg-white/[0.06] border border-white/[0.06]"}`}
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

      <div className="flex justify-end gap-2 mt-4">
        <button className="inline-flex items-center justify-center h-9 px-4 rounded-lg text-sm font-medium bg-transparent text-foreground hover:bg-white/[0.06]" type="button" onClick={onClose}>
          Cancelar
        </button>
        <button
          className="inline-flex items-center justify-center h-9 px-4 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90"
          type="button"
          disabled={busy || !canSubmit}
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
