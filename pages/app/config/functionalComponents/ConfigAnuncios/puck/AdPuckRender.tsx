import { Suspense, useEffect, useState } from "react";
import type { RestaurantAd } from "../../../../../../api/types";

// coord id puck_alt_v1: read-only Puck preview, plain-markup fallback.
function PlainAd({ ad }: { ad: RestaurantAd }) {
  return (
    <div data-testid="ad-puck-plain" data-slot="ad-puck-plain">
      {(ad.content ?? []).map((c) =>
        c.type === "image" ? (
          <img key={c.id} data-testid={`ad-puck-img-${c.id}`} src={c.value} alt="" />
        ) : c.type === "title" ? (
          <h2 key={c.id} data-testid={`ad-puck-title-${c.id}`} style={{ textAlign: c.align ?? "left" }}>{c.value}</h2>
        ) : (
          <p key={c.id} data-testid={`ad-puck-text-${c.id}`} style={{ textAlign: c.align ?? "left" }}>{c.value}</p>
        ),
      )}
      <div data-testid="ad-puck-ctas" data-slot="ad-puck-ctas">
        {(ad.ctas ?? []).map((b) => (
          <a key={b.id} data-testid={`ad-puck-cta-${b.id}`} style={{ background: b.color }}>{b.text}</a>
        ))}
      </div>
    </div>
  );
}

const PUCK_SPEC = "@puckeditor/core";
const MAPPER_SPEC = "./adPuckMapper";
const CONFIG_SPEC = "./adPuckConfig";

export function AdPuckRender({ ad }: { ad: RestaurantAd }) {
  const [view, setView] = useState<{ Render: any; config: any; data: any } | null>(null);
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const [core, mapper, cfg] = await Promise.all([import(/* @vite-ignore */ PUCK_SPEC), import(/* @vite-ignore */ MAPPER_SPEC), import(/* @vite-ignore */ CONFIG_SPEC)]);
        if (!live) return;
        setView({ Render: core.Render, config: cfg.buildAdPuckConfig(), data: mapper.adToPuck(ad) });
      } catch { if (live) setView(null); }
    })();
    return () => { live = false; };
  }, [ad]);
  return (
    <article data-testid="ad-puck-render" data-slot="ad-puck-render" data-coord="puck_alt_v1" className="bo-puckAlt">
      <div data-testid="ad-puck-bar" data-slot="ad-puck-bar" className="bo-puckAltBar">
        <span data-testid="ad-puck-note" className="bo-puckAltNote">Vista previa</span>
      </div>
      {!view ? <PlainAd ad={ad} /> : (
        <Suspense fallback={<PlainAd ad={ad} />}>
          <view.Render data-testid="ad-puck-canvas" config={view.config} data={view.data} />
        </Suspense>
      )}
    </article>
  );
}
