import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";

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
}: {
  tabs: TabItem[];
  activeId: string;
  ariaLabel: string;
  className?: string;
  onNavigate?: (href: string, id: string, ev: React.MouseEvent<HTMLAnchorElement>) => void;
}) {
  const reduceMotion = useReducedMotion();
  const [mounted, setMounted] = useState(false);
  const navRef = useRef<HTMLElement | null>(null);
  const initialUrlRef = useRef<string | null>(null);
  const mountLoggedRef = useRef(false);

  // Avoid layout animation quirks during SSR/hydration (especially visible on first load).
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const envDev = import.meta.env.DEV;
    const forceDebug = (() => {
      const sp = new URLSearchParams(window.location.search || "");
      if (sp.get("debugTabs") === "1") return true;
      try {
        return window.localStorage.getItem("bo_debug_tabs") === "1";
      } catch {
        return false;
      }
    })();
    if (!envDev && !forceDebug) return;

    if (!mountLoggedRef.current) {
      mountLoggedRef.current = true;
      console.log("[bo-tabs] mounted", {
        url: window.location.href,
        activeId,
        reduceMotion,
        tabs: tabs.map((t) => ({ id: t.id, href: t.href })),
        env: {
          mode: import.meta.env.MODE,
          dev: import.meta.env.DEV,
          prod: import.meta.env.PROD,
        },
      });
    }

    if (!initialUrlRef.current) initialUrlRef.current = window.location.href;

    const sp = new URLSearchParams(window.location.search || "");
    const date = sp.get("date");
    const nav = navRef.current;

    const explicitDebug = (() => {
      if (sp.get("debugTabs") === "1") return true;
      try {
        return window.localStorage.getItem("bo_debug_tabs") === "1";
      } catch {
        return false;
      }
    })();
    const missingDate = !(date && /^\d{4}-\d{2}-\d{2}$/.test(date));

    const looksBroken = (() => {
      if (!nav) return false;
      const cs = window.getComputedStyle(nav);
      if (cs.display !== "flex") return true;
      // If CSS didn't load, padding/gap will often collapse to 0.
      if (cs.padding === "0px" || cs.gap === "0px") return true;
      if (nav.getBoundingClientRect().height < 44) return true;

      const activeEl = nav.querySelector<HTMLElement>("a.bo-tab.is-active");
      if (activeEl) {
        const r = activeEl.getBoundingClientRect();
        if (r.height < 40) return true;
        const acs = window.getComputedStyle(activeEl);
        if (acs.display !== "flex") return true;
        if (acs.position !== "relative") return true;
        if (parseFloat(acs.paddingTop || "0") < 6) return true;
      }

      const indicatorEl = nav.querySelector<HTMLElement>("a.bo-tab.is-active .bo-tabIndicator");
      if (!indicatorEl) return true;
      const ics = window.getComputedStyle(indicatorEl);
      if (ics.position !== "absolute") return true;
      return false;
    })();

    if (!explicitDebug && !missingDate && !looksBroken) return;

    console.log("[bo-tabs] render", {
      initialUrl: initialUrlRef.current,
      url: window.location.href,
      date,
      activeId,
      mounted,
      reduceMotion,
      tabs: tabs.map((t) => ({ id: t.id, label: t.label, href: t.href })),
    });

    if (nav) {
      const cs = window.getComputedStyle(nav);
      console.log("[bo-tabs] nav css", {
        display: cs.display,
        gap: cs.gap,
        padding: cs.padding,
        background: cs.backgroundImage !== "none" ? cs.backgroundImage : cs.backgroundColor,
        border: cs.border,
        borderRadius: cs.borderRadius,
        width: cs.width,
        height: cs.height,
        overflowX: cs.overflowX,
      });
    }

    const activeEl = nav?.querySelector<HTMLElement>("a.bo-tab.is-active");
    if (activeEl) {
      const cs = window.getComputedStyle(activeEl);
      console.log("[bo-tabs] active css", {
        display: cs.display,
        minHeight: cs.minHeight,
        padding: cs.padding,
        color: cs.color,
        border: cs.border,
        borderRadius: cs.borderRadius,
        position: cs.position,
      });
    }

    const indicatorEl = nav?.querySelector<HTMLElement>("a.bo-tab.is-active .bo-tabIndicator");
    if (indicatorEl) {
      const cs = window.getComputedStyle(indicatorEl);
      console.log("[bo-tabs] indicator css", {
        display: cs.display,
        background: cs.backgroundImage !== "none" ? cs.backgroundImage : cs.backgroundColor,
        border: cs.border,
        borderRadius: cs.borderRadius,
        position: cs.position,
        inset: `${cs.top} ${cs.right} ${cs.bottom} ${cs.left}`,
        opacity: cs.opacity,
      });
    } else {
      console.log("[bo-tabs] indicator missing");
    }

    const links = Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')).map((l) => l.href);
    console.log("[bo-tabs] stylesheets", { count: document.styleSheets.length, links });
  }, [activeId, mounted, reduceMotion, tabs]);

  return (
    <nav ref={navRef} className={["bo-tabs", "bo-tabs--glass", className].filter(Boolean).join(" ")} aria-label={ariaLabel}>
      {tabs.map((t) => {
        const active = t.id === activeId;
        const href = (() => {
          if (t.href.includes("?")) return t.href;
          if (typeof window === "undefined") return t.href;
          const isMenusTab = t.id === "menus" || t.href.startsWith("/app/menus");
          if (isMenusTab) return t.href;
          const sp = new URLSearchParams(window.location.search || "");
          const date = sp.get("date");
          return date ? `${t.href}?date=${encodeURIComponent(date)}` : t.href;
        })();
        return (
          <a
            key={t.id}
            className={`bo-tab${active ? " is-active" : ""}`}
            href={href}
            aria-current={active ? "page" : undefined}
            onClick={(ev) => {
              if (!onNavigate) return;
              if (active) return;
              if (ev.ctrlKey || ev.metaKey || ev.shiftKey || ev.altKey) return;
              ev.preventDefault();
              onNavigate(href, t.id, ev);
            }}
          >
            {active ? (
              mounted ? (
                <motion.span
                  className="bo-tabIndicator"
                  layoutId="boTabIndicator"
                  transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 520, damping: 42, mass: 0.9 }}
                />
              ) : (
                <span className="bo-tabIndicator" />
              )
            ) : null}
            <span className="bo-tabInner">
              <span className="bo-tabIcon" aria-hidden="true">
                {t.icon}
              </span>
              <span className="bo-tabLabel">{t.label}</span>
            </span>
          </a>
        );
      })}
    </nav>
  );
}
