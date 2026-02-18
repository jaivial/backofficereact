import React, { useCallback, useEffect, useMemo, useState } from "react";
import { usePageContext } from "vike-react/usePageContext";
import { Minus, Plus, Bell, BellOff, Mail, MessageSquare, Clock, Calendar, RefreshCw, Trash2, Play, Pause, X, List, PlusCircle } from "lucide-react";

import { createClient } from "../../../api/client";
import type {
  ConfigDefaults,
  ConfigFloor,
  OpeningMode,
  ReminderSettings,
  ReminderTemplate,
  ScheduledReminder,
  ScheduledReminderInput,
  ScheduledReminderFrequency,
  ScheduledReminderStatus,
  AutoReminderRule,
  AutoReminderRuleInput,
} from "../../../api/types";
import { Select } from "../../../ui/inputs/Select";
import { TextInput } from "../../../ui/inputs/TextInput";
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

  // Reminder settings state
  const [reminderSettings, setReminderSettings] = useState<ReminderSettings | null>(null);
  const [reminderTemplates, setReminderTemplates] = useState<ReminderTemplate[]>([]);
  const [loadingReminderSettings, setLoadingReminderSettings] = useState(true);

  // Scheduled reminders state
  const [scheduledReminders, setScheduledReminders] = useState<ScheduledReminder[]>([]);
  const [loadingScheduledReminders, setLoadingScheduledReminders] = useState(false);
  const [showScheduledReminderForm, setShowScheduledReminderForm] = useState(false);
  const [editingScheduledReminder, setEditingScheduledReminder] = useState<ScheduledReminder | null>(null);
  const [scheduledReminderFilter, setScheduledReminderFilter] = useState<string>("pending");

  // Auto-reminder rules state
  const [autoReminderRules, setAutoReminderRules] = useState<AutoReminderRule[]>([]);
  const [loadingAutoReminderRules, setLoadingAutoReminderRules] = useState(false);
  const [showAutoRuleForm, setShowAutoRuleForm] = useState(false);
  const [editingAutoRule, setEditingAutoRule] = useState<AutoReminderRule | null>(null);

  // Form state for new scheduled reminder
  const [newScheduledReminder, setNewScheduledReminder] = useState<ScheduledReminderInput>({
    invoice_id: 0,
    template_id: null,
    scheduled_date: "",
    scheduled_time: "09:00",
    frequency: "once",
    send_via: "email",
    custom_message: "",
    max_recurrences: null,
  });

  // Form state for new auto-reminder rule
  const [newAutoRule, setNewAutoRule] = useState<AutoReminderRuleInput>({
    name: "",
    description: "",
    is_active: true,
    trigger_type: "overdue",
    trigger_days: 7,
    trigger_date: null,
    template_id: null,
    send_via: "email",
    send_time: "09:00",
    frequency: "once",
    max_recurrences: null,
    invoice_status_filter: null,
    invoice_category_filter: null,
    exclude_invoice_ids: null,
  });

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
    setLoadingReminderSettings(true);
    setLoadingScheduledReminders(true);
    setLoadingAutoReminderRules(true);
    try {
      const [d0, d1, rSettings, rTemplates, sReminders, aRules] = await Promise.all([
        api.config.getDefaults(),
        api.config.getDefaultFloors(),
        api.reminderSettings.get(),
        api.reminderTemplates.list(),
        api.scheduledReminders.list({ status: "pending" }),
        api.autoReminderRules.list(),
      ]);
      if (!d0.success) throw new Error(d0.message || "Error cargando defaults");
      if (!d1.success) throw new Error(d1.message || "Error cargando plantas");
      setDefaults(d0);
      setFloors(d1.floors || []);
      if (rSettings.success) {
        setReminderSettings(rSettings.settings || null);
      }
      if (rTemplates.success) {
        setReminderTemplates(rTemplates.templates || []);
      }
      if (sReminders.success) {
        setScheduledReminders(sReminders.reminders || []);
      }
      if (aRules.success) {
        setAutoReminderRules(aRules.rules || []);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error cargando configuración");
    } finally {
      setBusy(false);
      setLoadingReminderSettings(false);
      setLoadingScheduledReminders(false);
      setLoadingAutoReminderRules(false);
    }
  }, [api.config, api.reminderSettings, api.reminderTemplates, api.scheduledReminders, api.autoReminderRules]);

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

  // Save reminder settings
  const saveReminderSettings = useCallback(
    async (settings: ReminderSettings) => {
      setBusy(true);
      setError(null);
      try {
        const res = await api.reminderSettings.update(settings);
        if (!res.success) {
          setError(res.message || "No se pudieron guardar los ajustes de recordatorios");
          return;
        }
        setReminderSettings(res.settings || null);
        pushToast({ kind: "success", title: "Actualizado", message: "Ajustes de recordatorios guardados" });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "No se pudieron guardar los ajustes";
        setError(msg);
      } finally {
        setBusy(false);
      }
    },
    [api.reminderSettings, pushToast],
  );

  // Scheduled Reminder functions
  const loadScheduledReminders = useCallback(
    async (filter?: string) => {
      setLoadingScheduledReminders(true);
      try {
        const res = await api.scheduledReminders.list({ status: filter || undefined });
        if (res.success) {
          setScheduledReminders(res.reminders || []);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error cargando recordatorios programados");
      } finally {
        setLoadingScheduledReminders(false);
      }
    },
    [api.scheduledReminders],
  );

  const createScheduledReminder = useCallback(
    async (input: ScheduledReminderInput) => {
      setBusy(true);
      setError(null);
      try {
        const res = await api.scheduledReminders.create(input);
        if (!res.success) {
          setError(res.message || "No se pudo crear el recordatorio programado");
          return;
        }
        pushToast({ kind: "success", title: "Creado", message: "Recordatorio programado creado" });
        setShowScheduledReminderForm(false);
        setNewScheduledReminder({
          invoice_id: 0,
          template_id: null,
          scheduled_date: "",
          scheduled_time: "09:00",
          frequency: "once",
          send_via: "email",
          custom_message: "",
          max_recurrences: null,
        });
        void loadScheduledReminders(scheduledReminderFilter);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error creando recordatorio");
      } finally {
        setBusy(false);
      }
    },
    [api.scheduledReminders, pushToast, loadScheduledReminders, scheduledReminderFilter],
  );

  const cancelScheduledReminder = useCallback(
    async (id: number) => {
      setBusy(true);
      setError(null);
      try {
        const res = await api.scheduledReminders.cancel(id);
        if (!res.success) {
          setError(res.message || "No se pudo cancelar el recordatorio");
          return;
        }
        pushToast({ kind: "success", title: "Cancelado", message: "Recordatorio cancelado" });
        void loadScheduledReminders(scheduledReminderFilter);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error cancelando recordatorio");
      } finally {
        setBusy(false);
      }
    },
    [api.scheduledReminders, pushToast, loadScheduledReminders, scheduledReminderFilter],
  );

  const deleteScheduledReminder = useCallback(
    async (id: number) => {
      setBusy(true);
      setError(null);
      try {
        const res = await api.scheduledReminders.delete(id);
        if (!res.success) {
          setError(res.message || "No se pudo eliminar el recordatorio");
          return;
        }
        pushToast({ kind: "success", title: "Eliminado", message: "Recordatorio eliminado" });
        void loadScheduledReminders(scheduledReminderFilter);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error eliminando recordatorio");
      } finally {
        setBusy(false);
      }
    },
    [api.scheduledReminders, pushToast, loadScheduledReminders, scheduledReminderFilter],
  );

  // Auto-reminder Rules functions
  const createAutoRule = useCallback(
    async (input: AutoReminderRuleInput) => {
      setBusy(true);
      setError(null);
      try {
        const res = await api.autoReminderRules.create(input);
        if (!res.success) {
          setError(res.message || "No se pudo crear la regla de recordatorio automatico");
          return;
        }
        pushToast({ kind: "success", title: "Creada", message: "Regla de recordatorio automatico creada" });
        setShowAutoRuleForm(false);
        setNewAutoRule({
          name: "",
          description: "",
          is_active: true,
          trigger_type: "overdue",
          trigger_days: 7,
          trigger_date: null,
          template_id: null,
          send_via: "email",
          send_time: "09:00",
          frequency: "once",
          max_recurrences: null,
          invoice_status_filter: null,
          invoice_category_filter: null,
          exclude_invoice_ids: null,
        });
        const rulesRes = await api.autoReminderRules.list();
        if (rulesRes.success) {
          setAutoReminderRules(rulesRes.rules || []);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error creando regla");
      } finally {
        setBusy(false);
      }
    },
    [api.autoReminderRules, pushToast],
  );

  const toggleAutoRule = useCallback(
    async (id: number, isActive: boolean) => {
      setBusy(true);
      setError(null);
      try {
        const res = await api.autoReminderRules.toggle(id, isActive);
        if (!res.success) {
          setError(res.message || "No se pudo cambiar el estado de la regla");
          return;
        }
        pushToast({ kind: "success", title: "Actualizado", message: isActive ? "Regla activada" : "Regla desactivada" });
        const rulesRes = await api.autoReminderRules.list();
        if (rulesRes.success) {
          setAutoReminderRules(rulesRes.rules || []);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error cambiando estado");
      } finally {
        setBusy(false);
      }
    },
    [api.autoReminderRules, pushToast],
  );

  const deleteAutoRule = useCallback(
    async (id: number) => {
      setBusy(true);
      setError(null);
      try {
        const res = await api.autoReminderRules.delete(id);
        if (!res.success) {
          setError(res.message || "No se pudo eliminar la regla");
          return;
        }
        pushToast({ kind: "success", title: "Eliminada", message: "Regla eliminada" });
        const rulesRes = await api.autoReminderRules.list();
        if (rulesRes.success) {
          setAutoReminderRules(rulesRes.rules || []);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error eliminando regla");
      } finally {
        setBusy(false);
      }
    },
    [api.autoReminderRules, pushToast],
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

      {/* Reminder Settings Section */}
      <div className="bo-stack">
        <div className="bo-panel">
          <div className="bo-panelHead">
            <div className="bo-panelTitle">
              <Bell size={18} style={{ marginRight: 8, verticalAlign: "middle" }} />
              Recordatorios de pago
            </div>
            <div className="bo-panelMeta">Configura el envio automatico de recordatorios</div>
          </div>
          <div className="bo-panelBody">
            {loadingReminderSettings ? (
              <InlineAlert kind="info" title="Cargando" message="Cargando ajustes de recordatorios..." />
            ) : (
              <>
                {/* Enable Auto Reminder */}
                <div className="bo-field">
                  <label className="bo-toggle">
                    <input
                      type="checkbox"
                      checked={reminderSettings?.auto_reminder_enabled || false}
                      onChange={(e) => {
                        if (reminderSettings) {
                          saveReminderSettings({
                            ...reminderSettings,
                            auto_reminder_enabled: e.target.checked,
                          });
                        }
                      }}
                      disabled={busy}
                    />
                    <span className="bo-toggle-slider"></span>
                    <span className="bo-toggle-label">
                      <BellOff size={14} style={{ marginRight: 4 }} />
                      Enviar recordatorios automaticos
                    </span>
                  </label>
                  <div className="bo-fieldHelp">
                    Enviar automaticamente un recordatorio a los clientes cuando una factura este pendiente de pago
                  </div>
                </div>

                {/* Days After Due */}
                {reminderSettings?.auto_reminder_enabled && (
                  <>
                    <div className="bo-field bo-field--inline">
                      <div className="bo-label">Enviar recordatorio</div>
                      <div className="bo-row" style={{ alignItems: "center", gap: 8 }}>
                        <span>despues de</span>
                        <Select
                          value={String(reminderSettings?.auto_reminder_days_after_due || 7)}
                          onChange={(v) => {
                            if (reminderSettings) {
                              saveReminderSettings({
                                ...reminderSettings,
                                auto_reminder_days_after_due: Number(v),
                              });
                            }
                          }}
                          options={[
                            { value: "1", label: "1 dia" },
                            { value: "3", label: "3 dias" },
                            { value: "7", label: "7 dias" },
                            { value: "14", label: "14 dias" },
                            { value: "30", label: "30 dias" },
                          ]}
                          size="sm"
                          disabled={busy}
                        />
                        <span>de vencimiento</span>
                      </div>
                    </div>

                    {/* Send Via */}
                    <div className="bo-field">
                      <div className="bo-label">Metodo de envio</div>
                      <div className="bo-radioGroup">
                        <label className="bo-radio">
                          <input
                            type="radio"
                            name="auto_reminder_send_via"
                            value="email"
                            checked={reminderSettings?.auto_reminder_send_via === "email"}
                            onChange={() => {
                              if (reminderSettings) {
                                saveReminderSettings({
                                  ...reminderSettings,
                                  auto_reminder_send_via: "email",
                                });
                              }
                            }}
                            disabled={busy}
                          />
                          <Mail size={14} />
                          <span>Email</span>
                        </label>
                        <label className="bo-radio">
                          <input
                            type="radio"
                            name="auto_reminder_send_via"
                            value="whatsapp"
                            checked={reminderSettings?.auto_reminder_send_via === "whatsapp"}
                            onChange={() => {
                              if (reminderSettings) {
                                saveReminderSettings({
                                  ...reminderSettings,
                                  auto_reminder_send_via: "whatsapp",
                                });
                              }
                            }}
                            disabled={busy}
                          />
                          <MessageSquare size={14} />
                          <span>WhatsApp</span>
                        </label>
                      </div>
                    </div>

                    {/* Template Selection */}
                    <div className="bo-field">
                      <div className="bo-label">Plantilla a usar</div>
                      <Select
                        value={String(reminderSettings?.auto_reminder_template_id || "")}
                        onChange={(v) => {
                          if (reminderSettings) {
                            saveReminderSettings({
                              ...reminderSettings,
                              auto_reminder_template_id: v ? Number(v) : null,
                            });
                          }
                        }}
                        options={[
                          { value: "", label: "-- Seleccionar plantilla --" },
                          ...reminderTemplates.map((t) => ({
                            value: String(t.id),
                            label: `${t.name} (${t.send_via === "email" ? "Email" : "WhatsApp"})`,
                          })),
                        ]}
                        size="sm"
                        disabled={busy}
                      />
                      <div className="bo-fieldHelp">
                        Selecciona la plantilla que se usara para los recordatorios automaticos
                      </div>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Scheduled Reminders Section */}
      <div className="bo-stack">
        <div className="bo-panel">
          <div className="bo-panelHead">
            <div className="bo-panelTitle">
              <Calendar size={18} style={{ marginRight: 8, verticalAlign: "middle" }} />
              Recordatorios programados
            </div>
            <div className="bo-panelMeta">Programa recordatorios para fechas especificas</div>
          </div>
          <div className="bo-panelBody">
            {/* Filter and Actions */}
            <div className="bo-row" style={{ marginBottom: 16, justifyContent: "space-between" }}>
              <div className="bo-field bo-field--inline">
                <Select
                  value={scheduledReminderFilter}
                  onChange={(v) => {
                    setScheduledReminderFilter(v);
                    void loadScheduledReminders(v);
                  }}
                  options={[
                    { value: "", label: "Todos" },
                    { value: "pending", label: "Pendientes" },
                    { value: "sent", label: "Enviados" },
                    { value: "cancelled", label: "Cancelados" },
                    { value: "failed", label: "Fallidos" },
                  ]}
                  size="sm"
                />
              </div>
              <button
                className="bo-btn bo-btn--primary"
                type="button"
                onClick={() => setShowScheduledReminderForm(true)}
              >
                <PlusCircle size={16} style={{ marginRight: 4 }} />
                Nuevo recordatorio
              </button>
            </div>

            {/* New Scheduled Reminder Form */}
            {showScheduledReminderForm && (
              <div className="bo-form" style={{ marginBottom: 16, padding: 16, backgroundColor: "var(--bo-bg-secondary)", borderRadius: 8 }}>
                <div className="bo-field">
                  <div className="bo-label">ID de factura</div>
                  <input
                    type="number"
                    className="bo-input bo-input--sm"
                    value={newScheduledReminder.invoice_id || ""}
                    onChange={(e) => setNewScheduledReminder({ ...newScheduledReminder, invoice_id: Number(e.target.value) })}
                    placeholder="ID de la factura"
                  />
                </div>
                <div className="bo-row" style={{ gap: 12 }}>
                  <div className="bo-field bo-field--inline">
                    <div className="bo-label">Fecha</div>
                    <input
                      type="date"
                      className="bo-input bo-input--sm"
                      value={newScheduledReminder.scheduled_date}
                      onChange={(e) => setNewScheduledReminder({ ...newScheduledReminder, scheduled_date: e.target.value })}
                    />
                  </div>
                  <div className="bo-field bo-field--inline">
                    <div className="bo-label">Hora</div>
                    <input
                      type="time"
                      className="bo-input bo-input--sm"
                      value={newScheduledReminder.scheduled_time}
                      onChange={(e) => setNewScheduledReminder({ ...newScheduledReminder, scheduled_time: e.target.value })}
                    />
                  </div>
                </div>
                <div className="bo-row" style={{ gap: 12 }}>
                  <div className="bo-field bo-field--inline">
                    <div className="bo-label">Frecuencia</div>
                    <Select
                      value={newScheduledReminder.frequency}
                      onChange={(v) => setNewScheduledReminder({ ...newScheduledReminder, frequency: v as ScheduledReminderFrequency })}
                      options={[
                        { value: "once", label: "Una vez" },
                        { value: "daily", label: "Diario" },
                        { value: "weekly", label: "Semanal" },
                        { value: "monthly", label: "Mensual" },
                      ]}
                      size="sm"
                    />
                  </div>
                  <div className="bo-field bo-field--inline">
                    <div className="bo-label">Via</div>
                    <Select
                      value={newScheduledReminder.send_via}
                      onChange={(v) => setNewScheduledReminder({ ...newScheduledReminder, send_via: v as "email" | "whatsapp" })}
                      options={[
                        { value: "email", label: "Email" },
                        { value: "whatsapp", label: "WhatsApp" },
                      ]}
                      size="sm"
                    />
                  </div>
                </div>
                <div className="bo-field">
                  <div className="bo-label">Plantilla</div>
                  <Select
                    value={String(newScheduledReminder.template_id || "")}
                    onChange={(v) => setNewScheduledReminder({ ...newScheduledReminder, template_id: v ? Number(v) : null })}
                    options={[
                      { value: "", label: "-- Seleccionar plantilla --" },
                      ...reminderTemplates.map((t) => ({
                        value: String(t.id),
                        label: `${t.name} (${t.send_via === "email" ? "Email" : "WhatsApp"})`,
                      })),
                    ]}
                    size="sm"
                  />
                </div>
                <div className="bo-field">
                  <div className="bo-label">Mensaje personalizado (opcional)</div>
                  <textarea
                    className="bo-input"
                    rows={2}
                    value={newScheduledReminder.custom_message || ""}
                    onChange={(e) => setNewScheduledReminder({ ...newScheduledReminder, custom_message: e.target.value })}
                    placeholder="Mensaje adicional..."
                  />
                </div>
                <div className="bo-row" style={{ gap: 8, marginTop: 8 }}>
                  <button
                    className="bo-btn bo-btn--primary"
                    type="button"
                    onClick={() => void createScheduledReminder(newScheduledReminder)}
                    disabled={busy || !newScheduledReminder.invoice_id || !newScheduledReminder.scheduled_date}
                  >
                    Crear
                  </button>
                  <button
                    className="bo-btn bo-btn--ghost"
                    type="button"
                    onClick={() => {
                      setShowScheduledReminderForm(false);
                      setNewScheduledReminder({
                        invoice_id: 0,
                        template_id: null,
                        scheduled_date: "",
                        scheduled_time: "09:00",
                        frequency: "once",
                        send_via: "email",
                        custom_message: "",
                        max_recurrences: null,
                      });
                    }}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {/* Scheduled Reminders List */}
            {loadingScheduledReminders ? (
              <InlineAlert kind="info" title="Cargando" message="Cargando recordatorios..." />
            ) : scheduledReminders.length === 0 ? (
              <InlineAlert kind="info" title="Sin recordatorios" message="No hay recordatorios programados" />
            ) : (
              <div style={{ display: "grid", gap: 8 }}>
                {scheduledReminders.map((reminder) => (
                  <div
                    key={reminder.id}
                    className="bo-card"
                    style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 12 }}
                  >
                    <div>
                      <div style={{ fontWeight: 600 }}>
                        Factura #{reminder.invoice_id}
                        {reminder.invoice_number && ` (${reminder.invoice_number})`}
                      </div>
                      <div className="bo-mutedText" style={{ fontSize: 13 }}>
                        {reminder.customer_name} | {reminder.scheduled_date} {reminder.scheduled_time}
                      </div>
                      <div className="bo-mutedText" style={{ fontSize: 12 }}>
                        {reminder.frequency === "once" ? "Una vez" : reminder.frequency === "daily" ? "Diario" : reminder.frequency === "weekly" ? "Semanal" : "Mensual"} | {reminder.send_via === "email" ? "Email" : "WhatsApp"}
                        {reminder.template_name && ` | ${reminder.template_name}`}
                      </div>
                    </div>
                    <div className="bo-row" style={{ gap: 4 }}>
                      {reminder.status === "pending" && (
                        <>
                          <button
                            className="bo-actionBtn"
                            type="button"
                            title="Cancelar"
                            onClick={() => void cancelScheduledReminder(reminder.id)}
                            disabled={busy}
                          >
                            <X size={16} />
                          </button>
                          <button
                            className="bo-actionBtn"
                            type="button"
                            title="Eliminar"
                            onClick={() => void deleteScheduledReminder(reminder.id)}
                            disabled={busy}
                          >
                            <Trash2 size={16} />
                          </button>
                        </>
                      )}
                      <span
                        className={`bo-badge bo-badge--${reminder.status === "pending" ? "warning" : reminder.status === "sent" ? "success" : reminder.status === "cancelled" ? "muted" : "danger"}`}
                      >
                        {reminder.status === "pending" ? "Pendiente" : reminder.status === "sent" ? "Enviado" : reminder.status === "cancelled" ? "Cancelado" : "Fallido"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Auto-Reminder Rules Section */}
      <div className="bo-stack">
        <div className="bo-panel">
          <div className="bo-panelHead">
            <div className="bo-panelTitle">
              <Clock size={18} style={{ marginRight: 8, verticalAlign: "middle" }} />
              Reglas de recordatorios automaticos
            </div>
            <div className="bo-panelMeta">Configura reglas para enviar recordatorios automaticamente</div>
          </div>
          <div className="bo-panelBody">
            {/* Actions */}
            <div className="bo-row" style={{ marginBottom: 16, justifyContent: "flex-end" }}>
              <button
                className="bo-btn bo-btn--primary"
                type="button"
                onClick={() => setShowAutoRuleForm(true)}
              >
                <PlusCircle size={16} style={{ marginRight: 4 }} />
                Nueva regla
              </button>
            </div>

            {/* New Auto Rule Form */}
            {showAutoRuleForm && (
              <div className="bo-form" style={{ marginBottom: 16, padding: 16, backgroundColor: "var(--bo-bg-secondary)", borderRadius: 8 }}>
                <div className="bo-field">
                  <div className="bo-label">Nombre de la regla</div>
                  <input
                    type="text"
                    className="bo-input bo-input--sm"
                    value={newAutoRule.name}
                    onChange={(e) => setNewAutoRule({ ...newAutoRule, name: e.target.value })}
                    placeholder="Ej: Recordatorio semanal de facturas pendientes"
                  />
                </div>
                <div className="bo-field">
                  <div className="bo-label">Descripcion</div>
                  <input
                    type="text"
                    className="bo-input bo-input--sm"
                    value={newAutoRule.description || ""}
                    onChange={(e) => setNewAutoRule({ ...newAutoRule, description: e.target.value })}
                    placeholder="Descripcion opcional..."
                  />
                </div>
                <div className="bo-row" style={{ gap: 12 }}>
                  <div className="bo-field bo-field--inline">
                    <div className="bo-label">Tipo de activador</div>
                    <Select
                      value={newAutoRule.trigger_type}
                      onChange={(v) => setNewAutoRule({ ...newAutoRule, trigger_type: v as "due_date" | "overdue" | "days_after_invoice" | "custom_date" })}
                      options={[
                        { value: "overdue", label: "Facturas vencidas" },
                        { value: "due_date", label: "Fecha de vencimiento" },
                        { value: "days_after_invoice", label: "Dias despues de factura" },
                        { value: "custom_date", label: "Fecha personalizada" },
                      ]}
                      size="sm"
                    />
                  </div>
                  {newAutoRule.trigger_type === "days_after_invoice" && (
                    <div className="bo-field bo-field--inline">
                      <div className="bo-label">Dias despues</div>
                      <input
                        type="number"
                        className="bo-input bo-input--sm"
                        style={{ width: 80 }}
                        value={newAutoRule.trigger_days || ""}
                        onChange={(e) => setNewAutoRule({ ...newAutoRule, trigger_days: Number(e.target.value) })}
                      />
                    </div>
                  )}
                  {newAutoRule.trigger_type === "custom_date" && (
                    <div className="bo-field bo-field--inline">
                      <div className="bo-label">Fecha</div>
                      <input
                        type="date"
                        className="bo-input bo-input--sm"
                        value={newAutoRule.trigger_date || ""}
                        onChange={(e) => setNewAutoRule({ ...newAutoRule, trigger_date: e.target.value })}
                      />
                    </div>
                  )}
                </div>
                <div className="bo-row" style={{ gap: 12 }}>
                  <div className="bo-field bo-field--inline">
                    <div className="bo-label">Hora de envio</div>
                    <input
                      type="time"
                      className="bo-input bo-input--sm"
                      value={newAutoRule.send_time}
                      onChange={(e) => setNewAutoRule({ ...newAutoRule, send_time: e.target.value })}
                    />
                  </div>
                  <div className="bo-field bo-field--inline">
                    <div className="bo-label">Frecuencia</div>
                    <Select
                      value={newAutoRule.frequency}
                      onChange={(v) => setNewAutoRule({ ...newAutoRule, frequency: v as ScheduledReminderFrequency })}
                      options={[
                        { value: "once", label: "Una vez" },
                        { value: "daily", label: "Diario" },
                        { value: "weekly", label: "Semanal" },
                        { value: "monthly", label: "Mensual" },
                      ]}
                      size="sm"
                    />
                  </div>
                  <div className="bo-field bo-field--inline">
                    <div className="bo-label">Via</div>
                    <Select
                      value={newAutoRule.send_via}
                      onChange={(v) => setNewAutoRule({ ...newAutoRule, send_via: v as "email" | "whatsapp" })}
                      options={[
                        { value: "email", label: "Email" },
                        { value: "whatsapp", label: "WhatsApp" },
                      ]}
                      size="sm"
                    />
                  </div>
                </div>
                <div className="bo-field">
                  <div className="bo-label">Plantilla</div>
                  <Select
                    value={String(newAutoRule.template_id || "")}
                    onChange={(v) => setNewAutoRule({ ...newAutoRule, template_id: v ? Number(v) : null })}
                    options={[
                      { value: "", label: "-- Seleccionar plantilla --" },
                      ...reminderTemplates.map((t) => ({
                        value: String(t.id),
                        label: `${t.name} (${t.send_via === "email" ? "Email" : "WhatsApp"})`,
                      })),
                    ]}
                    size="sm"
                  />
                </div>
                <div className="bo-row" style={{ gap: 8, marginTop: 8 }}>
                  <button
                    className="bo-btn bo-btn--primary"
                    type="button"
                    onClick={() => void createAutoRule(newAutoRule)}
                    disabled={busy || !newAutoRule.name}
                  >
                    Crear regla
                  </button>
                  <button
                    className="bo-btn bo-btn--ghost"
                    type="button"
                    onClick={() => {
                      setShowAutoRuleForm(false);
                      setNewAutoRule({
                        name: "",
                        description: "",
                        is_active: true,
                        trigger_type: "overdue",
                        trigger_days: 7,
                        trigger_date: null,
                        template_id: null,
                        send_via: "email",
                        send_time: "09:00",
                        frequency: "once",
                        max_recurrences: null,
                        invoice_status_filter: null,
                        invoice_category_filter: null,
                        exclude_invoice_ids: null,
                      });
                    }}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {/* Auto Rules List */}
            {loadingAutoReminderRules ? (
              <InlineAlert kind="info" title="Cargando" message="Cargando reglas..." />
            ) : autoReminderRules.length === 0 ? (
              <InlineAlert kind="info" title="Sin reglas" message="No hay reglas de recordatorios automaticos configuradas" />
            ) : (
              <div style={{ display: "grid", gap: 8 }}>
                {autoReminderRules.map((rule) => (
                  <div
                    key={rule.id}
                    className="bo-card"
                    style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 12 }}
                  >
                    <div>
                      <div style={{ fontWeight: 600 }}>{rule.name}</div>
                      {rule.description && (
                        <div className="bo-mutedText" style={{ fontSize: 13 }}>
                          {rule.description}
                        </div>
                      )}
                      <div className="bo-mutedText" style={{ fontSize: 12 }}>
                        {rule.trigger_type === "overdue" ? "Facturas vencidas" : rule.trigger_type === "due_date" ? "Fecha de vencimiento" : rule.trigger_type === "days_after_invoice" ? `${rule.trigger_days} dias despues de factura` : "Fecha personalizada"} | {rule.send_time} | {rule.frequency === "once" ? "Una vez" : rule.frequency === "daily" ? "Diario" : rule.frequency === "weekly" ? "Semanal" : "Mensual"} | {rule.send_via === "email" ? "Email" : "WhatsApp"}
                      </div>
                    </div>
                    <div className="bo-row" style={{ gap: 4 }}>
                      <button
                        className="bo-actionBtn"
                        type="button"
                        title={rule.is_active ? "Desactivar" : "Activar"}
                        onClick={() => void toggleAutoRule(rule.id, !rule.is_active)}
                        disabled={busy}
                      >
                        {rule.is_active ? <Pause size={16} /> : <Play size={16} />}
                      </button>
                      <button
                        className="bo-actionBtn"
                        type="button"
                        title="Eliminar"
                        onClick={() => void deleteAutoRule(rule.id)}
                        disabled={busy}
                      >
                        <Trash2 size={16} />
                      </button>
                      <span className={`bo-badge bo-badge--${rule.is_active ? "success" : "muted"}`}>
                        {rule.is_active ? "Activa" : "Inactiva"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
