import React, { useCallback, useEffect, useMemo, useState } from "react";
import { usePageContext } from "vike-react/usePageContext";
import { Minus, Plus } from "lucide-react";

import { createClient } from "../../../api/client";
import type { ConfigDefaults, ConfigFloor, OpeningMode } from "../../../api/types";
import { Select } from "../../../ui/inputs/Select";
import { InlineAlert } from "../../../ui/feedback/InlineAlert";
import { useToasts } from "../../../ui/feedback/useToasts";
import { useErrorToast } from "../../../ui/feedback/useErrorToast";

type PageData = {
  defaults: ConfigDefaults | null;
  floors: ConfigFloor[];
  error: string | null;
};

type HourBlock = {
  id: string;
  label: string;
  hours: string[];
};

const morningBlocks: HourBlock[] = [
  { id: "m-08", label: "08:00 - 10:00", hours: ["08:00", "08:30", "09:00", "09:30"] },
  { id: "m-10", label: "10:00 - 12:00", hours: ["10:00", "10:30", "11:00", "11:30"] },
  { id: "m-12", label: "12:00 - 14:00", hours: ["12:00", "12:30", "13:00", "13:30"] },
  { id: "m-14", label: "14:00 - 16:00", hours: ["14:00", "14:30", "15:00", "15:30"] },
  { id: "m-16", label: "16:00 - 17:00", hours: ["16:00", "16:30"] },
];

const nightBlocks: HourBlock[] = [
  { id: "n-1730", label: "17:30 - 19:30", hours: ["17:30", "18:00", "18:30", "19:00"] },
  { id: "n-1930", label: "19:30 - 21:30", hours: ["19:30", "20:00", "20:30", "21:00"] },
  { id: "n-2130", label: "21:30 - 23:30", hours: ["21:30", "22:00", "22:30", "23:00"] },
  { id: "n-2330", label: "23:30 - 01:00", hours: ["23:30", "00:00", "00:30"] },
];

const openingModeOptions = [
  { value: "both", label: "Mañana + Noche" },
  { value: "morning", label: "Solo mañana" },
  { value: "night", label: "Solo noche" },
] as const;

function toggleBlock(current: string[], block: HourBlock): string[] {
  const set = new Set(current);
  const isOn = block.hours.every((h) => set.has(h));
  for (const h of block.hours) {
    if (isOn) set.delete(h);
    else set.add(h);
  }
  return [...set];
}

function blockIsOn(current: string[], block: HourBlock): boolean {
  const set = new Set(current);
  return block.hours.every((h) => set.has(h));
}

export default function Page() {
  const pageContext = usePageContext();
  const data = pageContext.data as PageData;
  const api = useMemo(() => createClient({ baseUrl: "" }), []);
  const { pushToast } = useToasts();

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(data.error);
  const [defaults, setDefaults] = useState<ConfigDefaults | null>(data.defaults);
  const [floors, setFloors] = useState<ConfigFloor[]>(data.floors || []);
  const [dailyLimitDraft, setDailyLimitDraft] = useState(String(data.defaults?.dailyLimit ?? 45));
  useErrorToast(error);

  useEffect(() => {
    if (!defaults) return;
    setDailyLimitDraft(String(defaults.dailyLimit));
  }, [defaults?.dailyLimit]); // eslint-disable-line react-hooks/exhaustive-deps

  const mesasOptions = useMemo(() => {
    const out = [{ value: "999", label: "Sin límite" }];
    for (let i = 0; i <= 40; i++) out.push({ value: String(i), label: String(i) });
    return out;
  }, []);

  const saveDefaults = useCallback(
    async (
      patch: Partial<{
        openingMode: OpeningMode;
        morningHours: string[];
        nightHours: string[];
        dailyLimit: number;
        mesasDeDosLimit: string;
        mesasDeTresLimit: string;
      }>,
      successMessage?: string,
    ) => {
      setBusy(true);
      setError(null);
      try {
        const res = await api.config.setDefaults(patch);
        if (!res.success) {
          setError(res.message || "No se pudo guardar");
          return;
        }
        setDefaults(res);
        if (successMessage) pushToast({ kind: "success", title: "Actualizado", message: successMessage });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "No se pudo guardar";
        setError(msg);
      } finally {
        setBusy(false);
      }
    },
    [api.config, pushToast],
  );

  const reload = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const [d0, d1] = await Promise.all([api.config.getDefaults(), api.config.getDefaultFloors()]);
      if (!d0.success) throw new Error(d0.message || "Error cargando defaults");
      if (!d1.success) throw new Error(d1.message || "Error cargando plantas");
      setDefaults(d0);
      setFloors(d1.floors || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error cargando configuración");
    } finally {
      setBusy(false);
    }
  }, [api.config]);

  const updateOpeningMode = useCallback(
    (mode: string) => {
      void saveDefaults({ openingMode: (mode as OpeningMode) || "both" });
    },
    [saveDefaults],
  );

  const toggleMorningBlock = useCallback(
    (block: HourBlock) => {
      if (!defaults) return;
      const next = toggleBlock(defaults.morningHours || [], block);
      void saveDefaults({ morningHours: next });
    },
    [defaults, saveDefaults],
  );

  const toggleNightBlock = useCallback(
    (block: HourBlock) => {
      if (!defaults) return;
      const next = toggleBlock(defaults.nightHours || [], block);
      void saveDefaults({ nightHours: next });
    },
    [defaults, saveDefaults],
  );

  const saveDailyLimit = useCallback(() => {
    const n = Number(dailyLimitDraft);
    if (!Number.isFinite(n) || n < 0 || n > 500) {
      pushToast({ kind: "error", title: "Error", message: "Límite diario inválido" });
      return;
    }
    void saveDefaults({ dailyLimit: Math.trunc(n) }, "Límite diario actualizado");
  }, [dailyLimitDraft, pushToast, saveDefaults]);

  const saveFloorsCount = useCallback(
    async (count: number) => {
      setBusy(true);
      setError(null);
      try {
        const res = await api.config.setDefaultFloors({ count });
        if (!res.success) {
          setError(res.message || "No se pudo actualizar plantas");
          return;
        }
        setFloors(res.floors || []);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "No se pudo actualizar plantas";
        setError(msg);
      } finally {
        setBusy(false);
      }
    },
    [api.config, pushToast],
  );

  const toggleFloorDefault = useCallback(
    async (floor: ConfigFloor) => {
      if (floor.isGround) return;
      setBusy(true);
      setError(null);
      try {
        const res = await api.config.setDefaultFloors({ floorNumber: floor.floorNumber, active: !floor.active });
        if (!res.success) {
          setError(res.message || "No se pudo actualizar la planta");
          return;
        }
        setFloors(res.floors || []);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "No se pudo actualizar la planta";
        setError(msg);
      } finally {
        setBusy(false);
      }
    },
    [api.config, pushToast],
  );

  if (!defaults) return <InlineAlert kind="info" title="Cargando" message="Preparando configuración..." />;

  const floorCount = floors.length || 1;
  const canGrow = floorCount < 8;
  const canShrink = floorCount > 1;

  return (
    <section aria-label="Configuración por defecto">
      <div className="bo-toolbar">
        <div className="bo-toolbarLeft">
          <button className="bo-btn bo-btn--ghost" type="button" onClick={() => void reload()} disabled={busy}>
            Recargar
          </button>
        </div>
        <div className="bo-toolbarRight">
          <div className="bo-mutedText">{busy ? "Actualizando..." : "Valores por defecto"}</div>
        </div>
      </div>

      <div className="bo-stack">
        <div className="bo-panel">
          <div className="bo-panelHead">
            <div className="bo-panelTitle">Modo de apertura</div>
            <div className="bo-panelMeta">{defaults.openingMode === "both" ? "Mañana + noche" : defaults.openingMode === "morning" ? "Mañana" : "Noche"}</div>
          </div>
          <div className="bo-panelBody bo-row">
            <Select
              value={defaults.openingMode}
              onChange={updateOpeningMode}
              options={openingModeOptions as any}
              size="sm"
              ariaLabel="Modo de apertura por defecto"
            />
          </div>
        </div>

        <div className="bo-panel">
          <div className="bo-panelHead">
            <div className="bo-panelTitle">Horarios por defecto</div>
            <div className="bo-panelMeta">Selección inmediata</div>
          </div>
          <div className="bo-panelBody" style={{ display: "grid", gap: 14 }}>
            <div className="bo-field">
              <div className="bo-label">Mañana (08:00 - 17:00)</div>
              <div className="bo-hourCards">
                {morningBlocks.map((block) => {
                  const on = blockIsOn(defaults.morningHours || [], block);
                  return (
                    <button
                      key={block.id}
                      type="button"
                      className={`bo-hourCard${on ? " is-on" : ""}`}
                      onClick={() => toggleMorningBlock(block)}
                      disabled={busy}
                    >
                      {block.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="bo-field">
              <div className="bo-label">Noche (17:30 - 01:00)</div>
              <div className="bo-hourCards">
                {nightBlocks.map((block) => {
                  const on = blockIsOn(defaults.nightHours || [], block);
                  return (
                    <button
                      key={block.id}
                      type="button"
                      className={`bo-hourCard${on ? " is-on" : ""}`}
                      onClick={() => toggleNightBlock(block)}
                      disabled={busy}
                    >
                      {block.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="bo-panel">
          <div className="bo-panelHead">
            <div className="bo-panelTitle">Límites por defecto</div>
            <div className="bo-panelMeta">Aplican si no hay override diario</div>
          </div>
          <div className="bo-panelBody bo-row">
            <div className="bo-field bo-field--inline">
              <div className="bo-label">Límite diario</div>
              <input
                className="bo-input bo-input--sm"
                style={{ width: 100 }}
                value={dailyLimitDraft}
                inputMode="numeric"
                onChange={(e) => setDailyLimitDraft(e.target.value)}
                onBlur={saveDailyLimit}
              />
            </div>

            <div className="bo-field bo-field--inline">
              <div className="bo-label">Mesas de 2</div>
              <Select
                value={defaults.mesasDeDosLimit || "999"}
                onChange={(v) => void saveDefaults({ mesasDeDosLimit: v })}
                options={mesasOptions}
                size="sm"
                ariaLabel="Mesas de 2 por defecto"
              />
            </div>

            <div className="bo-field bo-field--inline">
              <div className="bo-label">Mesas de 3</div>
              <Select
                value={defaults.mesasDeTresLimit || "999"}
                onChange={(v) => void saveDefaults({ mesasDeTresLimit: v })}
                options={mesasOptions}
                size="sm"
                ariaLabel="Mesas de 3 por defecto"
              />
            </div>
          </div>
        </div>

        <div className="bo-panel">
          <div className="bo-panelHead">
            <div className="bo-panelTitle">Plantas del restaurante</div>
            <div className="bo-panelMeta">{floorCount} plantas</div>
          </div>
          <div className="bo-panelBody" style={{ display: "grid", gap: 12 }}>
            <div className="bo-row">
              <button
                className="bo-actionBtn"
                type="button"
                onClick={() => {
                  if (!canShrink) return;
                  void saveFloorsCount(floorCount - 1);
                }}
                disabled={busy || !canShrink}
                aria-label="Quitar planta"
              >
                <Minus size={18} strokeWidth={1.8} />
              </button>
              <div className="bo-mutedText">Total plantas: {floorCount}</div>
              <button
                className="bo-actionBtn"
                type="button"
                onClick={() => {
                  if (!canGrow) return;
                  void saveFloorsCount(floorCount + 1);
                }}
                disabled={busy || !canGrow}
                aria-label="Añadir planta"
              >
                <Plus size={18} strokeWidth={1.8} />
              </button>
            </div>

            <div className="bo-hourCards bo-hourCards--floors">
              {floors.map((floor) => (
                <button
                  key={floor.id}
                  type="button"
                  className={`bo-hourCard bo-floorCard${floor.active ? " is-on" : ""}${floor.isGround ? " is-ground" : ""}`}
                  disabled={busy || floor.isGround}
                  onClick={() => void toggleFloorDefault(floor)}
                >
                  {floor.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
