import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Minus, Plus, Trash2 } from "lucide-react";
import { ReactCountryFlag as CountryFlag } from "react-country-flag";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import { createClient } from "../../../../../api/client";
import type { ConfigFloor, GroupMenu, GroupMenuSummary } from "../../../../../api/types";
import { DatePicker } from "../../../../../ui/inputs/DatePicker";
import { TimePicker } from "../../../../../ui/inputs/TimePicker";
import { Select } from "../../../../../ui/inputs/Select";
import { InlineAlert } from "../../../../../ui/feedback/InlineAlert";
import { InlineCounter } from "../../../../../ui/widgets/InlineCounter";
import { Panel } from "../../../../../ui/shell/Panel";
import { ScrollArea } from "../../../../../ui/layout/ScrollArea";

import { principalesItemsFromMenu, type PrincipalesRow, type RiceRow } from "./bookingDraft";

type API = ReturnType<typeof createClient>;

function onlyDigits(s: string): string {
  return String(s || "").replace(/[^0-9]/g, "");
}

function clampInt(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

function sumServings(rows: Array<{ servings: number }>): number {
  return rows.reduce((acc, r) => acc + (Number(r.servings) || 0), 0);
}

const phoneCodeOptions = [
  { value: "34", label: "+34 ES", icon: <CountryFlag countryCode="ES" svg aria-label="España" /> },
  { value: "33", label: "+33 FR", icon: <CountryFlag countryCode="FR" svg aria-label="Francia" /> },
  { value: "39", label: "+39 IT", icon: <CountryFlag countryCode="IT" svg aria-label="Italia" /> },
  { value: "44", label: "+44 UK", icon: <CountryFlag countryCode="GB" svg aria-label="Reino Unido" /> },
  { value: "49", label: "+49 DE", icon: <CountryFlag countryCode="DE" svg aria-label="Alemania" /> },
  { value: "351", label: "+351 PT", icon: <CountryFlag countryCode="PT" svg aria-label="Portugal" /> },
  { value: "1", label: "+1 US", icon: <CountryFlag countryCode="US" svg aria-label="Estados Unidos" /> },
];

function normalizePhoneParts(countryCodeRaw: string, phoneRaw: string): { cc: string; national: string; e164Digits: string } | null {
  let cc = onlyDigits(countryCodeRaw);
  const phone = onlyDigits(phoneRaw);

  if (cc === "") cc = "34";
  if (cc.length < 1 || cc.length > 4) return null;

  // If the user typed a full E.164 number in the phone field, avoid double-prefixing.
  if (phone.length >= 8 && phone.length <= 15 && phone.startsWith(cc) && phone.length > 9) {
    const national = phone.slice(cc.length);
    if (!national) return null;
    return { cc, national, e164Digits: phone };
  }

  if (phone.length < 6 || phone.length > 15) return null;
  if (cc.length + phone.length > 15) return null;
  return { cc, national: phone, e164Digits: cc + phone };
}

export type BookingEditorDraft = {
  reservation_date: string;
  reservation_time: string;
  party_size: number;
  customer_name: string;
  contact_phone: string;
  contact_phone_country_code: string;
  contact_email: string;
  table_number: string;
  babyStrollers: number;
  highChairs: number;
  preferred_floor_number: number | null;

  special_menu: boolean;
  menu_de_grupo_id: number | null;
  principales: PrincipalesRow[];

  arroz_enabled: boolean;
  arroz: RiceRow[];
  commentary: string;
};

export function BookingEditor({
  api,
  initial,
  busy,
  submitLabel,
  onSubmit,
  onCancel,
  stickyFooter = false,
  floors = [],
  bodyClassName,
  renderFooter,
}: {
  api: API;
  initial: BookingEditorDraft;
  busy: boolean;
  submitLabel: string;
  onSubmit: (payload: any) => Promise<void>;
  onCancel?: () => void;
  stickyFooter?: boolean;
  floors?: ConfigFloor[];
  /** Extra class(es) appended to the scrollable body wrapper for custom CSS overrides. */
  bodyClassName?: string;
  /** When provided, the footer is passed to this callback instead of being
   *  rendered inside the editor. Used with stickyFooter so the parent can
   *  place the footer at the modal level for full-width spanning. */
  renderFooter?: (footer: React.ReactNode) => void;
}) {
  const reduceMotion = useReducedMotion();
  const [draft, setDraft] = useState<BookingEditorDraft>(initial);
  const [formError, setFormError] = useState<string | null>(null);

  // Reload state if initial changes (booking switch).
  useEffect(() => setDraft(initial), [initial]);

  const [menus, setMenus] = useState<GroupMenuSummary[]>([]);
  const [menusLoaded, setMenusLoaded] = useState(false);
  const [menuDetail, setMenuDetail] = useState<GroupMenu | null>(null);
  const [riceTypes, setRiceTypes] = useState<string[]>([]);
  const [riceTypesLoaded, setRiceTypesLoaded] = useState(false);

  const principalesItems = useMemo(() => principalesItemsFromMenu(menuDetail), [menuDetail]);
  const menuOptions = useMemo(
    () => menus.map((m) => ({ value: String(m.id), label: `${m.menu_title} · ${m.price}€` })),
    [menus],
  );
  const principalOptions = useMemo(
    () => principalesItems.map((it) => ({ value: it, label: it })),
    [principalesItems],
  );
  const arrozOptions = useMemo(
    () => riceTypes.map((t) => ({ value: t, label: t })),
    [riceTypes],
  );
  const floorOptions = useMemo(() => {
    const activeFloors = floors.filter((floor) => floor.active);
    return [
      { value: "", label: "Sin preferencia" },
      ...activeFloors.map((floor) => ({ value: String(floor.floorNumber), label: floor.name })),
    ];
  }, [floors]);

  useEffect(() => {
    if (!draft.special_menu) {
      setMenusLoaded(false);
      return;
    }
    let cancelled = false;
    setMenusLoaded(false);
    (async () => {
      const minDelay = new Promise<void>((resolve) => setTimeout(resolve, 1000));
      try {
        const res = await api.menus.grupos.list("active");
        if (cancelled) return;
        if (res.success) setMenus(res.menus || []);
      } catch {
        // ignore
      } finally {
        await minDelay;
        if (!cancelled) setMenusLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [api.menus.grupos, draft.special_menu]);

  useEffect(() => {
    if (!draft.special_menu) {
      setMenuDetail(null);
      return;
    }
    const id = draft.menu_de_grupo_id;
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await api.menus.grupos.get(id);
        if (!res.success) return;
        if (cancelled) return;
        setMenuDetail(res.menu || null);
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [api.menus.grupos, draft.menu_de_grupo_id, draft.special_menu]);

  useEffect(() => {
    // Seed one principal row when a group menu is selected and its items arrive,
    // so the selection UI is immediately available (mirrors the arroz row).
    if (!draft.special_menu || !draft.menu_de_grupo_id || principalesItems.length === 0) return;
    setDraft((p) => {
      if (p.principales.length > 0) return p;
      return { ...p, principales: [{ name: "", servings: 1 }] };
    });
  }, [draft.special_menu, draft.menu_de_grupo_id, principalesItems.length, setDraft]);

  useEffect(() => {
    if (draft.special_menu) return;
    if (!draft.arroz_enabled) {
      setRiceTypesLoaded(false);
      return;
    }
    if (riceTypesLoaded) return;
    let cancelled = false;
    setRiceTypesLoaded(false);
    (async () => {
      try {
        const list = await api.arrozTypes.list();
        if (cancelled) return;
        setRiceTypes(Array.isArray(list) ? list : []);
      } catch {
        // ignore
      } finally {
        if (!cancelled) setRiceTypesLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [api.arrozTypes, draft.arroz_enabled, draft.special_menu, riceTypesLoaded]);

  const remainingArroz = useMemo(() => Math.max(0, (draft.party_size || 0) - sumServings(draft.arroz)), [draft.arroz, draft.party_size]);
  const remainingPrincipales = useMemo(
    () => Math.max(0, (draft.party_size || 0) - sumServings(draft.principales.filter((row) => row.name))),
    [draft.party_size, draft.principales],
  );
  const requiredFieldsComplete = useMemo(() => {
    const date = String(draft.reservation_date || "").trim();
    const time = String(draft.reservation_time || "").trim();
    const name = String(draft.customer_name || "").trim();
    const phone = normalizePhoneParts(draft.contact_phone_country_code, draft.contact_phone);
    const menuId = Number(draft.menu_de_grupo_id || 0);

    return /^\d{4}-\d{2}-\d{2}$/.test(date) && Boolean(time) && Boolean(name) && Boolean(phone) && (!draft.special_menu || menuId > 0);
  }, [draft]);

  const setField = useCallback(<K extends keyof BookingEditorDraft>(key: K, value: BookingEditorDraft[K]) => {
    setDraft((p) => ({ ...p, [key]: value }));
  }, []);

  const toggleSpecialMenu = useCallback(
    (v: boolean) => {
      setFormError(null);
      setDraft((p) => {
        if (v) {
          return { ...p, special_menu: true, arroz_enabled: false, arroz: [], commentary: "" };
        }
        return { ...p, special_menu: false, menu_de_grupo_id: null, principales: [] };
      });
    },
    [],
  );

  const toggleArroz = useCallback(
    (v: boolean) => {
      setFormError(null);
      setDraft((p) => {
        if (!v) return { ...p, arroz_enabled: false, arroz: [] };
        // Ensure at least one row regardless of whether rice types have loaded yet;
        // the select options populate when the types arrive.
        const row: RiceRow = { type: "", servings: 2 };
        return { ...p, arroz_enabled: true, arroz: p.arroz.length ? p.arroz : [row] };
      });
    },
    [],
  );

  const addRiceRow = useCallback(() => {
    setDraft((p) => ({ ...p, arroz: [...p.arroz, { type: "", servings: 2 }] }));
  }, []);

  const removeRiceRow = useCallback((idx: number) => {
    setDraft((p) => ({ ...p, arroz: p.arroz.filter((_, i) => i !== idx) }));
  }, []);

  const updateRiceRow = useCallback((idx: number, patch: Partial<RiceRow>) => {
    setDraft((p) => ({
      ...p,
      arroz: p.arroz.map((r, i) => (i === idx ? { ...r, ...patch } : r)),
    }));
  }, []);

  const addPrincipalRow = useCallback(() => {
    setDraft((p) => ({ ...p, principales: [...p.principales, { name: "", servings: 1 }] }));
  }, []);

  const removePrincipalRow = useCallback((idx: number) => {
    setDraft((p) => ({ ...p, principales: p.principales.filter((_, i) => i !== idx) }));
  }, []);

  const updatePrincipalRow = useCallback((idx: number, patch: Partial<PrincipalesRow>) => {
    setDraft((p) => ({
      ...p,
      principales: p.principales.map((r, i) => (i === idx ? { ...r, ...patch } : r)),
    }));
  }, []);

  const submit = useCallback(async () => {
    setFormError(null);

    const date = String(draft.reservation_date || "").trim();
    const time = String(draft.reservation_time || "").trim();
    const partySize = clampInt(Number(draft.party_size || 0), 1, 10_000);
    const name = String(draft.customer_name || "").trim();
    const phoneNorm = normalizePhoneParts(draft.contact_phone_country_code, draft.contact_phone);

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return setFormError("Fecha inválida (YYYY-MM-DD)");
    if (!time) return setFormError("Hora inválida");
    if (!name) return setFormError("Nombre inválido");
    if (!phoneNorm) return setFormError("Teléfono inválido");

    const payload: any = {
      reservation_date: date,
      reservation_time: time,
      party_size: partySize,
      customer_name: name,
      contact_phone: phoneNorm.national,
      contact_phone_country_code: phoneNorm.cc,
      contact_email: String(draft.contact_email || "").trim() || undefined,
      table_number: String(draft.table_number || "").trim(),
      babyStrollers: clampInt(Number(draft.babyStrollers || 0), 0, 100),
      highChairs: clampInt(Number(draft.highChairs || 0), 0, 100),
      preferred_floor_number: draft.preferred_floor_number,
      special_menu: Boolean(draft.special_menu),
    };

    if (draft.special_menu) {
      const menuId = Number(draft.menu_de_grupo_id || 0);
      if (!Number.isFinite(menuId) || menuId <= 0) return setFormError("Selecciona un menú de grupo");
      payload.menu_de_grupo_id = menuId;

      const rows = draft.principales
        .map((r) => ({ name: String(r.name || "").trim(), servings: clampInt(Number(r.servings || 0), 0, 10_000) }))
        .filter((r) => r.name && r.servings > 0);

      const total = sumServings(rows);
      if (total > partySize) return setFormError("Las raciones de principales superan el número de comensales");
      payload.principales_json = rows;
    } else {
      payload.commentary = String(draft.commentary || "").trim();
      if (draft.arroz_enabled) {
        const rows = draft.arroz
          .map((r) => ({ type: String(r.type || "").trim(), servings: clampInt(Number(r.servings || 0), 0, 10_000) }))
          .filter((r) => r.type && r.servings > 0);

        // UI rule: 2 raciones minimum per arroz (legacy hint).
        const badMin = rows.find((r) => r.servings > 0 && r.servings < 2);
        if (badMin) return setFormError("Mínimo 2 raciones por arroz");

        const total = sumServings(rows);
        if (total > partySize) return setFormError("Las raciones de arroz superan el número de comensales");

        payload.arroz_types = rows.map((r) => r.type);
        payload.arroz_servings = rows.map((r) => r.servings);
      } else {
        payload.arroz_types = [];
        payload.arroz_servings = [];
      }
    }

    await onSubmit(payload);
  }, [draft, onSubmit]);

  const isCreate = submitLabel === "Crear";
  const submitDisabled = busy || (isCreate && !requiredFieldsComplete);

  const footerNode = (
    <div
      className={stickyFooter ? "bo-modalActions bo-modalActions--reservas bo-bookingEditorFooter" : `bo-row${isCreate ? " bo-bookingEditorActions--create" : ""}`}
      style={stickyFooter ? undefined : { justifyContent: isCreate ? "center" : "flex-end" }}
      data-slot="booking-editor-actions"
    >
      {onCancel ? (
        <button className="bo-btn bo-btn--ghost" type="button" onClick={onCancel} disabled={busy} data-slot="booking-editor-cancel">
          Cerrar
        </button>
      ) : null}
      <button className="bo-btn bo-btn--primary" type="button" onClick={() => void submit()} disabled={submitDisabled} data-slot="booking-editor-submit">
        {submitLabel}
      </button>
      {isCreate && !requiredFieldsComplete ? <div className="bo-bookingEditorRequiredHint" data-slot="booking-editor-required-hint">Por favor rellena los campos obligatorios</div> : null}
    </div>
  );

  // When renderFooter is provided, pass the footer element up so the parent
  // can render it at the modal level (direct child of Modal) for full-width.
  useEffect(() => {
    if (renderFooter && stickyFooter) {
      renderFooter(footerNode);
    }
  });

  return (
    <div className={`bo-stack bo-bookingEditor${stickyFooter ? " bo-bookingEditor--stickyFooter" : ""}`} style={{ gap: 14 }} data-slot="bookingEditor-div">
      {formError ? <InlineAlert kind="error" title="Error" message={formError} /> : null}
      <ScrollArea dataSlot="booking-editor-body" className={bodyClassName}><div className={`bo-bookingEditorBody${stickyFooter ? "" : " bo-bookingEditorBody--inline"}`} data-slot="bookingEditor-div">

      <div className="bo-panel bo-bookingPanel--customer" data-slot="bookingEditor-bookingPanel--customer">
        <div className="bo-panelHead" data-slot="bookingEditor-panelHead">
          <div className="bo-panelTitle" data-slot="bookingEditor-panelTitle">Datos</div>
          <div className="bo-panelMeta" data-slot="bookingEditor-panelMeta">{draft.special_menu ? "Menú de grupo" : "Reserva"}</div>
        </div>
        <div className="bo-panelBody bo-bookingPanelBody--customer" style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignContent: "center", alignItems: "center", maxWidth: 500, margin: "0 auto", gap: 12 }} data-slot="bookingEditor-bookingPanelBody--customer">
          <div className="bo-row bo-bookingRow bo-bookingRow--schedule" style={{ width: "100%", justifyContent: "center" }} data-slot="booking-editor-schedule">
            <div className="bo-field bo-field--inline bo-bookingField bo-bookingField--date" data-slot="booking-editor-date">
              <div className="bo-label" style={{ textAlign: "left" }} data-slot="bookingEditor-label">Fecha</div>
              <DatePicker value={draft.reservation_date} onChange={(v) => setField("reservation_date", v)} />
            </div>
            <div className="bo-field bo-field--inline bo-bookingField bo-bookingField--time" data-slot="booking-editor-time">
              <div className="bo-label" style={{ textAlign: "left" }} data-slot="bookingEditor-label">Hora</div>
              <TimePicker value={draft.reservation_time} onChange={(v) => setField("reservation_time", v)} ariaLabel="Hora" />
            </div>
          </div>

          <CounterField
            className="bo-bookingField bo-bookingField--party"
            style={{ width: "100%" }}
            label="Pax"
            value={draft.party_size || 1}
            min={1}
            max={10000}
            onChange={(v) => setField("party_size", v)}
          />

          <div className="bo-field bo-bookingField bo-bookingField--client" style={{ width: "100%" }} data-slot="booking-editor-client">
            <div className="bo-label" style={{ textAlign: "center" }} data-slot="bookingEditor-label">Nombre cliente</div>
            <input className="bo-input bo-input--sm" style={{ textAlign: "center", width: "100%" }} value={draft.customer_name} onChange={(e) => setField("customer_name", e.target.value)} data-slot="booking-editor-client-input" />
          </div>

          <div className="bo-field bo-bookingField bo-bookingField--phone" style={{ width: "100%" }} data-slot="booking-editor-phone">
            <div className="bo-label" style={{ textAlign: "center" }} data-slot="bookingEditor-label">Teléfono</div>
            <div className="bo-phone" style={{ justifyContent: "center" }} data-slot="booking-editor-phone-group">
              <Select
                className="bo-selectBtn--sm bo-phoneCC"
                style={{ display: "flex", justifyContent: "center" }}
                size="sm"
                value={draft.contact_phone_country_code}
                onChange={(v) => setField("contact_phone_country_code", v)}
                ariaLabel="Prefijo"
                options={phoneCodeOptions}
              />
              <input
                className="bo-input bo-input--sm bo-phoneNum"
                style={{ textAlign: "center" }}
                inputMode="tel"
                value={draft.contact_phone}
                onChange={(e) => setField("contact_phone", e.target.value)}
                aria-label="Teléfono"
                data-slot="booking-editor-phone-input"
              />
            </div>
          </div>

          <div className="bo-field bo-bookingField bo-bookingField--email" style={{ width: "100%" }} data-slot="booking-editor-email">
            <div className="bo-label" style={{ textAlign: "center" }} data-slot="bookingEditor-label">Email (opcional)</div>
            <input className="bo-input bo-input--sm" style={{ textAlign: "center", width: "100%" }} value={draft.contact_email} onChange={(e) => setField("contact_email", e.target.value)} data-slot="booking-editor-email-input" />
          </div>

          <CounterField
            className="bo-bookingField bo-bookingField--strollers"
            style={{ width: "100%" }}
            label="Carros"
            value={draft.babyStrollers || 0}
            min={0}
            max={100}
            onChange={(v) => setField("babyStrollers", v)}
          />

          <CounterField
            className="bo-bookingField bo-bookingField--highchairs"
            style={{ width: "100%" }}
            label="Tronas"
            value={draft.highChairs || 0}
            min={0}
            max={100}
            onChange={(v) => setField("highChairs", v)}
          />

          <div className="bo-field bo-bookingField bo-bookingField--salon" style={{ width: "100%" }} data-slot="booking-editor-salon">
            <div className="bo-label" style={{ textAlign: "center" }} data-slot="bookingEditor-label">Salón</div>
            <Select
              className="bo-selectBtn--sm"
              style={{ width: "100%", display: "flex", justifyContent: "center" }}
              size="sm"
              value={draft.preferred_floor_number != null ? String(draft.preferred_floor_number) : ""}
              onChange={(v) => setField("preferred_floor_number", v ? Number(v) : null)}
              options={floorOptions}
              ariaLabel="Salón"
            />
          </div>

          <div className="bo-field bo-bookingField bo-bookingField--table" style={{ width: "100%" }} data-slot="booking-editor-table">
            <div className="bo-label" style={{ textAlign: "center" }} data-slot="bookingEditor-label">Mesa</div>
            <input
              className="bo-input bo-input--sm"
              style={{ width: 110, textAlign: "center", display: "block", margin: "0 auto" }}
              value={draft.table_number}
              onChange={(e) => setField("table_number", e.target.value)}
              data-slot="booking-editor-table-input"
            />
          </div>
        </div>
      </div>

      <Panel className="bo-bookingPanel--menu" data-slot="bookingEditor-panel" title="Menú de grupo" meta={draft.special_menu ? "Sí" : "No"}>
          <div className="bo-chips bo-bookingBinaryChips" role="group" aria-label="Menú de grupo" data-slot="booking-editor-menu-toggle">
            <button type="button" className={`bo-chip${draft.special_menu ? "" : " is-on"}`} onClick={() => toggleSpecialMenu(false)} disabled={busy} data-slot="booking-editor-menu-no">
              No
            </button>
            <button type="button" className={`bo-chip${draft.special_menu ? " is-on" : ""}`} onClick={() => toggleSpecialMenu(true)} disabled={busy} data-slot="booking-editor-menu-yes">
              Sí
            </button>
          </div>

          <AnimatePresence mode="wait" initial={false}>
          {draft.special_menu && !menusLoaded ? (
            <motion.div
              key="menu-loading"
              style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 10, justifyContent: "center", padding: "24px 0" }}
              initial={reduceMotion ? { opacity: 1 } : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={reduceMotion ? { opacity: 1 } : { opacity: 0 }}
              transition={reduceMotion ? { duration: 0 } : { duration: 0.25, ease: "easeOut" }}
              data-slot="booking-editor-menu-loading"
            >
              <span className="bo-spinner" aria-hidden="true" />
              <span className="bo-mutedText">Cargando menús de grupo…</span>
            </motion.div>
          ) : draft.special_menu && menus.length === 0 ? (
            <motion.div
              key="menu-empty"
              style={{ marginTop: 12, display: "grid", gap: 12 }}
              initial={reduceMotion ? { opacity: 1 } : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={reduceMotion ? { opacity: 1 } : { opacity: 0 }}
              transition={reduceMotion ? { duration: 0 } : { duration: 0.25, ease: "easeOut" }}
              data-slot="booking-editor-menu-empty"
            >
              <div className="bo-mutedText" data-slot="booking-editor-menu-empty-message">
                No hay menús de grupo. Debes crear un menú de grupo antes de poder asignarlo a una reserva.
              </div>
              <a
                className="bo-btn bo-btn--primary"
                href="/app/menus"
                style={{ justifySelf: "center", textDecoration: "none" }}
                data-slot="booking-editor-menu-create-link"
              >
                <Plus size={18} strokeWidth={1.8} /> Crear menú de grupo
              </a>
            </motion.div>
          ) : draft.special_menu ? (
            <motion.div
              key="menu-content"
              style={{ marginTop: 12, display: "grid", gap: 10 }}
              initial={reduceMotion ? { opacity: 1 } : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={reduceMotion ? { opacity: 1 } : { opacity: 0 }}
              transition={reduceMotion ? { duration: 0 } : { duration: 0.25, ease: "easeOut" }}
              data-slot="bookingEditor-div"
            >
              <div className="bo-field bo-bookingMenuSelectField" data-slot="booking-editor-menu-select-field">
                <div className="bo-label" data-slot="bookingEditor-label">Seleccionar menú</div>
                <Select
                  className="bo-selectBtn--sm"
                  size="sm"
                  style={{ width: "fit-content" }}
                  value={draft.menu_de_grupo_id ? String(draft.menu_de_grupo_id) : ""}
                  onChange={(v) => setField("menu_de_grupo_id", v ? Number(v) : null)}
                  options={menuOptions}
                  placeholder="Selecciona…"
                  ariaLabel="Seleccionar menú"
                />
              </div>

              {draft.menu_de_grupo_id ? (
                <div style={{ display: "grid", gap: 10 }} data-slot="booking-editor-menu-principales">
                  <div className="bo-mutedText" data-slot="bookingEditor-mutedText">Principales (restantes: {remainingPrincipales})</div>
                  <div style={{ display: "grid", gap: 8 }} data-slot="bookingEditor-div">
                    {draft.principales.map((row, idx) => (
                      <div key={idx} className="bo-row bo-bookingChoiceRow" style={{ gap: 8 }} data-slot="bookingEditor-bookingChoiceRow">
                        <div className="bo-bookingChoiceSelectorRow" data-slot="booking-editor-principal-selector-row">
                          <Select
                            className="bo-selectBtn--sm bo-bookingChoiceSelect"
                            size="sm"
                            style={{ flex: "0 0 auto" }}
                            value={row.name}
                            onChange={(v) => updatePrincipalRow(idx, { name: v, servings: Math.min(row.servings, row.name ? remainingPrincipales + row.servings : remainingPrincipales) })}
                            options={principalOptions}
                            placeholder="Selecciona…"
                            ariaLabel="Principal"
                          />
                          <button type="button" className="bo-actionBtn" onClick={() => removePrincipalRow(idx)} aria-label="Quitar principal" disabled={busy} data-slot={`booking-editor-remove-principal-${idx}`}>
                            <Trash2 size={18} strokeWidth={1.8} />
                          </button>
                        </div>
                        {row.name ? (
                          <div className="bo-bookingChoiceActions" data-slot="bookingEditor-bookingChoiceActions">
                            <InlineCounter
                              label="Raciones"
                              value={row.servings || 0}
                              onChange={(v) => updatePrincipalRow(idx, { servings: v })}
                              min={0}
                              max={Math.max(0, remainingPrincipales + row.servings)}
                              disabled={busy}
                              className="bo-bookingChoiceServings"
                            />
                          </div>
                        ) : null}
                      </div>
                    ))}
                    {remainingPrincipales > 0 ? (
                      <button type="button" className="bo-btn bo-btn--ghost" onClick={addPrincipalRow} disabled={busy || !principalesItems.length} data-slot="booking-editor-add-principal">
                        <Plus size={18} strokeWidth={1.8} /> Añadir principal
                      </button>
                    ) : null}
                    {!principalesItems.length ? <div className="bo-mutedText" data-slot="booking-editor-no-principales-message">Este menú no tiene lista de principales.</div> : null}
                  </div>
                </div>
              ) : null}
            </motion.div>
          ) : null}
          </AnimatePresence>
      </Panel>

      {!draft.special_menu ? (
        <Panel className="bo-bookingPanel--arroz" data-slot="bookingEditor-panel" title="Arroz" meta={draft.arroz_enabled ? "Sí" : "No"}>
            <div className="bo-chips bo-bookingBinaryChips" role="group" aria-label="¿Desea arroz?" data-slot="booking-editor-arroz-toggle">
              <button type="button" className={`bo-chip${draft.arroz_enabled ? "" : " is-on"}`} onClick={() => toggleArroz(false)} disabled={busy} data-slot="booking-editor-arroz-no">
                No
              </button>
              <button type="button" className={`bo-chip${draft.arroz_enabled ? " is-on" : ""}`} onClick={() => toggleArroz(true)} disabled={busy} data-slot="booking-editor-arroz-yes">
                Sí
              </button>
            </div>
            <AnimatePresence mode="wait" initial={false}>
            {draft.arroz_enabled && !riceTypesLoaded ? (
              <motion.div
                key="arroz-loading"
                style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 10, justifyContent: "center", padding: "24px 0" }}
                initial={reduceMotion ? { opacity: 1 } : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={reduceMotion ? { opacity: 1 } : { opacity: 0 }}
                transition={reduceMotion ? { duration: 0 } : { duration: 0.25, ease: "easeOut" }}
                data-slot="booking-editor-arroz-loading"
              >
                <span className="bo-spinner" aria-hidden="true" />
                <span className="bo-mutedText">Cargando tipos de arroz…</span>
              </motion.div>
            ) : draft.arroz_enabled && riceTypes.length === 0 && riceTypesLoaded ? (
              <motion.div
                key="arroz-empty"
                style={{ marginTop: 12, display: "grid", gap: 12 }}
                initial={reduceMotion ? { opacity: 1 } : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={reduceMotion ? { opacity: 1 } : { opacity: 0 }}
                transition={reduceMotion ? { duration: 0 } : { duration: 0.25, ease: "easeOut" }}
                data-slot="booking-editor-arroz-empty"
              >
                <div className="bo-mutedText" data-slot="booking-editor-arroz-empty-message">
                  No hay tipos de arroz. Debes crear un tipo de arroz antes de poder añadirlo a una reserva.
                </div>
                <a
                  className="bo-btn bo-btn--primary"
                  href="/app/comida"
                  style={{ justifySelf: "center", textDecoration: "none" }}
                  data-slot="booking-editor-arroz-create-link"
                >
                  <Plus size={18} strokeWidth={1.8} /> Añadir tipo de arroz
                </a>
              </motion.div>
            ) : draft.arroz_enabled && riceTypes.length > 0 ? (
              <motion.div
                key="arroz-content"
                style={{ marginTop: 10, display: "grid", gap: 8 }}
                initial={reduceMotion ? { opacity: 1 } : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={reduceMotion ? { opacity: 1 } : { opacity: 0 }}
                transition={reduceMotion ? { duration: 0 } : { duration: 0.25, ease: "easeOut" }}
                data-slot="booking-editor-arroz-content"
              >
                <div className="bo-mutedText">Mínimo 2 raciones por arroz · restantes: {remainingArroz}</div>
                {draft.arroz.map((row, idx) => (
                  <div key={idx} className="bo-row bo-bookingChoiceRow" style={{ gap: 8 }} data-slot="bookingEditor-bookingChoiceRow">
                    <div className="bo-bookingChoiceSelectorRow" data-slot="booking-editor-rice-selector-row">
                      <Select
                        className="bo-selectBtn--sm bo-bookingChoiceSelect"
                        size="sm"
                        style={{ flex: "0 0 auto" }}
                        value={row.type}
                        onChange={(v) => updateRiceRow(idx, { type: v })}
                        options={arrozOptions}
                        placeholder="Selecciona…"
                        ariaLabel="Tipo de arroz"
                      />
                      <button type="button" className="bo-actionBtn" onClick={() => removeRiceRow(idx)} aria-label="Quitar arroz" disabled={busy} data-slot={`booking-editor-remove-arroz-${idx}`}>
                        <Trash2 size={18} strokeWidth={1.8} />
                      </button>
                    </div>
                    {row.type ? (
                      <div className="bo-bookingChoiceActions" data-slot="bookingEditor-bookingChoiceActions">
                        <InlineCounter
                          label="Raciones"
                          value={row.servings || 0}
                          onChange={(v) => updateRiceRow(idx, { servings: v })}
                          min={0}
                          max={draft.party_size}
                          disabled={busy}
                          className="bo-bookingChoiceServings"
                        />
                      </div>
                    ) : null}
                  </div>
                ))}
                <button type="button" className="bo-btn bo-btn--ghost" onClick={addRiceRow} disabled={busy || !riceTypes.length} data-slot="booking-editor-add-arroz">
                  <Plus size={18} strokeWidth={1.8} /> Añadir arroz
                </button>
              </motion.div>
            ) : null}
            </AnimatePresence>
        </Panel>
      ) : null}

      {!draft.special_menu ? (
        <Panel data-slot="bookingEditor-panel" title="Comentario" meta="Opcional">
            <textarea className="bo-input bo-textarea" value={draft.commentary} onChange={(e) => setField("commentary", e.target.value)} data-slot="booking-editor-commentary" />
        </Panel>
      ) : null}
      </div>
      </ScrollArea>

      {/* When stickyFooter, the footer is rendered by the parent via renderFooter
          so it can be placed at the modal level (direct child of Modal) for
          full-width spanning. When not stickyFooter, render inline. */}
      {!stickyFooter && footerNode}
    </div>
  );
}

function CounterField({
  label,
  value,
  min,
  max,
  onChange,
  className,
  style,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (next: number) => void;
  className?: string;
  style?: React.CSSProperties;
}) {
  const safeValue = clampInt(Number(value || 0), min, max);
  return (
    <div className={["bo-field", "bo-field--counter", className].filter(Boolean).join(" ")} style={style} data-slot="bookingEditor-div">
      <div className="bo-label" style={{ textAlign: "center" }} data-slot="bookingEditor-label">{label}</div>
      <div style={{ display: "flex", justifyContent: "center" }}>
      <div className="bo-counter" data-slot={`booking-editor-counter-${label.toLowerCase()}`}>
        <button
          type="button"
          className="bo-counterBtn"
          onClick={() => onChange(Math.max(min, safeValue - 1))}
          disabled={safeValue <= min}
          aria-label={`Disminuir ${label}`}
          data-testid={`booking-editor-counter-${label.toLowerCase()}-decrease`}
        >
          <Minus size={16} strokeWidth={2} />
        </button>
        <input
          className="bo-input bo-input--sm bo-counterInput"
          value={String(safeValue)}
          inputMode="numeric"
          onChange={(e) => onChange(clampInt(Number(e.target.value), min, max))}
          aria-label={label}
          data-testid={`booking-editor-counter-${label.toLowerCase()}-input`}
        />
        <button
          type="button"
          className="bo-counterBtn"
          onClick={() => onChange(Math.min(max, safeValue + 1))}
          disabled={safeValue >= max}
          aria-label={`Aumentar ${label}`}
          data-testid={`booking-editor-counter-${label.toLowerCase()}-increase`}
        >
          <Plus size={16} strokeWidth={2} />
        </button>
      </div>
      </div>
    </div>
  );
}
