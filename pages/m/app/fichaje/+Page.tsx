import React, { useEffect, useState, useCallback } from "react";
import { useAtomValue } from "jotai";
import { usePageContext } from "vike-react/usePageContext";
import { Clock, CheckCircle2, LogOut, Loader2 } from "lucide-react";
import { sessionAtom } from "../../../../state/atoms";
import { createClient } from "../../../../api/client";
import { useErrorToast } from "../../../../ui/feedback/useErrorToast";

type FichajeEntry = {
  id: number;
  date: string;
  entry_time: string | null;
  exit_time: string | null;
  total_hours: number | null;
};

type FichajeData = {
  entries: FichajeEntry[];
  today_entry: FichajeEntry | null;
  today_summary: { total_hours: number | null } | null;
};

function formatTime(date: Date): string {
  return date.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function formatHHMM(time: string | null): string {
  if (!time) return "--:--";
  const [h, m] = time.split(":");
  return `${h}:${m}`;
}

export default function MobileFichajePage() {
  const pageContext = usePageContext();
  const session = useAtomValue(sessionAtom);
  const data = (pageContext.data ?? { entries: [], today_entry: null, today_summary: null }) as FichajeData;

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [todayEntry, setTodayEntry] = useState(data.today_entry);
  useErrorToast(error);

  const api = React.useMemo(() => createClient({ baseUrl: "" }), []);

  // Update current time every second
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const handleClockIn = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/fichaje", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "in" }),
        credentials: "include",
      });
      const json = await res.json();
      if (json.success) {
        setTodayEntry(json.entry ?? null);
      } else {
        setError(json.message ?? "Error al fichar entrada");
      }
    } catch (e) {
      setError("Error de red");
    } finally {
      setBusy(false);
    }
  }, [api]);

  const handleClockOut = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/fichaje", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "out" }),
        credentials: "include",
      });
      const json = await res.json();
      if (json.success) {
        setTodayEntry(json.entry ?? null);
      } else {
        setError(json.message ?? "Error al fichar salida");
      }
    } catch (e) {
      setError("Error de red");
    } finally {
      setBusy(false);
    }
  }, [api]);

  const isClockedIn = !!todayEntry?.entry_time && !todayEntry?.exit_time;
  const totalHours = data.today_summary?.total_hours ?? todayEntry?.total_hours;

  if (!session) return null;

  return (
    <div className="flex flex-col gap-6 p-4 min-h-screen" data-ui="mobile-fichaje">
      {/* Header */}
      <header className="pt-2" data-ui="mobile-fichaje-header">
        <h1 className="text-xl font-bold text-[hsl(var(--foreground))]" data-ui="mobile-fichaje-title">Fichaje</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))]" data-ui="mobile-fichaje-date">
          {currentTime.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })}
        </p>
      </header>

      {/* Current time */}
      <div className="flex flex-col items-center" data-ui="mobile-fichaje-clock">
        <span
          className="text-5xl font-bold tracking-tight text-[hsl(var(--foreground))] tabular-nums"
          data-ui="mobile-fichaje-time"
          aria-live="polite"
          aria-label={`Hora actual: ${formatTime(currentTime)}`}
        >
          {formatTime(currentTime)}
        </span>
      </div>

      {/* Main action button */}
      <div className="flex flex-col items-center gap-3" data-ui="mobile-fichaje-action">
        <button
          onClick={isClockedIn ? handleClockOut : handleClockIn}
          disabled={busy}
          className={[
            "w-40 h-40 rounded-full flex flex-col items-center justify-center gap-2 text-white font-bold text-lg shadow-lg active:scale-95 transition-all disabled:opacity-60 disabled:cursor-not-allowed",
            isClockedIn
              ? "bg-red-500 hover:bg-red-600"
              : "bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/90",
          ].join(" ")}
          data-ui="mobile-fichaje-btn"
          data-role={isClockedIn ? "clock-out" : "clock-in"}
          aria-label={isClockedIn ? "Fichar salida" : "Fichar entrada"}
        >
          {busy ? (
            <Loader2 size={32} className="animate-spin" aria-hidden="true" />
          ) : isClockedIn ? (
            <LogOut size={32} strokeWidth={1.8} aria-hidden="true" />
          ) : (
            <CheckCircle2 size={32} strokeWidth={1.8} aria-hidden="true" />
          )}
          <span className="text-base font-semibold">
            {busy ? "Procesando..." : isClockedIn ? "Salir" : "Entrar"}
          </span>
        </button>
        <p className="text-sm text-[hsl(var(--muted-foreground))]" data-ui="mobile-fichaje-hint">
          {isClockedIn ? "Toca para registrar tu salida" : "Toca para registrar tu entrada"}
        </p>
      </div>

      {/* Today's summary */}
      <section className="flex flex-col gap-3" data-ui="mobile-fichaje-summary">
        <h2 className="text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider" data-ui="mobile-fichaje-summary-title">Hoy</h2>

        <div className="grid grid-cols-2 gap-3" data-ui="mobile-fichaje-summary-grid">
          <div className="flex flex-col gap-1 p-4 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]" data-ui="mobile-fichaje-entry">
            <span className="text-xs text-[hsl(var(--muted-foreground))]">Entrada</span>
            <span className="text-lg font-bold text-[hsl(var(--foreground))]" data-ui="mobile-fichaje-entry-time">{formatHHMM(todayEntry?.entry_time ?? null)}</span>
          </div>
          <div className="flex flex-col gap-1 p-4 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]" data-ui="mobile-fichaje-exit">
            <span className="text-xs text-[hsl(var(--muted-foreground))]">Salida</span>
            <span className="text-lg font-bold text-[hsl(var(--foreground))]" data-ui="mobile-fichaje-exit-time">{formatHHMM(todayEntry?.exit_time ?? null)}</span>
          </div>
        </div>

        {totalHours != null && (
          <div className="flex items-center justify-between p-4 rounded-2xl border border-[hsl(var(--primary))]/30 bg-[hsl(var(--primary))]/5" data-ui="mobile-fichaje-hours">
            <span className="text-sm text-[hsl(var(--foreground))]">Horas hoy</span>
            <span className="text-xl font-bold text-[hsl(var(--primary))]" data-ui="mobile-fichaje-hours-value">{totalHours.toFixed(1)}h</span>
          </div>
        )}
      </section>
    </div>
  );
}
