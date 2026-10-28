import React, { useMemo } from "react";
import {
  AlignLeft, CalendarDays, Columns2, Euro, Heading, Image as ImageIcon, LayoutTemplate, List, Minus, MousePointerClick,
  PanelsTopLeft, Space, SquareMousePointer, Ticket,
} from "lucide-react";
import type { RestaurantAdDesignContainer } from "../../../../../api/types";
import { createClient } from "../../../../../api/client";
import { HtmlBuilder, type BuilderProfile } from "../../../../../ui/htmlBuilder/HtmlBuilder";
import type { BuilderDevice } from "../../../../../ui/htmlBuilder/BuilderCanvas";
import type { BlockContext } from "../../../../../ui/htmlBuilder/blocks";
import type { BlockIcon } from "../../../../../ui/htmlBuilder/BuilderPanels";
import { useBuilderTestId } from "../../../../../ui/htmlBuilder/testIds";
import { InspectorSection, Segmented, type ImageAI } from "../../../../../ui/htmlBuilder/BuilderInspector";
import { applyCardDesign, cardGroupOf, matchCardsTo, readCardDesign, type CardColumns, type CardDesign, type CardImageSize, type CardLayout, type CardMore, type CardWidth } from "./adCards";
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

/** Non-card elements of the cards page can become a card (under «Visibilidad»). */
function MakeCardControl({ el, update, page }: { el: Element; update: (fn: (node: HTMLElement) => void) => void; page: AdBuilderPage }) {
  const tp = useBuilderTestId();
  if (page !== "cards" || el.closest(`[${AD_STEP_ATTR}]`) || el.querySelector(`[${AD_STEP_ATTR}]`)) return null;
  return (
    <>
      <span className="mt-1 text-[11px] font-medium text-bo-muted" data-testid={`${tp}-inspector-card-caption`}>Tarjeta de paso</span>
      <p className="m-0 text-[11px] leading-snug text-bo-faint" data-testid={`${tp}-inspector-card-help`}>
        Conviértelo en tarjeta para que abra su propia página de detalle.
      </p>
      <button type="button" onClick={() => update((node) => node.setAttribute(AD_STEP_ATTR, newStepId()))} className="bo-btn bo-btn--secondary bo-btn--sm w-fit" data-testid={`${tp}-inspector-card-set`}>
        Convertir en tarjeta
      </button>
    </>
  );
}

/**
 * «Tarjetas» at the top of the inspector (cards page): what the selected card
 * opens, and the design of every card of its grid at once: layout, image
 * size, columns, width, the «Ver más» and «Igualar las demás a esta».
 */
function CardsSection({ el, update, page, stepTitle, onOpenStep }: { el: Element; update: (fn: (node: HTMLElement) => void) => void; page: AdBuilderPage; stepTitle: (id: string) => string; onOpenStep: (id: string) => void }) {
  const tp = useBuilderTestId();
  if (page !== "cards") return null;
  const group = cardGroupOf(el);
  if (!group || !group.cards.length) return null;
  const card = el.closest(`[${AD_STEP_ATTR}]`);
  const id = card?.getAttribute(AD_STEP_ATTR) ?? "";
  const design = readCardDesign(group);
  // Applied on the live node: its parent and siblings are the real grid.
  const set = (patch: Partial<CardDesign>) =>
    update((node) => {
      const g = cardGroupOf(node);
      if (g) applyCardDesign(g, patch);
    });
  const row = <T extends string>(label: string, key: keyof CardDesign, value: T, options: { value: T; label: string; title: string }[]) => (
    <div className="grid gap-1" data-testid={`${tp}-inspector-cards-${key}-row`}>
      <span className="text-[11px] font-medium text-bo-muted" data-testid={`${tp}-inspector-cards-${key}-caption`}>{label}</span>
      <Segmented<T> label={label} value={value} onChange={(v) => set({ [key]: v } as Partial<CardDesign>)} options={options} testId={`${tp}-inspector-cards-${key}`} />
    </div>
  );
  return (
    <InspectorSection title={`Tarjetas (${group.cards.length})`} testId={`${tp}-inspector-cards`}>
      {card && (
        <>
          <p className="m-0 text-[11px] leading-snug text-bo-faint" data-testid={`${tp}-inspector-card-help`}>
            {card === el ? "Esta tarjeta" : "Esta parte de una tarjeta"} abre «{stepTitle(id) || id}».
          </p>
          <div className="flex flex-wrap gap-1.5" data-testid={`${tp}-inspector-card-actions`}>
            <button type="button" onClick={() => onOpenStep(id)} className="bo-btn bo-btn--secondary bo-btn--sm" data-testid={`${tp}-inspector-card-open`}>
              Editar su página
            </button>
            {group.cards.length > 1 && (
              <button
                type="button"
                onClick={() =>
                  update((node) => {
                    const source = node.closest(`[${AD_STEP_ATTR}]`);
                    const g = cardGroupOf(node);
                    if (source && g) matchCardsTo(g, source);
                  })
                }
                title="Copia el aspecto de esta tarjeta (colores, tamaños, botón) a las demás; cada una conserva sus textos, imagen y enlace"
                className="bo-btn bo-btn--secondary bo-btn--sm"
                data-testid={`${tp}-inspector-card-match`}
              >
                Igualar las demás a esta
              </button>
            )}
            {card === el && (
              <button type="button" onClick={() => update((node) => node.removeAttribute(AD_STEP_ATTR))} className="bo-btn bo-btn--ghost bo-btn--sm" data-testid={`${tp}-inspector-card-unset`}>
                Dejar de ser tarjeta
              </button>
            )}
          </div>
        </>
      )}
      {row<CardLayout>("Disposición", "layout", design.layout, [
        { value: "horizontal", label: "Imagen al lado", title: "Imagen a la izquierda y texto a la derecha" },
        { value: "vertical", label: "Imagen arriba", title: "Imagen ancha arriba y texto debajo" },
      ])}
      {row<CardImageSize>("Tamaño de la imagen", "imageSize", design.imageSize, [
        { value: "s", label: "S", title: "Pequeña" },
        { value: "m", label: "M", title: "Mediana" },
        { value: "l", label: "L", title: "Grande" },
        { value: "xl", label: "XL", title: "Muy grande" },
      ])}
      {row<CardColumns>("Columnas (tablet y escritorio)", "columns", design.columns, [
        { value: "1", label: "1", title: "Una tarjeta por fila" },
        { value: "2", label: "2", title: "Dos tarjetas por fila" },
        { value: "3", label: "3", title: "Tres tarjetas por fila" },
      ])}
      {row<CardWidth>("Ancho de las tarjetas", "width", design.width, [
        { value: "full", label: "Completo", title: "Todo el ancho de la ventana" },
        { value: "medium", label: "Medio", title: "Centradas, hasta 576 px" },
        { value: "narrow", label: "Estrecho", title: "Centradas, hasta 448 px" },
      ])}
      {row<CardMore>("«Ver más»", "more", design.more, [
        { value: "text", label: "Texto", title: "Texto en el color del título" },
        { value: "dark", label: "Botón negro", title: "Botón negro redondeado con texto blanco" },
        { value: "light", label: "Botón claro", title: "Botón blanco redondeado con texto negro" },
      ])}
      <p className="m-0 text-[11px] leading-snug text-bo-faint" data-testid={`${tp}-inspector-cards-help`}>
        Se aplica a todas las tarjetas de la rejilla. En el móvil siempre van una debajo de otra.
      </p>
    </InspectorSection>
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
      extraVisibility: (el, update) => <MakeCardControl el={el} update={update} page={page} />,
      inspectorTop: (el, update) => <CardsSection el={el} update={update} page={page} stepTitle={stepTitle} onOpenStep={onOpenStep} />,
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
