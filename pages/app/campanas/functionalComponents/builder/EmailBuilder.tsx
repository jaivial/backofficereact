import React, { useMemo } from "react";
import {
  AlignLeft, Columns2, Heading, Image as ImageIcon, LayoutTemplate, List, Minus, MousePointerClick,
  PanelBottom, PanelTop, Quote, Space, Ticket,
} from "lucide-react";
import { createClient } from "../../../../../api/client";
import { HtmlBuilder, type BuilderProfile } from "../../../../../ui/htmlBuilder/HtmlBuilder";
import type { BlockIcon } from "../../../../../ui/htmlBuilder/BuilderPanels";
import { Segmented } from "../../../../../ui/htmlBuilder/BuilderInspector";
import { UNSUBSCRIBE_PLACEHOLDER, readChannel, writeChannel, type BlockChannel } from "../../../../../ui/htmlBuilder/document";
import { useBuilderTestId } from "../../../../../ui/htmlBuilder/testIds";
import { EMAIL_BLOCKS, type BlockContext, type BlockKind } from "./emailBuilderBlocks";
import { compileCampaignEmail, fillPreviewPlaceholders } from "./emailBuilderCompile";

/*
 * Campaign profile of the shared HTML builder (campaign_html_builder_v1,
 * html_builder_shared_v1): email blocks, the email compiled by the server as
 * "Vista previa", the per-block channel (email / WhatsApp), the opt-out link
 * shortcut and the campaign AI assistant.
 */

type Props = {
  /** Stored design (no editing ids); empty while the seed is not ready. */
  value: string;
  onChange: (html: string) => void;
  context: BlockContext;
  subject: string;
  coordId: string;
  unsubscribePreviewUrl: string;
  onUploadImage?: (file: File) => Promise<string>;
};

const EMAIL_BLOCK_ICONS: Record<BlockKind, BlockIcon> = {
  header: PanelTop,
  hero: LayoutTemplate,
  heading: Heading,
  text: AlignLeft,
  button: MousePointerClick,
  image: ImageIcon,
  columns: Columns2,
  list: List,
  coupon: Ticket,
  quote: Quote,
  divider: Minus,
  spacer: Space,
  footer: PanelBottom,
};

// campaign_block_channel_v1: blocks sent on one channel only are flagged on the
// canvas (never in the email: the compiler drops data-eb-* and the blocks).
const CHANNEL_HINT_CSS =
  '[data-eb-channel="whatsapp"]{outline:2px dashed #25d366;outline-offset:-2px}' +
  '[data-eb-channel="email"]{outline:2px dashed #60a5fa;outline-offset:-2px}' +
  '[data-eb-channel]::before{display:block;width:max-content;margin:0 0 4px;padding:1px 6px;border-radius:4px;font:600 10px/1.6 system-ui,sans-serif;letter-spacing:.02em}' +
  '[data-eb-channel="whatsapp"]::before{content:"Solo WhatsApp";color:#0f6b3a;background:#dcf8e6}' +
  '[data-eb-channel="email"]::before{content:"Solo email";color:#1e4f9a;background:#dbeafe}';

const SUGGESTIONS = [
  "Hazlo más elegante, con más aire y una tipografía más grande en el titular",
  "Añade una sección de 3 platos destacados en columnas",
  "Cambia la paleta a tonos cálidos mediterráneos",
  "Añade un cupón del 10 % y un botón para reservar",
];

/** campaign_block_channel_v1: one design, two channels. */
function ChannelControl({ el, update }: { el: Element; update: (fn: (node: HTMLElement) => void) => void }) {
  const tp = useBuilderTestId();
  return (
    <>
      <span className="mt-1 text-[11px] font-medium text-bo-muted" data-testid={`${tp}-inspector-channel-caption`}>Canal de envío</span>
      <Segmented<BlockChannel>
        label="Canal de envío"
        value={readChannel(el)}
        onChange={(v) => update((node) => writeChannel(node, v))}
        options={[
          { value: "all", label: "Ambos", title: "Se envía por email y por WhatsApp" },
          { value: "email", label: "Email", title: "Solo en el email: no aparece en el WhatsApp" },
          { value: "whatsapp", label: "WhatsApp", title: "Solo en el WhatsApp: no aparece en el email" },
        ]}
        testId={`${tp}-inspector-channel-mode`}
      />
      <p className="m-0 text-[11px] leading-snug text-bo-faint" data-testid={`${tp}-inspector-channel-help`}>
        Así el WhatsApp puede ser una versión breve del email.
      </p>
    </>
  );
}

export function EmailBuilder({ value, onChange, context, subject, coordId, unsubscribePreviewUrl, onUploadImage }: Props) {
  const api = useMemo(() => createClient({ baseUrl: "" }).config, []);
  const profile = useMemo<BuilderProfile>(
    () => ({
      testIdPrefix: "email-builder",
      rootTestId: "campaign-content-panel",
      blocks: EMAIL_BLOCKS,
      blockIcons: EMAIL_BLOCK_ICONS,
      preview: (design, signal) =>
        compileCampaignEmail(design, subject || "Campaña", coordId, signal).then((html) => fillPreviewPlaceholders(html, unsubscribePreviewUrl)),
      previewWaitLabel: "Compilando el email…",
      previewErrorLabel: "No se pudo compilar el email",
      canvasCss: CHANNEL_HINT_CSS,
      linkPresets: [{ id: "unsubscribe", label: "Enlace de baja", href: UNSUBSCRIBE_PLACEHOLDER }],
      extraVisibility: (el, update) => <ChannelControl el={el} update={update} />,
      ai: {
        ariaLabel: "Asistente IA del email",
        suggestions: SUGGESTIONS,
        models: () => api.campaignAIModels().then((res) => (res.success ? { models: res.models ?? [], default: res.default ?? "" } : null)),
        chat: (input) =>
          api.campaignAIChat(input).then((res) =>
            res.success ? { success: true as const, reply: res.reply, html: res.html, model: res.model } : { success: false as const, message: "message" in res ? res.message : undefined },
          ),
      },
    }),
    [api, coordId, subject, unsubscribePreviewUrl],
  );
  return <HtmlBuilder value={value} onChange={onChange} context={context} coordId={coordId} onUploadImage={onUploadImage} profile={profile} />;
}
