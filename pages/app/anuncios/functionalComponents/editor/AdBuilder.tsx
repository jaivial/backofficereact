import React, { useMemo } from "react";
import {
  AlignLeft, CalendarDays, Columns2, Euro, Heading, Image as ImageIcon, LayoutTemplate, List, Minus, MousePointerClick,
  PanelsTopLeft, Space, SquareMousePointer, Ticket,
} from "lucide-react";
import type { RestaurantAdDesignContainer } from "../../../../../api/types";
import { createClient } from "../../../../../api/client";
import { HtmlBuilder, type BuilderProfile } from "../../../../../ui/htmlBuilder/HtmlBuilder";
import type { ImageAI } from "../../../../../ui/htmlBuilder/BuilderInspector";
import type { BuilderDevice } from "../../../../../ui/htmlBuilder/BuilderCanvas";
import type { BlockContext } from "../../../../../ui/htmlBuilder/blocks";
import type { BlockIcon } from "../../../../../ui/htmlBuilder/BuilderPanels";
import { useBuilderTestId } from "../../../../../ui/htmlBuilder/testIds";
import { AD_STEP_ATTR, adBlocksFor, newStepId, type AdBlockKind } from "./adBlocks";
import { AD_DEFAULT_OVERLAY } from "./adDesign";
import { AD_BACKDROP_BLUR, AD_DEVICE_WIDTHS, AD_VIEWPORT, AdChrome, WebsiteBackdrop, adSheetWidth, websiteBase } from "./AdStage";

/*
 * Ad profile of the shared HTML builder (ads_html_editor_v1): ad blocks, the
 * page drawn as the window over the real website at the device size, card
 * controls on the cards page of a multiple ad and the ads design AI.
 */

export type AdBuilderPage = "single" | "cards" | "step";

type Props = {
  value: string;
  onChange: (html: string) => void;
  context: BlockContext;
  coordId: string;
  website: string;
  container: RestaurantAdDesignContainer;
  page: AdBuilderPage;
  device: BuilderDevice;
  onDeviceChange: (device: BuilderDevice) => void;
  /** Title of a step (cards page: what a card opens). */
  stepTitle: (id: string) => string;
  onOpenStep: (id: string) => void;
  onUploadImage?: (file: File) => Promise<string>;
  imageAI?: ImageAI;
};

const AD_BLOCK_ICONS: Record<AdBlockKind, BlockIcon> = {
  hero: LayoutTemplate,
  heading: Heading,
  text: AlignLeft,
  button: MousePointerClick,
  buttons: PanelsTopLeft,
  image: ImageIcon,
  columns: Columns2,
  list: List,
  price: Euro,
  date: CalendarDays,
  coupon: Ticket,
  divider: Minus,
  spacer: Space,
  card: SquareMousePointer,
};

// Cards are outlined on the canvas (never on the website: editing CSS only).
const CARD_HINT_CSS = `[${AD_STEP_ATTR}]{outline:2px dashed rgba(124,92,255,.75);outline-offset:3px}`;

const SUGGESTIONS: Record<AdBuilderPage, string[]> = {
  single: [
    "Hazlo más llamativo, con el titular más grande y un botón de reservar bien visible",
    "Añade la fecha del evento y el precio por persona",
    "Cambia la paleta a tonos cálidos mediterráneos",
    "Hazlo más corto: un titular, una frase y un botón",
  ],
  cards: [
    "Haz las tarjetas horizontales, con la imagen a la izquierda",
    "Añade una tarjeta más para el menú de Reyes",
    "Pon un titular más atractivo encima de las tarjetas",
    "Cambia los colores a verde oscuro y dorado",
  ],
  step: [
    "Añade el precio y un botón para reservar",
    "Añade una lista con los platos del menú",
    "Pon la imagen a la izquierda y el texto a la derecha en escritorio",
    "Hazlo más elegante, con más aire",
  ],
};

/** Card controls of the cards page: what a card opens, make / unmake cards. */
function CardControl({ el, update, page, stepTitle, onOpenStep }: { el: Element; update: (fn: (node: HTMLElement) => void) => void; page: AdBuilderPage; stepTitle: (id: string) => string; onOpenStep: (id: string) => void }) {
  const tp = useBuilderTestId();
  if (page !== "cards") return null;
  const card = el.closest(`[${AD_STEP_ATTR}]`);
  const id = card?.getAttribute(AD_STEP_ATTR) ?? "";
  return (
    <>
      <span className="mt-1 text-[11px] font-medium text-bo-muted" data-testid={`${tp}-inspector-card-caption`}>Tarjeta de paso</span>
      {card ? (
        <>
          <p className="m-0 text-[11px] leading-snug text-bo-faint" data-testid={`${tp}-inspector-card-help`}>
            {card === el ? "Este elemento es una tarjeta" : "Está dentro de una tarjeta"}: al pulsarla se abre «{stepTitle(id) || id}».
          </p>
          <div className="flex flex-wrap gap-1.5" data-testid={`${tp}-inspector-card-actions`}>
            <button type="button" onClick={() => onOpenStep(id)} className="bo-btn bo-btn--secondary bo-btn--sm" data-testid={`${tp}-inspector-card-open`}>
              Editar su página
            </button>
            {card === el && (
              <button type="button" onClick={() => update((node) => node.removeAttribute(AD_STEP_ATTR))} className="bo-btn bo-btn--ghost bo-btn--sm" data-testid={`${tp}-inspector-card-unset`}>
                Dejar de ser tarjeta
              </button>
            )}
          </div>
        </>
      ) : (
        <>
          <p className="m-0 text-[11px] leading-snug text-bo-faint" data-testid={`${tp}-inspector-card-help`}>
            Conviértelo en tarjeta para que abra su propia página de detalle.
          </p>
          <button type="button" onClick={() => update((node) => node.setAttribute(AD_STEP_ATTR, newStepId()))} className="bo-btn bo-btn--secondary bo-btn--sm w-fit" data-testid={`${tp}-inspector-card-set`}>
            Convertir en tarjeta
          </button>
        </>
      )}
    </>
  );
}

export function AdBuilder({ value, onChange, context, coordId, website, container, page, device, onDeviceChange, stepTitle, onOpenStep, onUploadImage, imageAI }: Props) {
  const api = useMemo(() => createClient({ baseUrl: "" }).config, []);
  const site = websiteBase(website);
  const ai = useMemo<BuilderProfile["ai"]>(
    () => ({
      ariaLabel: "Asistente IA del anuncio",
      suggestions: SUGGESTIONS[page],
      models: () => api.adAIModels().then((res) => (res.success ? { models: res.models ?? [], default: res.default ?? "" } : null)),
      chat: (input) =>
        api.adAIChat(input).then((res) =>
          res.success ? { success: true as const, reply: res.reply, html: res.html, model: res.model } : { success: false as const, message: "message" in res ? res.message : undefined },
        ),
    }),
    [api, page],
  );
  const backdrop = useMemo(() => <WebsiteBackdrop website={website} testId="ad-builder-stage-site" />, [website]);
  const profile = useMemo<BuilderProfile>(
    () => ({
      testIdPrefix: "ad-builder",
      rootTestId: "ad-content-panel",
      blocks: adBlocksFor(page),
      blockIcons: AD_BLOCK_ICONS,
      canvasCss: page === "cards" ? CARD_HINT_CSS : "",
      linkPresets: site
        ? [
            { id: "reservas", label: "Reservar", href: `${site}/reservas` },
            { id: "menus", label: "Menús", href: `${site}/menus` },
          ]
        : [],
      extraVisibility: (el, update) => <CardControl el={el} update={update} page={page} stepTitle={stepTitle} onOpenStep={onOpenStep} />,
      ai,
      modes: ["design", "code"],
      deviceWidths: AD_DEVICE_WIDTHS,
      stage: (d) => ({
        viewport: AD_VIEWPORT[d],
        sheetWidth: adSheetWidth(d, container),
        backdrop,
        overlay: container.overlay || AD_DEFAULT_OVERLAY,
        radius: container.radius ?? 24,
        blur: AD_BACKDROP_BLUR,
        background: container.background || "#ffffff",
        chrome: <AdChrome back={page === "step"} testId="ad-builder-stage-chrome" />,
        label: `${AD_VIEWPORT[d].label} · ${AD_VIEWPORT[d].width} × ${AD_VIEWPORT[d].height} · ventana ${adSheetWidth(d, container)}px`,
      }),
    }),
    [ai, backdrop, container, onOpenStep, page, site, stepTitle],
  );
  return (
    <HtmlBuilder
      value={value}
      onChange={onChange}
      context={context}
      coordId={coordId}
      onUploadImage={onUploadImage}
      imageAI={imageAI}
      profile={profile}
      device={device}
      onDeviceChange={onDeviceChange}
    />
  );
}
