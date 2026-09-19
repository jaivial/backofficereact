import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ImagePlus, Plus, Trash2 } from "lucide-react";

import type { MenuSelectorItem, SpecialDateMenu, SpecialDatePaymentMethod, SpecialDateSettings } from "../../../../../api/types";
import { SPECIAL_DATE_PAYMENT_METHODS } from "../../../../../api/types";
import { createClient } from "../../../../../api/client";
import { useToasts } from "../../../../../ui/feedback/useToasts";
import { Switch } from "../../../../../ui/shadcn/Switch";
import { DatePicker } from "../../../../../ui/inputs/DatePicker";
import { PlusMinusCounter } from "../../../../../ui/widgets/PlusMinusCounter";

type EditableMenu = SpecialDateMenu & { _key: string };

const EMPTY_SETTINGS: SpecialDateSettings = {
  date: "",
  is_active: false,
  title: "",
  description: "",
  prereserva_enabled: false,
  max_per_table_enabled: false,
  max_per_table: null,
  requires_adelanto: false,
  adelanto_payment_methods: [],
  adelanto_unified: false,
  adelanto_unified_amount: null,
  prereserva_starts_on: null,
  prereserva_ends_on: null,
  menus: [],
};

function uid(): string {
  return "m_" + Math.random().toString(36).slice(2, 9);
}

function withKeys(menus: SpecialDateMenu[]): EditableMenu[] {
  return menus.map((m) => ({ ...m, _key: uid() }));
}

function toNumberOrNull(v: string): number | null {
  if (v === "" || v == null) return null;
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/**
 * Mobile-friendly toggle row: the whole row is the tap target (>=44px), the
 * Switch stays the keyboard/AT control. Clicking the Switch stops propagation
 * so the row handler and the switch never double-toggle.
 */
function ToggleRow({
  title,
  desc,
  checked,
  onToggle,
  ariaLabel,
  testId,
}: {
  title: string;
  desc: string;
  checked: boolean;
  onToggle: (v: boolean) => void;
  ariaLabel: string;
  testId: string;
}) {
  return (
    <div
      data-ui={testId}
      data-testid={testId}
      role="group"
      aria-label={title}
      className="flex min-h-12 cursor-pointer select-none items-center justify-between gap-3 rounded-lg border border-(--bo-border) bg-(--bo-surface-2) px-3 py-2 transition-colors active:border-(--bo-accent-border, var(--bo-border))"
      onClick={() => onToggle(!checked)}
    >
      <div data-slot="toggle-row-text" data-testid={`${testId}-text`}>
        <div className="text-sm font-medium" data-testid={`${testId}-title`}>{title}</div>
        <div className="text-xs text-(--bo-muted)" data-testid={`${testId}-desc`}>{desc}</div>
      </div>
      <span onClick={(e) => e.stopPropagation()}>
        <Switch checked={checked} onCheckedChange={onToggle} aria-label={ariaLabel} data-testid={`${testId}-switch`} />
      </span>
    </div>
  );
}

export interface SpecialDateFormProps {
  date: string;
  initial: SpecialDateSettings | null;
  availableMenus: MenuSelectorItem[];
  onSaved?: (settings: SpecialDateSettings) => void;
}

export function SpecialDateForm({ date, initial, availableMenus, onSaved }: SpecialDateFormProps) {
  const api = useMemo(() => createClient({ baseUrl: "" }), []);
  const { pushToast } = useToasts();

  const [draft, setDraft] = useState<SpecialDateSettings>(() => initial ?? { ...EMPTY_SETTINGS, date, is_active: false });
  const [editableMenus, setEditableMenus] = useState<EditableMenu[]>(() => withKeys(initial?.menus ?? []));
  const [saving, setSaving] = useState(false);
  const [maxPerTableDraft, setMaxPerTableDraft] = useState<string>(() =>
    initial?.max_per_table_enabled && initial?.max_per_table != null ? String(initial.max_per_table) : "",
  );
  const [unifiedAmountDraft, setUnifiedAmountDraft] = useState<string>(() =>
    initial?.adelanto_unified && initial?.adelanto_unified_amount != null ? String(initial?.adelanto_unified_amount) : "",
  );

  useEffect(() => {
    setDraft(initial ?? { ...EMPTY_SETTINGS, date, is_active: false });
    setEditableMenus(withKeys(initial?.menus ?? []));
    setMaxPerTableDraft(initial?.max_per_table_enabled && initial?.max_per_table != null ? String(initial.max_per_table) : "");
    setUnifiedAmountDraft(initial?.adelanto_unified && initial?.adelanto_unified_amount != null ? String(initial?.adelanto_unified_amount) : "");
  }, [initial, date]);

  const isActive = draft.is_active;

  const patch = useCallback((p: Partial<SpecialDateSettings>) => {
    setDraft((prev: SpecialDateSettings) => ({ ...prev, ...p }));
  }, []);

  const handleMaxPerTableToggle = useCallback(
    (checked: boolean) => {
      patch({ max_per_table_enabled: checked });
    },
    [patch],
  );

  const handleMaxPerTableCommit = useCallback(() => {
    const n = toNumberOrNull(maxPerTableDraft);
    const safe = n != null && n >= 1 ? Math.trunc(n) : null;
    patch({ max_per_table: safe });
    setMaxPerTableDraft(safe != null ? String(safe) : "");
  }, [maxPerTableDraft, patch]);

  const handlePrereservaToggle = useCallback(
    (checked: boolean) => {
      patch({
        prereserva_enabled: checked,
        requires_adelanto: checked ? draft.requires_adelanto : false,
        adelanto_payment_methods: checked ? draft.adelanto_payment_methods : [],
      });
    },
    [patch, draft.requires_adelanto, draft.adelanto_payment_methods],
  );

  const handleRequiresAdelantoToggle = useCallback(
    (checked: boolean) => {
      patch({ requires_adelanto: checked });
    },
    [patch],
  );

  const togglePaymentMethod = useCallback(
    (method: SpecialDatePaymentMethod) => {
      const cur = draft.adelanto_payment_methods;
      const next = cur.includes(method) ? cur.filter((m: SpecialDatePaymentMethod) => m !== method) : [...cur, method];
      patch({ adelanto_payment_methods: next });
    },
    [draft.adelanto_payment_methods, patch],
  );

  const handleAdelantoUnifiedToggle = useCallback(
    (checked: boolean) => {
      patch({
        adelanto_unified: checked,
        // When unifying, mirror the unified amount to each row so per-row state stays consistent.
        menus: checked
          ? editableMenus.map((m) => ({
              ...m,
              adelanto_amount: toNumberOrNull(unifiedAmountDraft) ?? m.adelanto_amount ?? 0,
            }))
          : editableMenus.map((m) => ({ ...m })),
      });
    },
    [editableMenus, patch, unifiedAmountDraft],
  );

  const handleUnifiedAmountCommit = useCallback(() => {
    const n = toNumberOrNull(unifiedAmountDraft);
    const safe = n != null && n >= 0 ? n : 0;
    patch({
      adelanto_unified_amount: safe,
      menus: editableMenus.map((m) => ({ ...m, adelanto_amount: safe })),
    });
    setUnifiedAmountDraft(String(safe));
  }, [editableMenus, patch, unifiedAmountDraft]);

  const addMenuRow = useCallback(() => {
    const firstAvailable = availableMenus[0];
    setEditableMenus((prev) => [
      ...prev,
      {
        _key: uid(),
        menu_id: firstAvailable?.id ?? null,
        custom_title: null,
        custom_image_url: null,
        adelanto_amount: draft.adelanto_unified ? toNumberOrNull(unifiedAmountDraft) ?? 0 : null,
        position: prev.length,
      },
    ]);
  }, [availableMenus, draft.adelanto_unified, unifiedAmountDraft]);

  const removeMenuRow = useCallback((key: string) => {
    setEditableMenus((prev) => prev.filter((m) => m._key !== key));
  }, []);

  const updateMenuRow = useCallback(
    (key: string, patchRow: Partial<EditableMenu>) => {
      setEditableMenus((prev) => prev.map((m) => (m._key === key ? { ...m, ...patchRow } : m)));
    },
    [],
  );

  const uploadCustomImage = useCallback(
    async (key: string, file: File) => {
      try {
        const res = await api.config.uploadSpecialDateMenuImage(file);
        if (!res.success) {
          pushToast({ kind: "error", title: "Error", message: res.message || "No se pudo subir la imagen" });
          return;
        }
        updateMenuRow(key, { custom_image_url: (res as { url?: string }).url ?? null });
        pushToast({ kind: "success", title: "Imagen subida", message: "Imagen del menú personalizada guardada" });
      } catch (e) {
        pushToast({ kind: "error", title: "Error", message: e instanceof Error ? e.message : "No se pudo subir la imagen" });
      }
    },
    [api, pushToast, updateMenuRow],
  );

  const handleSave = useCallback(async () => {
    setSaving(true);
    const payload: SpecialDateSettings & { date: string } = {
      ...draft,
      date,
      menus: editableMenus.map((m, idx) => ({
        id: m.id ?? null,
        menu_id: m.menu_id ?? null,
        custom_title: m.custom_title ?? null,
        custom_image_url: m.custom_image_url ?? null,
        adelanto_amount: m.adelanto_amount ?? null,
        position: idx,
      })),
    };
    try {
      const res = await api.config.saveSpecialDate(payload);
      if (!res.success) {
        pushToast({ kind: "error", title: "Error", message: res.message || "No se pudo guardar la configuración" });
        return;
      }
      const saved = (res as { special_date: SpecialDateSettings }).special_date;
      setDraft(saved);
      setEditableMenus(withKeys(saved.menus ?? []));
      onSaved?.(saved);
      pushToast({ kind: "success", title: "Guardado", message: "Reservas especiales actualizadas" });
    } catch (e) {
      pushToast({ kind: "error", title: "Error", message: e instanceof Error ? e.message : "No se pudo guardar la configuración" });
    } finally {
      setSaving(false);
    }
  }, [api, date, draft, editableMenus, onSaved, pushToast]);

  return (
    <section data-ui="special-date-form" data-testid="special-date-form-section" aria-label="Reservas especiales">
      <div
        data-ui="special-date-form-card"
        data-testid="special-date-form-card"
        className="bo-panel mx-auto w-full max-w-[768px]"
      >
        <div data-slot="panel-head" className="bo-panelHead" data-testid="special-date-form-head">
          <div data-role="title" className="bo-panelTitle" data-testid="special-date-form-title">
            Reservas especiales · {date}
          </div>
          <div data-role="meta" className="bo-panelMeta" data-testid="special-date-form-meta">
            {isActive ? "Fecha especial activa" : "Fecha especial inactiva"}
          </div>
        </div>

        <div data-slot="panel-body" className="bo-panelBody pb-20 sm:pb-4" style={{ display: "grid", gap: 18 }} data-testid="special-date-form-body">
          {/* Title + Description */}
          <div data-ui="special-date-title-field" data-testid="special-date-title-field">
            <label className="bo-label" data-testid="special-date-title-label">Título</label>
            <input
              className="bo-input"
              value={draft.title}
              onChange={(e) => patch({ title: e.target.value })}
              placeholder="Ej: Cena de gala"
              data-testid="special-date-title-input"
            />
          </div>
          <div data-ui="special-date-description-field" data-testid="special-date-description-field">
            <label className="bo-label" data-testid="special-date-description-label">Descripción</label>
            <textarea
              className="bo-input"
              rows={3}
              value={draft.description}
              onChange={(e) => patch({ description: e.target.value })}
              placeholder="Detalles visibles para el cliente"
              data-testid="special-date-description-input"
            />
          </div>

          {/* Prereserva */}
          <ToggleRow
            title="Prereserva"
            desc="Activa el modo prereserva para este día"
            checked={draft.prereserva_enabled}
            onToggle={handlePrereservaToggle}
            ariaLabel="Activar prereserva"
            testId="special-date-prereserva-row"
          />

          <AnimatePresence>
            {draft.prereserva_enabled ? (
              <motion.div
                key="special-date-prereserva-body"
                data-slot="special-date-prereserva-body"
                data-testid="special-date-prereserva-body"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                style={{ display: "grid", gap: 14 }}
              >
                {/* Requires adelanto */}
                <ToggleRow
                  title="Requiere adelanto"
                  desc="El cliente debe pagar un adelanto para confirmar"
                  checked={draft.requires_adelanto}
                  onToggle={handleRequiresAdelantoToggle}
                  ariaLabel="Activar adelanto"
                  testId="special-date-requires-adelanto-row"
                />

                <AnimatePresence>
                  {draft.requires_adelanto ? (
                    <motion.div
                      key="special-date-adelanto-body"
                      data-slot="special-date-adelanto-body"
                      data-testid="special-date-adelanto-body"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      style={{ display: "grid", gap: 14 }}
                    >
                      {/* Payment methods */}
                      <div data-ui="special-date-payment-methods-field" data-testid="special-date-payment-methods-field">
                        <div className="bo-label" data-testid="special-date-payment-methods-label">Métodos de pago aceptados</div>
                        <div className="bo-chips" data-slot="paymentMethodsChips" data-testid="special-date-payment-methods-chips">
                          {SPECIAL_DATE_PAYMENT_METHODS.map((m: { value: SpecialDatePaymentMethod; label: string }) => {
                            const on = draft.adelanto_payment_methods.includes(m.value);
                            return (
                              <button
                                key={m.value}
                                type="button"
                                className={`bo-chip min-h-11 px-4 text-sm transition-transform duration-150 active:scale-[0.96]${on ? " is-on" : ""}`}
                                onClick={() => togglePaymentMethod(m.value)}
                                aria-pressed={on}
                                data-testid={`special-date-payment-method-${m.value}`}
                              >
                                {m.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Adelanto unified toggle */}
                      <ToggleRow
                        title="Todos iguales"
                        desc="Aplica el mismo adelanto por persona a todos los menús"
                        checked={draft.adelanto_unified}
                        onToggle={handleAdelantoUnifiedToggle}
                        ariaLabel="Unificar adelanto"
                        testId="special-date-adelanto-unified-row"
                      />

                      {draft.adelanto_unified ? (
                        <div data-ui="special-date-unified-amount-field" data-testid="special-date-unified-amount-field">
                          <label className="bo-label" data-testid="special-date-unified-amount-label">Adelanto por persona (€)</label>
                          <input
                            className="bo-input"
                            type="number"
                            inputMode="decimal"
                            min={0}
                            step={0.5}
                            value={unifiedAmountDraft}
                            onChange={(e) => setUnifiedAmountDraft(e.target.value)}
                            onBlur={handleUnifiedAmountCommit}
                            placeholder="0.00"
                            data-testid="special-date-unified-amount-input"
                          />
                        </div>
                      ) : null}

                      {!draft.adelanto_unified && editableMenus.length > 0 ? (
                        <div data-ui="special-date-per-menu-amounts" data-testid="special-date-per-menu-amounts">
                          <div className="bo-label" data-testid="special-date-per-menu-amounts-label">
                            Adelanto por menú
                          </div>
                          <div className="flex flex-col gap-2" data-slot="perMenuAmountsList" data-testid="special-date-per-menu-amounts-list">
                            {editableMenus.map((m) => {
                              const label = m.custom_title || availableMenus.find((am) => am.id === m.menu_id)?.menu_title || `Menú ${m._key.slice(-4)}`;
                              return (
                                <div
                                  key={m._key}
                                  className="flex items-center justify-between gap-3 rounded-lg border border-(--bo-border) bg-(--bo-surface-2) px-3 py-2"
                                  data-testid={`special-date-per-menu-amount-row-${m._key}`}
                                >
                                  <div className="text-sm" data-testid={`special-date-per-menu-amount-row-${m._key}-label`}>{label}</div>
                                  <input
                                    className="bo-input"
                                    style={{ maxWidth: 120 }}
                                    type="number"
                                    inputMode="decimal"
                                    min={0}
                                    step={0.5}
                                    value={m.adelanto_amount != null ? String(m.adelanto_amount) : ""}
                                    onChange={(e) => updateMenuRow(m._key, { adelanto_amount: toNumberOrNull(e.target.value) })}
                                    placeholder="0.00"
                                    data-testid={`special-date-per-menu-amount-row-${m._key}-input`}
                                  />
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : null}

                      {/* Prereserva window */}
                      <div data-ui="special-date-prereserva-window" data-testid="special-date-prereserva-window">
                        <div className="bo-label" data-testid="special-date-prereserva-window-label">
                          Ventana de prereserva
                        </div>
                        <div className="flex flex-col sm:flex-row gap-3" data-slot="prereservaWindowRow" data-testid="special-date-prereserva-window-row">
                          <div data-slot="prereservaStart" data-testid="special-date-prereserva-start-field">
                            <div className="text-xs text-(--bo-muted)" data-testid="special-date-prereserva-start-label">Desde</div>
                            <DatePicker
                              className="w-full"
                              value={draft.prereserva_starts_on ?? ""}
                              onChange={(iso: string) => patch({ prereserva_starts_on: iso || null })}
                              data-testid="special-date-prereserva-start-input"
                            />
                          </div>
                          <div data-slot="prereservaEnd" data-testid="special-date-prereserva-end-field">
                            <div className="text-xs text-(--bo-muted)" data-testid="special-date-prereserva-end-label">Hasta</div>
                            <DatePicker
                              className="w-full"
                              value={draft.prereserva_ends_on ?? ""}
                              onChange={(iso: string) => patch({ prereserva_ends_on: iso || null })}
                              data-testid="special-date-prereserva-end-input"
                            />
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </motion.div>
            ) : null}
          </AnimatePresence>

          {/* Menus */}
          <div data-ui="special-date-menus" data-testid="special-date-menus-section">
            <div className="bo-label" data-testid="special-date-menus-label">Menús de la fecha especial</div>
            <div className="flex flex-col gap-3" data-slot="menusList" data-testid="special-date-menus-list">
              {editableMenus.map((m, idx) => {
                const isCustom = !m.menu_id;
                return (
                  <div
                    key={m._key}
                    className="rounded-lg border border-(--bo-border) bg-(--bo-surface-2) p-3 flex flex-col gap-3"
                    data-testid={`special-date-menu-row-${idx + 1}`}
                  >
                    <div className="flex items-center justify-between gap-3" data-slot={`menuRowHead-${idx}`} data-testid={`special-date-menu-row-${idx + 1}-head`}>
                      <div className="text-sm font-medium" data-testid={`special-date-menu-row-${idx + 1}-index`}>Menú {idx + 1}</div>
                      <button
                        type="button"
                        className="bo-btn bo-btn--ghost bo-btn--icon"
                        onClick={() => removeMenuRow(m._key)}
                        aria-label={`Eliminar menú ${idx + 1}`}
                        data-testid={`special-date-menu-row-${idx + 1}-delete`}
                      >
                        <Trash2 size={16} strokeWidth={1.8} aria-hidden="true" />
                      </button>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3" data-slot={`menuRowBody-${idx}`} data-testid={`special-date-menu-row-${idx + 1}-body`}>
                      <div className="flex-1" data-slot={`menuSource-${idx}`}>
                        <div className="text-xs text-(--bo-muted)" data-testid={`special-date-menu-row-${idx + 1}-source-label`}>
                          Menú del catálogo
                        </div>
                        <select
                          className="bo-input"
                          value={m.menu_id != null ? String(m.menu_id) : "__custom__"}
                          onChange={(e) => {
                            const v = e.target.value;
                            if (v === "__custom__") {
                              updateMenuRow(m._key, { menu_id: null });
                            } else {
                              updateMenuRow(m._key, { menu_id: Number(v), custom_title: null, custom_image_url: null });
                            }
                          }}
                          data-testid={`special-date-menu-row-${idx + 1}-source-select`}
                        >
                          <option value="__custom__">Personalizado (título + imagen)</option>
                          {availableMenus.map((am) => (
                            <option key={am.id} value={String(am.id)}>{am.menu_title}</option>
                          ))}
                        </select>
                      </div>
                      {isCustom ? (
                        <div className="flex-1" data-slot={`menuCustom-${idx}`}>
                          <div className="text-xs text-(--bo-muted)" data-testid={`special-date-menu-row-${idx + 1}-custom-title-label`}>Título personalizado</div>
                          <input
                            className="bo-input"
                            value={m.custom_title ?? ""}
                            onChange={(e) => updateMenuRow(m._key, { custom_title: e.target.value })}
                            placeholder="Ej: Menú infantil"
                            data-testid={`special-date-menu-row-${idx + 1}-custom-title-input`}
                          />
                        </div>
                      ) : null}
                    </div>
                    {isCustom ? (
                      <div className="flex items-center gap-3" data-slot={`menuCustomImage-${idx}`} data-testid={`special-date-menu-row-${idx + 1}-custom-image`}>
                        {m.custom_image_url ? (
                          <img
                            src={m.custom_image_url}
                            alt={m.custom_title || "Menú personalizado"}
                            className="h-16 w-16 rounded object-cover border border-(--bo-border)"
                            data-testid={`special-date-menu-row-${idx + 1}-custom-image-preview`}
                          />
                        ) : (
                          <div className="h-16 w-16 rounded border border-dashed border-(--bo-border) flex items-center justify-center text-(--bo-muted)" data-testid={`special-date-menu-row-${idx + 1}-custom-image-empty`}>
                            <ImagePlus size={18} strokeWidth={1.8} aria-hidden="true" />
                          </div>
                        )}
                        <label className="bo-btn bo-btn--ghost" data-testid={`special-date-menu-row-${idx + 1}-custom-image-label`}>
                          <input
                            type="file"
                            accept="image/*"
                            style={{ display: "none" }}
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) void uploadCustomImage(m._key, f);
                            }}
                            data-testid={`special-date-menu-row-${idx + 1}-custom-image-input`}
                          />
                          Subir imagen
                        </label>
                      </div>
                    ) : null}
                  </div>
                );
              })}
              <button
                type="button"
                className="bo-btn bo-btn--ghost flex items-center justify-center gap-2"
                onClick={addMenuRow}
                data-testid="special-date-menus-add-btn"
              >
                <Plus size={16} strokeWidth={1.8} aria-hidden="true" />
                Añadir menú
              </button>
            </div>
          </div>

          {/* Max per table */}
          <ToggleRow
            title="Máximo por mesa"
            desc="Limita el número de comensales por reserva para esta fecha"
            checked={draft.max_per_table_enabled}
            onToggle={handleMaxPerTableToggle}
            ariaLabel="Activar máximo por mesa"
            testId="special-date-max-per-table-row"
          />

          <AnimatePresence>
            {draft.max_per_table_enabled ? (
              <motion.div
                key="special-date-max-per-table-body"
                data-slot="special-date-max-per-table-body"
                data-testid="special-date-max-per-table-body"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="flex justify-center"
              >
                <PlusMinusCounter
                  label="Máximo por mesa"
                  value={maxPerTableDraft === "" ? 0 : Number(maxPerTableDraft)}
                  onDecrease={() => {
                    const cur = Number(maxPerTableDraft || 0);
                    const next = Math.max(1, cur - 1);
                    setMaxPerTableDraft(String(next));
                    patch({ max_per_table: next });
                  }}
                  onIncrease={() => {
                    const cur = Number(maxPerTableDraft || 0);
                    const next = cur + 1;
                    setMaxPerTableDraft(String(next));
                    patch({ max_per_table: next });
                  }}
                  helperText="Mínimo 1"
                />
              </motion.div>
            ) : null}
          </AnimatePresence>

          {/* Save — sticky on mobile so it stays reachable without scrolling to the end.
              Bleeds to the panel edges (-mx-4/-mb-4 vs bo-panelBody padding:16px) and
              keeps the panel's bottom radius for concentric corners. */}
          <div
            className="sticky bottom-0 z-10 -mx-4 -mb-4 flex justify-center rounded-b-[var(--bo-radius-lg)] border-t border-(--bo-border) bg-(--bo-surface) px-4 py-3"
            data-ui="special-date-save-row"
            data-testid="special-date-save-row"
          >
            <button
              type="button"
              className="bo-btn bo-btn--primary w-full px-8 transition-transform duration-150 active:scale-[0.96] sm:w-auto"
              onClick={() => void handleSave()}
              disabled={saving}
              data-testid="special-date-save-btn"
            >
              {saving ? (
                <span className="flex items-center gap-2" data-testid="special-date-save-saving">
                  <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" data-testid="special-date-save-spinner" />
                  <span data-testid="special-date-save-saving-text">Guardando...</span>
                </span>
              ) : (
                <span data-testid="special-date-save-btn-text">Guardar configuración</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
