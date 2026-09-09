import React, { useCallback, useEffect, useMemo, useState } from "react";
import { navigate } from "vike/client/router";
import { Mail, MessageCircle, Megaphone, Pencil, Plus, Trash2, UserX, Users } from "lucide-react";
import type { Campaign } from "../../../../api/types";
import { Button } from "../../../../ui/actions/Button";
import { EmptyState } from "../../../../ui/feedback/EmptyState";
import { LoadingSpinner } from "../../../../ui/feedback/LoadingSpinner";
import { Card } from "../../../../ui/shell/Card";
import { PageToolbar } from "../../../../ui/shell/PageToolbar";
import { createCampaignsAPI } from "./campaignsApi";
import {
  CampaignStatusBadge,
  campaignAudienceSummary,
  campaignRelativeDate,
  campaignShortDate,
  CAMPAIGN_CHANNEL_UI,
} from "./campaignUi";

/** One responsive column on phones, two from md, three from xl. */
const CAMPAIGNS_GRID_CLASS = "list-none m-0 grid grid-cols-1 gap-3 p-0 md:grid-cols-2 xl:grid-cols-3";

/** Card skeleton: keeps the grid shape while the list is on its way. */
function CampaignCardSkeleton({ index }: { index: number }) {
  return (
    <li className="bo-skeletonCard h-full" data-testid={`campaign-card-skeleton-${index}`} data-observe="campaign-card-skeleton" aria-hidden="true">
      <div className="grid content-start gap-3">
        <div className="flex items-start justify-between gap-2">
          <span className="bo-skeletonLine bo-skeletonLine--md h-4" />
          <span className="bo-skeleton h-5 w-20" />
        </div>
        <span className="bo-skeletonLine bo-skeletonLine--lg h-3" />
        <span className="bo-skeletonLine bo-skeletonLine--sm h-3" />
        <div className="flex items-center gap-2">
          <span className="bo-skeleton h-6 w-24 rounded-bo-full" />
          <span className="bo-skeleton h-6 w-16 rounded-bo-full" />
        </div>
      </div>
    </li>
  );
}

type CampaignCardProps = {
  campaign: Campaign;
  busy: boolean;
  onDelete: (campaign: Campaign) => void;
};

function CampaignCard({ campaign, busy, onDelete }: CampaignCardProps) {
  const total = campaign.stats?.total ?? 0;
  const channels = campaign.channels ?? [];
  return (
    <li className="min-w-0" data-testid={`campaign-item-${campaign.id}`} data-coord-id={campaign.coord_id} data-observe="campaign-card">
      <Card
        variant="default"
        className="group h-full min-w-0 transition duration-150 hover:-translate-y-0.5 hover:border-[var(--bo-border-2)] hover:shadow-[var(--bo-shadow-soft)]"
        data-observe="campaign-card-body"
      >
        <div className="grid content-start gap-3">
          <div className="flex items-start justify-between gap-2">
            <div className="grid min-w-0 gap-1">
              <h3 className="truncate text-base font-semibold leading-tight" title={campaign.name} data-testid={`campaign-item-name-${campaign.id}`}>
                {campaign.name || "Campaña sin nombre"}
              </h3>
              <p className="line-clamp-2 text-xs text-bo-muted" title={campaign.subject} data-testid={`campaign-item-subject-${campaign.id}`}>
                {campaign.subject || "Sin asunto"}
              </p>
            </div>
            <CampaignStatusBadge status={campaign.status} testId={`campaign-item-status-${campaign.id}`} />
          </div>

          <ul className="list-none m-0 flex flex-wrap items-center gap-1.5 p-0" data-testid={`campaign-item-channels-${campaign.id}`}>
            {channels.length ? (
              channels.map((channel) => (
                <li
                  key={channel}
                  className="inline-flex items-center gap-1.5 rounded-bo-full border border-bo-border bg-[rgba(255,255,255,0.03)] px-2 py-1 text-[11px] text-bo-muted"
                  data-testid={`campaign-item-channel-${channel}-${campaign.id}`}
                >
                  {channel === "email" ? <Mail size={13} aria-hidden="true" /> : <MessageCircle size={13} aria-hidden="true" />}
                  {CAMPAIGN_CHANNEL_UI[channel].label}
                  <span className="font-semibold text-bo-text" data-testid={`campaign-item-channel-count-${channel}-${campaign.id}`}>{total}</span>
                </li>
              ))
            ) : (
              <li className="text-[11px] text-bo-faint">Sin canal</li>
            )}
          </ul>

          <p className="flex items-center gap-1.5 text-xs text-bo-faint" data-testid={`campaign-item-audience-${campaign.id}`}>
            <Users size={13} aria-hidden="true" />
            {campaignAudienceSummary(campaign.audience, campaign.audience_days, campaign.manual_recipients?.length ?? 0)}
          </p>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-bo-border pt-2.5">
            <span
              className="text-[11px] text-bo-faint"
              title={campaign.created_at ? `Creada el ${campaignShortDate(campaign.created_at)}` : undefined}
              data-testid={`campaign-item-dates-${campaign.id}`}
            >
              Creada {campaignRelativeDate(campaign.created_at)}
              {campaign.updated_at ? ` \u00b7 editada ${campaignRelativeDate(campaign.updated_at)}` : ""}
            </span>
            <div className="flex items-center gap-1.5">
              <Button variant="primary" size="sm" onClick={() => void navigate(`/app/campanas/${campaign.id}`)} data-testid={`campaign-item-edit-${campaign.id}`}>
                <Pencil size={14} aria-hidden="true" /> Editar
              </Button>
              <Button
                variant="ghost"
                size="sm"
                aria-label={`Eliminar ${campaign.name || "la campaña"}`}
                title="Eliminar campaña"
                disabled={busy}
                className="opacity-60 transition hover:text-[var(--bo-on-surface-danger)] hover:opacity-100 focus-visible:opacity-100"
                onClick={() => onDelete(campaign)}
                data-testid={`campaign-item-delete-${campaign.id}`}
              >
                <Trash2 size={14} aria-hidden="true" />
              </Button>
            </div>
          </div>

          {total > 0 ? (
            <p className="text-[11px] text-bo-faint" data-testid={`campaign-item-stats-${campaign.id}`}>
              {campaign.stats?.sent ?? 0} enviados &middot; {campaign.stats?.pending ?? 0} pendientes &middot; {campaign.stats?.failed ?? 0} fallidos
            </p>
          ) : null}
        </div>
      </Card>
    </li>
  );
}

export function CampaignsList() {
  const api = useMemo(() => createCampaignsAPI(), []);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [removingId, setRemovingId] = useState<number | null>(null);

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

  const remove = useCallback(async (campaign: Campaign) => {
    setRemovingId(campaign.id);
    try {
      await api.remove(campaign.id);
      await load();
    } finally {
      setRemovingId(null);
    }
  }, [api, load]);

  return (
    <section className="grid gap-4" aria-label="Campañas" data-testid="campaigns-list-page">
      <div className="grid content-start gap-3" data-testid="campaigns-list-panel">
        <PageToolbar
          className="mb-0 items-end"
          left={
            <div className="grid gap-1">
              <h1 className="flex flex-wrap items-center gap-2 text-xl font-bold tracking-tight">
                <span className="grid size-8 place-items-center rounded-bo-sm border border-bo-border-2 bg-bo-surface-2 text-bo-accent" aria-hidden="true">
                  <Megaphone size={16} />
                </span>
                Campañas
                <span className="rounded-bo-full border border-bo-border-2 bg-bo-surface-2 px-2 py-0.5 text-[11px] font-semibold text-bo-muted" data-testid="campaigns-list-count">
                  {loading ? "\u2026" : campaigns.length}
                </span>
              </h1>
              <p className="text-xs text-bo-muted">Anuncios por email y WhatsApp a tus clientes</p>
            </div>
          }
          right={
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="ghost" onClick={() => void navigate("/app/campanas/unsubscribed")} data-testid="campaign-unsubscribed-nav-btn">
                <UserX size={16} aria-hidden="true" /> Bajas
              </Button>
              <Button variant="primary" onClick={() => void navigate("/app/campanas/nueva")} data-testid="campaign-create-btn">
                <Plus size={16} aria-hidden="true" /> Nueva campaña
              </Button>
            </div>
          }
          data-testid="campaigns-list-toolbar"
        />

        {loading ? (
          <div className="grid content-start gap-3" data-testid="campaigns-list-loading">
            <LoadingSpinner size="sm" label="Cargando campañas" centered />
            <ul className={CAMPAIGNS_GRID_CLASS} data-observe="campaigns-list-skeletons">
              {[0, 1, 2].map((index) => <CampaignCardSkeleton key={index} index={index} />)}
            </ul>
          </div>
        ) : campaigns.length === 0 ? (
          <EmptyState
            variant="tailwind"
            className="p-10"
            title="Todavia no hay campañas"
            description="Crea la primera campaña para anunciar novedades a tus clientes por email y WhatsApp."
            data-testid="campaigns-list-empty"
          >
            <Button variant="primary" className="mt-1" onClick={() => void navigate("/app/campanas/nueva")} data-testid="campaigns-empty-create-btn">
              <Plus size={16} aria-hidden="true" /> Crear campaña
            </Button>
          </EmptyState>
        ) : (
          <ul className={CAMPAIGNS_GRID_CLASS} data-testid="campaigns-list-items">
            {campaigns.map((campaign) => (
              <CampaignCard key={campaign.id} campaign={campaign} busy={removingId === campaign.id} onDelete={(item) => void remove(item)} />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
