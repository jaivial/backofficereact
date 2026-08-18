import React, { useEffect, useMemo, useState } from "react";

import type { ConfigFloor, ConfigSalon } from "../../../../../api/types";
import { Switch } from "../../../../../ui/shadcn/Switch";
import { readAPIMessage } from "../../../config/helpers/configHelpers";
import { groupSalonsByFloor } from "../../../config/helpers/salonsHelpers";
import { mergeSalonOverrides, salonDayLabel, type SalonDayOverrides } from "../helpers/salonDayHelpers";

interface SalonesDelDiaPanelProps {
  date: string;
  floors: ConfigFloor[];
  api: {
    config: {
      listSalons: (date?: string) => Promise<{ success: boolean; message?: string; salons?: ConfigSalon[] }>;
      setSalonDayStatus: (input: { date: string; salonId: number; active: boolean }) => Promise<{ success: boolean; message?: string; salons?: ConfigSalon[] }>;
    };
  };
  busy: boolean;
  setBusy: (v: boolean) => void;
  setError: (msg: string | null) => void;
  pushToast: (t: { kind: "success" | "error" | "info"; title: string; message?: string }) => void;
}

/**
 * Per-day salones status for the selected date. The backend returns each
 * salon's effective state (day override applied over the global default);
 * we keep the override map client-side so toggles are optimistic.
 */
export function SalonesDelDiaPanel({ date, floors, api, busy, setBusy, setError, pushToast }: SalonesDelDiaPanelProps) {
  const [salons, setSalons] = useState<ConfigSalon[]>([]);
  const [overrides, setOverrides] = useState<SalonDayOverrides>({});

  useEffect(() => {
    let cancelled = false;
    setOverrides({});
    void (async () => {
      const res = await api.config.listSalons(date);
      if (cancelled || !res.success || !res.salons) return;
      setSalons(res.salons);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  const effective = useMemo(() => mergeSalonOverrides(salons, overrides), [salons, overrides]);
  const groups = useMemo(() => groupSalonsByFloor(floors, effective), [floors, effective]);

  if (salons.length === 0 && groups.every((g) => g.salons.length === 0)) return null;

  const toggle = async (salon: ConfigSalon, next: boolean) => {
    const previous = overrides;
    setOverrides((prev) => ({ ...prev, [salon.id]: next })); // optimistic
    setBusy(true);
    setError(null);
    try {
      const res = await api.config.setSalonDayStatus({ date, salonId: salon.id, active: next });
      if (!res.success) {
        setOverrides(previous);
        setError(readAPIMessage(res, "No se pudo actualizar el salón para este día"));
        return;
      }
      pushToast({ kind: "success", title: next ? "Salón abierto" : "Salón cerrado", message: `${salon.name} · ${date}` });
    } catch (e) {
      setOverrides(previous);
      setError(e instanceof Error ? e.message : "No se pudo actualizar el salón para este día");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div data-ui="salones-day-panel" className="bo-salonesDayPanel">
      {groups
        .filter((g) => g.salons.length > 0)
        .map(({ floor, salons: floorSalons }) => (
          <div key={`salon-day-${floor.floorNumber}`} className="bo-salonesDayGroup" data-ui="salones-day-group">
            <div className="bo-salonesDayGroupTitle">{floor.name}</div>
            {floorSalons.map((salon) => (
              <div key={salon.id} data-ui="salon-day-row" className="bo-salonesDayRow">
                <div data-slot="salon-name" className="bo-salonesDayName">{salon.name}</div>
                <div data-slot="salon-state" className="bo-floorRowState">
                  <span data-ui="salon-day-state-label" className="bo-floorRowStateText">{salonDayLabel(salon, salon.isActive)}</span>
                  <Switch
                    checked={salon.isActive}
                    disabled={busy}
                    onCheckedChange={(checked) => void toggle(salon, checked)}
                    aria-label={`Abrir o cerrar ${salon.name} el ${date}`}
                    data-ui="salon-day-switch"
                  />
                </div>
              </div>
            ))}
          </div>
        ))}
    </div>
  );
}
