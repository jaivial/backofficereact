import React, { memo } from "react";
import { cn } from "../shadcn/utils";

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
  return (
    <a className={cn("bo-navBtn", "bo-navBtn--glass", active && "is-active", className)} href={href} aria-label={label} onClick={onClick} data-testid={`nav-link-${label.toLowerCase().replace(/\s+/g, "-")}`} data-ui="nav-link">
      {children}
    </a>
  );
});
