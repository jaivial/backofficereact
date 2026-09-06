import type { PageContextServer } from "vike/types";
import { useConfig } from "vike-react/useConfig";
import { createClient } from "../../../../api/client";
import type { Campaign } from "../../../../api/types";

export type Data = Awaited<ReturnType<typeof data>>;

export async function data(pageContext: PageContextServer) {
  const config = useConfig();
  const raw = String((pageContext as { routeParams?: { campaignId?: string } }).routeParams?.campaignId ?? "");
  const campaignId = Number(raw);
  const valid = Number.isFinite(campaignId) && campaignId > 0;
  config({ title: valid ? `Campana ${campaignId} · Campanas` : "Campana no valida" });

  let initialCampaign: Campaign | null = null;
  if (valid) {
    const backendOrigin = pageContext.boRequest?.backendOrigin ?? "http://127.0.0.1:8080";
    const cookieHeader = pageContext.boRequest?.cookieHeader ?? "";
    try {
      const api = createClient({ baseUrl: backendOrigin, cookieHeader });
      const res = await api.config.getCampaign(campaignId);
      if (res.success) initialCampaign = res.campaign ?? null;
    } catch {
      initialCampaign = null;
    }
  }
  return { campaignId: valid ? campaignId : null, initialCampaign };
}
