import React, { useCallback, useEffect, useMemo, useState } from "react";
import { usePageContext } from "vike-react/usePageContext";
import { Lock, LockOpen, Minus, Plus } from "lucide-react";

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
import { DatePicker } from "../../../../ui/inputs/DatePicker";
import { Select } from "../../../../ui/inputs/Select";
import { Switch } from "../../../../ui/shadcn/Switch";
import { InlineAlert } from "../../../../ui/feedback/InlineAlert";
import { useToasts } from "../../../../ui/feedback/useToasts";
import { useErrorToast } from "../../../../ui/feedback/useErrorToast";

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

export default function Page() {
  const pageContext = usePageContext();
  const data = pageContext.data as PageData;
  const api = useMemo(() => createClient({ baseUrl: "" }), []);
  const { pushToast } = useToasts();

  const [date, setDate] = useState(data.date);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(data.error);
  useErrorToast(error);

  const [day, setDay] = useState<ConfigDayStatus | null>(data.day);
  const [dailyLimit, setDailyLimit] = useState<ConfigDailyLimit | null>(data.dailyLimit);
  const [openingHours, setOpeningHours] = useState<ConfigOpeningHours | null>(data.openingHours);
  const [mesasDeDos, setMesasDeDos] = useState<ConfigMesasDeDos | null>(data.mesasDeDos);
  const [mesasDeTres, setMesasDeTres] = useState<ConfigMesasDeTres | null>(data.mesasDeTres);
  const [floors, setFloors] = useState<ConfigFloor[]>(data.floors || []);

  const [draftLimit, setDraftLimit] = useState(() => String(data.dailyLimit?.limit ?? 45));
  const morningSlots = useMemo(() => buildHalfHourSlots(8 * 60, 17 * 60, "m"), []);
  const nightSlots = useMemo(() => buildHalfHourSlots(17 * 60 + 30, 1 * 60, "n"), []);

  useEffect(() => {
    if (!dailyLimit) return;
    setDraftLimit(String(dailyLimit.limit));
  }, [dailyLimit?.limit]); // eslint-disable-line react-hooks/exhaustive-deps

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
      setBusy(true);
      setError(null);
      try {
        const res = await api.config.setOpeningHours(date, {
          openingMode: patch.openingMode ?? openingHours.openingMode,
          morningHours: patch.morningHours ?? openingHours.morningHours,
          nightHours: patch.nightHours ?? openingHours.nightHours,
        });
        if (!res.success) {
          pushToast({ kind: "error", title: "Error", message: res.message || "No se pudo guardar horarios" });
          return;
        }
        setOpeningHours(res);
        pushSuccess(successMessage);
      } catch (e) {
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
      if (floor.isGround && !active) return;
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

  if (!day || !dailyLimit || !openingHours || !mesasDeDos || !mesasDeTres) {
    return <InlineAlert kind="info" title="Cargando" message="Preparando configuración..." />;
  }

  return (
    <section aria-label="Configuración diaria reservas">
      <div className="bo-toolbar">
        <div className="bo-toolbarLeft">
          <DatePicker value={date} onChange={onDateChange} />
          <button className="bo-btn bo-btn--ghost" type="button" onClick={() => void loadAll(date)} disabled={busy}>
            Recargar
          </button>
        </div>
        <div className="bo-toolbarRight">
          <div className="bo-mutedText">{busy ? "Actualizando..." : "Override por fecha"}</div>
        </div>
      </div>

      <div className="bo-stack">
        <div className="bo-panel">
          <div className="bo-panelHead">
            <div className="bo-panelTitle">Estado del día y límite</div>
            <div className="bo-panelMeta">
              {dailyLimit.totalPeople}/{dailyLimit.limit} pax
            </div>
          </div>
          <div className="bo-panelBody bo-configDayLimitRow">
            <div className="bo-configDayState">
              <div className="bo-label">Estado del día</div>
              <div className="bo-configStatus">
                {day.isOpen ? <LockOpen size={16} strokeWidth={1.8} /> : <Lock size={16} strokeWidth={1.8} />}
                <span>{day.isOpen ? "Abierto" : "Cerrado"}</span>
              </div>
              <button className="bo-btn bo-btn--primary bo-btn--fit" type="button" onClick={toggleDay} disabled={busy}>
                {day.isOpen ? "Cerrar día" : "Abrir día"}
              </button>
            </div>

            <div className="bo-configDayDailyLimit">
              <div className="bo-label">Límite diario</div>
              <div className="bo-counter bo-configLimitCounter">
                <button
                  className="bo-counterBtn"
                  type="button"
                  onClick={() => stepDailyLimit(-1)}
                  disabled={busy || Number(draftLimit || 0) <= 0}
                  aria-label="Reducir límite diario"
                >
                  <Minus size={14} strokeWidth={2.2} />
                </button>
                <input
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
                  className="bo-counterBtn"
                  type="button"
                  onClick={() => stepDailyLimit(1)}
                  disabled={busy || Number(draftLimit || 0) >= 500}
                  aria-label="Aumentar límite diario"
                >
                  <Plus size={14} strokeWidth={2.2} />
                </button>
              </div>
              <div className="bo-mutedText">Libres: {dailyLimit.freeBookingSeats}</div>
            </div>
          </div>
        </div>

        <div className="bo-panel">
          <div className="bo-panelHead">
            <div className="bo-panelTitle">Horario del día</div>
            <div className="bo-panelMeta">{openingHours.source === "default" ? "Usando default" : "Override diario"}</div>
          </div>
          <div className="bo-panelBody" style={{ display: "grid", gap: 14 }}>
            <div className="bo-row">
              <Select
                value={openingHours.openingMode}
                onChange={(v) => void saveOpeningHours({ openingMode: (v as OpeningMode) || "both" }, "Modo de apertura actualizado")}
                options={openingModeOptions as any}
                size="sm"
                ariaLabel="Modo de apertura"
              />
            </div>

            <div className="bo-field">
              <div className="bo-label">Mañana (08:00 - 17:00)</div>
              <div className="bo-hourCards bo-hourCards--slots">
                {morningSlots.map((slot) => {
                  const on = (openingHours.morningHours || []).includes(slot.value);
                  return (
                    <button
                      key={slot.id}
                      type="button"
                      className={`bo-hourCard bo-hourCard--slot${on ? " is-on" : ""}`}
                      onClick={() =>
                        void saveOpeningHours(
                          { morningHours: toggleHour(openingHours.morningHours || [], slot.value) },
                          "Horario de mañana actualizado",
                        )
                      }
                      disabled={busy}
                    >
                      {slot.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="bo-field">
              <div className="bo-label">Noche (17:30 - 01:00)</div>
              <div className="bo-hourCards bo-hourCards--slots">
                {nightSlots.map((slot) => {
                  const on = (openingHours.nightHours || []).includes(slot.value);
                  return (
                    <button
                      key={slot.id}
                      type="button"
                      className={`bo-hourCard bo-hourCard--slot${on ? " is-on" : ""}`}
                      onClick={() =>
                        void saveOpeningHours(
                          { nightHours: toggleHour(openingHours.nightHours || [], slot.value) },
                          "Horario de noche actualizado",
                        )
                      }
                      disabled={busy}
                    >
                      {slot.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="bo-panel">
          <div className="bo-panelHead">
            <div className="bo-panelTitle">Mesas</div>
            <div className="bo-panelMeta">Guardado automático</div>
          </div>
          <div className="bo-panelBody bo-row">
            <div className="bo-field bo-field--inline">
              <div className="bo-label">Mesas de 2</div>
              <Select
                value={mesasDeDos.limit || "999"}
                onChange={(v) => void setMesasDos(v)}
                options={mesasOptions}
                size="sm"
                ariaLabel="Mesas de 2"
              />
            </div>
            <div className="bo-field bo-field--inline">
              <div className="bo-label">Mesas de 3</div>
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

        <div className="bo-panel">
          <div className="bo-panelHead">
            <div className="bo-panelTitle">Plantas activas del día</div>
            <div className="bo-panelMeta">{floors.length} plantas</div>
          </div>
          <div className="bo-panelBody">
            <div className="bo-floorRows">
              {floors.map((floor) => (
                <div key={floor.id} className={`bo-floorRow${floor.isGround ? " is-ground" : ""}`}>
                  <div className="bo-floorRowName">
                    {floor.name}
                    {floor.isGround ? <span className="bo-floorRowHint"> (siempre activa)</span> : null}
                  </div>
                  <div className="bo-floorRowState">
                    <span className="bo-floorRowStateText">{floor.active ? "Activa" : "Inactiva"}</span>
                    <Switch
                      checked={floor.active}
                      disabled={busy || floor.isGround}
                      onCheckedChange={(checked) => void setFloorActive(floor, checked)}
                      aria-label={`Activar o desactivar ${floor.name}`}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
