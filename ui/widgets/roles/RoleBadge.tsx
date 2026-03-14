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
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/16 text-primary border border-primary/30 ${className}`.trim()}>
      {label}
      {suffix}
    </span>
  );
}
