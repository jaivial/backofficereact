import React from "react";
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BookingEditor, type BookingEditorDraft } from "./BookingEditor";

vi.mock("lucide-react", () => ({
  Minus: () => <span data-slot="booking-editor-test-minus" />,
  Plus: () => <span data-slot="booking-editor-test-plus" />,
  Trash2: () => <span data-slot="booking-editor-test-trash" />,
}));

vi.mock("react-country-flag", () => ({
  ReactCountryFlag: () => <span data-slot="booking-editor-test-country-flag" />,
}));

vi.mock("motion/react", () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props} data-slot="booking-editor-test-motion">{children}</div>,
  },
  useReducedMotion: () => true,
}));

vi.mock("../../../../../ui/inputs/DatePicker", () => ({
  DatePicker: () => <div data-slot="booking-editor-test-date-picker" />,
}));

vi.mock("../../../../../ui/inputs/TimePicker", () => ({
  TimePicker: () => <div data-slot="booking-editor-test-time-picker" />,
}));

vi.mock("../../../../../ui/inputs/Select", () => ({
  Select: ({ ariaLabel, placeholder, value }: { ariaLabel?: string; placeholder?: string; value: string }) => (
    <button type="button" aria-label={ariaLabel} data-slot="booking-editor-test-select">{value || placeholder}</button>
  ),
}));

vi.mock("../../../../../ui/feedback/InlineAlert", () => ({
  InlineAlert: () => <div data-slot="booking-editor-test-alert" />,
}));

vi.mock("../../../../../ui/widgets/InlineCounter", () => ({
  InlineCounter: ({ label, max }: { label: string; max: number }) => <div data-slot="booking-editor-test-counter" data-max={max}>{label}</div>,
}));

vi.mock("../../../../../ui/shell/Panel", () => ({
  Panel: ({ children }: { children: React.ReactNode }) => <section data-slot="booking-editor-test-panel">{children}</section>,
}));

const initial: BookingEditorDraft = {
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
  special_menu: true,
  menu_de_grupo_id: 1,
  principales: [{ name: "", servings: 1 }],
  arroz_enabled: false,
  arroz: [],
  commentary: "",
};

describe("BookingEditor", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("keeps principal delete control beside its placeholder while hiding servings", async () => {
    const api = {
      menus: {
        grupos: {
          list: async () => ({ success: true, menus: [{ id: 1, menu_title: "Menú", price: 35 }] }),
          get: async () => ({ success: false }),
        },
      },
    } as any;

    render(<BookingEditor api={api} initial={initial} busy={false} submitLabel="Guardar" onSubmit={async () => {}} />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(screen.getByRole("button", { name: "Principal" })).toHaveTextContent("Selecciona…");
    expect(screen.getByRole("button", { name: "Quitar principal" })).toBeInTheDocument();
    expect(screen.queryByText("Raciones")).not.toBeInTheDocument();
  });

  it("keeps rice delete control beside its placeholder while hiding servings", async () => {
    const api = {
      menus: {
        grupos: {
          list: async () => ({ success: true, menus: [] }),
          get: async () => ({ success: false }),
        },
      },
      arrozTypes: {
        list: async () => ["Arroz bomba"],
      },
    } as any;
    const riceInitial: BookingEditorDraft = {
      ...initial,
      special_menu: false,
      menu_de_grupo_id: null,
      principales: [],
      arroz_enabled: true,
      arroz: [{ type: "", servings: 2 }],
    };

    render(<BookingEditor api={api} initial={riceInitial} busy={false} submitLabel="Guardar" onSubmit={async () => {}} />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByRole("button", { name: "Tipo de arroz" })).toHaveTextContent("Selecciona…");
    expect(screen.getByRole("button", { name: "Quitar arroz" })).toBeInTheDocument();
    expect(screen.queryByText("Raciones")).not.toBeInTheDocument();
  });

  it("disables centered create action until required fields are complete", () => {
    const api = {
      menus: {
        grupos: {
          list: async () => ({ success: true, menus: [] }),
          get: async () => ({ success: false }),
        },
      },
    } as any;
    const incompleteInitial: BookingEditorDraft = {
      ...initial,
      special_menu: false,
      menu_de_grupo_id: null,
      customer_name: "",
      contact_phone: "",
    };

    render(<BookingEditor api={api} initial={incompleteInitial} busy={false} submitLabel="Crear" onSubmit={async () => {}} />);

    const createButton = screen.getByRole("button", { name: "Crear" });
    expect(createButton).toBeDisabled();
    expect(createButton.parentElement).toHaveClass("bo-bookingEditorActions--create");
    expect(screen.getByText("Por favor rellena los campos obligatorios")).toBeInTheDocument();
  });

  it("hides add principal after allocated servings reach party size", async () => {
    const api = {
      menus: {
        grupos: {
          list: async () => ({ success: true, menus: [{ id: 1, menu_title: "Menú", price: 35 }] }),
          get: async () => ({ success: false }),
        },
      },
    } as any;
    const completedPrincipales: BookingEditorDraft = {
      ...initial,
      principales: [{ name: "Principal", servings: 4 }],
    };

    render(<BookingEditor api={api} initial={completedPrincipales} busy={false} submitLabel="Guardar" onSubmit={async () => {}} />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(screen.queryByRole("button", { name: "Añadir principal" })).not.toBeInTheDocument();
    expect(screen.getByText("Raciones")).toHaveAttribute("data-max", "4");
  });
});
