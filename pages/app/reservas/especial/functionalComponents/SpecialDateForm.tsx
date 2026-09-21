import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, ImagePlus, Info, Plus, Trash2 } from "lucide-react";

import type { MenuSelectorItem, SpecialDateMenu, SpecialDatePaymentMethod, SpecialDateSettings } from "../../../../../api/types";
import { SPECIAL_DATE_PAYMENT_METHODS } from "../../../../../api/types";
import { createClient } from "../../../../../api/client";
import { useToasts } from "../../../../../ui/feedback/useToasts";
import { Switch } from "../../../../../ui/shadcn/Switch";
import { DatePicker } from "../../../../../ui/inputs/DatePicker";
import { Select } from "../../../../../ui/inputs/Select";
import { PlusMinusCounter } from "../../../../../ui/widgets/PlusMinusCounter";
import { FadeSeparator } from "../../../../../ui/layout/FadeSeparator";

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

/** Backend contract: max_per_table must be >= 1 when the limit is enabled. */
const MAX_PER_TABLE_MIN = 1;

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
  variant = "default",
}: {
  title: string;
  desc: string;
  checked: boolean;
  onToggle: (v: boolean) => void;
  ariaLabel: string;
  testId: string;
  variant?: "default" | "plain";
}) {
  const chrome =
    variant === "plain"
      ? "bg-transparent border-0 shadow-none"
      : "rounded-lg border border-(--bo-border) bg-(--bo-surface-2) active:border-(--bo-accent-border, var(--bo-border))";
  return (
    <div
      data-ui={testId}
      data-testid={testId}
      role="group"
      aria-label={title}
      className={`flex min-h-12 cursor-pointer select-none items-center justify-between gap-3 px-3 py-2 ${chrome}`}
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

/** Vertical-stack label + full-width control. */
function Field({
  label,
  testId,
  children,
}: {
  label: string;
  testId: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1.5" data-testid={testId}>
      <label className="bo-label text-left" data-testid={`${testId}-label`}>{label}</label>
      {children}
    </div>
  );
}

/** Compact payment-method chip with a checkmark when selected. */
function PaymentChip({
  value,
  label,
  selected,
  onClick,
}: {
  value: SpecialDatePaymentMethod;
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={selected}
      onClick={onClick}
      className={`bo-chip inline-flex h-8 items-center gap-1.5 px-3 text-xs transition-transform duration-150 active:scale-[0.96]${selected ? " is-on" : ""}`}
      data-testid={`special-date-payment-method-${value}`}
    >
      {selected ? <Check size={14} strokeWidth={2} aria-hidden="true" /> : null}
      <span>{label}</span>
    </button>
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

  // The adelanto is charged per menu, so the whole adelanto block has nothing
  // to act on until a menu exists. Derived from the live editable rows (not
  // `initial`) so adding or removing a menu flips the fallback immediately.
  const hasNoMenus = editableMenus.length === 0;
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

  const patch = useCallback((p: Partial<SpecialDateSettings>) => {
    setDraft((prev: SpecialDateSettings) => ({ ...prev, ...p }));
  }, []);

  // Turning the limit on must seed a usable value. The backend rejects
  // max_per_table < 1 (and a null value while enabled), so leaving the draft
  // empty rendered the counter at 0 and made "Guardar" fail.
  const handleMaxPerTableToggle = useCallback(
    (checked: boolean) => {
      if (!checked) {
        patch({ max_per_table_enabled: false });
        return;
      }
      const current = toNumberOrNull(maxPerTableDraft);
      const seeded = current != null && current >= MAX_PER_TABLE_MIN ? Math.trunc(current) : MAX_PER_TABLE_MIN;
      setMaxPerTableDraft(String(seeded));
      patch({ max_per_table_enabled: true, max_per_table: seeded });
    },
    [maxPerTableDraft, patch],
  );
  // Never below the floor, even if the draft is empty or malformed.
  const maxPerTableValue = Math.max(MAX_PER_TABLE_MIN, toNumberOrNull(maxPerTableDraft) ?? MAX_PER_TABLE_MIN);

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
    (checked: boolean) => patch({ requires_adelanto: checked }),
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
        menus: checked
          ? editableMenus.map((m) => ({ ...m, adelanto_amount: toNumberOrNull(unifiedAmountDraft) ?? m.adelanto_amount ?? 0 }))
          : editableMenus.map((m) => ({ ...m })),
      });
    },
    [editableMenus, patch, unifiedAmountDraft],
  );
  const handleUnifiedAmountCommit = useCallback(() => {
    const n = toNumberOrNull(unifiedAmountDraft);
    const safe = n != null && n >= 0 ? n : 0;
    patch({ adelanto_unified_amount: safe, menus: editableMenus.map((m) => ({ ...m, adelanto_amount: safe })) });
    setUnifiedAmountDraft(String(safe));
  }, [editableMenus, patch, unifiedAmountDraft]);

  const [addingMenu, setAddingMenu] = React.useState(false);
  // Stable ref so the onClick prop identity doesn't churn across re-renders
  // (avoids duplicate invocations when the button prop swap is briefly stacked).
  const addMenuRowRef = React.useRef<() => void>(() => undefined);
  const addMenuRow = useCallback(() => {
    if (addingMenu) return;
    setAddingMenu(true);
    setEditableMenus((prev) => {
      const usedIds = new Set(prev.map((m) => m.menu_id).filter((v): v is number => typeof v === "number"));
      const nextAvailable = availableMenus.find((am) => !usedIds.has(am.id)) ?? availableMenus[0];
      return [
        ...prev,
        {
          _key: uid(),
          menu_id: nextAvailable?.id ?? null,
          custom_title: null,
          custom_image_url: null,
          adelanto_amount: draft.adelanto_unified ? toNumberOrNull(unifiedAmountDraft) ?? 0 : null,
          position: prev.length,
        },
      ];
    });
    setTimeout(() => setAddingMenu(false), 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addingMenu, availableMenus, draft.adelanto_unified, unifiedAmountDraft]);
  addMenuRowRef.current = addMenuRow;

  const removeMenuRow = useCallback((key: string) => {
    setEditableMenus((prev) => prev.filter((m) => m._key !== key));
  }, []);

  const updateMenuRow = useCallback((key: string, patchRow: Partial<EditableMenu>) => {
    setEditableMenus((prev) => prev.map((m) => (m._key === key ? { ...m, ...patchRow } : m)));
  }, []);

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
        price: m.price ?? null,
        position: idx,
      })),
    };
    try {
      const res = await api.config.saveSpecialDate(payload);
      if (!res.success) {
        pushToast({ kind: "error", title: "Error", message: res.message || "No se pudo guardar la configuración" });
        return;
      }
      // The POST endpoint only returns { success, date } — it does NOT
      // echo the saved settings. Re-fetch via getSpecialDate so the form
      // reflects the real DB row. Without this, the optimistic local
      // `setDraft(res.special_date)` set `draft` to undefined and the next
      // render crashed with "Cannot read properties of undefined
      // (reading 'requires_adelanto')", breaking the whole UI.
      const fresh = await api.config.getSpecialDate(date);
      if (fresh.success) {
        const saved = (fresh as { special_date: SpecialDateSettings | null }).special_date;
        if (saved) {
          setDraft(saved);
          setEditableMenus(withKeys(saved.menus ?? []));
          onSaved?.(saved);
        }
      }
      pushToast({ kind: "success", title: "Guardado", message: "Reservas especiales actualizadas" });
    } catch (e) {
      pushToast({ kind: "error", title: "Error", message: e instanceof Error ? e.message : "No se pudo guardar la configuración" });
    } finally {
      setSaving(false);
    }
  }, [api, date, draft, editableMenus, onSaved, pushToast]);

  return (
    <section
      data-ui="special-date-form"
      data-testid="special-date-form-section"
      aria-label="Reservas especiales"
    >
      <div
        data-ui="special-date-form-card"
        data-testid="special-date-form-card"
        className="bo-panel relative mx-auto w-full max-w-[768px]"
      >
        <div data-slot="panel-head" className="bo-panelHead" data-testid="special-date-form-head">
          <div data-role="title" className="bo-panelTitle" data-testid="special-date-form-title">
            Reservas especiales · {date}
          </div>
          <div data-role="meta" className="bo-panelMeta" data-testid="special-date-form-meta">
            Fecha especial activa
          </div>
        </div>

        {/* Form body — holds every field and, as its last child, the save
            row. The save bar is not sticky any more, so the bottom padding
            here is just breathing room under the save button. */}
        <div
          data-slot="panel-body"
          className="bo-panelBody grid gap-5 pb-6"
          data-testid="special-date-form-body"
        >
          {/* #1 Title + Description — labels above, full width */}
          <Field label="Título" testId="special-date-title-field">
            <input
              className="bo-input w-full"
              value={draft.title}
              onChange={(e) => patch({ title: e.target.value })}
              placeholder="Ej: Cena de gala"
              data-testid="special-date-title-input"
            />
          </Field>

          <FadeSeparator testId="special-date-sep-title-description" />

          <Field label="Descripción" testId="special-date-description-field">
            <textarea
              className="bo-input w-full"
              rows={3}
              value={draft.description}
              onChange={(e) => patch({ description: e.target.value })}
              placeholder="Detalles visibles para el cliente"
              data-testid="special-date-description-input"
            />
          </Field>

          <FadeSeparator testId="special-date-sep-description-menus" />

          {/* #2 Menus — moved above prereserva. Each row is its own card with a
              soft border and a full-width Select that excludes already-chosen
              catalogue menus. */}
          <div data-ui="special-date-menus" data-testid="special-date-menus-section">
            <div className="bo-label mb-1.5 text-left" data-testid="special-date-menus-label">
              Menús de la fecha especial
            </div>
            <div
              className="flex flex-col gap-2"
              data-slot="menusList"
              data-testid="special-date-menus-list"
            >
              {editableMenus.map((m, idx) => {
                const isCustom = !m.menu_id;
                const usedIds = new Set(
                  editableMenus.map((x) => x.menu_id).filter((v): v is number => typeof v === "number"),
                );
                const menuOptions = [
                  { value: "__custom__", label: "Personalizado (título + imagen)" },
                  ...availableMenus
                    .filter((am) => !usedIds.has(am.id) || am.id === m.menu_id)
                    .map((am) => ({ value: String(am.id), label: am.menu_title })),
                ];
                const selectedLabel = isCustom
                  ? "Personalizado (título + imagen)"
                  : availableMenus.find((am) => am.id === m.menu_id)?.menu_title ?? "Selecciona menú";
                return (
                  <div
                    key={m._key}
                    data-testid={`special-date-menu-row-${idx + 1}`}
                    className="grid gap-2.5 rounded-lg border border-(--bo-border) bg-(--bo-surface-2) p-3"
                  >
                    <div
                      className="flex items-center justify-between gap-2"
                      data-testid={`special-date-menu-row-${idx + 1}-head`}
                    >
                      <div className="text-sm font-medium" data-testid={`special-date-menu-row-${idx + 1}-index`}>
                        Menú {idx + 1}
                      </div>
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

                    <div data-slot={`menuSource-${idx}`}>
                      <div
                        className="text-xs text-(--bo-muted)"
                        data-testid={`special-date-menu-row-${idx + 1}-source-label`}
                      >
                        Menú del catálogo
                      </div>
                      <div className="mt-1 w-full" data-testid={`special-date-menu-row-${idx + 1}-source-select`}>
                        <Select
                          value={m.menu_id != null ? String(m.menu_id) : "__custom__"}
                          onChange={(v) => {
                            if (v === "__custom__") updateMenuRow(m._key, { menu_id: null });
                            else updateMenuRow(m._key, { menu_id: Number(v), custom_title: null, custom_image_url: null });
                          }}
                          options={menuOptions}
                          placeholder={selectedLabel}
                          fitWidestOption
                          className="w-full"
                          ariaLabel={`Menú del catálogo para la fila ${idx + 1}`}
                        />
                      </div>
                    </div>

                    {isCustom ? (
                      <>
                        <div data-slot={`menuCustom-${idx}`}>
                          <div
                            className="text-xs text-(--bo-muted)"
                            data-testid={`special-date-menu-row-${idx + 1}-custom-title-label`}
                          >
                            Título personalizado
                          </div>
                          <input
                            className="bo-input mt-1 w-full"
                            value={m.custom_title ?? ""}
                            onChange={(e) => updateMenuRow(m._key, { custom_title: e.target.value })}
                            placeholder="Ej: Menú infantil"
                            data-testid={`special-date-menu-row-${idx + 1}-custom-title-input`}
                          />
                        </div>
                        <div
                          className="flex items-center gap-3"
                          data-slot={`menuCustomImage-${idx}`}
                          data-testid={`special-date-menu-row-${idx + 1}-custom-image`}
                        >
                          {m.custom_image_url ? (
                            <img
                              src={m.custom_image_url}
                              alt={m.custom_title || "Menú personalizado"}
                              className="h-16 w-16 rounded object-cover border border-(--bo-border)"
                              data-testid={`special-date-menu-row-${idx + 1}-custom-image-preview`}
                            />
                          ) : (
                            <div
                              className="flex h-16 w-16 items-center justify-center rounded border border-dashed border-(--bo-border) text-(--bo-muted)"
                              data-testid={`special-date-menu-row-${idx + 1}-custom-image-empty`}
                            >
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
                      </>
                    ) : null}

                    {/* Variable price per menu — used for total / adelanto
                        calculations in the booking wizard. Defaults to the
                        catalogue price when menu_id is set. */}
                    <div
                      className="grid gap-1"
                      data-testid={`special-date-menu-row-${idx + 1}-price-field`}
                    >
                      <div
                        className="text-xs text-(--bo-muted)"
                        data-testid={`special-date-menu-row-${idx + 1}-price-label`}
                      >
                        Precio del menú (€ / persona)
                      </div>
                      <input
                        className="bo-input w-full"
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step={0.5}
                        value={m.price != null ? String(m.price) : ""}
                        onChange={(e) =>
                          updateMenuRow(m._key, { price: toNumberOrNull(e.target.value) })
                        }
                        placeholder="0.00"
                        data-testid={`special-date-menu-row-${idx + 1}-price-input`}
                      />
                    </div>
                  </div>
                );
              })}
              <button
                type="button"
                className="bo-btn bo-btn--ghost flex items-center justify-center gap-2 disabled:opacity-50"
                onClick={() => addMenuRowRef.current()}
                disabled={addingMenu}
                data-testid="special-date-menus-add-btn"
              >
                <Plus size={16} strokeWidth={1.8} aria-hidden="true" />
                Añadir menú
              </button>
            </div>
          </div>

          <FadeSeparator testId="special-date-sep-menus-prereserva" />

          {/* #3 Prereserva toggle */}
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
                      {hasNoMenus ? (
                        /* An adelanto is always charged per menu, so every
                           control in here (payment methods, unified amount,
                           per-menu amounts) is meaningless until at least one
                           menu exists. Show the reason instead of inputs that
                           cannot be applied to anything. */
                        <div
                          className="rounded-lg border border-dashed border-[color:var(--bo-border)] bg-[var(--bo-surface-2)] px-4 py-5 text-center"
                          data-ui="special-date-adelanto-empty"
                          data-testid="special-date-adelanto-empty"
                        >
                          <Info
                            size={18}
                            strokeWidth={1.8}
                            className="mx-auto mb-2 text-[color:var(--bo-card-ink-2)]"
                            aria-hidden="true"
                            data-testid="special-date-adelanto-empty-icon"
                          />
                          <p
                            className="text-sm font-medium text-[color:var(--bo-text)]"
                            data-testid="special-date-adelanto-empty-title"
                          >
                            Añade un menú primero
                          </p>
                          <p
                            className="mt-1 text-xs text-[color:var(--bo-card-ink-2)]"
                            data-testid="special-date-adelanto-empty-desc"
                          >
                            El adelanto se cobra por menú. Añade al menos un menú en
                            “Menús de la fecha especial” para configurarlo.
                          </p>
                        </div>
                      ) : (
                      <>
                      {/* Payment methods — extra top margin, compact chips with tick. */}
                      <div data-ui="special-date-payment-methods-field" data-testid="special-date-payment-methods-field">
                        <div
                          className="bo-label mb-3 text-left"
                          data-testid="special-date-payment-methods-label"
                        >
                          Métodos de pago aceptados
                        </div>
                        <div
                          className="bo-chips"
                          data-slot="paymentMethodsChips"
                          data-testid="special-date-payment-methods-chips"
                        >
                          {SPECIAL_DATE_PAYMENT_METHODS.map((m) => (
                            <PaymentChip
                              key={m.value}
                              value={m.value}
                              label={m.label}
                              selected={draft.adelanto_payment_methods.includes(m.value)}
                              onClick={() => togglePaymentMethod(m.value)}
                            />
                          ))}
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
                        <Field label="Adelanto por persona (€)" testId="special-date-unified-amount-field">
                          <input
                            className="bo-input w-full"
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
                        </Field>
                      ) : null}

                      {!draft.adelanto_unified && editableMenus.length > 0 ? (
                        <div data-ui="special-date-per-menu-amounts" data-testid="special-date-per-menu-amounts">
                          <div
                            className="bo-label mb-1.5 text-left"
                            data-testid="special-date-per-menu-amounts-label"
                          >
                            Adelanto por menú
                          </div>
                          <div
                            className="flex flex-col gap-2"
                            data-slot="perMenuAmountsList"
                            data-testid="special-date-per-menu-amounts-list"
                          >
                            {editableMenus.map((m) => {
                              const label =
                                m.custom_title ||
                                availableMenus.find((am) => am.id === m.menu_id)?.menu_title ||
                                `Menú ${m._key.slice(-4)}`;
                              return (
                                <div
                                  key={m._key}
                                  className="flex items-center justify-between gap-3 rounded-lg border border-(--bo-border) bg-(--bo-surface-2) px-3 py-2"
                                  data-testid={`special-date-per-menu-amount-row-${m._key}`}
                                >
                                  <div
                                    className="text-sm"
                                    data-testid={`special-date-per-menu-amount-row-${m._key}-label`}
                                  >
                                    {label}
                                  </div>
                                  <input
                                    className="bo-input"
                                    style={{ maxWidth: 120 }}
                                    type="number"
                                    inputMode="decimal"
                                    min={0}
                                    step={0.5}
                                    value={m.adelanto_amount != null ? String(m.adelanto_amount) : ""}
                                    onChange={(e) =>
                                      updateMenuRow(m._key, { adelanto_amount: toNumberOrNull(e.target.value) })
                                    }
                                    placeholder="0.00"
                                    data-testid={`special-date-per-menu-amount-row-${m._key}-input`}
                                  />
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : null}
                      </>
                      )}

                      {/* Prereserva window */}
                      <div data-ui="special-date-prereserva-window" data-testid="special-date-prereserva-window">
                        <div
                          className="bo-label mb-1.5 text-left"
                          data-testid="special-date-prereserva-window-label"
                        >
                          Ventana de prereserva
                        </div>
                        <div
                          className="flex flex-col gap-3 sm:flex-row"
                          data-slot="prereservaWindowRow"
                          data-testid="special-date-prereserva-window-row"
                        >
                          <div
                            className="grid gap-1"
                            data-slot="prereservaStart"
                            data-testid="special-date-prereserva-start-field"
                          >
                            <div
                              className="text-xs text-(--bo-muted)"
                              data-testid="special-date-prereserva-start-label"
                            >
                              Desde
                            </div>
                            <DatePicker
                              className="w-full"
                              value={draft.prereserva_starts_on ?? ""}
                              onChange={(iso: string) => patch({ prereserva_starts_on: iso || null })}
                              data-testid="special-date-prereserva-start-input"
                            />
                          </div>
                          <div
                            className="grid gap-1"
                            data-slot="prereservaEnd"
                            data-testid="special-date-prereserva-end-field"
                          >
                            <div
                              className="text-xs text-(--bo-muted)"
                              data-testid="special-date-prereserva-end-label"
                            >
                              Hasta
                            </div>
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

          <FadeSeparator testId="special-date-sep-prereserva-maxpertable" />

          {/* Max per table (kept at the end of the active group). */}
          <ToggleRow
            title="Máximo por mesa"
            desc="Limita el número de comensales por reserva para esta fecha"
            checked={draft.max_per_table_enabled}
            onToggle={handleMaxPerTableToggle}
            ariaLabel="Activar máximo por mesa"
            testId="special-date-max-per-table-row"
            variant="plain"
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
                className="flex justify-center rounded-none border-0 bg-transparent shadow-none"
              >
                <PlusMinusCounter
                  variant="counter"
                  label="Máximo por mesa"
                  value={maxPerTableValue}
                  canDecrease={maxPerTableValue > MAX_PER_TABLE_MIN}
                  onDecrease={() => {
                    const next = Math.max(MAX_PER_TABLE_MIN, maxPerTableValue - 1);
                    setMaxPerTableDraft(String(next));
                    patch({ max_per_table: next });
                  }}
                  onIncrease={() => {
                    const next = maxPerTableValue + 1;
                    setMaxPerTableDraft(String(next));
                    patch({ max_per_table: next });
                  }}
                  helperText={`Mínimo ${MAX_PER_TABLE_MIN}`}
                />
              </motion.div>
            ) : null}
          </AnimatePresence>
          {/* Save row — last child of the form body. It is a plain sibling
              of the fields above (never inside an AnimatePresence subtree),
              so it does not reintroduce the Vike transform trap from
              PR #395/#396. Not sticky: it scrolls with the page so the
              "Guardar" button does not move while the operator scrolls. */}
          <div
            className="mt-1 flex w-full justify-end border-t border-[color:var(--bo-border)] pt-4"
            data-ui="special-date-save-row"
            data-testid="special-date-save-row"
          >
            <button
              type="button"
              className="bo-btn bo-btn--primary w-full px-8 transition-transform duration-150 active:scale-[0.96] motion-reduce:transition-none sm:w-auto"
              onClick={() => void handleSave()}
              disabled={saving}
              data-testid="special-date-save-btn"
            >
              {saving ? (
                <span className="flex items-center gap-2" data-testid="special-date-save-saving">
                  <span
                    className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
                    data-testid="special-date-save-spinner"
                  />
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
