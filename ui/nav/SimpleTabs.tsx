import React, { useState } from "react";
import { motion, useReducedMotion } from "motion/react";

export type SimpleTabItem = {
  id: string;
  label: string;
};

export function SimpleTabs({
  items,
  activeId,
  onChange,
  className,
  "aria-label": ariaLabel,
}: {
  items: SimpleTabItem[];
  activeId: string;
  onChange: (id: string) => void;
  className?: string;
  "aria-label": string;
}) {
  const reduceMotion = useReducedMotion();
  const [mounted, setMounted] = useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const activeIndex = items.findIndex((t) => t.id === activeId);

  return (
    <div className={["bo-tabs", className].filter(Boolean).join(" ")} role="tablist" aria-label={ariaLabel}>
      {items.map((item) => {
        const active = item.id === activeId;
        return (
          <button
            key={item.id}
            className={`bo-tab${active ? " is-active" : ""}`}
            role="tab"
            aria-selected={active}
            aria-controls={`panel-${item.id}`}
            id={`tab-${item.id}`}
            onClick={() => onChange(item.id)}
            type="button"
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
              <span className="bo-tabLabel">{item.label}</span>
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
  children,
}: {
  id: string;
  activeId: string;
  children: React.ReactNode;
}) {
  const active = id === activeId;
  if (!active) return null;
  return (
    <div role="tabpanel" id={`panel-${id}`} aria-labelledby={`tab-${id}`}>
      {children}
    </div>
  );
}
