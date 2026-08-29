import React, { useCallback, useMemo, useState } from "react";

import { createClient } from "../../../../../api/client";
import { APP_VERSIONS, normalizeAppVersion } from "../../../../../lib/app-version";
import { useToasts } from "../../../../../ui/feedback/useToasts";
import { Select } from "../../../../../ui/inputs/Select";

type Props = {
  boUserId: number | null | undefined;
  initialVersion: string | null | undefined;
  memberName: string;
  canChange: boolean;
  onError: (message: string | null) => void;
};

export function MemberVersionControl({ boUserId, initialVersion, memberName, canChange, onError }: Props) {
  const api = useMemo(() => createClient({ baseUrl: "" }), []);
  const { pushToast } = useToasts();
  const [appVersion, setAppVersion] = useState(() => normalizeAppVersion(initialVersion));
  const [busy, setBusy] = useState(false);

  const onChange = useCallback(
    async (nextVersion: string) => {
      if (boUserId == null) return;
      const version = normalizeAppVersion(nextVersion);
      setBusy(true);
      onError(null);
      try {
        const res = await api.roles.setUserVersion(boUserId, version);
        if (!res.success) {
          onError(res.message || "No se pudo actualizar la version");
          return;
        }
        const updatedVersion = normalizeAppVersion(res.user.appVersion);
        setAppVersion(updatedVersion);
        pushToast({
          kind: "success",
          title: "Version actualizada",
          message: `App v${updatedVersion} asignada a ${memberName || "este miembro"}.`,
        });
      } catch (err) {
        onError(err instanceof Error ? err.message : "No se pudo actualizar la version");
      } finally {
        setBusy(false);
      }
    },
    [api.roles, boUserId, memberName, onError, pushToast],
  );

  if (!canChange || boUserId == null) {
    return (
      <div className="bo-memberRoleReadonly" data-slot="@memberId-versionReadonly" data-testid="miembro-detail-version-readonly">
        <span className="bo-memberRoleReadonlyValue">{`v${appVersion}`}</span>
      </div>
    );
  }

  return (
    <Select
      value={appVersion}
      onChange={(value) => void onChange(value)}
      options={APP_VERSIONS.map((version) => ({
        value: version,
        label: `v${version}${version === "0.2" ? " (completa)" : " (basica)"}`,
      }))}
      ariaLabel="Seleccionar version de app"
      disabled={busy}
      data-testid="miembro-detail-version-select"
    />
  );
}
