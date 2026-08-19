import React, { useCallback, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { usePageContext } from "vike-react/usePageContext";
import { Building2, LayoutGrid } from "lucide-react";

import type { ConfigDefaults, ConfigFloor, OpeningMode, WeekdayOpen } from "../../../../../api/types";
import type { FloorTab, HourSlot } from "../../../config/helpers/configHelpers";
import { buildHalfHourSlots, buildFloorsWithCount, clampDailyLimit, formatTableLimit, normalizeTableLimit, normalizeWeekdayOpenMap, readAPIMessage, stepTableLimit, tableLimitValues, toggleHour } from "../../../config/helpers/configHelpers";
import { openingModeOptions, weekdayCards, type WeekdayCard } from "../../../config/constants/config.constants";
import type { RestauranteContentProps, FloorCard } from "./types/ConfigRestaurante.types";
import { Select } from "../../../../../ui/inputs/Select";
import { Switch } from "../../../../../ui/shadcn/Switch";
import { PlusMinusCounter } from "../../../../../ui/widgets/PlusMinusCounter";
import { Tabs, type TabItem } from "../../../../../ui/nav/Tabs";
import { Panel } from "../../../../../ui/shell/Panel";
import { HourSplitConfig as HourSplitConfigWidget } from "../../../../../ui/widgets/HourSplitConfig/HourSplitConfig";
import { LocationBookingToggles } from "../../../../../ui/widgets/LocationBookingToggles/LocationBookingToggles";
import { equalSplit, normalizePercentages, type Percentages } from "../../../../../ui/widgets/HourSplitConfig/lib/rebalance";
import { SalonesTab } from "./SalonesTab";

export function ConfigRestauranteContent({ defaults, floors, busy, setBusy, setError, api, pushToast, onFloorsChanged, onDefaultsChanged }: RestauranteContentProps) {
  const morningSlots = useMemo(() => buildHalfHourSlots(8 * 60, 17 * 60, "m"), []);
  const nightSlots = useMemo(() => buildHalfHourSlots(17 * 60 + 30, 1 * 60, "n"), []);
  const pageContext = usePageContext();
  const floorTabFromQuery = pageContext.urlParsed.search.floortab;
  const [floorTab, setFloorTab] = useState<FloorTab>(floorTabFromQuery === "salones" ? "salones" : "plantas");

  const floorTabs = useMemo<TabItem[]>(
    () => [
      { id: "plantas", label: "Plantas", href: "#plantas", icon: <Building2 className="bo-ico" /> },
      { id: "salones", label: "Salones", href: "#salones", icon: <LayoutGrid className="bo-ico" /> },
    ],
    [],
  );

  const saveDefaults = useCallback(
    async (
      patch: Partial<{
        openingMode: OpeningMode;
        morningHours: string[];
        nightHours: string[];
        dailyLimit: number;
        mesasDeDosLimit: string;
        mesasDeTresLimit: string;
        weekdayOpen: WeekdayOpen;
        hourSplitEnabled: boolean;
        defaultHourPercentages: Record<string, number>;
        allowFloorReservation: boolean;
        allowSalonReservation: boolean;
      }>,
      successMessage?: string,
    ) => {
      const rollbackPatch = (): Partial<ConfigDefaults> => {
        const source = defaults as unknown as Record<string, unknown>;
        const out: Record<string, unknown> = {};
        for (const key of Object.keys(patch as Record<string, unknown>)) {
          out[key] = source[key];
        }
        return out as Partial<ConfigDefaults>;
      };
      setBusy(true);
      setError(null);
      onDefaultsChanged?.(patch);
      try {
        const res = await api.config.setDefaults(patch);
        if (!res.success) {
          onDefaultsChanged?.(rollbackPatch());
          setError(readAPIMessage(res, "No se pudo guardar"));
          return;
        }
        if (successMessage) {
          pushToast({ kind: "success", title: "Actualizado", message: successMessage });
        }
      } catch (e) {
        onDefaultsChanged?.(rollbackPatch());
        setError(e instanceof Error ? e.message : "No se pudo guardar");
      } finally {
        setBusy(false);
      }
    },
    [api.config, setBusy, setError, pushToast, defaults, onDefaultsChanged],
  );

  const saveFloorsCount = useCallback(
    async (count: number) => {
      const previousFloors = floors;
      const nextFloors = buildFloorsWithCount(floors, count);
      setBusy(true);
      setError(null);
      onFloorsChanged?.(nextFloors);
      try {
        const res = await api.config.setDefaultFloors({ count });
        if (!res.success) {
          onFloorsChanged?.(previousFloors);
          setError(readAPIMessage(res, "No se pudo actualizar plantas"));
          return;
        }
        if (res.floors) onFloorsChanged?.(res.floors);
      } catch (e) {
        onFloorsChanged?.(previousFloors);
        setError(e instanceof Error ? e.message : "No se pudo actualizar plantas");
      } finally {
        setBusy(false);
      }
    },
    [api.config, setBusy, setError, floors, onFloorsChanged],
  );

  const toggleFloorDefault = useCallback(
    async (floor: ConfigFloor, explicitValue?: boolean) => {
      const nextActive = typeof explicitValue === "boolean" ? explicitValue : !floor.active;
      const previousFloors = floors;
      const nextFloors = floors.map((f) => (f.floorNumber === floor.floorNumber ? { ...f, active: nextActive } : f));
      setBusy(true);
      setError(null);
      onFloorsChanged?.(nextFloors);
      try {
        const res = await api.config.setDefaultFloors({ floorNumber: floor.floorNumber, active: nextActive });
        if (!res.success) {
          onFloorsChanged?.(previousFloors);
          setError(readAPIMessage(res, "No se pudo actualizar la planta"));
          return;
        }
        if (res.floors) onFloorsChanged?.(res.floors);
      } catch (e) {
        onFloorsChanged?.(previousFloors);
        setError(e instanceof Error ? e.message : "No se pudo actualizar la planta");
      } finally {
        setBusy(false);
      }
    },
    [api.config, setBusy, setError, floors, onFloorsChanged],
  );

  const weekdayOpen = useMemo(() => normalizeWeekdayOpenMap(defaults.weekdayOpen), [defaults.weekdayOpen]);
  const floorCount = useMemo(() => floors.length || 1, [floors.length]);
  const canGrow = useMemo(() => floorCount < 8, [floorCount]);
  const canShrink = useMemo(() => floorCount > 1, [floorCount]);
  const mesasDeDosValue = useMemo(() => normalizeTableLimit(defaults.mesasDeDosLimit), [defaults.mesasDeDosLimit]);
  const mesasDeTresValue = useMemo(() => normalizeTableLimit(defaults.mesasDeTresLimit), [defaults.mesasDeTresLimit]);

  // By-hour client split defaults: synthesize an equal split when no template is stored.
  const defaultActiveHours = useMemo(() => defaults.hours || [], [defaults.hours]);
  const defaultPercentages = useMemo<Percentages>(() => {
    const stored = normalizePercentages(defaults.defaultHourPercentages, defaultActiveHours);
    const hasStored = defaults.defaultHourPercentages && Object.keys(defaults.defaultHourPercentages).length > 0;
    return hasStored && defaultActiveHours.every((h) => (defaults.defaultHourPercentages?.[h] ?? 0) > 0)
      ? stored
      : equalSplit(defaultActiveHours);
  }, [defaults.defaultHourPercentages, defaultActiveHours]);

  const toggleHourSplitDefault = useCallback(
    (enabled: boolean) => {
      void saveDefaults({ hourSplitEnabled: enabled }, enabled ? "Reparto por hora activado" : "Reparto por hora desactivado");
    },
    [saveDefaults],
  );

  const toggleLocationBookingDefault = useCallback(
    (patch: { allowFloorReservation?: boolean; allowSalonReservation?: boolean }) => {
      const labels = {
        allowFloorReservation: "Reserva de planta",
        allowSalonReservation: "Reserva de salón",
      } as const;
      const [key, value] = Object.entries(patch)[0] as [keyof typeof labels, boolean];
      void saveDefaults(patch, `${labels[key]} ${value ? "activada" : "desactivada"}`);
    },
    [saveDefaults],
  );

  const commitDefaultPercentages = useCallback(
    async (percentages: Percentages): Promise<boolean> => {
      try {
        const res = await api.config.setDefaults({ defaultHourPercentages: percentages });
        if (!res.success) {
          setError(readAPIMessage(res, "No se pudo guardar el reparto"));
          return false;
        }
        return true;
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo guardar el reparto");
        return false;
      }
    },
    [api.config, setError],
  );

  const morningHourCards = useMemo(() => {
    const active = new Set(defaults.morningHours || []);
    return morningSlots.map((slot) => ({ ...slot, active: active.has(slot.value) }));
  }, [defaults.morningHours, morningSlots]);

  const nightHourCards = useMemo(() => {
    const active = new Set(defaults.nightHours || []);
    return nightSlots.map((slot) => ({ ...slot, active: active.has(slot.value) }));
  }, [defaults.nightHours, nightSlots]);

  const weekdayCardsWithState = useMemo(
    (): Array<WeekdayCard & { isOpen: boolean }> =>
      weekdayCards.map((weekday) => ({ ...weekday, isOpen: Boolean(weekdayOpen[weekday.key]) })),
    [weekdayOpen],
  );

  const floorCards = useMemo<FloorCard[]>(
    () =>
      floors.map((floor) => ({
        floor,
        plantaLabel: floor.name,
        salonLabel: floor.isGround ? "Salón principal" : `Salón ${floor.floorNumber}`,
        statusLabel: floor.active ? "Abierto" : "Cerrado",
        defaultLabel: `${floor.active ? "Abierto por defecto" : "Cerrado por defecto"}`,
        keyPrefix: `${floor.id}`,
      })),
    [floors],
  );

  const handleMorningHour = useCallback(
    (hour: string) => {
      void saveDefaults({ morningHours: toggleHour(defaults.morningHours || [], hour) });
    },
    [saveDefaults, defaults.morningHours],
  );

  const handleNightHour = useCallback(
    (hour: string) => {
      void saveDefaults({ nightHours: toggleHour(defaults.nightHours || [], hour) });
    },
    [saveDefaults, defaults.nightHours],
  );

  const toggleWeekdayOpen = useCallback(
    (weekdayKey: keyof WeekdayOpen) => {
      void saveDefaults({
        weekdayOpen: { ...weekdayOpen, [weekdayKey]: !weekdayOpen[weekdayKey] },
      });
    },
    [saveDefaults, weekdayOpen],
  );

  const handleFloorsDecrease = useCallback(() => {
    if (!canShrink) return;
    void saveFloorsCount(floorCount - 1);
  }, [canShrink, floorCount, saveFloorsCount]);

  const handleFloorsIncrease = useCallback(() => {
    if (!canGrow) return;
    void saveFloorsCount(floorCount + 1);
  }, [canGrow, floorCount, saveFloorsCount]);

  const dailyLimit = useMemo(() => defaults.dailyLimit ?? 0, [defaults.dailyLimit]);
  const openingModeLabel = useMemo(
    () =>
      defaults.openingMode === "both" ? "Mañana + noche" : defaults.openingMode === "morning" ? "Mañana" : "Noche",
    [defaults.openingMode],
  );

  const canDailyDecrease = useMemo(() => dailyLimit > 0, [dailyLimit]);
  const canDailyIncrease = useMemo(() => dailyLimit < 500, [dailyLimit]);
  const dailyLimitLabel = useMemo(() => String(dailyLimit), [dailyLimit]);

  const handleDailyDecrease = useCallback(() => {
    const next = clampDailyLimit(dailyLimit - 1);
    if (next === dailyLimit) return;
    void saveDefaults({ dailyLimit: next });
  }, [dailyLimit, saveDefaults]);

  const handleDailyIncrease = useCallback(() => {
    const next = clampDailyLimit(dailyLimit + 1);
    if (next === dailyLimit) return;
    void saveDefaults({ dailyLimit: next });
  }, [dailyLimit, saveDefaults]);

  const mesasDeDosLabel = useMemo(() => formatTableLimit(mesasDeDosValue), [mesasDeDosValue]);
  const mesasDeTresLabel = useMemo(() => formatTableLimit(mesasDeTresValue), [mesasDeTresValue]);
  const canMesasDeDosDecrease = useMemo(() => mesasDeDosValue !== "0", [mesasDeDosValue]);
  const canMesasDeDosIncrease = useMemo(() => mesasDeDosValue !== "999", [mesasDeDosValue]);
  const canMesasDeTresDecrease = useMemo(() => mesasDeTresValue !== "0", [mesasDeTresValue]);
  const canMesasDeTresIncrease = useMemo(() => mesasDeTresValue !== "999", [mesasDeTresValue]);

  const handleMesasDeDosDecrease = useCallback(() => {
    const next = stepTableLimit(mesasDeDosValue, -1);
    if (next === mesasDeDosValue) return;
    void saveDefaults({ mesasDeDosLimit: next });
  }, [mesasDeDosValue, saveDefaults]);

  const handleMesasDeDosIncrease = useCallback(() => {
    const next = stepTableLimit(mesasDeDosValue, 1);
    if (next === mesasDeDosValue) return;
    void saveDefaults({ mesasDeDosLimit: next });
  }, [mesasDeDosValue, saveDefaults]);

  const handleMesasDeTresDecrease = useCallback(() => {
    const next = stepTableLimit(mesasDeTresValue, -1);
    if (next === mesasDeTresValue) return;
    void saveDefaults({ mesasDeTresLimit: next });
  }, [mesasDeTresValue, saveDefaults]);

  const handleMesasDeTresIncrease = useCallback(() => {
    const next = stepTableLimit(mesasDeTresValue, 1);
    if (next === mesasDeTresValue) return;
    void saveDefaults({ mesasDeTresLimit: next });
  }, [mesasDeTresValue, saveDefaults]);

  const onNavigateFloorTab = useCallback(
    (_href: string, id: string, event: React.MouseEvent<HTMLAnchorElement>) => {
      void _href;
      event.preventDefault();
      setFloorTab(id === "salones" ? "salones" : "plantas");
    },
    [],
  );

  return (
    <>
      <Panel title="Modo de apertura" meta={openingModeLabel} bodyClassName="bo-row" data-ui="config-restaurante-opening-panel">
        <Select
          value={defaults.openingMode}
          onChange={(mode) => void saveDefaults({ openingMode: (mode as OpeningMode) || "both" })}
          options={openingModeOptions as any}
          size="sm"
          ariaLabel="Modo de apertura por defecto"
        />
      </Panel>

      <Panel title="Horarios por defecto" meta="Slots de media hora con guardado inmediato" bodyClassName="bo-hourCardsContainer" data-ui="config-restaurante-hours-panel">
          <div className="bo-field" data-ui="config-restaurante-morning-field">
            <div className="bo-label" data-slot="configRestaurante-label">Mañana (08:00 - 17:00)</div>
            <div className="bo-hourCards bo-hourCards--slots" data-ui="config-restaurante-morning-slots">
              {morningHourCards.map((slot) => (
                <button
                  key={slot.id}
                  type="button"
                  className={`bo-hourCard bo-hourCard--slot${slot.active ? " is-on" : ""}`}
                  onClick={() => void handleMorningHour(slot.value)}
                  disabled={busy}
                  data-slot="morning-hour-button"
                  aria-label={`Hora ${slot.label}`}
                >
                  {slot.label}
                </button>
              ))}
            </div>
          </div>

          <div className="bo-field" data-ui="config-restaurante-night-field">
            <div className="bo-label" data-slot="configRestaurante-label">Noche (17:30 - 01:00)</div>
            <div className="bo-hourCards bo-hourCards--slots" data-ui="config-restaurante-night-slots">
              {nightHourCards.map((slot) => (
                <button
                  key={slot.id}
                  type="button"
                  className={`bo-hourCard bo-hourCard--slot${slot.active ? " is-on" : ""}`}
                  onClick={() => void handleNightHour(slot.value)}
                  disabled={busy}
                  data-slot="night-hour-button"
                  aria-label={`Hora ${slot.label}`}
                >
                  {slot.label}
                </button>
              ))}
            </div>
          </div>
      </Panel>

      <HourSplitConfigWidget
        enabled={defaults.hourSplitEnabled ?? true}
        dailyLimit={defaults.dailyLimit ?? 45}
        activeHours={defaultActiveHours}
        percentages={defaultPercentages}
        variant="default"
        busy={busy}
        onToggleEnabled={toggleHourSplitDefault}
        onCommitPercentages={commitDefaultPercentages}
        pushToast={pushToast}
      />

      <Panel title="Calendario semanal" meta="Semana genérica (lunes a domingo)" bodyClassName="bo-configWeekdayGrid" data-ui="config-restaurante-weekday-panel">
          {weekdayCardsWithState.map((weekday: WeekdayCard & { isOpen: boolean }) => (
            <button
              key={weekday.key}
              type="button"
              className={`bo-hourCard bo-configDayCard${weekday.isOpen ? " is-on" : ""}`}
              disabled={busy}
              aria-pressed={weekday.isOpen}
              aria-label={`${weekday.label} (${weekday.isOpen ? "abierto" : "cerrado"})`}
              onClick={() => void toggleWeekdayOpen(weekday.key)}
              data-slot="weekday-button"
            >
              <div className="bo-configDayCardLabel" data-slot="configRestaurante-configDayCardLabel">
                <span className="bo-configDayCardLabelFull" data-slot="configRestaurante-configDayCardLabelFull">{weekday.label}</span>
                <span className="bo-configDayCardLabelShort" aria-hidden="true" data-slot="configRestaurante-configDayCardLabelShort">
                  {weekday.shortLabel}
                </span>
              </div>
            </button>
          ))}
      </Panel>

      <Panel title="Límites por defecto" meta="Autosave inmediato" bodyClassName="bo-configLimitGrid" data-ui="config-restaurante-limits-panel">
          <PlusMinusCounter
            label="Límite diario"
            value={dailyLimitLabel}
            className="bo-configLimitCounterCard"
            onDecrease={handleDailyDecrease}
            onIncrease={handleDailyIncrease}
            canDecrease={canDailyDecrease}
            canIncrease={canDailyIncrease}
            disabled={busy}
            helperText="Rango permitido: 0-500"
            decrementAriaLabel="Reducir límite diario"
            incrementAriaLabel="Aumentar límite diario"
          />

          <PlusMinusCounter
            label="Mesas de 2"
            value={mesasDeDosLabel}
            className="bo-configLimitCounterCard"
            onDecrease={handleMesasDeDosDecrease}
            onIncrease={handleMesasDeDosIncrease}
            canDecrease={canMesasDeDosDecrease}
            canIncrease={canMesasDeDosIncrease}
            disabled={busy}
            helperText="0-99 o Sin límite"
            decrementAriaLabel="Reducir mesas de 2"
            incrementAriaLabel="Aumentar mesas de 2"
          />

          <PlusMinusCounter
            label="Mesas de 3"
            value={mesasDeTresLabel}
            className="bo-configLimitCounterCard"
            onDecrease={handleMesasDeTresDecrease}
            onIncrease={handleMesasDeTresIncrease}
            canDecrease={canMesasDeTresDecrease}
            canIncrease={canMesasDeTresIncrease}
            disabled={busy}
            helperText="0-99 o Sin límite"
            decrementAriaLabel="Reducir mesas de 3"
            incrementAriaLabel="Aumentar mesas de 3"
          />
      </Panel>

      <Panel title="Plantas del restaurante" meta={`${floorCount} plantas`} bodyClassName="bo-configFloorsPanel" data-ui="config-restaurante-floors-panel">
          <Tabs
            tabs={floorTabs}
            activeId={floorTab}
            ariaLabel="Secciones de plantas"
            className="bo-tabs--reservas bo-configFloorTabs mx-auto"
            onNavigate={onNavigateFloorTab}
            layoutId="boFloorTabIndicator"
          />

          <AnimatePresence mode="wait">
            <motion.div
              key={floorTab}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              data-slot="floor-tab-content"
            >
              {floorTab === "plantas" ? (
                <div id="config-floors-panel" role="tabpanel" aria-label="Plantas" className="bo-configFloorsPanelContent" data-ui="config-floors-tabpanel">
                  <LocationBookingToggles
                    variant="default"
                    allowFloorReservation={defaults.allowFloorReservation ?? false}
                    allowSalonReservation={defaults.allowSalonReservation ?? false}
                    busy={busy}
                    onSetGlobal={toggleLocationBookingDefault}
                  />

                  <PlusMinusCounter
                    label="Total de plantas"
                    value={String(floorCount)}
                    className="bo-configLimitCounterCard bo-configFloorCounter"
                    onDecrease={handleFloorsDecrease}
                    onIncrease={handleFloorsIncrease}
                    canDecrease={canShrink}
                    canIncrease={canGrow}
                    disabled={busy}
                    helperText="Planta baja incluida"
                    decrementAriaLabel="Quitar planta"
                    incrementAriaLabel="Añadir planta"
                  />

                  <div className="bo-configSalonCards" aria-label="Plantas del restaurante" data-ui="config-floors-cards-container">
                    {floorCards.map((floor) => (
                      <div key={`planta-${floor.keyPrefix}`} className="bo-floorSalonCard" data-slot="floor-card">
                        <div data-ui="floor-card-info">
                          <div className="bo-floorCardName" data-slot="configRestaurante-floorCardName">{floor.plantaLabel}</div>
                          <div className="bo-floorCardHint" data-slot="configRestaurante-floorCardHint">{floor.defaultLabel}</div>
                        </div>

                        <div className="bo-floorSalonCardState" data-ui="floor-card-state">
                          <span className="bo-floorSalonCardStatus" data-slot="configRestaurante-floorSalonCardStatus">{floor.statusLabel}</span>
                          <Switch
                            checked={floor.floor.active}
                            disabled={busy}
                            onCheckedChange={(checked) => {
                              void toggleFloorDefault(floor.floor, checked);
                            }}
                            aria-label={`Estado por defecto de ${floor.plantaLabel}`}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <SalonesTab
                  floors={floors}
                  api={api}
                  busy={busy}
                  setBusy={setBusy}
                  setError={setError}
                  pushToast={pushToast}
                />
              )}
            </motion.div>
          </AnimatePresence>
      </Panel>
    </>
  );
}
