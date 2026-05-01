import React, { useMemo } from "react";
import { ExternalLink } from "lucide-react";
import { formatArrozShort, formatHHMM, formatPhone } from "../../../../../ui/lib/format";
import type { Booking } from "../../../../../api/types";

function formatAddedDate(ts: string | null | undefined): string {
  if (!ts) return "";
  const s = String(ts).trim();
  if (!s.includes(" ")) return s;
  const [d, t] = s.split(" ");
  const [y, m, dd] = d.split("-");
  const hhmm = (t || "").slice(0, 5);
  if (dd && m) return `${dd}/${m} ${hhmm}`;
  return s;
}

interface SearchResultsTableProps {
  searchResults: Booking[];
  searchPage: number;
  searchTotalPages: number;
  searchTotalCount: number;
  searchBusy: boolean;
  onSearchPageChange: (page: number) => void;
  onNavigate: (b: Booking) => void;
}

const SearchResultRow = React.memo(function SearchResultRow({
  booking,
  onNavigate,
  busy,
}: {
  booking: Booking;
  onNavigate: (b: Booking) => void;
  busy: boolean;
}) {
  const arroz = useMemo(() => formatArrozShort(booking.arroz_type, booking.arroz_servings), [booking.arroz_servings, booking.arroz_type]);
  const added = useMemo(() => formatAddedDate(booking.added_date), [booking.added_date]);

  return (
    <tr onClick={() => onNavigate(booking)} style={{ cursor: "pointer" }} data-ui="search-result-row">
      <td className="col-added" data-ui="cell-added">{added}</td>
      <td className="col-date" data-ui="cell-date">{booking.reservation_date}</td>
      <td className="col-time" data-ui="cell-time">{formatHHMM(booking.reservation_time)}</td>
      <td className="col-client" data-ui="cell-client">{booking.customer_name}</td>
      <td className="col-status" data-ui="cell-status">{booking.status === "confirmed" ? "Confirmada" : "Pendiente"}</td>
      <td className="num" data-ui="cell-pax">{booking.party_size}</td>
      <td className="col-phone" data-ui="cell-phone">{formatPhone(booking.contact_phone_country_code, booking.contact_phone)}</td>
      <td className="col-rice" data-ui="cell-rice">{arroz}</td>
      <td className="col-comment" data-ui="cell-comment">{booking.commentary || ""}</td>
      <td className="end" data-ui="cell-actions" onClick={(e) => e.stopPropagation()}>
        <button
          className="bo-btn bo-btn--ghost bo-actionBtn"
          type="button"
          onClick={() => onNavigate(booking)}
          disabled={busy}
          aria-label={`Ir al día ${booking.reservation_date}`}
          data-slot="go-to-day"
          data-ui="navigate-btn"
        >
          <ExternalLink size={16} strokeWidth={1.8} />
        </button>
      </td>
    </tr>
  );
});

export function SearchResultsTable({
  searchResults,
  searchPage,
  searchTotalPages,
  searchTotalCount,
  searchBusy,
  onSearchPageChange,
  onNavigate,
}: SearchResultsTableProps) {
  return (
    <div className="bo-tableWrap" style={{ marginTop: 14 }} data-ui="search-results-wrapper">
      <div className="bo-tableScroll" data-ui="table-scroll">
        <table className="bo-table bo-table--reservas" aria-label="Tabla de búsqueda" data-ui="search-results-table">
          <thead data-ui="table-header">
            <tr data-slot="searchResultsTable-tr">
              <th className="col-added" data-ui="th-added">Añadida</th>
              <th className="col-date" data-ui="th-date">Fecha</th>
              <th className="col-time" data-ui="th-time">Hora</th>
              <th className="col-client" data-ui="th-client">Cliente</th>
              <th className="col-status" data-ui="th-status">Estado</th>
              <th className="num" data-ui="th-pax">Pax</th>
              <th className="col-phone" data-ui="th-phone">Teléfono</th>
              <th className="col-rice" data-ui="th-rice">Arroz</th>
              <th className="col-comment" data-ui="th-comment">Comentario</th>
              <th className="end" data-ui="th-actions" />
            </tr>
          </thead>
          <tbody data-ui="table-body">
            {searchResults.map((b) => (
              <SearchResultRow key={b.id} booking={b} onNavigate={onNavigate} busy={searchBusy} />
            ))}
            {!searchResults.length ? (
              <tr data-ui="empty-row">
                <td colSpan={10} style={{ padding: 16, color: "var(--bo-muted)" }} data-ui="empty-cell">
                  {searchBusy ? "Buscando..." : "Sin resultados."}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      {searchTotalPages > 1 ? (
        <div className="bo-pager" aria-label="Paginación búsqueda" data-ui="pagination">
          <div className="bo-pagerText" data-ui="pager-text">
            Página {searchPage} de {searchTotalPages} · {searchTotalCount} resultados
          </div>
          <div className="bo-pagerBtns" data-ui="pager-buttons">
            <button
              className="bo-btn bo-btn--ghost"
              type="button"
              onClick={() => onSearchPageChange(searchPage - 1)}
              disabled={searchBusy || searchPage <= 1}
              data-ui="prev-page-btn"
            >
              Anterior
            </button>
            <button
              className="bo-btn bo-btn--ghost"
              type="button"
              onClick={() => onSearchPageChange(searchPage + 1)}
              disabled={searchBusy || searchPage >= searchTotalPages}
              data-ui="next-page-btn"
            >
              Siguiente
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
