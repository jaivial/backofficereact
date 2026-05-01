import React, { useCallback, useMemo, useState, forwardRef, useImperativeHandle, useEffect } from "react";
import { ChevronDown, ChevronUp, Filter, FilterX, Download, Save, Trash2, Bookmark, Calendar, Upload, History } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import { Select } from "../../../../ui/inputs/Select";
import { DatePicker } from "../../../../ui/inputs/DatePicker";
import type { InvoiceStatus, InvoiceCategory } from "../../../../api/types";
import { INVOICE_CATEGORY_OPTIONS } from "../../../../api/types";

export type DatePreset = "today" | "this_week" | "this_month" | "last_month" | "this_year" | "custom" | "";

export interface InvoiceFilterPreset {
  id: string;
  name: string;
  searchText: string;
  statusFilter: InvoiceStatus | "";
  categoryFilter: InvoiceCategory | "";
  tagFilter: string;
  dateType: "invoice_date" | "reservation_date";
  dateFrom: string;
  dateTo: string;
  dueDateFrom: string;
  dueDateTo: string;
  isOverdue: boolean | null;
  isReservation: boolean | null;
  isCreditNote: boolean | null;
  sortBy: string;
}

// Helper function to format date range for display
function formatDateRangeText(dateFrom: string, dateTo: string, preset: DatePreset): string {
  if (!dateFrom && !dateTo) return "";

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    return date.toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });
  };

  switch (preset) {
    case "today": return "Hoy";
    case "this_week": return "Esta semana";
    case "this_month": return "Este mes";
    case "last_month": return "Último mes";
    case "this_year": return "Este año";
    case "custom":
    default:
      if (dateFrom && dateTo) return `${formatDate(dateFrom)} - ${formatDate(dateTo)}`;
      if (dateFrom) return `Desde ${formatDate(dateFrom)}`;
      if (dateTo) return `Hasta ${formatDate(dateTo)}`;
      return "";
  }
}

// Helper function to calculate date ranges for presets
function calculateDateRange(preset: DatePreset): { from: string; to: string } {
  const now = new Date();
  const today = now.toISOString().split("T")[0];

  switch (preset) {
    case "today":
      return { from: today, to: today };
    case "this_week": {
      const dayOfWeek = now.getDay();
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const monday = new Date(now);
      monday.setDate(now.getDate() + mondayOffset);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      return {
        from: monday.toISOString().split("T")[0],
        to: sunday.toISOString().split("T")[0],
      };
    }
    case "this_month": {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return {
        from: firstDay.toISOString().split("T")[0],
        to: lastDay.toISOString().split("T")[0],
      };
    }
    case "last_month": {
      const firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth(), 0);
      return {
        from: firstDay.toISOString().split("T")[0],
        to: lastDay.toISOString().split("T")[0],
      };
    }
    case "this_year": {
      const firstDay = new Date(now.getFullYear(), 0, 1);
      const lastDay = new Date(now.getFullYear(), 11, 31);
      return {
        from: firstDay.toISOString().split("T")[0],
        to: lastDay.toISOString().split("T")[0],
      };
    }
    default:
      return { from: "", to: "" };
  }
}

// LocalStorage key for persisting date preset
const STORAGE_KEY = "invoice_date_preset";

export interface InvoiceFiltersRef {
  focusSearch: () => void;
}

type SearchByOption = "name" | "email" | "invoice_number";

type InvoiceFiltersProps = {
  searchText: string;
  searchBy?: SearchByOption;
  statusFilter: InvoiceStatus | "";
  categoryFilter?: InvoiceCategory | "";
  tagFilter?: string;
  dateType: "invoice_date" | "reservation_date";
  dateFrom: string;
  dateTo: string;
  dueDateFrom?: string;
  dueDateTo?: string;
  isOverdue?: boolean | null;
  isReservation: boolean | null;
  isCreditNote?: boolean | null;
  sortBy: string;
  hasFilters: boolean;
  summaryText: string;
  statusOptions: { value: InvoiceStatus | ""; label: string }[];
  categoryOptions?: { value: InvoiceCategory | ""; label: string }[];
  sortOptions: { value: string; label: string }[];
  savedFilters?: InvoiceFilterPreset[];
  onSearchChange: (value: string) => void;
  onSearchByChange?: (value: SearchByOption) => void;
  onStatusFilterChange: (value: InvoiceStatus | "") => void;
  onCategoryFilterChange?: (value: InvoiceCategory | "") => void;
  onTagFilterChange?: (value: string) => void;
  onDateTypeChange: (value: "invoice_date" | "reservation_date") => void;
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
  onDueDateFromChange?: (value: string) => void;
  onDueDateToChange?: (value: string) => void;
  onIsOverdueChange?: (value: boolean | null) => void;
  onIsReservationChange: (value: boolean | null) => void;
  onIsCreditNoteChange?: (value: boolean | null) => void;
  onSortByChange: (value: string) => void;
  onResetFilters: () => void;
  onApplyFilters: () => void;
  onExportCSV?: () => void;
  onImport?: () => void;
  onImportHistory?: () => void;
  onSaveFilter?: (name: string) => void;
  onLoadFilter?: (preset: InvoiceFilterPreset) => void;
  onDeleteFilter?: (id: string) => void;
  onDatePresetChange?: (preset: DatePreset) => void;
};

export const InvoiceFilters = forwardRef<InvoiceFiltersRef, InvoiceFiltersProps>(function InvoiceFilters({
  searchText,
  searchBy = "name",
  statusFilter,
  categoryFilter = "",
  tagFilter = "",
  dateType,
  dateFrom,
  dateTo,
  dueDateFrom = "",
  dueDateTo = "",
  isOverdue = null,
  isReservation,
  isCreditNote = null,
  sortBy,
  hasFilters,
  summaryText,
  statusOptions,
  categoryOptions = INVOICE_CATEGORY_OPTIONS,
  sortOptions,
  savedFilters = [],
  onSearchChange,
  onSearchByChange = () => {},
  onStatusFilterChange,
  onCategoryFilterChange = () => {},
  onTagFilterChange = () => {},
  onDateTypeChange,
  onDateFromChange,
  onDateToChange,
  onDueDateFromChange = () => {},
  onDueDateToChange = () => {},
  onIsOverdueChange = () => {},
  onIsReservationChange,
  onIsCreditNoteChange = () => {},
  onSortByChange,
  onResetFilters,
  onApplyFilters,
  onExportCSV,
  onImport,
  onImportHistory,
  onSaveFilter = () => {},
  onLoadFilter = () => {},
  onDeleteFilter = () => {},
  onDatePresetChange,
}: InvoiceFiltersProps, ref) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [filterName, setFilterName] = useState("");
  const [datePreset, setDatePreset] = useState<DatePreset>("");
  const [showCustomDatePicker, setShowCustomDatePicker] = useState(false);
  const reduceMotion = useReducedMotion();
  const searchInputRef = React.useRef<HTMLInputElement>(null);

  // Load last used date preset from localStorage on mount
  useEffect(() => {
    try {
      const savedPreset = localStorage.getItem(STORAGE_KEY);
      if (savedPreset && ["today", "this_week", "this_month", "last_month", "this_year", "custom", ""].includes(savedPreset)) {
        setDatePreset(savedPreset as DatePreset);
        if (savedPreset !== "" && savedPreset !== "custom") {
          const range = calculateDateRange(savedPreset as DatePreset);
          onDateFromChange(range.from);
          onDateToChange(range.to);
        } else if (savedPreset === "custom") {
          setShowCustomDatePicker(true);
        }
      }
    } catch (e) {
      // localStorage not available
    }
  }, []);

  // Save date preset to localStorage when it changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, datePreset);
    } catch (e) {
      // localStorage not available
    }
  }, [datePreset]);

  // Reset date preset when both dates are cleared (from reset filters)
  useEffect(() => {
    if (!dateFrom && !dateTo && datePreset !== "") {
      setDatePreset("");
      setShowCustomDatePicker(false);
    }
  }, [dateFrom, dateTo, datePreset]);

  // Calculate display text for the selected date range
  const dateRangeText = useMemo(() => {
    return formatDateRangeText(dateFrom, dateTo, datePreset);
  }, [dateFrom, dateTo, datePreset]);

  const handlePresetClick = useCallback(
    (preset: DatePreset) => {
      setDatePreset(preset);
      if (preset === "custom") {
        setShowCustomDatePicker(true);
      } else {
        setShowCustomDatePicker(false);
        const range = calculateDateRange(preset);
        onDateFromChange(range.from);
        onDateToChange(range.to);
      }
      if (onDatePresetChange) {
        onDatePresetChange(preset);
      }
    },
    [onDateFromChange, onDateToChange, onDatePresetChange],
  );

  const handleDateFromChangeInternal = useCallback(
    (iso: string) => {
      onDateFromChange(iso);
      // If user manually changes the date, switch to custom mode
      if (iso && datePreset !== "custom") {
        setDatePreset("custom");
        setShowCustomDatePicker(true);
      }
    },
    [onDateFromChange, datePreset],
  );

  const handleDateToChangeInternal = useCallback(
    (iso: string) => {
      onDateToChange(iso);
      // If user manually changes the date, switch to custom mode
      if (iso && datePreset !== "custom") {
        setDatePreset("custom");
        setShowCustomDatePicker(true);
      }
    },
    [onDateToChange, datePreset],
  );

  useImperativeHandle(ref, () => ({
    focusSearch: () => {
      // Expand filters if collapsed
      if (!isExpanded) {
        setIsExpanded(true);
      }
      // Focus search input after a small delay to allow expansion animation
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, isExpanded ? 0 : 100);
    },
  }), [isExpanded]);

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

  const handleSaveFilter = useCallback(() => {
    if (filterName.trim()) {
      onSaveFilter(filterName.trim());
      setFilterName("");
      setShowSaveDialog(false);
    }
  }, [filterName, onSaveFilter]);

  const handleLoadFilter = useCallback(
    (preset: InvoiceFilterPreset) => {
      onLoadFilter(preset);
    },
    [onLoadFilter],
  );

  const handleDeleteFilter = useCallback(
    (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      onDeleteFilter(id);
    },
    [onDeleteFilter],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        handleSaveFilter();
      } else if (e.key === "Escape") {
        setShowSaveDialog(false);
        setFilterName("");
      }
    },
    [handleSaveFilter],
  );

  return (
    <div className="bo-invoiceFilters" aria-label="Filtros de facturas" data-slot="invoiceFilters-filtros-de-facturas">
      <div className="bo-invoiceFiltersHead" data-slot="invoiceFilters-invoiceFiltersHead">
        <div className="bo-invoiceFiltersTitle" data-slot="invoiceFilters-invoiceFiltersTitle">
          <Filter size={15}>
          <span data-slot="invoiceFilters-ros">Filtros</span>
        </div>
        <button
          className="bo-btn bo-btn--ghost bo-btn--sm bo-invoiceFiltersToggle"
          type="button"
          onClick={toggleExpanded}
          aria-expanded={isExpanded}
          aria-label={isExpanded ? "Colapsar filtros" : "Expandir filtros"}
          data-testid="invoice-filters-toggle-btn"
        >
          {isExpanded ? <ChevronUp size={15}> : <ChevronDown size={15}>}
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
            <div className="bo-invoiceFiltersGrid" data-slot="invoiceFilters-invoiceFiltersGrid">
              <label className="bo-field bo-invoiceFilter bo-invoiceFilter--search" data-slot="invoiceFilters-invoiceFilter--search">
                <span className="bo-label" data-slot="invoiceFilters-label">Buscar</span>
                <div className="bo-searchWithDropdown" data-slot="invoiceFilters-searchWithDropdown">
                  <input
                    ref={searchInputRef}
                    className="bo-input"
                    type="search"
                    value={searchText}
                    placeholder={
                      searchBy === "name" ? "Nombre del cliente" :
                      searchBy === "email" ? "Email del cliente" :
                      "Número de factura"
                    }
                    title="Buscar (Ctrl+F)"
                    onChange={(e) => onSearchChange(e.target.value)}
                    data-testid="invoice-filter-search-input"
                  />
                  <Select
                    value={searchBy}
                    onChange={(value) => onSearchByChange(value as SearchByOption)}
                    options={[
                      { value: "name", label: "Nombre" },
                      { value: "email", label: "Email" },
                      { value: "invoice_number", label: "N. Factura" },
                    ]}
                    ariaLabel="Buscar por"
                    className="bo-searchBySelect"
                    data-testid="invoice-filter-searchby-select"
                  />
                </div>
              </label>

              <label className="bo-field bo-invoiceFilter bo-invoiceFilter--status" data-slot="invoiceFilters-invoiceFilter--status">
                <span className="bo-label" data-slot="invoiceFilters-label">Estado</span>
                <Select
                  value={statusFilter}
                  onChange={(value) => onStatusFilterChange(value as InvoiceStatus | "")}
                  options={statusOptions}
                  ariaLabel="Estado"
                  data-testid="invoice-filter-status-select"
                />
              </label>

              <label className="bo-field bo-invoiceFilter bo-invoiceFilter--category" data-slot="invoiceFilters-invoiceFilter--category">
                <span className="bo-label" data-slot="invoiceFilters-label">Categoria</span>
                <Select
                  value={categoryFilter}
                  onChange={(value) => onCategoryFilterChange(value as InvoiceCategory | "")}
                  options={categoryOptions}
                  ariaLabel="Categoria"
                  data-testid="invoice-filter-category-select"
                />
              </label>

              <label className="bo-field bo-invoiceFilter bo-invoiceFilter--tag" data-slot="invoiceFilters-invoiceFilter--tag">
                <span className="bo-label" data-slot="invoiceFilters-label">Etiqueta</span>
                <input
                  className="bo-input"
                  type="text"
                  value={tagFilter}
                  onChange={(e) => onTagFilterChange(e.target.value)}
                  placeholder="Filtrar por etiqueta..."
                  data-testid="invoice-filter-tag-input"
                />
              </label>

              <label className="bo-field bo-invoiceFilter bo-invoiceFilter--sort" data-slot="invoiceFilters-invoiceFilter--sort">
                <span className="bo-label" data-slot="invoiceFilters-label">Ordenar</span>
                <Select
                  value={sortBy}
                  onChange={onSortByChange}
                  options={sortOptions}
                  ariaLabel="Ordenar"
                  data-testid="invoice-filter-sort-select"
                />
              </label>

              <div className="bo-field bo-invoiceFilter bo-invoiceFilter--dateType" data-slot="invoiceFilters-invoiceFilter--dateType">
                <span className="bo-label" data-slot="invoiceFilters-label">Tipo de fecha</span>
                <Select
                  value={dateType}
                  onChange={(value) => onDateTypeChange(value as "invoice_date" | "reservation_date")}
                  options={[
                    { value: "invoice_date", label: "Fecha factura" },
                    { value: "reservation_date", label: "Fecha reserva" },
                  ]}
                  ariaLabel="Tipo de fecha"
                  data-testid="invoice-filter-datetype-select"
                />
              </div>

              {/* Date Range Presets */}
              <div className="bo-field bo-invoiceFilter bo-invoiceFilter--datePresets" data-slot="invoiceFilters-invoiceFilter--datePresets">
                <span className="bo-label" data-slot="invoiceFilters-label">Periodo</span>
                <div className="bo-datePresetButtons" data-slot="invoiceFilters-datePresetButtons">
                  <button
                    type="button"
                    className={`bo-datePresetBtn ${datePreset === "today" ? "is-active" : ""}`}
                    onClick={() => handlePresetClick("today")}
                    data-testid="invoice-filter-datepreset-today-btn"
                  >
                    Hoy
                  </button>
                  <button
                    type="button"
                    className={`bo-datePresetBtn ${datePreset === "this_week" ? "is-active" : ""}`}
                    onClick={() => handlePresetClick("this_week")}
                    data-testid="invoice-filter-datepreset-this-week-btn"
                  >
                    Esta semana
                  </button>
                  <button
                    type="button"
                    className={`bo-datePresetBtn ${datePreset === "this_month" ? "is-active" : ""}`}
                    onClick={() => handlePresetClick("this_month")}
                    data-testid="invoice-filter-datepreset-this-month-btn"
                  >
                    Este mes
                  </button>
                  <button
                    type="button"
                    className={`bo-datePresetBtn ${datePreset === "last_month" ? "is-active" : ""}`}
                    onClick={() => handlePresetClick("last_month")}
                    data-testid="invoice-filter-datepreset-last-month-btn"
                  >
                    Ultimo mes
                  </button>
                  <button
                    type="button"
                    className={`bo-datePresetBtn ${datePreset === "this_year" ? "is-active" : ""}`}
                    onClick={() => handlePresetClick("this_year")}
                    data-testid="invoice-filter-datepreset-this-year-btn"
                  >
                    Este año
                  </button>
                  <button
                    type="button"
                    className={`bo-datePresetBtn ${datePreset === "custom" || showCustomDatePicker ? "is-active" : ""}`}
                    onClick={() => handlePresetClick("custom")}
                    data-testid="invoice-filter-datepreset-custom-btn"
                  >
                    Personalizado
                  </button>
                </div>
              </div>

              {/* Custom Date Range Pickers - shown when "Personalizado" is selected */}
              {(showCustomDatePicker || datePreset === "custom") && (
                <>
                  <label className="bo-field bo-invoiceFilter bo-invoiceFilter--dateFrom" data-slot="invoiceFilters-invoiceFilter--dateFrom">
                    <span className="bo-label" data-slot="invoiceFilters-label">Desde</span>
                    <DatePicker value={dateFrom || ""} onChange={handleDateFromChangeInternal} data-testid="invoice-filter-datefrom-picker" />
                  </label>

                  <label className="bo-field bo-invoiceFilter bo-invoiceFilter--dateTo" data-slot="invoiceFilters-invoiceFilter--dateTo">
                    <span className="bo-label" data-slot="invoiceFilters-label">Hasta</span>
                    <DatePicker value={dateTo || ""} onChange={handleDateToChangeInternal} data-testid="invoice-filter-dateto-picker" />
                  </label>
                </>
              )}

              <div className="bo-field bo-invoiceFilter bo-invoiceFilter--isReservation" data-slot="invoiceFilters-invoiceFilter--isReservation">
                <span className="bo-label" data-slot="invoiceFilters-label">Reserva</span>
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
                  data-testid="invoice-filter-reservation-select"
                />
              </div>

              <div className="bo-field bo-invoiceFilter bo-invoiceFilter--isCreditNote" data-slot="invoiceFilters-invoiceFilter--isCreditNote">
                <span className="bo-label" data-slot="invoiceFilters-label">Nota de credito</span>
                <Select
                  value={isCreditNote === null ? "" : isCreditNote ? "true" : "false"}
                  onChange={(value) => {
                    if (value === "") onIsCreditNoteChange(null);
                    else onIsCreditNoteChange(value === "true");
                  }}
                  options={[
                    { value: "", label: "Todos" },
                    { value: "true", label: "Solo notas de credito" },
                    { value: "false", label: "Solo facturas" },
                  ]}
                  ariaLabel="Nota de credito"
                  data-testid="invoice-filter-creditnote-select"
                />
              </div>

              {/* Due Date Filters */}
              <div className="bo-field bo-invoiceFilter bo-invoiceFilter--dueDate" data-slot="invoiceFilters-invoiceFilter--dueDate">
                <span className="bo-label" data-slot="invoiceFilters-label">Vencimiento</span>
                <Select
                  value={isOverdue === null ? "" : isOverdue ? "overdue" : "not_overdue"}
                  onChange={(value) => {
                    if (value === "") onIsOverdueChange(null);
                    else onIsOverdueChange(value === "overdue");
                  }}
                  options={[
                    { value: "", label: "Todos" },
                    { value: "overdue", label: "Vencidas" },
                    { value: "not_overdue", label: "Pendientes" },
                  ]}
                  ariaLabel="Vencimiento"
                  data-testid="invoice-filter-overdue-select"
                />
              </div>

              <label className="bo-field bo-invoiceFilter bo-invoiceFilter--dateFrom" data-slot="invoiceFilters-invoiceFilter--dateFrom">
                <span className="bo-label" data-slot="invoiceFilters-label">Desde vencimiento</span>
                <DatePicker value={dueDateFrom || ""} onChange={onDueDateFromChange} data-testid="invoice-filter-duedatefrom-picker" />
              </label>

              <label className="bo-field bo-invoiceFilter bo-invoiceFilter--dateTo" data-slot="invoiceFilters-invoiceFilter--dateTo">
                <span className="bo-label" data-slot="invoiceFilters-label">Hasta vencimiento</span>
                <DatePicker value={dueDateTo || ""} onChange={onDueDateToChange} data-testid="invoice-filter-duedateto-picker" />
              </label>
            </div>

            <div className="bo-invoiceFiltersFoot" data-slot="invoiceFilters-invoiceFiltersFoot">
              <div className="bo-invoiceFiltersSummary" data-slot="invoiceFilters-invoiceFiltersSummary">
                <span className="bo-mutedText bo-invoiceFiltersCount" data-slot="invoiceFilters-invoiceFiltersCount">{summaryText}</span>
                {dateRangeText && (
                  <span className="bo-invoiceFiltersDateRange" data-slot="invoiceFilters-invoiceFiltersDateRange">
                    <Calendar size={12}>
                    {dateRangeText}
                  </span>
                )}
              </div>
              <div className="bo-invoiceFiltersActions" data-slot="invoiceFilters-invoiceFiltersActions">
                {onImport && (
                  <button
                    className="bo-btn bo-btn--ghost bo-btn--sm"
                    type="button"
                    onClick={onImport}
                    data-testid="invoice-filters-import-btn"
                  >
                    <Upload size={15}>
                    Importar
                  </button>
                )}
                {onImportHistory && (
                  <button
                    className="bo-btn bo-btn--ghost bo-btn--sm"
                    type="button"
                    onClick={onImportHistory}
                    data-testid="invoice-filters-history-btn"
                  >
                    <History size={15}>
                    Historial
                  </button>
                )}
                <button
                  className="bo-btn bo-btn--ghost bo-btn--sm"
                  type="button"
                  onClick={onExportCSV}
                  data-testid="invoice-filters-export-btn"
                >
                  <Download size={15}>
                  Exportar CSV
                </button>
                <button
                  className={`bo-btn bo-btn--ghost bo-btn--sm bo-invoiceClearBtn ${hasFilters ? "" : "is-hidden"}`.trim()}
                  type="button"
                  disabled={!hasFilters}
                  onClick={onResetFilters}
                  tabIndex={hasFilters ? 0 : -1}
                  aria-hidden={!hasFilters}
                  data-testid="invoice-filters-clear-btn"
                >
                  <FilterX size={15}>
                  Limpiar filtros
                </button>
                <button
                  className={`bo-btn bo-btn--ghost bo-btn--sm ${hasFilters ? "" : "is-hidden"}`.trim()}
                  type="button"
                  disabled={!hasFilters}
                  onClick={() => setShowSaveDialog(true)}
                  tabIndex={hasFilters ? 0 : -1}
                  aria-hidden={!hasFilters}
                  data-testid="invoice-filters-save-btn"
                >
                  <Save size={15}>
                  Guardar filtro
                </button>
              </div>
            </div>

            {/* Save Filter Dialog */}
            <AnimatePresence>
              {showSaveDialog && (
                <motion.div
                  className="bo-filterSaveDialog"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="bo-filterSaveDialogContent" data-slot="invoiceFilters-filterSaveDialogContent">
                    <label className="bo-field" data-slot="invoiceFilters-field">
                      <span className="bo-label" data-slot="invoiceFilters-label">Nombre del filtro</span>
                      <input
                        className="bo-input"
                        type="text"
                        value={filterName}
                        onChange={(e) => setFilterName(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Ej: Facturas pendientes"
                        autoFocus
                        data-testid="invoice-filter-save-dialog-name-input"
                      />
                    </label>
                    <div className="bo-filterSaveDialogActions" data-slot="invoiceFilters-filterSaveDialogActions">
                      <button
                        className="bo-btn bo-btn--ghost bo-btn--sm"
                        type="button"
                        onClick={() => {
                          setShowSaveDialog(false);
                          setFilterName("");
                        }}
                        data-testid="invoice-filter-save-dialog-cancel-btn"
                      >
                        Cancelar
                      </button>
                      <button
                        className="bo-btn bo-btn--primary bo-btn--sm"
                        type="button"
                        onClick={handleSaveFilter}
                        disabled={!filterName.trim()}
                        data-testid="invoice-filter-save-dialog-save-btn"
                      >
                        <Save size={15}>
                        Guardar
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Saved Filters Section */}
            {savedFilters.length > 0 && (
              <div className="bo-savedFilters" data-slot="invoiceFilters-savedFilters">
                <div className="bo-savedFiltersHead" data-slot="invoiceFilters-savedFiltersHead">
                  <Bookmark size={14}>
                  <span data-slot="invoiceFilters-dos">Mis filtros guardados</span>
                </div>
                <div className="bo-savedFiltersList" data-slot="invoiceFilters-savedFiltersList">
                  {savedFilters.map((preset) => (
                    <div
                      key={preset.id}
                      className="bo-savedFilterPill"
                      data-slot="invoice-filter-saved-pill"
                      role="group"
                      aria-label={`Filtro guardado: ${preset.name}`}
                    >
                      <button
                        className="bo-savedFilterApply"
                        type="button"
                        onClick={() => handleLoadFilter(preset)}
                        title={`Aplicar: ${preset.name}`}
                        data-testid={`invoice-filter-saved-apply-${preset.id}-btn`}
                      >
                        <span className="bo-savedFilterName" data-slot="invoiceFilters-savedFilterName">{preset.name}</span>
                      </button>
                      <button
                        className="bo-savedFilterDelete"
                        type="button"
                        onClick={(e) => handleDeleteFilter(e, preset.id)}
                        title="Eliminar filtro"
                        aria-label={`Eliminar filtro ${preset.name}`}
                        data-testid={`invoice-filter-saved-delete-${preset.id}-btn`}
                      >
                        <Trash2 size={12}>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
});
