import React, { useCallback, useEffect, useState } from "react";
import { Search, X, Calendar, Users, Clock } from "lucide-react";
import { Modal } from "../../../../ui/overlays/Modal";
import { DatePicker } from "../../../../ui/inputs/DatePicker";
import { Select } from "../../../../ui/inputs/Select";
import type { ReservationSearchResult } from "../../../../api/types";

type FillFromReservationModalProps = {
  onClose: () => void;
  onSelect: (reservation: ReservationSearchResult) => void;
  searchReservations: (params: {
    date_from?: string;
    date_to?: string;
    name?: string;
    phone?: string;
    party_size?: number;
    time?: string;
  }) => Promise<ReservationSearchResult[]>;
};

const PARTY_SIZE_OPTIONS = [
  { value: "", label: "Cualquiera" },
  { value: "1", label: "1 persona" },
  { value: "2", label: "2 personas" },
  { value: "3", label: "3 personas" },
  { value: "4", label: "4 personas" },
  { value: "5", label: "5 personas" },
  { value: "6", label: "6 personas" },
  { value: "7", label: "7 personas" },
  { value: "8", label: "8+ personas" },
];

const TIME_OPTIONS = [
  { value: "", label: "Cualquiera" },
  { value: "13:00:00", label: "13:00" },
  { value: "13:30:00", label: "13:30" },
  { value: "14:00:00", label: "14:00" },
  { value: "14:30:00", label: "14:30" },
  { value: "15:00:00", label: "15:00" },
  { value: "20:00:00", label: "20:00" },
  { value: "20:30:00", label: "20:30" },
  { value: "21:00:00", label: "21:00" },
  { value: "21:30:00", label: "21:30" },
  { value: "22:00:00", label: "22:00" },
];

export function FillFromReservationModal({ onClose, onSelect, searchReservations }: FillFromReservationModalProps) {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [partySize, setPartySize] = useState("");
  const [time, setTime] = useState("");
  const [results, setResults] = useState<ReservationSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!dateFrom && !name && !phone && !partySize && !time) {
        setResults([]);
        setSearched(false);
        return;
      }

      setLoading(true);
      setSearched(true);

      try {
        const reservations = await searchReservations({
          date_from: dateFrom || undefined,
          date_to: dateTo || undefined,
          name: name || undefined,
          phone: phone || undefined,
          party_size: partySize ? parseInt(partySize) : undefined,
          time: time || undefined,
        });
        setResults(reservations);
      } catch (err) {
        console.error("Error searching reservations:", err);
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [dateFrom, dateTo, name, phone, partySize, time, searchReservations]);

  const handleSelect = useCallback(
    (reservation: ReservationSearchResult) => {
      onSelect(reservation);
    },
    [onSelect],
  );

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" });
  };

  const formatTime = (timeStr: string) => {
    return timeStr.substring(0, 5);
  };

  return (
    <Modal open={true} title="Buscar reserva" onClose={onClose} widthPx={640}>
      <div className="bo-reservationModalContent">
        <div className="bo-reservationFilters">
            <div className="bo-reservationFiltersRow">
              <label className="bo-field">
                <span className="bo-label">
                  <Calendar size={14} />
                  Desde
                </span>
                <DatePicker value={dateFrom} onChange={setDateFrom} />
              </label>

              <label className="bo-field">
                <span className="bo-label">
                  <Calendar size={14} />
                  Hasta
                </span>
                <DatePicker value={dateTo} onChange={setDateTo} />
              </label>
            </div>

            <div className="bo-reservationFiltersRow">
              <label className="bo-field">
                <span className="bo-label">
                  <Search size={14} />
                  Nombre
                </span>
                <input
                  className="bo-input"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Buscar por nombre..."
                />
              </label>

              <label className="bo-field">
                <span className="bo-label">
                  <Search size={14} />
                  Teléfono
                </span>
                <input
                  className="bo-input"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Buscar por teléfono..."
                />
              </label>
            </div>

            <div className="bo-reservationFiltersRow">
              <label className="bo-field">
                <span className="bo-label">
                  <Users size={14} />
                  Personas
                </span>
                <Select
                  value={partySize}
                  onChange={setPartySize}
                  options={PARTY_SIZE_OPTIONS}
                  ariaLabel="Número de personas"
                />
              </label>

              <label className="bo-field">
                <span className="bo-label">
                  <Clock size={14} />
                  Hora
                </span>
                <Select
                  value={time}
                  onChange={setTime}
                  options={TIME_OPTIONS}
                  ariaLabel="Hora de reserva"
                />
              </label>
            </div>
          </div>

          <div className="bo-reservationResults">
            {loading ? (
              <div className="bo-reservationLoading">
                <div className="bo-spinner" />
                <span>Buscando reservas...</span>
              </div>
            ) : searched && results.length === 0 ? (
              <div className="bo-reservationEmpty">
                <span>No se encontraron reservas con esos criterios.</span>
              </div>
            ) : results.length > 0 ? (
              <div className="bo-reservationList">
                {results.map((reservation) => (
                  <button
                    key={reservation.id}
                    type="button"
                    className="bo-reservationItem"
                    onClick={() => handleSelect(reservation)}
                  >
                    <div className="bo-reservationItemMain">
                      <span className="bo-reservationItemName">{reservation.customer_name}</span>
                      <span className="bo-reservationItemEmail">{reservation.contact_email}</span>
                    </div>
                    <div className="bo-reservationItemMeta">
                      <span className="bo-reservationItemDate">
                        <Calendar size={12} />
                        {formatDate(reservation.reservation_date)}
                      </span>
                      <span className="bo-reservationItemTime">
                        <Clock size={12} />
                        {formatTime(reservation.reservation_time)}
                      </span>
                      <span className="bo-reservationItemSize">
                        <Users size={12} />
                        {reservation.party_size}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="bo-reservationEmpty">
                <span>Introduce criterios de búsqueda para encontrar reservas.</span>
              </div>
            )}
          </div>
        </div>
    </Modal>
  );
}
