import React from "react";
import { ArrowLeft } from "lucide-react";
import { CampaignEditor } from "../functionalComponents/CampaignEditor";

export default function CampanaNuevaPage() {
  return (
    <section className="grid gap-4" aria-label="Nueva campana" data-testid="campaign-new-page">
      <a href="/app/campanas" className="inline-flex items-center gap-2 text-sm" data-testid="campaign-new-back-link">
        <ArrowLeft size={16} aria-hidden="true" /> Volver a campanas
      </a>
      <CampaignEditor mode="create" />
    </section>
  );
}
