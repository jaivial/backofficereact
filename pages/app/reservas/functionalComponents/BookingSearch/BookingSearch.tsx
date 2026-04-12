import React, { useCallback, useEffect, useRef, useState } from "react";
import { Phone, Search, X } from "lucide-react";
import { Select } from "../../../../../ui/inputs/Select";

const COUNT_OPTIONS = [
  { value: "15", label: "15" },
  { value: "25", label: "25" },
  { value: "50", label: "50" },
  { value: "100", label: "100" },
];

export type BookingSearchParams = {
  name: string;
  phone: string;
  count: number;
};

type BookingSearchProps = {
  onSearch: (params: BookingSearchParams) => void;
  onClear: () => void;
  busy: boolean;
  reduceMotion: boolean;
};

export function BookingSearch({ onSearch, onClear, busy, reduceMotion }: BookingSearchProps) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [count, setCount] = useState(15);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hadValueRef = useRef(false);

  const trigger = useCallback(
    (nextName: string, nextPhone: string) => {
      if (busy) return;
      const trimmedName = nextName.trim();
      const trimmedPhone = nextPhone.trim();
      if (trimmedName === "" && trimmedPhone === "") {
        if (hadValueRef.current) {
          hadValueRef.current = false;
          onClear();
        }
        return;
      }
      hadValueRef.current = true;
      onSearch({ name: trimmedName, phone: trimmedPhone, count });
    },
    [busy, count, onSearch, onClear],
  );

  const debounce = useCallback(
    (nextName: string, nextPhone: string) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        trigger(nextName, nextPhone);
      }, 300);
    },
    [trigger],
  );

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const onNameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = e.target.value;
      setName(v);
      debounce(v, phone);
    },
    [phone, debounce],
  );

  const onPhoneChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = e.target.value;
      setPhone(v);
      debounce(name, v);
    },
    [name, debounce],
  );

  const onCountChange = useCallback(
    (v: string) => {
      const next = Number(v);
      setCount(next);
      if (name.trim() || phone.trim()) {
        if (timerRef.current) clearTimeout(timerRef.current);
        onSearch({ name: name.trim(), phone: phone.trim(), count: next });
      }
    },
    [name, phone, onSearch],
  );

  const onClearAll = useCallback(() => {
    setName("");
    setPhone("");
    if (timerRef.current) clearTimeout(timerRef.current);
    hadValueRef.current = false;
    onClear();
  }, [onClear]);

  const hasInput = name.trim() !== "" || phone.trim() !== "";

  return (
    <div className={`bo-bookingSearch${busy ? " is-busy" : ""}`} data-ui="booking-search">
      <div className="bo-bookingSearchFields" data-slot="bookingSearch-bookingSearchFields">
        <div className="bo-bookingSearchInput" data-slot="bookingSearch-bookingSearchInput">
          <Search className="bo-ico bo-ico--sm" aria-hidden="true" />
          <input
            className="bo-input bo-input--sm"
            value={name}
            onChange={onNameChange}
            placeholder="Buscar por nombre o email"
            aria-label="Buscar por nombre o email"
            data-slot="search-name"
          />
          {busy ? <span className="bo-bookingSearchSpinner" aria-hidden="true" /> : null}
        </div>
        <div className="bo-bookingSearchInput" data-slot="bookingSearch-bookingSearchInput">
          <Phone className="bo-ico bo-ico--sm" aria-hidden="true" />
          <input
            className="bo-input bo-input--sm"
            value={phone}
            onChange={onPhoneChange}
            placeholder="Teléfono"
            aria-label="Buscar por teléfono"
            data-slot="search-phone"
          />
        </div>
        <Select
          value={String(count)}
          onChange={onCountChange}
          options={COUNT_OPTIONS}
          size="sm"
          ariaLabel="Resultados por página"
          disabled={busy}
          className="bo-bookingSearchCount"
          style={{ width: 60, overflow: "hidden" }}
          menuMinWidthPx={60}
          listClassName="bo-bookingSearchCountList"
        />
        {hasInput ? (
          <button
            className="bo-btn bo-btn--ghost bo-btn--sm"
            type="button"
            onClick={onClearAll}
            disabled={busy}
            aria-label="Limpiar búsqueda"
            data-slot="search-clear"
          >
            <X className="bo-ico" />
          </button>
        ) : null}
      </div>
    </div>
  );
}
