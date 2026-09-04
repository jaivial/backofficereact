import React, { useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";

import type { ConfigFloor, ConfigSalon } from "../../../../../api/types";
import { ConfirmDialog } from "../../../../../ui/overlays/ConfirmDialog";
import { Modal } from "../../../../../ui/overlays/Modal";
import { Select } from "../../../../../ui/inputs/Select";
import { Switch } from "../../../../../ui/shadcn/Switch";
import { PlusMinusCounter } from "../../../../../ui/widgets/PlusMinusCounter";
import { SalonFloorAccordion } from "../../../../../ui/widgets/SalonFloorAccordion/SalonFloorAccordion";
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
      createSalon: (input: { floorId: number; name: string; hasCapacityLimit: boolean; capacityLimit: number; isActive?: boolean; date?: string }) => Promise<{ success: boolean; message?: string; salons?: ConfigSalon[]; aforoCapped?: boolean; remainingAforo?: number }>;
      updateSalon: (salonId: number, input: { floorId: number; name: string; hasCapacityLimit: boolean; capacityLimit: number; isActive?: boolean; date?: string }) => Promise<{ success: boolean; message?: string; salons?: ConfigSalon[]; aforoCapped?: boolean; remainingAforo?: number }>;
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
  /** True when the selected floor has a max aforo: every salon must then carry a
   *  capacity limit so their sum can be checked against the floor cap. */
  const floorCapped = (floorForDraft?.maxAforo ?? 0) > 0;
  const effectiveHasLimit = draft.hasCapacityLimit || floorCapped;

  const save = async () => {
    if (!floorForDraft || !editor) return;
    const input = {
      ...draftToInput(draft, floorForDraft),
      hasCapacityLimit: effectiveHasLimit,
      capacityLimit: effectiveHasLimit ? Math.max(1, draft.capacityLimit) : DEFAULT_SALON_CAPACITY,
      ...(date ? { date } : {}),
    };
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
        if (res.aforoCapped) {
          setError(
            `${readAPIMessage(res, "El aforo del salón excede el aforo restante de la planta")}${
              typeof res.remainingAforo === "number" ? ` (restante en la planta: ${res.remainingAforo})` : ""
            }`,
          );
        } else {
          setError(readAPIMessage(res, "No se pudo guardar el salón"));
        }
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

  const toggleSalon = async (salon: ConfigSalon, next: boolean) => {
    const previous = salons;
    setSalons(applySalonPatch(salons, { ...salon, isActive: next })); // optimistic
    setBusy(true);
    setError(null);
    try {
      if (date && api.config.setSalonDayStatus) {
        const res = await api.config.setSalonDayStatus({ date, salonId: salon.id, active: next });
        if (!res.success) {
          setSalons(previous);
          setError(readAPIMessage(res, "No se pudo actualizar el salón"));
          return;
        }
        if (res.salons) setSalons(res.salons);
      } else {
        const res = await api.config.updateSalon(salon.id, {
          floorId: salon.floorId,
          name: salon.name,
          hasCapacityLimit: salon.hasCapacityLimit,
          capacityLimit: salon.capacityLimit,
          isActive: next,
        });
        if (!res.success) {
          setSalons(previous);
          setError(readAPIMessage(res, "No se pudo actualizar el salón"));
          return;
        }
        if (res.salons) setSalons(res.salons);
      }
      pushToast({ kind: "success", title: next ? "Salón abierto" : "Salón cerrado", message: salon.name });
    } catch (e) {
      setSalons(previous);
      setError(e instanceof Error ? e.message : "No se pudo actualizar el salón");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div id="config-salons-panel" role="tabpanel" aria-label="Salones" className="bo-configFloorsPanelContent" data-ui="config-salons-tabpanel">
      <div data-slot="salonesTab-configSalonsToolbar" className="bo-configSalonsToolbar">
        <Button variant="primary" size="sm" onClick={openCreate} disabled={busy || floors.length === 0} data-ui="salon-add">
          <Plus className="bo-ico" aria-hidden /> Añadir salón
        </Button>
      </div>

      <div className="bo-configSalonCards" aria-label="Salones por planta" data-ui="config-salones-cards-container">
        {groups.map(({ floor, salons: floorSalons }) => (
          <SalonFloorAccordion
            key={`salon-floor-${floor.floorNumber}`}
            floor={floor}
            salons={floorSalons}
            variant="manage"
            busy={busy}
            onSalonToggle={(salon, next) => void toggleSalon(salon, next)}
            onEdit={openEdit}
            onDelete={setDeleteTarget}
            testIdPrefix={date ? "reservas-config-salones" : "config-salones"}
          />
        ))}
      </div>

      <Modal
        open={editor !== null}
        title={editor?.kind === "edit" ? "Editar salón" : "Añadir salón"}
        onClose={() => setEditor(null)}
        size="sm"
      >
        <div data-slot="salonesTab-form" className="bo-form">
          <label data-slot="salonesTab-label" className="bo-label" htmlFor="salon-floor">Planta</label>
          <Select
            value={String(draft.floorNumber)}
            onChange={(v) => setDraft((d) => ({ ...d, floorNumber: Number(v) }))}
            options={floors.map((f) => ({ value: String(f.floorNumber), label: f.name }))}
            ariaLabel="Planta del salón"
            disabled={busy}
          />

          <label data-slot="salonesTab-label" className="bo-label" htmlFor="salon-name">Nombre del salón</label>
          <input
            id="salon-name"
            className="bo-input"
            type="text"
            value={draft.name}
            maxLength={120}
            data-testid="salones-tab-salon-name-input"
            placeholder="Ej. Terraza, Salón Privado…"
            disabled={busy}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
          />

          <div data-slot="salonesTab-configSalonToggle" className="bo-configSalonToggle">
            <span data-slot="salonesTab-label" className="bo-label">Capacidad limitada</span>
            <Switch
              checked={effectiveHasLimit}
              disabled={busy || floorCapped}
              onCheckedChange={(checked) => setDraft((d) => ({ ...d, hasCapacityLimit: checked }))}
              aria-label="Limitar capacidad del salón"
            />
          </div>

          {floorCapped && (
            <p data-slot="salonesTab-mutedText" className="bo-mutedText" style={{ marginBottom: 8, fontSize: 12 }}>
              Esta planta tiene un aforo máximo ({floorForDraft?.maxAforo} personas), por lo que el salón debe tener límite de aforo.
            </p>
          )}

          {effectiveHasLimit && (
            <PlusMinusCounter
              label="Aforo máximo"
              className="bo-salonAforoCounter"
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

          <div data-slot="salonesTab-modalActions" className="bo-modalActions">
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
