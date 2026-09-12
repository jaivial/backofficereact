import React, { useEffect, useState } from "react";
import { Palette, QrCode } from "lucide-react";

import { createClient } from "../../../api/client";
import { InlineAlert } from "../../../ui/feedback/InlineAlert";
import { SimpleTabs, type SimpleTabItem } from "../../../ui/nav/SimpleTabs";
import { QrCustomizeTab } from "./functionalComponents/QrCustomizeTab";
import { QrGeneralTab } from "./functionalComponents/QrGeneralTab";
import "./qr.css";

type QrTabId = "general" | "customize";

const TABS: SimpleTabItem[] = [
  { id: "general", label: "General QR", icon: <QrCode size={17} strokeWidth={1.8} /> },
  { id: "customize", label: "Personalizar", icon: <Palette size={17} strokeWidth={1.8} /> },
];

/**
 * QR module entry point. First-class section reachable from the sidebar.
 *
 * Observational points:
 *  - `qr-page:root`          → module root.
 *  - `qr-page:website-fetch` → restaurant website resolved through the proxy.
 */
export default function QrPage() {
  const [tab, setTab] = useState<QrTabId>("general");
  const [website, setWebsite] = useState("");
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    createClient({ baseUrl: "" })
      .config.getRestaurantInfo()
      .then((res) => {
        if (!active) return;
        if (res.success) setWebsite(res.restaurantInfo.website ?? "");
        else setError(res.message || "No se pudo cargar la pagina web del restaurante");
      })
      .catch((e) => {
        if (active) setError(e instanceof Error ? e.message : "No se pudo cargar la pagina web del restaurante");
      })
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <section aria-label="QR" className="qr-page" data-testid="qr-page" data-ui="qr-page" data-coord-id="qr-page:root">
      <SimpleTabs items={TABS} activeId={tab} onChange={(id) => setTab(id as QrTabId)} aria-label="Secciones del modulo QR" />
      {error ? (
        <InlineAlert kind="error" title="No se pudo cargar la pagina web" message={error} testId="qr-page-error" />
      ) : null}
      {ready ? (
        tab === "general" ? (
          <QrGeneralTab website={website} />
        ) : (
          <QrCustomizeTab website={website} />
        )
      ) : (
        <div className="qr-loading" data-testid="qr-page-loading" data-slot="qr-page-loading" data-coord-id="qr-page:website-fetch">
          Cargando…
        </div>
      )}
    </section>
  );
}
