import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Booking, ConfigFloor } from "../../../api/types";
import { ReservationTable } from "./functionalComponents/ReservationTable/ReservationTable";
import { BookingCard } from "./functionalComponents/BookingCardGrid/BookingCardGrid";
import { BookingDetailsPanel } from "./functionalComponents/BookingDetailsPanel/BookingDetailsPanel";
import { SearchResultsTable } from "./functionalComponents/SearchResultsTable/SearchResultsTable";

const booking = {
  id: 42, customer_name: "Ana", contact_email: "ana@example.com", reservation_date: "2026-09-10", reservation_time: "14:00:00",
  party_size: 2, children: 0, contact_phone: "600000000", contact_phone_country_code: "34", status: "confirmed", arroz_type: null, arroz_servings: null,
  commentary: null, babyStrollers: 0, highChairs: 0, table_number: null, preferred_floor_number: 1, preferred_salon_id: 7, preferred_salon_name: "La Condesa",
  added_date: "2026-09-01 10:00:00", special_menu: false, menu_de_grupo_id: null, principales_json: null,
} as Booking;
const floors: ConfigFloor[] = [{ id: 3, floorNumber: 1, name: "Primera planta", isGround: false, active: true }];
const noop = vi.fn();
const save = vi.fn(async () => true);

describe("reserved booking location", () => {
  it("shows floor and salon in the reservations table", () => {
    render(<ReservationTable rows={[booking]} page={1} totalPages={1} totalCount={1} busy={false} onPageChange={noop} onCancel={noop} onEdit={noop} onOpenDetails={noop} onSaveTable={save} />);
    expect(screen.getByRole("columnheader", { name: "Planta" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Salón" })).toBeInTheDocument();
    expect(screen.getByText("Planta 1")).toBeInTheDocument();
    expect(screen.getByText("La Condesa")).toBeInTheDocument();
  });

  it("shows floor and salon on cards and details modal", () => {
    const { unmount } = render(<BookingCard booking={booking} onOpenDetails={noop} onEdit={noop} onCancel={noop} onCrearFactura={noop} onSaveTable={save} />);
    expect(screen.getByText("Planta", { selector: "dt" })).toBeInTheDocument();
    expect(screen.getByText("Planta 1")).toBeInTheDocument();
    expect(screen.getByText("Salón", { selector: "dt" })).toBeInTheDocument();
    expect(screen.getByText("La Condesa")).toBeInTheDocument();
    unmount();

    render(<BookingDetailsPanel booking={booking} floors={floors} />);
    expect(screen.getByText("Primera planta")).toBeInTheDocument();
    expect(screen.getByText("La Condesa")).toBeInTheDocument();
  });

  it("shows floor and salon in search results", () => {
    render(<SearchResultsTable searchResults={[booking]} searchPage={1} searchTotalPages={1} searchTotalCount={1} searchBusy={false} onSearchPageChange={noop} onNavigate={noop} />);
    expect(screen.getByRole("columnheader", { name: "Planta" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Salón" })).toBeInTheDocument();
    expect(screen.getByText("Planta 1")).toBeInTheDocument();
    expect(screen.getByText("La Condesa")).toBeInTheDocument();
  });
});
