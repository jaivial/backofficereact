import React, { useRef, useState } from "react";
import { Info } from "lucide-react";

import { Popover } from "../../../../../ui/overlays/Popover";

// Small info affordance next to a field label. BunnyCDN names these values
// differently in its own panel, so each field explains what it is and where to
// copy it from.
export function InfoHint({ title, children }: { title: string; children: React.ReactNode }) {
  const anchorRef = useRef<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        className="inline-flex cursor-pointer border-0 bg-transparent p-0 text-[var(--bo-muted)] hover:text-[var(--bo-fg)]"
        aria-label={`Ayuda: ${title}`}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        data-role="config-cdn-info-btn"
      >
        <Info size={14} aria-hidden="true" />
      </button>
      <Popover
        open={open}
        anchorRef={anchorRef}
        onClose={() => setOpen(false)}
        ariaLabel={`Ayuda: ${title}`}
        maxWidthPx={340}
        minWidthPx={260}
      >
        <div data-slot="infoHint-popover-head" className="bo-popover__head">
          <h4 data-slot="infoHint-popover-title" className="bo-popover__title">{title}</h4>
        </div>
        <div data-slot="infoHint-popover-body" className="bo-popover__body">{children}</div>
      </Popover>
    </>
  );
}
