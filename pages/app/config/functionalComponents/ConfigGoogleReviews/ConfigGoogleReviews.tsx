import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link2, RefreshCw, Save, Send, Sparkles, Star, Trash2, Unlink } from "lucide-react";

import { createClient } from "../../../../../api/client";
import type { GoogleBusinessLocation, GoogleReview, GoogleReviewsStatus } from "../../../../../api/types";
import { InlineAlert } from "../../../../../ui/feedback/InlineAlert";
import { useToasts } from "../../../../../ui/feedback/useToasts";
import { Select } from "../../../../../ui/inputs/Select";
import { Switch } from "../../../../../ui/shadcn/Switch";

// Coordination id: google_reviews_ai_v1 - backoffice side of the Google review
// assistant: connect the Business Profile, tune how replies are written and
// approve / edit / regenerate the AI drafts.

type Filter = "open" | "published" | "skipped";

const AUTO_OPTIONS = [
  { value: "0", label: "Nunca: todo con mi aprobación" },
  { value: "5", label: "Solo las de 5★" },
  { value: "4", label: "Las de 4★ y 5★ (recomendado)" },
  { value: "3", label: "Las de 3★ o más" },
];
const FORMALITY_OPTIONS = [
  { value: "tu", label: "Tú (cercano)" },
  { value: "usted", label: "Usted (formal)" },
];
const FILTERS: { id: Filter; label: string; countKeys: string[] }[] = [
  { id: "open", label: "Por revisar", countKeys: ["pending", "draft"] },
  { id: "published", label: "Publicadas", countKeys: ["published"] },
  { id: "skipped", label: "Descartadas", countKeys: ["skipped"] },
];

const errorMessage = (e: unknown, fallback: string) => (e instanceof Error && e.message ? e.message : fallback);
const formatDate = (iso: string | null) => (iso ? new Date(iso).toLocaleString("es-ES", { dateStyle: "medium", timeStyle: "short" }) : "—");

export function ConfigGoogleReviews() {
  const api = useMemo(() => createClient({ baseUrl: "" }), []);
  const { pushToast } = useToasts();
  const [status, setStatus] = useState<GoogleReviewsStatus | null>(null);
  const [settings, setSettings] = useState<GoogleReviewsStatus | null>(null);
  const [locations, setLocations] = useState<GoogleBusinessLocation[] | null>(null);
  const [filter, setFilter] = useState<Filter>("open");
  const [reviews, setReviews] = useState<GoogleReview[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState<string>("");
  const started = useRef(false);

  const applyStatus = useCallback((next: GoogleReviewsStatus) => {
    setStatus(next);
    setSettings(next);
  }, []);

  const run = useCallback(async (key: string, fn: () => Promise<void>, fallback: string) => {
    setBusy(key);
    try {
      await fn();
    } catch (e) {
      pushToast({ kind: "error", title: "Reseñas Google", message: errorMessage(e, fallback) });
    } finally {
      setBusy("");
    }
  }, [pushToast]);

  const loadReviews = useCallback(async (which: Filter) => {
    const res = await api.config.listGoogleReviews(which);
    if (res.success) {
      setReviews(res.reviews);
      setCounts(res.counts || {});
    }
  }, [api.config]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void run("load", async () => {
      const res = await api.config.getGoogleReviewsStatus();
      if (res.success) applyStatus(res.status);
      await loadReviews("open");
    }, "No se pudo cargar la conexión con Google");
    // Result of the OAuth round trip (?google=connected | error:<reason>).
    const params = new URLSearchParams(window.location.search);
    const result = params.get("google");
    if (result) {
      pushToast(result === "connected"
        ? { kind: "success", title: "Cuenta de Google conectada" }
        : { kind: "error", title: "No se pudo conectar con Google", message: result.replace(/^error:/, "") });
      params.delete("google");
      window.history.replaceState(null, "", `${window.location.pathname}?${params.toString()}`);
    }
  }, [api.config, applyStatus, loadReviews, pushToast, run]);

  const changeFilter = (next: Filter) => {
    setFilter(next);
    void run("list", () => loadReviews(next), "No se pudieron cargar las reseñas");
  };

  const connect = () => run("connect", async () => {
    const res = await api.config.startGoogleReviewsOAuth();
    if (res.success) window.location.href = res.url;
  }, "No se pudo iniciar la conexión");

  const disconnect = () => run("disconnect", async () => {
    const res = await api.config.disconnectGoogleReviews();
    if (res.success) {
      applyStatus(res.status);
      setLocations(null);
    }
  }, "No se pudo desconectar");

  const loadLocations = () => run("locations", async () => {
    const res = await api.config.getGoogleReviewsLocations();
    if (res.success) setLocations(res.locations);
  }, "No se pudieron cargar las fichas de Google Business");

  const chooseLocation = (name: string) => {
    const loc = locations?.find((l) => l.name === name);
    if (!loc) return;
    void run("location", async () => {
      const res = await api.config.setGoogleReviewsLocation(loc);
      if (res.success) {
        applyStatus(res.status);
        setLocations(null);
      }
    }, "No se pudo guardar la ficha");
  };

  const saveSettings = () => settings && run("settings", async () => {
    const res = await api.config.setGoogleReviewsSettings({
      autoPublishMinStars: settings.autoPublishMinStars,
      formality: settings.formality,
      signature: settings.signature,
      complaintContact: settings.complaintContact,
      syncEnabled: settings.syncEnabled,
    });
    if (res.success) {
      applyStatus(res.status);
      pushToast({ kind: "success", title: "Ajustes guardados" });
    }
  }, "No se pudieron guardar los ajustes");

  const syncNow = () => run("sync", async () => {
    const res = await api.config.syncGoogleReviews();
    const st = await api.config.getGoogleReviewsStatus();
    if (st.success) applyStatus(st.status);
    await loadReviews(filter);
    if (!res.success) throw new Error(res.message || "La revisión falló");
    const s = res.summary;
    pushToast({ kind: "success", title: "Revisión completada", message: `${s.new} nuevas · ${s.drafted} borradores · ${s.published} publicadas · ${s.pending} por revisar` });
  }, "La revisión falló");

  const replaceReview = (next: GoogleReview) => setReviews((prev) => prev.map((r) => (r.id === next.id ? next : r)));

  const reviewAction = (review: GoogleReview, action: "draft" | "publish" | "skip", input: { text?: string; instruction?: string } = {}) =>
    run(`${action}-${review.id}`, async () => {
      const res = await api.config.googleReviewAction(review.id, action, input);
      if (!res.success) return;
      if (action === "draft") replaceReview(res.review);
      else await loadReviews(filter);
      if (action === "publish") pushToast({ kind: "success", title: "Respuesta publicada en Google" });
    }, action === "publish" ? "No se pudo publicar en Google" : "No se pudo completar la acción");

  if (!status || !settings) {
    return <div className="bo-panel p-6 text-sm text-[var(--bo-muted)]" data-testid="config-google-reviews-loading">Cargando reseñas de Google...</div>;
  }

  return (
    <div className="bo-stack" data-testid="config-google-reviews" data-coordination-id="google_reviews_ai_v1">
      <div className="bo-panel" data-testid="config-google-reviews-connection">
        <div className="bo-panelHead flex-col items-stretch gap-1" data-testid="config-google-reviews-connection-head">
          <div className="bo-panelTitle flex items-center gap-2" data-testid="config-google-reviews-connection-title">
            <Link2 size={18} className="text-[var(--bo-accent)]" aria-hidden="true" />
            Conexión con Google Business Profile
          </div>
          <div className="bo-panelMeta" data-testid="config-google-reviews-connection-meta">
            Conecta la cuenta de Google que gestiona la ficha del restaurante. La IA leerá las reseñas cada día y preparará la respuesta de cada una.
          </div>
        </div>
        <div className="bo-panelBody flex flex-col gap-4" data-testid="config-google-reviews-connection-body">
          {!status.configured ? (
            <InlineAlert kind="error" title="Google no está configurado en el servidor" message="Faltan GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET en el entorno del backend." />
          ) : null}
          {status.connected ? (
            <>
              <div className="text-sm" data-testid="config-google-reviews-connected-as">
                Conectado como <strong data-testid="config-google-reviews-email">{status.email || "cuenta de Google"}</strong>
                {status.locationTitle ? <> · Ficha: <strong data-testid="config-google-reviews-location-title">{status.locationTitle}</strong></> : null}
              </div>
              {!status.location && !locations ? (
                <InlineAlert kind="info" title="Elige la ficha" message="Tu cuenta gestiona varias fichas (o aún no se han podido leer). Elige la del restaurante." />
              ) : null}
              {locations ? (
                <div className="bo-field" data-testid="config-google-reviews-location-field">
                  <span className="bo-label" data-testid="config-google-reviews-location-label">Ficha de Google Business</span>
                  {locations.length ? (
                    <Select
                      value={status.location}
                      onChange={chooseLocation}
                      options={locations.map((l) => ({ value: l.name, label: l.address ? `${l.title} · ${l.address}` : l.title }))}
                      ariaLabel="Ficha de Google Business"
                      placeholder="Elige una ficha"
                      disabled={busy === "location"}
                      data-testid="config-google-reviews-location-select"
                    />
                  ) : (
                    <div className="bo-panelMeta" data-testid="config-google-reviews-no-locations">Esta cuenta no gestiona ninguna ficha.</div>
                  )}
                </div>
              ) : null}
              <div className="flex flex-wrap gap-2" data-testid="config-google-reviews-connection-actions">
                <button type="button" className="bo-btn bo-btn--ghost gap-2" onClick={() => void loadLocations()} disabled={!!busy} data-testid="config-google-reviews-change-location">
                  {busy === "locations" ? "Cargando fichas..." : "Cambiar de ficha"}
                </button>
                <button type="button" className="bo-btn bo-btn--danger gap-2" onClick={() => void disconnect()} disabled={!!busy} data-testid="config-google-reviews-disconnect">
                  <Unlink size={14} /> Desconectar
                </button>
              </div>
            </>
          ) : (
            <div className="flex flex-col gap-3" data-testid="config-google-reviews-disconnected">
              <button type="button" className="bo-btn bo-btn--primary gap-2 self-start" onClick={() => void connect()} disabled={!status.configured || !!busy} data-testid="config-google-reviews-connect">
                <Link2 size={14} /> {busy === "connect" ? "Abriendo Google..." : "Conectar con Google"}
              </button>
              <div className="bo-panelMeta" data-testid="config-google-reviews-redirect-hint">
                En el cliente OAuth de Google Cloud debe estar registrada esta URL de retorno: <code data-testid="config-google-reviews-redirect-uri">{status.redirectUri}</code>
              </div>
            </div>
          )}
          <div className="bo-panelMeta" data-testid="config-google-reviews-last-sync">
            Última revisión: {formatDate(status.lastSyncAt)}
          </div>
          {status.lastSyncError ? (
            <InlineAlert kind="error" title="La última revisión falló" message={status.lastSyncError} />
          ) : null}
        </div>
      </div>

      <div className="bo-panel" data-testid="config-google-reviews-settings">
        <div className="bo-panelHead flex-col items-stretch gap-1" data-testid="config-google-reviews-settings-head">
          <div className="bo-panelTitle flex items-center gap-2" data-testid="config-google-reviews-settings-title">
            <Sparkles size={18} className="text-[var(--bo-accent)]" aria-hidden="true" />
            Cómo responde la IA
          </div>
          <div className="bo-panelMeta" data-testid="config-google-reviews-settings-meta">
            Las reseñas por debajo del umbral se quedan en borrador hasta que las apruebes. Solo se publican solas las de los últimos 14 días.
          </div>
        </div>
        <div className="bo-panelBody flex flex-col gap-4" data-testid="config-google-reviews-settings-body">
          <div className="bo-field" data-testid="config-google-reviews-auto-field">
            <span className="bo-label" data-testid="config-google-reviews-auto-label">Publicar automáticamente</span>
            <Select
              value={String(settings.autoPublishMinStars)}
              onChange={(v) => setSettings({ ...settings, autoPublishMinStars: Number(v) })}
              options={AUTO_OPTIONS}
              ariaLabel="Publicar automáticamente"
              data-testid="config-google-reviews-auto-select"
            />
          </div>
          <div className="bo-field" data-testid="config-google-reviews-formality-field">
            <span className="bo-label" data-testid="config-google-reviews-formality-label">Tratamiento al cliente</span>
            <Select
              value={settings.formality}
              onChange={(v) => setSettings({ ...settings, formality: v === "usted" ? "usted" : "tu" })}
              options={FORMALITY_OPTIONS}
              ariaLabel="Tratamiento al cliente"
              data-testid="config-google-reviews-formality-select"
            />
          </div>
          <label className="bo-field" data-testid="config-google-reviews-signature-field">
            <span className="bo-label" data-testid="config-google-reviews-signature-label">Firma</span>
            <input className="bo-input" value={settings.signature} maxLength={160} placeholder="El equipo de Alquería Villa Carmen"
              onChange={(e) => setSettings({ ...settings, signature: e.target.value })} data-testid="config-google-reviews-signature-input" />
          </label>
          <label className="bo-field" data-testid="config-google-reviews-contact-field">
            <span className="bo-label" data-testid="config-google-reviews-contact-label">Contacto para quejas (reseñas de 1-2★)</span>
            <input className="bo-input" value={settings.complaintContact} maxLength={255} placeholder="reservas@alqueriavillacarmen.com o 638 85 72 94"
              onChange={(e) => setSettings({ ...settings, complaintContact: e.target.value })} data-testid="config-google-reviews-contact-input" />
          </label>
          <div className="bo-foodDetailQuickStatus" data-testid="config-google-reviews-sync-field">
            <span className="bo-label" data-testid="config-google-reviews-sync-label">Revisión diaria a las {settings.syncHour}:00</span>
            <Switch checked={settings.syncEnabled} onCheckedChange={(v) => setSettings({ ...settings, syncEnabled: v })} aria-label="Revisión diaria" />
          </div>
        </div>
        <div className="bo-foodDetailEditorActions" data-testid="config-google-reviews-settings-actions">
          <button type="button" className="bo-btn bo-btn--primary gap-2" onClick={() => void saveSettings()} disabled={!!busy} data-testid="config-google-reviews-settings-save">
            <Save size={14} /> {busy === "settings" ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </div>

      <div className="bo-panel" data-testid="config-google-reviews-list">
        <div className="bo-panelHead flex-col items-stretch gap-3" data-testid="config-google-reviews-list-head">
          <div className="bo-panelTitle flex items-center justify-between gap-2" data-testid="config-google-reviews-list-title">
            <span className="flex items-center gap-2" data-testid="config-google-reviews-list-title-text">
              <Star size={18} className="text-[var(--bo-accent)]" aria-hidden="true" /> Reseñas
            </span>
            <button type="button" className="bo-btn bo-btn--ghost gap-2" onClick={() => void syncNow()} disabled={!status.connected || !status.location || !!busy} data-testid="config-google-reviews-sync-now">
              <RefreshCw size={14} /> {busy === "sync" ? "Revisando..." : "Revisar ahora"}
            </button>
          </div>
          <div className="flex flex-wrap gap-2" role="tablist" data-testid="config-google-reviews-filters">
            {FILTERS.map((f) => (
              <button key={f.id} type="button" role="tab" aria-selected={filter === f.id}
                className={`bo-btn ${filter === f.id ? "bo-btn--primary" : "bo-btn--ghost"}`}
                onClick={() => changeFilter(f.id)} disabled={!!busy} data-testid={`config-google-reviews-filter-${f.id}`}>
                {f.label} ({f.countKeys.reduce((n, k) => n + (counts[k] || 0), 0)})
              </button>
            ))}
          </div>
        </div>
        <div className="bo-panelBody flex flex-col gap-4" data-testid="config-google-reviews-items">
          {reviews.length === 0 ? (
            <div className="bo-panelMeta" data-testid="config-google-reviews-empty">No hay reseñas en esta lista.</div>
          ) : reviews.map((review) => (
            <ReviewCard key={review.id} review={review} busy={busy} onAction={reviewAction} />
          ))}
        </div>
      </div>
    </div>
  );
}

function ReviewCard(props: {
  review: GoogleReview;
  busy: string;
  onAction: (review: GoogleReview, action: "draft" | "publish" | "skip", input?: { text?: string; instruction?: string }) => void;
}) {
  const { review, busy, onAction } = props;
  const [text, setText] = useState(review.reply);
  const [instruction, setInstruction] = useState("");
  useEffect(() => setText(review.reply), [review.reply]);
  const editable = review.status === "pending" || review.status === "draft";
  const tid = `config-google-reviews-item-${review.id}`;

  return (
    <article className="bo-panel p-4 flex flex-col gap-3" data-testid={tid}>
      <header className="flex flex-wrap items-center justify-between gap-2" data-testid={`${tid}-head`}>
        <div className="flex items-center gap-2" data-testid={`${tid}-who`}>
          <span aria-label={`${review.stars} estrellas`} className="text-[var(--bo-accent)]" data-testid={`${tid}-stars`}>
            {"★".repeat(review.stars)}{"☆".repeat(Math.max(0, 5 - review.stars))}
          </span>
          <strong data-testid={`${tid}-reviewer`}>{review.reviewer || "Cliente de Google"}</strong>
        </div>
        <span className="bo-panelMeta" data-testid={`${tid}-date`}>{formatDate(review.createdAt)}</span>
      </header>
      <p className="text-sm whitespace-pre-line" data-testid={`${tid}-comment`}>{review.comment || <em>Sin comentario, solo estrellas.</em>}</p>
      {review.error ? <InlineAlert kind="error" title="Google rechazó la respuesta" message={review.error} /> : null}
      {editable ? (
        <>
          <label className="bo-field" data-testid={`${tid}-reply-field`}>
            <span className="bo-label" data-testid={`${tid}-reply-label`}>{review.status === "draft" ? "Borrador de la IA (puedes editarlo)" : "Respuesta"}</span>
            <textarea className="bo-textarea" rows={5} value={text} placeholder="Aún sin borrador: pulsa Regenerar con IA o escribe la respuesta."
              onChange={(e) => setText(e.target.value)} data-testid={`${tid}-reply-input`} />
          </label>
          <input className="bo-input" value={instruction} placeholder="Indicación para regenerar (opcional): más corto, más formal, menciona la paella…"
            onChange={(e) => setInstruction(e.target.value)} data-testid={`${tid}-instruction-input`} />
          <div className="flex flex-wrap gap-2" data-testid={`${tid}-actions`}>
            <button type="button" className="bo-btn bo-btn--primary gap-2" disabled={!!busy || !text.trim()} onClick={() => onAction(review, "publish", { text })} data-testid={`${tid}-publish`}>
              <Send size={14} /> {busy === `publish-${review.id}` ? "Publicando..." : "Publicar en Google"}
            </button>
            <button type="button" className="bo-btn bo-btn--ghost gap-2" disabled={!!busy} onClick={() => onAction(review, "draft", { instruction })} data-testid={`${tid}-regenerate`}>
              <Sparkles size={14} /> {busy === `draft-${review.id}` ? "Generando..." : "Regenerar con IA"}
            </button>
            <button type="button" className="bo-btn bo-btn--ghost gap-2" disabled={!!busy} onClick={() => onAction(review, "skip")} data-testid={`${tid}-skip`}>
              <Trash2 size={14} /> Descartar
            </button>
          </div>
        </>
      ) : review.reply ? (
        <div className="bo-panelMeta whitespace-pre-line" data-testid={`${tid}-published-reply`}>
          <strong>Respuesta publicada{review.publishedAt ? ` · ${formatDate(review.publishedAt)}` : ""}:</strong>{"\n"}{review.reply}
        </div>
      ) : null}
    </article>
  );
}
