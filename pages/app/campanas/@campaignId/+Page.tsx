import React from "react";
import { usePageContext } from "vike-react/usePageContext";
import { CampaignEditor, campaignEditorTab } from "../functionalComponents/CampaignEditor";
import { InlineAlert } from "../../../../ui/feedback/InlineAlert";
import type { Data } from "./+data";

export default function CampanaEditPage() {
  const pageContext = usePageContext();
  const data = (pageContext.data ?? { campaignId: null, initialCampaign: null }) as Data;

  return (
    // Desktop: the editor fills the rest of the viewport (no page scroll).
    <section className="flex min-w-0 flex-col gap-4 lg:min-h-0 lg:flex-1" aria-label="Campaña" data-testid="campaign-edit-page">
      {data.campaignId ? (
        <CampaignEditor
          mode="edit"
          campaignId={data.campaignId}
          initialCampaign={data.initialCampaign}
          initialTab={campaignEditorTab(pageContext.urlParsed?.search?.tab)}
        />
      ) : (
        <InlineAlert kind="error" title="Campaña no válida" message="El identificador de campaña no es válido." testId="campaign-edit-invalid" />
      )}
    </section>
  );
}
