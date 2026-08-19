import React, { useCallback, useEffect } from "react";

import { Modal } from "../overlays/Modal";
import { ModalHeader } from "../overlays/ModalHeader";
import { RangeCalendar, rangeToISODates, useRangeCalendar } from "../inputs/RangeCalendar";

type CloseDateRangeModalProps = {
  open: boolean;
  onClose: () => void;
  /** Emits the inclusive list of ISO dates in the selected range. */
  onConfirm: (dates: string[]) => void;
  busy?: boolean;
  /** Whether the range action closes days or reopens them. */
  action?: "close" | "open";
  /** Date to anchor the initial visible month (e.g. current selected day). */
  anchorDate?: string;
};

export function CloseDateRangeModal({
  open,
  onClose,
  onConfirm,
  busy = false,
  action = "close",
  anchorDate,
}: CloseDateRangeModalProps) {
  const { draft, viewYear, viewMonth0, prevMonth, nextMonth, selectDay, resetTo } =
    useRangeCalendar({ from: anchorDate ?? "", to: "" });

  // Reset the draft each time the modal opens.
  useEffect(() => {
    if (open) resetTo({ from: "", to: "" });
  }, [open, resetTo]);

  const hasRange = Boolean(draft.from && draft.to);
  const title = action === "open" ? "Abrir rango de fechas" : "Cerrar rango de fechas";
  const confirmLabel = action === "open" ? "Abrir días" : "Cerrar días";

  const handleConfirm = useCallback(() => {
    if (!hasRange || busy) return;
    const dates = rangeToISODates(draft.from, draft.to);
    if (!dates.length) return;
    onConfirm(dates);
  }, [busy, draft.from, draft.to, hasRange, onConfirm]);

  return (
    <Modal open={open} title={title} onClose={onClose} widthPx={360} className="bo-closeRangeModal" hideClose>
      <ModalHeader title={title} onClose={onClose} />
      <div data-slot="modal-body" className="bo-modalBody bo-closeRangeModalBody" data-ui="close-date-range-body">
        <div className="bo-closeRangeCal" data-ui="close-date-range-popover" role="group" aria-label="Seleccionar rango de fechas">
          <RangeCalendar
            draft={draft}
            viewYear={viewYear}
            viewMonth0={viewMonth0}
            onPrevMonth={prevMonth}
            onNextMonth={nextMonth}
            onSelectDay={selectDay}
            uiPrefix="close-date-range"
            dragSelect
          />
        </div>
      </div>
      <div data-slot="modal-actions" className="bo-modalActions" data-ui="close-date-range-actions">
        <button type="button" className="bo-btn bo-btn--ghost" onClick={onClose} disabled={busy} data-ui="close-date-range-cancel-btn">
          Cerrar
        </button>
        <button
          type="button"
          className="bo-btn bo-btn--primary"
          onClick={handleConfirm}
          disabled={!hasRange || busy}
          data-ui="close-date-range-confirm-btn"
          data-testid="close-date-range-confirm-btn"
        >
          {busy ? "Procesando..." : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
