import React, { useRef, useState } from "react";
import { useAtom } from "jotai";
import { MoreVertical } from "lucide-react";

import { Popover } from "../../../../../ui/overlays/Popover";
import { cn } from "../../../../../ui/shadcn/utils";
import { posFullscreenAtom } from "../../../../../state/atoms";

export type POSSection = "sell" | "kitchen" | "catalog" | "stock" | "reports" | "settings";

const SECTIONS: ReadonlyArray<{ id: POSSection; label: string }> = [
  { id: "sell", label: "Venta" },
  { id: "kitchen", label: "Cocina" },
  { id: "catalog", label: "Catálogo" },
  { id: "stock", label: "Stock" },
  { id: "reports", label: "Informes" },
  { id: "settings", label: "Configuración" },
];

/** Three-dots menu that hosts the POS section switcher (replaces the old
 *  inline pos-nav). Reuses the shared Popover overlay. */
export function POSSectionMenu({ section, onChange, onOpenCalendar }: {
  section: POSSection;
  onChange: (next: POSSection) => void;
  /** Opens the cash-day calendar modal. Not a section, so it gets a plain
   *  menuitem rather than a menuitemradio. */
  onOpenCalendar?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement | null>(null);
  const active = SECTIONS.find((s) => s.id === section);
  const [fullscreen, setFullscreen] = useAtom(posFullscreenAtom);

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        className="pos-sectionMenuBtn"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Secciones TPV${active ? ` · ${active.label}` : ""}`}
        data-testid="pos-section-menu"
        onClick={() => setOpen((v) => !v)}
      >
        <MoreVertical className="h-5 w-5" aria-hidden="true" />
      </button>
      <Popover
        open={open}
        anchorRef={anchorRef}
        onClose={() => setOpen(false)}
        ariaLabel="Secciones TPV"
        widthPx={220}
        data-testid="pos-section-popover"
      >
        <ul className="pos-sectionMenuList" role="menu">
          {SECTIONS.map((s) => (
            <li key={s.id} role="none">
              <button
                type="button"
                role="menuitemradio"
                aria-checked={s.id === section}
                className={cn("pos-sectionMenuItem", s.id === section && "is-active")}
                data-testid={`pos-section-${s.id}`}
                data-ui={`pos-nav-${s.id}`}
                onClick={() => { onChange(s.id); setOpen(false); }}
              >
                {s.label}
              </button>
            </li>
          ))}
          <li role="separator" className="pos-sectionMenuSeparator" />
          <li role="none">
            <button
              type="button"
              role="menuitem"
              className="pos-sectionMenuItem"
              data-testid="pos-section-calendar"
              onClick={() => { onOpenCalendar?.(); setOpen(false); }}
            >
              Calendario
            </button>
          </li>
          <li role="separator" className="pos-sectionMenuSeparator" />
          <li role="none">
            <button
              type="button"
              role="menuitemradio"
              aria-checked={!fullscreen}
              className={cn("pos-sectionMenuItem", !fullscreen && "is-active")}
              data-testid="pos-view-integrated"
              onClick={() => { setFullscreen(false); setOpen(false); }}
            >
              Integrado
            </button>
          </li>
          <li role="none">
            <button
              type="button"
              role="menuitemradio"
              aria-checked={fullscreen}
              className={cn("pos-sectionMenuItem", fullscreen && "is-active")}
              data-testid="pos-view-fullscreen"
              onClick={() => { setFullscreen(true); setOpen(false); }}
            >
              Pantalla completa
            </button>
          </li>
        </ul>
      </Popover>
    </>
  );
}
