import React, { useEffect, useMemo, useState } from "react";
import { Building2, LayoutGrid } from "lucide-react";

import type { ConfigFloor, ConfigSalon } from "../../../../../api/types";
import { Tabs, type TabItem } from "../../../../../ui/nav/Tabs";
import { PlusMinusCounter } from "../../../../../ui/widgets/PlusMinusCounter";
import { SalonFloorAccordion } from "../../../../../ui/widgets/SalonFloorAccordion/SalonFloorAccordion";
import { groupSalonsByFloor } from "../../../config/helpers/salonsHelpers";
import { readAPIMessage } from "../../../config/helpers/configHelpers";
import { SalonesTab } from "../../../config/functionalComponents/ConfigRestaurante/SalonesTab";

interface SalonesDelDiaPanelProps {
  date: string;
  floors: ConfigFloor[];
  /** Replace the parent floors state after a per-date floor change. */
  onFloorsChanged?: (floors: ConfigFloor[]) => void;
  api: Parameters<typeof SalonesTab>[0]["api"] & {
    config: {
      setFloor: (
        date: string,
        floorNumber: number,
        active: boolean,
      ) => Promise<{ success: boolean; message?: string; floors?: ConfigFloor[] }>;
    };
  };
  busy: boolean;
  setBusy: (v: boolean) => void;
  setError: (msg: string | null) => void;
  pushToast: (t: { kind: "success" | "error" | "info"; title: string; message?: string }) => void;
}

type DayFloorTab = "plantas" | "salones";

/**
 * Two-tab section (Plantas / Salones) scoped to the selected date.
 *
 * Tab Plantas: per-date floor counter (activate/deactivate the highest floor
 * for this date only) + floor accordions with the activation switch and the
 * salones listed read-only below.
 * Tab Salones: shared SalonesTab with per-salón day toggles, edit and delete.
 */
export function SalonesDelDiaPanel({ date, floors, onFloorsChanged, api, busy, setBusy, setError, pushToast }: SalonesDelDiaPanelProps) {
  const [tab, setTab] = useState<DayFloorTab>("salones");
  const [salons, setSalons] = useState<ConfigSalon[]>([]);

  const tabs = useMemo<TabItem[]>(
    () => [
      { id: "salones", label: "Salones", href: "#salones-del-dia", icon: <LayoutGrid className="bo-ico" /> },
      { id: "plantas", label: "Plantas", href: "#plantas-del-dia", icon: <Building2 className="bo-ico" /> },
    ],
    [],
  );

  const groups = useMemo(() => groupSalonsByFloor(floors, salons), [floors, salons]);

  const refreshSalons = async () => {
    try {
      const res = await api.config.listSalons(date);
      if (res.success && res.salons) setSalons(res.salons);
    } catch {
      // keep previous state; non-critical
    }
  };

  // Salones (with per-date overrides already merged server-side).
  useEffect(() => {
    void refreshSalons();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  const setFloorActiveForDate = async (floor: ConfigFloor, active: boolean) => {
    setBusy(true);
    setError(null);
    try {
      const res = await api.config.setFloor(date, floor.floorNumber, active);
      if (!res.success) {
        setError(readAPIMessage(res, "No se pudo actualizar la planta para este día"));
        return;
      }
      if (res.floors) onFloorsChanged?.(res.floors);
      // Floor activation may cascade to its salones on this date.
      void refreshSalons();
      pushToast({
        kind: "success",
        title: active ? "Planta activada" : "Planta desactivada",
        message: `${floor.name} · ${date} (solo este día)`,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo actualizar la planta para este día");
    } finally {
      setBusy(false);
    }
  };

  // Per-date floor counter: activating/deactivating floors only for this date.
  const activeFloors = useMemo(() => floors.filter((f) => f.active), [floors]);
  const canDecreaseFloors = activeFloors.length > 1;
  const canIncreaseFloors = activeFloors.length < floors.length;

  const decreaseFloors = () => {
    const target = [...activeFloors].sort((a, b) => b.floorNumber - a.floorNumber)[0];
    if (target) void setFloorActiveForDate(target, false);
  };

  const increaseFloors = () => {
    const target = [...floors]
      .filter((f) => !f.active)
      .sort((a, b) => a.floorNumber - b.floorNumber)[0];
    if (target) void setFloorActiveForDate(target, true);
  };

  return (
    <div data-ui="salones-day-panel" className="bo-salonesDayPanel" data-testid="reservas-config-salones-day-panel">
      <Tabs
        tabs={tabs}
        activeId={tab}
        ariaLabel="Plantas y salones del día"
        data-testid="reservas-config-salones-day-tabs"
        className="bo-tabs--reservas bo-configFloorTabs mx-auto"
        onNavigate={(_href, id) => setTab(id as DayFloorTab)}
      />
      {tab === "salones" ? (
        <SalonesTab
          date={date}
          floors={floors}
          api={api}
          busy={busy}
          setBusy={setBusy}
          setError={setError}
          pushToast={pushToast}
        />
      ) : (
        <div className="bo-configSalonsPanelContent" data-testid="reservas-config-plantas-tab">
          <PlusMinusCounter
            label="Plantas activas del día"
            value={String(activeFloors.length)}
            className="bo-configLimitCounterCard bo-configFloorCounter bo-plantasDiaCounter"
            onDecrease={decreaseFloors}
            onIncrease={increaseFloors}
            canDecrease={canDecreaseFloors}
            canIncrease={canIncreaseFloors}
            disabled={busy}
            helperText="Cambia solo para esta fecha"
            decrementAriaLabel="Quitar planta para este día"
            incrementAriaLabel="Añadir planta para este día"
          />

          <div className="bo-configSalonCards" aria-label="Plantas del día" data-testid="reservas-config-plantas-cards">
            {groups.map(({ floor, salons: floorSalons }) => (
              <SalonFloorAccordion
                key={`salon-day-${floor.floorNumber}`}
                floor={floor}
                salons={floorSalons}
                variant="status"
                busy={busy}
                onFloorToggle={(next) => void setFloorActiveForDate(floor, next)}
                testIdPrefix="reservas-config-salon"
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
