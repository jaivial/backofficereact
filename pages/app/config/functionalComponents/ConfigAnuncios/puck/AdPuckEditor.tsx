// Coordination id: puck_alt_v1 - Puck-based alternative ad editor (MIT).
// Stateless: Puck owns draft state; parent autosaves via onChange.
import React, { Suspense } from "react";
import type { RestaurantAd, RestaurantAdContentElement } from "../../../../../../api/types";

export type AdPuckEditorProps = {
  ad: RestaurantAd;
  website: string;
  onChange: (next: RestaurantAd) => void;
  onImagePick?: () => void;
};

type PuckNode = { type: string; props: Record<string, any> };
type PuckData = { content: PuckNode[]; root: { props: Record<string, unknown> } };
type SibMods = { toPuck: (ad: RestaurantAd) => any; fromPuck: (data: unknown, base: RestaurantAd) => Partial<RestaurantAd>; buildCfg: (opts: { onImagePick?: () => void }) => any };

const puckPkg = "@puckeditor/core";
const mapperPath = "./adPuckMapper";
const configPath = "./adPuckConfig";

function AdPuckMissing(): React.JSX.Element {
  return (
    <p data-testid="ad-puck-missing" data-slot="ad-puck-missing">
      Editor visual no disponible
    </p>
  );
}

const PuckLazy: any = React.lazy(async () => {
  try {
    const mod: any = await import(/* @vite-ignore */ puckPkg);
    return { default: mod.Puck ?? mod.default };
  } catch {
    return { default: AdPuckMissing };
  }
});

function adToPuckFallback(ad: RestaurantAd): PuckData {
  return {
    content: ad.content.map((c) => ({ type: c.type, props: { ...c } })),
    root: { props: { title: ad.name } },
  };
}

function puckToAdInputFallback(data: unknown, base: RestaurantAd): Partial<RestaurantAd> {
  const d = data as Partial<PuckData> | null;
  if (!d || !Array.isArray(d.content)) return {};
  const allowed = new Set(["title", "subtitle", "text", "image"]);
  const content = (d.content as PuckNode[])
    .filter((n) => n && allowed.has(n.type))
    .map((n, i) => ({
      id: String(n.props?.id ?? `${n.type}-${i}`),
      type: n.type,
      value: String(n.props?.value ?? ""),
    })) as RestaurantAdContentElement[];
  return { content, ctas: base.ctas };
}

function buildAdPuckConfigFallback(_opts: { onImagePick?: () => void }): Record<string, unknown> {
  return { components: {} };
}

export function AdPuckEditor({ ad, website, onChange, onImagePick }: AdPuckEditorProps): React.JSX.Element {
  const [sib, setSib] = React.useState<SibMods | null>(null);
  React.useEffect(() => {
    let on = true;
    (async () => {
      try {
        const [m, c]: any[] = await Promise.all([import(/* @vite-ignore */ mapperPath), import(/* @vite-ignore */ configPath)]);
        if (on && m?.adToPuck && m?.puckToAdInput && c?.buildAdPuckConfig) {
          setSib({ toPuck: m.adToPuck, fromPuck: m.puckToAdInput, buildCfg: c.buildAdPuckConfig });
        }
      } catch {
        /* minimal local mapping stays */
      }
    })();
    return () => {
      on = false;
    };
  }, []);
  const toPuck = sib?.toPuck ?? adToPuckFallback;
  const fromPuck = sib?.fromPuck ?? puckToAdInputFallback;
  const buildCfg = sib?.buildCfg ?? buildAdPuckConfigFallback;
  const config = React.useMemo(() => buildCfg({ onImagePick }), [buildCfg, onImagePick]);
  const data = React.useMemo(() => toPuck(ad), [toPuck, ad]);
  const handle = React.useCallback(
    (next: unknown) => {
      onChange({ ...ad, ...fromPuck(next, ad) });
    },
    [ad, fromPuck, onChange],
  );
  return (
    <section data-testid="ad-puck-editor" data-slot="ad-puck-editor" data-coord="puck_alt_v1" data-website={website}>
      <p data-testid="ad-puck-note" data-slot="ad-puck-note">
        Alternativa Puck (MIT)
      </p>
      <div data-testid="ad-puck-canvas" data-slot="ad-puck-canvas">
        <Suspense fallback={<p data-testid="ad-puck-loading">Cargando editor visual…</p>}>
          <PuckLazy config={config} data={data} onChange={handle} onPublish={handle} />
        </Suspense>
      </div>
    </section>
  );
}
