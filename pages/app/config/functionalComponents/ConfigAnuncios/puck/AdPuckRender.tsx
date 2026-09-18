import React, { Suspense } from "react";
import type { RestaurantAd } from "../../../../../../api/types";
import { adToPuck } from "./adPuckMapper";
import { buildAdPuckConfig } from "./adPuckConfig";

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

// Literal specifier so Vite can pre-bundle it; boundary falls back to PlainAd.
const RenderLazy: any = React.lazy(() =>
  import("@puckeditor/core").then((mod: any) => ({ default: mod.Render })),
);

class PuckBoundary extends React.Component<{ fallback: React.ReactNode; children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

export function AdPuckRender({ ad }: { ad: RestaurantAd }) {
  const data = React.useMemo(() => adToPuck(ad), [ad]);
  const config = React.useMemo(() => buildAdPuckConfig({}), []);
  return (
    <article data-testid="ad-puck-render" data-slot="ad-puck-render" data-coord="puck_alt_v1" className="bo-puckAlt">
      <div data-testid="ad-puck-bar" data-slot="ad-puck-bar" className="bo-puckAltBar">
        <span data-testid="ad-puck-render-note" className="bo-puckAltNote">Vista previa</span>
      </div>
      <PuckBoundary fallback={<PlainAd ad={ad} />}>
        <Suspense fallback={<PlainAd ad={ad} />}>
          <RenderLazy data-testid="ad-puck-canvas" config={config} data={data} />
        </Suspense>
      </PuckBoundary>
    </article>
  );
}
