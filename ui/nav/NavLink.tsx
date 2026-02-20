import React, { memo } from "react";

export const NavLink = memo(function NavLink({
  href,
  active,
  label,
  children,
  className,
  onClick,
}: {
  href: string;
  active: boolean;
  label: string;
  children: React.ReactNode;
  className?: string;
  onClick?: React.MouseEventHandler<HTMLAnchorElement>;
}) {
  const classes = ["bo-navBtn", "bo-navBtn--glass", active ? "is-active" : "", className ?? ""].filter(Boolean).join(" ");

  return (
    <a className={classes} href={href} aria-label={label} onClick={onClick}>
      {children}
    </a>
  );
});
