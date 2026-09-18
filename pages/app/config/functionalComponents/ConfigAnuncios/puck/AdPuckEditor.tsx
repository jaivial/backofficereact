// Coordination id: puck_alt_v1 - Puck-based alternative ad editor (MIT).
// Stateless: Puck owns draft state; parent autosaves via onChange.
import React, { Suspense } from "react";
import type { RestaurantAd } from "../../../../../../api/types";
import { adToPuck, puckToAdInput } from "./adPuckMapper";
import { buildAdPuckConfig } from "./adPuckConfig";

export type AdPuckEditorProps = {
  ad: RestaurantAd;
  website: string;
  onChange: (next: RestaurantAd) => void;
  onImagePick?: () => void;
};

// Literal specifier so Vite can pre-bundle it; boundary covers a missing dep.
const PuckLazy: any = React.lazy(() =>
  import("@puckeditor/core").then((mod: any) => ({ default: mod.Puck ?? mod.default })),
);

class PuckBoundary extends React.Component<{ fallback: React.ReactNode; children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

const MISSING = (
  <p data-testid="ad-puck-missing" data-slot="ad-puck-missing">
    Editor visual no disponible
  </p>
);

export function AdPuckEditor({ ad, website, onChange, onImagePick }: AdPuckEditorProps): React.JSX.Element {
  const config = React.useMemo(() => buildAdPuckConfig({ onImagePick }), [onImagePick]);
  const data = React.useMemo(() => adToPuck(ad), [ad]);
  const handle = React.useCallback(
    (state: unknown) => {
      const d = (state as { data?: unknown })?.data ?? state;
      onChange({ ...ad, ...puckToAdInput(d as Parameters<typeof puckToAdInput>[0], ad) });
    },
    [ad, onChange],
  );
  return (
    <section data-testid="ad-puck-editor" data-slot="ad-puck-editor" data-coord="puck_alt_v1" data-website={website}>
      <p data-testid="ad-puck-note" data-slot="ad-puck-note">
        Alternativa Puck (MIT)
      </p>
      <div data-testid="ad-puck-canvas" data-slot="ad-puck-canvas">
        <PuckBoundary fallback={MISSING}>
          <Suspense fallback={<p data-testid="ad-puck-loading">Cargando editor visual…</p>}>
            <PuckLazy config={config} data={data} onChange={handle} onPublish={handle} />
          </Suspense>
        </PuckBoundary>
      </div>
    </section>
  );
}
