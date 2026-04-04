import { useCallback, useState } from "react";

import { createClient } from "../../../../../api/client";
import type { FichajeSchedule } from "../../../../../api/types";

export function usePreviewDate(
  initialDate: string,
  initialSchedules: FichajeSchedule[],
  initialError: string | null,
) {
  const api = createClient({ baseUrl: "" });
  const [date, setDate] = useState(initialDate);
  const [schedules, setSchedules] = useState<FichajeSchedule[]>(initialSchedules);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(initialError);

  const syncURL = useCallback((nextDate: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set("date", nextDate);
    window.history.replaceState(null, "", url.toString());
  }, []);

  const onDateChange = useCallback(
    async (nextDate: string) => {
      setDate(nextDate);
      syncURL(nextDate);
      setBusy(true);
      setError(null);
      try {
        const res = await api.horarios.list(nextDate);
        if (!res.success) {
          setError(res.message || "No se pudieron cargar horarios");
          return;
        }
        setSchedules(res.schedules);
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudieron cargar horarios");
      } finally {
        setBusy(false);
      }
    },
    [api.horarios, syncURL],
  );

  return { date, schedules, busy, error, onDateChange } as const;
}
