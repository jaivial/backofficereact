import React from "react";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "../shadcn/utils";

export type TabItem = {
  id: string;
  label: string;
  href: string;
  icon: React.ReactNode;
};

export function Tabs({
  tabs,
  activeId,
  ariaLabel,
  className,
  onNavigate,
  layoutId = "boTabIndicator",
}: {
  tabs: TabItem[];
  activeId: string;
  ariaLabel: string;
  className?: string;
  onNavigate?: (href: string, id: string, ev: React.MouseEvent<HTMLAnchorElement>) => void;
  layoutId?: string;
}) {
  const reduceMotion = useReducedMotion();

  return (
    <nav className={cn("bo-tabs", "bo-tabs--glass", className)} aria-label={ariaLabel} data-testid="tabs" data-role="tabs-nav">
      {tabs.map((t) => {
        const active = t.id === activeId;
        const href = (() => {
          const raw = t.href ?? "#";
          if (raw === "#" || raw.includes("?")) return raw;
          if (typeof window === "undefined") return raw;
          const isMenusTab = t.id === "menus" || raw.startsWith("/app/menus");
          if (isMenusTab) return raw;
          const sp = new URLSearchParams(window.location.search || "");
          const date = sp.get("date");
          return date ? `${raw}?date=${encodeURIComponent(date)}` : raw;
        })();
        const motionTransition = reduceMotion
          ? { duration: 0 }
          : { type: "spring" as const, stiffness: 520, damping: 42, mass: 0.9 };

        return (
          <motion.a
            key={t.id}
            className={cn("bo-tab", active && "is-active")}
            href={href}
            aria-current={active ? "page" : undefined}
            data-testid={`tab-${t.id}`}
            data-role="tab-link"
            transition={motionTransition}
            onClick={(ev) => {
              if (!onNavigate) return;
              if (active) return;
              if (ev.ctrlKey || ev.metaKey || ev.shiftKey || ev.altKey) return;
              ev.preventDefault();
              onNavigate(href, t.id, ev);
            }}
          >
            <span className="bo-tabIndicator" style={{ visibility: active ? 'visible' : 'hidden' as const }} />
            <span className="bo-tabInner" data-slot="tab-inner">
              {t.icon != null && (
                <span className="bo-tabIcon" aria-hidden="true" data-slot="tab-icon">
                  {t.icon}
                </span>
              )}
              <span className="bo-tabLabel hidden sm:inline" data-slot="tab-label">{t.label}</span>
            </span>
          </motion.a>
        );
      })}
    </nav>
  );
}
