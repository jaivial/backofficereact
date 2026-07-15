import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { createClient } from "../../../../../../api/client";
import type { HorariosCalendarDay, HorariosCalendarResponse } from "../../../../../../api/types";
import { Modal } from "../../../../../../ui/overlays/Modal";
import { ModalHeader } from "../../../../../../ui/overlays/ModalHeader";
import { ScheduleDayTooltip } from "../../../../../../ui/widgets/ScheduleDayTooltip";

type Props = {
  open: boolean;
  onClose: () => void;
  onSelectDate: (iso: string) => void;
  year: number;
  month: number;
  currentDate: string;
};

const WEEKDAYS = ["L", "M", "M", "J", "V", "S", "D"];

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function firstDow(year: number, month: number): number {
  const d = new Date(year, month - 1, 1);
  return (d.getDay() + 6) % 7;
}

function formatMonthLabel(year: number, month: number): string {
  const d = new Date(year, month - 1, 1);
  return d.toLocaleDateString("es-ES", { month: "long", year: "numeric" });
}

export function CalendarModal({ open, onClose, onSelectDate, year, month, currentDate }: Props) {
  const api = useMemo(() => createClient({ baseUrl: "" }), []);
  const [data, setData] = useState<HorariosCalendarResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [viewYear, setViewYear] = useState(year);
  const [viewMonth, setViewMonth] = useState(month);
  const [hoveredDay, setHoveredDay] = useState<string | null>(null);
  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number } | null>(null);
  const cellRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  const loadMonth = useCallback(async (y: number, m: number) => {
    setLoading(true);
    try {
      const res = await api.horarios.calendar({ year: y, month: m });
      if (res.success) setData(res);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [api.horarios]);

  useEffect(() => {
    if (open) loadMonth(viewYear, viewMonth);
  }, [open, viewYear, viewMonth, loadMonth]);

  const prevMonth = useCallback(() => {
    setViewMonth((m) => (m === 1 ? (setViewYear((y) => y - 1), 12) : m - 1));
  }, []);

  const nextMonth = useCallback(() => {
    setViewMonth((m) => (m === 12 ? (setViewYear((y) => y + 1), 1) : m + 1));
  }, []);

  const dayMap = useMemo(() => {
    if (!data) return new Map<string, HorariosCalendarDay>();
    const map = new Map<string, HorariosCalendarDay>();
    for (const day of data.days) map.set(day.date, day);
    return map;
  }, [data]);

  const totalMembers = data?.totalMembers ?? 0;

  const days = useMemo(() => {
    const totalDays = daysInMonth(viewYear, viewMonth);
    const startDow = firstDow(viewYear, viewMonth);
    const cells: Array<{ day: number | null; iso: string | null }> = [];

    for (let i = 0; i < startDow; i++) cells.push({ day: null, iso: null });
    for (let d = 1; d <= totalDays; d++) {
      const iso = `${viewYear}-${String(viewMonth).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      cells.push({ day: d, iso });
    }
    return cells;
  }, [viewYear, viewMonth]);

  const handleCellClick = useCallback(
    (iso: string) => {
      onSelectDate(iso);
      onClose();
    },
    [onClose, onSelectDate],
  );

  const handleCellEnter = useCallback(
    (iso: string) => {
      const btn = cellRefs.current.get(iso);
      if (!btn) return;
      setHoveredDay(iso);
      const rect = btn.getBoundingClientRect();
      setPopoverPos({ top: rect.bottom + 4, left: Math.max(8, rect.left) });
    },
    [],
  );

  const handleCellLeave = useCallback(() => {
    setHoveredDay(null);
    setPopoverPos(null);
  }, []);

  const hoveredDayData = hoveredDay ? dayMap.get(hoveredDay) : null;

  const setCellRef = useCallback((iso: string, el: HTMLButtonElement | null) => {
    if (el) cellRefs.current.set(iso, el);
    else cellRefs.current.delete(iso);
  }, []);

  const popoverContent = hoveredDayData && popoverPos ? (
    <ScheduleDayTooltip
      dayData={hoveredDayData}
      className="fixed z-[10000]"
      style={{ top: popoverPos.top, left: popoverPos.left }}
    />
  ) : null;

  return (
    <Modal open={open} title="Calendario de horarios" onClose={onClose} size="md" data-slot="calendar-modal">
      <ModalHeader title="Calendario de horarios" onClose={onClose} />

      <div className="px-4 pb-4">
        {/* Month navigation */}
        <div className="flex items-center justify-between mb-4">
          <button
            type="button"
            onClick={prevMonth}
            className="bo-actionBtn bo-actionBtn--glass"
            aria-label="Mes anterior"
            data-testid="calendar-prev-month"
          >
            <ChevronLeft size={18} strokeWidth={1.8} />
          </button>
          <div className="text-sm font-semibold" data-testid="calendar-month-label">
            {formatMonthLabel(viewYear, viewMonth)}
          </div>
          <button
            type="button"
            onClick={nextMonth}
            className="bo-actionBtn bo-actionBtn--glass"
            aria-label="Mes siguiente"
            data-testid="calendar-next-month"
          >
            <ChevronRight size={18} strokeWidth={1.8} />
          </button>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-8" data-testid="calendar-loading">
            <div className="bo-spinner" />
          </div>
        )}

        {/* Calendar grid */}
        {!loading && (
          <div>
            <div className="grid grid-cols-7 mb-1">
              {WEEKDAYS.map((wd, idx) => (
                <div
                  key={`wd-${idx}`}
                  className="text-center text-xs font-semibold text-[var(--bo-muted)] py-1"
                  data-testid="calendar-weekday"
                >
                  {wd}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-[2px]">
              {days.map((cell, idx) => {
                if (!cell.day || !cell.iso) {
                  return <div key={`empty-${idx}`} className="h-[62px]" />;
                }

                const dayInfo = dayMap.get(cell.iso);
                const count = dayInfo?.workers.length ?? 0;
                const isSelected = cell.iso === currentDate;
                const isHovered = cell.iso === hoveredDay;

                return (
                  <button
                    key={cell.iso}
                    ref={(el) => setCellRef(cell.iso!, el)}
                    type="button"
                    data-testid="calendar-day-cell"
                    data-date={cell.iso}
                    data-selected={isSelected ? "true" : "false"}
                    onClick={() => handleCellClick(cell.iso!)}
                    onMouseEnter={() => handleCellEnter(cell.iso!)}
                    onMouseLeave={handleCellLeave}
                    className={`h-[62px] flex flex-col items-center justify-center rounded-xl cursor-pointer transition-colors duration-150 border bg-transparent ${
                      isSelected
                        ? "border-[var(--bo-accent)] text-[var(--bo-accent)]"
                        : "border-transparent text-[var(--bo-text)] hover:border-[var(--bo-border-2)]"
                    }`}
                  >
                    <span className="text-sm font-semibold leading-tight">{cell.day}</span>
                    <span className="text-[10px] leading-tight mt-0.5 opacity-60">
                      {count}/{totalMembers}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Popover rendered via portal to body to avoid clipping by modal overflow */}
      {typeof document !== "undefined" && popoverContent
        ? createPortal(popoverContent, document.body)
        : null}
    </Modal>
  );
}
