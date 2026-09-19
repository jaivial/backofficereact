import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Minus, Plus, Trash2, Sparkles } from "lucide-react";
import { ReactCountryFlag as CountryFlag } from "react-country-flag";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import { createClient } from "../../../../../api/client";
import {
  type BookingExtra,
  type ConfigFloor,
  type GroupMenu,
  type GroupMenuSummary,
  SPECIAL_DATE_PAYMENT_METHOD_LABELS,
  type SpecialDatePaymentMethod,
  type SpecialDateSettings,
} from "../../../../../api/types";
import { MonthCalendarDatePicker } from "../../../../../ui/widgets/MonthCalendarDatePicker";
import { useMonthCalendar } from "../../../../../ui/hooks/useMonthCalendar";
import { TimePicker } from "../../../../../ui/inputs/TimePicker";
import { AutoGrowTextarea } from "../../../../../ui/inputs/AutoGrowTextarea";
import { Select } from "../../../../../ui/inputs/Select";
import { SearchableSelect } from "../../../../../ui/inputs/SearchableSelect";
import { InlineAlert } from "../../../../../ui/feedback/InlineAlert";
import { StatusBadge } from "../../../../../ui/feedback/StatusBadge";
import { InlineCounter } from "../../../../../ui/widgets/InlineCounter";
import { Panel } from "../../../../../ui/shell/Panel";
import { ScrollArea } from "../../../../../ui/layout/ScrollArea";
import { ConfirmDialog } from "../../../../../ui/overlays/ConfirmDialog";
import { OptionsSwitchList, OptionsToggleModal } from "../../../../../ui/widgets/OptionsToggle/OptionsToggle";

import { principalesItemsFromMenu, specialMenusFromBooking, type PrincipalesRow, type RiceRow } from "./bookingDraft";
import {
  buildBookingSpecial,
  computeSpecialTotals,
  draftMenusFromSettings,
  principalesMatchCounter,
  type DraftAdelantoPaid,
  type DraftSpecialMenu,
} from "../../../../../api/specialBookingHelpers";

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

  // Coordination id: booking_extras_v1
  extras?: BookingExtra[];

  arroz_enabled: boolean;
  arroz: RiceRow[];
  commentary: string;

  /**
   * Special-date booking fields (SPEC §3 / §5). All optional so the legacy
   * create modal (no `specialDate` in scope) keeps working unchanged.
   * Coordination id: special_booking_v1 (crosses FE/BE).
   */
  specialDate?: SpecialDateSettings | null;
  specialMenus?: DraftSpecialMenu[];
  specialAdelantosPaid?: DraftAdelantoPaid[];
  /**
   * When editing an existing booking that was created on a special date, the
   * editor hydrates its menu draft from this snapshot to round-trip the count
   * / payment method / selected principales. Cleared after first hydration.
   */
  specialInitialSnapshot?: import("../../../../../api/types").BookingSpecial | null;
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
  footerContainerRef,
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
  /** When provided (with stickyFooter), the footer is rendered via portal into
   *  this container so the parent can place it at the modal level for
   *  full-width spanning. */
  footerContainerRef?: React.RefObject<HTMLDivElement | null>;
}) {
  const reduceMotion = useReducedMotion();
  const [draft, setDraft] = useState<BookingEditorDraft>(() => ({ extras: [], ...initial }));
  const [formError, setFormError] = useState<string | null>(null);
  const [extrasCatalog, setExtrasCatalog] = useState<BookingExtra[]>([]);
  const [extrasModalOpen, setExtrasModalOpen] = useState(false);
  const [extrasDeleteTarget, setExtrasDeleteTarget] = useState<BookingExtra | null>(null);

  // Reload state if initial changes (booking switch).
  useEffect(() => setDraft({ extras: [], ...initial }), [initial]);

  // Coordination id: booking_extras_v1 - restaurant-scoped extras catalog.
  useEffect(() => {
    // Guarded so partial test/storybook API mocks without the extras namespace
    // still render the editor.
    if (!api.bookingExtras?.list) return;
    let cancelled = false;
    api.bookingExtras
      .list()
      .then((res) => {
        if (cancelled || !res.success) return;
        setExtrasCatalog(res.extras || []);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [api.bookingExtras]);

  const [menus, setMenus] = useState<GroupMenuSummary[]>([]);
  const [menusLoaded, setMenusLoaded] = useState(false);
  const [menuDetail, setMenuDetail] = useState<GroupMenu | null>(null);
  const [riceTypes, setRiceTypes] = useState<string[]>([]);
  const [riceTypesLoaded, setRiceTypesLoaded] = useState(false);
  // Same calendar hook used by /app/reservas/config — picks first day of the
  // month the selected date belongs to, refetches on month nav, and exposes
  // occupancy per day (lock icons, "0/45 pax" badges, etc.).
  const calendar = useMonthCalendar(api, draft.reservation_date);

  // Coordination id: special_dates_v1 - cached special-date settings per
  // ISO date. Avoids re-fetching when the user toggles the date picker to the
  // same value and provides the data the special menu section needs.
  const specialDateCacheRef = React.useRef<Map<string, SpecialDateSettings | null>>(new Map());
  const [specialDate, setSpecialDate] = useState<SpecialDateSettings | null>(draft.specialDate ?? null);
  const [specialDateLoading, setSpecialDateLoading] = useState(false);

  const principalesItems = useMemo(() => principalesItemsFromMenu(menuDetail), [menuDetail]);

  // Coordination id: special_booking_v1 - mirror of the backend snapshot
  // helper used for live form feedback (SPEC §3). When special date is active
  // and the user has chosen menus + paid amounts, recompute the breakdown.
  const specialLiveTotals = useMemo(() => {
    if (!specialDate) return null;
    const menus = Array.isArray(draft.specialMenus) ? draft.specialMenus : [];
    return computeSpecialTotals({
      menus,
      adelantos_paid: draft.specialAdelantosPaid,
      partySize: Number(draft.party_size || 0),
    });
  }, [draft.specialAdelantosPaid, draft.party_size, draft.specialMenus, specialDate]);

  // When the special date settings arrive after the draft was created (typical
  // create flow), seed the per-menu draft from the settings if no snapshot is
  // pending and no draft has been touched yet.
  useEffect(() => {
    if (!specialDate) {
      setDraft((p) => ({ ...p, specialMenus: [], specialAdelantosPaid: [] }));
      return;
    }
    setDraft((p) => {
      const hasSnapshot = Boolean(p.specialInitialSnapshot);
      const emptyDraft = !Array.isArray(p.specialMenus) || p.specialMenus.length === 0;
      if (hasSnapshot && emptyDraft) {
        const { menus, adelantos_paid } = specialMenusFromBooking(p.specialInitialSnapshot);
        return {
          ...p,
          specialMenus: menus,
          specialAdelantosPaid: adelantos_paid,
          specialInitialSnapshot: null,
        };
      }
      if (!hasSnapshot && emptyDraft) {
        return { ...p, specialMenus: draftMenusFromSettings(specialDate.menus), specialAdelantosPaid: [] };
      }
      // Keep user-edited draft intact, just sync labels/prices from settings.
      const map = new Map((specialDate.menus || []).map((m) => [Number(m.id || 0), m]));
      const next = (p.specialMenus || []).map((m) => {
        const cfg = map.get(Number(m.special_date_menu_id || 0));
        if (!cfg) return m;
        const isCustom = !cfg.menu_id;
        return {
          ...m,
          menu_id: cfg.menu_id ? Number(cfg.menu_id) : null,
          is_custom: isCustom,
          label: isCustom ? String(cfg.custom_title || m.label || "") : m.label || String((cfg as any).menu_title || ""),
          unit_price: isCustom ? m.unit_price : m.unit_price,
          adelanto_per_unit: Number(cfg.adelanto_amount || m.adelanto_per_unit || 0),
        };
      });
      return { ...p, specialMenus: next };
    });
  }, [specialDate, setDraft]);
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

  // Coordination id: special_dates_v1 - fetch the special-date settings when
  // the draft date changes; cache so reopening the same date is instant.
  useEffect(() => {
    const date = String(draft.reservation_date || "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setSpecialDate(null);
      return;
    }
    const cache = specialDateCacheRef.current;
    if (cache.has(date)) {
      setSpecialDate(cache.get(date) || null);
      return;
    }
    let cancelled = false;
    setSpecialDateLoading(true);
    api.config
      .getSpecialDate(date)
      .then((res) => {
        if (cancelled) return;
        const settings = (res.success ? (res as any).special_date : null) as SpecialDateSettings | null;
        const normalized: SpecialDateSettings | null = settings && settings.is_active ? settings : null;
        cache.set(date, normalized);
        setSpecialDate(normalized);
      })
      .catch(() => {
        if (cancelled) return;
        cache.set(date, null);
        setSpecialDate(null);
      })
      .finally(() => {
        if (!cancelled) setSpecialDateLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [api.config, draft.reservation_date]);

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

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !time || !name || !phone) return false;
    if (specialDate) {
      // Coordination id: special_booking_v1 - require Σ menu counters equal
      // party_size AND every non-custom menu's principales rows equal its
      // counter (SPEC §5.5 exact-match rule).
      const party = Math.max(0, Number(draft.party_size || 0));
      const menus = Array.isArray(draft.specialMenus) ? draft.specialMenus : [];
      const sumCount = menus.reduce((acc, m) => acc + (Number(m.count) || 0), 0);
      if (sumCount !== party) return false;
      for (const m of menus) {
        if (Number(m.count || 0) <= 0) continue;
        if (!principalesMatchCounter(m)) return false;
        if (specialDate.requires_adelanto && !m.adelanto_payment_method) return false;
      }
      return true;
    }
    return !draft.special_menu || menuId > 0;
  }, [draft, specialDate]);

  const setField = useCallback(<K extends keyof BookingEditorDraft>(key: K, value: BookingEditorDraft[K]) => {
    setDraft((p) => ({ ...p, [key]: value }));
  }, []);

  const toggleSpecialMenu = useCallback(
    (v: boolean) => {
      setFormError(null);
      setDraft((p) => {
        if (v) {
          // Coordination id: booking_groupmenu_live_commentary_v1 - keep the
          // free-text note so it merges with the auto summary on submit.
          return { ...p, special_menu: true, arroz_enabled: false, arroz: [] };
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

  // --- Coordination id: booking_extras_v1 ---
  const extrasSelectedIds = useMemo(() => (draft.extras || []).map((extra) => extra.id), [draft.extras]);

  // Coordination id: booking_groupmenu_live_commentary_v1 - live preview of the
  // stored commentary while a group menu is selected: auto principales summary
  // + selected extras. Updates in real time as rows/extras change (mirrors the
  // backend buildGroupMenuCommentary format without the free-text note).
  const groupMenuLivePreview = useMemo(() => {
    const bits: string[] = [];
    // Mirror the backend summary: skip empty rows and collapse repeats.
    const seen = new Set<string>();
    const parts: string[] = [];
    for (const row of draft.principales || []) {
      const name = String(row.name || "").trim();
      const servings = clampInt(Number(row.servings || 0), 0, 10_000);
      if (!name || servings <= 0 || seen.has(name)) continue;
      seen.add(name);
      parts.push(`${name} x ${servings}`);
    }
    const summary = parts.join(", ");
    if (summary) bits.push(summary);
    const extraNames = (draft.extras || []).map((e) => String(e.name || "").trim()).filter(Boolean);
    if (extraNames.length > 0) bits.push(`Extras: ${extraNames.join(", ")}`);
    return bits.join(" · ");
  }, [draft.principales, draft.extras]);

  // Stored extras may no longer be in the catalog (custom extra deleted). Show
  // the union so they stay visible and can be removed instead of silently
  // disappearing from the section.
  const extrasDisplayCatalog = useMemo(() => {
    const catalogIds = new Set(extrasCatalog.map((extra) => extra.id));
    const orphaned = (draft.extras || []).filter((extra) => !catalogIds.has(extra.id));
    return [...extrasCatalog, ...orphaned];
  }, [draft.extras, extrasCatalog]);

  const setExtraSelected = useCallback((id: number, selected: boolean) => {
    setFormError(null);
    setDraft((p) => {
      const current = p.extras || [];
      if (selected) {
        if (current.some((extra) => extra.id === id)) return p;
        const option = extrasCatalog.find((extra) => extra.id === id);
        if (!option) return p;
        return { ...p, extras: [...current, option] };
      }
      return { ...p, extras: current.filter((extra) => extra.id !== id) };
    });
  }, [extrasCatalog]);

  const createExtra = useCallback(async (name: string) => {
    try {
      const res = await api.bookingExtras.create(name);
      if (!res.success || !res.extra) return;
      const created = res.extra;
      setExtrasCatalog((prev) => [...prev.filter((extra) => extra.id !== created.id), created]);
      setDraft((p) => ({ ...p, extras: [...(p.extras || []).filter((extra) => extra.id !== created.id), created] }));
    } catch {
      // ignore: the modal keeps the typed value so the user can retry
    }
  }, [api.bookingExtras]);

  const requestExtraDelete = useCallback((option: BookingExtra) => setExtrasDeleteTarget(option), []);

  const confirmExtraDelete = useCallback(async () => {
    if (!extrasDeleteTarget) return;
    const targetId = extrasDeleteTarget.id;
    try {
      await api.bookingExtras.delete(targetId);
    } catch {
      // ignore: fall through and drop it locally
    }
    setExtrasCatalog((prev) => prev.filter((extra) => extra.id !== targetId));
    setDraft((p) => ({ ...p, extras: (p.extras || []).filter((extra) => extra.id !== targetId) }));
    setExtrasDeleteTarget(null);
  }, [api.bookingExtras, extrasDeleteTarget]);

  const cancelExtraDelete = useCallback(() => setExtrasDeleteTarget(null), []);

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
      // Coordination id: booking_extras_v1 + booking_groupmenu_live_commentary_v1 -
      // extras and the free-text note also apply with a group menu; the backend
      // merges them with the auto summary into the stored commentary.
      payload.extras = (draft.extras || []).map((extra) => extra.id);
      payload.commentary = String(draft.commentary || "").trim();
    } else if (specialDate) {
      // Coordination id: special_booking_v1 - submit the special snapshot
      // block (SPEC §4 / §5.5). The server validates counts + principales
      // against the date settings.
      const menus = Array.isArray(draft.specialMenus) ? draft.specialMenus : [];
      const sumCount = menus.reduce((acc, m) => acc + (Number(m.count) || 0), 0);
      if (sumCount !== partySize) {
        return setFormError("La suma de menús especiales debe coincidir con el número de comensales");
      }
      for (const m of menus) {
        if (Number(m.count || 0) <= 0) continue;
        if (!principalesMatchCounter(m)) {
          return setFormError(`Selecciona los principales del menú "${m.label || "especial"}" (${m.count} raciones)`);
        }
        if (specialDate.requires_adelanto && !m.adelanto_payment_method) {
          return setFormError(`Selecciona el método de pago del menú "${m.label || "especial"}"`);
        }
      }
      const specialMenus = menus
        .filter((m) => Number(m.count || 0) > 0)
        .map((m) => ({
          special_date_menu_id: Number(m.special_date_menu_id || 0),
          count: Number(m.count || 0),
          adelanto_payment_method: m.adelanto_payment_method || undefined,
          items: Array.isArray(m.items)
            ? m.items
                .filter((it) => it && it.dish_id)
                .map((it) => ({ dish_id: Number(it.dish_id || 0) }))
            : [],
        }));
      const adelantos_paid = (Array.isArray(draft.specialAdelantosPaid) ? draft.specialAdelantosPaid : [])
        .filter((p) => p && p.method && Number(p.amount) > 0)
        .map((p) => ({ method: p.method, amount: Number(p.amount) }));
      payload.special = {
        menus: specialMenus,
        adelantos_paid,
      };
      payload.special_menu = false;
      payload.menu_de_grupo_id = null;
      payload.principales_json = [];
      payload.commentary = String(draft.commentary || "").trim();
      payload.extras = (draft.extras || []).map((extra) => extra.id);
    } else {
      payload.commentary = String(draft.commentary || "").trim();
      // Coordination id: booking_extras_v1 - extras apply in both modes.
      payload.extras = (draft.extras || []).map((extra) => extra.id);
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
  }, [draft, onSubmit, specialDate]);

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

  // The footer is rendered via portal into footerContainerRef (when provided)
  // so the parent can place it at the modal level for full-width spanning.
  const [footerMounted, setFooterMounted] = useState(false);
  useEffect(() => {
    setFooterMounted(true);
  }, []);
  const footerTarget = stickyFooter ? footerContainerRef?.current : null;

  return (
    <>
      {footerMounted && footerTarget ? createPortal(footerNode, footerTarget) : null}
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
              <MonthCalendarDatePicker
                value={draft.reservation_date}
                onChange={(v) => setField("reservation_date", v)}
                year={calendar.year}
                month={calendar.month}
                days={calendar.days}
                onPrevMonth={calendar.onPrevMonth}
                onNextMonth={calendar.onNextMonth}
                loading={calendar.loading}
                data-testid="anadir-date-picker"
              />
              {/* Coordination id: special_dates_v1 - soft warn + title shown
                  below the date picker when the selected date is an active
                  special date (SPEC §5.5). Skipped during initial load. */}
              {specialDate ? (
                <div className="bo-bookingEditorSpecialBadge" data-slot="booking-editor-special-badge" data-testid="booking-editor-special-badge">
                  <StatusBadge variant="warning" data-testid="booking-editor-special-badge-pill">
                    <Sparkles size={12} strokeWidth={2} aria-hidden="true" style={{ marginRight: 4, verticalAlign: -2 }} />
                    Fecha especial
                  </StatusBadge>
                  <div className="bo-bookingEditorSpecialBadgeTitle" data-slot="booking-editor-special-badge-title" data-testid="booking-editor-special-badge-title">
                    {specialDate.title || "Fecha especial"}
                  </div>
                </div>
              ) : null}
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

      {specialDate ? (
        <SpecialBookingSection
          api={api}
          busy={busy}
          draft={draft}
          specialDate={specialDate}
          setDraft={setDraft}
          setFormError={setFormError}
          reduceMotion={reduceMotion === true}
          totals={specialLiveTotals}
        />
      ) : (
        <>
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
              <span data-slot="bookingEditor-spinner" className="bo-spinner" aria-hidden="true" />
              <span data-slot="bookingEditor-mutedText" className="bo-mutedText">Cargando menús de grupo…</span>
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
                href="/app/comida/menus"
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
                <div style={{ width: "fit-content" }}>
                  <SearchableSelect
                    className="bo-selectBtn--sm"
                    value={draft.menu_de_grupo_id ? String(draft.menu_de_grupo_id) : ""}
                    onChange={(v) => setField("menu_de_grupo_id", v ? Number(v) : null)}
                    options={menuOptions}
                    placeholder="Selecciona…"
                    searchPlaceholder="Buscar menú…"
                    emptyText="Sin menús"
                    ariaLabel="Seleccionar menú"
                    data-testid="booking-editor-menu-select"
                  />
                </div>
              </div>

              {draft.menu_de_grupo_id ? (
                <div style={{ display: "grid", gap: 10 }} data-slot="booking-editor-menu-principales">
                  <div className="bo-mutedText" data-slot="bookingEditor-mutedText">Principales (restantes: {remainingPrincipales})</div>
                  <div style={{ display: "grid", gap: 8 }} data-slot="bookingEditor-div">
                    {draft.principales.map((row, idx) => (
                      <div key={idx} className="bo-row bo-bookingChoiceRow" style={{ gap: 8 }} data-slot="bookingEditor-bookingChoiceRow">
                        <div className="bo-bookingChoiceSelectorRow" data-slot="booking-editor-principal-selector-row">
                          <SearchableSelect
                            className="bo-selectBtn--sm bo-bookingChoiceSelect"
                            value={row.name}
                            onChange={(v) => updatePrincipalRow(idx, { name: v, servings: Math.min(row.servings, row.name ? remainingPrincipales + row.servings : remainingPrincipales) })}
                            options={principalOptions}
                            placeholder="Selecciona…"
                            searchPlaceholder="Buscar principal…"
                            emptyText="Sin principales"
                            ariaLabel="Principal"
                            data-testid={`booking-editor-principal-select-${idx}`}
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
                <span data-slot="bookingEditor-spinner" className="bo-spinner" aria-hidden="true" />
                <span data-slot="bookingEditor-mutedText" className="bo-mutedText">Cargando tipos de arroz…</span>
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
                <div data-slot="bookingEditor-mutedText" className="bo-mutedText">Mínimo 2 raciones por arroz · restantes: {remainingArroz}</div>
                {draft.arroz.map((row, idx) => (
                  <div key={idx} className="bo-row bo-bookingChoiceRow" style={{ gap: 8 }} data-slot="bookingEditor-bookingChoiceRow">
                    <div className="bo-bookingChoiceSelectorRow" data-slot="booking-editor-rice-selector-row">
                      <SearchableSelect
                        className="bo-selectBtn--sm bo-bookingChoiceSelect"
                        value={row.type}
                        onChange={(v) => updateRiceRow(idx, { type: v })}
                        options={arrozOptions}
                        placeholder="Selecciona…"
                        searchPlaceholder="Buscar tipo de arroz…"
                        emptyText="Sin tipos"
                        ariaLabel="Tipo de arroz"
                        data-testid={`booking-editor-arroz-select-${idx}`}
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
        </>
      )}

      <Panel className="bo-bookingPanel--extras" data-slot="bookingEditor-panel" data-testid="booking-editor-extras-panel" title="Extras" meta={extrasSelectedIds.length > 0 ? `${extrasSelectedIds.length} seleccionados` : "Ninguno"}>
          <OptionsSwitchList
            options={extrasDisplayCatalog}
            selectedIds={extrasSelectedIds}
            onToggle={(id, selected) => setExtraSelected(id, selected)}
            disabled={busy}
            inline
            ariaLabel="Extras de la reserva"
            hint={draft.special_menu ? "Activa los extras que apliquen. También se guardan con menú de grupo." : "Activa los extras que apliquen."}
            testIdPrefix="booking-editor-extra"
            slotPrefix="bookingEditorExtra"
            emptyHint={'No hay extras configurados. Usa "Gestionar extras" para crear uno.'}
          />
          <div className="bo-optionsToggleActions" data-slot="booking-editor-extras-actions">
            <button
              type="button"
              className="bo-btn bo-btn--ghost"
              onClick={() => setExtrasModalOpen(true)}
              disabled={busy}
              data-slot="booking-editor-extras-manage"
              data-testid="booking-editor-extras-manage"
            >
              <Plus size={18} strokeWidth={1.8} /> Gestionar extras
            </button>
          </div>
        </Panel>

      <Panel data-slot="bookingEditor-panel" data-testid="booking-editor-commentary-panel" title="Comentario" meta={draft.special_menu ? "Auto + opcional" : "Opcional"}>
            {draft.special_menu ? (
              <div className="bo-mutedText" data-slot="booking-editor-groupmenu-live-preview" data-testid="booking-editor-groupmenu-live-preview" aria-live="polite">
                {groupMenuLivePreview || "Selecciona principales y extras para ver el comentario automático."}
              </div>
            ) : null}
            <AutoGrowTextarea className="bo-input bo-textarea" value={draft.commentary} onChange={(e) => setField("commentary", e.target.value)} placeholder={draft.special_menu ? "Nota libre (opcional, se añade al comentario automático)" : undefined} data-slot="booking-editor-commentary" data-testid="booking-editor-commentary-input" aria-label="Comentario" />
        </Panel>
      </div>
      </ScrollArea>

      {/* When stickyFooter, the footer is portaled to the parent-provided
          container at the modal level. When not stickyFooter, render inline. */}
      {!stickyFooter && footerNode}

      {/* Coordination id: booking_extras_v1 - manage/create/delete extras. */}
      <OptionsToggleModal
        open={extrasModalOpen}
        title="Extras"
        headerTitle="Selecciona extras"
        hint="Activa los extras que apliquen a esta reserva."
        options={extrasDisplayCatalog}
        selectedIds={extrasSelectedIds}
        onToggle={(id, selected) => setExtraSelected(id, selected)}
        onCreate={(name) => createExtra(name)}
        onRequestDelete={requestExtraDelete}
        onClose={() => setExtrasModalOpen(false)}
        disabled={busy}
        placeholder="Añadir extra personalizado"
        addLabel="Añadir"
        testIdPrefix="booking-extras-modal"
        slotPrefix="bookingExtrasModal"
      />
      <ConfirmDialog
        title="Eliminar extra"
        message={extrasDeleteTarget
          ? `¿Eliminar "${extrasDeleteTarget.name}"? Se quitará para este restaurante en todas las reservas. Esta acción no se puede deshacer.`
          : ""}
        confirmText="Eliminar"
        cancelText="Cancelar"
        danger
        open={!!extrasDeleteTarget}
        onCancel={cancelExtraDelete}
        onClose={cancelExtraDelete}
        onConfirm={() => void confirmExtraDelete()}
      />
    </div>
    </>
  );
}

/**
 * Special booking editor section — renders the "Selección de menús
 * especiales" panel (one sub-section per offered menu) plus the optional
 * "Adelanto" panel. Replaces the legacy "Menú de grupo" + "Arroz" panels
 * whenever the draft date is an active special date (SPEC §5.5).
 *
 * Coordination id: special_booking_v1 (crosses FE/BE).
 */
function SpecialBookingSection({
  api,
  busy,
  draft,
  specialDate,
  setDraft,
  setFormError,
  reduceMotion,
  totals,
}: {
  api: API;
  busy: boolean;
  draft: BookingEditorDraft;
  specialDate: SpecialDateSettings;
  setDraft: React.Dispatch<React.SetStateAction<BookingEditorDraft>>;
  setFormError: (msg: string | null) => void;
  reduceMotion: boolean;
  totals: import("../../../../../api/specialBookingHelpers").SpecialTotals | null;
}) {
  const menus = Array.isArray(draft.specialMenus) ? draft.specialMenus : [];
  const acceptedMethods = Array.isArray(specialDate.adelanto_payment_methods) ? specialDate.adelanto_payment_methods : [];
  const partySize = Math.max(0, Number(draft.party_size || 0));
  const sumCount = menus.reduce((acc, m) => acc + (Number(m.count) || 0), 0);
  const remainingPax = Math.max(0, partySize - sumCount);

  const setMenuCount = useCallback((idx: number, next: number) => {
    setFormError(null);
    setDraft((p) => {
      const cur = Array.isArray(p.specialMenus) ? p.specialMenus : [];
      const safe = Math.max(0, Math.trunc(Number(next) || 0));
      const updated = cur.map((m, i) => (i === idx ? { ...m, count: safe } : m));
      return { ...p, specialMenus: updated };
    });
  }, [setDraft, setFormError]);

  const setMenuMethod = useCallback((idx: number, method: SpecialDatePaymentMethod | null) => {
    setFormError(null);
    setDraft((p) => {
      const cur = Array.isArray(p.specialMenus) ? p.specialMenus : [];
      return { ...p, specialMenus: cur.map((m, i) => (i === idx ? { ...m, adelanto_payment_method: method } : m)) };
    });
  }, [setDraft, setFormError]);

  const addPrincipal = useCallback((menuIdx: number) => {
    setFormError(null);
    setDraft((p) => {
      const cur = Array.isArray(p.specialMenus) ? p.specialMenus : [];
      const updated = cur.map((m, i) => {
        if (i !== menuIdx) return m;
        if (m.is_custom) return m;
        const rows = Array.isArray(m.items) ? m.items : [];
        return { ...m, items: [...rows, { dish_id: 0, name: "" }] };
      });
      return { ...p, specialMenus: updated };
    });
  }, [setDraft, setFormError]);

  const removePrincipal = useCallback((menuIdx: number, itemIdx: number) => {
    setDraft((p) => {
      const cur = Array.isArray(p.specialMenus) ? p.specialMenus : [];
      return { ...p, specialMenus: cur.map((m, i) => {
        if (i !== menuIdx) return m;
        const rows = Array.isArray(m.items) ? m.items : [];
        return { ...m, items: rows.filter((_, j) => j !== itemIdx) };
      }) };
    });
  }, [setDraft]);

  const updatePrincipal = useCallback((menuIdx: number, itemIdx: number, patch: { dish_id?: number; name?: string }) => {
    setDraft((p) => {
      const cur = Array.isArray(p.specialMenus) ? p.specialMenus : [];
      return { ...p, specialMenus: cur.map((m, i) => {
        if (i !== menuIdx) return m;
        const rows = Array.isArray(m.items) ? m.items : [];
        return { ...m, items: rows.map((it, j) => (j === itemIdx ? { ...it, ...patch } : it)) };
      }) };
    });
  }, [setDraft]);

  const setAdelantoPaid = useCallback((method: SpecialDatePaymentMethod, amount: number) => {
    setDraft((p) => {
      const cur = Array.isArray(p.specialAdelantosPaid) ? p.specialAdelantosPaid : [];
      const safe = Math.max(0, Number(amount) || 0);
      const others = cur.filter((row) => row.method !== method);
      return { ...p, specialAdelantosPaid: safe > 0 ? [...others, { method, amount: safe }] : others };
    });
  }, [setDraft]);

  const advanceMethodsOptions = acceptedMethods.map((m) => ({ value: m, label: SPECIAL_DATE_PAYMENT_METHOD_LABELS[m] || m }));
  const paidMap = new Map((draft.specialAdelantosPaid || []).map((row) => [row.method, Number(row.amount) || 0]));

  return (
    <>
      <Panel
        className="bo-bookingPanel--special-menus"
        data-slot="bookingEditor-panel"
        data-testid="booking-editor-special-menus-panel"
        title="Selección de menús especiales"
        meta={`${sumCount} / ${partySize || 0} comensales`}
      >
        <div className="bo-mutedText" data-slot="booking-editor-special-menus-hint">
          Elige los menús para esta reserva. La suma de comensales por menú debe coincidir con el total de la reserva.
        </div>
        <div style={{ marginTop: 10, display: "grid", gap: 12 }} data-slot="booking-editor-special-menus-list">
          {menus.map((menu, menuIdx) => (
            <SpecialMenuSubSection
              key={menu.special_date_menu_id || menuIdx}
              api={api}
              busy={busy}
              menu={menu}
              partySize={partySize}
              remainingPax={remainingPax}
              onCountChange={(v) => setMenuCount(menuIdx, v)}
              onMethodChange={(m) => setMenuMethod(menuIdx, m)}
              onAddPrincipal={() => addPrincipal(menuIdx)}
              onRemovePrincipal={(itemIdx) => removePrincipal(menuIdx, itemIdx)}
              onUpdatePrincipal={(itemIdx, patch) => updatePrincipal(menuIdx, itemIdx, patch)}
            />
          ))}
          {!menus.length ? (
            <div className="bo-mutedText" data-slot="booking-editor-special-menus-empty">
              Esta fecha especial no tiene menús configurados todavía.
            </div>
          ) : null}
        </div>
      </Panel>

      {specialDate.requires_adelanto ? (
        <Panel
          className="bo-bookingPanel--special-adelanto"
          data-slot="bookingEditor-panel"
          data-testid="booking-editor-special-adelanto-panel"
          title="Adelanto"
          meta={totals ? `${Number(totals.required_total).toFixed(2)}€ requeridos` : "—"}
        >
          <div style={{ display: "grid", gap: 12 }} data-slot="booking-editor-special-adelanto-body">
            <div className="bo-mutedText" data-slot="booking-editor-special-adelanto-hint">
              {acceptedMethods.length > 0
                ? "Indica por menú el método de pago del adelanto. Las cantidades ya abonadas pueden ajustarse abajo."
                : "Esta fecha requiere adelanto, pero no hay métodos de pago configurados."}
            </div>
            {menus.filter((m) => Number(m.count || 0) > 0).map((m, idx) => {
              const rowTotal = Number(m.adelanto_per_unit || 0) * Number(m.count || 0);
              return (
                <div
                  key={`row-${idx}`}
                  className="bo-bookingEditorSpecialAdelantoRow"
                  data-slot={`booking-editor-special-adelanto-row-${m.special_date_menu_id}`}
                  data-testid={`booking-editor-special-adelanto-row-${m.special_date_menu_id}`}
                  style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 8, alignItems: "center" }}
                >
                  <div data-slot="booking-editor-special-adelanto-row-label" style={{ display: "grid" }}>
                    <strong>{m.label || `Menú #${m.special_date_menu_id}`}</strong>
                    <span className="bo-mutedText" style={{ fontSize: 12 }}>
                      {m.count} × {Number(m.adelanto_per_unit || 0).toFixed(2)}€
                    </span>
                  </div>
                  <SearchableSelect
                    value={m.adelanto_payment_method || ""}
                    onChange={(v) => setMenuMethod(idx, v ? (v as SpecialDatePaymentMethod) : null)}
                    options={[{ value: "", label: "Sin método" }, ...advanceMethodsOptions]}
                    placeholder="Método…"
                    searchPlaceholder="Buscar método…"
                    emptyText="Sin métodos"
                    ariaLabel="Método de pago del adelanto"
                    data-testid={`booking-editor-special-adelanto-method-${m.special_date_menu_id}`}
                  />
                  <div data-slot="booking-editor-special-adelanto-row-total" style={{ minWidth: 80, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                    {rowTotal.toFixed(2)}€
                  </div>
                </div>
              );
            })}

            <div className="bo-bookingEditorSpecialTotals" data-slot="booking-editor-special-adelanto-totals" style={{ display: "grid", gap: 6 }}>
              {totals?.by_method.map((row) => (
                <div
                  key={row.method}
                  className="bo-bookingEditorSpecialTotalRow"
                  data-slot={`booking-editor-special-adelanto-total-row-${row.method}`}
                  style={{ display: "flex", justifyContent: "space-between", gap: 12, fontVariantNumeric: "tabular-nums" }}
                >
                  <span>{SPECIAL_DATE_PAYMENT_METHOD_LABELS[row.method] || row.method}</span>
                  <span>
                    {Number(row.required).toFixed(2)}€ req · {Number(row.paid).toFixed(2)}€ pagados
                  </span>
                </div>
              ))}
              <div className="bo-bookingEditorSpecialTotalAll" data-slot="booking-editor-special-adelanto-total-all" style={{ display: "flex", justifyContent: "space-between", gap: 12, paddingTop: 6, borderTop: "1px solid var(--bo-border)", fontVariantNumeric: "tabular-nums" }}>
                <strong>TOTAL</strong>
                <strong>{totals ? `${Number(totals.required_total).toFixed(2)}€` : "—"}</strong>
              </div>
            </div>

            <div className="bo-bookingEditorSpecialAdelantoStatus" data-slot="booking-editor-special-adelanto-status" style={{ display: "grid", gap: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>Estado del adelanto</div>
              {acceptedMethods.map((method) => {
                const required = totals?.by_method.find((row) => row.method === method)?.required ?? 0;
                const paidRow = totals?.by_method.find((row) => row.method === method)?.paid ?? 0;
                const pending = Math.max(0, required - paidRow);
                const ok = required > 0 && pending <= 0;
                return (
                  <div
                    key={method}
                    className="bo-bookingEditorSpecialAdelantoStatusRow"
                    data-slot={`booking-editor-special-adelanto-status-row-${method}`}
                    style={{ display: "grid", gridTemplateColumns: "1fr auto auto auto", gap: 8, alignItems: "center" }}
                  >
                    <span>{SPECIAL_DATE_PAYMENT_METHOD_LABELS[method] || method}</span>
                    <span className="bo-mutedText" style={{ fontVariantNumeric: "tabular-nums" }}>req {required.toFixed(2)}€</span>
                    <input
                      className="bo-input bo-input--sm"
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step={0.01}
                      style={{ width: 110, textAlign: "right", fontVariantNumeric: "tabular-nums" }}
                      value={String(paidMap.get(method) ?? "")}
                      onChange={(e) => setAdelantoPaid(method, Number(e.target.value))}
                      aria-label={`Cantidad abonada (${SPECIAL_DATE_PAYMENT_METHOD_LABELS[method] || method})`}
                      data-testid={`booking-editor-special-adelanto-paid-${method}`}
                      data-slot={`booking-editor-special-adelanto-paid-${method}`}
                    />
                    {required > 0 ? (
                      ok ? (
                        <StatusBadge variant="success" data-testid={`booking-editor-special-adelanto-status-${method}`}>
                          Pagado
                        </StatusBadge>
                      ) : (
                        <StatusBadge variant="danger" data-testid={`booking-editor-special-adelanto-status-${method}`}>
                          Pendiente · {pending.toFixed(2)}€
                        </StatusBadge>
                      )
                    ) : (
                      <span className="bo-mutedText" data-slot={`booking-editor-special-adelanto-status-empty-${method}`}>—</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </Panel>
      ) : null}
    </>
  );
}

/**
 * Single-menu sub-section inside the "Selección de menús especiales" panel:
 * label + (optional) custom image + people counter, and — for non-custom
 * menus — a SearchableSelect dish dropdown per principales row that must
 * EXACTLY match the counter (SPEC §5.5 exact-match rule).
 */
function SpecialMenuSubSection({
  api,
  busy,
  menu,
  partySize,
  remainingPax,
  onCountChange,
  onMethodChange,
  onAddPrincipal,
  onRemovePrincipal,
  onUpdatePrincipal,
}: {
  api: API;
  busy: boolean;
  menu: DraftSpecialMenu;
  partySize: number;
  remainingPax: number;
  onCountChange: (next: number) => void;
  onMethodChange: (next: SpecialDatePaymentMethod | null) => void;
  onAddPrincipal: () => void;
  onRemovePrincipal: (itemIdx: number) => void;
  onUpdatePrincipal: (itemIdx: number, patch: { dish_id?: number; name?: string }) => void;
}) {
  const [menuDetail, setMenuDetail] = useState<GroupMenu | null>(null);
  const [loadingMenu, setLoadingMenu] = useState(false);

  useEffect(() => {
    if (menu.is_custom || !menu.menu_id) {
      setMenuDetail(null);
      return;
    }
    setLoadingMenu(true);
    let cancelled = false;
    api.menus.grupos
      .get(menu.menu_id)
      .then((res) => {
        if (cancelled || !res.success) return;
        setMenuDetail((res as any).menu || null);
      })
      .catch(() => undefined)
      .finally(() => { if (!cancelled) setLoadingMenu(false); });
    return () => { cancelled = true; };
  }, [api.menus.grupos, menu.is_custom, menu.menu_id]);

  const dishItems = useMemo(() => principalesItemsFromMenu(menuDetail), [menuDetail]);
  const dishOptions = useMemo(() => dishItems.map((it) => ({ value: it, label: it })), [dishItems]);
  const items = Array.isArray(menu.items) ? menu.items : [];
  const filledCount = items.filter((it) => it && it.name).length;
  const rowsRemaining = Math.max(0, Number(menu.count || 0) - filledCount);

  return (
    <div
      className="bo-bookingEditorSpecialMenuRow"
      data-slot={`booking-editor-special-menu-row-${menu.special_date_menu_id}`}
      data-testid={`booking-editor-special-menu-row-${menu.special_date_menu_id}`}
      style={{ display: "grid", gap: 8, padding: 10, border: "1px solid var(--bo-border)", borderRadius: 8 }}
    >
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <strong data-slot={`booking-editor-special-menu-label-${menu.special_date_menu_id}`}>
          {menu.label || `Menú #${menu.special_date_menu_id}`}
        </strong>
        {menu.is_custom ? (
          <span className="bo-mutedText" style={{ fontSize: 12 }} data-slot={`booking-editor-special-menu-custom-${menu.special_date_menu_id}`}>
            Menú personalizado
          </span>
        ) : null}
        <div style={{ marginLeft: "auto" }}>
          <InlineCounter
            label="Comensales"
            value={Number(menu.count || 0)}
            onChange={onCountChange}
            min={0}
            max={partySize || 10000}
            disabled={busy}
          />
        </div>
      </div>

      {menu.is_custom ? (
        <div className="bo-mutedText" data-slot={`booking-editor-special-menu-later-${menu.special_date_menu_id}`}>
          Los principales se decidirán más tarde.
        </div>
      ) : (
        <div style={{ display: "grid", gap: 6 }}>
          {items.map((row, itemIdx) => (
            <div
              key={itemIdx}
              className="bo-row bo-bookingChoiceRow"
              style={{ gap: 8 }}
              data-slot={`booking-editor-special-menu-principal-row-${menu.special_date_menu_id}-${itemIdx}`}
            >
              <SearchableSelect
                value={row.name}
                onChange={(v) => onUpdatePrincipal(itemIdx, { name: v, dish_id: 0 })}
                options={dishOptions}
                placeholder={dishOptions.length ? "Selecciona principal…" : "Sin principales"}
                searchPlaceholder="Buscar principal…"
                emptyText="Sin principales"
                disabled={loadingMenu || busy}
                ariaLabel={`Principal del menú ${menu.label || menu.special_date_menu_id}`}
                data-testid={`booking-editor-special-menu-principal-select-${menu.special_date_menu_id}-${itemIdx}`}
              />
              <button
                type="button"
                className="bo-actionBtn"
                onClick={() => onRemovePrincipal(itemIdx)}
                aria-label="Quitar principal"
                disabled={busy}
                data-slot={`booking-editor-special-menu-principal-remove-${menu.special_date_menu_id}-${itemIdx}`}
              >
                <Trash2 size={18} strokeWidth={1.8} />
              </button>
            </div>
          ))}
          {Number(menu.count || 0) > items.length ? (
            <button
              type="button"
              className="bo-btn bo-btn--ghost"
              onClick={onAddPrincipal}
              disabled={busy || !dishOptions.length}
              data-slot={`booking-editor-special-menu-principal-add-${menu.special_date_menu_id}`}
              data-testid={`booking-editor-special-menu-principal-add-${menu.special_date_menu_id}`}
            >
              <Plus size={18} strokeWidth={1.8} /> Añadir principal
            </button>
          ) : null}
          {!dishOptions.length ? (
            <div className="bo-mutedText" data-slot={`booking-editor-special-menu-no-principales-${menu.special_date_menu_id}`}>
              Este menú no tiene lista de principales.
            </div>
          ) : null}
          {rowsRemaining > 0 && dishOptions.length > 0 ? (
            <div className="bo-mutedText" style={{ fontSize: 12 }} data-slot={`booking-editor-special-menu-remaining-${menu.special_date_menu_id}`}>
              Faltan {rowsRemaining} principal(es) por seleccionar.
            </div>
          ) : null}
        </div>
      )}
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
      <div data-slot="bookingEditor-div" style={{ display: "flex", justifyContent: "center" }}>
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
