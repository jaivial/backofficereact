import { useAtom } from "jotai";
import { useCallback, useMemo, useState } from "react";

import { createClient } from "../../../../api/client";
import type { FichajeActiveEntry, FichajeMemberRef, FichajeSchedule } from "../../../../api/types";
import type { FichajeRealtimeState } from "../../../../state/atoms";
import { fichajeRealtimeAtom } from "../../../../state/atoms";
import { toActiveEntriesByMember } from "../utils";

interface UseFichajeActionsOptions {
  onError: (msg: string) => void;
  onSuccess: (title: string) => void;
}

function mergeState(
  prev: FichajeRealtimeState,
  res: { state: { member: FichajeMemberRef | null; activeEntries?: FichajeActiveEntry[]; activeEntry?: FichajeActiveEntry | null; scheduleToday?: FichajeSchedule | null } },
) {
  const byMember = toActiveEntriesByMember(res.state.activeEntries);
  if (res.state.activeEntry?.memberId) {
    byMember[res.state.activeEntry.memberId] = res.state.activeEntry;
  }
  return {
    ...prev,
    member: res.state.member,
    activeEntriesByMember: byMember,
    activeEntry: res.state.activeEntry ?? null,
    scheduleToday: res.state.scheduleToday ?? null,
    lastSyncAt: Date.now(),
  };
}

export function useFichajeActions({ onError, onSuccess }: UseFichajeActionsOptions) {
  const api = useMemo(() => createClient({ baseUrl: "" }), []);
  const [, setRealtime] = useAtom(fichajeRealtimeAtom);

  const [busyStart, setBusyStart] = useState(false);
  const [busyStop, setBusyStop] = useState(false);

  const startFichaje = useCallback(
    async (dni: string, password: string) => {
      setBusyStart(true);
      try {
        const res = await api.fichaje.start({ dni, password });
        if (!res.success) {
          onError(res.message || "No se pudo iniciar el fichaje");
          return;
        }
        setRealtime((prev) => mergeState(prev, res));
        onSuccess("Fichaje iniciado");
      } catch (err) {
        onError(err instanceof Error ? err.message : "No se pudo iniciar el fichaje");
      } finally {
        setBusyStart(false);
      }
    },
    [api.fichaje, onError, onSuccess, setRealtime],
  );

  const stopFichaje = useCallback(async () => {
    setBusyStop(true);
    try {
      const res = await api.fichaje.stop();
      if (!res.success) {
        onError(res.message || "No se pudo cerrar el fichaje");
        return;
      }
      setRealtime((prev) => mergeState(prev, res));
      onSuccess("Fichaje finalizado");
    } catch (err) {
      onError(err instanceof Error ? err.message : "No se pudo cerrar el fichaje");
    } finally {
      setBusyStop(false);
    }
  }, [api.fichaje, onError, onSuccess, setRealtime]);

  return { startFichaje, stopFichaje, busyStart, busyStop };
}
