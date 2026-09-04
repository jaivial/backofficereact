import React from "react";
import { Download, Filter } from "lucide-react";
import { Select } from "../../../../../ui/inputs/Select";

interface ReservationFiltersProps {
  status: string;
  sort: string;
  dir: string;
  count: number;
  q: string;
  busy: boolean;
  pdfBusy: boolean;
  filtersOpen: boolean;
  onStatusChange: (v: string) => void;
  onSortChange: (v: string) => void;
  onDirChange: (v: string) => void;
  onCountChange: (v: string) => void;
  onQChange: (v: string) => void;
  onApplyFilters: () => void;
  onToggleFilters: () => void;
  onDownloadPDF: () => void;
}

const statusOptions = [
  { value: "", label: "Todas" },
  { value: "pending", label: "Pendiente" },
  { value: "confirmed", label: "Confirmada" },
];

const sortOptions = [
  { value: "reservation_time", label: "Hora reserva" },
  { value: "added_date", label: "Añadida" },
];

const dirOptions = [
  { value: "asc", label: "Ascendente" },
  { value: "desc", label: "Descendente" },
];

const pageSizeOptions = [
  { value: "15", label: "15" },
  { value: "20", label: "20" },
  { value: "25", label: "25" },
];

export function ReservationFilters({
  status,
  sort,
  dir,
  count,
  q,
  busy,
  pdfBusy,
  filtersOpen,
  onStatusChange,
  onSortChange,
  onDirChange,
  onCountChange,
  onQChange,
  onApplyFilters,
  onToggleFilters,
  onDownloadPDF,
}: ReservationFiltersProps) {
  return (
    <div className={`bo-filters${filtersOpen ? " is-open" : ""}`} aria-label="Filtros reservas" data-ui="reservation-filters">
      <div className="bo-filtersTop" data-ui="filters-top">
        <button
          className="bo-btn bo-btn--ghost bo-filtersToggle"
          type="button"
          onClick={onToggleFilters}
          aria-expanded={filtersOpen}
          aria-controls="bo-reservas-filters-body"
          data-ui="toggle-filters-btn"
        >
          <Filter className="bo-ico" />
          Filtros
        </button>
        <button
          className="bo-btn bo-btn--primary bo-btn--download bo-btn--downloadTop"
          type="button"
          onClick={onDownloadPDF}
          disabled={pdfBusy || busy}
          data-ui="download-pdf-btn"
        >
          <Download className="bo-ico" /> Descargar
        </button>
      </div>
      <div id="bo-reservas-filters-body" className="bo-filtersBody" data-ui="filters-body">
        <div className="bo-filterRow bo-filterRow--selects" data-ui="filter-selects">
          <Select value={status} onChange={onStatusChange} options={statusOptions} size="sm" ariaLabel="Estado" data-ui="status-select" />
          <Select value={sort} onChange={onSortChange} options={sortOptions} size="sm" ariaLabel="Ordenar" data-ui="sort-select" />
          <Select value={dir} onChange={onDirChange} options={dirOptions} size="sm" ariaLabel="Dirección" data-ui="dir-select" />
          <label className="bo-filterRow--count" data-ui="count-label">
            <span data-slot="reservationFilters-filterRow-countLabel" className="bo-filterRow--countLabel">Resultados por página:</span>
            <Select
              value={String(count)}
              onChange={onCountChange}
              options={pageSizeOptions}
              size="sm"
              ariaLabel="Tamaño página"
              className="bo-reservasCountSelect"
              style={{ width: 60 }}
              menuMinWidthPx={60}
              listClassName="bo-bookingSearchCountList"
              data-ui="count-select"
            />
          </label>
        </div>
        <div className="bo-filterRow bo-filterRow--actions" data-ui="filter-actions">
          <div className="bo-search" data-ui="search-box">
            <input
              className="bo-input bo-input--sm"
              value={q}
              onChange={(e) => onQChange(e.target.value)}
              placeholder="Buscar por nombre"
              onKeyDown={(e) => {
                if (e.key === "Enter") onApplyFilters();
              }}
              data-ui="search-input"
            />
            <button
              className="bo-btn bo-btn--ghost"
              type="button"
              onClick={onApplyFilters}
              disabled={busy}
              data-ui="search-btn"
            >
              Buscar
            </button>
          </div>
          <button
            className="bo-btn bo-btn--primary bo-btn--download bo-btn--downloadInline"
            type="button"
            onClick={onDownloadPDF}
            disabled={pdfBusy || busy}
            data-ui="download-pdf-inline"
          >
            <Download className="bo-ico" /> Descargar
          </button>
        </div>
      </div>
    </div>
  );
}
