import type {
  RestaurantAd,
  RestaurantAdContentType,
  RestaurantAdCTA,
  RestaurantAdInput,
  RestaurantAdTextAlign,
} from "../../../../../../api/types";

// Coordination id: puck_alt_v1 - Puck-native mapping. Puck speaks
// { content: [{ type, props }], root: { props } }; ad bodies map to
// AdTitle/AdSubtitle/AdText/AdImage items and CTAs to AdButton items.

export type PuckAdItem = {
  type: string;
  props: { id: string; value?: string; text?: string; color?: string; align?: string };
};

export type PuckAdData = {
  content: PuckAdItem[];
  root: { props: { name: string; active: boolean } };
};

const KIND_TO_COMPONENT: Record<RestaurantAdContentType, string> = {
  title: "AdTitle",
  subtitle: "AdSubtitle",
  text: "AdText",
  image: "AdImage",
};

const COMPONENT_TO_KIND: Record<string, RestaurantAdContentType> = {
  AdTitle: "title",
  AdSubtitle: "subtitle",
  AdText: "text",
  AdImage: "image",
};

function toAlign(value: unknown): RestaurantAdTextAlign {
  return value === "center" || value === "right" ? value : "left";
}

export function adToPuck(ad: RestaurantAd): PuckAdData {
  const extra = ad.layout?.mode === "multiple" ? ad.layout.steps[0]?.content ?? [] : [];
  return {
    content: [
      ...[...ad.content, ...extra].map((e) => ({
        type: KIND_TO_COMPONENT[e.type] ?? "AdText",
        props: { id: e.id, value: e.value, align: e.align ?? "left" },
      })),
      ...ad.ctas.map((c) => ({
        type: "AdButton",
        props: { id: c.id, text: c.text, color: c.color },
      })),
    ],
    root: { props: { name: ad.name, active: ad.active } },
  };
}

export function puckToAdInput(data: PuckAdData, base: RestaurantAd): RestaurantAdInput {
  const contentById = new Map(base.content.map((e) => [e.id, e]));
  const ctaById = new Map(base.ctas.map((c) => [c.id, c]));
  const content: RestaurantAd["content"] = [];
  const ctas: RestaurantAdCTA[] = [];
  for (const n of data.content ?? []) {
    if (n.type === "AdButton") {
      const prev = ctaById.get(n.props.id);
      ctas.push({
        id: n.props.id,
        text: n.props.text ?? "",
        color: n.props.color ?? "#436754",
        navigation_mode: prev?.navigation_mode ?? "route",
        route: prev?.route ?? "",
        custom_url: prev?.custom_url ?? "",
      });
      continue;
    }
    const prev = contentById.get(n.props.id);
    content.push({
      id: n.props.id,
      type: COMPONENT_TO_KIND[n.type] ?? "text",
      value: n.props.value ?? "",
      align: toAlign(n.props.align),
      size: prev?.size,
      style: prev?.style,
    });
  }
  return {
    name: data.root.props.name,
    active: data.root.props.active,
    content,
    ctas,
    starts_at: base.starts_at,
    ends_at: base.ends_at,
    layout: base.layout,
  };
}
