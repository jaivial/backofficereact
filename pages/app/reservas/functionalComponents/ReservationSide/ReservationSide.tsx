import React from "react";
import { motion, type Transition } from "motion/react";
import { ReservationFilters } from "../ReservationFilters/ReservationFilters";
import { DonutOccupancy } from "../../../../../ui/widgets/DonutOccupancy";

interface DashboardMetrics {
  total: number;
  pending: number;
  confirmed: number;
}

interface ConfigDailyLimit {
  totalPeople: number;
  limit: number;
}

interface ReservationSideProps {
  isDayOpen: boolean;
  metrics: DashboardMetrics | null;
  dailyLimit: ConfigDailyLimit | null;
  status: string;
  sort: string;
  dir: string;
  count: number;
  q: string;
  busy: boolean;
  pdfBusy: boolean;
  filtersOpen: boolean;
  reduceMotion: boolean;
  dayVisibilityTransition: Transition;
  onStatusChange: (v: string) => void;
  onSortChange: (v: string) => void;
  onDirChange: (v: string) => void;
  onCountChange: (v: string) => void;
  onQChange: (v: string) => void;
  onApplyFilters: () => void;
  onToggleFilters: () => void;
  onDownloadPDF: () => void;
}

export function ReservationSide({
  isDayOpen,
  metrics,
  dailyLimit,
  status,
  sort,
  dir,
  count,
  q,
  busy,
  pdfBusy,
  filtersOpen,
  reduceMotion,
  dayVisibilityTransition,
  onStatusChange,
  onSortChange,
  onDirChange,
  onCountChange,
  onQChange,
  onApplyFilters,
  onToggleFilters,
  onDownloadPDF,
}: ReservationSideProps) {
  const occPeople = dailyLimit?.totalPeople ?? 0;
  const occLimit = dailyLimit?.limit ?? 45;

  return (
    <motion.div
      key="reservas-side"
      className="bo-reservasSide"
      initial={reduceMotion ? { opacity: 1 } : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={reduceMotion ? { opacity: 1 } : { opacity: 0 }}
      transition={dayVisibilityTransition}
      data-ui="reservation-side"
    >
      <DonutOccupancy
        totalPeople={occPeople}
        limit={occLimit}
        totalBookings={metrics?.total}
        pending={metrics?.pending}
        confirmed={metrics?.confirmed}
      />

      <ReservationFilters
        status={status}
        sort={sort}
        dir={dir}
        count={count}
        q={q}
        busy={busy}
        pdfBusy={pdfBusy}
        filtersOpen={filtersOpen}
        onStatusChange={onStatusChange}
        onSortChange={onSortChange}
        onDirChange={onDirChange}
        onCountChange={onCountChange}
        onQChange={onQChange}
        onApplyFilters={onApplyFilters}
        onToggleFilters={onToggleFilters}
        onDownloadPDF={onDownloadPDF}
      />
    </motion.div>
  );
}
