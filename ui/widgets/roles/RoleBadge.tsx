import React from "react";

import { roleLabel } from "../../../lib/rbac";

export function RoleBadge({
  roleSlug,
  roleName,
  importance,
  className = "",
}: {
  roleSlug: string;
  roleName?: string;
  importance?: number | null;
  className?: string;
}) {
  const label = roleName || roleLabel(roleSlug);
  const suffix = typeof importance === "number" ? ` · ${importance}` : "";
  return (
    <span className={`bo-badge bo-roleBadge ${className}`.trim()}>
      {label}
      {suffix}
    </span>
  );
}
