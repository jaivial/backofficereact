import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { ReactCountryFlag as CountryFlag } from "react-country-flag";

import { createClient } from "../../../../api/client";
import type { ConfigFloor, GroupMenu, GroupMenuSummary } from "../../../../api/types";
import { DatePicker } from "../../../../ui/inputs/DatePicker";
import { TimePicker } from "../../../../ui/inputs/TimePicker";
import { Select } from "../../../../ui/inputs/Select";
import { InlineAlert } from "../../../../ui/feedback/InlineAlert";

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
}: {
  api: API;
  initial: BookingEditorDraft;
  busy: boolean;
  submitLabel: string;
  onSubmit: (payload: any) => Promise<void>;
  onCancel?: () => void;
  stickyFooter?: boolean;
  floors?: ConfigFloor[];
}) {
  const [draft, setDraft] = useState<BookingEditorDraft>(initial);
  const [formError, setFormError] = useState<string | null>(null);

  // Reload state if initial changes (booking switch).
  useEffect(() => setDraft(initial), [initial]);

  const [menus, setMenus] = useState<GroupMenuSummary[]>([]);
  const [menuDetail, setMenuDetail] = useState<GroupMenu | null>(null);
  const [riceTypes, setRiceTypes] = useState<string[]>([]);

  const principalesItems = useMemo(() => principalesItemsFromMenu(menuDetail), [menuDetail]);
  const menuOptions = useMemo(
    () => [{ value: "", label: "Selecciona…" }, ...menus.map((m) => ({ value: String(m.id), label: `${m.menu_title} · ${m.price}€` }))],
    [menus],
  );
  const principalOptions = useMemo(
    () => [{ value: "", label: "Selecciona…" }, ...principalesItems.map((it) => ({ value: it, label: it }))],
    [principalesItems],
  );
  const arrozOptions = useMemo(
    () => [{ value: "", label: "Selecciona…" }, ...riceTypes.map((t) => ({ value: t, label: t }))],
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
    if (!draft.special_menu) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await api.menus.grupos.list("active");
        if (!res.success) return;
        if (cancelled) return;
        setMenus(res.menus || []);
      } catch {
        // ignore
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
    if (draft.special_menu) return;
    if (!draft.arroz_enabled) return;
    if (riceTypes.length) return;
    let cancelled = false;
    (async () => {
      try {
        const list = await api.arrozTypes.list();
        if (cancelled) return;
        setRiceTypes(list || []);
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [api.arrozTypes, draft.arroz_enabled, draft.special_menu, riceTypes.length]);

  const remainingArroz = useMemo(() => Math.max(0, (draft.party_size || 0) - sumServings(draft.arroz)), [draft.arroz, draft.party_size]);
  const remainingPrincipales = useMemo(
    () => Math.max(0, (draft.party_size || 0) - sumServings(draft.principales)),
    [draft.party_size, draft.principales],
  );

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
        // Ensure at least one row.
        const firstType = (riceTypes[0] || "").trim();
        const row: RiceRow = { type: firstType, servings: 2 };
        return { ...p, arroz_enabled: true, arroz: p.arroz.length ? p.arroz : (firstType ? [row] : []) };
      });
    },
    [riceTypes],
  );

  const addRiceRow = useCallback(() => {
    const firstType = (riceTypes[0] || "").trim();
    setDraft((p) => ({ ...p, arroz: [...p.arroz, { type: firstType, servings: 2 }] }));
  }, [riceTypes]);

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
    const first = (principalesItems[0] || "").trim();
    setDraft((p) => ({ ...p, principales: [...p.principales, { name: first, servings: 1 }] }));
  }, [principalesItems]);

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

  return (
    <div className={`bo-stack bo-bookingEditor${stickyFooter ? " bo-bookingEditor--stickyFooter" : ""}`} style={{ gap: 14 }}>
      {formError ? <InlineAlert kind="error" title="Error" message={formError} /> : null}
      <div className={stickyFooter ? "bo-bookingEditorBody" : undefined}>

      <div className="bo-panel">
        <div className="bo-panelHead">
          <div className="bo-panelTitle">Datos</div>
          <div className="bo-panelMeta">{draft.special_menu ? "Menú de grupo" : "Reserva"}</div>
        </div>
        <div className="bo-panelBody" style={{ display: "grid", gap: 12 }}>
          <div className="bo-row" style={{ alignItems: "flex-end" }}>
            <div className="bo-field bo-field--inline">
              <div className="bo-label">Fecha</div>
              <DatePicker value={draft.reservation_date} onChange={(v) => setField("reservation_date", v)} />
            </div>
            <div className="bo-field bo-field--inline">
              <div className="bo-label">Hora</div>
              <TimePicker value={draft.reservation_time} onChange={(v) => setField("reservation_time", v)} ariaLabel="Hora" />
            </div>
            <CounterField label="Pax" value={draft.party_size || 1} min={1} max={10000} onChange={(v) => setField("party_size", v)} />
          </div>

          <div className="bo-row" style={{ alignItems: "flex-end" }}>
            <div className="bo-field" style={{ flex: "1 1 320px" }}>
              <div className="bo-label">Cliente</div>
              <input className="bo-input bo-input--sm" value={draft.customer_name} onChange={(e) => setField("customer_name", e.target.value)} />
            </div>
            <div className="bo-field" style={{ flex: "1 1 280px" }}>
              <div className="bo-label">Teléfono</div>
              <div className="bo-phone">
                <Select
                  className="bo-selectBtn--sm bo-phoneCC"
                  size="sm"
                  value={draft.contact_phone_country_code}
                  onChange={(v) => setField("contact_phone_country_code", v)}
                  ariaLabel="Prefijo"
                  options={phoneCodeOptions}
                />
                <input
                  className="bo-input bo-input--sm bo-phoneNum"
                  inputMode="tel"
                  value={draft.contact_phone}
                  onChange={(e) => setField("contact_phone", e.target.value)}
                  aria-label="Teléfono"
                />
              </div>
            </div>
            <div className="bo-field" style={{ flex: "1 1 320px" }}>
              <div className="bo-label">Email (opcional)</div>
              <input className="bo-input bo-input--sm" value={draft.contact_email} onChange={(e) => setField("contact_email", e.target.value)} />
            </div>
          </div>

          <div className="bo-row" style={{ alignItems: "flex-end" }}>
            <div className="bo-field">
              <div className="bo-label">Mesa</div>
              <input
                className="bo-input bo-input--sm"
                style={{ width: 110 }}
                value={draft.table_number}
                onChange={(e) => setField("table_number", e.target.value)}
              />
            </div>
            <CounterField
              label="Carros"
              value={draft.babyStrollers || 0}
              min={0}
              max={100}
              onChange={(v) => setField("babyStrollers", v)}
            />
            <CounterField
              label="Tronas"
              value={draft.highChairs || 0}
              min={0}
              max={100}
              onChange={(v) => setField("highChairs", v)}
            />
            <div className="bo-field" style={{ flex: "1 1 260px" }}>
              <div className="bo-label">Salón</div>
              <Select
                className="bo-selectBtn--sm"
                size="sm"
                value={draft.preferred_floor_number != null ? String(draft.preferred_floor_number) : ""}
                onChange={(v) => setField("preferred_floor_number", v ? Number(v) : null)}
                options={floorOptions}
                ariaLabel="Salón"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="bo-panel">
        <div className="bo-panelHead">
          <div className="bo-panelTitle">Menú de grupo</div>
          <div className="bo-panelMeta">{draft.special_menu ? "Sí" : "No"}</div>
        </div>
        <div className="bo-panelBody">
          <div className="bo-chips" role="group" aria-label="Menú de grupo">
            <button type="button" className={`bo-chip${draft.special_menu ? "" : " is-on"}`} onClick={() => toggleSpecialMenu(false)} disabled={busy}>
              No
            </button>
            <button type="button" className={`bo-chip${draft.special_menu ? " is-on" : ""}`} onClick={() => toggleSpecialMenu(true)} disabled={busy}>
              Sí
            </button>
          </div>

          {draft.special_menu ? (
            <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
              <div className="bo-field">
                <div className="bo-label">Seleccionar menú</div>
                <Select
                  className="bo-selectBtn--sm"
                  size="sm"
                  value={draft.menu_de_grupo_id ? String(draft.menu_de_grupo_id) : ""}
                  onChange={(v) => setField("menu_de_grupo_id", v ? Number(v) : null)}
                  options={menuOptions}
                  ariaLabel="Seleccionar menú"
                />
              </div>

              <div className="bo-mutedText">Principales (restantes: {remainingPrincipales})</div>
              <div style={{ display: "grid", gap: 8 }}>
                {draft.principales.map((row, idx) => (
                  <div key={idx} className="bo-row" style={{ gap: 8 }}>
                    <Select
                      className="bo-selectBtn--sm"
                      size="sm"
                      style={{ flex: "1 1 260px" }}
                      value={row.name}
                      onChange={(v) => updatePrincipalRow(idx, { name: v })}
                      options={principalOptions}
                      ariaLabel="Principal"
                    />
                    <input
                      className="bo-input bo-input--sm"
                      style={{ width: 96 }}
                      inputMode="numeric"
                      value={String(row.servings || 0)}
                      onChange={(e) => updatePrincipalRow(idx, { servings: Number(e.target.value) })}
                    />
                    <button type="button" className="bo-actionBtn" onClick={() => removePrincipalRow(idx)} aria-label="Quitar principal" disabled={busy}>
                      <Minus size={18} strokeWidth={1.8} />
                    </button>
                  </div>
                ))}
                <button type="button" className="bo-btn bo-btn--ghost" onClick={addPrincipalRow} disabled={busy || !principalesItems.length}>
                  <Plus size={18} strokeWidth={1.8} /> Añadir principal
                </button>
                {!principalesItems.length ? <div className="bo-mutedText">Este menú no tiene lista de principales.</div> : null}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {!draft.special_menu ? (
        <div className="bo-panel">
          <div className="bo-panelHead">
            <div className="bo-panelTitle">Arroz</div>
            <div className="bo-panelMeta">{draft.arroz_enabled ? "Sí" : "No"}</div>
          </div>
          <div className="bo-panelBody">
            <div className="bo-chips" role="group" aria-label="¿Desea arroz?">
              <button type="button" className={`bo-chip${draft.arroz_enabled ? "" : " is-on"}`} onClick={() => toggleArroz(false)} disabled={busy}>
                No
              </button>
              <button type="button" className={`bo-chip${draft.arroz_enabled ? " is-on" : ""}`} onClick={() => toggleArroz(true)} disabled={busy}>
                Sí
              </button>
            </div>
            {draft.arroz_enabled ? <div className="bo-mutedText" style={{ marginTop: 10 }}>Mínimo 2 raciones por arroz · restantes: {remainingArroz}</div> : null}

            {draft.arroz_enabled ? (
              <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                {draft.arroz.map((row, idx) => (
                  <div key={idx} className="bo-row" style={{ gap: 8 }}>
                    <Select
                      className="bo-selectBtn--sm"
                      size="sm"
                      style={{ flex: "1 1 260px" }}
                      value={row.type}
                      onChange={(v) => updateRiceRow(idx, { type: v })}
                      options={arrozOptions}
                      ariaLabel="Tipo de arroz"
                    />
                    <input
                      className="bo-input bo-input--sm"
                      style={{ width: 96 }}
                      inputMode="numeric"
                      value={String(row.servings || 0)}
                      onChange={(e) => updateRiceRow(idx, { servings: Number(e.target.value) })}
                    />
                    <button type="button" className="bo-actionBtn" onClick={() => removeRiceRow(idx)} aria-label="Quitar arroz" disabled={busy}>
                      <Minus size={18} strokeWidth={1.8} />
                    </button>
                  </div>
                ))}
                <button type="button" className="bo-btn bo-btn--ghost" onClick={addRiceRow} disabled={busy || !riceTypes.length}>
                  <Plus size={18} strokeWidth={1.8} /> Añadir arroz
                </button>
                {!riceTypes.length ? <div className="bo-mutedText">Cargando tipos de arroz…</div> : null}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {!draft.special_menu ? (
        <div className="bo-panel">
          <div className="bo-panelHead">
            <div className="bo-panelTitle">Comentario</div>
            <div className="bo-panelMeta">Opcional</div>
          </div>
          <div className="bo-panelBody">
            <textarea className="bo-input bo-textarea" value={draft.commentary} onChange={(e) => setField("commentary", e.target.value)} />
          </div>
        </div>
      ) : null}
      </div>

      <div
        className={stickyFooter ? "bo-modalActions bo-modalActions--reservas bo-bookingEditorFooter" : "bo-row"}
        style={stickyFooter ? undefined : { justifyContent: "flex-end" }}
      >
        {onCancel ? (
          <button className="bo-btn bo-btn--ghost" type="button" onClick={onCancel} disabled={busy}>
            Cerrar
          </button>
        ) : null}
        <button className="bo-btn bo-btn--primary" type="button" onClick={() => void submit()} disabled={busy}>
          {submitLabel}
        </button>
      </div>
    </div>
  );
}

function CounterField({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (next: number) => void;
}) {
  const safeValue = clampInt(Number(value || 0), min, max);
  return (
    <div className="bo-field bo-field--counter">
      <div className="bo-label">{label}</div>
      <div className="bo-counter">
        <button
          type="button"
          className="bo-counterBtn"
          onClick={() => onChange(Math.max(min, safeValue - 1))}
          disabled={safeValue <= min}
          aria-label={`Disminuir ${label}`}
        >
          <Minus size={16} strokeWidth={2} />
        </button>
        <input
          className="bo-input bo-input--sm bo-counterInput"
          value={String(safeValue)}
          inputMode="numeric"
          onChange={(e) => onChange(clampInt(Number(e.target.value), min, max))}
          aria-label={label}
        />
        <button
          type="button"
          className="bo-counterBtn"
          onClick={() => onChange(Math.min(max, safeValue + 1))}
          disabled={safeValue >= max}
          aria-label={`Aumentar ${label}`}
        >
          <Plus size={16} strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}
