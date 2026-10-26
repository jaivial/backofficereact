import React from "react";
import { usePageContext } from "vike-react/usePageContext";
import { CampaignEditor, campaignEditorTab } from "../functionalComponents/CampaignEditor";

export default function CampanaNuevaPage() {
  const pageContext = usePageContext();
  return (
    // Desktop: the editor fills the rest of the viewport (no page scroll).
    <section className="flex min-w-0 flex-col gap-4 lg:min-h-0 lg:flex-1" aria-label="Nueva campaña" data-testid="campaign-new-page">
      <CampaignEditor mode="create" initialTab={campaignEditorTab(pageContext.urlParsed?.search?.tab)} />
    </section>
  );
}
