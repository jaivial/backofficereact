import React from "react";
import { act, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BookingEditor, type BookingEditorDraft } from "./BookingEditor";

vi.mock("lucide-react", () => {
  const icon = (name: string) => () => <span data-slot={`test-icon-${name}`} />;
  return Object.fromEntries(
    ["Minus", "Plus", "Trash2", "PartyPopper", "CalendarDays", "Clock3", "Info", "Check", "X", "ChevronDown",
     "ChevronUp", "ChevronLeft", "ChevronRight", "Search", "AlertCircle", "CircleAlert", "CircleCheck", "Users",
     "User", "Utensils", "Baby", "Accessibility", "Sparkles", "MapPin", "Pencil", "Save", "Loader2"].map((n) => [n, icon(n)]),
  );
});
vi.mock("react-country-flag", () => ({ ReactCountryFlag: () => <span data-slot="test-flag" /> }));
vi.mock("motion/react", () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
  motion: { div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div> },
  useReducedMotion: () => true,
}));
vi.mock("../../../../../ui/widgets/MonthCalendarDatePicker", () => ({ MonthCalendarDatePicker: () => <div data-slot="test-calendar" /> }));
vi.mock("../../../../../ui/shell/Panel", () => ({ Panel: ({ children }: { children: React.ReactNode }) => <section data-slot="test-panel">{children}</section> }));

const specialDateSettings = {
  id: 1,
  date: "2026-07-11",
  is_active: true,
  requires_adelanto: true,
  // The date only advertises one of the five canonical methods: the editor must
  // still offer and record the others (coordination id
  // booking_editor_special_adelanto_ui_v2).
  adelanto_payment_methods: ["efectivo"],
  menus: [
    { id: 5, menu_id: 3, menu_title: "Menu especial", price: 40, adelanto_amount: 10, position: 0, is_custom: false, sections: [] },
  ],
};

const api = {
  menus: {
    grupos: {
      list: async () => ({ success: true, menus: [] }),
      get: async () => ({ success: true, menu: { id: 3, principales: { items: [] } } }),
    },
  },
  config: {
    getMobilityDay: async () => ({ success: false }),
    getSpecialDate: async () => ({ success: true, special_date: specialDateSettings }),
  },
  calendar: { getMonth: async () => ({ success: true, data: [] }) },
  arrozTypes: { list: async () => [] },
} as any;

const baseDraft = (): BookingEditorDraft => ({
  reservation_date: "2026-07-11",
  reservation_time: "13:00",
  party_size: 4,
  customer_name: "Ana Garcia",
  contact_phone: "600000000",
  contact_phone_country_code: "34",
  contact_email: "",
  table_number: "mesa 3",
  babyStrollers: 0,
  highChairs: 0,
  preferred_floor_number: null,
  special_menu: false,
  menu_de_grupo_id: null,
  principales: [],
  arroz_enabled: false,
  arroz: [],
  commentary: "",
  specialDate: specialDateSettings as any,
  specialMenus: [
    {
      special_date_menu_id: 5,
      menu_id: 3,
      is_custom: false,
      label: "Menu degustacion muy largo que deberia recortarse en la fila del adelanto",
      unit_price: 40,
      count: 4,
      adelanto_per_unit: 10,
      adelanto_payment_method: null,
      items: [],
    },
  ],
  specialAdelantosPaid: [],
});

const settle = () => act(async () => { for (let i = 0; i < 5; i++) await Promise.resolve(); });

describe("BookingEditor: special-date adelanto panel", () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it("renders the adelanto panel with label and unit on one row", async () => {
    render(<BookingEditor api={api} initial={baseDraft()} busy={false} submitLabel="Guardar" onSubmit={async () => {}} />);
    await settle();
    const unit = document.querySelector('[data-slot="booking-editor-special-adelanto-row-unit"]');
    expect(unit).toBeTruthy();
    expect(unit!.className).toContain("bo-mutedText");
  });

  it("offers every canonical payment method, not only the ones the date advertises", async () => {
    render(<BookingEditor api={api} initial={baseDraft()} busy={false} submitLabel="Guardar" onSubmit={async () => {}} />);
    await settle();
    // The per-menu selector trigger + the five status rows cover the enum.
    for (const label of ["Tarjeta", "Bizum", "Transferencia", "Efectivo", "Stripe (pago online)"]) {
      expect(screen.getAllByTitle(label).length).toBeGreaterThan(0);
    }
  });

  it("renders one status row per canonical method", async () => {
    render(<BookingEditor api={api} initial={baseDraft()} busy={false} submitLabel="Guardar" onSubmit={async () => {}} />);
    await settle();
    for (const method of ["card", "bizum", "transferencia", "efectivo", "stripe"]) {
      expect(document.querySelector(`[data-testid="booking-editor-special-adelanto-status-row-${method}"]`)).toBeTruthy();
    }
  });

  it("saves a deposit recorded with a method the date does not advertise", async () => {
    const onSubmit = vi.fn(async (_payload: any) => {});
    const draft = baseDraft();
    draft.specialMenus = [{ ...draft.specialMenus![0], adelanto_payment_method: "bizum" }];
    draft.specialAdelantosPaid = [{ method: "card", amount: 40 }];
    render(<BookingEditor api={api} initial={draft} busy={false} submitLabel="Guardar" onSubmit={onSubmit} />);
    await settle();
    await act(async () => { screen.getByRole("button", { name: "Guardar" }).click(); await Promise.resolve(); });
    const payload = onSubmit.mock.calls[0][0] as any;
    expect(payload.special.menus[0].adelanto_payment_method).toBe("bizum");
    expect(payload.special.adelantos_paid).toEqual([{ method: "card", amount: 40 }]);
  });
});
