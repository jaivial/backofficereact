import { useAtom } from "jotai";
import { useCallback, useMemo, useState } from "react";

import { createClient } from "../../../../api/client";
import { fichajeRealtimeAtom } from "../../../../state/atoms";
import { toActiveEntriesByMember } from "../utils";

interface UseAdminActionsOptions {
  onError: (msg: string) => void;
  onSuccess: (title: string) => void;
}

export function useAdminActions({ onError, onSuccess }: UseAdminActionsOptions) {
  const api = useMemo(() => createClient({ baseUrl: "" }), []);
  const [, setRealtime] = useAtom(fichajeRealtimeAtom);

  const [busyAdminAction, setBusyAdminAction] = useState(false);
  const [busyScheduleUpdate, setBusyScheduleUpdate] = useState(false);

  const syncRealtimeState = useCallback(async () => {
    const res = await api.fichaje.getState();
    if (!res.success) return;
    const byMember = toActiveEntriesByMember(res.state.activeEntries || []);
    if (res.state.activeEntry?.memberId) {
      byMember[res.state.activeEntry.memberId] = res.state.activeEntry;
    }
    setRealtime((prev) => ({
      ...prev,
      member: res.state.member,
      activeEntriesByMember: byMember,
      activeEntry: res.state.activeEntry ?? null,
      scheduleToday: res.state.scheduleToday,
      lastSyncAt: Date.now(),
    }));
  }, [api.fichaje, setRealtime]);

  const adminStart = useCallback(
    async (memberId: number) => {
      if (!memberId) return;
      setBusyAdminAction(true);
      try {
        const res = await api.fichaje.adminStart(memberId);
        if (!res.success) {
          onError(res.message || "No se pudo iniciar fichaje del miembro");
          return;
        }
        await syncRealtimeState();
        onSuccess("Fichaje iniciado");
      } catch (err) {
        onError(err instanceof Error ? err.message : "No se pudo iniciar fichaje del miembro");
      } finally {
        setBusyAdminAction(false);
      }
    },
    [api.fichaje, onError, onSuccess, syncRealtimeState],
  );

  const adminStop = useCallback(
    async (memberId: number) => {
      if (!memberId) return;
      setBusyAdminAction(true);
      try {
        const res = await api.fichaje.adminStop(memberId);
        if (!res.success) {
          onError(res.message || "No se pudo cerrar fichaje del miembro");
          return;
        }
        await syncRealtimeState();
        onSuccess("Fichaje finalizado");
      } catch (err) {
        onError(err instanceof Error ? err.message : "No se pudo cerrar fichaje del miembro");
      } finally {
        setBusyAdminAction(false);
      }
    },
    [api.fichaje, onError, onSuccess, syncRealtimeState],
  );

  return { adminStart, adminStop, busyAdminAction, busyScheduleUpdate, setBusyScheduleUpdate, syncRealtimeState };
}
