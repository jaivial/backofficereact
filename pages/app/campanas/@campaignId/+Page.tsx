import React from "react";
import { usePageContext } from "vike-react/usePageContext";
import { ArrowLeft } from "lucide-react";
import { CampaignEditor } from "../functionalComponents/CampaignEditor";
import { InlineAlert } from "../../../../ui/feedback/InlineAlert";
import type { Data } from "./+data";

export default function CampanaEditPage() {
  const pageContext = usePageContext();
  const data = (pageContext.data ?? { campaignId: null, initialCampaign: null }) as Data;

  return (
    <section className="grid gap-4" aria-label="Campana" data-testid="campaign-edit-page">
      <a href="/app/campanas" className="inline-flex items-center gap-2 text-sm" data-testid="campaign-edit-back-link">
        <ArrowLeft size={16} aria-hidden="true" /> Volver a campanas
      </a>
      {data.campaignId ? (
        <CampaignEditor mode="edit" campaignId={data.campaignId} initialCampaign={data.initialCampaign} />
      ) : (
        <InlineAlert kind="error" title="Campana no valida" message="El identificador de campana no es valido." data-testid="campaign-edit-invalid" />
      )}
    </section>
  );
}
