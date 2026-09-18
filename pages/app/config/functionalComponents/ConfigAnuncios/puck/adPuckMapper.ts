import type { RestaurantAd, RestaurantAdInput } from "../../../../../../api/types";

export type PuckAdData = {
  content: Array<{ props: { id: string; kind: string; value: string; align: string } }>;
  buttons: Array<{ props: { id: string; text: string; color: string; width?: number } }>;
  root: { props: { name: string; active: boolean } };
};

export function adToPuck(ad: RestaurantAd): PuckAdData {
  const extra = ad.layout?.mode === "multiple" ? ad.layout.steps[0]?.content ?? [] : [];
  return {
    content: [...ad.content, ...extra].map((e) => ({
      props: { id: e.id, kind: e.type, value: e.value, align: e.align ?? "center" },
    })),
    buttons: ad.ctas.map((c) => ({ props: { id: c.id, text: c.text, color: c.color, width: c.width } })),
    root: { props: { name: ad.name, active: ad.active } },
  };
}

export function puckToAdInput(data: PuckAdData, base: RestaurantAd): RestaurantAdInput {
  const byId = new Map(base.content.map((e) => [e.id, e]));
  const ctaById = new Map(base.ctas.map((c) => [c.id, c]));
  return {
    name: data.root.props.name,
    active: data.root.props.active,
    content: data.content.map((n) => {
      const prev = byId.get(n.props.id);
      const t = n.props.kind === "title" || n.props.kind === "subtitle" || n.props.kind === "text" || n.props.kind === "image" ? n.props.kind : "text";
      return { id: n.props.id, type: t, value: n.props.value, align: (n.props.align as "left" | "center" | "right") ?? "center", size: prev?.size, style: prev?.style };
    }),
    ctas: data.buttons.map((n) => {
      const prev = ctaById.get(n.props.id);
      return { id: n.props.id, text: n.props.text, color: n.props.color, navigation_mode: prev?.navigation_mode ?? "route", route: prev?.route ?? "", custom_url: prev?.custom_url ?? "", width: n.props.width };
    }),
    starts_at: base.starts_at,
    ends_at: base.ends_at,
    layout: base.layout,
  };
}
