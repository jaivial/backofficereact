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
  /** "panel" reuses the menu-section container shell (head row + editable title). */
  variant?: "default" | "panel";
  headerLead?: React.ReactNode;
  titleLabel?: string;
  titleValue?: string;
  onTitleChange?: (value: string) => void;
  titlePlaceholder?: string;
  titleInputTestId?: string;
  titleAriaLabel?: string;
  bodyClassName?: string;
};

export function Accordion({
  title,
  defaultOpen = false,
  children,
  className,
  actions,
  testId,
  variant = "default",
  headerLead,
  titleLabel,
  titleValue,
  onTitleChange,
  titlePlaceholder,
  titleInputTestId,
  titleAriaLabel,
  bodyClassName,
}: AccordionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const instanceId = useId();
  const id = testId ?? `accordion-${instanceId}`;
  const toggle = useCallback(() => setOpen((v) => !v), []);

  if (variant === "panel") {
    // Coordination id: comida_autosave_v1 - same container UI as a menu section,
    // so the collapsed row still exposes the (single line) title input.
    return (
      <div
        className={cn("bo-panel bo-accordionSection", open && "is-active", className)}
        data-role="accordion"
        data-ui="accordion-root"
        data-testid={id}
        data-coordination-id="comida_autosave_v1"
      >
        <div className="bo-accordionHeadRow" data-testid={`${id}-header`}>
          {headerLead}
          <button
            type="button"
            className="bo-accordionHead"
            onClick={toggle}
            aria-expanded={open}
            aria-controls={`${id}-content`}
            data-role="accordion-trigger"
            data-testid={`${id}-trigger`}
          >
            <span className="bo-accordionHeadLeft" data-testid={`${id}-title-wrap`}>
              {titleLabel ? (
                <span className="bo-label" data-testid={`${id}-title-label`}>{titleLabel}</span>
              ) : null}
              {onTitleChange ? (
                <input
                  className="bo-input"
                  value={titleValue ?? title}
                  onClick={(event) => event.stopPropagation()}
                  onPointerDown={(event) => event.stopPropagation()}
                  onChange={(event) => onTitleChange(event.target.value)}
                  placeholder={titlePlaceholder}
                  aria-label={titleAriaLabel}
                  data-testid={titleInputTestId}
                />
              ) : (
                <span
                  style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                  title={title}
                  data-testid={`${id}-title`}
                >
                  {title}
                </span>
              )}
            </span>
          </button>
          <span className="bo-accordionHeadTrail">
            {actions ? <span data-testid={`${id}-actions`}>{actions}</span> : null}
            <button
              type="button"
              className="bo-accordionChevronBtn"
              onClick={toggle}
              aria-expanded={open}
              aria-controls={`${id}-content`}
              aria-label={open ? "Contraer" : "Expandir"}
              data-testid={`${id}-chevron`}
            >
              <span className={cn("bo-accordionIcon", open && "is-open")}>
                <ChevronDown size={16} strokeWidth={1.8} aria-hidden="true" />
              </span>
            </button>
          </span>
        </div>
        <div
          id={`${id}-content`}
          className={cn("bo-accordionBody", bodyClassName)}
          hidden={!open}
          data-testid={`${id}-content`}
        >
          {open ? children : null}
        </div>
      </div>
    );
  }

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
