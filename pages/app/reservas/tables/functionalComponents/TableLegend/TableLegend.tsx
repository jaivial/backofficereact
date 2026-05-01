import React from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { CalendarDays, ChevronLeft, GripVertical, LayoutGrid, Trash2, FileText } from "lucide-react";
import { DropdownMenu } from "../../../../../../ui/inputs/DropdownMenu";
import { Select } from "../../../../../../ui/inputs/Select";
import { formatHHMM } from "../../../../../../ui/lib/format";
import { Tabs, type TabItem } from "../../../../../../ui/nav/Tabs";
import type { Booking, TableMapItem } from "../../../../../../api/types";
import type { BookingState } from "../../types/tables";
import { todayISO } from "../../helpers/tables";

// === Booking Row Component ===

interface BookingRowProps {
  booking: Booking;
  seated?: boolean;
  isAssigning?: boolean;
  isAssignMode: boolean;
  isSelected: boolean;
  onSelect: (booking: Booking) => void;
  onSelectCheckbox: (booking: Booking, checked: boolean) => void;
  onCancel: (booking: Booking) => void;
}

export function BookingRow({
  booking,
  seated,
  isAssigning,
  isAssignMode,
  isSelected,
  onSelect,
  onSelectCheckbox,
  onCancel,
}: BookingRowProps) {
  const isUnassigned = !booking.table_number;

  return (
    <div
      data-ui="booking-row"
      className={`bo-tableMapBookingRow${seated ? " is-seated" : " is-pending"}${isAssigning ? " is-assigning" : ""}${isAssignMode ? " is-assign-mode" : ""}${isSelected ? " is-selected" : ""}${isAssignMode && !isUnassigned ? " is-disabled" : ""}`}
      onClick={() => {
        if (isAssignMode && !isUnassigned) return;
        onSelect(booking);
      }}
    >
      {isAssignMode ? (
        <label data-ui="booking-checkbox" className="bo-checkboxContainer" onClick={(e) => e.stopPropagation()}>
          <input
            data-ui="booking-checkbox-input"
            type="checkbox"
            checked={isSelected}
            onChange={(e) => {
              e.stopPropagation();
              onSelectCheckbox(booking, e.target.checked);
            }}
            onClick={(e) => e.stopPropagation()}
          />
          <span data-ui="checkbox-mark" className="bo-checkboxMark" />
        </label>
      ) : (
        <span data-ui="drag-handle" className="bo-bookingDragIndicator"><GripVertical size={16}></span>
      )}
      <span data-ui="booking-status-dot" className="bo-tableMapBookingStatusDot" />
      <div data-ui="booking-main" className="bo-tableMapBookingMain">
        <strong data-ui="booking-table-customer">{booking.table_number || "—"} · {booking.customer_name}</strong>
        <span data-ui="booking-pax-time">{booking.party_size} pax · {formatHHMM(booking.reservation_time)}</span>
      </div>
      <DropdownMenu
        label="Acciones reserva"
        triggerClassName="bo-actionBtn bo-actionBtn--glass"
        items={[
          { id: "details", label: "Ver", icon: <FileText size={16} strokeWidth={1.8}>, onSelect: () => onSelect(booking) },
          { id: "cancel", label: "Cancelar", tone: "danger", icon: <Trash2 size={16} strokeWidth={1.8}>, onSelect: () => onCancel(booking) },
        ]}
      />
    </div>
  );
}

// === Table Card Component ===

interface TableCardProps {
  table: TableMapItem;
  variant: "seated" | "booked" | "free";
  isSelected: boolean;
  onClick: (table: TableMapItem) => void;
  currentBooking?: Booking;
}

export function TableCard({ table, variant, isSelected, onClick, currentBooking }: TableCardProps) {
  return (
    <div
      key={`table-card-${table.id}`}
      data-ui={`table-card-${variant}`}
      className={`bo-tableMapTableCard is-${variant}${isSelected ? " is-selected" : ""}`}
      onClick={() => onClick(table)}
    >
      <span data-ui="table-card-occ" className="bo-tableMapTableCardOcc" />
      <span data-ui="table-card-name" className="bo-tableMapTableCardNum">{table.name}</span>
      <span data-ui="table-card-cap" className="bo-tableMapTableCardCap">{table.capacity} pax</span>
      {currentBooking && (
        <span data-ui="table-card-booking" className="bo-tableMapTableCardBooking">
          {currentBooking.customer_name?.split(' ')[0]} · {formatHHMM(currentBooking.reservation_time)}
        </span>
      )}
    </div>
  );
}

// === Table Legend Props ===

interface TableLegendProps {
  sheetTab: "reservas" | "mesas";
  onSheetTabChange: (tab: "reservas" | "mesas") => void;
  bookingStats: { total: number; seated: number; pending: number };
  bookings: Booking[];
  bookingStates: Record<string, BookingState>;
  unassignedBookings: Booking[];
  hasUnassignedBookings: boolean;
  assignMode: boolean;
  selectedBookingId: number | null;
  bookingForAssignment: Booking | null;
  onAssignModeToggle: () => void;
  onCancelAssignmentMode: () => void;
  onSelectBooking: (booking: Booking) => void;
  onSelectBookingCheckbox: (booking: Booking, checked: boolean) => void;
  onCancelBooking: (booking: Booking) => void;
  // Table sheet
  tableSheetView: "list" | "table-detail";
  selectedTableCardId: number | null;
  selectedTableCard: TableMapItem | null;
  selectedTableCardBookings: Booking[];
  selectedTableCardIsOccupied: boolean;
  tablesByStatus: { free: TableMapItem[]; booked: TableMapItem[]; seated: TableMapItem[] };
  tableSummary: { total: number; free: number; booked: number; seated: number };
  getTableBookings: (tableName: string) => Booking[];
  onTableCardClick: (table: TableMapItem) => void;
  onCloseTableDetail: () => void;
  onAssignBookingToFreeTable: (booking: Booking, tableName: string) => void;
  onUnassignBookingFromTable: (booking: Booking) => void;
  onMarkBookingSeated: (booking: Booking, seated: boolean) => void;
  // Sheet controls
  rightSheetOpen: boolean;
  calendarExpanded: boolean;
  selectedDate: string;
  visibleTables: TableMapItem[];
  floorTabs: Array<{ floorNumber: number; label: string }>;
  selectedFloor: number;
  onFloorChange: (floor: number) => void;
  onCalendarToggle: () => void;
  onDateSelect: (date: string) => void;
  calendarView: { year: number; month: number };
  calendarDays: import("../../../../../../api/types").CalendarDay[];
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onCloseRightSheet: () => void;
  loading: boolean;
}

export function TableLegend({
  sheetTab,
  onSheetTabChange,
  bookingStats,
  bookings,
  bookingStates,
  unassignedBookings,
  hasUnassignedBookings,
  assignMode,
  selectedBookingId,
  bookingForAssignment,
  onAssignModeToggle,
  onCancelAssignmentMode,
  onSelectBooking,
  onSelectBookingCheckbox,
  onCancelBooking,
  tableSheetView,
  selectedTableCardId,
  selectedTableCard,
  selectedTableCardBookings,
  selectedTableCardIsOccupied,
  tablesByStatus,
  tableSummary,
  getTableBookings,
  onTableCardClick,
  onCloseTableDetail,
  onAssignBookingToFreeTable,
  onUnassignBookingFromTable,
  onMarkBookingSeated,
  rightSheetOpen,
  calendarExpanded,
  selectedDate,
  visibleTables,
  floorTabs,
  selectedFloor,
  onFloorChange,
  onCalendarToggle,
  onDateSelect,
  calendarView,
  calendarDays,
  onPrevMonth,
  onNextMonth,
  onCloseRightSheet,
  loading,
}: TableLegendProps) {
  const reduceMotion = useReducedMotion();

  const reservasTabItems: TabItem[] = [
    { id: "reservas", label: "Reservas", href: "#reservas", icon: <CalendarDays className="bo-ico" /> },
    { id: "mesas", label: "Mesas", href: "#mesas", icon: <LayoutGrid className="bo-ico" /> },
  ];

  return (
    <aside data-ui="right-sheet" className={`bo-tableMapSheet${rightSheetOpen ? " is-open" : ""}`} aria-label="Panel de reservas">
      <div data-slot="sheet-head" className="bo-tableMapSheetHead">
        {bookingForAssignment ? (
          <div data-ui="assigning-banner" className="bo-assigningBanner">
            <span>Asignando: <strong data-ui="assigning-name">{bookingForAssignment.customer_name}</strong></span>
            <button data-ui="cancel-assign-btn" className="bo-btn bo-btn--ghost bo-btn--sm" type="button" onClick={onCancelAssignmentMode}>Cancelar</button>
          </div>
        ) : (
          <div data-ui="sheet-stats" className="bo-tableMapSheetStats">
            <span data-ui="stat-total" className="bo-tableMapSheetStat bo-tableMapSheetStat--total">
              <span data-ui="stat-dot" className="bo-tableMapSheetStatDot" />{bookingStats.total} reservas
            </span>
            <span data-ui="stat-seated" className="bo-tableMapSheetStat bo-tableMapSheetStat--seated">
              <span data-ui="stat-dot" className="bo-tableMapSheetStatDot" />{bookingStats.seated} sentadas
            </span>
            <span data-ui="stat-pending" className="bo-tableMapSheetStat bo-tableMapSheetStat--pending">
              <span data-ui="stat-dot" className="bo-tableMapSheetStatDot" />{bookingStats.pending} pendientes
            </span>
          </div>
        )}
        <div data-slot="sheet-header" className="bo-tableMapSheetHeader">
          <div data-slot="sheet-header-left" className="bo-tableMapSheetHeaderLeft">
            <div data-ui="sheet-title" className="bo-panelTitle">Booking manager</div>
            <div data-ui="sheet-meta" className="bo-panelMeta">{visibleTables.length} mesas</div>
          </div>
          <div data-slot="sheet-header-actions" className="bo-tableMapSheetHeaderActions">
            <button data-ui="date-toggle-btn" className="bo-btn bo-btn--ghost bo-tableMapDateBtn" type="button" onClick={onCalendarToggle} aria-expanded={calendarExpanded}>
              <CalendarRange size={14}>
              <span data-ui="date-label">{selectedDate}</span>
            </button>
            <button
              data-ui="collapse-sheet-btn"
              className="bo-actionBtn bo-actionBtn--glass bo-tableMapSheetToggleBtn"
              type="button"
              aria-label="Colapsar panel derecho"
              onClick={onCloseRightSheet}
            >
              <PanelRightClose size={18} strokeWidth={1.8}>
            </button>
          </div>
        </div>
      </div>
      <div data-slot="sheet-body" className="bo-tableMapSheetBody">
        {calendarExpanded ? (
          <div data-ui="calendar-wrapper" className="bo-tableMapCalendarWrapper">
            <MonthCalendar
              year={calendarView.year}
              month={calendarView.month}
              days={calendarDays}
              selectedDateISO={selectedDate}
              onSelectDate={(date) => { onDateSelect(date); onCalendarToggle(); }}
              onPrevMonth={onPrevMonth}
              onNextMonth={onNextMonth}
              loading={loading}
            />
          </div>
        ) : null}

        {floorTabs.length > 1 && (
          <div data-ui="sheet-floor-tabs" className="bo-tableMapFloorTabs" role="tablist" aria-label="Seleccionar salon/planta">
            {floorTabs.map((floor) => {
              const active = floor.floorNumber === selectedFloor;
              return (
                <button
                  key={`sheet-floor-${floor.floorNumber}`}
                  data-ui="sheet-floor-tab"
                  type="button"
                  role="tab"
                  aria-selected={active}
                  className={`bo-tableMapFloorTab${active ? " is-active" : ""}`}
                  onClick={() => onFloorChange(floor.floorNumber)}
                >
                  {floor.label}
                </button>
              );
            })}
          </div>
        )}

        <Tabs
          tabs={reservasTabItems}
          activeId={sheetTab}
          ariaLabel="Reservas o mesas"
          className="bo-tabs--reservas bo-tabs--compact"
          onNavigate={(href, id, ev) => {
            ev.preventDefault();
            onSheetTabChange(id === "mesas" ? "mesas" : "reservas");
          }}
        />

        <div data-ui="sheet-content" className="bo-tableMapSheetContent">
          {sheetTab === "reservas" ? (
            <div data-ui="reservations-section" className="bo-tableMapSection">
              <div data-slot="reservations-header" className="bo-tableMapSectionHeader">
                <div data-ui="reservations-title" className="bo-tableMapSectionTitle">Reservas del día</div>
                {bookings.length > 0 && hasUnassignedBookings && !assignMode && (
                  <button
                    data-ui="assign-table-btn"
                    className="bo-btn bo-btn--primary bo-btn--sm"
                    type="button"
                    onClick={onAssignModeToggle}
                  >
                    Asignar mesa
                  </button>
                )}
                {assignMode && (
                  <button
                    data-ui="cancel-assign-mode-btn"
                    className="bo-btn bo-btn--ghost bo-btn--sm"
                    type="button"
                    onClick={onCancelAssignmentMode}
                  >
                    Cancelar
                  </button>
                )}
              </div>
              {bookings.length === 0 ? (
                <div data-ui="empty-bookings" className="bo-tableMapEmptyState">
                  <div data-ui="empty-icon" className="bo-tableMapEmptyStateIcon"><CalendarDays size={24}></div>
                  <div data-ui="empty-text">No hay reservas para esta fecha</div>
                  <button data-ui="today-btn" className="bo-btn bo-btn--ghost bo-btn--sm" type="button" onClick={() => onDateSelect(todayISO())}>Ver hoy</button>
                </div>
              ) : (
                <div data-ui="bookings-list" className="bo-tableMapBookingsList">
                  {assignMode && hasUnassignedBookings && (
                    <div data-ui="assign-hint" className="bo-tableMapAssignModeHint">Selecciona una reserva sin mesa asignada</div>
                  )}
                  {assignMode && !hasUnassignedBookings && (
                    <div data-ui="all-assigned" className="bo-tableMapEmptyState">
                      <div data-ui="empty-icon" className="bo-tableMapEmptyStateIcon"><LayoutGrid size={24}></div>
                      <div data-ui="empty-text">Todas las reservas tienen mesa asignada</div>
                    </div>
                  )}
                  {(bookings.filter(b => !assignMode || !b.table_number) || []).map((booking) => {
                    const seated = bookingStates[String(booking.id)]?.seated;
                    const isUnassigned = !booking.table_number;
                    const isAssigning = bookingForAssignment?.id === booking.id;
                    const isSelected = selectedBookingId === booking.id;
                    return (
                      <BookingRow
                        key={booking.id}
                        booking={booking}
                        seated={seated}
                        isAssigning={isAssigning}
                        isAssignMode={assignMode}
                        isSelected={isSelected}
                        onSelect={onSelectBooking}
                        onSelectCheckbox={(b, checked) => {
                          if (checked) {
                            onSelectBooking(b);
                          }
                        }}
                        onCancel={onCancelBooking}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <AnimatePresence mode="wait" initial={false}>
              {tableSheetView === "table-detail" && selectedTableCard ? (
                <motion.div
                  key="table-detail"
                  data-ui="table-detail-view"
                  className="bo-tableSheetDetail"
                  initial={reduceMotion ? { opacity: 1 } : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={reduceMotion ? { opacity: 1 } : { opacity: 0 }}
                  transition={reduceMotion ? { duration: 0 } : { duration: 0.18, ease: "easeInOut" }}
                >
                  <div data-slot="detail-header" className="bo-tableSheetDetailHeader">
                    <button data-ui="back-to-list-btn" className="bo-actionBtn bo-actionBtn--glass" type="button" onClick={onCloseTableDetail} aria-label="Volver a mesas">
                      <ChevronLeft size={18} strokeWidth={1.8}>
                    </button>
                    <div data-ui="detail-table-info" className="bo-tableSheetDetailTableInfo">
                      <span data-ui="detail-table-name" className="bo-tableSheetDetailTableName">{selectedTableCard.name}</span>
                      <span data-ui="detail-table-cap" className="bo-tableSheetDetailTableCap">{selectedTableCard.capacity} pax</span>
                    </div>
                    <span data-ui="detail-status-pill" className={`bo-tableSheetDetailStatusPill${selectedTableCardIsOccupied ? " is-occupied" : " is-free"}`}>
                      {selectedTableCardIsOccupied ? "Ocupada" : "Libre"}
                    </span>
                  </div>

                  {selectedTableCardBookings.length > 0 ? (
                    <div data-slot="detail-bookings" className="bo-tableSheetDetailBookings">
                      {selectedTableCardBookings.map((booking) => {
                        const isSeated = bookingStates[String(booking.id)]?.seated;
                        return (
                          <div key={booking.id} data-ui="detail-booking-card" className="bo-tableSheetDetailBookingCard">
                            <div data-slot="booking-card-head" className="bo-tableSheetDetailBookingHead">
                              <div data-ui="booking-customer" className="bo-tableSheetDetailBookingCustomer">{booking.customer_name}</div>
                              <span data-ui="booking-status-pill" className={`bo-tableSheetDetailBookingStatus${isSeated ? " is-seated" : " is-pending"}`}>
                                {isSeated ? "Sentada" : "Pendiente"}
                              </span>
                            </div>
                            <div data-slot="booking-card-meta" className="bo-tableSheetDetailBookingMeta">
                              <span data-ui="booking-pax">{booking.party_size} pax</span>
                              <span data-ui="booking-time">{formatHHMM(booking.reservation_time)}</span>
                              {booking.contact_phone && <span data-ui="booking-phone">{booking.contact_phone}</span>}
                            </div>
                            {booking.commentary ? (
                              <div data-ui="booking-comment" className="bo-tableSheetDetailBookingComment">{booking.commentary}</div>
                            ) : null}
                            <div data-slot="booking-card-actions" className="bo-tableSheetDetailBookingActions">
                              <button
                                data-ui="toggle-seated-detail-btn"
                                className="bo-btn bo-btn--ghost bo-btn--sm"
                                type="button"
                                onClick={() => onMarkBookingSeated(booking, !isSeated)}
                              >
                                {isSeated ? "Desmarcar sentada" : "Marcar sentada"}
                              </button>
                              <button
                                data-ui="unassign-booking-btn"
                                className="bo-btn bo-btn--ghost bo-btn--sm"
                                type="button"
                                onClick={() => onUnassignBookingFromTable(booking)}
                              >
                                Desasignar mesa
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div data-ui="no-bookings-detail" className="bo-tableMapEmptyState">
                      <div data-ui="empty-text">No hay reservas para esta mesa</div>
                    </div>
                  )}
                </motion.div>
              ) : (
                <motion.div
                  key="table-list"
                  data-ui="tables-section"
                  className="bo-tableMapSection"
                  initial={reduceMotion ? { opacity: 1 } : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={reduceMotion ? { opacity: 1 } : { opacity: 0 }}
                  transition={reduceMotion ? { duration: 0 } : { duration: 0.18, ease: "easeInOut" }}
                >
                  <div data-slot="tables-header" className="bo-tableMapSectionHeader">
                    <div data-ui="tables-title" className="bo-tableMapSectionTitle">Estado de mesas</div>
                    <div data-ui="tables-summary" className="bo-tableMapSectionSummary">
                      <span data-ui="summary-free" className="bo-tableMapSummaryItem bo-tableMapSummaryItem--free">{tableSummary.free} libres</span>
                      <span data-ui="summary-booked" className="bo-tableMapSummaryItem bo-tableMapSummaryItem--booked">{tableSummary.booked} reservadas</span>
                      <span data-ui="summary-seated" className="bo-tableMapSummaryItem bo-tableMapSummaryItem--seated">{tableSummary.seated} ocupadas</span>
                    </div>
                  </div>
                  {visibleTables.length === 0 ? (
                    <div data-ui="empty-tables" className="bo-tableMapEmptyState">
                      <div data-ui="empty-icon" className="bo-tableMapEmptyStateIcon"><LayoutGrid size={24}></div>
                      <div data-ui="empty-text">No hay mesas en este salón</div>
                      <button data-ui="create-table-btn" className="bo-btn bo-btn--ghost bo-btn--sm" type="button" onClick={() => {}}>Crear mesa</button>
                    </div>
                  ) : (
                    <div data-ui="tables-by-status" className="bo-tableMapTablesByStatus">
                      {tablesByStatus.seated.length > 0 && (
                        <div data-ui="status-group-seated" className="bo-tableMapTablesStatusGroup">
                          <div data-ui="status-group-title" className="bo-tableMapTablesStatusGroupTitle">Ocupadas</div>
                          <div data-ui="status-group-grid" className="bo-tableMapTablesGrid">
                            {tablesByStatus.seated.map((table) => {
                              const tableBookings = getTableBookings(table.name);
                              const currentBooking = tableBookings[0];
                              return (
                                <TableCard
                                  key={`table-card-${table.id}`}
                                  table={table}
                                  variant="seated"
                                  isSelected={false}
                                  onClick={onTableCardClick}
                                  currentBooking={currentBooking}
                                />
                              );
                            })}
                          </div>
                        </div>
                      )}
                      {tablesByStatus.booked.length > 0 && (
                        <div data-ui="status-group-booked" className="bo-tableMapTablesStatusGroup">
                          <div data-ui="status-group-title" className="bo-tableMapTablesStatusGroupTitle">Reservadas</div>
                          <div data-ui="status-group-grid" className="bo-tableMapTablesGrid">
                            {tablesByStatus.booked.map((table) => {
                              const tableBookings = getTableBookings(table.name);
                              const currentBooking = tableBookings[0];
                              return (
                                <TableCard
                                  key={`table-card-${table.id}`}
                                  table={table}
                                  variant="booked"
                                  isSelected={false}
                                  onClick={onTableCardClick}
                                  currentBooking={currentBooking}
                                />
                              );
                            })}
                          </div>
                        </div>
                      )}
                      {tablesByStatus.free.length > 0 && (
                        <div data-ui="status-group-free" className="bo-tableMapTablesStatusGroup">
                          <div data-ui="status-group-title" className="bo-tableMapTablesStatusGroupTitle">Libres</div>
                          <div data-ui="status-group-grid" className="bo-tableMapTablesGrid">
                            {tablesByStatus.free.map((table) => {
                              const isCardSelected = selectedTableCardId === table.id;
                              return (
                                <TableCard
                                  key={`table-card-${table.id}`}
                                  table={table}
                                  variant="free"
                                  isSelected={isCardSelected}
                                  onClick={onTableCardClick}
                                />
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          )}
        </div>
      </div>
    </aside>
  );
}

import { CalendarRange, PanelRightClose } from "lucide-react";
import { MonthCalendar } from "../../../../../../ui/widgets/MonthCalendar";
