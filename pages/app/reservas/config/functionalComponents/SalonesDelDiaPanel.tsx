import React, { useMemo, useState } from "react";
import { Building2, LayoutGrid } from "lucide-react";

import type { ConfigFloor, ConfigSalon } from "../../../../../api/types";
import { Tabs, type TabItem } from "../../../../../ui/nav/Tabs";
import { Switch } from "../../../../../ui/shadcn/Switch";
import { readAPIMessage } from "../../../config/helpers/configHelpers";
import { groupSalonsByFloor, salonCapacityText } from "../../../config/helpers/salonsHelpers";
import { mergeSalonOverrides, salonDayLabel, type SalonDayOverrides } from "../helpers/salonDayHelpers";
import { SalonesTab } from "../../../config/functionalComponents/ConfigRestaurante/SalonesTab";

interface SalonesDelDiaPanelProps {
  date: string;
  floors: ConfigFloor[];
  api: Parameters<typeof SalonesTab>[0]["api"];
  busy: boolean;
  setBusy: (v: boolean) => void;
  setError: (msg: string | null) => void;
  pushToast: (t: { kind: "success" | "error" | "info"; title: string; message?: string }) => void;
}

type DayFloorTab = "plantas" | "salones";

/**
 * Same two-tab section (Plantas / Salones) as /app/config, scoped to the
 * selected date: salones created here belong to that date only; toggling a
 * salon's open/closed state saves a per-date override of the global default.
 */
export function SalonesDelDiaPanel({ date, floors, api, busy, setBusy, setError, pushToast }: SalonesDelDiaPanelProps) {
  const [tab, setTab] = useState<DayFloorTab>("salones");
  const [salons, setSalons] = useState<ConfigSalon[]>([]);
  const [overrides, setOverrides] = useState<SalonDayOverrides>({});

  const tabs = useMemo<TabItem[]>(
    () => [
      { id: "salones", label: "Salones", href: "#salones-del-dia", icon: <LayoutGrid className="bo-ico" /> },
      { id: "plantas", label: "Plantas", href: "#plantas-del-dia", icon: <Building2 className="bo-ico" /> },
    ],
    [],
  );

  const effective = useMemo(() => mergeSalonOverrides(salons, overrides), [salons, overrides]);
  const groups = useMemo(() => groupSalonsByFloor(floors, effective), [floors, effective]);

  const toggle = async (salon: ConfigSalon, next: boolean) => {
    const previous = overrides;
    setOverrides((prev) => ({ ...prev, [salon.id]: next })); // optimistic
    setBusy(true);
    setError(null);
    try {
      if (!api.config.setSalonDayStatus) return;
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
          api={{
            ...api,
            config: {
              ...api.config,
              listSalons: async (d?: string) => {
                const res = await api.config.listSalons(d ?? date);
                if (res.success && res.salons) setSalons(res.salons);
                return res;
              },
            },
          }}
          busy={busy}
          setBusy={setBusy}
          setError={setError}
          pushToast={pushToast}
        />
      ) : (
        <div className="bo-configSalonCards" aria-label="Estado de salones por planta" data-ui="salones-day-cards-container" data-testid="reservas-config-salones-day-cards">
          {groups.map(({ floor, salons: floorSalons }) => (
            <div key={`salon-day-${floor.floorNumber}`} className="bo-configSalonFloorCard" data-slot="salon-floor-card" data-testid={`reservas-config-salon-floor-card-${floor.floorNumber}`}>
              <div className="bo-floorSalonCard" data-ui="salon-floor-card-info" data-testid={`reservas-config-salon-floor-card-info-${floor.floorNumber}`}>
                <div data-ui="floor-card-info" data-testid={`reservas-config-salon-floor-info-${floor.floorNumber}`}>
                  <div className="bo-floorCardName" data-slot="configRestaurante-floorCardName" data-testid={`reservas-config-salon-floor-name-${floor.floorNumber}`}>{floor.name}</div>
                  <div className="bo-floorCardHint" data-slot="configRestaurante-floorCardHint" data-testid={`reservas-config-salon-floor-hint-${floor.floorNumber}`}>
                    {floorSalons.length === 0
                      ? "Sin salones en esta planta"
                      : `${floorSalons.length} ${floorSalons.length === 1 ? "salón" : "salones"}`}
                  </div>
                </div>
                <div className="bo-floorSalonCardState" data-ui="salon-floor-card-state" data-testid={`reservas-config-salon-floor-state-${floor.floorNumber}`}>
                  <span className="bo-floorSalonCardStatus" data-slot="configRestaurante-floorSalonCardStatus" data-testid={`reservas-config-salon-floor-status-${floor.floorNumber}`}>
                    {floor.active ? "Abierto" : "Cerrado"}
                  </span>
                </div>
              </div>

              {floorSalons.map((salon) => (
                <div key={salon.id} data-ui="salon-day-row" className="bo-salonesDayRow" data-salon-id={salon.id} data-testid={`reservas-config-salon-day-row-${salon.id}`}>
                  <div className="bo-configSalonInfo" data-testid={`reservas-config-salon-day-info-${salon.id}`}>
                    <span className="bo-configSalonName" data-slot="salon-name" data-testid={`reservas-config-salon-day-name-${salon.id}`}>{salon.name}</span>
                    <span className="bo-configSalonMeta" data-slot="salon-meta" data-testid={`reservas-config-salon-day-meta-${salon.id}`}>{salonCapacityText(salon)}</span>
                  </div>
                  <div className="bo-floorSalonCardState" data-ui="salon-day-state" data-testid={`reservas-config-salon-day-state-${salon.id}`}>
                    <span data-ui="salon-day-state-label" className="bo-floorSalonCardStatus" data-testid={`reservas-config-salon-day-state-label-${salon.id}`}>{salonDayLabel(salon, salon.isActive)}</span>
                    <Switch
                      checked={salon.isActive}
                      disabled={busy}
                      onCheckedChange={(checked) => void toggle(salon, checked)}
                      aria-label={`Abrir o cerrar ${salon.name} el ${date}`}
                      data-ui="salon-day-switch"
                      data-testid={`reservas-config-salon-day-switch-${salon.id}`}
                    />
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
