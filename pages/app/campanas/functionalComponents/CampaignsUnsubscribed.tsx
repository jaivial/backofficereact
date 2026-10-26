import React, { useCallback, useEffect, useMemo, useState } from "react";
import { navigate } from "vike/client/router";
import { ArrowLeft, ChevronLeft, ChevronRight, Mail, MessageCircle, UserX } from "lucide-react";
import type { CampaignUnsubscribed, CampaignUnsubscribedCounts, CampaignUnsubscribedKind } from "../../../../api/types";
import { Button } from "../../../../ui/actions/Button";
import { EmptyState } from "../../../../ui/feedback/EmptyState";
import { LoadingSpinner } from "../../../../ui/feedback/LoadingSpinner";
import { PageToolbar } from "../../../../ui/shell/PageToolbar";
import { Select } from "../../../../ui/inputs/Select";
import { createCampaignsAPI } from "./campaignsApi";

const KIND_TABS: { id: CampaignUnsubscribedKind; label: string; hint: string }[] = [
  { id: "baja", label: "Bajas", hint: "Pidieron no recibir más campañas: no se les envía por ningún canal." },
  { id: "email_invalido", label: "Email no válido", hint: "No se les envía email, pero sí WhatsApp." },
  { id: "whatsapp_invalido", label: "WhatsApp no válido", hint: "No se les envía WhatsApp, pero sí email." },
  { id: "pendiente_verificar", label: "Pendientes", hint: "Sin verificar: bloqueados hasta comprobarlos, no se consideran inválidos." },
];

/** Legacy reasons arrive in English from the unsubscribe page. */
function reasonLabel(reason: string): string {
  return reason === "Opted out of marketing" ? "Se dio de baja del marketing" : reason;
}

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
  const [kind, setKind] = useState<CampaignUnsubscribedKind>("baja");
  const [counts, setCounts] = useState<CampaignUnsubscribedCounts | null>(null);
  const [data, setData] = useState<UnsubscribedPage>({ items: [], page: 1, totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (target: number) => {
    setLoading(true);
    try {
      const result = await api.unsubscribed(target, kind);
      if (!result.success) {
        setData({ items: [], page: target, totalPages: 1, total: 0 });
        return;
      }
      // Rows can disappear while browsing (recipients re-subscribing), so an
      // out-of-range page would come back empty: fall back to the last one.
      // Old backends send no counts and always list bajas only: no tabs then.
      setCounts(result.counts ?? null);
      const totalPages = Math.max(result.total_pages ?? Math.ceil(result.total / Math.max(result.page_size || 10, 1)), 1);
      const effectivePage = result.items.length === 0 && target > totalPages ? totalPages : result.page;
      if (effectivePage !== result.page) {
        await load(effectivePage);
        return;
      }
      setData({
        items: result.items.map((item, index) => ({ ...item, key: `${item.booking_id}-${item.channel}-${item.contact}-${index}` })),
        page: result.page,
        totalPages,
        total: result.total,
      });
    } finally {
      setLoading(false);
    }
  }, [api, kind]);

  useEffect(() => { void load(page); }, [page, load]);

  const go = useCallback((target: number) => setPage(target), []);

  return (
    <section className="grid gap-4 pb-24 sm:pb-0" aria-label="Bajas de campañas" data-testid="campaigns-unsubscribed-page">
      <div className="grid content-start gap-3" data-testid="campaigns-unsubscribed-panel">
        <PageToolbar
          className="mb-0 items-end"
          left={
            <div className="grid gap-1" data-testid="campaigns-unsubscribed-heading">
              <h1 className="flex flex-wrap items-center gap-2 text-xl font-bold tracking-tight" data-testid="campaigns-unsubscribed-title">
                <span className="grid size-8 place-items-center rounded-bo-sm border border-bo-border-2 bg-bo-surface-2 text-bo-accent" aria-hidden="true" data-testid="campaigns-unsubscribed-title-mark">
                  <UserX size={16} data-testid="campaigns-unsubscribed-title-icon" />
                </span>
                Bajas de campañas
                <span className="rounded-bo-full border border-bo-border-2 bg-bo-surface-2 px-2 py-0.5 text-[11px] font-semibold text-bo-muted" data-testid="campaigns-unsubscribed-count">
                  {loading ? "\u2026" : data.total}
                </span>
              </h1>
              <p className="text-xs text-bo-muted" data-testid="campaigns-unsubscribed-subtitle">Reservas que no quieren recibir más campañas</p>
            </div>
          }
          right={
            <Button variant="ghost" onClick={() => void navigate("/app/campanas")} data-testid="campaigns-unsubscribed-back-btn">
              <ArrowLeft size={16} aria-hidden="true" data-testid="campaigns-unsubscribed-back-icon" /> Volver
            </Button>
          }
          data-testid="campaigns-unsubscribed-toolbar"
        />

        {counts ? (
          <div className="-mx-1 grid gap-2 px-1" data-testid="campaigns-unsubscribed-kinds">
            <div className="flex items-center gap-2" data-testid="campaigns-unsubscribed-kind-field">
              <span className="text-xs text-bo-muted" data-testid="campaigns-unsubscribed-kind-caption">Tipo</span>
              <Select
                size="sm"
                ariaLabel="Tipo de exclusión"
                value={kind}
                onChange={(value) => {
                  setKind(value as CampaignUnsubscribedKind);
                  setPage(1);
                }}
                options={KIND_TABS.map((tab) => ({ value: tab.id, label: `${tab.label} (${counts[tab.id] ?? 0})` }))}
                data-testid="campaigns-unsubscribed-kind"
              />
            </div>
            <p className="text-xs text-bo-muted" data-testid="campaigns-unsubscribed-kind-hint">{KIND_TABS.find((tab) => tab.id === kind)?.hint}</p>
          </div>
        ) : null}

        {loading ? (
          <div className="grid content-start gap-3" data-testid="campaigns-unsubscribed-loading">
            <LoadingSpinner size="sm" label="Cargando bajas" centered testId="campaigns-unsubscribed-spinner" />
          </div>
        ) : data.items.length === 0 ? (
          <EmptyState
            variant="tailwind"
            className="p-10"
            title="Sin bajas"
            description="Cuando un cliente pulse el botón de darse de baja en una campaña, su reserva aparecerá aquí."
            data-testid="campaigns-unsubscribed-empty"
          />
        ) : (
          <>
            {/* Table from 1025px up: the cards take over below that width. */}
            <div className="hidden min-[1025px]:block overflow-hidden rounded-bo-md border border-bo-border" data-testid="campaigns-unsubscribed-table">
              <table className="w-full border-collapse text-left text-sm" data-testid="campaigns-unsubscribed-table-grid">
                <thead data-testid="campaigns-unsubscribed-thead">
                  <tr className="bg-bo-surface-2 text-[11px] uppercase tracking-wide text-bo-muted" data-testid="campaigns-unsubscribed-head-row">
                    <th className="px-4 py-2.5 font-semibold" data-testid="campaigns-unsubscribed-th-customer">Cliente</th>
                    <th className="px-4 py-2.5 font-semibold" data-testid="campaigns-unsubscribed-th-contact">Contacto</th>
                    <th className="px-4 py-2.5 font-semibold" data-testid="campaigns-unsubscribed-th-channel">Canal</th>
                    <th className="px-4 py-2.5 font-semibold" data-testid="campaigns-unsubscribed-th-date">Fecha de reserva</th>
                    <th className="px-4 py-2.5 font-semibold text-center" data-testid="campaigns-unsubscribed-th-party">Comensales</th>
                    <th className="px-4 py-2.5 font-semibold" data-testid="campaigns-unsubscribed-th-reason">Motivo</th>
                    <th className="px-4 py-2.5 font-semibold" data-testid="campaigns-unsubscribed-th-since">Baja</th>
                  </tr>
                </thead>
                <tbody data-testid="campaigns-unsubscribed-tbody">
                  {data.items.map((row) => (
                    <tr key={row.key} className="border-t border-bo-border transition-colors hover:bg-bo-surface-2" data-testid={`campaigns-unsubscribed-row-${row.key}`}>
                      <td className="px-4 py-2.5 font-medium" data-testid={`campaigns-unsubscribed-row-${row.key}-customer`}>{row.customer_name || "\u2014"}</td>
                      <td className="px-4 py-2.5 break-all text-bo-muted" data-testid={`campaigns-unsubscribed-row-${row.key}-contact`}>{row.contact || "\u2014"}</td>
                      <td className="px-4 py-2.5" data-testid={`campaigns-unsubscribed-row-${row.key}-channel`}><CampaignUnsubscribedChannel channel={row.channel} testId={`campaigns-unsubscribed-row-${row.key}-channel-chip`} /></td>
                      <td className="px-4 py-2.5 text-bo-muted" data-testid={`campaigns-unsubscribed-row-${row.key}-date`}>{row.reservation_date || "\u2014"}</td>
                      <td className="px-4 py-2.5 text-center" data-testid={`campaigns-unsubscribed-row-${row.key}-party`}>{row.party_size || "\u2014"}</td>
                      <td className="px-4 py-2.5 text-bo-muted" data-testid={`campaigns-unsubscribed-row-${row.key}-reason`}>{row.reason ? reasonLabel(row.reason) : "\u2014"}</td>
                      <td className="px-4 py-2.5 text-bo-muted" data-testid={`campaigns-unsubscribed-row-${row.key}-since`}>{row.since}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Cards up to 1024px: no table, one card per booking. */}
            <ul className="grid list-none grid-cols-1 gap-3 p-0 min-[1025px]:hidden" data-testid="campaigns-unsubscribed-cards">
              {data.items.map((row) => (
                <li key={row.key} className="w-full min-w-0" data-testid={`campaigns-unsubscribed-card-${row.key}`}>
                  <div className="grid min-w-0 gap-2 rounded-bo-md border border-bo-border bg-bo-surface p-3 text-sm" data-testid={`campaigns-unsubscribed-card-body-${row.key}`}>
                    <div className="flex min-w-0 items-start justify-between gap-2" data-testid={`campaigns-unsubscribed-card-head-${row.key}`}>
                      <span className="min-w-0 truncate font-semibold" data-testid={`campaigns-unsubscribed-card-name-${row.key}`}>
                        {row.customer_name || "Sin nombre"}
                      </span>
                      <CampaignUnsubscribedChannel channel={row.channel} testId={`campaigns-unsubscribed-card-channel-${row.key}`} />
                    </div>
                    <span className="min-w-0 break-all text-bo-muted" data-testid={`campaigns-unsubscribed-card-contact-${row.key}`}>{row.contact || "\u2014"}</span>
                    <dl className="m-0 grid grid-cols-3 gap-2 text-xs" data-testid={`campaigns-unsubscribed-card-facts-${row.key}`}>
                      <div className="grid gap-0.5" data-testid={`campaigns-unsubscribed-card-reserved-${row.key}`}>
                        <dt className="text-bo-faint" data-testid={`campaigns-unsubscribed-card-reserved-label-${row.key}`}>Reserva</dt>
                        <dd className="m-0 font-medium" data-testid={`campaigns-unsubscribed-card-reserved-value-${row.key}`}>{row.reservation_date || "\u2014"}</dd>
                      </div>
                      <div className="grid gap-0.5" data-testid={`campaigns-unsubscribed-card-party-${row.key}`}>
                        <dt className="text-bo-faint" data-testid={`campaigns-unsubscribed-card-party-label-${row.key}`}>Comensales</dt>
                        <dd className="m-0 font-medium" data-testid={`campaigns-unsubscribed-card-party-value-${row.key}`}>{row.party_size || "\u2014"}</dd>
                      </div>
                      <div className="grid gap-0.5" data-testid={`campaigns-unsubscribed-card-since-${row.key}`}>
                        <dt className="text-bo-faint" data-testid={`campaigns-unsubscribed-card-since-label-${row.key}`}>Baja</dt>
                        <dd className="m-0 font-medium" data-testid={`campaigns-unsubscribed-card-since-value-${row.key}`}>{row.since}</dd>
                      </div>
                    </dl>
                    {row.reason ? (
                      <span className="min-w-0 break-words rounded-bo-sm border border-bo-border bg-bo-surface-2 px-2 py-1 text-[11px] text-bo-muted" data-testid={`campaigns-unsubscribed-card-reason-${row.key}`}>
                        {reasonLabel(row.reason)}
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
    <nav className="flex items-center justify-between gap-2 border-t border-bo-border pt-3" aria-label="Paginación de bajas" data-testid="campaigns-unsubscribed-pager">
      <span className="text-xs text-bo-muted" data-testid="campaigns-unsubscribed-pager-status">
        Pagina {page} de {totalPages}
      </span>
      <span className="flex items-center gap-1" data-testid="campaigns-unsubscribed-pager-buttons">
        <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => onChange(page - 1)} data-testid="campaigns-unsubscribed-pager-prev" aria-label="Pagina anterior">
          <ChevronLeft size={14} aria-hidden="true" data-testid="campaigns-unsubscribed-pager-prev-icon" /> Anterior
        </Button>
        <Button variant="ghost" size="sm" disabled={page >= totalPages} onClick={() => onChange(page + 1)} data-testid="campaigns-unsubscribed-pager-next" aria-label="Pagina siguiente">
          Siguiente <ChevronRight size={14} aria-hidden="true" data-testid="campaigns-unsubscribed-pager-next-icon" />
        </Button>
      </span>
    </nav>
  );
}

function CampaignUnsubscribedChannel({ channel, testId }: { channel: string; testId: string }) {
  const ui = CHANNEL_UI[channel];
  if (!ui) return <span className="text-xs text-bo-faint" data-testid={testId}>{channel || "\u2014"}</span>;
  return (
    <span className="inline-flex items-center gap-1 text-xs text-bo-muted" data-testid={testId} data-channel={channel}>
      <ui.Icon size={13} aria-hidden="true" data-testid={`${testId}-icon`} /> {ui.label}
    </span>
  );
}
