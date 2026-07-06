import React from "react";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "../shadcn/utils";

export type TabItem = {
  id: string;
  label: string;
  href: string;
  icon?: React.ReactNode;
};

export function Tabs({
  tabs,
  activeId,
  ariaLabel,
  className,
  onNavigate,
  mode = "link",
  layoutId = "boTabIndicator",
}: {
  tabs: TabItem[];
  activeId: string;
  ariaLabel: string;
  className?: string;
  onNavigate?: (href: string, id: string, ev: React.MouseEvent<HTMLAnchorElement>) => void;
  mode?: "link" | "button";
  layoutId?: string;
}) {
  const reduceMotion = useReducedMotion();
  const isButtonMode = mode === "button";
  const motionTransition = reduceMotion
    ? { duration: 0 }
    : { type: "spring" as const, stiffness: 520, damping: 42, mass: 0.9 };

  // In button mode, onNavigate is optional but onChange is the alternative via onClick on role=tab.
  // We use onNavigate(id) with just id in button mode — the href param will be "#".
  return (
    <nav
      className={cn("bo-tabs", "bo-tabs--glass", className)}
      aria-label={ariaLabel}
      data-testid="tabs"
      data-role="tabs-nav"
      {...(isButtonMode ? { role: "tablist" as const } : {})}
    >
      {tabs.map((t) => {
        const active = t.id === activeId;
        const href = (() => {
          if (isButtonMode || !t.href || t.href === "#") return "#";
          if (t.href.includes("?")) return t.href;
          if (typeof window === "undefined") return t.href;
          const isMenusTab = t.id === "menus" || t.href.startsWith("/app/menus");
          if (isMenusTab) return t.href;
          const sp = new URLSearchParams(window.location.search || "");
          const date = sp.get("date");
          return date ? `${t.href}?date=${encodeURIComponent(date)}` : t.href;
        })();

        if (isButtonMode) {
          return (
            <button
              key={t.id}
              type="button"
              className={cn("bo-tab", active && "is-active")}
              role="tab"
              aria-selected={active}
              data-testid={`tab-${t.id}`}
              data-role="tab-btn"
              disabled={active}
              onClick={() => {
                if (active) return;
                onNavigate?.("#", t.id, null as any);
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
            </button>
          );
        }

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
