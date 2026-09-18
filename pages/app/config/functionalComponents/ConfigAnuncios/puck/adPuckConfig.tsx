// coord id puck_alt_v1 (also data-puck-alt="puck_alt_v1")
import type { Config } from "@puckeditor/core";
type F = Record<string, any>;
const f = (t: string, label: string, extra?: F): F => ({ type: t, label, ...extra });
const ALIGN_OPTIONS = [
  { label: "Izq", value: "left" },
  { label: "Cen", value: "center" },
  { label: "Der", value: "right" },
];
export function buildAdPuckConfig(_deps: { onImagePick?: () => void }): Config {
  return { components: {
    AdTitle: { fields: { id: f("text", "Id"), value: f("textarea", "Title"), align: f("radio", "Align", { options: ALIGN_OPTIONS }) },
      render: ({ value, align }: any) => (<h2 data-testid="puck-ad-title" data-slot="title" data-puck-alt="puck_alt_v1" style={{ textAlign: align ?? "left" }}>{value}</h2>) },
    AdSubtitle: { fields: { id: f("text", "Id"), value: f("textarea", "Subtitle"), align: f("radio", "Align", { options: ALIGN_OPTIONS }) },
      render: ({ value, align }: any) => (<h3 data-testid="puck-ad-subtitle" data-slot="subtitle" data-puck-alt="puck_alt_v1" style={{ textAlign: align ?? "left" }}>{value}</h3>) },
    AdText: { fields: { id: f("text", "Id"), value: f("textarea", "Text"), align: f("radio", "Align", { options: ALIGN_OPTIONS }) },
      render: ({ value, align }: any) => (<p data-testid="puck-ad-text" data-slot="text" data-puck-alt="puck_alt_v1" style={{ textAlign: align ?? "left" }}>{value}</p>) },
    AdImage: { fields: { id: f("text", "Id"), value: f("text", "URL") },
      render: ({ value }: any) => (<img data-testid="puck-ad-image" data-slot="image" data-puck-alt="puck_alt_v1" src={value} alt="" />) },
    AdButton: { fields: { id: f("text", "Id"), text: f("text", "Text"), color: f("text", "Color") },
      render: ({ text, color }: any) => (<a data-testid="puck-ad-button" data-slot="cta" data-puck-alt="puck_alt_v1" style={{ background: color }}>{text}</a>) },
  }, root: { fields: { name: f("text", "Name"), active: f("radio", "Active", { options: [{ label: "Sí", value: true }, { label: "No", value: false }] }) } } } as unknown as Config;
}
