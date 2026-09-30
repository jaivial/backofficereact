import React from "react";
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BookingEditor, type BookingEditorDraft } from "./BookingEditor";

// The editor tree pulls in more icons than it renders, so name them all here
// instead of chasing each one as a new failure appears.
vi.mock("lucide-react", () => {
  const icon = (name: string) => () => <span data-slot={`test-icon-${name}`} />;
  const names = [
    "Minus", "Plus", "Trash2", "PartyPopper", "CalendarDays", "Clock3", "Info", "Check",
    "X", "ChevronDown", "ChevronUp", "ChevronLeft", "ChevronRight", "Search", "AlertCircle",
    "CircleAlert", "CircleCheck", "Users", "User", "Utensils", "Baby", "Accessibility",
    "Sparkles", "MapPin", "Pencil", "Save", "Loader2",
  ];
  return Object.fromEntries(names.map((n) => [n, icon(n)]));
});

vi.mock("react-country-flag", () => ({ ReactCountryFlag: () => <span data-slot="test-flag" /> }));

vi.mock("motion/react", () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
  motion: { div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div> },
  useReducedMotion: () => true,
}));

vi.mock("../../../../../ui/widgets/MonthCalendarDatePicker", () => ({
  MonthCalendarDatePicker: () => <div data-slot="test-calendar-picker" />,
}));

vi.mock("../../../../../ui/shell/Panel", () => ({
  Panel: ({ children }: { children: React.ReactNode }) => <section data-slot="test-panel">{children}</section>,
}));

// The editor resolves the special date itself, so the API double is what makes
// the special-date branch render at all.
const specialDateSettings = {
  id: 1,
  date: "2026-07-11",
  is_active: true,
  requires_adelanto: false,
  adelanto_payment_methods: ["CASH"],
  menus: [
    { id: 5, menu_id: 3, menu_title: "Menú especial", price: 40, adelanto_amount: 0, position: 0, is_custom: false, sections: [] },
  ],
};

const api = {
  menus: {
    grupos: {
      list: async () => ({ success: true, menus: [] }),
      // The menu's principales list, so the optional-choice hint renders.
      get: async () => ({ success: true, menu: { id: 3, principales: { items: ["Arrozmeloso", "Lomo de cerdo"] } } }),
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
  customer_name: "Ana García",
  contact_phone: "600000000",
  contact_phone_country_code: "34",
  contact_email: "",
  table_number: "",
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
      label: "Menú especial",
      unit_price: 40,
      count: 4,
      adelanto_per_unit: 0,
      adelanto_payment_method: null,
      items: [],
    },
  ],
  specialAdelantosPaid: [],
});

// Real timers: a date library in the editor tree reads the clock, which fake
// timers leave undefined.
const settle = () => act(async () => { for (let i = 0; i < 5; i++) await Promise.resolve(); });

async function clickSubmit() {
  await act(async () => {
    screen.getByRole("button", { name: "Guardar" }).click();
    await Promise.resolve();
  });
}

// A special-date booking whose menu has no principal dishes picked must still
// save: the operator may decide the mains on the day.
// Coordination id: special_booking_optional_principales_v1
describe("BookingEditor: special-date principals are optional", () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it("enables the submit button with no principal chosen for any guest", async () => {
    render(<BookingEditor api={api} initial={baseDraft()} busy={false} submitLabel="Guardar" onSubmit={async () => {}} />);
    await settle();
    expect(screen.getByRole("button", { name: "Guardar" })).toBeEnabled();
    // The pending count stays visible, so the operator can see what is open.
    expect(screen.getByText(/4 principal\(es\) sin elegir/)).toBeInTheDocument();
  });

  it("submits the booking without the main-dish block error", async () => {
    const onSubmit = vi.fn(async (_payload: any) => {});
    render(<BookingEditor api={api} initial={baseDraft()} busy={false} submitLabel="Guardar" onSubmit={onSubmit} />);
    await settle();
    await clickSubmit();
    expect(onSubmit).toHaveBeenCalledTimes(1);
    const payload = onSubmit.mock.calls[0][0] as any;
    expect(payload.special?.menus?.[0]?.count).toBe(4);
    expect(payload.special?.menus?.[0]?.items).toEqual([]);
    expect(screen.queryByText(/Selecciona los principales del menú/)).not.toBeInTheDocument();
  });

  it("still sends the dishes that were chosen", async () => {
    const onSubmit = vi.fn(async (_payload: any) => {});
    const draft = baseDraft();
    draft.specialMenus = [{ ...draft.specialMenus![0], items: [{ dish_id: 3, name: "Arrozmeloso" }] }];
    render(<BookingEditor api={api} initial={draft} busy={false} submitLabel="Guardar" onSubmit={onSubmit} />);
    await settle();
    await clickSubmit();
    const payload = onSubmit.mock.calls[0][0] as any;
    expect(payload.special?.menus?.[0]?.items).toEqual([{ dish_id: 3, name: "Arrozmeloso" }]);
  });

  it("keeps saving blocked when the menu counters do not add up to the party size", async () => {
    const onSubmit = vi.fn(async (_payload: any) => {});
    const draft = baseDraft();
    draft.specialMenus = [{ ...draft.specialMenus![0], count: 2 }];
    render(<BookingEditor api={api} initial={draft} busy={false} submitLabel="Guardar" onSubmit={onSubmit} />);
    await settle();
    await clickSubmit();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText(/debe coincidir con el número de comensales/)).toBeInTheDocument();
  });
});
