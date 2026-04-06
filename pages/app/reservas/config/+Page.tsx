import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { usePageContext } from "vike-react/usePageContext";
import { Info, Minus, Plus } from "lucide-react";

import { createClient } from "../../../../api/client";
import type {
  ConfigDailyLimit,
  ConfigDayStatus,
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
import { MandatoryMenuSelector } from "../../../../ui/widgets/MandatoryMenuSelector";
import { InfoModal } from "../../../../ui/overlays/InfoModal";

type PageData = {
  date: string;
  day: ConfigDayStatus | null;
  dailyLimit: ConfigDailyLimit | null;
  openingHours: ConfigOpeningHours | null;
  mesasDeDos: ConfigMesasDeDos | null;
  mesasDeTres: ConfigMesasDeTres | null;
  floors: ConfigFloor[];
  error: string | null;
};

type HourSlot = {
  id: string;
  value: string;
  label: string;
};

const openingModeOptions = [
  { value: "both", label: "Mañana + Noche" },
  { value: "morning", label: "Solo mañana" },
  { value: "night", label: "Solo noche" },
] as const;

function normalizeToHHMM(totalMinutes: number): string {
  const day = 24 * 60;
  const normalized = ((totalMinutes % day) + day) % day;
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function formatHourLabel(hhmm: string): string {
  return hhmm;
}

function buildHalfHourSlots(startMinutes: number, endMinutes: number, prefix: string): HourSlot[] {
  const out: HourSlot[] = [];
  const target = endMinutes < startMinutes ? endMinutes + 24 * 60 : endMinutes;
  for (let cursor = startMinutes; cursor <= target; cursor += 30) {
    const value = normalizeToHHMM(cursor);
    out.push({
      id: `${prefix}-${value.replace(":", "")}`,
      value,
      label: formatHourLabel(value),
    });
  }
  return out;
}

function serviceSortKey(hhmm: string): number {
  const [hRaw, mRaw] = hhmm.split(":");
  const h = Number(hRaw);
  const m = Number(mRaw);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 0;
  const minutes = h * 60 + m;
  return minutes < 8 * 60 ? minutes + 24 * 60 : minutes;
}

function sortServiceHours(hours: string[]): string[] {
  return [...hours].sort((a, b) => {
    const ka = serviceSortKey(a);
    const kb = serviceSortKey(b);
    if (ka === kb) return a.localeCompare(b);
    return ka - kb;
  });
}

function mergeHoursByOpeningMode(mode: OpeningMode, morningHours: string[], nightHours: string[]): string[] {
  if (mode === "morning") return sortServiceHours(morningHours);
  if (mode === "night") return sortServiceHours(nightHours);
  return sortServiceHours([...morningHours, ...nightHours]);
}

function toggleHour(current: string[], hour: string): string[] {
  const set = new Set(current);
  if (set.has(hour)) set.delete(hour);
  else set.add(hour);
  return sortServiceHours([...set]);
}

function clampDailyLimit(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(500, Math.trunc(v)));
}

function todayISO(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

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
    void loadMandatoryMenuConfig(date);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const mesasOptions = useMemo(() => {
    const out = [{ value: "999", label: "Sin límite" }];
    for (let i = 0; i <= 40; i++) out.push({ value: String(i), label: String(i) });
    return out;
  }, []);

  const loadAll = useCallback(
    async (d: string) => {
      setBusy(true);
      setError(null);
      try {
        const [d0, d1, d2, d3, d4, d5] = await Promise.all([
          api.config.getDay(d),
          api.config.getDailyLimit(d),
          api.config.getOpeningHours(d),
          api.config.getMesasDeDos(d),
          api.config.getMesasDeTres(d),
          api.config.getFloors(d),
        ]);

        let nextError: string | null = null;

        if (d0.success) setDay(d0);
        else nextError = nextError || d0.message || "Error cargando estado del día";

        if (d1.success) setDailyLimit(d1);
        else nextError = nextError || d1.message || "Error cargando límite diario";

        if (d2.success) setOpeningHours(d2);
        else nextError = nextError || d2.message || "Error cargando horarios";

        if (d3.success) setMesasDeDos(d3);
        else nextError = nextError || d3.message || "Error cargando mesas de 2";

        if (d4.success) setMesasDeTres(d4);
        else nextError = nextError || d4.message || "Error cargando mesas de 3";

        if (d5.success) setFloors(d5.floors || []);
        else nextError = nextError || d5.message || "Error cargando plantas";

        if (nextError) setError(nextError);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error cargando configuración");
      } finally {
        setBusy(false);
      }
    },
    [api],
  );

  const loadMandatoryMenuConfig = useCallback(
    async (d: string) => {
      setMandatoryMenuBusy(true);
      try {
        // Load available menus for selector
        const menusRes = await api.menus.getSelector();
        if (menusRes.success) {
          setAvailableMenus(menusRes.menus || []);
        }

        // Load mandatory menu config for date
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
      } catch (e) {
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

  const saveMandatoryMenus = useCallback(async () => {
    setMandatoryMenuBusy(true);
    try {
      const res = await api.config.saveMandatoryMenus({
        date,
        status: true,
        mandatory: mandatoryBooking,
        menuIds: selectedMenuIds,
        menuChooseMain: menuChooseMain,
      });
      if (res.success) {
        setMandatoryMenuConfig(res);
        pushToast({ kind: "success", title: "Guardado", message: "Configuración de menus guardada" });
      } else {
        pushToast({ kind: "error", title: "Error", message: res.message || "No se pudo guardar la configuración" });
      }
    } catch (e) {
      pushToast({ kind: "error", title: "Error", message: e instanceof Error ? e.message : "No se pudo guardar la configuración" });
    } finally {
      setMandatoryMenuBusy(false);
    }
  }, [api, date, mandatoryBooking, selectedMenuIds, menuChooseMain, pushToast]);

  const handleMandatoryMenuToggle = useCallback(
    async (checked: boolean) => {
      if (!checked) {
        // Turn OFF: call save with status=false
        setMandatoryMenuBusy(true);
        try {
          const res = await api.config.saveMandatoryMenus({
            date,
            status: false,
            mandatory: false,
            menuIds: [],
            menuChooseMain: [],
          });
          if (res.success) {
            setMandatoryMenuStatus(false);
            setMandatoryMenuConfig(res);
            setSelectedMenuIds([]);
            setMenuChooseMain([]);
            setMandatoryBooking(false);
            pushToast({ kind: "success", title: "Desactivado", message: "Menús obligatorios desactivados para este día" });
          }
        } catch (e) {
          pushToast({ kind: "error", title: "Error", message: e instanceof Error ? e.message : "No se pudo actualizar" });
        } finally {
          setMandatoryMenuBusy(false);
        }
      } else {
        // Turn ON: auto-select first available menu if none selected
        setMandatoryMenuStatus(true);
        if (selectedMenuIds.length === 0 && availableMenus.length > 0) {
          setSelectedMenuIds([availableMenus[0].id]);
        }
      }
    },
    [api, date, pushToast, selectedMenuIds, availableMenus],
  );

  const onDateChange = useCallback(
    (d: string) => {
      setDate(d);
      const url = new URL(window.location.href);
      url.searchParams.set("date", d);
      window.history.replaceState(null, "", url.toString());
      void loadAll(d);
      void loadMandatoryMenuConfig(d);
    },
    [loadAll, loadMandatoryMenuConfig],
  );

  const pushSuccess = useCallback(
    (message: string) => {
      pushToast({ kind: "success", title: "Guardado", message });
    },
    [pushToast],
  );

  const toggleDay = useCallback(async () => {
    if (!day) return;
    setBusy(true);
    setError(null);
    try {
      const next = !day.isOpen;
      const res = await api.config.setDay(date, next);
      if (!res.success) {
        pushToast({ kind: "error", title: "Error", message: res.message || "No se pudo actualizar el día" });
        return;
      }
      setDay(res);
      pushSuccess(next ? "Día abierto" : "Día cerrado");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo actualizar el día");
    } finally {
      setBusy(false);
    }
  }, [api.config, date, day, pushSuccess, pushToast]);

  const saveDailyLimit = useCallback(
    async (nextLimit: number) => {
      const normalized = clampDailyLimit(nextLimit);
      if (dailyLimit && normalized === dailyLimit.limit) {
        setDraftLimit(String(normalized));
        return;
      }
      setBusy(true);
      setError(null);
      try {
        const res = await api.config.setDailyLimit(date, normalized);
        if (!res.success) {
          pushToast({ kind: "error", title: "Error", message: res.message || "No se pudo guardar el límite" });
          if (dailyLimit) setDraftLimit(String(dailyLimit.limit));
          return;
        }
        setDailyLimit((prev) => {
          const totalPeople = prev?.totalPeople ?? 0;
          return {
            date: res.date,
            limit: res.limit,
            totalPeople,
            freeBookingSeats: Math.max(0, res.limit - totalPeople),
            source: "override",
          };
        });
        setDraftLimit(String(res.limit));
        pushSuccess("Límite diario actualizado");
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo guardar el límite");
      } finally {
        setBusy(false);
      }
    },
    [api.config, dailyLimit, date, pushSuccess, pushToast],
  );

  const saveDailyLimitFromDraft = useCallback(() => {
    const n = Number(draftLimit);
    if (!Number.isFinite(n) || n < 0 || n > 500) {
      if (dailyLimit) setDraftLimit(String(dailyLimit.limit));
      pushToast({ kind: "error", title: "Error", message: "Límite diario inválido" });
      return;
    }
    void saveDailyLimit(Math.trunc(n));
  }, [dailyLimit, draftLimit, pushToast, saveDailyLimit]);

  const stepDailyLimit = useCallback(
    (step: number) => {
      const fromDraft = Number(draftLimit);
      const base = Number.isFinite(fromDraft) ? Math.trunc(fromDraft) : dailyLimit?.limit ?? 45;
      const next = clampDailyLimit(base + step);
      setDraftLimit(String(next));
      void saveDailyLimit(next);
    },
    [dailyLimit?.limit, draftLimit, saveDailyLimit],
  );

  const saveOpeningHours = useCallback(
    async (
      patch: Partial<{ openingMode: OpeningMode; morningHours: string[]; nightHours: string[] }>,
      successMessage: string,
    ) => {
      if (!openingHours) return;
      const previous = openingHours;
      const nextOpeningMode = patch.openingMode ?? openingHours.openingMode;
      const nextMorningHours = patch.morningHours ?? openingHours.morningHours;
      const nextNightHours = patch.nightHours ?? openingHours.nightHours;

      setOpeningHours({
        ...openingHours,
        openingMode: nextOpeningMode,
        morningHours: nextMorningHours,
        nightHours: nextNightHours,
        hours: mergeHoursByOpeningMode(nextOpeningMode, nextMorningHours, nextNightHours),
        source: "override",
      });
      setBusy(true);
      setError(null);
      try {
        const res = await api.config.setOpeningHours(date, {
          openingMode: nextOpeningMode,
          morningHours: nextMorningHours,
          nightHours: nextNightHours,
        });
        if (!res.success) {
          setOpeningHours(previous);
          pushToast({ kind: "error", title: "Error", message: res.message || "No se pudo guardar horarios" });
          return;
        }
        setOpeningHours(res);
        pushSuccess(successMessage);
      } catch (e) {
        setOpeningHours(previous);
        setError(e instanceof Error ? e.message : "No se pudo guardar horarios");
      } finally {
        setBusy(false);
      }
    },
    [api.config, date, openingHours, pushSuccess, pushToast],
  );

  const setMesasDos = useCallback(
    async (limit: string) => {
      setBusy(true);
      setError(null);
      try {
        const res = await api.config.setMesasDeDos(date, limit);
        if (!res.success) {
          pushToast({ kind: "error", title: "Error", message: res.message || "No se pudo actualizar mesas de 2" });
          return;
        }
        setMesasDeDos(res);
        pushSuccess("Mesas de 2 actualizadas");
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo actualizar mesas de 2");
      } finally {
        setBusy(false);
      }
    },
    [api.config, date, pushSuccess, pushToast],
  );

  const setMesasTres = useCallback(
    async (limit: string) => {
      setBusy(true);
      setError(null);
      try {
        const res = await api.config.setMesasDeTres(date, limit);
        if (!res.success) {
          pushToast({ kind: "error", title: "Error", message: res.message || "No se pudo actualizar mesas de 3" });
          return;
        }
        setMesasDeTres(res);
        pushSuccess("Mesas de 3 actualizadas");
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo actualizar mesas de 3");
      } finally {
        setBusy(false);
      }
    },
    [api.config, date, pushSuccess, pushToast],
  );

  const setFloorActive = useCallback(
    async (floor: ConfigFloor, active: boolean) => {
      setBusy(true);
      setError(null);
      try {
        const res = await api.config.setFloor(date, floor.floorNumber, active);
        if (!res.success) {
          pushToast({ kind: "error", title: "Error", message: res.message || "No se pudo actualizar la planta" });
          return;
        }
        setFloors(res.floors || []);
        pushSuccess(`${floor.name} ${active ? "activada" : "desactivada"}`);
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo actualizar la planta");
      } finally {
        setBusy(false);
      }
    },
    [api.config, date, pushSuccess, pushToast],
  );

  const showMorningHours = openingModeDraft !== "night";
  const showNightHours = openingModeDraft !== "morning";

  const handleOpeningModeChange = useCallback(
    (value: string) => {
      const nextMode = value === "morning" || value === "night" ? value : "both";
      setOpeningModeDraft(nextMode);
      void saveOpeningHours({ openingMode: nextMode }, "Modo de apertura actualizado");
    },
    [saveOpeningHours],
  );

  const handleMorningHour = useCallback(
    (hour: string) => {
      void saveOpeningHours(
        { morningHours: toggleHour(openingHours?.morningHours || [], hour) },
        "Horario de mañana actualizado",
      );
    },
    [openingHours?.morningHours, saveOpeningHours],
  );

  const handleNightHour = useCallback(
    (hour: string) => {
      void saveOpeningHours(
        { nightHours: toggleHour(openingHours?.nightHours || [], hour) },
        "Horario de noche actualizado",
      );
    },
    [openingHours?.nightHours, saveOpeningHours],
  );

  const dayVisibilityTransition = reduceMotion ? { duration: 0 } : { duration: 0.3, ease: "easeInOut" as const };

  if (!day || !dailyLimit || !openingHours || !mesasDeDos || !mesasDeTres) {
    return <InlineAlert kind="info" title="Cargando" message="Preparando configuración..." />;
  }

  return (
    <section data-ui="reservas-config" aria-label="Configuración diaria reservas">
      <div data-slot="toolbar" className="bo-toolbar">
        <div data-slot="toolbar-left" className="bo-toolbarLeft">
          <DateDropdown value={date} onChange={onDateChange} />
          <button data-action="reload" className="bo-btn" type="button" onClick={() => void loadAll(date)} disabled={busy}>
            Recargar
          </button>
        </div>
      </div>

      <div data-slot="panels-stack" className="bo-stack">
        <ReservationDayPanel
          title="Estado del día"
          meta={day.isOpen ? `${dailyLimit.totalPeople}/${dailyLimit.limit} pax` : "Día cerrado"}
          day={day}
          busy={busy}
          onToggleDay={toggleDay}
          bodyClassName={day.isOpen ? undefined : "bo-configDayLimitRow--single"}
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
                <div data-role="title" className="bo-panelTitle !text-center">Límite diario</div>
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
                  >
                    <Minus size={14} strokeWidth={2.2} />
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
                  />
                  <button
                    data-action="increment"
                    className="bo-counterBtn"
                    type="button"
                    onClick={() => stepDailyLimit(1)}
                    disabled={busy || Number(draftLimit || 0) >= 500}
                    aria-label="Aumentar límite diario"
                  >
                    <Plus size={14} strokeWidth={2.2} />
                  </button>
                </div>
                <div data-ui="free-seats" className="bo-mutedText pt-4 !w-fit !mx-auto">Libres: {dailyLimit.freeBookingSeats}</div>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <AnimatePresence initial={false}>
          {day.isOpen ? (
            <motion.div
              data-ui="mandatory-menus-panel"
              key="config-mandatory-menus"
              className="bo-panel overflow-hidden"
              initial={reduceMotion ? { opacity: 1 } : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={reduceMotion ? { opacity: 1 } : { opacity: 0 }}
              transition={dayVisibilityTransition}
            >
              <div data-slot="panel-head" className="bo-panelHead px-4 pt-4 pb-3 sm:px-6 sm:pt-5 sm:pb-4 mx-auto justify-center">
                <div className="flex flex-col sm:items-center sm:justify-between gap-2 mx-auto">
                  <div>
                    <div data-role="title" className="bo-panelTitle text-base sm:text-lg text-center">Reserva de menús</div>
                    <div data-slot="meta" className="bo-panelMeta text-xs sm:text-sm mt-0.5 text-center">
                      Los clientes eligen menú antes de confirmar la reserva
                    </div>
                  </div>
                  <div className="flex items-center gap-3 mx-auto" data-ui="mandatory-toggle">
                    <span className={`text-sm font-medium ${mandatoryMenuStatus ? "text-(--bo-accent)" : "text-(--bo-muted)"} transition-colors duration-150`}>
                      {mandatoryMenuStatus ? "Activado" : "Desactivado"}
                    </span>
                    <Switch
                      checked={mandatoryMenuStatus}
                      onCheckedChange={handleMandatoryMenuToggle}
                      disabled={mandatoryMenuBusy}
                      aria-label="Activar menús obligatorios"
                    />
                  </div>
                </div>
              </div>

              <AnimatePresence>
                {mandatoryMenuStatus && (
                  <motion.div
                    data-slot="panel-body"
                    className="bo-panelBody px-4 pb-4 sm:px-6 sm:pb-5"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    {/* Info notice */}
                    <div className="mb-4 p-3 rounded-lg bg-(--bo-surface-2) border border-(--bo-border)">
                      <div className="flex gap-4 items-center mx-auto !content-center">
                        <Info size={16} strokeWidth={1.8} className="text-(--bo-accent) mt-0.5 flex-shrink-0" aria-hidden="true" />
                        <p className="text-xs text-(--bo-muted) leading-relaxed">
                          Los menús seleccionados aparecerán durante el proceso de reserva. <br></br> Los clientes deberán elegir uno antes de confirmar.
                        </p>
                      </div>
                    </div>

                    {/* Menu selector */}
                    <div className="mb-4" data-ui="menu-selector-wrapper">
                      <MandatoryMenuSelector
                        menus={availableMenus}
                        selectedMenuIds={selectedMenuIds}
                        menuChooseMain={menuChooseMain}
                        onChange={(ids, chooseMain) => {
                          setSelectedMenuIds(ids);
                          setMenuChooseMain(chooseMain);
                        }}
                      />
                    </div>

                    {/* Booking option */}
                    <div className="flex sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg bg-(--bo-surface-2) border border-(--bo-border) w-fit mx-auto flex-row-reverse items-center" data-ui="mandatory-booking-row">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={mandatoryBooking}
                          onChange={(e) => setMandatoryBooking(e.target.checked)}
                          className="bo-checkbox"
                          data-ui="mandatory-booking-checkbox"
                        />
                        <div>
                          <span className="text-sm font-medium text-(--bo-text) block">Reserva obligatoria</span>
                          <span className="text-xs text-(--bo-muted)">El cliente debe seleccionar menú para continuar</span>
                        </div>
                      </label>
                      <button
                        type="button"
                        className="bo-btn bo-btn--ghost bo-btn--icon p-2 text-(--bo-muted) hover:text-(--bo-accent) transition-colors duration-150 self-start sm:self-center"
                        onClick={() => setShowMandatoryInfo(true)}
                        aria-label="Más información"
                        data-ui="mandatory-info-btn"
                      >
                        <Info size={16} strokeWidth={1.8} aria-hidden="true" />
                      </button>
                    </div>

                    {/* Save button */}
                    <div className="flex justify-center mt-4" data-ui="mandatory-save">
                      <button
                        type="button"
                        className="bo-btn primary w-full sm:w-auto px-8"
                        onClick={() => void saveMandatoryMenus()}
                        disabled={mandatoryMenuBusy || selectedMenuIds.length === 0}
                        data-ui="save-mandatory-btn"
                      >
                        {mandatoryMenuBusy ? (
                          <span className="flex items-center gap-2">
                            <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                            Guardando...
                          </span>
                        ) : (
                          "Guardar configuración"
                        )}
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <InfoModal
                open={showMandatoryInfo}
                title="Reserva obligatoria"
                content="Si se selecciona reserva obligatoria, los clientes deben seleccionar un menú para poder avanzar con su reserva. Si no se selecciona la casilla, los menús serán mostrados durante el proceso de reserva, pero el cliente puede continuar sin seleccionar uno."
                onClose={() => setShowMandatoryInfo(false)}
              />
            </motion.div>
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
                          >
                            {slot.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>

              <div data-ui="tables-panel" className="bo-panel">
                <div data-slot="panel-head" className="bo-panelHead">
                  <div data-role="title" className="bo-panelTitle">Mesas</div>
                </div>
                <div data-slot="panel-body" className="bo-panelBody bo-row bo-configTableLimitsRow">
                  <div data-slot="mesas-dos" className="bo-field bo-field--inline bo-configTableLimitField">
                    <div data-role="label" className="bo-label">Mesas de 2</div>
                    <Select
                      value={mesasDeDos.limit || "999"}
                      onChange={(v) => void setMesasDos(v)}
                      options={mesasOptions}
                      size="sm"
                      ariaLabel="Mesas de 2"
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
                    />
                  </div>
                </div>
              </div>

              <div data-ui="floors-panel" className="bo-panel">
                <div data-slot="panel-head" className="bo-panelHead">
                  <div data-role="title" className="bo-panelTitle">Plantas activas del día</div>
                  <div data-slot="meta" className="bo-panelMeta">{floors.length} plantas</div>
                </div>
                <div data-slot="panel-body" className="bo-panelBody">
                  <div data-ui="floor-rows" className="bo-floorRows">
                    {floors.map((floor) => (
                      <div key={floor.id} data-ui="floor-row" className={`bo-floorRow${floor.isGround ? " is-ground" : ""}`}>
                        <div data-slot="floor-name" className="bo-floorRowName">
                          {floor.name}
                        </div>
                        <div data-slot="floor-state" className="bo-floorRowState">
                          <span data-ui="floor-state-label" className="bo-floorRowStateText">{floor.active ? "Activa" : "Inactiva"}</span>
                          <Switch
                            checked={floor.active}
                            disabled={busy}
                            onCheckedChange={(checked) => void setFloorActive(floor, checked)}
                            aria-label={`Activar o desactivar ${floor.name}`}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </section>
  );
}
