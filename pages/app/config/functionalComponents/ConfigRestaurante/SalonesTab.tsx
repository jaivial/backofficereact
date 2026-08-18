import React, { useEffect, useMemo, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";

import type { ConfigFloor, ConfigSalon } from "../../../../../api/types";
import { ConfirmDialog } from "../../../../../ui/overlays/ConfirmDialog";
import { Modal } from "../../../../../ui/overlays/Modal";
import { Select } from "../../../../../ui/inputs/Select";
import { Switch } from "../../../../../ui/shadcn/Switch";
import { PlusMinusCounter } from "../../../../../ui/widgets/PlusMinusCounter";
import { Button } from "../../../../../ui/actions/Button";
import { readAPIMessage } from "../../../config/helpers/configHelpers";
import { applySalonPatch, DEFAULT_SALON_CAPACITY, groupSalonsByFloor, newSalonDraft, salonCapacityText, type SalonDraft } from "../../../config/helpers/salonsHelpers";

export type SalonEditorMode = { kind: "create" } | { kind: "edit"; salon: ConfigSalon };

interface SalonesTabProps {
  floors: ConfigFloor[];
  /** When set, salones shown/created belong to this date only (reservas config). */
  date?: string;
  api: {
    config: {
      listSalons: (date?: string) => Promise<{ success: boolean; message?: string; salons?: ConfigSalon[] }>;
      createSalon: (input: { floorId: number; name: string; hasCapacityLimit: boolean; capacityLimit: number; isActive?: boolean; date?: string }) => Promise<{ success: boolean; message?: string; salons?: ConfigSalon[] }>;
      updateSalon: (salonId: number, input: { floorId: number; name: string; hasCapacityLimit: boolean; capacityLimit: number; isActive?: boolean; date?: string }) => Promise<{ success: boolean; message?: string; salons?: ConfigSalon[] }>;
      deleteSalon: (salonId: number) => Promise<{ success: boolean; message?: string }>;
      setSalonDayStatus?: (input: { date: string; salonId: number; active: boolean }) => Promise<{ success: boolean; message?: string; salons?: ConfigSalon[] }>;
    };
  };
  busy: boolean;
  setBusy: (v: boolean) => void;
  setError: (msg: string | null) => void;
  pushToast: (t: { kind: "success" | "error" | "info"; title: string; message?: string }) => void;
}

function draftFromSalon(salon: ConfigSalon): SalonDraft {
  return {
    floorNumber: salon.floorNumber,
    name: salon.name,
    hasCapacityLimit: salon.hasCapacityLimit,
    capacityLimit: salon.capacityLimit || DEFAULT_SALON_CAPACITY,
  };
}

function draftToInput(draft: SalonDraft, floor: ConfigFloor) {
  return {
    floorId: floor.id,
    name: draft.name.trim(),
    hasCapacityLimit: draft.hasCapacityLimit,
    capacityLimit: draft.hasCapacityLimit ? draft.capacityLimit : DEFAULT_SALON_CAPACITY,
  };
}

export function SalonesTab({ floors, date, api, busy, setBusy, setError, pushToast }: SalonesTabProps) {
  const [salons, setSalons] = useState<ConfigSalon[]>([]);
  const [editor, setEditor] = useState<SalonEditorMode | null>(null);
  const [draft, setDraft] = useState<SalonDraft>(() => newSalonDraft(floors[0]?.floorNumber ?? 0));
  const [deleteTarget, setDeleteTarget] = useState<ConfigSalon | null>(null);

  const groups = useMemo(() => groupSalonsByFloor(floors, salons), [floors, salons]);

  // Fetch salons when the tab mounts.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const res = await api.config.listSalons(date);
      if (!cancelled && res.success && res.salons) setSalons(res.salons);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  const openCreate = () => {
    setDraft(newSalonDraft(floors[0]?.floorNumber ?? 0));
    setEditor({ kind: "create" });
  };

  const openEdit = (salon: ConfigSalon) => {
    setDraft(draftFromSalon(salon));
    setEditor({ kind: "edit", salon });
  };

  const floorForDraft = floors.find((f) => f.floorNumber === draft.floorNumber) ?? floors[0];

  const save = async () => {
    if (!floorForDraft || !editor) return;
    const input = { ...draftToInput(draft, floorForDraft), ...(date ? { date } : {}) };
    if (!input.name) {
      setError("El nombre del salón es obligatorio");
      return;
    }
    const isEdit = editor.kind === "edit";
    // Optimistic UI: reflect the change immediately, roll back on failure.
    const previous = salons;
    if (isEdit && editor.kind === "edit") {
      setSalons(applySalonPatch(salons, {
        ...editor.salon,
        ...input,
        floorId: input.floorId,
        floorNumber: floorForDraft.floorNumber,
        floorName: floorForDraft.name,
      }));
    }
    setBusy(true);
    setError(null);
    try {
      const res = isEdit && editor.kind === "edit"
        ? await api.config.updateSalon(editor.salon.id, input)
        : await api.config.createSalon(input);
      if (!res.success) {
        setSalons(previous);
        setError(readAPIMessage(res, "No se pudo guardar el salón"));
        return;
      }
      if (res.salons) setSalons(res.salons);
      setEditor(null);
      pushToast({ kind: "success", title: isEdit ? "Salón actualizado" : "Salón creado", message: input.name });
    } catch (e) {
      setSalons(previous);
      setError(e instanceof Error ? e.message : "No se pudo guardar el salón");
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const previous = salons;
    setSalons(applySalonPatch(salons, null, deleteTarget.id)); // optimistic
    setBusy(true);
    try {
      const res = await api.config.deleteSalon(deleteTarget.id);
      if (!res.success) {
        setSalons(previous);
        setError(readAPIMessage(res, "No se pudo eliminar el salón"));
        return;
      }
      pushToast({ kind: "success", title: "Salón eliminado", message: deleteTarget.name });
      setDeleteTarget(null);
    } catch (e) {
      setSalons(previous);
      setError(e instanceof Error ? e.message : "No se pudo eliminar el salón");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div id="config-salons-panel" role="tabpanel" aria-label="Salones" className="bo-configFloorsPanelContent" data-ui="config-salons-tabpanel">
      <div className="bo-configSalonsToolbar">
        <Button variant="primary" size="sm" onClick={openCreate} disabled={busy || floors.length === 0} data-ui="salon-add">
          <Plus className="bo-ico" aria-hidden /> Añadir salón
        </Button>
      </div>

      <div className="bo-configSalonCards" aria-label="Salones por planta" data-ui="config-salones-cards-container">
        {groups.map(({ floor, salons: floorSalons }) => (
          <div key={`salon-floor-${floor.floorNumber}`} className="bo-configSalonFloorCard" data-slot="salon-floor-card">
            <div className="bo-floorSalonCard" data-ui="salon-floor-card-info">
              <div data-ui="floor-card-info">
                <div className="bo-floorCardName" data-slot="configRestaurante-floorCardName">{floor.name}</div>
                <div className="bo-floorCardHint" data-slot="configRestaurante-floorCardHint">
                  {floor.active
                    ? `${floorSalons.length} ${floorSalons.length === 1 ? "salón" : "salones"} · Abierto por defecto`
                    : `${floorSalons.length} ${floorSalons.length === 1 ? "salón" : "salones"} · Cerrado por defecto`}
                </div>
              </div>
              <div className="bo-floorSalonCardState" data-ui="salon-floor-card-state">
                <span className="bo-floorSalonCardStatus" data-slot="configRestaurante-floorSalonCardStatus">{floor.active ? "Abierto" : "Cerrado"}</span>
              </div>
            </div>

            {floorSalons.length === 0 ? (
              <p className="bo-configSalonEmpty" data-slot="salon-empty">Sin salones en esta planta.</p>
            ) : (
              <ul className="bo-configSalonList" data-slot="salon-list">
                {floorSalons.map((salon) => (
                  <li key={salon.id} className="bo-configSalonRow" data-ui="salon-row" data-salon-id={salon.id}>
                    <div className="bo-configSalonInfo">
                      <span className="bo-configSalonName" data-slot="salon-name">{salon.name}</span>
                      <span className="bo-configSalonMeta" data-slot="salon-meta">
                        {salonCapacityText(salon)}
                        {!salon.isActive ? " · Inactivo" : ""}
                      </span>
                    </div>
                    <div className="bo-configSalonActions">
                      <button
                        type="button"
                        className="bo-iconButton"
                        onClick={() => openEdit(salon)}
                        disabled={busy}
                        aria-label={`Editar ${salon.name}`}
                        data-ui="salon-edit"
                      >
                        <Pencil className="bo-ico" aria-hidden />
                      </button>
                      <button
                        type="button"
                        className="bo-iconButton bo-iconButton--danger"
                        onClick={() => setDeleteTarget(salon)}
                        disabled={busy}
                        aria-label={`Eliminar ${salon.name}`}
                        data-ui="salon-delete"
                      >
                        <Trash2 className="bo-ico" aria-hidden />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>

      <Modal
        open={editor !== null}
        title={editor?.kind === "edit" ? "Editar salón" : "Añadir salón"}
        onClose={() => setEditor(null)}
        size="sm"
      >
        <div className="bo-form">
          <label className="bo-label" htmlFor="salon-floor">Planta</label>
          <Select
            value={String(draft.floorNumber)}
            onChange={(v) => setDraft((d) => ({ ...d, floorNumber: Number(v) }))}
            options={floors.map((f) => ({ value: String(f.floorNumber), label: f.name }))}
            ariaLabel="Planta del salón"
            disabled={busy}
          />

          <label className="bo-label" htmlFor="salon-name">Nombre del salón</label>
          <input
            id="salon-name"
            className="bo-input"
            type="text"
            value={draft.name}
            maxLength={120}
            placeholder="Ej. Terraza, Salón Privado…"
            disabled={busy}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
          />

          <div className="bo-configSalonToggle">
            <span className="bo-label">Capacidad limitada</span>
            <Switch
              checked={draft.hasCapacityLimit}
              disabled={busy}
              onCheckedChange={(checked) => setDraft((d) => ({ ...d, hasCapacityLimit: checked }))}
              aria-label="Limitar capacidad del salón"
            />
          </div>

          {draft.hasCapacityLimit && (
            <PlusMinusCounter
              label="Aforo máximo"
              value={draft.capacityLimit}
              onDecrease={() => setDraft((d) => ({ ...d, capacityLimit: Math.max(1, d.capacityLimit - 1) }))}
              onIncrease={() => setDraft((d) => ({ ...d, capacityLimit: Math.min(2000, d.capacityLimit + 1) }))}
              canDecrease={draft.capacityLimit > 1}
              canIncrease={draft.capacityLimit < 2000}
              disabled={busy}
              helperText="Personas"
              decrementAriaLabel="Reducir aforo"
              incrementAriaLabel="Aumentar aforo"
            />
          )}

          <div className="bo-modalActions">
            <Button variant="ghost" onClick={() => setEditor(null)} disabled={busy}>Cancelar</Button>
            <Button variant="primary" onClick={() => void save()} disabled={busy} data-ui="salon-save">
              {editor?.kind === "edit" ? "Guardar cambios" : "Guardar"}
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Eliminar salón"
        message={deleteTarget ? `¿Eliminar "${deleteTarget.name}"? Esta acción no se puede deshacer.` : ""}
        confirmText="Eliminar"
        cancelText="Cancelar"
        danger
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  );
}
