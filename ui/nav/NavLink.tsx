import React, { useCallback, memo } from "react";
import { navigate, prefetch } from "vike/client/router";
import { cn } from "../shadcn/utils";

const prefetched = new Set<string>();

function ensurePrefetch(href: string) {
  if (prefetched.has(href)) return;
  prefetched.add(href);
  void prefetch(href, { pageContext: true }).catch(() => {
    prefetched.delete(href);
  });
}

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
  const handlePointerEnter = useCallback(() => {
    ensurePrefetch(href);
  }, [href]);

  const handleClick = useCallback<React.MouseEventHandler<HTMLAnchorElement>>(
    (e) => {
      // Let the browser handle modified clicks (new tab, etc.)
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
        return;
      }
      // Allow consumer onClick to cancel navigation via e.preventDefault()
      onClick?.(e);
      if (e.defaultPrevented) return;
      e.preventDefault();
      void navigate(href);
    },
    [href, onClick],
  );

  return (
    <a
      className={cn("bo-navBtn", "bo-navBtn--glass", active && "is-active", className)}
      href={href}
      aria-label={label}
      onClick={handleClick}
      onPointerEnter={handlePointerEnter}
      onFocus={handlePointerEnter}
      onTouchStart={handlePointerEnter}
      data-testid={`nav-link-${label.toLowerCase().replace(/\s+/g, "-")}`}
      data-ui="nav-link"
    >
      {children}
    </a>
  );
});
