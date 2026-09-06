import React, { useMemo } from "react";
import type { CampaignTheme } from "../../../../api/types";
import { toWhatsAppText } from "./campaignsApi";
import { renderCampaignEmailBody } from "./campaignEmailBody";

// Live preview: the markdown body is rendered in the browser on every keystroke
// and injected into the email shell served by the backend, so what you see is
// the exact document that gets delivered.

type CampaignPreviewProps = {
  markdown: string;
  theme: CampaignTheme;
  shell: string;
  bodyPlaceholder: string;
  device: "mobile" | "desktop";
};

export function CampaignPreview({ markdown, theme, shell, bodyPlaceholder, device }: CampaignPreviewProps) {
  const html = useMemo(() => {
    if (!shell || !bodyPlaceholder) return "";
    return shell.replace(bodyPlaceholder, renderCampaignEmailBody(markdown, theme));
  }, [shell, bodyPlaceholder, markdown, theme]);

  return (
    <div className="grid gap-4 md:grid-cols-2" data-testid="campaign-preview-live">
      <iframe
        title="Previsualizacion email"
        srcDoc={html}
        className="w-full rounded-xl border"
        style={{ height: 480, maxWidth: device === "mobile" ? 380 : "100%" }}
        data-testid="campaign-preview-email"
      />
      <pre className="whitespace-pre-wrap rounded-xl border p-3 text-sm" data-testid="campaign-preview-whatsapp">
        {toWhatsAppText(markdown)}
      </pre>
    </div>
  );
}
