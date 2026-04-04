import { useCallback, useState } from "react";
import { createClient } from "../../../../../api/client";

import type { FichajeSchedule } from "../../../../../api/types";

type MemberScheduleResult = {
  memberId: number | null;
  dateFrom: string;
  dateTo: string;
  view: "diario" | "semanal";
  schedules: FichajeSchedule[];
  loading: boolean;
  error: string | null;
}

type UseMemberScheduleReturn = MemberScheduleResult;

const MEMBER_FILTER_VIEW_KEY = "horariosPreviewMemberFilterView";

export function useMemberSchedule(): UseMemberScheduleReturn {
  const api = createClient({ baseUrl: "" });
  const [state, setState] = useState<MemberScheduleResult>({
    memberId: null,
    dateFrom: "",
    dateTo: "",
    view: "diario",
    schedules: [],
    loading: false,
    error: null,
  });

  const setMemberId = useCallback((id: number | null) => {
    setState((prev) => ({ ...prev, memberId: id, schedules: [], error: null }));
  }, []);

  const setDateRange = useCallback((from: string, to: string) => {
    setState((prev) => ({ ...prev, dateFrom: from, dateTo: to, schedules: [], error: null }));
  }, []);

  const setViewMode = useCallback((newView: "diario" | "semanal") => {
    setState((prev) => ({ ...prev, view: newView }));
  }, []);

  const fetchSchedules = useCallback(async () => {
    if (!state.memberId || !state.dateFrom || !state.dateTo) {
      return;
    }

    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const result = await api.horarios.listByMemberRange({
        memberId: state.memberId!,
        from: state.dateFrom,
        to: state.dateTo,
      });

      if (result.success) {
        setState((prev) => ({
          ...prev,
          schedules: result.schedules || [],
          loading: false,
          error: null,
        }));
      } else {
        setState((prev) => ({
          ...prev,
          schedules: [],
          loading: false,
          error: result.message || "Error al obtener horarios",
        }));
      }
    } catch (err) {
      setState((prev) => ({
        ...prev,
        schedules: [],
        loading: false,
        error: err instanceof Error ? err.message : "Error al obtener horarios",
      }));
    }
  }, [state.memberId, state.dateFrom, state.dateTo, api.horarios]);

  return state;
}
