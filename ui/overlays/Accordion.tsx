import React, { useCallback, useState } from "react";
import { ChevronDown } from "lucide-react";

type AccordionProps = {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
  className?: string;
};

export function Accordion({ title, defaultOpen = false, children, className }: AccordionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const toggle = useCallback(() => setOpen((v) => !v), []);

  return (
    <div className={`bo-accordionItem${open ? " is-active" : ""}${className ? " " + className : ""}`} data-role="accordion" data-ui="accordion-root">
      <button
        type="button"
        className="bo-accordionTrigger"
        onClick={toggle}
        aria-expanded={open}
        data-role="accordion-trigger"
        data-testid="email-provider-trigger"
      >
        <span className="bo-accordionTriggerLeft" data-slot="accordion-trigger-left">
          <span data-slot="accordion-title">{title}</span>
        </span>
        <span className="bo-accordionTriggerRight" data-slot="accordion-trigger-right">
          <span className={`bo-accordionIcon${open ? " is-open" : ""}`} data-slot="accordion-chevron">
            <ChevronDown size={16} strokeWidth={1.8} aria-hidden="true" />
          </span>
        </span>
      </button>
      <div className="bo-accordionContent" data-slot="accordion-content">
        {open ? children : null}
      </div>
    </div>
  );
}
