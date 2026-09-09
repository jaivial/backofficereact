import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { navigate } from "vike/client/router";
import { Eye, FileText, Gauge, Mail, MessageCircle, Palette, PenLine, ScrollText, Send, Settings, Trash2, Users } from "lucide-react";
import type { Campaign, CampaignChannel, CampaignInput, CampaignRecipient } from "../../../../api/types";
import { Button } from "../../../../ui/actions/Button";
import { InlineAlert } from "../../../../ui/feedback/InlineAlert";
import { Panel } from "../../../../ui/shell/Panel";
import { CampaignField, CampaignFieldCell, CampaignSection, CampaignStatusBadge, CAMPAIGN_CAPTION_CLASS } from "./campaignUi";
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

  const themeKeys = [
    ["accent", "Color principal"],
    ["text", "Color texto"],
    ["surface", "Fondo tarjeta"],
    ["background", "Fondo exterior"],
  ] as const;

  return (
    <section className="grid gap-4" aria-label="Editor de campana" data-testid="campaign-editor" data-coord-id={coordId}>
      <h2 className="sr-only">Editor de campana</h2>

      {/* Header: identity on the left, status + actions on the right. Sticky on
          desktop so Guardar is always one click away while scrolling. */}
      <div
        className="grid content-start gap-3 rounded-bo-lg border border-bo-border bg-bo-shell p-3 shadow-[var(--bo-shadow-soft)] md:sticky md:top-0 md:z-30 md:flex md:items-center md:justify-between md:gap-4"
        data-testid="campaign-editor-header"
        data-observe="campaign-editor-header"
      >
        <div className="grid min-w-0 gap-1.5" data-testid="campaign-editor-title">
          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-bo-faint">
            {mode === "create" ? "Nueva campana" : "Editar campana"}
          </span>
          <span className="truncate text-lg font-semibold" data-testid="campaign-name-field" data-observe="campaign-editor-name">
            {form.name || "Campana sin nombre"}
          </span>
          <span className="truncate text-sm text-bo-muted" data-testid="campaign-subject-field" data-observe="campaign-editor-subject">
            {form.subject || "Sin asunto"}
          </span>
        </div>

        <div className="grid content-start gap-2 md:justify-items-end">
          <span className="flex flex-wrap items-center gap-2" data-testid="campaign-editor-meta">
            <CampaignStatusBadge status={campaign?.status} testId="campaign-editor-status" />
            <span className="text-xs text-bo-muted">
              {campaign ? `${campaign.stats?.sent ?? 0}/${campaign.stats?.total ?? 0} enviados` : "Borrador sin guardar"}
            </span>
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="primary" onClick={() => void save()} disabled={busy} data-testid="campaign-save-btn">
              <PenLine size={16} aria-hidden="true" /> Guardar
            </Button>
            <Button variant="secondary" onClick={() => void sendAll()} disabled={!campaign || busy} data-testid="campaign-send-btn">
              <Send size={16} aria-hidden="true" /> Enviar
            </Button>
            {campaign && (
              <Button variant="danger" aria-label="Eliminar campana" title="Eliminar campana" onClick={() => void remove()} data-testid="campaign-delete-btn">
                <Trash2 size={16} aria-hidden="true" />
              </Button>
            )}
          </div>
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
          <CampaignSection icon={<PenLine size={15} aria-hidden="true" />} title="Contenido del mensaje" helper="El texto que leera cada cliente" data-testid="campaign-content-panel">
            <RichTextEditor
              testId="campaign-richtext"
              coordId={coordId}
              value={form.body_markdown}
              onChange={(value) => patch("body_markdown", value)}
              onUploadImage={uploadImage}
              placeholder="Escribe el anuncio…"
            />
          </CampaignSection>

          <CampaignSection
            icon={<Palette size={15} aria-hidden="true" />}
            title="Estilo del email"
            helper="Colores, alineacion y tipografia del correo"
            data-testid="campaign-theme-panel"
          >
            <div className="grid content-start gap-4">
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {themeKeys.map(([key, label]) => (
                  <CampaignField key={key} label={label} data-testid={`campaign-theme-${key}-field`}>
                    <span className="flex min-w-0 items-center gap-2 rounded-bo-md border border-bo-border bg-[rgba(255,255,255,0.03)] p-1.5 transition hover:border-[var(--bo-border-2)] hover:bg-[rgba(255,255,255,0.05)]">
                      <input
                        type="color"
                        className="size-8 shrink-0 cursor-pointer rounded-bo-sm border border-bo-border-2 bg-transparent p-0"
                        value={form.theme[key]}
                        aria-label={label}
                        onChange={(e) => patch("theme", { ...form.theme, [key]: e.currentTarget.value })}
                        data-testid={`campaign-theme-${key}-input`}
                      />
                      <span className="min-w-0 truncate font-mono text-[11px] uppercase text-bo-muted">{form.theme[key]}</span>
                    </span>
                  </CampaignField>
                ))}
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <CampaignField label="Alineacion" helper="Alinea el texto del mensaje" data-testid="campaign-theme-align-field">
                  <Select
                    className="w-full"
                    value={form.theme.align}
                    onChange={(value) => patch("theme", { ...form.theme, align: value as CampaignInput["theme"]["align"] })}
                    options={[
                      { value: "left", label: "Izquierda" },
                      { value: "center", label: "Centro" },
                      { value: "right", label: "Derecha" },
                    ]}
                    ariaLabel="Alineacion del texto"
                    data-testid="campaign-theme-align-select"
                  />
                </CampaignField>
                <CampaignField label="Tipografia" helper="Fuente del cuerpo del email" data-testid="campaign-theme-font-field">
                  <Select
                    className="w-full"
                    value={form.theme.fontFamily}
                    onChange={(value) => patch("theme", { ...form.theme, fontFamily: value })}
                    options={[
                      { value: "Helvetica, Arial, sans-serif", label: "Sans" },
                      { value: "Georgia, 'Times New Roman', serif", label: "Serif" },
                      { value: "'Courier New', monospace", label: "Mono" },
                    ]}
                    ariaLabel="Tipografia del email"
                    data-testid="campaign-theme-font-select"
                  />
                </CampaignField>
                <CampaignField label="Ancho (px)" helper="Entre 320 y 900" data-testid="campaign-theme-width-field">
                  <input
                    type="number"
                    min={320}
                    max={900}
                    className="bo-input"
                    value={form.theme.maxWidth}
                    onChange={(e) => patch("theme", { ...form.theme, maxWidth: Number(e.currentTarget.value) || 600 })}
                    data-testid="campaign-theme-width-input"
                  />
                </CampaignField>
              </div>
            </div>
          </CampaignSection>
        </div>
      )}

      {tab === "preview" && (
        <div className="grid gap-4" role="tabpanel" aria-label="Previsualizacion" data-testid="campaign-tabpanel-preview">
          <Panel
            title="Previsualizacion"
            meta="El email y el WhatsApp tal y como los recibe el cliente"
            className="mx-auto h-auto w-full max-w-5xl"
            bodyClassName="grid content-start gap-3"
            data-testid="campaign-preview-panel"
          >
            <div className="flex flex-wrap items-center justify-center gap-2" data-testid="campaign-preview-device-toggle">
              <Button variant={device === "mobile" ? "primary" : "ghost"} size="sm" onClick={() => setDevice("mobile")} data-testid="campaign-preview-mobile-btn">Movil</Button>
              <Button variant={device === "desktop" ? "primary" : "ghost"} size="sm" onClick={() => setDevice("desktop")} data-testid="campaign-preview-desktop-btn">Ordenador</Button>
            </div>
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
          <CampaignSection icon={<FileText size={15} aria-hidden="true" />} title="Datos de la campana" helper="Como se guarda la campana y el asunto que lee el cliente" data-testid="campaign-data-panel">
            <div className="grid content-start gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <CampaignField label="Nombre interno" helper="Solo para el equipo, no llega al cliente" data-testid="campaign-data-name">
                  <input
                    className="bo-input h-10 w-full"
                    value={form.name}
                    placeholder="Nombre interno de la campana"
                    onChange={(e) => patch("name", e.currentTarget.value)}
                    data-testid="campaign-name-input"
                  />
                </CampaignField>
                <CampaignField label="Asunto del email" helper="Linea que el cliente ve en su bandeja" data-testid="campaign-data-subject">
                  <input
                    className="bo-input h-10 w-full"
                    value={form.subject}
                    placeholder="Asunto del email"
                    onChange={(e) => patch("subject", e.currentTarget.value)}
                    data-testid="campaign-subject-input"
                  />
                </CampaignField>
              </div>
              <div className="grid content-start gap-2">
                <span className={CAMPAIGN_CAPTION_CLASS}>Canales de envio</span>
                <div className="flex flex-wrap gap-2" data-testid="campaign-channels">
                  {CAMPAIGN_CHANNELS.map((channel) => (
                    <Button
                      key={channel.key}
                      variant={form.channels.includes(channel.key) ? "primary" : "ghost"}
                      size="sm"
                      aria-pressed={form.channels.includes(channel.key)}
                      onClick={() => toggleChannel(channel.key)}
                      data-testid={`campaign-channel-${channel.key}`}
                    >
                      {channel.key === "email" ? <Mail size={14} aria-hidden="true" /> : <MessageCircle size={14} aria-hidden="true" />}
                      {channel.label}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </CampaignSection>

          <CampaignSection
            icon={<Users size={15} aria-hidden="true" />}
            title="Destinatarios"
            helper="De donde salen los contactos y a cuantos se enviara"
            actions={
              <Button variant="ghost" size="sm" onClick={() => void loadAudience()} disabled={!campaign} data-testid="campaign-audience-refresh-btn">
                <Users size={14} aria-hidden="true" /> Calcular
              </Button>
            }
            data-testid="campaign-audience-panel"
          >
            <div className="grid content-start gap-3 md:grid-cols-2">
              <CampaignField as="div" label={<span data-testid="campaign-audience-source-caption" data-observe="campaign-audience-source-caption">Origen</span>} helper="Reservas recientes o una lista propia" data-testid="campaign-audience-source-field">
                <Select
                  className="w-full"
                  value={form.audience}
                  onChange={(value) => patch("audience", value as CampaignInput["audience"])}
                  options={AUDIENCE_SOURCE_OPTIONS}
                  ariaLabel="Origen de los destinatarios"
                  data-testid="campaign-audience-source-select"
                />
              </CampaignField>
              {form.audience === "bookings" ? (
                <CampaignFieldCell>
                  <InlineCounter
                    label="Ultimos dias"
                    value={form.audience_days}
                    min={1}
                    max={3650}
                    step={30}
                    testId="campaign-audience-days-counter"
                    onChange={(next) => patch("audience_days", next)}
                  />
                </CampaignFieldCell>
              ) : (
                <CampaignField
                  className="md:col-span-2"
                  label="Emails o telefonos (uno por linea)"
                  data-testid="campaign-audience-manual-field"
                >
                  <textarea
                    className="bo-input min-h-[110px] h-auto py-2"
                    value={form.manual_recipients.join("\n")}
                    onChange={(e) => patch("manual_recipients", e.currentTarget.value.split("\n"))}
                    data-testid="campaign-audience-manual-input"
                  />
                </CampaignField>
              )}
              <div className="flex flex-wrap items-center gap-3 md:col-span-2">
                {audience ? (
                  <span className="text-xs text-bo-muted" data-testid="campaign-audience-count">
                    {audience.total} destinos ({audience.emails} email / {audience.whatsapp} WhatsApp)
                  </span>
                ) : (
                  <span className="text-xs text-bo-faint">Pulsa Calcular para ver cuantos destinos se alcanzaran.</span>
                )}
              </div>
            </div>
          </CampaignSection>

          <CampaignSection
            icon={<Gauge size={15} aria-hidden="true" />}
            title="Ritmo de envio"
            helper="Mensajes por minuto por canal"
            data-testid="campaign-rate-panel"
          >
            <div className="grid gap-3 md:grid-cols-2">
              <CampaignFieldCell>
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
                      ? `${estimatedTime(audience.emails, form.email_per_minute, CAMPAIGN_CHANNEL_PAUSE.email)} para ${audience.emails} envios \u00b7 `
                      : ""
                  }${CAMPAIGN_RATE_NOTES.email} (${CAMPAIGN_RATE_LIMITS.email.max} por minuto)`}
                />
              </CampaignFieldCell>
              <CampaignFieldCell>
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
                      ? `${estimatedTime(audience.whatsapp, form.whatsapp_per_minute, CAMPAIGN_CHANNEL_PAUSE.whatsapp)} para ${audience.whatsapp} envios \u00b7 `
                      : ""
                  }${CAMPAIGN_RATE_NOTES.whatsapp} (un envio cada 5 min)`}
                />
              </CampaignFieldCell>
            </div>
          </CampaignSection>

          <CampaignSection icon={<Send size={15} aria-hidden="true" />} title="Envio" helper="Prueba la campana y sigue el progreso" data-testid="campaign-send-panel">
            <div className="grid content-start gap-3">
              {!campaign && <InlineAlert kind="info" title="Guarda primero" message="Guarda la campana para poder probar y enviar." />}
              <div className="grid gap-3 md:grid-cols-2">
                <div className="flex flex-wrap gap-2">
                  <input
                    className="bo-input min-w-0 flex-1"
                    placeholder="email o telefono de prueba"
                    aria-label="Destino de la prueba"
                    value={testTarget}
                    onChange={(e) => setTestTarget(e.currentTarget.value)}
                    data-testid="campaign-test-input"
                  />
                  <Button variant="ghost" onClick={() => void sendTest()} disabled={!campaign || !testTarget.trim()} data-testid="campaign-test-btn">Probar</Button>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  {campaign ? (
                    <span className="text-xs text-bo-muted" data-testid="campaign-send-progress">
                      {campaign.stats?.sent ?? 0} enviados &middot; {campaign.stats?.failed ?? 0} fallidos &middot; {campaign.stats?.pending ?? 0} pendientes
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
          </CampaignSection>

          <CampaignSection
            icon={<ScrollText size={15} aria-hidden="true" />}
            title="Registro de envios"
            helper="Reserva, canal y estado por destinatario"
            actions={
              <Button variant="ghost" size="sm" onClick={() => void loadRecipients()} disabled={!campaign} data-testid="campaign-recipients-refresh-btn">Actualizar</Button>
            }
            data-testid="campaign-recipients-panel"
          >
            {recipients.length === 0 ? (
              <p className="text-xs text-bo-faint" data-testid="campaign-recipients-empty">Sin envios registrados todavia.</p>
            ) : (
              <div className="overflow-x-auto rounded-bo-md border border-bo-border">
                <table className="bo-table w-full" data-testid="campaign-recipients-table">
                  <thead>
                    <tr>
                      <th data-testid="campaign-recipients-th-booking">Reserva</th>
                      <th data-testid="campaign-recipients-th-channel">Canal</th>
                      <th data-testid="campaign-recipients-th-target">Destino</th>
                      <th data-testid="campaign-recipients-th-status">Estado</th>
                      <th data-testid="campaign-recipients-th-sentat">Enviado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recipients.map((row) => (
                      <tr key={row.id} data-testid={`campaign-recipient-row-${row.id}`} data-booking-id={row.booking_id || ""} data-coord-id={coordId}>
                        <td>{row.booking_id || "—"}</td>
                        <td>{row.channel}</td>
                        <td className="max-w-[220px] truncate">{row.target}</td>
                        <td title={row.error}>{row.status}</td>
                        <td>{row.sent_at || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CampaignSection>
        </div>
      )}
    </section>
  );
}
