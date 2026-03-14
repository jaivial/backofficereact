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
  const classes = [
    "w-11 h-11 rounded-xl border border-transparent bg-transparent flex items-center justify-center cursor-pointer transition-all duration-150 hover:bg-white/[0.03] hover:border-white/[0.09]",
    active ? "bg-primary/12 border-primary/30 text-foreground" : "text-muted hover:text-foreground",
    className ?? ""
  ].filter(Boolean).join(" ");

  return (
    <a className={classes} href={href} aria-label={label} onClick={onClick}>
      {children}
    </a>
  );
});
