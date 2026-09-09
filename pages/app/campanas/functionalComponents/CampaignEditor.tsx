import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { navigate } from "vike/client/router";
import { Eye, Mail, MessageCircle, PenLine, Send, Settings, Trash2, Users } from "lucide-react";
import type { Campaign, CampaignChannel, CampaignInput, CampaignRecipient } from "../../../../api/types";
import { Button } from "../../../../ui/actions/Button";
import { InlineAlert } from "../../../../ui/feedback/InlineAlert";
import { Panel } from "../../../../ui/shell/Panel";
import { Tabs, type TabItem } from "../../../../ui/nav/Tabs";
import { RichTextEditor } from "../../../../ui/inputs/RichTextEditor";
import { Select } from "../../../../ui/inputs/Select";
import { InlineCounter } from "../../../../ui/widgets/InlineCounter";
import { useToasts } from "../../../../ui/feedback/useToasts";
import { apiMessage, campaignToInput, CAMPAIGN_CHANNELS, CAMPAIGN_CHANNEL_PAUSE, CAMPAIGN_RATE_LIMITS, CAMPAIGN_RATE_NOTES, createCampaignsAPI, emptyCampaignInput, estimatedTime } from "./campaignsApi";
import { CampaignPreview } from "./CampaignPreview";

/** Message of a rejected request, falling back to a copy the operator can act on. */
function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

const LIST_HREF = "/app/campanas";

export type CampaignEditorTab = "editor" | "preview" | "settings";

const CAMPAIGN_EDITOR_TABS: TabItem[] = [
  { id: "editor", label: "Editor", href: "#", icon: <PenLine size={16} aria-hidden="true" /> },
  { id: "preview", label: "Previsualizacion", href: "#", icon: <Eye size={16} aria-hidden="true" /> },
  { id: "settings", label: "Ajustes", href: "#", icon: <Settings size={16} aria-hidden="true" /> },
];

type SelectOption = { value: string; label: string };

const AUDIENCE_SOURCE_OPTIONS: SelectOption[] = [
  { value: "bookings", label: "Clientes con reserva" },
  { value: "manual", label: "Lista manual" },
];

type CampaignEditorProps = {
  mode: "create" | "edit";
  campaignId?: number;
  initialCampaign?: Campaign | null;
};

export function CampaignEditor({ mode, campaignId, initialCampaign = null }: CampaignEditorProps) {
  const api = useMemo(() => createCampaignsAPI(), []);
  const { pushToast } = useToasts();
  const [form, setForm] = useState<CampaignInput>(initialCampaign ? campaignToInput(initialCampaign) : emptyCampaignInput());
  const [campaign, setCampaign] = useState<Campaign | null>(initialCampaign);
  const [template, setTemplate] = useState<{ shell: string; bodyPlaceholder: string; brandName: string; logoUrl: string; website: string }>({
    shell: "",
    bodyPlaceholder: "",
    brandName: "",
    logoUrl: "",
    website: "",
  });
  const themeApplied = useRef(false);
  const navigated = useRef(false);
  const [device, setDevice] = useState<"mobile" | "desktop">("mobile");
  const [tab, setTab] = useState<CampaignEditorTab>("editor");
  const [audience, setAudience] = useState<{ total: number; emails: number; whatsapp: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [testTarget, setTestTarget] = useState("");
  const [recipients, setRecipients] = useState<CampaignRecipient[]>([]);
  const coordId = campaign?.coord_id ?? "camp-new";
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const patch = useCallback(<K extends keyof CampaignInput>(key: K, value: CampaignInput[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const toggleChannel = useCallback((channel: CampaignChannel) => {
    setForm((prev) => {
      const has = prev.channels.includes(channel);
      const next = has ? prev.channels.filter((c) => c !== channel) : [...prev.channels, channel];
      return { ...prev, channels: next.length ? next : prev.channels };
    });
  }, []);

  // The email shell always comes from the backend, which builds the same
  // markup it sends. It is refetched only when the theme changes; typing stays
  // fully local. A brand new campaign adopts the reference theme on first load.
  const themeKey = JSON.stringify(form.theme);
  useEffect(() => {
    const timer = setTimeout(async () => {
      const result = await api.template(mode === "create" && !themeApplied.current ? undefined : form.theme);
      if (!result.success) return;
      setTemplate({
        shell: result.shell ?? "",
        bodyPlaceholder: result.body_placeholder ?? "",
        brandName: result.brand_name ?? "",
        logoUrl: result.logo_url ?? "",
        website: result.website ?? "",
      });
      if (mode === "create" && !themeApplied.current && result.theme) {
        themeApplied.current = true;
        setForm((prev) => ({ ...prev, theme: result.theme }));
      }
    }, 250);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, mode, themeKey]);

  // Persists without leaving the page. The API client throws on non-2xx, so the
  // failure is caught here and always reported instead of dying silently.
  const persist = useCallback(async () => {
    setBusy(true);
    try {
      const result = campaign ? await api.update(campaign.id, form) : await api.create(form);
      if (!result.success || !result.campaign) throw new Error(apiMessage(result, "No se pudo guardar la campana"));
      setCampaign(result.campaign);
      pushToast({ kind: "success", title: "Campanas", message: "Campana guardada" });
      return result.campaign;
    } catch (err) {
      pushToast({ kind: "error", title: "Campanas", message: errorMessage(err, "No se pudo guardar la campana") });
      return null;
    } finally {
      setBusy(false);
    }
  }, [api, campaign, form, pushToast]);

  // Explicit save keeps the original behaviour of moving to the campaign route
  // once the campaign exists, but never twice: an image upload may already have
  // created it, in which case `campaign` is set and the route is still /nueva.
  const save = useCallback(async () => {
    const saved = await persist();
    if (saved && !navigated.current && (mode === "create" || !campaign)) {
      navigated.current = true;
      void navigate(`${LIST_HREF}/${saved.id}`);
    }
    return saved;
  }, [campaign, mode, persist]);

  const uploadImage = useCallback(
    async (file: File) => {
      try {
        // A brand new campaign needs an id first, but navigating here would
        // unmount the editor mid-upload and the markdown would never land in
        // the body: persist without navigating and stay on the same instance.
        const target = campaign ?? (await persist());
        if (!target) throw new Error("No se pudo guardar la campana antes de subir la imagen");
        const result = await api.uploadImage(target.id, file);
        if (!result.success || !result.url) throw new Error(apiMessage(result, "No se pudo subir la imagen"));
        return result.url;
      } catch (err) {
        const message = errorMessage(err, "No se pudo subir la imagen");
        pushToast({ kind: "error", title: "Imagen", message });
        throw new Error(message);
      }
    },
    [api, campaign, persist, pushToast],
  );

  const loadAudience = useCallback(async () => {
    if (!campaign) return;
    const result = await api.audience(campaign.id);
    if (result.success) setAudience({ total: result.total, emails: result.emails, whatsapp: result.whatsapp });
  }, [api, campaign]);

  const loadRecipients = useCallback(async () => {
    if (!campaign) return;
    const result = await api.recipients(campaign.id);
    if (result.success) setRecipients(result.recipients ?? []);
  }, [api, campaign]);

  const sendTest = useCallback(async () => {
    if (!campaign || !testTarget.trim()) return;
    const channel: CampaignChannel = testTarget.includes("@") ? "email" : "whatsapp";
    const result = await api.test(campaign.id, channel, testTarget.trim());
    pushToast({
      kind: result.success ? "success" : "error",
      title: "Prueba",
      message: result.success ? `Enviado por ${channel}` : apiMessage(result, "No se pudo enviar la prueba"),
    });
  }, [api, campaign, pushToast, testTarget]);

  const sendAll = useCallback(async () => {
    if (!campaign) return;
    setBusy(true);
    try {
      const result = await api.send(campaign.id);
      if (!result.success) {
        pushToast({ kind: "error", title: "Envio", message: apiMessage(result, "No se pudo iniciar el envio") });
        return;
      }
      pushToast({ kind: "success", title: "Envio", message: `Encolados ${result.queued} destinatarios` });
      pollRef.current = setInterval(async () => {
        const status = await api.status(campaign.id);
        if (!status.success) return;
        setCampaign((prev) => (prev ? { ...prev, status: status.status as Campaign["status"], stats: status.stats } : prev));
        void loadRecipients();
        if (status.status === "sent" && pollRef.current) clearInterval(pollRef.current);
      }, 3000);
    } finally {
      setBusy(false);
    }
  }, [api, campaign, loadRecipients, pushToast]);

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);
  useEffect(() => { void loadRecipients(); }, [loadRecipients]);

  const remove = useCallback(async () => {
    if (!campaign) return;
    const result = await api.remove(campaign.id);
    if (result.success) void navigate(LIST_HREF);
  }, [api, campaign]);

  return (
    <section className="grid gap-4" aria-label="Editor de campana" data-testid="campaign-editor" data-coord-id={coordId}>
      <div className="flex flex-wrap items-center justify-between gap-3" data-testid="campaign-editor-header">
        <div className="grid gap-0.5">
          <h2 className="text-lg font-semibold" data-testid="campaign-editor-title">
            {mode === "create" ? "Nueva campana" : form.name || "Campana"}
          </h2>
          <span className="text-sm opacity-70" data-testid="campaign-editor-meta">
            {campaign ? `${campaign.status} · ${campaign.stats?.sent ?? 0}/${campaign.stats?.total ?? 0} enviados` : "Borrador"}
          </span>
        </div>
        <div className="flex gap-2">
          <Button variant="primary" onClick={() => void save()} disabled={busy} data-testid="campaign-save-btn">Guardar</Button>
          {campaign && (
            <Button variant="danger" onClick={() => void remove()} data-testid="campaign-delete-btn">
              <Trash2 size={16} aria-hidden="true" />
            </Button>
          )}
        </div>
      </div>

      <Tabs
        mode="button"
        className="mx-auto"
        ariaLabel="Secciones de la campana"
        layoutId="campaignEditorTabs"
        activeId={tab}
        onNavigate={(_href, id) => setTab(id as CampaignEditorTab)}
        tabs={CAMPAIGN_EDITOR_TABS}
      />

      {tab === "editor" && (
        <div className="grid gap-4" role="tabpanel" aria-label="Editor" data-testid="campaign-tabpanel-editor">
          <Panel title="Contenido" data-testid="campaign-content-panel">
            <RichTextEditor
              testId="campaign-richtext"
              coordId={coordId}
              value={form.body_markdown}
              onChange={(value) => patch("body_markdown", value)}
              onUploadImage={uploadImage}
              placeholder="Escribe el anuncio…"
            />
          </Panel>

          <Panel title="Estilo del email" data-testid="campaign-theme-panel">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {([
                ["accent", "Color principal"],
                ["text", "Color texto"],
                ["surface", "Fondo tarjeta"],
                ["background", "Fondo exterior"],
              ] as const).map(([key, label]) => (
                <label key={key} className="grid gap-1 text-sm" data-testid={`campaign-theme-${key}-field`}>
                  {label}
                  <input
                    type="color"
                    value={form.theme[key]}
                    onChange={(e) => patch("theme", { ...form.theme, [key]: e.currentTarget.value })}
                    data-testid={`campaign-theme-${key}-input`}
                  />
                </label>
              ))}
              <label className="grid gap-1 text-sm" data-testid="campaign-theme-align-field">
                Alineacion
                <select
                  className="bo-input"
                  value={form.theme.align}
                  onChange={(e) => patch("theme", { ...form.theme, align: e.currentTarget.value as CampaignInput["theme"]["align"] })}
                  data-testid="campaign-theme-align-select"
                >
                  <option value="left">Izquierda</option>
                  <option value="center">Centro</option>
                  <option value="right">Derecha</option>
                </select>
              </label>
              <label className="grid gap-1 text-sm" data-testid="campaign-theme-font-field">
                Tipografia
                <select
                  className="bo-input"
                  value={form.theme.fontFamily}
                  onChange={(e) => patch("theme", { ...form.theme, fontFamily: e.currentTarget.value })}
                  data-testid="campaign-theme-font-select"
                >
                  <option value="Helvetica, Arial, sans-serif">Sans</option>
                  <option value="Georgia, 'Times New Roman', serif">Serif</option>
                  <option value="'Courier New', monospace">Mono</option>
                </select>
              </label>
              <label className="grid gap-1 text-sm" data-testid="campaign-theme-width-field">
                Ancho (px)
                <input
                  type="number"
                  min={320}
                  max={900}
                  className="bo-input"
                  value={form.theme.maxWidth}
                  onChange={(e) => patch("theme", { ...form.theme, maxWidth: Number(e.currentTarget.value) || 600 })}
                  data-testid="campaign-theme-width-input"
                />
              </label>
            </div>
          </Panel>
        </div>
      )}

      {tab === "preview" && (
        <div className="grid gap-4" role="tabpanel" aria-label="Previsualizacion" data-testid="campaign-tabpanel-preview">
          <Panel
            title="Previsualizacion"
            actions={
              <div className="flex gap-2">
                <Button variant={device === "mobile" ? "primary" : "ghost"} size="sm" onClick={() => setDevice("mobile")} data-testid="campaign-preview-mobile-btn">Movil</Button>
                <Button variant={device === "desktop" ? "primary" : "ghost"} size="sm" onClick={() => setDevice("desktop")} data-testid="campaign-preview-desktop-btn">Ordenador</Button>
              </div>
            }
            className="mx-auto h-auto w-full max-w-5xl"
            data-testid="campaign-preview-panel"
          >
            <CampaignPreview
              markdown={form.body_markdown}
              theme={form.theme}
              shell={template.shell}
              bodyPlaceholder={template.bodyPlaceholder}
              device={device}
              brandName={template.brandName}
              logoUrl={template.logoUrl}
              websiteUrl={template.website}
              coordId={coordId}
            />
          </Panel>
        </div>
      )}

      {tab === "settings" && (
        <div className="grid gap-4" role="tabpanel" aria-label="Ajustes" data-testid="campaign-tabpanel-settings">
          <Panel title="Datos de la campana" data-testid="campaign-data-panel">
            <div className="grid gap-3 md:grid-cols-2">
              <label className="grid gap-1 text-sm" data-testid="campaign-name-field">
                Nombre interno
                <input className="bo-input" value={form.name} onChange={(e) => patch("name", e.currentTarget.value)} data-testid="campaign-name-input" />
              </label>
              <label className="grid gap-1 text-sm" data-testid="campaign-subject-field">
                Asunto del email
                <input className="bo-input" value={form.subject} onChange={(e) => patch("subject", e.currentTarget.value)} data-testid="campaign-subject-input" />
              </label>
            </div>

            <div className="mt-3 flex flex-wrap gap-2" data-testid="campaign-channels">
              {CAMPAIGN_CHANNELS.map((channel) => (
                <Button
                  key={channel.key}
                  variant={form.channels.includes(channel.key) ? "primary" : "ghost"}
                  size="sm"
                  onClick={() => toggleChannel(channel.key)}
                  data-testid={`campaign-channel-${channel.key}`}
                >
                  {channel.key === "email" ? <Mail size={14} aria-hidden="true" /> : <MessageCircle size={14} aria-hidden="true" />}
                  {channel.label}
                </Button>
              ))}
            </div>
          </Panel>

          <Panel title="Destinatarios" data-testid="campaign-audience-panel">
            <div className="grid gap-3 md:grid-cols-3">
              <div
                className="grid gap-1 text-sm"
                data-testid="campaign-audience-source-field"
                data-observe="campaign-audience-source-field"
              >
                <span data-testid="campaign-audience-source-caption" data-observe="campaign-audience-source-caption">
                  Origen
                </span>
                <Select
                  className="w-full"
                  value={form.audience}
                  onChange={(value) => patch("audience", value as CampaignInput["audience"])}
                  options={AUDIENCE_SOURCE_OPTIONS}
                  ariaLabel="Origen de los destinatarios"
                  data-testid="campaign-audience-source-select"
                />
              </div>
              {form.audience === "bookings" ? (
                <InlineCounter
                  label="Ultimos dias"
                  value={form.audience_days}
                  min={1}
                  max={3650}
                  step={30}
                  testId="campaign-audience-days-counter"
                  onChange={(next) => patch("audience_days", next)}
                />
              ) : (
                <label className="grid gap-1 text-sm md:col-span-2" data-testid="campaign-audience-manual-field">
                  Emails o telefonos (uno por linea)
                  <textarea
                    className="bo-input min-h-[110px]"
                    value={form.manual_recipients.join("\n")}
                    onChange={(e) => patch("manual_recipients", e.currentTarget.value.split("\n"))}
                    data-testid="campaign-audience-manual-input"
                  />
                </label>
              )}
              <div className="flex items-end gap-2">
                <Button variant="ghost" onClick={() => void loadAudience()} disabled={!campaign} data-testid="campaign-audience-refresh-btn">
                  <Users size={16} aria-hidden="true" /> Calcular
                </Button>
                {audience && (
                  <span className="text-sm" data-testid="campaign-audience-count">
                    {audience.total} destinos ({audience.emails} email / {audience.whatsapp} WhatsApp)
                  </span>
                )}
              </div>
            </div>
          </Panel>

          <Panel title="Ritmo de envio" meta="Mensajes por minuto por canal" data-testid="campaign-rate-panel">
            <div className="grid gap-3 md:grid-cols-2">
              <InlineCounter
                label={`Emails por minuto (max ${CAMPAIGN_RATE_LIMITS.email.max})`}
                value={form.email_per_minute}
                min={CAMPAIGN_RATE_LIMITS.email.min}
                max={CAMPAIGN_RATE_LIMITS.email.max}
                step={5}
                testId="campaign-rate-email-counter"
                onChange={(next) => patch("email_per_minute", next)}
                helperText={`${
                  audience
                    ? `${estimatedTime(audience.emails, form.email_per_minute, CAMPAIGN_CHANNEL_PAUSE.email)} para ${audience.emails} envios · `
                    : ""
                }${CAMPAIGN_RATE_NOTES.email} (${CAMPAIGN_RATE_LIMITS.email.max} por minuto)`}
              />
              <InlineCounter
                label={`WhatsApp por minuto (max ${CAMPAIGN_RATE_LIMITS.whatsapp.max})`}
                value={form.whatsapp_per_minute}
                min={CAMPAIGN_RATE_LIMITS.whatsapp.min}
                max={CAMPAIGN_RATE_LIMITS.whatsapp.max}
                step={1}
                testId="campaign-rate-whatsapp-counter"
                onChange={(next) => patch("whatsapp_per_minute", next)}
                helperText={`${
                  audience
                    ? `${estimatedTime(audience.whatsapp, form.whatsapp_per_minute, CAMPAIGN_CHANNEL_PAUSE.whatsapp)} para ${audience.whatsapp} envios · `
                    : ""
                }${CAMPAIGN_RATE_NOTES.whatsapp} (un envio cada 5 min)`}
              />
            </div>
          </Panel>

          <Panel title="Envio" data-testid="campaign-send-panel">
            {!campaign && <InlineAlert kind="info" title="Guarda primero" message="Guarda la campana para poder probar y enviar." />}
            <div className="mt-2 grid gap-3 md:grid-cols-2">
              <div className="flex gap-2">
                <input
                  className="bo-input flex-1"
                  placeholder="email o telefono de prueba"
                  value={testTarget}
                  onChange={(e) => setTestTarget(e.currentTarget.value)}
                  data-testid="campaign-test-input"
                />
                <Button variant="ghost" onClick={() => void sendTest()} disabled={!campaign} data-testid="campaign-test-btn">Probar</Button>
              </div>
              <div className="flex items-center gap-3">
                <Button variant="primary" onClick={() => void sendAll()} disabled={!campaign || busy} data-testid="campaign-send-btn">
                  <Send size={16} aria-hidden="true" /> Enviar a todos
                </Button>
                {campaign && (
                  <span className="text-sm" data-testid="campaign-send-progress">
                    {campaign.stats?.sent ?? 0} enviados · {campaign.stats?.failed ?? 0} fallidos · {campaign.stats?.pending ?? 0} pendientes
                  </span>
                )}
              </div>
            </div>
          </Panel>

          <Panel
            title="Registro de envios"
            meta="Reserva, canal y estado por destinatario"
            actions={<Button variant="ghost" size="sm" onClick={() => void loadRecipients()} disabled={!campaign} data-testid="campaign-recipients-refresh-btn">Actualizar</Button>}
            data-testid="campaign-recipients-panel"
          >
            {recipients.length === 0 ? (
              <p className="text-sm opacity-70" data-testid="campaign-recipients-empty">Sin envios registrados todavia.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm" data-testid="campaign-recipients-table">
                  <thead>
                    <tr>
                      <th className="text-left" data-testid="campaign-recipients-th-booking">Reserva</th>
                      <th className="text-left" data-testid="campaign-recipients-th-channel">Canal</th>
                      <th className="text-left" data-testid="campaign-recipients-th-target">Destino</th>
                      <th className="text-left" data-testid="campaign-recipients-th-status">Estado</th>
                      <th className="text-left" data-testid="campaign-recipients-th-sentat">Enviado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recipients.map((row) => (
                      <tr key={row.id} data-testid={`campaign-recipient-row-${row.id}`} data-booking-id={row.booking_id || ""} data-coord-id={coordId}>
                        <td>{row.booking_id || "—"}</td>
                        <td>{row.channel}</td>
                        <td>{row.target}</td>
                        <td title={row.error}>{row.status}</td>
                        <td>{row.sent_at || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </div>
      )}
    </section>
  );
}
