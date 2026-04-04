import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePageContext } from "vike-react/usePageContext";
import { Building2, LayoutGrid, Phone, UtensilsCrossed } from "lucide-react";

import { createClient } from "../../../api/client";
import type { ConfigDefaults, ConfigFloor, OpeningMode, RestaurantInfo, WeekdayOpen } from "../../../api/types";
import { InlineAlert } from "../../../ui/feedback/InlineAlert";
import { useErrorToast } from "../../../ui/feedback/useErrorToast";
import { useToasts } from "../../../ui/feedback/useToasts";
import { Select } from "../../../ui/inputs/Select";
import { Switch } from "../../../ui/shadcn/Switch";
import { PlusMinusCounter } from "../../../ui/widgets/PlusMinusCounter";
import { Tabs, type TabItem } from "../../../ui/nav/Tabs";

type PageData = {
  defaults: ConfigDefaults | null;
  floors: ConfigFloor[];
  restaurantInfo: RestaurantInfo | null;
  error: string | null;
};

type ContentTab = "restaurante" | "contacto";

// ─── Hour/slot helpers (shared) ───────────────────────────────────────────────

type HourSlot = {
  id: string;
  value: string;
  label: string;
};

type FloorTab = "plantas" | "salones";

type WeekdayCard = {
  key: keyof WeekdayOpen;
  label: string;
  shortLabel: string;
};

const openingModeOptions = [
  { value: "both", label: "Mañana + Noche" },
  { value: "morning", label: "Solo mañana" },
  { value: "night", label: "Solo noche" },
] as const;

const weekdayCards: WeekdayCard[] = [
  { key: "monday", label: "Lunes", shortLabel: "L" },
  { key: "tuesday", label: "Martes", shortLabel: "M" },
  { key: "wednesday", label: "Miércoles", shortLabel: "X" },
  { key: "thursday", label: "Jueves", shortLabel: "J" },
  { key: "friday", label: "Viernes", shortLabel: "V" },
  { key: "saturday", label: "Sábado", shortLabel: "S" },
  { key: "sunday", label: "Domingo", shortLabel: "D" },
];

const tableLimitValues = [...Array.from({ length: 41 }, (_, i) => String(i)), "999"];

function normalizeToHHMM(totalMinutes: number): string {
  const day = 24 * 60;
  const normalized = ((totalMinutes % day) + day) % day;
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function buildHalfHourSlots(startMinutes: number, endMinutes: number, prefix: string): HourSlot[] {
  const out: HourSlot[] = [];
  const target = endMinutes < startMinutes ? endMinutes + 24 * 60 : endMinutes;
  for (let cursor = startMinutes; cursor <= target; cursor += 30) {
    const value = normalizeToHHMM(cursor);
    out.push({
      id: `${prefix}-${value.replace(":", "")}`,
      value,
      label: value,
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

function defaultWeekdayOpen(): WeekdayOpen {
  return {
    monday: false,
    tuesday: false,
    wednesday: false,
    thursday: true,
    friday: true,
    saturday: true,
    sunday: true,
  };
}

function parseWeekdayFlag(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true" || normalized === "1" || normalized === "open" || normalized === "abierto") return true;
    if (normalized === "false" || normalized === "0" || normalized === "closed" || normalized === "cerrado") return false;
  }
  return null;
}

function normalizeWeekdayOpenMap(input: unknown): WeekdayOpen {
  const fallback = defaultWeekdayOpen();
  if (!input || typeof input !== "object") return fallback;

  const sourceRaw = input as Record<string, unknown>;
  const source: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(sourceRaw)) {
    source[key.toLowerCase()] = value;
  }

  const aliases: Record<keyof WeekdayOpen, string[]> = {
    monday: ["monday", "lunes", "1"],
    tuesday: ["tuesday", "martes", "2"],
    wednesday: ["wednesday", "miércoles", "miercoles", "3"],
    thursday: ["thursday", "jueves", "4"],
    friday: ["friday", "viernes", "5"],
    saturday: ["saturday", "sábado", "sabado", "6"],
    sunday: ["sunday", "domingo", "0", "7"],
  };

  const out = { ...fallback };

  (Object.keys(aliases) as (keyof WeekdayOpen)[]).forEach((weekday) => {
    for (const alias of aliases[weekday]) {
      if (!(alias in source)) continue;
      const parsed = parseWeekdayFlag(source[alias]);
      if (parsed !== null) {
        out[weekday] = parsed;
        break;
      }
    }
  });

  return out;
}

function normalizeTableLimit(value: string | null | undefined): string {
  if (value === "999") return "999";
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return "999";
  const clamped = Math.max(0, Math.min(40, Math.trunc(parsed)));
  return String(clamped);
}

function stepTableLimit(current: string, direction: -1 | 1): string {
  const currentValue = normalizeTableLimit(current);
  const currentIndex = tableLimitValues.indexOf(currentValue);
  const safeIndex = currentIndex === -1 ? tableLimitValues.indexOf("999") : currentIndex;
  const nextIndex = Math.max(0, Math.min(tableLimitValues.length - 1, safeIndex + direction));
  return tableLimitValues[nextIndex] || currentValue;
}

function formatTableLimit(value: string): string {
  const normalized = normalizeTableLimit(value);
  return normalized === "999" ? "Sin límite" : normalized;
}

function readAPIMessage(result: unknown, fallback: string): string {
  if (!result || typeof result !== "object") return fallback;
  if (!("message" in result)) return fallback;
  const message = (result as { message?: unknown }).message;
  if (typeof message !== "string") return fallback;
  const trimmed = message.trim();
  return trimmed || fallback;
}

// ─── Restaurante content ─────────────────────────────────────────────────────

type RestauranteContentProps = {
  defaults: ConfigDefaults;
  floors: ConfigFloor[];
  busy: boolean;
  setBusy: (v: boolean) => void;
  setError: (v: string | null) => void;
  api: ReturnType<typeof createClient>;
  pushToast: (t: { kind: "success"; title: string; message: string }) => void;
};

function ConfigRestauranteContent({ defaults, floors, busy, setBusy, setError, api, pushToast }: RestauranteContentProps) {
  const morningSlots = useMemo(() => buildHalfHourSlots(8 * 60, 17 * 60, "m"), []);
  const nightSlots = useMemo(() => buildHalfHourSlots(17 * 60 + 30, 1 * 60, "n"), []);
  const floorTabFromQuery =
    typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("floortab") : null;
  const [floorTab, setFloorTab] = useState<FloorTab>(floorTabFromQuery === "salones" ? "salones" : "plantas");

  const floorTabs = useMemo<TabItem[]>(
    () => [
      { id: "plantas", label: "Plantas", href: "/app/config?floortab=plantas", icon: <Building2 className="bo-ico" /> },
      { id: "salones", label: "Salones", href: "/app/config?floortab=salones", icon: <LayoutGrid className="bo-ico" /> },
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
      }>,
      successMessage?: string,
    ) => {
      setBusy(true);
      setError(null);
      try {
        const res = await api.config.setDefaults(patch);
        if (!res.success) {
          setError(readAPIMessage(res, "No se pudo guardar"));
          return;
        }
        if (successMessage) {
          pushToast({ kind: "success", title: "Actualizado", message: successMessage });
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo guardar");
      } finally {
        setBusy(false);
      }
    },
    [api.config, setBusy, setError, pushToast],
  );

  const saveFloorsCount = useCallback(
    async (count: number) => {
      setBusy(true);
      setError(null);
      try {
        const res = await api.config.setDefaultFloors({ count });
        if (!res.success) {
          setError(readAPIMessage(res, "No se pudo actualizar plantas"));
          return;
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo actualizar plantas");
      } finally {
        setBusy(false);
      }
    },
    [api.config, setBusy, setError],
  );

  const toggleFloorDefault = useCallback(
    async (floor: ConfigFloor, explicitValue?: boolean) => {
      const nextActive = typeof explicitValue === "boolean" ? explicitValue : !floor.active;
      setBusy(true);
      setError(null);
      try {
        const res = await api.config.setDefaultFloors({ floorNumber: floor.floorNumber, active: nextActive });
        if (!res.success) {
          setError(readAPIMessage(res, "No se pudo actualizar la planta"));
          return;
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo actualizar la planta");
      } finally {
        setBusy(false);
      }
    },
    [api.config, setBusy, setError],
  );

  const weekdayOpen = useMemo(() => normalizeWeekdayOpenMap(defaults.weekdayOpen), [defaults.weekdayOpen]);
  const floorCount = useMemo(() => floors.length || 1, [floors.length]);
  const canGrow = useMemo(() => floorCount < 8, [floorCount]);
  const canShrink = useMemo(() => floorCount > 1, [floorCount]);
  const mesasDeDosValue = useMemo(() => normalizeTableLimit(defaults.mesasDeDosLimit), [defaults.mesasDeDosLimit]);
  const mesasDeTresValue = useMemo(() => normalizeTableLimit(defaults.mesasDeTresLimit), [defaults.mesasDeTresLimit]);

  const morningHourCards = useMemo(() => {
    const active = new Set(defaults.morningHours || []);
    return morningSlots.map((slot) => ({ ...slot, active: active.has(slot.value) }));
  }, [defaults.morningHours, morningSlots]);

  const nightHourCards = useMemo(() => {
    const active = new Set(defaults.nightHours || []);
    return nightSlots.map((slot) => ({ ...slot, active: active.has(slot.value) }));
  }, [defaults.nightHours, nightSlots]);

  const weekdayCardsWithState = useMemo(
    () => weekdayCards.map((weekday) => ({ ...weekday, isOpen: Boolean(weekdayOpen[weekday.key]) })),
    [weekdayOpen],
  );

  const floorCards = useMemo(
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
      <div className="bo-panel">
        <div className="bo-panelHead">
          <div className="bo-panelTitle">Modo de apertura</div>
          <div className="bo-panelMeta">{openingModeLabel}</div>
        </div>
        <div className="bo-panelBody bo-row">
          <Select
            value={defaults.openingMode}
            onChange={(mode) => void saveDefaults({ openingMode: (mode as OpeningMode) || "both" })}
            options={openingModeOptions as any}
            size="sm"
            ariaLabel="Modo de apertura por defecto"
          />
        </div>
      </div>

      <div className="bo-panel">
        <div className="bo-panelHead">
          <div className="bo-panelTitle">Horarios por defecto</div>
          <div className="bo-panelMeta">Slots de media hora con guardado inmediato</div>
        </div>
        <div className="bo-panelBody bo-hourCardsContainer">
          <div className="bo-field">
            <div className="bo-label">Mañana (08:00 - 17:00)</div>
            <div className="bo-hourCards bo-hourCards--slots">
              {morningHourCards.map((slot) => (
                <button
                  key={slot.id}
                  type="button"
                  className={`bo-hourCard bo-hourCard--slot${slot.active ? " is-on" : ""}`}
                  onClick={() => void handleMorningHour(slot.value)}
                  disabled={busy}
                >
                  {slot.label}
                </button>
              ))}
            </div>
          </div>

          <div className="bo-field">
            <div className="bo-label">Noche (17:30 - 01:00)</div>
            <div className="bo-hourCards bo-hourCards--slots">
              {nightHourCards.map((slot) => (
                <button
                  key={slot.id}
                  type="button"
                  className={`bo-hourCard bo-hourCard--slot${slot.active ? " is-on" : ""}`}
                  onClick={() => void handleNightHour(slot.value)}
                  disabled={busy}
                >
                  {slot.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="bo-panel">
        <div className="bo-panelHead">
          <div className="bo-panelTitle">Calendario semanal</div>
          <div className="bo-panelMeta">Semana genérica (lunes a domingo)</div>
        </div>
        <div className="bo-panelBody bo-configWeekdayGrid">
          {weekdayCardsWithState.map((weekday) => (
            <button
              key={weekday.key}
              type="button"
              className={`bo-hourCard bo-configDayCard${weekday.isOpen ? " is-on" : ""}`}
              disabled={busy}
              aria-pressed={weekday.isOpen}
              aria-label={`${weekday.label} (${weekday.isOpen ? "abierto" : "cerrado"})`}
              onClick={() => void toggleWeekdayOpen(weekday.key)}
            >
              <div className="bo-configDayCardLabel">
                <span className="bo-configDayCardLabelFull">{weekday.label}</span>
                <span className="bo-configDayCardLabelShort" aria-hidden="true">
                  {weekday.shortLabel}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="bo-panel">
        <div className="bo-panelHead">
          <div className="bo-panelTitle">Límites por defecto</div>
          <div className="bo-panelMeta">Autosave inmediato</div>
        </div>
        <div className="bo-panelBody bo-configLimitGrid">
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
            helperText="0-40 o Sin límite"
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
            helperText="0-40 o Sin límite"
            decrementAriaLabel="Reducir mesas de 3"
            incrementAriaLabel="Aumentar mesas de 3"
          />
        </div>
      </div>

      <div className="bo-panel">
        <div className="bo-panelHead">
          <div className="bo-panelTitle">Plantas del restaurante</div>
          <div className="bo-panelMeta">{floorCount} plantas</div>
        </div>
        <div className="bo-panelBody bo-configFloorsPanel">
          <Tabs
            tabs={floorTabs}
            activeId={floorTab}
            ariaLabel="Secciones de plantas"
            className="bo-tabs--reservas bo-configFloorTabs mx-auto"
            onNavigate={onNavigateFloorTab}
          />

          {floorTab === "plantas" ? (
            <div id="config-floors-panel" role="tabpanel" aria-label="Plantas" className="bo-configFloorsPanelContent">
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

              <div className="bo-configSalonCards" aria-label="Plantas del restaurante">
                {floorCards.map((floor) => (
                  <div key={`planta-${floor.keyPrefix}`} className="bo-floorSalonCard">
                    <div>
                      <div className="bo-floorCardName">{floor.plantaLabel}</div>
                      <div className="bo-floorCardHint">{floor.defaultLabel}</div>
                    </div>

                    <div className="bo-floorSalonCardState">
                      <span className="bo-floorSalonCardStatus">{floor.statusLabel}</span>
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
            <div id="config-salons-panel" role="tabpanel" aria-label="Salones" className="bo-configSalonCards">
              {floorCards.map((floor) => (
                <div key={`salon-${floor.keyPrefix}`} className="bo-floorSalonCard">
                  <div>
                    <div className="bo-floorCardName">{floor.salonLabel}</div>
                    <div className="bo-floorCardHint">{floor.defaultLabel}</div>
                  </div>

                  <div className="bo-floorSalonCardState">
                    <span className="bo-floorSalonCardStatus">{floor.statusLabel}</span>
                    <Switch
                      checked={floor.floor.active}
                      disabled={busy}
                      onCheckedChange={(checked) => {
                        void toggleFloorDefault(floor.floor, checked);
                      }}
                      aria-label={`Estado por defecto de ${floor.salonLabel}`}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ─── Contacto content ─────────────────────────────────────────────────────────

type ContactoContentProps = {
  initialInfo: RestaurantInfo;
  busy: boolean;
  setBusy: (v: boolean) => void;
  setError: (v: string | null) => void;
  api: ReturnType<typeof createClient>;
  pushToast: (t: { kind: "success"; title: string; message: string }) => void;
};

const clasificacionOptions = [
  { value: "sociedad", label: "Sociedad" },
  { value: "persona_fisica", label: "Persona física" },
];

const DEBOUNCE_MS = 400;

function ConfigContactoContent({ initialInfo, busy, setBusy, setError, api, pushToast }: ContactoContentProps) {
  const [info, setInfo] = useState<RestaurantInfo>(initialInfo);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstRender = useRef(true);

  // Sync when initialInfo changes (e.g. after page reload)
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    setInfo(initialInfo);
  }, [initialInfo]);

  const save = useCallback(
    async (patch: Partial<RestaurantInfo>) => {
      setError(null);
      try {
        const res = await api.config.setRestaurantInfo(patch);
        if (!res.success) {
          setError(readAPIMessage(res, "No se pudo guardar"));
          return;
        }
        setInfo(res.restaurantInfo);
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo guardar");
      } finally {
        setBusy(false);
      }
    },
    [api.config, setError, setBusy],
  );

  const scheduleDebouncedSave = useCallback(
    (patch: Partial<RestaurantInfo>) => {
      setBusy(true);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        void save(patch);
        pushToast({ kind: "success", title: "Guardado", message: "Cambios guardados" });
      }, DEBOUNCE_MS);
    },
    [save, pushToast],
  );

  const handleField = useCallback(
    (field: keyof RestaurantInfo, value: string) => {
      const patch = { [field]: value } as Partial<RestaurantInfo>;
      setInfo((prev) => ({ ...prev, [field]: value }));
      scheduleDebouncedSave(patch);
    },
    [scheduleDebouncedSave],
  );

  const handleClasificacion = useCallback(
    (value: string) => {
      const patch = { clasificacion: value as "persona_fisica" | "sociedad" };
      setInfo((prev) => ({ ...prev, clasificacion: value as "persona_fisica" | "sociedad" }));
      scheduleDebouncedSave(patch);
    },
    [scheduleDebouncedSave],
  );

  return (
    <>
      <div className="bo-panel">
        <div className="bo-panelHead">
          <div className="bo-panelTitle">Contacto</div>
        </div>
        <div className="bo-panelBody bo-stack">
          <div className="bo-field">
            <label className="bo-label" htmlFor="config-contacto-direccion">
              Dirección
            </label>
            <input
              id="config-contacto-direccion"
              type="text"
              className="bo-input"
              value={info.direccion}
              onChange={(e) => handleField("direccion", e.target.value)}
              disabled={busy}
              placeholder="Calle, número, CP, ciudad..."
              aria-label="Dirección del restaurante"
            />
          </div>

          <div className="bo-field">
            <label className="bo-label" htmlFor="config-contacto-telefono">
              Teléfono
            </label>
            <input
              id="config-contacto-telefono"
              type="tel"
              className="bo-input"
              value={info.telefono}
              onChange={(e) => handleField("telefono", e.target.value)}
              disabled={busy}
              placeholder="+34 600 000 000"
              aria-label="Teléfono de contacto"
            />
          </div>

          <div className="bo-field">
            <label className="bo-label" htmlFor="config-contacto-email">
              Email
            </label>
            <input
              id="config-contacto-email"
              type="email"
              className="bo-input"
              value={info.email}
              onChange={(e) => handleField("email", e.target.value)}
              disabled={busy}
              placeholder="info@restaurante.com"
              aria-label="Email de contacto"
            />
          </div>
        </div>
      </div>

      <div className="bo-panel">
        <div className="bo-panelHead">
          <div className="bo-panelTitle">Información fiscal</div>
          <div className="bo-panelMeta">Datos para facturación</div>
        </div>
        <div className="bo-panelBody bo-stack">
          <div className="bo-field">
            <label className="bo-label" htmlFor="config-contacto-cif">
              CIF / NIF
            </label>
            <input
              id="config-contacto-cif"
              type="text"
              className="bo-input"
              value={info.cif}
              onChange={(e) => handleField("cif", e.target.value)}
              disabled={busy}
              placeholder="B12345678"
              aria-label="CIF o NIF del restaurante"
            />
          </div>

          <div className="bo-field">
            <label className="bo-label" htmlFor="config-contacto-dir-fact">
              Dirección de facturación
            </label>
            <input
              id="config-contacto-dir-fact"
              type="text"
              className="bo-input"
              value={info.direccionFacturacion}
              onChange={(e) => handleField("direccionFacturacion", e.target.value)}
              disabled={busy}
              placeholder="Calle de facturación, número, CP, ciudad..."
              aria-label="Dirección de facturación"
            />
          </div>

          <div className="bo-field">
            <div className="bo-label">Clasificación</div>
            <Select
              value={info.clasificacion}
              onChange={handleClasificacion}
              options={clasificacionOptions}
              size="sm"
              disabled={busy}
              ariaLabel="Clasificación fiscal"
            />
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Page() {
  const pageContext = usePageContext();
  const data = pageContext.data as PageData;
  const api = useMemo(() => createClient({ baseUrl: "" }), []);
  const { pushToast } = useToasts();

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(data.error);
  const [defaults, setDefaults] = useState<ConfigDefaults | null>(data.defaults);
  const [floors, setFloors] = useState<ConfigFloor[]>(data.floors || []);
  const [restaurantInfo, setRestaurantInfo] = useState<RestaurantInfo | null>(
    data.restaurantInfo ?? {
      direccion: "",
      telefono: "",
      email: "",
      cif: "",
      direccionFacturacion: "",
      clasificacion: "sociedad",
    },
  );

  const contentTabFromQuery =
    typeof window !== "undefined"
      ? (new URLSearchParams(window.location.search).get("content") as ContentTab | null)
      : null;
  const [contentTab, setContentTab] = useState<ContentTab>(contentTabFromQuery ?? "restaurante");

  const contentTabs = useMemo<TabItem[]>(
    () => [
      {
        id: "restaurante",
        label: "Restaurante",
        href: "/app/config",
        icon: <UtensilsCrossed className="bo-ico" />,
      },
      {
        id: "contacto",
        label: "Contacto",
        href: "/app/config",
        icon: <Phone className="bo-ico" />,
      },
    ],
    [],
  );

  useErrorToast(error);

  const reload = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const [defaultsRes, floorsRes, infoRes] = await Promise.all([
        api.config.getDefaults(),
        api.config.getDefaultFloors(),
        api.config.getRestaurantInfo(),
      ]);

      if (!defaultsRes.success) {
        setError(readAPIMessage(defaultsRes, "Error cargando configuración por defecto"));
        return;
      }
      if (!floorsRes.success) {
        setError(readAPIMessage(floorsRes, "Error cargando plantas"));
        return;
      }

      setDefaults(defaultsRes);
      setFloors(floorsRes.floors || []);
      if (infoRes.success) {
        setRestaurantInfo(infoRes.restaurantInfo);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error cargando configuración");
    } finally {
      setBusy(false);
    }
  }, [api.config]);

  const onNavigateContentTab = useCallback(
    (_href: string, id: string, event: React.MouseEvent<HTMLAnchorElement>) => {
      void _href;
      event.preventDefault();
      setContentTab(id as ContentTab);
    },
    [],
  );

  if (!defaults) {
    return <InlineAlert kind="info" title="Cargando" message="Preparando configuración..." />;
  }

  return (
    <section aria-label="Configuración" className="max-w-3xl mx-auto">
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

      <Tabs
        tabs={contentTabs}
        activeId={contentTab}
        ariaLabel="Secciones de configuración"
        className="bo-tabs--reservas mx-auto mb-6"
        onNavigate={onNavigateContentTab}
      />

      <div className="bo-stack">
        {contentTab === "restaurante" ? (
          <ConfigRestauranteContent
            defaults={defaults}
            floors={floors}
            busy={busy}
            setBusy={setBusy}
            setError={setError}
            api={api}
            pushToast={pushToast}
          />
        ) : (
          <ConfigContactoContent
            initialInfo={
              restaurantInfo ?? {
                direccion: "",
                telefono: "",
                email: "",
                cif: "",
                direccionFacturacion: "",
                clasificacion: "sociedad",
              }
            }
            busy={busy}
            setBusy={setBusy}
            setError={setError}
            api={api}
            pushToast={pushToast}
          />
        )}
      </div>
    </section>
  );
}
