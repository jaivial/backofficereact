import React, { useCallback, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Filter, FilterX } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import { Select } from "../../../../ui/inputs/Select";
import { DatePicker } from "../../../../ui/inputs/DatePicker";
import type { InvoiceStatus } from "../../../../api/types";

type InvoiceFiltersProps = {
  searchText: string;
  statusFilter: InvoiceStatus | "";
  dateType: "invoice_date" | "reservation_date";
  dateFrom: string;
  dateTo: string;
  isReservation: boolean | null;
  sortBy: string;
  hasFilters: boolean;
  summaryText: string;
  statusOptions: { value: InvoiceStatus | ""; label: string }[];
  sortOptions: { value: string; label: string }[];
  onSearchChange: (value: string) => void;
  onStatusFilterChange: (value: InvoiceStatus | "") => void;
  onDateTypeChange: (value: "invoice_date" | "reservation_date") => void;
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
  onIsReservationChange: (value: boolean | null) => void;
  onSortByChange: (value: string) => void;
  onResetFilters: () => void;
  onApplyFilters: () => void;
};

export function InvoiceFilters({
  searchText,
  statusFilter,
  dateType,
  dateFrom,
  dateTo,
  isReservation,
  sortBy,
  hasFilters,
  summaryText,
  statusOptions,
  sortOptions,
  onSearchChange,
  onStatusFilterChange,
  onDateTypeChange,
  onDateFromChange,
  onDateToChange,
  onIsReservationChange,
  onSortByChange,
  onResetFilters,
  onApplyFilters,
}: InvoiceFiltersProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const reduceMotion = useReducedMotion();

  const toggleExpanded = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  const handleDateFromChange = useCallback(
    (iso: string) => {
      onDateFromChange(iso);
    },
    [onDateFromChange],
  );

  const handleDateToChange = useCallback(
    (iso: string) => {
      onDateToChange(iso);
    },
    [onDateToChange],
  );

  return (
    <div className="bo-invoiceFilters" aria-label="Filtros de facturas">
      <div className="bo-invoiceFiltersHead">
        <div className="bo-invoiceFiltersTitle">
          <Filter size={15} />
          <span>Filtros</span>
        </div>
        <button
          className="bo-btn bo-btn--ghost bo-btn--sm bo-invoiceFiltersToggle"
          type="button"
          onClick={toggleExpanded}
          aria-expanded={isExpanded}
          aria-label={isExpanded ? "Colapsar filtros" : "Expandir filtros"}
        >
          {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </button>
      </div>

      <AnimatePresence initial={false}>
        {isExpanded ? (
          <motion.div
            key="expanded-filters"
            style={{ overflow: "hidden" }}
            initial={reduceMotion ? { opacity: 1, height: "auto" } : { opacity: 0, height: 0, y: -6 }}
            animate={{ opacity: 1, height: "auto", y: 0 }}
            exit={reduceMotion ? { opacity: 1, height: "auto" } : { opacity: 0, height: 0, y: -6 }}
            transition={reduceMotion ? { duration: 0 } : { duration: 0.5, ease: "easeInOut" }}
          >
            <div className="bo-invoiceFiltersGrid">
              <label className="bo-field bo-invoiceFilter bo-invoiceFilter--search">
                <span className="bo-label">Buscar</span>
                <input
                  className="bo-input"
                  type="search"
                  value={searchText}
                  placeholder="Nombre o email"
                  onChange={(e) => onSearchChange(e.target.value)}
                />
              </label>

              <label className="bo-field bo-invoiceFilter bo-invoiceFilter--status">
                <span className="bo-label">Estado</span>
                <Select
                  value={statusFilter}
                  onChange={(value) => onStatusFilterChange(value as InvoiceStatus | "")}
                  options={statusOptions}
                  ariaLabel="Estado"
                />
              </label>

              <label className="bo-field bo-invoiceFilter bo-invoiceFilter--sort">
                <span className="bo-label">Ordenar</span>
                <Select
                  value={sortBy}
                  onChange={onSortByChange}
                  options={sortOptions}
                  ariaLabel="Ordenar"
                />
              </label>

              <div className="bo-field bo-invoiceFilter bo-invoiceFilter--dateType">
                <span className="bo-label">Tipo de fecha</span>
                <Select
                  value={dateType}
                  onChange={(value) => onDateTypeChange(value as "invoice_date" | "reservation_date")}
                  options={[
                    { value: "invoice_date", label: "Fecha factura" },
                    { value: "reservation_date", label: "Fecha reserva" },
                  ]}
                  ariaLabel="Tipo de fecha"
                />
              </div>

              <label className="bo-field bo-invoiceFilter bo-invoiceFilter--dateFrom">
                <span className="bo-label">Desde</span>
                <DatePicker value={dateFrom || ""} onChange={handleDateFromChange} />
              </label>

              <label className="bo-field bo-invoiceFilter bo-invoiceFilter--dateTo">
                <span className="bo-label">Hasta</span>
                <DatePicker value={dateTo || ""} onChange={handleDateToChange} />
              </label>

              <div className="bo-field bo-invoiceFilter bo-invoiceFilter--isReservation">
                <span className="bo-label">Reserva</span>
                <Select
                  value={isReservation === null ? "" : isReservation ? "true" : "false"}
                  onChange={(value) => {
                    if (value === "") onIsReservationChange(null);
                    else onIsReservationChange(value === "true");
                  }}
                  options={[
                    { value: "", label: "Todos" },
                    { value: "true", label: "Con reserva" },
                    { value: "false", label: "Sin reserva" },
                  ]}
                  ariaLabel="Reserva"
                />
              </div>
            </div>

            <div className="bo-invoiceFiltersFoot">
              <div className="bo-mutedText bo-invoiceFiltersCount">{summaryText}</div>
              <div className="bo-invoiceFiltersActions">
                <button
                  className={`bo-btn bo-btn--ghost bo-btn--sm bo-invoiceClearBtn ${hasFilters ? "" : "is-hidden"}`.trim()}
                  type="button"
                  disabled={!hasFilters}
                  onClick={onResetFilters}
                  tabIndex={hasFilters ? 0 : -1}
                  aria-hidden={!hasFilters}
                >
                  <FilterX size={15} />
                  Limpiar filtros
                </button>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
