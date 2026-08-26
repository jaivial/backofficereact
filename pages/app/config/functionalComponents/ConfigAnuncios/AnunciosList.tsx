import React, { useCallback, useEffect, useMemo, useState } from "react";
import { navigate } from "vike/client/router";
import { Megaphone, Plus, Sparkles } from "lucide-react";
import type { RestaurantAd } from "../../../../../api/types";
import { FloatingActionButton } from "../../../../../ui/actions/FloatingActionButton";
import { FoodDishCard } from "../../../../../ui/widgets/food/FoodDishCard";
import { InlineAlert } from "../../../../../ui/feedback/InlineAlert";
import { apiMessage, type AdsAPI, type Notify } from "./AnuncioEditor";

const NOOP_NOTIFY: Notify = () => undefined;

type AnunciosListProps = {
  api: AdsAPI;
  notify?: Notify;
};

function firstImage(ad: RestaurantAd): string {
  return ad.content.find((entry) => entry.type === "image")?.value ?? "";
}

const NEW_HREF = "/app/config/anuncios/nuevo";

export function AnunciosList({ api, notify = NOOP_NOTIFY }: AnunciosListProps) {
  const [ads, setAds] = useState<RestaurantAd[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.listAds();
      if (!result.success) {
        notify("error", "Anuncios", apiMessage(result, "No se pudieron cargar los anuncios"));
        setAds([]);
        return;
      }
      setAds(result.ads ?? []);
    } catch (error) {
      notify("error", "Anuncios", error instanceof Error ? error.message : "No se pudieron cargar los anuncios");
    } finally {
      setLoading(false);
    }
  }, [api, notify]);

  useEffect(() => { void load(); }, [load]);

  const sorted = useMemo(
    () => [...ads].sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name, "es")),
    [ads],
  );

  const fab = (
    <FloatingActionButton
      icon={<Plus size={24} aria-hidden="true" />}
      aria-label="Crear anuncio"
      onClick={() => { void navigate(NEW_HREF); }}
      data-testid="ad-create"
      data-role="ad-list-create-btn"
      className="bo-anunciosFab"
    />
  );

  if (loading) {
    return (
      <section aria-label="Anuncios" data-testid="config-anuncios">
        <InlineAlert kind="info" title="Cargando" message="Recuperando la lista de anuncios del restaurante." />
        {fab}
      </section>
    );
  }

  if (sorted.length === 0) {
    return (
      <section aria-label="Anuncios" className="grid gap-6" data-testid="config-anuncios">
        <div className="bo-anunciosEmpty" data-ui="anuncios-empty" data-testid="anuncios-empty">
          <div className="bo-anunciosEmptyIcon" aria-hidden="true">
            <Sparkles size={28} />
          </div>
          <div className="bo-anunciosEmptyTitle">Aún no hay anuncios</div>
          <p className="bo-anunciosEmptyHint" data-role="anuncios-empty-hint">
            Crea tu primer anuncio con el botón <Plus size={14} aria-hidden="true" className="inline align-middle" /> para empezar a publicar promociones, eventos o menús en la web del restaurante.
          </p>
        </div>
        {fab}
      </section>
    );
  }

  return (
    <section aria-label="Anuncios" className="grid gap-4" data-testid="config-anuncios">
      <div className="bo-anunciosListHead" data-slot="anuncios-list-head">
        <Megaphone size={18} aria-hidden="true" className="shrink-0 text-bo-accent" />
        <h2 className="bo-anunciosListTitle">Tus anuncios</h2>
        <span className="bo-anunciosListCount" data-slot="anuncios-list-count">{sorted.length}</span>
      </div>

      <div className="bo-foodGrid" role="list" data-ui="anuncios-grid" data-testid="anuncios-grid">
        {sorted.map((ad) => (
          <FoodDishCard
            key={ad.id}
            title={ad.name}
            imageUrl={firstImage(ad) || null}
            inactive={!ad.active}
            onOpen={() => { void navigate(`/app/config/anuncios/${ad.id}`); }}
            openAriaLabel={`Abrir detalle de ${ad.name}`}
            testId={`ad-card-${ad.id}`}
          />
        ))}
      </div>

      {fab}
    </section>
  );
}
