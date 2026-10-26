import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { navigate } from "vike/client/router";
import { Eye, FileText, Gauge, Mail, MessageCircle, PenLine, RefreshCw, ScrollText, Send, Settings, Users, Workflow } from "lucide-react";
import type { Campaign, CampaignChannel, CampaignInput, CampaignRecipient } from "../../../../api/types";
import { Button } from "../../../../ui/actions/Button";
import { InlineAlert } from "../../../../ui/feedback/InlineAlert";
import { Panel } from "../../../../ui/shell/Panel";
import { ConfirmDialog } from "../../../../ui/overlays/ConfirmDialog";
import { CampaignField, CampaignFieldCell, CampaignSection, campaignAudienceSummary, CAMPAIGN_CAPTION_CLASS } from "./campaignUi";
import { Tabs, type TabItem } from "../../../../ui/nav/Tabs";
import { Select } from "../../../../ui/inputs/Select";
import { InlineCounter } from "../../../../ui/widgets/InlineCounter";
import { useToasts } from "../../../../ui/feedback/useToasts";
import { apiMessage, campaignToInput, CAMPAIGN_CHANNELS, CAMPAIGN_CHANNEL_PAUSE, CAMPAIGN_RATE_LIMITS, CAMPAIGN_RATE_NOTES, createCampaignsAPI, emptyCampaignInput, estimatedTime } from "./campaignsApi";
import { CampaignFlowCanvas, type CampaignFlowSection } from "./CampaignFlowCanvas";
import { CampaignEditorHeader, type CampaignSaveState } from "./CampaignEditorHeader";
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

/** Editor tabs, also the `?tab=` value of the editor URL. */
export type CampaignEditorTab = "flujo" | "diseno" | "previsualizacion" | "ajustes";

const CAMPAIGN_EDITOR_TABS: { id: CampaignEditorTab; label: string; Icon: typeof Workflow }[] = [
  { id: "flujo", label: "Flujo", Icon: Workflow },
  { id: "diseno", label: "Diseño", Icon: PenLine },
  { id: "previsualizacion", label: "Previsualización", Icon: Eye },
  { id: "ajustes", label: "Ajustes", Icon: Settings },
];

/** Tab named by the `?tab=` query; anything else opens the flow. */
export function campaignEditorTab(raw: unknown): CampaignEditorTab {
  return CAMPAIGN_EDITOR_TABS.find((t) => t.id === raw)?.id ?? "flujo";
}

/** Tab holding the section a flow node points to. */
const SECTION_TAB: Record<CampaignFlowSection, CampaignEditorTab> = {
  "campaign-content-panel": "diseno",
  "campaign-data-panel": "ajustes",
  "campaign-audience-panel": "ajustes",
  "campaign-rate-panel": "ajustes",
  "campaign-send-panel": "ajustes",
};

type SelectOption = { value: string; label: string };

const AUDIENCE_SOURCE_OPTIONS: SelectOption[] = [
  { value: "bookings", label: "Clientes con reserva" },
  { value: "manual", label: "Lista manual" },
];

/** Desktop: the tab panel takes the rest of the viewport and scrolls inside. */
const TABPANEL_SCROLL = "min-w-0 lg:min-h-0 lg:flex-1 lg:overflow-y-auto";

type CampaignEditorProps = {
  mode: "create" | "edit";
  campaignId?: number;
  initialCampaign?: Campaign | null;
  /** Tab from the URL (`?tab=`), read by the page so SSR and client agree. */
  initialTab?: CampaignEditorTab;
};

export function CampaignEditor({ mode, campaignId, initialCampaign = null, initialTab = "flujo" }: CampaignEditorProps) {
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
  const [tab, setTab] = useState<CampaignEditorTab>(initialTab);
  const tabRef = useRef(tab);
  tabRef.current = tab;
  const [confirm, setConfirm] = useState<"send" | "delete" | null>(null);
  const [audience, setAudience] = useState<{ total: number; emails: number; whatsapp: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [testTarget, setTestTarget] = useState("");
  const [recipients, setRecipients] = useState<CampaignRecipient[]>([]);
  // Snapshot of the last persisted form: "Enviar" sends the saved campaign, so
  // it must stay disabled while the editor holds unsaved changes.
  const savedFormRef = useRef<string>(JSON.stringify(initialCampaign ? campaignToInput(initialCampaign) : null));
  const coordId = campaign?.coord_id ?? "camp-new";
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const basePath = campaign ? `${LIST_HREF}/${campaign.id}` : `${LIST_HREF}/nueva`;

  // The tab lives in the URL (`?tab=`): shareable, survives reloads and the
  // first save. replaceState keeps Vike's history entry and never re-renders.
  const selectTab = useCallback((next: CampaignEditorTab) => {
    setTab(next);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", next);
    window.history.replaceState(window.history.state, "", url);
  }, []);

  const tabs = useMemo<TabItem[]>(
    () =>
      CAMPAIGN_EDITOR_TABS.map(({ id, label, Icon }) => ({
        id,
        label,
        href: `${basePath}?tab=${id}`,
        icon: <Icon className="bo-ico" aria-hidden="true" data-testid={`campaign-editor-tabs-${id}-svg`} />,
      })),
    [basePath],
  );

  // Flujo -> its section: a flow node opens the tab that holds it.
  const jumpToSection = useCallback(
    (section: CampaignFlowSection) => {
      selectTab(SECTION_TAB[section]);
      window.setTimeout(() => {
        document.querySelector(`[data-testid="${section}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 60);
    },
    [selectTab],
  );

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
      void navigate(`${LIST_HREF}/${saved.id}?tab=${tabRef.current}`);
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
    setBusy(true);
    try {
      const result = await api.remove(campaign.id);
      if (result.success) void navigate(LIST_HREF);
      else pushToast({ kind: "error", title: "Campañas", message: apiMessage(result, "No se pudo eliminar la campaña") });
    } catch (err) {
      pushToast({ kind: "error", title: "Campañas", message: errorMessage(err, "No se pudo eliminar la campaña") });
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  }, [api, campaign, pushToast]);

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
    if (tab !== "previsualizacion" || !form.body_html) return;
    let alive = true;
    compileCampaignEmail(form.body_html, form.subject || form.name || "Campaña", coordId)
      .then((html) => alive && setPreviewEmail({ html: fillPreviewPlaceholders(html, template.unsubscribeUrl), error: "" }))
      .catch((err) => alive && setPreviewEmail({ html: "", error: errorMessage(err, "No se pudo compilar el email") }));
    return () => {
      alive = false;
    };
  }, [coordId, form.body_html, form.name, form.subject, tab, template.unsubscribeUrl]);

  const saveRef = useRef(save);
  saveRef.current = save;
  // Ctrl/Cmd+S saves from anywhere in the editor (the browser dialog never opens).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void saveRef.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const saveState: CampaignSaveState = busy ? "saving" : !campaign ? "new" : hasUnsavedChanges ? "dirty" : "saved";

  return (
    <section className="flex min-w-0 flex-col gap-3 pb-24 sm:pb-0 lg:min-h-0 lg:flex-1 lg:pb-0" aria-label="Editor de campaña" data-testid="campaign-editor" data-coord-id={coordId}>
      <h2 className="sr-only" data-testid="campaign-editor-heading">Editor de campaña</h2>

      <CampaignEditorHeader
        name={form.name}
        subject={form.subject}
        status={campaign?.status}
        channels={form.channels}
        audienceSummary={campaignAudienceSummary(form.audience, form.audience_days, form.manual_recipients.filter((v) => v.trim()).length)}
        sent={campaign?.stats?.sent ?? 0}
        total={campaign?.stats?.total ?? 0}
        saveState={saveState}
        canSend={Boolean(campaign) && !hasUnsavedChanges}
        canDelete={Boolean(campaign)}
        busy={busy}
        backHref={LIST_HREF}
        onBack={() => void navigate(LIST_HREF)}
        onNameChange={(value) => patch("name", value)}
        onSubjectChange={(value) => patch("subject", value)}
        onSave={() => void save()}
        onSend={() => setConfirm("send")}
        onDelete={() => setConfirm("delete")}
      />

      <Tabs
        tabs={tabs}
        activeId={tab}
        ariaLabel="Secciones de la campaña"
        className="bo-tabs--reservas my-0 mx-auto flex w-fit shrink-0 flex-row rounded-xl"
        onNavigate={(_href, id) => selectTab(id as CampaignEditorTab)}
        testId="campaign-editor-tabs"
      />

      {tab === "flujo" && (
        <div className="campaign-flowFill min-w-0 lg:min-h-0 lg:flex-1" role="tabpanel" aria-label="Flujo" data-testid="campaign-tabpanel-flow">
          <CampaignFlowCanvas
            form={form}
            audience={audience}
            status={campaign?.status ?? null}
            onEdit={jumpToSection}
          />
        </div>
      )}

      {tab === "diseno" && (
        <div className="min-w-0 lg:min-h-0 lg:flex-1" role="tabpanel" aria-label="Diseño" data-testid="campaign-tabpanel-editor">
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

      {tab === "previsualizacion" && (
        <div className={`eb-scope ${TABPANEL_SCROLL}`} role="tabpanel" aria-label="Previsualización" data-testid="campaign-tabpanel-preview">
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

      {tab === "ajustes" && (
        <div className={`grid content-start gap-4 ${TABPANEL_SCROLL}`} role="tabpanel" aria-label="Ajustes" data-testid="campaign-tabpanel-settings">
          <CampaignSection icon={<FileText size={15} aria-hidden="true" data-testid="campaign-data-panel-svg" />} title="Datos de la campaña" helper="Cómo se guarda la campaña y el asunto que lee el cliente" data-testid="campaign-data-panel">
            <div className="grid content-start gap-4" data-testid="campaign-data-fields">
              <div className="grid gap-4 sm:grid-cols-2" data-testid="campaign-data-fields-row">
                <CampaignField label="Nombre interno" helper="Solo para el equipo, no llega al cliente" data-testid="campaign-data-name">
                  <input
                    className="bo-input h-10 w-full"
                    value={form.name}
                    placeholder="Nombre interno de la campaña"
                    onChange={(e) => patch("name", e.currentTarget.value)}
                    data-testid="campaign-name-input"
                  />
                </CampaignField>
                <CampaignField label="Asunto del email" helper="Línea que el cliente ve en su bandeja" data-testid="campaign-data-subject">
                  <input
                    className="bo-input h-10 w-full"
                    value={form.subject}
                    placeholder="Asunto del email"
                    onChange={(e) => patch("subject", e.currentTarget.value)}
                    data-testid="campaign-subject-input"
                  />
                </CampaignField>
              </div>
              <div className="grid content-start gap-2" data-testid="campaign-channels-field">
                <span className={CAMPAIGN_CAPTION_CLASS} data-testid="campaign-channels-caption">Canales de envío</span>
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
                      {channel.key === "email" ? (
                        <Mail size={14} aria-hidden="true" data-testid={`campaign-channel-${channel.key}-icon`} />
                      ) : (
                        <MessageCircle size={14} aria-hidden="true" data-testid={`campaign-channel-${channel.key}-icon`} />
                      )}
                      {channel.label}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </CampaignSection>

          <CampaignSection
            icon={<Users size={15} aria-hidden="true" data-testid="campaign-audience-panel-svg" />}
            title="Destinatarios"
            helper="De dónde salen los contactos y a cuántos se enviará"
            actions={
              <Button variant="ghost" size="sm" onClick={() => void loadAudience()} disabled={!campaign} data-testid="campaign-audience-refresh-btn">
                <Users size={14} aria-hidden="true" data-testid="campaign-audience-refresh-btn-icon" /> Calcular
              </Button>
            }
            data-testid="campaign-audience-panel"
          >
            <div className="grid content-start gap-3 md:grid-cols-2" data-testid="campaign-audience-fields">
              <CampaignField as="div" label={<span data-testid="campaign-audience-source-caption" data-observe="campaign-audience-source-caption">Origen</span>} helper="Reservas recientes o una lista propia" data-testid="campaign-audience-source-field">
                <Select
                  size="sm"
                  className="w-full"
                  style={{ width: "100%" }}
                  value={form.audience}
                  onChange={(value) => patch("audience", value as CampaignInput["audience"])}
                  options={AUDIENCE_SOURCE_OPTIONS}
                  ariaLabel="Origen de los destinatarios"
                  data-testid="campaign-audience-source-select"
                />
              </CampaignField>
              {form.audience === "bookings" ? (
                <CampaignFieldCell testId="campaign-audience-days-cell">
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
                  label="Emails o teléfonos (uno por línea)"
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
              <div className="flex flex-wrap items-center gap-3 md:col-span-2" data-testid="campaign-audience-summary">
                {audience ? (
                  <span className="text-xs text-bo-muted" data-testid="campaign-audience-count">
                    {audience.total} destinos ({audience.emails} email / {audience.whatsapp} WhatsApp)
                  </span>
                ) : (
                  <span className="text-xs text-bo-faint" data-testid="campaign-audience-count-hint">Pulsa Calcular para ver cuántos destinos se alcanzarán.</span>
                )}
              </div>
            </div>
          </CampaignSection>

          <CampaignSection
            icon={<Gauge size={15} aria-hidden="true" data-testid="campaign-rate-panel-svg" />}
            title="Ritmo de envío"
            helper="Mensajes por minuto por canal"
            data-testid="campaign-rate-panel"
          >
            <div className="grid gap-3 md:grid-cols-2" data-testid="campaign-rate-fields">
              <CampaignFieldCell testId="campaign-rate-email-cell">
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
              <CampaignFieldCell testId="campaign-rate-whatsapp-cell">
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

          <CampaignSection icon={<Send size={15} aria-hidden="true" data-testid="campaign-send-panel-svg" />} title="Envío" helper="Prueba la campaña y sigue el progreso" data-testid="campaign-send-panel">
            <div className="grid content-start gap-3" data-testid="campaign-send-fields">
              {!campaign && <InlineAlert kind="info" title="Guarda primero" message="Guarda la campaña para poder probar y enviar." testId="campaign-send-save-first" />}
              <div className="grid gap-3 md:grid-cols-2" data-testid="campaign-send-row">
                <div className="grid gap-2 sm:flex sm:flex-wrap" data-testid="campaign-test-field">
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
                <div className="flex flex-wrap items-center gap-3" data-testid="campaign-send-progress-cell">
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
            icon={<ScrollText size={15} aria-hidden="true" data-testid="campaign-recipients-panel-svg" />}
            title="Registro de envíos"
            helper="Reserva, canal y estado por destinatario"
            actions={
              <Button variant="ghost" size="sm" onClick={() => void loadRecipients()} disabled={!campaign} data-testid="campaign-recipients-refresh-btn">
                <RefreshCw size={14} aria-hidden="true" data-testid="campaign-recipients-refresh-btn-icon" /> Actualizar
              </Button>
            }
            data-testid="campaign-recipients-panel"
          >
            {recipients.length === 0 ? (
              <p className="text-xs text-bo-faint" data-testid="campaign-recipients-empty">Sin envíos registrados todavía.</p>
            ) : (
              <>
                <ul className="m-0 grid list-none gap-2 p-0 md:hidden" data-testid="campaign-recipients-cards">
                  {recipients.map((row) => (
                    <li key={row.id} className="grid gap-1 rounded-bo-md border border-bo-border bg-bo-surface-2 p-3 text-sm" title={row.error || undefined} data-testid={`campaign-recipient-card-${row.id}`}>
                      <span className="break-all font-medium" data-testid={`campaign-recipient-card-${row.id}-target`}>{row.target}</span>
                      <span className="flex flex-wrap items-center justify-between gap-2 text-xs text-bo-muted" data-testid={`campaign-recipient-card-${row.id}-meta`}>
                        <span data-testid={`campaign-recipient-card-${row.id}-status`}>{row.channel === "whatsapp" ? "WhatsApp" : "Email"} &middot; {row.status === "sent" ? "Enviado" : row.status === "failed" ? "Fallido" : "Pendiente"}</span>
                        <span data-testid={`campaign-recipient-card-${row.id}-sent`}>{row.sent_at || "Sin enviar"}{row.booking_id ? ` \u00b7 Reserva ${row.booking_id}` : ""}</span>
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="hidden overflow-x-auto rounded-bo-md border border-bo-border md:block" data-testid="campaign-recipients-table-wrap">
                  <table className="bo-table w-full" data-testid="campaign-recipients-table">
                    <thead data-testid="campaign-recipients-thead">
                      <tr data-testid="campaign-recipients-head-row">
                        <th data-testid="campaign-recipients-th-booking">Reserva</th>
                        <th data-testid="campaign-recipients-th-channel">Canal</th>
                        <th data-testid="campaign-recipients-th-target">Destino</th>
                        <th data-testid="campaign-recipients-th-status">Estado</th>
                        <th data-testid="campaign-recipients-th-sentat">Enviado</th>
                      </tr>
                    </thead>
                    <tbody data-testid="campaign-recipients-tbody">
                      {recipients.map((row) => (
                        <tr key={row.id} data-testid={`campaign-recipient-row-${row.id}`} data-booking-id={row.booking_id || ""} data-coord-id={coordId}>
                          <td data-testid={`campaign-recipient-row-${row.id}-booking`}>{row.booking_id || "—"}</td>
                          <td data-testid={`campaign-recipient-row-${row.id}-channel`}>{row.channel}</td>
                          <td className="max-w-[220px] truncate" data-testid={`campaign-recipient-row-${row.id}-target`}>{row.target}</td>
                          <td title={row.error} data-testid={`campaign-recipient-row-${row.id}-status`}>{row.status}</td>
                          <td data-testid={`campaign-recipient-row-${row.id}-sent`}>{row.sent_at || "—"}</td>
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

      <ConfirmDialog
        open={confirm === "send"}
        title="Enviar campaña"
        message={`Se enviará «${form.name || "Campaña sin nombre"}» a ${campaignAudienceSummary(form.audience, form.audience_days, form.manual_recipients.filter((v) => v.trim()).length).toLowerCase()} por ${form.channels.map((c) => (c === "email" ? "email" : "WhatsApp")).join(" y ")}. El envío no se puede deshacer.`}
        confirmText="Enviar ahora"
        cancelText="Cancelar"
        busy={busy}
        onClose={() => setConfirm(null)}
        onConfirm={async () => {
          setConfirm(null);
          await sendAll();
        }}
        testId="campaign-send-confirm"
      />
      <ConfirmDialog
        open={confirm === "delete"}
        title="Eliminar campaña"
        message={`¿Eliminar «${form.name || "Campaña sin nombre"}» y su registro de envíos? No se puede deshacer.`}
        confirmText="Eliminar"
        cancelText="Cancelar"
        danger
        busy={busy}
        onClose={() => setConfirm(null)}
        onConfirm={remove}
        testId="campaign-delete-confirm"
      />
    </section>
  );
}
