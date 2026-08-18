import React, { useEffect, useMemo, useState } from "react";

import type { ConfigFloor, ConfigSalon } from "../../../../../api/types";
import { Switch } from "../../../../../ui/shadcn/Switch";
import { readAPIMessage } from "../../../config/helpers/configHelpers";
import { groupSalonsByFloor, salonCapacityText } from "../../../config/helpers/salonsHelpers";
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
 * Same salones section as /app/config (floor container cards + salon rows),
 * but scoped to the selected date: it loads each salon's global default and
 * applies that date's overrides; edits (open/close) are saved for that date only.
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
    <div className="bo-configSalonCards" aria-label="Salones del día por planta" data-ui="salones-day-cards-container">
      {groups.map(({ floor, salons: floorSalons }) => (
        <div key={`salon-day-${floor.floorNumber}`} className="bo-configSalonFloorCard" data-slot="salon-floor-card">
          <div className="bo-floorSalonCard" data-ui="salon-floor-card-info">
            <div data-ui="floor-card-info">
              <div className="bo-floorCardName" data-slot="configRestaurante-floorCardName">{floor.name}</div>
              <div className="bo-floorCardHint" data-slot="configRestaurante-floorCardHint">
                {floorSalons.length === 0
                  ? "Sin salones en esta planta"
                  : `${floorSalons.length} ${floorSalons.length === 1 ? "salón" : "salones"}`}
              </div>
            </div>
            <div className="bo-floorSalonCardState" data-ui="salon-floor-card-state">
              <span className="bo-floorSalonCardStatus" data-slot="configRestaurante-floorSalonCardStatus">
                {floor.active ? "Abierto" : "Cerrado"}
              </span>
            </div>
          </div>

          {floorSalons.length > 0 && (
            <ul className="bo-configSalonList" data-slot="salon-list">
              {floorSalons.map((salon) => (
                <li key={salon.id} className="bo-configSalonRow" data-ui="salon-day-row" data-salon-id={salon.id}>
                  <div className="bo-configSalonInfo">
                    <span className="bo-configSalonName" data-slot="salon-name">{salon.name}</span>
                    <span className="bo-configSalonMeta" data-slot="salon-meta">{salonCapacityText(salon)}</span>
                  </div>
                  <div className="bo-floorSalonCardState" data-ui="salon-day-state">
                    <span data-ui="salon-day-state-label" className="bo-floorSalonCardStatus">{salonDayLabel(salon, salon.isActive)}</span>
                    <Switch
                      checked={salon.isActive}
                      disabled={busy}
                      onCheckedChange={(checked) => void toggle(salon, checked)}
                      aria-label={`Abrir o cerrar ${salon.name} el ${date}`}
                      data-ui="salon-day-switch"
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}
