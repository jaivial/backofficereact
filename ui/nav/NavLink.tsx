import React, { memo } from "react";

export const NavLink = memo(function NavLink({
  href,
  active,
  label,
  children,
}: {
  href: string;
  active: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <a className={`bo-navBtn${active ? " is-active" : ""}`} href={href} aria-label={label}>
      {children}
    </a>
  );
});

