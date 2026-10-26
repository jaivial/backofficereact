import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { navigate } from "vike/client/router";
import { Eye, FileText, Gauge, Mail, MessageCircle, PenLine, ScrollText, Send, Settings, Trash2, Users, Workflow } from "lucide-react";
import type { Campaign, CampaignChannel, CampaignInput, CampaignRecipient } from "../../../../api/types";
import { Button } from "../../../../ui/actions/Button";
import { InlineAlert } from "../../../../ui/feedback/InlineAlert";
import { Panel } from "../../../../ui/shell/Panel";
import { CampaignField, CampaignFieldCell, CampaignSection, CampaignStatusBadge, CAMPAIGN_CAPTION_CLASS } from "./campaignUi";
import { Tabs, type TabItem } from "../../../../ui/nav/Tabs";
import { Select } from "../../../../ui/inputs/Select";
import { InlineCounter } from "../../../../ui/widgets/InlineCounter";
import { useToasts } from "../../../../ui/feedback/useToasts";
import { apiMessage, campaignToInput, CAMPAIGN_CHANNELS, CAMPAIGN_CHANNEL_PAUSE, CAMPAIGN_RATE_LIMITS, CAMPAIGN_RATE_NOTES, createCampaignsAPI, emptyCampaignInput, estimatedTime } from "./campaignsApi";
import { CampaignFlowCanvas, type CampaignFlowSection } from "./CampaignFlowCanvas";
import { EmailBuilder } from "./builder/EmailBuilder";
import { defaultDesign, legacyDesign, type BlockContext } from "./builder/emailBuilderBlocks";
import { compileCampaignEmail, designToWhatsAppMarkdown, fillPreviewPlaceholders } from "./builder/emailBuilderCompile";
import { DeviceSwitch, EmailPreviewFrame } from "./builder/EmailPreviewFrame";
import type { BuilderDevice } from "./builder/EmailBuilderCanvas";
import { renderCampaignEmailBody } from "./campaignEmailBody";
import { IPhoneFrame, IPHONE_DEFAULT_TIME } from "./IPhoneFrame";
import { WhatsAppPreview } from "./WhatsAppPreview";

/** Message of a rejected request, falling back to a copy the operator can act on. */
function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

const LIST_HREF = "/app/campanas";

export type CampaignEditorTab = "flow" | "editor" | "preview" | "settings";

const CAMPAIGN_EDITOR_TABS: TabItem[] = [
  { id: "flow", label: "Flujo", href: "#", icon: <Workflow size={16} aria-hidden="true" /> },
  { id: "editor", label: "Diseño", href: "#", icon: <PenLine size={16} aria-hidden="true" /> },
  { id: "preview", label: "Previsualización", href: "#", icon: <Eye size={16} aria-hidden="true" /> },
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
  const [template, setTemplate] = useState<{ loaded: boolean; brandName: string; logoUrl: string; website: string; unsubscribeUrl: string }>({
    loaded: false,
    brandName: "",
    logoUrl: "",
    website: "",
    unsubscribeUrl: "",
  });
  const themeApplied = useRef(false);
  const navigated = useRef(false);
  const [device, setDevice] = useState<BuilderDevice>("desktop");
  const [previewEmail, setPreviewEmail] = useState<{ html: string; error: string }>({ html: "", error: "" });
  const [tab, setTab] = useState<CampaignEditorTab>("flow");
  const [audience, setAudience] = useState<{ total: number; emails: number; whatsapp: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [testTarget, setTestTarget] = useState("");
  const [recipients, setRecipients] = useState<CampaignRecipient[]>([]);
  // Snapshot of the last persisted form: "Enviar" sends the saved campaign, so
  // it must stay disabled while the editor holds unsaved changes.
  const savedFormRef = useRef<string>(JSON.stringify(initialCampaign ? campaignToInput(initialCampaign) : null));
  const coordId = campaign?.coord_id ?? "camp-new";
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Flujo -> editor: pulsar un nodo del grafo abre su seccion del editor.
  const jumpToSection = useCallback((section: CampaignFlowSection) => {
    setTab("editor");
    window.setTimeout(() => {
      document.querySelector(`[data-testid="${section}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 60);
  }, []);

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

  // Brand of the restaurant (name, logo, website, preview opt-out link) for the
  // builder blocks and the previews. A brand new campaign adopts the reference
  // theme (its accent colours the default design). A failed fetch still opens
  // the builder, just without brand data.
  useEffect(() => {
    let alive = true;
    api
      .template(mode === "create" && !themeApplied.current ? undefined : form.theme)
      .then((result) => {
        if (!alive) return;
        const ok = result.success;
        setTemplate({
          loaded: true,
          brandName: ok ? result.brand_name ?? "" : "",
          logoUrl: ok ? result.logo_url ?? "" : "",
          website: ok ? result.website ?? "" : "",
          unsubscribeUrl: ok ? result.unsubscribe_url ?? "" : "",
        });
        if (ok && mode === "create" && !themeApplied.current && result.theme) {
          themeApplied.current = true;
          setForm((prev) => ({ ...prev, theme: result.theme }));
        }
      })
      .catch(() => alive && setTemplate((prev) => ({ ...prev, loaded: true })));
    return () => {
      alive = false;
    };
  }, [api, mode]);

  // Persists without leaving the page. The API client throws on non-2xx, so the
  // failure is caught here and always reported instead of dying silently.
  const persist = useCallback(async () => {
    setBusy(true);
    try {
      // The email SMTP sends is compiled from the design on every save, so the
      // stored email_html can never drift from body_html (campaign_html_builder_v1).
      const emailHtml = form.body_html ? await compileCampaignEmail(form.body_html, form.subject || form.name, coordId) : "";
      const payload: CampaignInput = { ...form, email_html: emailHtml };
      const result = campaign ? await api.update(campaign.id, payload) : await api.create(payload);
      if (!result.success || !result.campaign) throw new Error(apiMessage(result, "No se pudo guardar la campaña"));
      savedFormRef.current = JSON.stringify(form);
      setCampaign(result.campaign);
      pushToast({ kind: "success", title: "Campañas", message: "Campaña guardada" });
      return result.campaign;
    } catch (err) {
      pushToast({ kind: "error", title: "Campañas", message: errorMessage(err, "No se pudo guardar la campaña") });
      return null;
    } finally {
      setBusy(false);
    }
  }, [api, campaign, coordId, form, pushToast]);

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
        if (!target) throw new Error("No se pudo guardar la campaña antes de subir la imagen");
        const result = await api.uploadImage(target.id, file);
        if (!result.success || !result.url) throw new Error(apiMessage(result, "No se pudo subir la imagen"));
        return result.url;
      } catch (err) {
        const message = errorMessage(err, "No se pudo subir la imagen");
        pushToast({ kind: "error", title: "Imagen", message });
        throw new Error(message, { cause: err });
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
        pushToast({ kind: "error", title: "Envío", message: apiMessage(result, "No se pudo iniciar el envío") });
        return;
      }
      pushToast({ kind: "success", title: "Envío", message: `Encolados ${result.queued} destinatarios` });
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

  const hasUnsavedChanges = campaign !== null && JSON.stringify(form) !== savedFormRef.current;

  // Brand data every builder block and the AI start from.
  const blockContext = useMemo<BlockContext>(
    () => ({ brandName: template.brandName, logoUrl: template.logoUrl, websiteUrl: template.website, accent: form.theme.accent }),
    [form.theme.accent, template.brandName, template.logoUrl, template.website],
  );

  // The design is the source of truth: the WhatsApp text is derived from it on
  // every change so both channels always carry the same message.
  const setDesign = useCallback((html: string) => {
    setForm((prev) => ({ ...prev, body_html: html, body_markdown: designToWhatsAppMarkdown(html) }));
  }, []);

  // Campaigns without a design get one once the brand is known: a new campaign
  // starts from the default template, an older one keeps its message inside it.
  useEffect(() => {
    if (!template.loaded || form.body_html) return;
    const legacy = campaign && form.body_markdown.trim() ? renderCampaignEmailBody(form.body_markdown, form.theme) : "";
    setDesign(legacy ? legacyDesign(blockContext, legacy) : defaultDesign(blockContext));
  }, [template.loaded]);

  // Preview tab: the exact email SMTP will send, compiled from the design.
  useEffect(() => {
    if (tab !== "preview" || !form.body_html) return;
    let alive = true;
    compileCampaignEmail(form.body_html, form.subject || form.name || "Campaña", coordId)
      .then((html) => alive && setPreviewEmail({ html: fillPreviewPlaceholders(html, template.unsubscribeUrl), error: "" }))
      .catch((err) => alive && setPreviewEmail({ html: "", error: errorMessage(err, "No se pudo compilar el email") }));
    return () => {
      alive = false;
    };
  }, [coordId, form.body_html, form.name, form.subject, tab, template.unsubscribeUrl]);

  return (
    <section className="grid min-w-0 gap-4 pb-24 sm:pb-0" aria-label="Editor de campana" data-testid="campaign-editor" data-coord-id={coordId}>
      <h2 className="sr-only">Editor de campaña</h2>

      {/* Header: identity on the left, status + actions on the right. Sticky on
          desktop so Guardar is always one click away while scrolling. */}
      <div
        className="grid content-start gap-2 rounded-bo-lg border border-bo-border bg-bo-shell p-3 shadow-[var(--bo-shadow-soft)] md:sticky md:top-0 md:z-30 md:flex md:items-center md:justify-between md:gap-4"
        data-testid="campaign-editor-header"
        data-observe="campaign-editor-header"
      >
        <div className="grid min-w-0 gap-1.5" data-testid="campaign-editor-title">
          <span className="hidden text-[11px] font-semibold uppercase tracking-[0.08em] text-bo-faint sm:block">
            {mode === "create" ? "Nueva campaña" : "Editar campaña"}
          </span>
          <span className="truncate text-base font-semibold sm:text-lg" data-testid="campaign-name-field" data-observe="campaign-editor-name">
            {form.name || "Campaña sin nombre"}
          </span>
          <span className="hidden truncate text-sm text-bo-muted sm:block" data-testid="campaign-subject-field" data-observe="campaign-editor-subject">
            {form.subject || "Sin asunto"}
          </span>
        </div>

        <div className="grid content-start gap-2 md:justify-items-end">
          <span className="flex flex-wrap items-center gap-2" data-testid="campaign-editor-meta">
            <CampaignStatusBadge status={campaign?.status} testId="campaign-editor-status" />
            <span className="text-xs text-bo-text" data-observe="campaign-editor-meta-progress">
              {campaign ? `${campaign.stats?.sent ?? 0}/${campaign.stats?.total ?? 0} enviados` : "Borrador sin guardar"}
            </span>
          </span>
          <div className="grid w-full grid-cols-[1fr_1fr_auto] items-center gap-2 sm:flex sm:w-auto sm:flex-wrap" data-testid="campaign-editor-actions">
            <Button variant="primary" className="min-h-11 justify-center sm:min-h-0" onClick={() => void save()} disabled={busy} data-testid="campaign-save-btn">
              <PenLine size={16} aria-hidden="true" /> Guardar
            </Button>
            <Button
              variant="secondary"
              className="min-h-11 justify-center sm:min-h-0"
              onClick={() => void sendAll()}
              disabled={!campaign || busy || hasUnsavedChanges}
              title={hasUnsavedChanges ? "Guarda los cambios antes de enviar" : undefined}
              data-testid="campaign-send-btn"
            >
              <Send size={16} aria-hidden="true" /> Enviar
            </Button>
            {campaign && (
              <Button variant="danger" className="min-h-11 min-w-11 sm:min-h-0 sm:min-w-0" aria-label="Eliminar campana" title="Eliminar campana" onClick={() => void remove()} data-testid="campaign-delete-btn">
                <Trash2 size={16} aria-hidden="true" />
              </Button>
            )}
          </div>
        </div>
      </div>

      <Tabs
        mode="button"
        className="mx-auto w-full max-w-full justify-between [&_.bo-tabLabel]:inline [&_.bo-tabLabel]:text-xs min-[896px]:[&_.bo-tabLabel]:text-sm [&_.bo-tab]:min-w-0 [&_.bo-tab]:px-2 [&_.bo-tabIcon]:hidden min-[896px]:[&_.bo-tabIcon]:inline-flex"
        ariaLabel="Secciones de la campaña"
        layoutId="campaignEditorTabs"
        activeId={tab}
        onNavigate={(_href, id) => setTab(id as CampaignEditorTab)}
        tabs={CAMPAIGN_EDITOR_TABS}
      />

      {tab === "flow" && (
        <div role="tabpanel" aria-label="Flujo" data-testid="campaign-tabpanel-flow">
          <CampaignFlowCanvas
            form={form}
            audience={audience}
            status={campaign?.status ?? null}
            onEdit={jumpToSection}
          />
        </div>
      )}

      {tab === "editor" && (
        <div className="min-w-0" role="tabpanel" aria-label="Diseño" data-testid="campaign-tabpanel-editor">
          <EmailBuilder
            value={form.body_html ?? ""}
            onChange={setDesign}
            context={blockContext}
            subject={form.subject || form.name}
            coordId={coordId}
            unsubscribePreviewUrl={template.unsubscribeUrl}
            onUploadImage={uploadImage}
          />
        </div>
      )}

      {tab === "preview" && (
        <div className="eb-scope grid gap-4" role="tabpanel" aria-label="Previsualización" data-testid="campaign-tabpanel-preview">
          <Panel
            title="Previsualización"
            meta="El email y el WhatsApp tal y como los recibe el cliente"
            className="mx-auto h-auto w-full max-w-6xl"
            bodyClassName="grid content-start gap-4"
            data-testid="campaign-preview-panel"
          >
            <div className="flex flex-wrap items-center justify-center gap-2" data-testid="campaign-preview-device-toggle">
              <DeviceSwitch value={device} onChange={setDevice} testId="campaign-preview-device" />
            </div>
            <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_auto]" data-testid="campaign-preview-live" data-coord-id={coordId} data-observe="campaign-preview">
              <figure className="m-0 grid min-w-0 gap-2" data-testid="campaign-preview-email-block">
                <figcaption className="text-center text-sm font-semibold" data-testid="campaign-preview-email-label">Email</figcaption>
                {previewEmail.html ? (
                  <EmailPreviewFrame html={previewEmail.html} device={device} testId="campaign-preview-email" />
                ) : (
                  <p className="m-0 p-6 text-center text-sm text-bo-muted" data-testid="campaign-preview-email-wait">{previewEmail.error || "Compilando el email…"}</p>
                )}
              </figure>
              <figure className="m-0 grid content-start justify-items-center gap-2" data-testid="campaign-preview-whatsapp-block">
                <figcaption className="text-center text-sm font-semibold" data-testid="campaign-preview-whatsapp-label">WhatsApp</figcaption>
                <IPhoneFrame title={`WhatsApp ${template.brandName || "Restaurante"}`} time={IPHONE_DEFAULT_TIME} testId="campaign-preview-whatsapp-device">
                  <WhatsAppPreview
                    markdown={form.body_markdown}
                    brandName={template.brandName}
                    logoUrl={template.logoUrl}
                    websiteUrl={template.website}
                    unsubscribeUrl={template.unsubscribeUrl}
                    accent={form.theme.accent}
                    time={IPHONE_DEFAULT_TIME}
                    coordId={coordId}
                  />
                </IPhoneFrame>
              </figure>
            </div>
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
                    placeholder="Nombre interno de la campaña"
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
                    label="Últimos días"
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

          <CampaignSection icon={<Send size={15} aria-hidden="true" />} title="Envío" helper="Prueba la campaña y sigue el progreso" data-testid="campaign-send-panel">
            <div className="grid content-start gap-3">
              {!campaign && <InlineAlert kind="info" title="Guarda primero" message="Guarda la campaña para poder probar y enviar." />}
              <div className="grid gap-3 md:grid-cols-2">
                <div className="grid gap-2 sm:flex sm:flex-wrap">
                  <input
                    className="bo-input min-w-0 sm:flex-1"
                    placeholder="email o teléfono de prueba"
                    aria-label="Destino de la prueba"
                    value={testTarget}
                    onChange={(e) => setTestTarget(e.currentTarget.value)}
                    data-testid="campaign-test-input"
                  />
                  <Button variant="ghost" className="min-h-11 w-full justify-center sm:min-h-0 sm:w-auto" onClick={() => void sendTest()} disabled={!campaign || !testTarget.trim()} data-testid="campaign-test-btn">Probar</Button>
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
              <>
              <ul className="m-0 grid list-none gap-2 p-0 md:hidden" data-testid="campaign-recipients-cards">
                {recipients.map((row) => (
                  <li key={row.id} className="grid gap-1 rounded-bo-md border border-bo-border bg-bo-surface-2 p-3 text-sm" title={row.error || undefined} data-testid={`campaign-recipient-card-${row.id}`}>
                    <span className="break-all font-medium">{row.target}</span>
                    <span className="flex flex-wrap items-center justify-between gap-2 text-xs text-bo-muted">
                      <span>{row.channel === "whatsapp" ? "WhatsApp" : "Email"} &middot; {row.status === "sent" ? "Enviado" : row.status === "failed" ? "Fallido" : "Pendiente"}</span>
                      <span>{row.sent_at || "Sin enviar"}{row.booking_id ? ` \u00b7 Reserva ${row.booking_id}` : ""}</span>
                    </span>
                  </li>
                ))}
              </ul>
              <div className="hidden overflow-x-auto rounded-bo-md border border-bo-border md:block">
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
              </>
            )}
          </CampaignSection>
        </div>
      )}
    </section>
  );
}
