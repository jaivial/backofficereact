import React, { useCallback, useEffect, useMemo, useState } from "react";
import { navigate } from "vike/client/router";
import { ArrowLeft, ChevronLeft, ChevronRight, Mail, MessageCircle, UserX } from "lucide-react";
import type { CampaignUnsubscribed } from "../../../../api/types";
import { Button } from "../../../../ui/actions/Button";
import { EmptyState } from "../../../../ui/feedback/EmptyState";
import { LoadingSpinner } from "../../../../ui/feedback/LoadingSpinner";
import { PageToolbar } from "../../../../ui/shell/PageToolbar";
import { createCampaignsAPI } from "./campaignsApi";

const PAGE_SIZE = 10;

const CHANNEL_UI: Record<string, { label: string; Icon: typeof Mail }> = {
  email: { label: "Email", Icon: Mail },
  whatsapp: { label: "WhatsApp", Icon: MessageCircle },
};

/** One suppressed booking, ready for the table row and the mobile card. */
type UnsubscribedRow = CampaignUnsubscribed & { key: string };

type UnsubscribedPage = {
  items: UnsubscribedRow[];
  page: number;
  totalPages: number;
  total: number;
};

export function CampaignsUnsubscribed() {
  const api = useMemo(() => createCampaignsAPI(), []);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<UnsubscribedPage>({ items: [], page: 1, totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (target: number) => {
    setLoading(true);
    try {
      const result = await api.unsubscribed(target);
      if (!result.success) {
        setData({ items: [], page: target, totalPages: 1, total: 0 });
        return;
      }
      setData({
        items: result.items.map((item, index) => ({ ...item, key: `${item.booking_id}-${item.channel}-${item.contact}-${index}` })),
        page: result.page,
        totalPages: Math.max(result.total_pages, 1),
        total: result.total,
      });
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => { void load(page); }, [page, load]);

  const go = useCallback((target: number) => setPage(target), []);

  return (
    <section className="grid gap-4" aria-label="Bajas de campañas" data-testid="campaigns-unsubscribed-page">
      <div className="grid content-start gap-3" data-testid="campaigns-unsubscribed-panel">
        <PageToolbar
          className="mb-0 items-end"
          left={
            <div className="grid gap-1">
              <h1 className="flex flex-wrap items-center gap-2 text-xl font-bold tracking-tight">
                <span className="grid size-8 place-items-center rounded-bo-sm border border-bo-border-2 bg-bo-surface-2 text-bo-accent" aria-hidden="true">
                  <UserX size={16} />
                </span>
                Bajas de campañas
                <span className="rounded-bo-full border border-bo-border-2 bg-bo-surface-2 px-2 py-0.5 text-[11px] font-semibold text-bo-muted" data-testid="campaigns-unsubscribed-count">
                  {loading ? "\u2026" : data.total}
                </span>
              </h1>
              <p className="text-xs text-bo-muted">Reservas que no quieren recibir mas campañas</p>
            </div>
          }
          right={
            <Button variant="ghost" onClick={() => void navigate("/app/campanas")} data-testid="campaigns-unsubscribed-back-btn">
              <ArrowLeft size={16} aria-hidden="true" /> Volver
            </Button>
          }
          data-testid="campaigns-unsubscribed-toolbar"
        />

        {loading ? (
          <div className="grid content-start gap-3" data-testid="campaigns-unsubscribed-loading">
            <LoadingSpinner size="sm" label="Cargando bajas" centered />
          </div>
        ) : data.items.length === 0 ? (
          <EmptyState
            variant="tailwind"
            className="p-10"
            title="Sin bajas"
            description="Cuando un cliente pulse el boton de darse de baja en una campaña, su reserva aparecer\u00e1 aqu\u00ed."
            data-testid="campaigns-unsubscribed-empty"
          />
        ) : (
          <>
            {/* Table from 1025px up: the cards take over below that width. */}
            <div className="hidden min-[1025px]:block overflow-hidden rounded-bo-md border border-bo-border" data-testid="campaigns-unsubscribed-table">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="bg-bo-surface-2 text-[11px] uppercase tracking-wide text-bo-muted">
                    <th className="px-4 py-2.5 font-semibold">Cliente</th>
                    <th className="px-4 py-2.5 font-semibold">Contacto</th>
                    <th className="px-4 py-2.5 font-semibold">Canal</th>
                    <th className="px-4 py-2.5 font-semibold">Fecha de reserva</th>
                    <th className="px-4 py-2.5 font-semibold text-center">Comensales</th>
                    <th className="px-4 py-2.5 font-semibold">Motivo</th>
                    <th className="px-4 py-2.5 font-semibold">Baja</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((row) => (
                    <tr key={row.key} className="border-t border-bo-border transition-colors hover:bg-bo-surface-2" data-testid={`campaigns-unsubscribed-row-${row.booking_id}`}>
                      <td className="px-4 py-2.5 font-medium">{row.customer_name || "\u2014"}</td>
                      <td className="px-4 py-2.5 break-all text-bo-muted">{row.contact || "\u2014"}</td>
                      <td className="px-4 py-2.5"><CampaignUnsubscribedChannel channel={row.channel} /></td>
                      <td className="px-4 py-2.5 text-bo-muted">{row.reservation_date || "\u2014"}</td>
                      <td className="px-4 py-2.5 text-center">{row.party_size || "\u2014"}</td>
                      <td className="px-4 py-2.5 text-bo-muted">{row.reason || "\u2014"}</td>
                      <td className="px-4 py-2.5 text-bo-muted">{row.since}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Cards up to 1024px: no table, one card per booking. */}
            <ul className="grid list-none grid-cols-1 gap-3 p-0 min-[1025px]:hidden" data-testid="campaigns-unsubscribed-cards">
              {data.items.map((row) => (
                <li key={row.key} className="w-full min-w-0" data-testid={`campaigns-unsubscribed-card-${row.booking_id}`}>
                  <div className="grid min-w-0 gap-2 rounded-bo-md border border-bo-border bg-bo-surface p-3 text-sm">
                    <div className="flex min-w-0 items-start justify-between gap-2">
                      <span className="min-w-0 truncate font-semibold" data-testid={`campaigns-unsubscribed-card-name-${row.booking_id}`}>
                        {row.customer_name || "Sin nombre"}
                      </span>
                      <CampaignUnsubscribedChannel channel={row.channel} />
                    </div>
                    <span className="min-w-0 break-all text-bo-muted" data-testid={`campaigns-unsubscribed-card-contact-${row.booking_id}`}>{row.contact || "\u2014"}</span>
                    <dl className="grid grid-cols-3 gap-2 text-xs">
                      <div className="grid gap-0.5" data-testid={`campaigns-unsubscribed-card-reserved-${row.booking_id}`}>
                        <dt className="text-bo-faint">Reserva</dt>
                        <dd className="font-medium">{row.reservation_date || "\u2014"}</dd>
                      </div>
                      <div className="grid gap-0.5" data-testid={`campaigns-unsubscribed-card-party-${row.booking_id}`}>
                        <dt className="text-bo-faint">Comensales</dt>
                        <dd className="font-medium">{row.party_size || "\u2014"}</dd>
                      </div>
                      <div className="grid gap-0.5" data-testid={`campaigns-unsubscribed-card-since-${row.booking_id}`}>
                        <dt className="text-bo-faint">Baja</dt>
                        <dd className="font-medium">{row.since}</dd>
                      </div>
                    </dl>
                    {row.reason ? (
                      <span className="min-w-0 break-words rounded-bo-sm border border-bo-border bg-bo-surface-2 px-2 py-1 text-[11px] text-bo-muted" data-testid={`campaigns-unsubscribed-card-reason-${row.booking_id}`}>
                        {row.reason}
                      </span>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>

            <CampaignUnsubscribedPager page={data.page} totalPages={data.totalPages} onChange={go} />
          </>
        )}
      </div>
    </section>
  );
}

function CampaignUnsubscribedPager({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (target: number) => void }) {
  return (
    <nav className="flex items-center justify-between gap-2 border-t border-bo-border pt-3" aria-label="Paginacion de bajas" data-testid="campaigns-unsubscribed-pager">
      <span className="text-xs text-bo-muted" data-testid="campaigns-unsubscribed-pager-status">
        Pagina {page} de {totalPages}
      </span>
      <span className="flex items-center gap-1">
        <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => onChange(page - 1)} data-testid="campaigns-unsubscribed-pager-prev" aria-label="Pagina anterior">
          <ChevronLeft size={14} aria-hidden="true" /> Anterior
        </Button>
        <Button variant="ghost" size="sm" disabled={page >= totalPages} onClick={() => onChange(page + 1)} data-testid="campaigns-unsubscribed-pager-next" aria-label="Pagina siguiente">
          Siguiente <ChevronRight size={14} aria-hidden="true" />
        </Button>
      </span>
    </nav>
  );
}

function CampaignUnsubscribedChannel({ channel }: { channel: string }) {
  const ui = CHANNEL_UI[channel];
  if (!ui) return <span className="text-xs text-bo-faint">{channel || "\u2014"}</span>;
  return (
    <span className="inline-flex items-center gap-1 text-xs text-bo-muted" data-testid={`campaigns-unsubscribed-channel-${channel}`}>
      <ui.Icon size={13} aria-hidden="true" /> {ui.label}
    </span>
  );
}
