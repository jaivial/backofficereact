import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { navigate } from "vike/client/router";
import { Mail, MessageCircle, Send, Trash2, Users } from "lucide-react";
import type { Campaign, CampaignChannel, CampaignInput } from "../../../../api/types";
import { Button } from "../../../../ui/actions/Button";
import { InlineAlert } from "../../../../ui/feedback/InlineAlert";
import { Panel } from "../../../../ui/shell/Panel";
import { MarkdownEditor } from "../../../../ui/inputs/MarkdownEditor";
import { useToasts } from "../../../../ui/feedback/useToasts";
import { apiMessage, campaignToInput, CAMPAIGN_CHANNELS, createCampaignsAPI, emptyCampaignInput } from "./campaignsApi";

const LIST_HREF = "/app/campanas";

type CampaignEditorProps = {
  mode: "create" | "edit";
  campaignId?: number;
  initialCampaign?: Campaign | null;
};

type Preview = { html: string; whatsapp: string };

export function CampaignEditor({ mode, campaignId, initialCampaign = null }: CampaignEditorProps) {
  const api = useMemo(() => createCampaignsAPI(), []);
  const { pushToast } = useToasts();
  const [form, setForm] = useState<CampaignInput>(initialCampaign ? campaignToInput(initialCampaign) : emptyCampaignInput());
  const [campaign, setCampaign] = useState<Campaign | null>(initialCampaign);
  const [preview, setPreview] = useState<Preview>({ html: "", whatsapp: "" });
  const [device, setDevice] = useState<"mobile" | "desktop">("mobile");
  const [audience, setAudience] = useState<{ total: number; emails: number; whatsapp: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [testTarget, setTestTarget] = useState("");
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

  // Preview keeps both channel renderings in sync with the shared markdown.
  useEffect(() => {
    const timer = setTimeout(async () => {
      const result = await api.preview(form);
      if (result.success) setPreview({ html: result.html ?? "", whatsapp: result.whatsapp ?? "" });
    }, 500);
    return () => clearTimeout(timer);
  }, [api, form]);

  const save = useCallback(async () => {
    setBusy(true);
    try {
      const result = campaign ? await api.update(campaign.id, form) : await api.create(form);
      if (!result.success || !result.campaign) {
        pushToast({ kind: "error", title: "Campanas", message: apiMessage(result, "No se pudo guardar la campana") });
        return null;
      }
      setCampaign(result.campaign);
      if (!campaign) void navigate(`${LIST_HREF}/${result.campaign.id}`);
      pushToast({ kind: "success", title: "Campanas", message: "Campana guardada" });
      return result.campaign;
    } finally {
      setBusy(false);
    }
  }, [api, campaign, form, pushToast]);

  const uploadImage = useCallback(
    async (file: File) => {
      let target = campaign;
      if (!target) target = await save();
      if (!target) return "";
      const result = await api.uploadImage(target.id, file);
      if (!result.success || !result.url) {
        pushToast({ kind: "error", title: "Imagen", message: apiMessage(result, "No se pudo subir la imagen") });
        return "";
      }
      return result.url;
    },
    [api, campaign, pushToast, save],
  );

  const loadAudience = useCallback(async () => {
    if (!campaign) return;
    const result = await api.audience(campaign.id);
    if (result.success) setAudience({ total: result.total, emails: result.emails, whatsapp: result.whatsapp });
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
        if (status.status === "sent" && pollRef.current) clearInterval(pollRef.current);
      }, 3000);
    } finally {
      setBusy(false);
    }
  }, [api, campaign, pushToast]);

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  const remove = useCallback(async () => {
    if (!campaign) return;
    const result = await api.remove(campaign.id);
    if (result.success) void navigate(LIST_HREF);
  }, [api, campaign]);

  return (
    <section className="grid gap-4" aria-label="Editor de campana" data-testid="campaign-editor" data-coord-id={coordId}>
      <Panel
        title={mode === "create" ? "Nueva campana" : form.name || "Campana"}
        meta={campaign ? `${campaign.status} · ${campaign.stats?.sent ?? 0}/${campaign.stats?.total ?? 0} enviados` : "Borrador"}
        actions={
          <div className="flex gap-2">
            <Button variant="primary" onClick={() => void save()} disabled={busy} data-testid="campaign-save-btn">Guardar</Button>
            {campaign && (
              <Button variant="danger" onClick={() => void remove()} data-testid="campaign-delete-btn">
                <Trash2 size={16} aria-hidden="true" />
              </Button>
            )}
          </div>
        }
      >
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

      <Panel title="Contenido" data-testid="campaign-content-panel">
        <MarkdownEditor
          testId="campaign-markdown"
          coordId={coordId}
          value={form.body_markdown}
          onChange={(value) => patch("body_markdown", value)}
          onUploadImage={uploadImage}
          placeholder="Escribe el anuncio en markdown…"
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

      <Panel title="Destinatarios" data-testid="campaign-audience-panel">
        <div className="grid gap-3 md:grid-cols-3">
          <label className="grid gap-1 text-sm" data-testid="campaign-audience-source-field">
            Origen
            <select
              className="bo-input"
              value={form.audience}
              onChange={(e) => patch("audience", e.currentTarget.value as CampaignInput["audience"])}
              data-testid="campaign-audience-source-select"
            >
              <option value="bookings">Clientes con reserva</option>
              <option value="manual">Lista manual</option>
            </select>
          </label>
          {form.audience === "bookings" ? (
            <label className="grid gap-1 text-sm" data-testid="campaign-audience-days-field">
              Ultimos dias
              <input
                type="number"
                min={1}
                className="bo-input"
                value={form.audience_days}
                onChange={(e) => patch("audience_days", Number(e.currentTarget.value) || 365)}
                data-testid="campaign-audience-days-input"
              />
            </label>
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

      <Panel
        title="Previsualizacion"
        actions={
          <div className="flex gap-2">
            <Button variant={device === "mobile" ? "primary" : "ghost"} size="sm" onClick={() => setDevice("mobile")} data-testid="campaign-preview-mobile-btn">Movil</Button>
            <Button variant={device === "desktop" ? "primary" : "ghost"} size="sm" onClick={() => setDevice("desktop")} data-testid="campaign-preview-desktop-btn">Ordenador</Button>
          </div>
        }
        data-testid="campaign-preview-panel"
      >
        <div className="grid gap-4 md:grid-cols-2">
          <iframe
            title="Previsualizacion email"
            srcDoc={preview.html}
            className="w-full rounded-xl border"
            style={{ height: 420, maxWidth: device === "mobile" ? 380 : "100%" }}
            data-testid="campaign-preview-email"
          />
          <pre className="whitespace-pre-wrap rounded-xl border p-3 text-sm" data-testid="campaign-preview-whatsapp">{preview.whatsapp}</pre>
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
    </section>
  );
}
