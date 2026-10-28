import React, { useCallback, useEffect, useMemo, useState } from "react";
import { navigate } from "vike/client/router";
import { Megaphone, Plus, Sparkles } from "lucide-react";
import type { RestaurantAd, RestaurantAdInput } from "../../../../api/types";
import { createClient } from "../../../../api/client";
import { FloatingActionButton } from "../../../../ui/actions/FloatingActionButton";
import { FoodDishCard } from "../../../../ui/widgets/food/FoodDishCard";
import { InlineAlert } from "../../../../ui/feedback/InlineAlert";
import { useToasts } from "../../../../ui/feedback/useToasts";
import { Switch } from "../../../../ui/shadcn/Switch";

/*
 * Anuncios list (ads_html_editor_v1): one card per ad with its image, kind
 * and schedule, and the active switch. Ads made with the previous editor are
 * flagged until they are opened and saved in the new one.
 */

const NEW_HREF = "/app/anuncios/nuevo";
const IMG_SRC_RE = /<img\b[^>]*\bsrc="([^"]+)"/gi;

function apiMessage(result: unknown, fallback: string): string {
  const message = (result as { message?: unknown } | null)?.message;
  return typeof message === "string" && message.trim() ? message : fallback;
}

/** First real image of an ad (placeholders skipped) for the card thumbnail. */
function firstImage(ad: RestaurantAd): string {
  const pages = ad.design ? [ad.design.main.html, ...(ad.design.steps ?? []).map((s) => s.html)] : [];
  for (const html of pages) {
    for (const match of html.matchAll(IMG_SRC_RE)) {
      const src = match[1].replace(/&amp;/g, "&");
      if (/^https?:\/\//i.test(src) && !src.includes("placehold.co")) return src;
    }
  }
  const direct = ad.content.find((entry) => entry.type === "image")?.value ?? "";
  if (direct) return direct;
  const step = ad.layout?.steps.find((s) => s.background_image || s.content?.some((c) => c.type === "image"));
  return step?.background_image || step?.content?.find((c) => c.type === "image")?.value || "";
}

function kindLabel(ad: RestaurantAd): string {
  if (ad.design) return ad.design.kind === "multiple" ? `Múltiple · ${ad.design.steps?.length ?? 0} propuestas` : "Individual";
  return "Formato anterior: ábrelo para pasarlo al nuevo editor";
}

const shortDate = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString("es-ES", { day: "numeric", month: "short" });

function scheduleLabel(ad: RestaurantAd): string {
  return ad.starts_at && ad.ends_at ? `Del ${shortDate(ad.starts_at)} al ${shortDate(ad.ends_at)}` : "Sin fechas: no aparece en la web";
}

export function AdsList() {
  const api = useMemo(() => createClient({ baseUrl: "" }).config, []);
  const { pushToast } = useToasts();
  const [ads, setAds] = useState<RestaurantAd[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.listAds();
      if (!result.success) {
        pushToast({ kind: "error", title: "Anuncios", message: apiMessage(result, "No se pudieron cargar los anuncios") });
        setAds([]);
        return;
      }
      setAds(result.ads ?? []);
    } catch (error) {
      pushToast({ kind: "error", title: "Anuncios", message: error instanceof Error ? error.message : "No se pudieron cargar los anuncios" });
    } finally {
      setLoading(false);
    }
  }, [api, pushToast]);

  useEffect(() => {
    void load();
  }, [load]);

  // Optimistic switch, rolled back when the API refuses. The update carries
  // every stored field except the design, which the backend keeps when absent.
  const toggleActive = useCallback(
    async (ad: RestaurantAd, next: boolean) => {
      const previous = ad.active;
      setAds((prev) => prev.map((item) => (item.id === ad.id ? { ...item, active: next } : item)));
      const payload: RestaurantAdInput = {
        name: ad.name,
        active: next,
        content: ad.content,
        ctas: ad.ctas,
        layout: ad.layout ?? { mode: "unico", steps: [] },
        ...(ad.canvas ? { canvas: ad.canvas } : {}),
        starts_at: ad.starts_at ?? null,
        ends_at: ad.ends_at ?? null,
      };
      try {
        const result = await api.updateAd(ad.id, payload);
        if (!result.success) throw new Error(apiMessage(result, "No se pudo actualizar el anuncio"));
        const updated = result.ad;
        if (updated) setAds((prev) => prev.map((item) => (item.id === ad.id ? updated : item)));
      } catch (error) {
        pushToast({ kind: "error", title: "Anuncios", message: error instanceof Error ? error.message : "No se pudo actualizar el anuncio" });
        setAds((prev) => prev.map((item) => (item.id === ad.id ? { ...item, active: previous } : item)));
      }
    },
    [api, pushToast],
  );

  const sorted = useMemo(() => [...ads].sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name, "es")), [ads]);

  const fab = (
    <FloatingActionButton
      icon={<Plus size={24} aria-hidden="true" />}
      aria-label="Crear anuncio"
      onClick={() => {
        void navigate(NEW_HREF);
      }}
      data-testid="ad-create"
      data-role="ad-list-create-btn"
      className="bo-anunciosFab"
    />
  );

  if (loading) {
    return (
      <section aria-label="Anuncios" data-testid="config-anuncios">
        <InlineAlert kind="info" title="Cargando" message="Recuperando la lista de anuncios del restaurante." testId="anuncios-loading" />
        {fab}
      </section>
    );
  }

  if (sorted.length === 0) {
    return (
      <section aria-label="Anuncios" className="grid gap-6" data-testid="config-anuncios">
        <div className="bo-anunciosEmpty" data-ui="anuncios-empty" data-testid="anuncios-empty">
          <div className="bo-anunciosEmptyIcon" aria-hidden="true" data-testid="anuncios-empty-icon">
            <Sparkles size={28} />
          </div>
          <div className="bo-anunciosEmptyTitle" data-testid="anuncios-empty-title">Aún no hay anuncios</div>
          <p className="bo-anunciosEmptyHint" data-testid="anuncios-empty-hint">
            Crea tu primer anuncio con el botón <Plus size={14} aria-hidden="true" className="inline align-middle" /> para publicar promociones, eventos o menús en la web del restaurante.
          </p>
        </div>
        {fab}
      </section>
    );
  }

  return (
    <section aria-label="Anuncios" className="grid gap-4" data-testid="config-anuncios">
      <div className="bo-anunciosListHead" data-testid="anuncios-list-head">
        <Megaphone size={18} aria-hidden="true" className="shrink-0 text-bo-accent" />
        <h2 className="bo-anunciosListTitle" data-testid="anuncios-list-title">Tus anuncios</h2>
        <span className="bo-anunciosListCount" data-testid="anuncios-list-count">{sorted.length}</span>
      </div>

      <div className="bo-anunciosGrid" role="list" data-ui="anuncios-grid" data-testid="anuncios-grid">
        {sorted.map((ad) => (
          <FoodDishCard
            key={ad.id}
            title={ad.name}
            imageUrl={firstImage(ad) || null}
            inactive={!ad.active}
            primaryMeta={kindLabel(ad)}
            secondaryMeta={scheduleLabel(ad)}
            className="bo-anunciosCard"
            onOpen={() => {
              void navigate(`/app/anuncios/${ad.id}`);
            }}
            openAriaLabel={`Abrir ${ad.name}`}
            testId={`ad-card-${ad.id}`}
            footerActions={
              <span className="bo-anunciosCardToggle" data-testid={`ad-toggle-${ad.id}`} onClick={(event) => event.stopPropagation()}>
                <Switch
                  checked={ad.active}
                  onCheckedChange={(next) => {
                    void toggleActive(ad, next);
                  }}
                  aria-label={ad.active ? `Desactivar ${ad.name}` : `Activar ${ad.name}`}
                  data-testid={`ad-active-switch-${ad.id}`}
                />
                <span className="bo-anunciosCardToggleLabel" data-testid={`ad-toggle-label-${ad.id}`}>
                  {ad.active ? "Activo" : "Inactivo"}
                </span>
              </span>
            }
          />
        ))}
      </div>

      {fab}
    </section>
  );
}
