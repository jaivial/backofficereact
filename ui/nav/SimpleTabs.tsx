import React, { useState } from "react";
import { motion, useReducedMotion } from "motion/react";

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
}: {
  items?: SimpleTabItem[];
  activeId?: string;
  onChange?: (id: string) => void;
  defaultValue?: string;
  children?: React.ReactNode;
  className?: string;
  "aria-label"?: string;
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
        <div className={className}>{children}</div>
      </legacyTabsContext.Provider>
    );
  }

  const activeIndex = items.findIndex((t) => t.id === activeId);

  return (
    <div className={["flex gap-1 p-1 rounded-lg bg-white/[0.02] border border-white/[0.06]", className].filter(Boolean).join(" ")} role="tablist" aria-label={ariaLabel || "Tabs"}>
      {items.map((item) => {
        const active = item.id === activeId;
        return (
          <button
            key={item.id}
            className={`relative h-9 px-4 rounded-md text-sm font-medium text-muted transition-colors duration-150 hover:text-foreground ${active ? "text-foreground" : ""}`}
            role="tab"
            aria-selected={active}
            aria-controls={`panel-${item.id}`}
            id={`tab-${item.id}`}
            onClick={() => onChange(item.id)}
            type="button"
            title={item.title}
          >
            {active ? (
              mounted ? (
                <motion.span
                  className="absolute inset-0 bg-white/[0.04] rounded-md border border-white/[0.08]"
                  layoutId="boTabIndicator"
                  transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 520, damping: 42, mass: 0.9 }}
                />
              ) : (
                <span className="absolute inset-0 bg-white/[0.04] rounded-md border border-white/[0.08]" />
              )
            ) : null}
            <span className="relative flex items-center">
              <span className="relative">{item.label}</span>
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

  const tabs = React.Children.toArray(children).flatMap((child) => {
    if (!React.isValidElement(child)) return [];
    const props = child.props as { value?: string; trigger?: string };
    if (!props.value || !props.trigger) return [];
    return [{ id: props.value, label: props.trigger }];
  });

  return (
    <div className={["flex gap-1 p-1 rounded-lg bg-white/[0.02] border border-white/[0.06]", className].filter(Boolean).join(" ")} role="tablist" aria-label="Tabs">
      {tabs.map((item) => {
        const active = item.id === ctx.activeId;
        return (
          <button
            key={item.id}
            className={`relative h-9 px-4 rounded-md text-sm font-medium text-muted transition-colors duration-150 hover:text-foreground ${active ? "text-foreground" : ""}`}
            role="tab"
            aria-selected={active}
            aria-controls={`panel-${item.id}`}
            id={`tab-${item.id}`}
            onClick={() => ctx.setActiveId(item.id)}
            type="button"
          >
            {active ? (
              mounted ? (
                <motion.span
                  className="absolute inset-0 bg-white/[0.04] rounded-md border border-white/[0.08]"
                  layoutId="boTabIndicator"
                  transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 520, damping: 42, mass: 0.9 }}
                />
              ) : (
                <span className="absolute inset-0 bg-white/[0.04] rounded-md border border-white/[0.08]" />
              )
            ) : null}
            <span className="relative flex items-center">
              <span className="relative">{item.label}</span>
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
      <div role="tabpanel" id={`panel-${panelId}`} aria-labelledby={`tab-${panelId}`}>
        {children}
      </div>
    );
  }

  const panelId = id || value || "";
  const active = panelId === activeId;
  if (!active) return null;
  return (
    <div role="tabpanel" id={`panel-${panelId}`} aria-labelledby={`tab-${panelId}`}>
      {children}
    </div>
  );
}
