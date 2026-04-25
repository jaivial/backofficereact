import React, { useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "../shadcn/utils";

export type SimpleTabItem = {
  id: string;
  label: string;
  title?: string;
};

type LegacyTabsCtx = {
  activeId: string;
  setActiveId: (id: string) => void;
} | null;

const legacyTabsContext = React.createContext<LegacyTabsCtx>(null);

export function SimpleTabs({
  items,
  activeId,
  onChange,
  defaultValue,
  children,
  className,
  "aria-label": ariaLabel,
  panelled,
  layoutId,
}: {
  items?: SimpleTabItem[];
  activeId?: string;
  onChange?: (id: string) => void;
  defaultValue?: string;
  children?: React.ReactNode;
  className?: string;
  "aria-label"?: string;
  /** Set true when tab panels exist in the DOM. Adds aria-controls/id on tabs. */
  panelled?: boolean;
  layoutId?: string;
}) {
  const reduceMotion = useReducedMotion();
  const [mounted, setMounted] = useState(false);
  const [legacyActiveId, setLegacyActiveId] = useState(defaultValue ?? "");

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!items || !activeId || !onChange) {
    return (
      <legacyTabsContext.Provider value={{ activeId: legacyActiveId, setActiveId: setLegacyActiveId }}>
        <div className={cn("bo-tabsWrap", className)} data-testid="simple-tabs-wrapper" data-role="tabs-wrapper" data-slot="tabs-legacy-wrapper">
          {children}
        </div>
      </legacyTabsContext.Provider>
    );
  }

  const activeIndex = items.findIndex((t) => t.id === activeId);
  const effectiveLayoutId = layoutId ?? "boTabIndicator";

  return (
    <div className={cn("bo-tabs", className)} role="tablist" aria-label={ariaLabel || "Tabs"} data-testid="simple-tabs" data-role="tabs-list">
      {items.map((item) => {
        const active = item.id === activeId;
        return (
          <button
            key={item.id}
            className={cn("bo-tab", active && "is-active")}
            role="tab"
            aria-selected={active}
            data-testid={`simple-tab-${item.id}`}
            data-role="tab-button"
            {...(panelled ? { "aria-controls": `panel-${item.id}`, id: `tab-${item.id}` } : null)}
            onClick={() => onChange(item.id)}
            type="button"
            title={item.title}
          >
            {active ? (
              mounted ? (
                <motion.span
                  className="bo-tabIndicator"
                  layoutId={effectiveLayoutId}
                  transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 520, damping: 42, mass: 0.9 }}
                />
              ) : (
                <span className="bo-tabIndicator" data-slot="simpleTabs-tabIndicator" />
              )
            ) : null}
            <span className="bo-tabInner" data-slot="simpleTabs-tabInner">
              <span className="bo-tabLabel" data-slot="simpleTabs-tabLabel">{item.label}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function SimpleTabsList({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ctx = React.useContext(legacyTabsContext);
  const reduceMotion = useReducedMotion();
  const [mounted, setMounted] = useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!ctx) return <>{children}</>;

  const effectiveLayoutId = "boTabIndicator";
  const tabs = React.Children.toArray(children).flatMap((child) => {
    if (!React.isValidElement(child)) return [];
    const props = child.props as { value?: string; trigger?: string };
    if (!props.value || !props.trigger) return [];
    return [{ id: props.value, label: props.trigger }];
  });

  return (
    <div className={cn("bo-tabs", className)} role="tablist" aria-label="Tabs" data-testid="simple-tabs-list" data-role="tablist">
      {tabs.map((item) => {
        const active = item.id === ctx.activeId;
        return (
          <button
            key={item.id}
            className={cn("bo-tab", active && "is-active")}
            role="tab"
            aria-selected={active}
            aria-controls={`panel-${item.id}`}
            id={`tab-${item.id}`}
            data-testid={`simple-tab-${item.id}`}
            data-role="tab-button"
            onClick={() => ctx.setActiveId(item.id)}
            type="button"
          >
            {active ? (
              mounted ? (
                <motion.span
                  className="bo-tabIndicator"
                  layoutId={effectiveLayoutId}
                  transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 520, damping: 42, mass: 0.9 }}
                />
              ) : (
                <span className="bo-tabIndicator" data-slot="simpleTabs-tabIndicator" />
              )
            ) : null}
            <span className="bo-tabInner" data-slot="simpleTabs-tabInner">
              <span className="bo-tabLabel" data-slot="simpleTabs-tabLabel">{item.label}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function SimpleTabsContent({
  id,
  activeId,
  value,
  trigger,
  children,
}: {
  id?: string;
  activeId?: string;
  value?: string;
  trigger?: string;
  children?: React.ReactNode;
}) {
  const ctx = React.useContext(legacyTabsContext);

  if (ctx) {
    if (trigger) return null;
    const panelId = value || id || "";
    const active = panelId === ctx.activeId;
    if (!active) return null;
    return (
      <div role="tabpanel" id={`panel-${panelId}`} aria-labelledby={`tab-${panelId}`} data-testid={`simple-tab-panel-${panelId}`} data-role="tab-panel">
        {children}
      </div>
    );
  }

  const panelId = id || value || "";
  const active = panelId === activeId;
  if (!active) return null;
  return (
    <div role="tabpanel" id={`panel-${panelId}`} aria-labelledby={`tab-${panelId}`} data-testid={`simple-tab-panel-${panelId}`} data-role="tab-panel">
      {children}
    </div>
  );
}
