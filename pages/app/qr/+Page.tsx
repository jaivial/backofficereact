import React, { useState } from "react";
import { usePageContext } from "vike-react/usePageContext";

import type { Data } from "./+data";
import { InlineAlert } from "../../../ui/feedback/InlineAlert";
import { SimpleTabs, type SimpleTabItem } from "../../../ui/nav/SimpleTabs";
import { QrCustomizeTab } from "./functionalComponents/QrCustomizeTab";
import { QrGeneralTab } from "./functionalComponents/QrGeneralTab";
import "./qr.css";

type QrTabId = "general" | "customize";

const TABS: SimpleTabItem[] = [
  { id: "general", label: "General QR" },
  { id: "customize", label: "Personalizar" },
];

/**
 * QR module entry point. First-class section reachable from the sidebar.
 * Observational point: `qr-page:root` — the module root that both tabs hang from.
 */
export default function QrPage() {
  const data = usePageContext().data as Data;
  const [tab, setTab] = useState<QrTabId>("general");
  const website = data.restaurantInfo?.website ?? "";

  return (
    <section aria-label="QR" className="qr-page" data-testid="qr-page" data-ui="qr-page" data-coord-id="qr-page:root">
      <SimpleTabs items={TABS} activeId={tab} onChange={(id) => setTab(id as QrTabId)} aria-label="Secciones del modulo QR" />
      {data.error ? (
        <InlineAlert kind="error" title="No se pudieron cargar los datos" message={data.error} testId="qr-page-error" />
      ) : null}
      {tab === "general" ? <QrGeneralTab website={website} /> : <QrCustomizeTab website={website} />}
    </section>
  );
}
