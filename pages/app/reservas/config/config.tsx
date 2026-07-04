import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { usePageContext } from "vike-react/usePageContext";

import { createClient } from "../../../../api/client";
import type {
  ConfigDayStatus,
  ConfigDailyLimit,
  ConfigFloor,
  ConfigMesasDeDos,
  ConfigMesasDeTres,
  ConfigOpeningHours,
  MandatoryMenuConfig,
  MenuSelectorItem,
  OpeningMode,
} from "../../../../api/types";
import { DateDropdown } from "../../../../ui/inputs/DateDropdown";
import { Select } from "../../../../ui/inputs/Select";
import { Switch } from "../../../../ui/shadcn/Switch";
import { InlineAlert } from "../../../../ui/feedback/InlineAlert";
import { useToasts } from "../../../../ui/feedback/useToasts";
import { useErrorToast } from "../../../../ui/feedback/useErrorToast";
import { ReservationDayPanel } from "../../../../ui/widgets/ReservationDayPanel";
import { Panel } from "../../../../ui/shell/Panel";
import { PageToolbar } from "../../../../ui/shell/PageToolbar";

import { buildHalfHourSlots, todayISO } from "./helpers/configHelpers";
import { openingModeOptions } from "./constants/config.constants";
import type { PageData } from "./types/config.types";
import { useConfigDay } from "./hooks/useConfigDay";
import { MandatoryMenuConfig as MandatoryMenuConfigPanel } from "./functionalComponents/MandatoryMenuConfig/MandatoryMenuConfig";

export default function Page() {
  const pageContext = usePageContext();
  const data = (pageContext.data ?? {
    date: "",
    day: null,
    dailyLimit: null,
    openingHours: null,
    mesasDeDos: null,
    mesasDeTres: null,
    floors: [],
    error: null,
  }) as PageData;
  const api = useMemo(() => createClient({ baseUrl: "" }), []);
  const { pushToast } = useToasts();
  const reduceMotion = useReducedMotion();

  const [date, setDate] = useState(data.date || todayISO());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(data.error);
  useErrorToast(error);

  const [day, setDay] = useState<ConfigDayStatus | null>(data.day);
  const [dailyLimit, setDailyLimit] = useState<ConfigDailyLimit | null>(data.dailyLimit);
  const [openingHours, setOpeningHours] = useState<ConfigOpeningHours | null>(data.openingHours);
  const [openingModeDraft, setOpeningModeDraft] = useState<OpeningMode>(data.openingHours?.openingMode ?? "both");
  const [mesasDeDos, setMesasDeDos] = useState<ConfigMesasDeDos | null>(data.mesasDeDos);
  const [mesasDeTres, setMesasDeTres] = useState<ConfigMesasDeTres | null>(data.mesasDeTres);
  const [floors, setFloors] = useState<ConfigFloor[]>(data.floors || []);

  // Mandatory menu config state
  const [mandatoryMenuStatus, setMandatoryMenuStatus] = useState(false);
  const [mandatoryMenuConfig, setMandatoryMenuConfig] = useState<MandatoryMenuConfig | null>(null);
  const [availableMenus, setAvailableMenus] = useState<MenuSelectorItem[]>([]);
  const [selectedMenuIds, setSelectedMenuIds] = useState<number[]>([]);
  const [menuChooseMain, setMenuChooseMain] = useState<number[]>([]);
  const [mandatoryBooking, setMandatoryBooking] = useState(false);
  const [showMandatoryInfo, setShowMandatoryInfo] = useState(false);
  const [mandatoryMenuBusy, setMandatoryMenuBusy] = useState(false);

  const [draftLimit, setDraftLimit] = useState(() => String(data.dailyLimit?.limit ?? 45));

  const {
    loadAll,
    loadMandatoryMenuConfig,
    saveMandatoryMenus,
    handleMandatoryMenuToggle,
    onDateChange: onDateChangeCallback,
    toggleDay,
    saveDailyLimit,
    saveDailyLimitFromDraft,
    stepDailyLimit,
    saveOpeningHours,
    setMesasDos,
    setMesasTres,
    setFloorActive,
    handleOpeningModeChange,
    handleMorningHour,
    handleNightHour,
  } = useConfigDay({
    api,
    date,
    day,
    dailyLimit,
    openingHours,
    mesasDeDos,
    mesasDeTres,
    floors,
    mandatoryMenuStatus,
    mandatoryBooking,
    selectedMenuIds,
    menuChooseMain,
    availableMenus,
    draftLimit,
    pushToast,
    setDay,
    setDailyLimit,
    setOpeningHours,
    setMesasDeDos,
    setMesasDeTres,
    setFloors,
    setMandatoryMenuStatus,
    setMandatoryMenuConfig,
    setSelectedMenuIds,
    setMenuChooseMain,
    setMandatoryBooking,
    setDraftLimit,
    setBusy,
    setError,
  });

  const morningSlots = useMemo(() => buildHalfHourSlots(8 * 60, 17 * 60, "m"), []);
  const nightSlots = useMemo(() => buildHalfHourSlots(17 * 60 + 30, 1 * 60, "n"), []);
  const morningHourCards = useMemo(() => {
    const active = new Set(openingHours?.morningHours || []);
    return morningSlots.map((slot) => ({
      ...slot,
      active: active.has(slot.value),
    }));
  }, [openingHours?.morningHours, morningSlots]);
  const nightHourCards = useMemo(() => {
    const active = new Set(openingHours?.nightHours || []);
    return nightSlots.map((slot) => ({
      ...slot,
      active: active.has(slot.value),
    }));
  }, [openingHours?.nightHours, nightSlots]);

  const mesasOptions = useMemo(() => {
    const out = [{ value: "999", label: "Sin límite" }];
    for (let i = 0; i <= 40; i++) out.push({ value: String(i), label: String(i) });
    return out;
  }, []);

  useEffect(() => {
    if (!dailyLimit) return;
    setDraftLimit(String(dailyLimit.limit));
  }, [dailyLimit?.limit]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!openingHours) return;
    setOpeningModeDraft(openingHours.openingMode);
  }, [openingHours?.openingMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load mandatory menu config on mount
  useEffect(() => {
    void loadMandatoryMenuConfigFromApi(date);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadMandatoryMenuConfigFromApi = useCallback(
    async (d: string) => {
      setMandatoryMenuBusy(true);
      try {
        const menusRes = await api.menus.getSelector();
        if (menusRes.success) {
          setAvailableMenus(menusRes.menus || []);
        }

        const configRes = await api.config.getMandatoryMenus(d);
        if (configRes.success) {
          setMandatoryMenuConfig(configRes);
          setMandatoryMenuStatus(configRes.status);
          setSelectedMenuIds(configRes.menuIds || []);
          setMenuChooseMain(configRes.menuChooseMain || []);
          setMandatoryBooking(configRes.mandatory);
        } else {
          setMandatoryMenuConfig(null);
          setMandatoryMenuStatus(false);
          setSelectedMenuIds([]);
          setMenuChooseMain([]);
          setMandatoryBooking(false);
        }
      } catch {
        setMandatoryMenuConfig(null);
        setMandatoryMenuStatus(false);
        setSelectedMenuIds([]);
        setMenuChooseMain([]);
        setMandatoryBooking(false);
      } finally {
        setMandatoryMenuBusy(false);
      }
    },
    [api],
  );

  const onDateChange = useCallback(
    (d: string) => {
      setDate(d);
      void loadAll(d);
      void loadMandatoryMenuConfigFromApi(d);
    },
    [loadAll, loadMandatoryMenuConfigFromApi],
  );

  const dayVisibilityTransition = reduceMotion ? { duration: 0 } : { duration: 0.3, ease: "easeInOut" as const };
  const showMorningHours = openingModeDraft !== "night";
  const showNightHours = openingModeDraft !== "morning";

  if (!day || !dailyLimit || !openingHours || !mesasDeDos || !mesasDeTres) {
    return <InlineAlert kind="info" title="Cargando" message="Preparando configuración..." />;
  }

  return (
    <section data-ui="reservas-config" aria-label="Configuración diaria reservas">
      <PageToolbar
        left={
          <DateDropdown value={date} onChange={onDateChange} data-ui="date-dropdown" />
        }
        right={
          <button data-action="reload" className="bo-btn" type="button" onClick={() => void loadAll(date)} disabled={busy} data-ui="reload-btn">
            Recargar
          </button>
        }
      />

      <div data-slot="panels-stack" className="bo-stack">
        <ReservationDayPanel
          title={day.isOpen ? "Estado del día" : null}
          meta={day.isOpen ? `${dailyLimit.totalPeople}/${dailyLimit.limit} pax` : "Día cerrado"}
          day={day}
          busy={busy}
          onToggleDay={toggleDay}
          bodyClassName={day.isOpen ? undefined : "bo-configDayLimitRow--single"}
          data-ui="day-panel"
        />

        <AnimatePresence initial={false}>
          {day.isOpen ? (
            <motion.div
              data-ui="config-daily-limit-panel"
              key="config-daily-limit-panel"
              className="bo-dailyLimitPanel !shadow-md !w-fit p-4 px-8 bo-panel mx-auto"
              initial={reduceMotion ? { opacity: 1 } : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={reduceMotion ? { opacity: 1 } : { opacity: 0 }}
              transition={dayVisibilityTransition}
            >
              <div data-slot="panel-head" className="bo-panelHead !pt-0 !w-fit !mx-auto">
                <div data-role="title" className="bo-panelTitle !text-center" data-ui="daily-limit-title">Límite diario</div>
              </div>
              <div data-slot="daily-limit-body" className="bo-dailyLimitBody">
                <div data-ui="limit-counter" className="bo-dailyLimitCounter justify-center items-center flex !flex-row !gap-4">
                  <button
                    data-action="decrement"
                    className="bo-counterBtn"
                    type="button"
                    onClick={() => stepDailyLimit(-1)}
                    disabled={busy || Number(draftLimit || 0) <= 0}
                    aria-label="Reducir límite diario"
                    data-ui="decrement-btn"
                  >
                    <svg data-ui="decrement-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="5" y1="12" x2="19" y2="12" /></svg>
                  </button>
                  <input
                    data-role="limit-input"
                    className="bo-input bo-input--sm bo-counterInput bo-configLimitInput"
                    value={draftLimit}
                    inputMode="numeric"
                    onChange={(e) => setDraftLimit(e.target.value.replace(/[^\d]/g, ""))}
                    onBlur={saveDailyLimitFromDraft}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        (e.target as HTMLInputElement).blur();
                      }
                    }}
                    data-ui="limit-input"
                  />
                  <button
                    data-action="increment"
                    className="bo-counterBtn"
                    type="button"
                    onClick={() => stepDailyLimit(1)}
                    disabled={busy || Number(draftLimit || 0) >= 500}
                    aria-label="Aumentar límite diario"
                    data-ui="increment-btn"
                  >
                    <svg data-ui="increment-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                  </button>
                </div>
                <div data-ui="free-seats" className="bo-mutedText pt-4 !w-fit !mx-auto">Libres: {dailyLimit.freeBookingSeats}</div>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <AnimatePresence initial={false}>
          {day.isOpen ? (
            <MandatoryMenuConfigPanel
              availableMenus={availableMenus}
              selectedMenuIds={selectedMenuIds}
              menuChooseMain={menuChooseMain}
              mandatoryBooking={mandatoryBooking}
              showMandatoryInfo={showMandatoryInfo}
              mandatoryMenuBusy={mandatoryMenuBusy}
              mandatoryMenuStatus={mandatoryMenuStatus}
              onToggle={handleMandatoryMenuToggle}
              onMenuChange={(ids: number[], chooseMain: number[]) => {
                setSelectedMenuIds(ids);
                setMenuChooseMain(chooseMain);
              }}
              onBookingChange={setMandatoryBooking}
              onInfoClose={() => setShowMandatoryInfo(false)}
              onInfoToggle={() => setShowMandatoryInfo(true)}
              onSave={saveMandatoryMenus}
            />
          ) : null}
        </AnimatePresence>

        <AnimatePresence initial={false}>
          {day.isOpen ? (
            <motion.div
              data-ui="open-sections"
              key="config-open-sections"
              className="bo-stack"
              initial={reduceMotion ? { opacity: 1 } : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={reduceMotion ? { opacity: 1 } : { opacity: 0 }}
              transition={dayVisibilityTransition}
            >
              <div data-ui="hours-panel" className="bo-panel">
                <div data-slot="panel-head" className="bo-panelHead">
                  <div data-role="title" className="bo-panelTitle">Horario del día</div>
                </div>
                <div data-slot="panel-body" className="bo-panelBody" style={{ display: "grid", gap: 14 }}>
                  <div data-slot="opening-mode" className="bo-row">
                    <Select
                      value={openingModeDraft}
                      onChange={handleOpeningModeChange}
                      options={openingModeOptions as any}
                      size="sm"
                      ariaLabel="Modo de apertura"
                      data-ui="opening-mode-select"
                    />
                  </div>

                  {showMorningHours ? (
                    <div data-slot="morning-hours" className="bo-field">
                      <div data-role="label" className="bo-label">Mañana (08:00 - 17:00)</div>
                      <div data-ui="morning-slots" className="bo-hourCards bo-hourCards--slots">
                        {morningHourCards.map((slot) => (
                          <button
                            key={slot.id}
                            type="button"
                            className={`bo-hourCard bo-hourCard--slot${slot.active ? " is-on" : ""}`}
                            onClick={() => handleMorningHour(slot.value)}
                            disabled={busy}
                            data-ui="morning-slot-btn"
                            data-slot-value={slot.value}
                          >
                            {slot.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {showNightHours ? (
                    <div data-slot="night-hours" className="bo-field">
                      <div data-role="label" className="bo-label">Noche (17:30 - 01:00)</div>
                      <div data-ui="night-slots" className="bo-hourCards bo-hourCards--slots">
                        {nightHourCards.map((slot) => (
                          <button
                            key={slot.id}
                            type="button"
                            className={`bo-hourCard bo-hourCard--slot${slot.active ? " is-on" : ""}`}
                            onClick={() => handleNightHour(slot.value)}
                            disabled={busy}
                            data-ui="night-slot-btn"
                            data-slot-value={slot.value}
                          >
                            {slot.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>

              <Panel data-ui="tables-panel" title="Mesas" bodyClassName="bo-row bo-configTableLimitsRow">
                  <div data-slot="mesas-dos" className="bo-field bo-field--inline bo-configTableLimitField">
                    <div data-role="label" className="bo-label">Mesas de 2</div>
                    <Select
                      value={mesasDeDos.limit || "999"}
                      onChange={(v) => void setMesasDos(v)}
                      options={mesasOptions}
                      size="sm"
                      ariaLabel="Mesas de 2"
                      data-ui="mesas-dos-select"
                    />
                  </div>
                  <div data-slot="mesas-tres" className="bo-field bo-field--inline bo-configTableLimitField">
                    <div data-role="label" className="bo-label">Mesas de 3</div>
                    <Select
                      value={mesasDeTres.limit || "999"}
                      onChange={(v) => void setMesasTres(v)}
                      options={mesasOptions}
                      size="sm"
                      ariaLabel="Mesas de 3"
                      data-ui="mesas-tres-select"
                    />
                  </div>
              </Panel>

              <Panel data-ui="floors-panel" title="Plantas activas del día" meta={`${floors.length} plantas`}>
                  <div data-ui="floor-rows" className="bo-floorRows">
                    {floors.map((floor) => (
                      <div key={floor.id} data-ui="floor-row" className={`bo-floorRow${floor.isGround ? " is-ground" : ""}`}>
                        <div data-slot="floor-name" className="bo-floorRowName" data-role="floor-name">
                          {floor.name}
                        </div>
                        <div data-slot="floor-state" className="bo-floorRowState">
                          <span data-ui="floor-state-label" className="bo-floorRowStateText">{floor.active ? "Activa" : "Inactiva"}</span>
                          <Switch
                            checked={floor.active}
                            disabled={busy}
                            onCheckedChange={(checked) => void setFloorActive(floor, checked)}
                            aria-label={`Activar o desactivar ${floor.name}`}
                            data-ui="floor-switch"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
              </Panel>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </section>
  );
}
