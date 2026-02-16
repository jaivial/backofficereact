import React, { useEffect } from "react";
import { useAtomValue } from "jotai";

import { firstAllowedPath } from "../../lib/rbac";
import { sessionAtom } from "../../state/atoms";

export default function Page() {
  const session = useAtomValue(sessionAtom);

  // Keep it simple: redirect client-side for any accidental navigation to `/app`.
  useEffect(() => {
    if (!session) return;
    window.location.replace(firstAllowedPath(session.user.role, session.user.sectionAccess, session.user.roleImportance));
  }, [session]);
  return null;
}
