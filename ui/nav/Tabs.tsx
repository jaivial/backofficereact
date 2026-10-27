import React, { useEffect, useRef } from "react";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "../shadcn/utils";
import { childTestId } from "../lib/testId";

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
  testId,
}: {
  tabs: TabItem[];
  activeId: string;
  ariaLabel: string;
  className?: string;
  onNavigate?: (href: string, id: string, ev: React.MouseEvent<HTMLAnchorElement>) => void;
  mode?: "link" | "button";
  layoutId?: string;
  /** Unique root test id: the strip, every tab and its inner parts derive theirs
   *  from it. Without it the legacy `tabs` / `tab-<id>` ids are kept. */
  testId?: string;
}) {
  const reduceMotion = useReducedMotion();
  const isButtonMode = mode === "button";
  const motionTransition = reduceMotion
    ? { duration: 0 }
    : { type: "spring" as const, stiffness: 520, damping: 42, mass: 0.9 };

  // When the strip scrolls (narrower than its tabs), keep the active tab in
  // view inside it. Only the strip scrolls; the page never moves.
  const navRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const nav = navRef.current;
    if (!nav || nav.scrollWidth <= nav.clientWidth) return;
    const el = nav.querySelector<HTMLElement>(".bo-tab.is-active");
    if (!el) return;
    const left = el.offsetLeft - nav.offsetLeft;
    if (left < nav.scrollLeft || left + el.offsetWidth > nav.scrollLeft + nav.clientWidth) {
      nav.scrollTo({ left: Math.max(0, left - (nav.clientWidth - el.offsetWidth) / 2), behavior: reduceMotion ? "auto" : "smooth" });
    }
  }, [activeId, reduceMotion]);

  // In button mode, onNavigate is optional but onChange is the alternative via onClick on role=tab.
  // We use onNavigate(id) with just id in button mode — the href param will be "#".
  return (
    <nav
      ref={navRef}
      className={cn("bo-tabs", "bo-tabs--glass", className)}
      aria-label={ariaLabel}
      data-testid={testId ?? "tabs"}
      data-role="tabs-nav"
      {...(isButtonMode ? { role: "tablist" as const } : {})}
    >
      {tabs.map((t) => {
        const active = t.id === activeId;
        // Deterministic href: server and client must render identical markup.
        // Reading `window` here diverges SSR vs hydration (e.g. appending ?date=),
        // which triggers React hydration mismatches on anchor href attributes.
        // Callers that need query params already bake them into `t.href`.
        const href = (() => {
          if (isButtonMode || !t.href || t.href === "#") return "#";
          return t.href;
        })();

        if (isButtonMode) {
          return (
            <button
              key={t.id}
              type="button"
              className={cn("bo-tab", active && "is-active")}
              role="tab"
              aria-selected={active}
              aria-label={t.label}
              data-testid={testId ? `${testId}-${t.id}` : `tab-${t.id}`}
              data-role="tab-btn"
              disabled={active}
              onClick={() => {
                if (active) return;
                onNavigate?.("#", t.id, null as any);
              }}
            >
              <span data-slot="tabs-tabIndicator" className="bo-tabIndicator" style={{ visibility: active ? 'visible' : 'hidden' as const }} data-testid={childTestId(testId, `${t.id}-indicator`)} />
              <span className="bo-tabInner" data-slot="tab-inner" data-testid={childTestId(testId, `${t.id}-inner`)}>
                {t.icon != null && (
                  <span className="bo-tabIcon" aria-hidden="true" data-slot="tab-icon" data-testid={childTestId(testId, `${t.id}-icon`)}>
                    {t.icon}
                  </span>
                )}
                <span className="bo-tabLabel hidden min-[896px]:inline" data-slot="tab-label" data-testid={childTestId(testId, `${t.id}-label`)}>{t.label}</span>
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
            aria-label={t.label}
            data-testid={testId ? `${testId}-${t.id}` : `tab-${t.id}`}
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
            <span data-slot="tabs-tabIndicator" className="bo-tabIndicator" style={{ visibility: active ? 'visible' : 'hidden' as const }} data-testid={childTestId(testId, `${t.id}-indicator`)} />
            <span className="bo-tabInner" data-slot="tab-inner" data-testid={childTestId(testId, `${t.id}-inner`)}>
              {t.icon != null && (
                <span className="bo-tabIcon" aria-hidden="true" data-slot="tab-icon" data-testid={childTestId(testId, `${t.id}-icon`)}>
                  {t.icon}
                </span>
              )}
              <span className="bo-tabLabel hidden min-[896px]:inline" data-slot="tab-label" data-testid={childTestId(testId, `${t.id}-label`)}>{t.label}</span>
            </span>
          </motion.a>
        );
      })}
    </nav>
  );
}
