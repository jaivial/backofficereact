import React, { useCallback, useMemo, useState } from "react";
import { usePageContext } from "vike-react/usePageContext";

import { createClient } from "../../../api/client";
import type { ConfigDailyLimit, ConfigDayStatus, ConfigMesasDeDos, ConfigOpeningHours, ConfigSalonCondesa } from "../../../api/types";
import { DatePicker } from "../../../ui/inputs/DatePicker";
import { Select } from "../../../ui/inputs/Select";
import { InlineAlert } from "../../../ui/feedback/InlineAlert";
import { useToasts } from "../../../ui/feedback/useToasts";

type PageData = {
  date: string;
  day: ConfigDayStatus | null;
  dailyLimit: ConfigDailyLimit | null;
  openingHours: ConfigOpeningHours | null;
  mesasDeDos: ConfigMesasDeDos | null;
  salon: ConfigSalonCondesa | null;
  error: string | null;
};

function hoursOptionsBase(): string[] {
  // Common reservation slots (can be customized per date via saved opening hours).
  return ["13:00", "13:30", "14:00", "14:30", "15:00", "15:30", "20:00", "20:30", "21:00", "21:30", "22:00", "22:30"];
}

export default function Page() {
  const pageContext = usePageContext();
  const data = pageContext.data as PageData;
  const api = useMemo(() => createClient({ baseUrl: "" }), []);
  const { pushToast } = useToasts();

  const [date, setDate] = useState(data.date);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(data.error);

  const [day, setDay] = useState<ConfigDayStatus | null>(data.day);
  const [dailyLimit, setDailyLimit] = useState<ConfigDailyLimit | null>(data.dailyLimit);
  const [openingHours, setOpeningHours] = useState<ConfigOpeningHours | null>(data.openingHours);
  const [mesasDeDos, setMesasDeDos] = useState<ConfigMesasDeDos | null>(data.mesasDeDos);
  const [salon, setSalon] = useState<ConfigSalonCondesa | null>(data.salon);

  const [draftLimit, setDraftLimit] = useState(() => String(data.dailyLimit?.limit ?? 45));

  const hours = openingHours?.hours ?? [];
  const hoursOptions = useMemo(() => {
    const set = new Set([...hoursOptionsBase(), ...hours]);
    return [...set].sort();
  }, [hours]);
  const [hourToAdd, setHourToAdd] = useState(hoursOptions[0] || "13:30");

  const mesasOptions = useMemo(() => {
    const out = [{ value: "999", label: "Sin limite" }];
    for (let i = 0; i <= 40; i++) out.push({ value: String(i), label: String(i) });
    return out;
  }, []);

  const [mesasDraft, setMesasDraft] = useState(() => {
    const v = mesasDeDos?.limit?.trim();
    if (!v) return "999";
    return v;
  });

  const loadAll = useCallback(
    async (d: string) => {
      setBusy(true);
      setError(null);
      try {
        const [d0, d1, d2, d3, d4] = await Promise.all([
          api.config.getDay(d),
          api.config.getDailyLimit(d),
          api.config.getOpeningHours(d),
          api.config.getMesasDeDos(d),
          api.config.getSalonCondesa(d),
        ]);

        if (d0.success) setDay(d0);
        if (d1.success) {
          setDailyLimit(d1);
          setDraftLimit(String(d1.limit));
        }
        if (d2.success) {
          setOpeningHours(d2);
          const list = d2.hours;
          if (list.length && !list.includes(hourToAdd)) setHourToAdd(list[0]);
        }
        if (d3.success) {
          setMesasDeDos(d3);
          const v = d3.limit?.trim();
          setMesasDraft(v ? v : "999");
        }
        if (d4.success) setSalon(d4);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error cargando configuracion");
      } finally {
        setBusy(false);
      }
    },
    [api, hourToAdd],
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

  const toggleDay = useCallback(async () => {
    if (!day) return;
    setBusy(true);
    try {
      const next = !day.isOpen;
      const res = await api.config.setDay(date, next);
      if (!res.success) {
        pushToast({ kind: "error", title: "Error", message: res.message || "No se pudo actualizar el dia" });
        return;
      }
      setDay(res);
      pushToast({ kind: "success", title: "Actualizado", message: next ? "Dia abierto" : "Dia cerrado" });
    } finally {
      setBusy(false);
    }
  }, [api, date, day, pushToast]);

  const saveDailyLimit = useCallback(async () => {
    const n = Number(draftLimit);
    if (!Number.isFinite(n) || n < 0) {
      pushToast({ kind: "error", title: "Error", message: "Limite invalido" });
      return;
    }
    setBusy(true);
    try {
      const res = await api.config.setDailyLimit(date, n);
      if (!res.success) {
        pushToast({ kind: "error", title: "Error", message: res.message || "No se pudo guardar el limite" });
        return;
      }
      pushToast({ kind: "success", title: "Guardado", message: `Limite diario: ${n}` });
      void loadAll(date);
    } finally {
      setBusy(false);
    }
  }, [api, date, draftLimit, loadAll, pushToast]);

  const addHour = useCallback(() => {
    const h = hourToAdd;
    if (!h) return;
    const next = new Set(hours);
    next.add(h);
    const list = [...next].sort();
    setOpeningHours({ date, hours: list });
  }, [date, hourToAdd, hours]);

  const removeHour = useCallback(
    (h: string) => {
      const list = hours.filter((x) => x !== h);
      setOpeningHours({ date, hours: list });
    },
    [date, hours],
  );

  const saveHours = useCallback(async () => {
    setBusy(true);
    try {
      const res = await api.config.setOpeningHours(date, hours);
      if (!res.success) {
        pushToast({ kind: "error", title: "Error", message: res.message || "No se pudo guardar horarios" });
        return;
      }
      setOpeningHours(res);
      pushToast({ kind: "success", title: "Guardado", message: "Horarios actualizados" });
    } finally {
      setBusy(false);
    }
  }, [api, date, hours, pushToast]);

  const saveMesasDeDos = useCallback(async () => {
    setBusy(true);
    try {
      const res = await api.config.setMesasDeDos(date, mesasDraft);
      if (!res.success) {
        pushToast({ kind: "error", title: "Error", message: res.message || "No se pudo guardar" });
        return;
      }
      setMesasDeDos(res);
      pushToast({ kind: "success", title: "Guardado", message: "Limite mesas de 2 actualizado" });
    } finally {
      setBusy(false);
    }
  }, [api, date, mesasDraft, pushToast]);

  const toggleSalon = useCallback(async () => {
    if (!salon) return;
    setBusy(true);
    try {
      const next = !salon.state;
      const res = await api.config.setSalonCondesa(date, next);
      if (!res.success) {
        pushToast({ kind: "error", title: "Error", message: res.message || "No se pudo actualizar" });
        return;
      }
      setSalon(res);
      pushToast({ kind: "success", title: "Actualizado", message: next ? "Salon Condesa activado" : "Salon Condesa desactivado" });
    } finally {
      setBusy(false);
    }
  }, [api, date, pushToast, salon]);

  if (error) return <InlineAlert kind="error" title="Error" message={error} />;

  return (
    <section aria-label="Configuracion reservas">
      <div className="bo-toolbar">
        <div className="bo-toolbarLeft">
          <DatePicker value={date} onChange={onDateChange} />
          <button className="bo-btn bo-btn--ghost" type="button" onClick={() => void loadAll(date)} disabled={busy}>
            Recargar
          </button>
        </div>
        <div className="bo-toolbarRight">
          <div className="bo-mutedText">{busy ? "Actualizando..." : "Configuracion por fecha"}</div>
        </div>
      </div>

      <div className="bo-stack">
        <div className="bo-panel">
          <div className="bo-panelHead">
            <div className="bo-panelTitle">Estado del dia</div>
            <div className="bo-panelMeta">{day?.isOpen ? "Abierto" : "Cerrado"}</div>
          </div>
          <div className="bo-panelBody bo-row">
            <button className="bo-btn bo-btn--primary" type="button" onClick={toggleDay} disabled={busy || !day}>
              {day?.isOpen ? "Cerrar dia" : "Abrir dia"}
            </button>
          </div>
        </div>

        <div className="bo-panel">
          <div className="bo-panelHead">
            <div className="bo-panelTitle">Limite diario</div>
            <div className="bo-panelMeta">
              {dailyLimit ? `${dailyLimit.totalPeople}/${dailyLimit.limit} pax (libres: ${dailyLimit.freeBookingSeats})` : ""}
            </div>
          </div>
          <div className="bo-panelBody bo-row">
            <div className="bo-field bo-field--inline">
              <div className="bo-label">Aforo</div>
              <input className="bo-input bo-input--sm" value={draftLimit} onChange={(e) => setDraftLimit(e.target.value)} />
            </div>
            <button className="bo-btn bo-btn--primary" type="button" onClick={saveDailyLimit} disabled={busy}>
              Guardar
            </button>
          </div>
        </div>

        <div className="bo-panel">
          <div className="bo-panelHead">
            <div className="bo-panelTitle">Horarios (opening hours)</div>
            <div className="bo-panelMeta">{hours.length ? `${hours.length} slots` : "Sin datos"}</div>
          </div>
          <div className="bo-panelBody">
            <div className="bo-row">
              <Select
                value={hourToAdd}
                onChange={setHourToAdd}
                options={hoursOptions.map((h) => ({ value: h, label: h }))}
                size="sm"
                ariaLabel="Hora"
              />
              <button className="bo-btn bo-btn--ghost" type="button" onClick={addHour} disabled={busy}>
                Anadir
              </button>
              <button className="bo-btn bo-btn--primary" type="button" onClick={saveHours} disabled={busy}>
                Guardar horarios
              </button>
            </div>

            <div className="bo-chips" aria-label="Horas">
              {hours.map((h) => (
                <button key={h} className="bo-chip is-on" type="button" onClick={() => removeHour(h)} aria-label={`Eliminar ${h}`}>
                  {h} <span className="bo-chipX" aria-hidden="true">×</span>
                </button>
              ))}
              {!hours.length ? <div className="bo-mutedText">No hay horas configuradas para este dia.</div> : null}
            </div>
          </div>
        </div>

        <div className="bo-panel">
          <div className="bo-panelHead">
            <div className="bo-panelTitle">Mesas de dos (limite)</div>
            <div className="bo-panelMeta">{mesasDeDos?.limit ? `Actual: ${mesasDeDos.limit}` : ""}</div>
          </div>
          <div className="bo-panelBody bo-row">
            <Select value={mesasDraft} onChange={setMesasDraft} options={mesasOptions} size="sm" ariaLabel="Limite mesas de dos" />
            <button className="bo-btn bo-btn--primary" type="button" onClick={saveMesasDeDos} disabled={busy}>
              Guardar
            </button>
          </div>
        </div>

        <div className="bo-panel">
          <div className="bo-panelHead">
            <div className="bo-panelTitle">Salon Condesa</div>
            <div className="bo-panelMeta">{salon?.state ? "ON" : "OFF"}</div>
          </div>
          <div className="bo-panelBody bo-row">
            <button className="bo-btn bo-btn--primary" type="button" onClick={toggleSalon} disabled={busy || !salon}>
              {salon?.state ? "Desactivar" : "Activar"}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

