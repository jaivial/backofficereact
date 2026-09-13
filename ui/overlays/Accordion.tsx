import React, { useCallback, useId, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "../shadcn/utils";

type AccordionProps = {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
  className?: string;
  actions?: React.ReactNode;
  testId?: string;
};

export function Accordion({ title, defaultOpen = false, children, className, actions, testId }: AccordionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const instanceId = useId();
  const id = testId ?? `accordion-${instanceId}`;
  const toggle = useCallback(() => setOpen((v) => !v), []);

  return (
    <div className={cn("bo-accordionItem", open && "is-active", className)} data-role="accordion" data-ui="accordion-root" data-testid={id} data-coordination-id="comida_autosave_v1">
      <div style={{ display: "flex", alignItems: "center", minWidth: 0 }} data-testid={`${id}-header`}>
        <button
          type="button"
          className="bo-accordionTrigger"
          style={{ flex: 1, minWidth: 0 }}
          onClick={toggle}
          aria-expanded={open}
          aria-controls={`${id}-content`}
          data-role="accordion-trigger"
          data-testid={`${id}-trigger`}
        >
          <span className="bo-accordionTriggerLeft" style={{ minWidth: 0 }} data-testid={`${id}-title-wrap`}>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={title} data-testid={`${id}-title`}>{title}</span>
          </span>
          <span className={cn("bo-accordionIcon", open && "is-open")} data-testid={`${id}-chevron`}>
            <ChevronDown size={16} strokeWidth={1.8} aria-hidden="true" />
          </span>
        </button>
        {actions ? <div style={{ flexShrink: 0, paddingRight: 16 }} data-testid={`${id}-actions`}>{actions}</div> : null}
      </div>
      <div id={`${id}-content`} className="bo-accordionContent" hidden={!open} data-testid={`${id}-content`}>
        {open ? children : null}
      </div>
    </div>
  );
}
