import React, { useCallback, useEffect, useMemo, useState } from "react";
import { navigate } from "vike/client/router";
import { Mail, MessageCircle, Plus } from "lucide-react";
import type { Campaign } from "../../../../api/types";
import { Button } from "../../../../ui/actions/Button";
import { EmptyState } from "../../../../ui/feedback/EmptyState";
import { Panel } from "../../../../ui/shell/Panel";
import { createCampaignsAPI } from "./campaignsApi";

export function CampaignsList() {
  const api = useMemo(() => createCampaignsAPI(), []);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.list();
      setCampaigns(result.success ? result.campaigns ?? [] : []);
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => { void load(); }, [load]);

  return (
    <section className="grid gap-4" aria-label="Campanas" data-testid="campaigns-list-page">
      <Panel
        title="Campanas"
        meta="Anuncios por email y WhatsApp"
        actions={
          <Button variant="primary" onClick={() => void navigate("/app/campanas/nueva")} data-testid="campaign-create-btn">
            <Plus size={16} aria-hidden="true" /> Nueva campana
          </Button>
        }
        data-testid="campaigns-list-panel"
      >
        {loading ? (
          <p data-testid="campaigns-list-loading">Cargando…</p>
        ) : campaigns.length === 0 ? (
          <EmptyState title="Sin campanas" description="Crea la primera campana para enviar anuncios a tus clientes." data-testid="campaigns-list-empty" />
        ) : (
          <ul className="grid gap-2" data-testid="campaigns-list-items">
            {campaigns.map((campaign) => (
              <li key={campaign.id}>
                <button
                  type="button"
                  className="bo-panel w-full text-left p-3"
                  onClick={() => void navigate(`/app/campanas/${campaign.id}`)}
                  data-testid={`campaign-item-${campaign.id}`}
                  data-coord-id={campaign.coord_id}
                >
                  <span className="font-medium">{campaign.name}</span>
                  <span className="ml-2 text-sm opacity-70">{campaign.status}</span>
                  <span className="ml-2 text-sm opacity-70">
                    {campaign.channels?.includes("email") && <Mail size={14} aria-hidden="true" className="inline" />}
                    {campaign.channels?.includes("whatsapp") && <MessageCircle size={14} aria-hidden="true" className="inline" />}
                  </span>
                  <span className="ml-2 text-sm opacity-70">
                    {campaign.stats?.sent ?? 0}/{campaign.stats?.total ?? 0}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </section>
  );
}
