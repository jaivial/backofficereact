import { useCallback, useState } from "react";
import { useSetAtom } from "jotai";

import { createClient } from "../../api/client";
import { sessionAtom } from "../../state/atoms";
import { useToasts } from "../feedback/useToasts";

type Api = ReturnType<typeof createClient>;

/**
 * Boolean UI preference persisted per user + active restaurant via
 * `PUT /api/admin/me/preferences` (stored as "1"/"0").
 *
 * The initial value comes from SSR (`pageContext.bo.session.preferences`), so the
 * first paint already matches the stored state. Writes are optimistic and
 * fire-and-forget: the session atom is patched immediately and a toast reports
 * failures without reverting the UI.
 */
export function useBooleanPreference(api: Api, key: string, initial: boolean): [boolean, (next: boolean) => void] {
  const setSession = useSetAtom(sessionAtom);
  const { pushToast } = useToasts();
  const [value, setValue] = useState(initial);

  const update = useCallback(
    (next: boolean) => {
      setValue(next);
      const raw = next ? "1" : "0";
      setSession((prev) => (prev ? { ...prev, preferences: { ...(prev.preferences ?? {}), [key]: raw } } : prev));
      void api.auth.setPreference(key, raw).then((res) => {
        if (!res.success) {
          pushToast({ kind: "error", title: "Preferencia", message: res.message || "No se pudo guardar" });
        }
      });
    },
    [api.auth, key, pushToast, setSession],
  );

  return [value, update];
}
