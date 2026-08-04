import React from "react";
import { Maximize2, Minimize2 } from "lucide-react";
import { useAtom } from "jotai";

import { Tabs } from "../../../../../ui/nav/Tabs";
import { posFullscreenAtom } from "../../../../../state/atoms";

/** "Integrado" keeps the app shell; "Pantalla completa" hides sidebar/topbar.
 *  Reuses the same Tabs UI as the reservas layout (aria-label="Pestañas …"). */
export function POSViewSwitcher() {
  const [fullscreen, setFullscreen] = useAtom(posFullscreenAtom);
  return (
    <span data-testid="pos-view-switcher" className="inline-flex">
    <Tabs
      mode="button"
      ariaLabel="Modo de pantalla TPV"
      activeId={fullscreen ? "fullscreen" : "integrated"}
      onNavigate={(_href, id) => setFullscreen(id === "fullscreen")}
      tabs={[
        { id: "integrated", label: "Integrado", href: "#", icon: <Minimize2 className="h-4 w-4" /> },
        { id: "fullscreen", label: "Pantalla completa", href: "#", icon: <Maximize2 className="h-4 w-4" /> },
      ]}
    />
    </span>
  );
}
