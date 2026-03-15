import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { usePageContext } from "vike-react/usePageContext";
import { Minus, Plus } from "lucide-react";

import { createClient } from "../../../../api/client";
import type {
  ConfigDailyLimit,
  ConfigDayStatus,
  ConfigFloor,
  ConfigMesasDeDos,
  ConfigMesasDeTres,
  ConfigOpeningHours,
  OpeningMode,
} from "../../../../api/types";
import { DateDropdown } from "../../../../ui/inputs/DateDropdown";
import { Select } from "../../../../ui/inputs/Select";
import { Switch } from "../../../../ui/shadcn/Switch";
import { InlineAlert } from "../../../../ui/feedback/InlineAlert";
import { useToasts } from "../../../../ui/feedback/useToasts";
import { useErrorToast } from "../../../../ui/feedback/useErrorToast";
import { ReservationDayPanel } from "../../../../ui/widgets/ReservationDayPanel";

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

  const onDateChange = useCallback(
    (d: string) => {
      setDate(d);
      const url = new URL(window.location.href);
      url.searchParams.set("date", d);
      window.history.replaceState(null, "", url.toString());
      void loadAll(d);
    },
    [loadAll],
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
    <section aria-label="Configuración diaria reservas">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <DateDropdown value={date} onChange={onDateChange} />
          <button className="h-10 rounded-xl border border-[var(--border)] bg-bo-surface text-bo-text cursor-pointer px-3.5 font-bold inline-flex items-center justify-center gap-2 transition-all duration-150 hover:bg-bo-surface-3" type="button" onClick={() => void loadAll(date)} disabled={busy}>
            Recargar
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <ReservationDayPanel
          title="Estado del día y límite"
          meta={day.isOpen ? `${dailyLimit.totalPeople}/${dailyLimit.limit} pax` : "Día cerrado"}
          day={day}
          busy={busy}
          onToggleDay={toggleDay}
          bodyClassName={day.isOpen ? undefined : "p-3"}
          rightSlot={
            <AnimatePresence initial={false}>
              {day.isOpen ? (
                <motion.div
                  key="config-daily-limit"
                  className="flex flex-col gap-2"
                  initial={reduceMotion ? { opacity: 1 } : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={reduceMotion ? { opacity: 1 } : { opacity: 0 }}
                  transition={dayVisibilityTransition}
                >
                  <div className="text-xs text-[var(--text-muted)] font-semibold">Límite diario</div>
                  <div className="inline-flex items-center gap-2">
                    <button
                      className="w-8 h-8 rounded-xl border border-[var(--border)] bg-transparent text-[var(--text-muted)] cursor-pointer inline-flex items-center justify-center transition-all duration-150 hover:bg-bo-surface-3"
                      type="button"
                      onClick={() => stepDailyLimit(-1)}
                      disabled={busy || Number(draftLimit || 0) <= 0}
                      aria-label="Reducir límite diario"
                    >
                      <Minus size={14} strokeWidth={2.2} />
                    </button>
                    <input
                      className="h-[34px] w-16 rounded-xl border border-[var(--border)] bg-bo-surface text-bo-text px-2 outline-none text-center text-sm transition-colors duration-150 focus:border-[color-mix(in srgb,var(--bo-accent)38%,transparent)] focus:shadow-[0_0_0_3px_color-mix(in srgb,var(--bo-accent)10%,transparent)]"
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
                      className="w-8 h-8 rounded-xl border border-[var(--border)] bg-transparent text-[var(--text-muted)] cursor-pointer inline-flex items-center justify-center transition-all duration-150 hover:bg-bo-surface-3"
                      type="button"
                      onClick={() => stepDailyLimit(1)}
                      disabled={busy || Number(draftLimit || 0) >= 500}
                      aria-label="Aumentar límite diario"
                    >
                      <Plus size={14} strokeWidth={2.2} />
                    </button>
                  </div>
                  <div className="text-xs text-[var(--text-muted)]">Libres: {dailyLimit.freeBookingSeats}</div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          }
        />

        <AnimatePresence initial={false}>
          {day.isOpen ? (
            <motion.div
              key="config-open-sections"
              className="flex flex-col gap-4"
              initial={reduceMotion ? { opacity: 1 } : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={reduceMotion ? { opacity: 1 } : { opacity: 0 }}
              transition={dayVisibilityTransition}
            >
              <div className="rounded-[18px] bg-[linear-gradient(180deg,color-mix(in srgb,white,3%,transparent),color-mix(in srgb,black,13%,transparent)),var(--bo-surface)] shadow-[0_10px_26px_rgba(0,0,0,0.36)]">
                <div className="flex items-end justify-between p-4 pb-2">
                  <div className="font-semibold text-sm">Horario del día</div>
                </div>
                <div className="p-4 pt-0" style={{ display: "grid", gap: 14 }}>
                  <div className="flex flex-wrap gap-2">
                    <Select
                      value={openingModeDraft}
                      onChange={handleOpeningModeChange}
                      options={openingModeOptions as any}
                      size="sm"
                      ariaLabel="Modo de apertura"
                    />
                  </div>

                  {showMorningHours ? (
                    <div className="grid gap-2">
                      <div className="text-xs text-[var(--text-muted)] font-semibold">Mañana (08:00 - 17:00)</div>
                      <div className="flex flex-wrap gap-1.5">
                        {morningHourCards.map((slot) => (
                          <button
                            key={slot.id}
                            type="button"
                            className={`h-8 px-2.5 rounded-lg border text-xs font-medium transition-all duration-150${slot.active ? " border-[var(--bo-accent)] bg-[var(--bo-accent)]/20 text-[var(--bo-accent)]" : " border-[var(--border)] bg-transparent text-[var(--text-muted)] hover:bg-bo-surface-3"}`}
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
                    <div className="grid gap-2">
                      <div className="text-xs text-[var(--text-muted)] font-semibold">Noche (17:30 - 01:00)</div>
                      <div className="flex flex-wrap gap-1.5">
                        {nightHourCards.map((slot) => (
                          <button
                            key={slot.id}
                            type="button"
                            className={`h-8 px-2.5 rounded-lg border text-xs font-medium transition-all duration-150${slot.active ? " border-[var(--bo-accent)] bg-[var(--bo-accent)]/20 text-[var(--bo-accent)]" : " border-[var(--border)] bg-transparent text-[var(--text-muted)] hover:bg-bo-surface-3"}`}
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

              <div className="rounded-[18px] bg-[linear-gradient(180deg,color-mix(in srgb,white,3%,transparent),color-mix(in srgb,black,13%,transparent)),var(--bo-surface)] shadow-[0_10px_26px_rgba(0,0,0,0.36)]">
                <div className="flex items-end justify-between p-4 pb-2">
                  <div className="font-semibold text-sm">Mesas</div>
                </div>
                <div className="p-4 pt-0 flex flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <div className="text-xs text-[var(--text-muted)] font-semibold">Mesas de 2</div>
                    <Select
                      value={mesasDeDos.limit || "999"}
                      onChange={(v) => void setMesasDos(v)}
                      options={mesasOptions}
                      size="sm"
                      ariaLabel="Mesas de 2"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-xs text-[var(--text-muted)] font-semibold">Mesas de 3</div>
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

              <div className="rounded-[18px] bg-[linear-gradient(180deg,color-mix(in srgb,white,3%,transparent),color-mix(in srgb,black,13%,transparent)),var(--bo-surface)] shadow-[0_10px_26px_rgba(0,0,0,0.36)]">
                <div className="flex items-end justify-between p-4 pb-2">
                  <div className="font-semibold text-sm">Plantas activas del día</div>
                  <div className="text-xs text-[var(--text-faint)]">{floors.length} plantas</div>
                </div>
                <div className="p-4 pt-0">
                  <div className="flex flex-col gap-2">
                    {floors.map((floor) => (
                      <div key={floor.id} className={`flex items-center justify-between p-2 rounded-lg${floor.isGround ? " bg-bo-surface-2" : ""}`}>
                        <div className="text-sm">
                          {floor.name}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-[var(--text-muted)]">{floor.active ? "Activa" : "Inactiva"}</span>
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
