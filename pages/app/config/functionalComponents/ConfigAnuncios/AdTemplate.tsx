import React, { useCallback, useEffect, useRef, useState } from "react";
import { Reorder, useDragControls } from "motion/react";
import { ChevronLeft, GripVertical, ImagePlus, Trash2 } from "lucide-react";
import type {
  RestaurantAd,
  RestaurantAdContentElement,
  RestaurantAdContentType,
  RestaurantAdCTA,
  RestaurantAdStep,
} from "../../../../../api/types";
import {
  asText,
  buildCTAURL,
  clamp,
  ELEMENT_MAX_HEIGHT_PX,
  ELEMENT_MAX_WIDTH_PCT,
  ELEMENT_MIN_HEIGHT_PX,
  ELEMENT_MIN_WIDTH_PCT,
  elementSize,
  elementSizeStyle,
  resizeElement,
  stepBackground,
} from "./lib/adEditor";

/* Coordination id: ads_canvas_v1 - one renderer draws the public ad template
 * three times: read-only preview, live editing canvas and wizard step. Keeping
 * the markup in one place is what makes "the preview is the editor" true. */

export const AD_CONTENT_LABEL: Record<RestaurantAdContentType, string> = {
  title: "Titulo",
  subtitle: "Subtitulo",
  text: "Texto",
  image: "Imagen",
};

type Align = "left" | "center" | "right";

/**
 * Figma-style corner handle (coord id ads_element_size_v1): dragging writes a
 * percentage width and, for images, a pixel height straight into the element
 * payload, so the box survives the save and comes back from the REST fetch.
 */
function ResizeHandle({
  hasHeight,
  onResize,
  onCommit,
}: {
  hasHeight: boolean;
  onResize: (patch: { width: number; height?: number }) => void;
  onCommit: () => void;
}) {
  const start = useRef<{ x: number; y: number; width: number; height: number; container: number } | null>(null);
  const [resizing, setResizing] = useState(false);

  const pointerDown = useCallback((event: React.PointerEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const node = (event.currentTarget as HTMLElement).closest(".bo-adNode");
    const target = node?.querySelector<HTMLElement>(".bo-adResizable") ?? null;
    start.current = {
      x: event.clientX,
      y: event.clientY,
      width: target?.offsetWidth ?? 0,
      height: target?.offsetHeight ?? 0,
      container: node?.parentElement?.clientWidth ?? 0,
    };
    setResizing(true);
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  }, []);

  const pointerMove = useCallback(
    (event: React.PointerEvent) => {
      const first = start.current;
      if (!first) return;
      const dx = event.clientX - first.x;
      const patch: { width: number; height?: number } = {
        width: clamp(((first.width + dx) / (first.container || 1)) * 100, ELEMENT_MIN_WIDTH_PCT, ELEMENT_MAX_WIDTH_PCT),
      };
      if (hasHeight) patch.height = clamp(first.height + (event.clientY - first.y), ELEMENT_MIN_HEIGHT_PX, ELEMENT_MAX_HEIGHT_PX);
      onResize(patch);
    },
    [hasHeight, onResize],
  );

  const pointerUp = useCallback(
    (event: React.PointerEvent) => {
      if (!start.current) return;
      start.current = null;
      setResizing(false);
      (event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);
      onCommit();
    },
    [onCommit],
  );

  return (
    <span
      role="separator"
      aria-label="Redimensionar elemento"
      aria-orientation="vertical"
      className={`bo-adNodeResize ${resizing ? "is-resizing" : ""}`}
      data-resizing={resizing ? "true" : "false"}
      data-testid="ad-node-resize"
      title="Arrastra para redimensionar"
      onPointerDown={pointerDown}
      onPointerMove={pointerMove}
      onPointerUp={pointerUp}
      onPointerCancel={pointerUp}
    />
  );
}

/** Inline text editing: the DOM keeps the caret while typing, props win only
 * when the field is not being edited. */
export function EditableText({
  value,
  onCommit,
  className,
  style,
  placeholder,
  ariaLabel,
  multiline,
  testId,
  readOnly = false,
}: {
  value: string;
  onCommit: (next: string) => void;
  className?: string;
  style?: React.CSSProperties;
  placeholder?: string;
  ariaLabel: string;
  multiline?: boolean;
  testId?: string;
  /** Read-only twin used by the preview: same markup, not editable. */
  readOnly?: boolean;
}) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const [editing, setEditing] = useState(false);
  const text = asText(value);

  useEffect(() => {
    const node = ref.current;
    if (!node || editing) return;
    const next = node.innerText.replace(/\n$/, "");
    if (next !== text) node.innerText = text;
  }, [text, editing]);

  const commit = useCallback(() => {
    setEditing(false);
    const next = (ref.current?.innerText ?? "").replace(/\n$/, "");
    if (next !== text) onCommit(next);
  }, [onCommit, text]);

  return (
    <span
      ref={ref}
      role={readOnly ? undefined : "textbox"}
      tabIndex={readOnly ? undefined : 0}
      contentEditable={readOnly ? undefined : true}
      aria-label={ariaLabel}
      aria-multiline={multiline ? "true" : undefined}
      suppressContentEditableWarning={readOnly ? undefined : true}
      data-placeholder={text ? undefined : placeholder}
      data-testid={testId}
      data-editing={editing ? "true" : "false"}
      data-readonly={readOnly ? "true" : undefined}
      className={`bo-adEditable ${className ?? ""}`}
      style={style}
      onBlur={readOnly ? undefined : commit}
      onKeyDown={readOnly ? undefined : (event) => {
        if (event.key === "Escape") {
          if (ref.current) ref.current.innerText = text;
          (event.currentTarget as HTMLSpanElement).blur();
        }
        if (!multiline && event.key === "Enter") {
          event.preventDefault();
          (event.currentTarget as HTMLSpanElement).blur();
        }
      }}
    >
      {text}
    </span>
  );
}

function isEmpty(item: RestaurantAdContentElement): boolean {
  const value = asText(item.value);
  return item.type === "image" ? !value : !value.trim();
}

function ContentNode({
  item,
  editable,
  selected,
  onSelect,
  onChange,
  onDelete,
  onImagePick,
}: {
  item: RestaurantAdContentElement;
  editable: boolean;
  selected: boolean;
  onSelect?: (id: string) => void;
  onChange: (patch: Partial<RestaurantAdContentElement>) => void;
  onDelete: () => void;
  onImagePick?: () => void;
}) {
  const controls = useDragControls();
  const startDrag = useCallback((event: React.PointerEvent) => controls.start(event), [controls]);
  const align = item.align || "left";
  const sizeStyle = elementSizeStyle(item);
  const resizable = item.type === "image" ? { width: true, height: true } : { width: true, height: false };
  const sizeLabel = [elementSize(item).width ? `${Math.round(elementSize(item).width as number)}%` : "", elementSize(item).height ? `${Math.round(elementSize(item).height as number)}px` : ""].filter(Boolean).join(" · ");
  const applyResize = useCallback(
    (patch: { width: number; height?: number }) => onChange({ size: resizeElement(item, patch) }),
    [item, onChange],
  );
  const wrap = (node: React.ReactNode) => (
    <Reorder.Item
      value={item}
      as="div"
      layout="position"
      dragListener={false}
      dragControls={controls}
      dragMomentum={false}
      dragElastic={0.04}
      whileDrag={{ zIndex: 3 }}
      className={`bo-adNode ${selected ? "is-selected" : ""}`}
      data-slot={`ad-node-${item.id}`}
      data-testid={`ad-node-${item.type}`}
      onPointerDown={() => onSelect?.(item.id)}
    >
      {node}
      {editable ? (
        <span className="bo-adNodeBar" data-slot={`ad-node-${item.id}-bar`}>
          <button
            type="button"
            className="bo-anunciosDragHandle bo-adNodeGrip"
            aria-label={`Mover ${AD_CONTENT_LABEL[item.type]}`}
            data-slot={`ad-node-${item.id}-grip`}
            data-testid={`ad-node-${item.id}-grip`}
            onPointerDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
              startDrag(event);
            }}
          >
            <GripVertical size={15} aria-hidden="true" />
          </button>
          {item.type !== "image" ? (
            <span className="bo-anunciosAlignmentTabs bo-adNodeAlign" role="group" aria-label="Alineacion del texto">
              {(["left", "center", "right"] as Align[]).map((option) => (
                <button
                  key={option}
                  type="button"
                  className={align === option ? "is-active" : ""}
                  aria-pressed={align === option}
                  data-testid={`ad-node-${item.id}-align-${option}`}
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={() => onChange({ align: option })}
                >
                  {option === "left" ? "Izq" : option === "center" ? "Cen" : "Der"}
                </button>
              ))}
            </span>
          ) : null}
          {sizeLabel ? (
            <span className="bo-adNodeSize" data-slot={`ad-node-${item.id}-size`} data-testid={`ad-node-${item.id}-size`}>
              {sizeLabel}
              <button
                type="button"
                className="bo-adNodeSizeReset"
                aria-label={`Restablecer tamano de ${AD_CONTENT_LABEL[item.type]}`}
                data-testid={`ad-node-${item.id}-size-reset`}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={() => onChange({ size: undefined })}
              >
                Auto
              </button>
            </span>
          ) : null}
          <button
            type="button"
            className="bo-anunciosIconBtn bo-adNodeTrash"
            data-tone="danger"
            aria-label={`Eliminar ${AD_CONTENT_LABEL[item.type]}`}
            data-testid={`ad-node-${item.id}-delete`}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={onDelete}
          >
            <Trash2 size={14} aria-hidden="true" />
          </button>
        </span>
      ) : null}
    </Reorder.Item>
  );

  if (item.type === "image") {
    return wrap(
      <div className="bo-adModalImageCol" data-slot="ad-preview-image-col">
        {item.value ? (
          <img
            src={item.value}
            alt="Imagen del anuncio"
            className="bo-adModalImage bo-adResizable"
            style={sizeStyle}
            data-slot={`ad-preview-${item.id}`}
          />
        ) : null}
        {editable && selected ? <ResizeHandle hasHeight={resizable.height} onResize={applyResize} onCommit={() => undefined} /> : null}
        {editable ? (
          <button
            type="button"
            className={`bo-adNodeImagePick ${item.value ? "is-over" : ""}`}
            onClick={onImagePick}
            data-testid={`ad-node-${item.id}-image`}
          >
            <ImagePlus size={16} aria-hidden="true" />
            <span>{item.value ? "Cambiar imagen" : "Anadir imagen"}</span>
          </button>
        ) : null}
      </div>,
    );
  }
  const text = (
    <EditableText
      value={item.value}
      multiline={item.type === "text"}
      ariaLabel={AD_CONTENT_LABEL[item.type]}
      placeholder={`${AD_CONTENT_LABEL[item.type]}...`}
      testId={`ad-node-${item.id}-edit`}
      onCommit={(next) => onChange({ value: next })}
      className={`bo-adResizable ${
        item.type === "title" ? "bo-adModalTitle" : item.type === "subtitle" ? "bo-adModalSupertitle" : "bo-adModalDesc"
      }`}
      style={{ textAlign: align, display: "block", ...sizeStyle }}
    />
  );
  return wrap(
    <>
      {item.type === "title" ? <h2>{text}</h2> : item.type === "subtitle" ? <p>{text}</p> : text}
      {editable && selected ? <ResizeHandle hasHeight={false} onResize={applyResize} onCommit={() => undefined} /> : null}
    </>,
  );
}

/** Read-only twin of ContentNode: same markup, same operator box, no drag
 * machinery - this is what proves a saved size survives the REST fetch. */
function StaticContent({ item }: { item: RestaurantAdContentElement }) {
  const align = item.align || "left";
  const sizeStyle = elementSizeStyle(item);
  if (item.type === "image") {
    return item.value ? (
      <div className="bo-adModalImageCol" data-slot="ad-preview-image-col">
        <img
          src={item.value}
          alt="Imagen del anuncio"
          className="bo-adModalImage"
          style={sizeStyle}
          data-slot={`ad-preview-${item.id}`}
        />
      </div>
    ) : null;
  }
  const node = (
    <EditableText
      value={item.value}
      readOnly
      ariaLabel={AD_CONTENT_LABEL[item.type]}
      onCommit={() => undefined}
      className={item.type === "title" ? "bo-adModalTitle" : item.type === "subtitle" ? "bo-adModalSupertitle" : "bo-adModalDesc"}
      style={{ textAlign: align, display: "block", ...sizeStyle }}
    />
  );
  return <div data-slot={`ad-preview-${item.id}`}>{item.type === "title" ? <h2>{node}</h2> : node}</div>;
}

export function AdContentFlow({
  content,
  editable,
  selectedId,
  onSelect,
  onChange,
  onImagePick,
  emptyHint,
}: {
  content: RestaurantAdContentElement[];
  editable: boolean;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  onChange: (content: RestaurantAdContentElement[]) => void;
  onImagePick?: (item: RestaurantAdContentElement) => void;
  emptyHint?: string;
}) {
  if (editable) {
    return (
      <Reorder.Group
        axis="y"
        values={content}
        onReorder={onChange}
        className="bo-adCanvasFlow"
        data-testid="ad-canvas-content"
      >
        {content.map((item) => (
          <ContentNode
            key={item.id}
            item={item}
            editable
            selected={selectedId === item.id}
            onSelect={onSelect}
            onChange={(patch) => onChange(content.map((entry) => (entry.id === item.id ? { ...entry, ...patch } : entry)))}
            onDelete={() => onChange(content.filter((entry) => entry.id !== item.id))}
            onImagePick={() => onImagePick?.(item)}
          />
        ))}
        {!content.length ? <p className="bo-adModalDesc" data-testid="ad-canvas-empty">{emptyHint}</p> : null}
      </Reorder.Group>
    );
  }
  return (
    <>
      {content
        .filter((item) => !isEmpty(item))
        .map((item) => (
          <StaticContent key={item.id} item={item} />
        ))}
      {!content.some((item) => !isEmpty(item)) ? <p className="bo-adModalDesc" data-testid="ad-preview-empty">{emptyHint}</p> : null}
    </>
  );
}

function ButtonNode({
  cta,
  website,
  editable,
  selected,
  onSelect,
  onChange,
  onDelete,
}: {
  cta: RestaurantAdCTA;
  website: string;
  editable: boolean;
  selected: boolean;
  onSelect?: (id: string) => void;
  onChange: (patch: Partial<RestaurantAdCTA>) => void;
  onDelete: () => void;
}) {
  const controls = useDragControls();
  const startDrag = useCallback((event: React.PointerEvent) => controls.start(event), [controls]);
  const href = buildCTAURL(website, cta);
  if (!editable) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="bo-adModalCta"
        style={{ ["--ad-primary" as string]: cta.color || "#436754" }}
        data-slot={`ad-preview-cta-${cta.id}`}
        data-testid={`ad-preview-cta-${cta.id}`}
      >
        {cta.text || "Mas informacion"}
      </a>
    );
  }
  return (
    <Reorder.Item
      value={cta}
      as="div"
      layout="position"
      dragListener={false}
      dragControls={controls}
      dragMomentum={false}
      dragElastic={0.04}
      whileDrag={{ zIndex: 3 }}
      className={`bo-adButton ${selected ? "is-selected" : ""}`}
      data-slot={`ad-button-${cta.id}`}
      data-testid={`ad-button-${cta.id}`}
      onPointerDown={() => onSelect?.(cta.id)}
    >
      {editable ? (
        <button
          type="button"
          className="bo-anunciosDragHandle bo-adNodeGrip bo-adButtonGrip"
          aria-label="Mover boton"
          data-testid={`ad-button-${cta.id}-grip`}
          onPointerDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
            startDrag(event);
          }}
        >
          <GripVertical size={14} aria-hidden="true" />
        </button>
      ) : null}
      {editable ? (
        <span className="bo-adModalCta" style={{ ["--ad-primary" as string]: cta.color || "#436754" }}>
          <EditableText
            value={cta.text}
            ariaLabel="Texto del boton"
            placeholder="Texto del boton"
            testId={`ad-button-${cta.id}-edit`}
            onCommit={(text) => onChange({ text })}
          />
        </span>
      ) : (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="bo-adModalCta"
          style={{ ["--ad-primary" as string]: cta.color || "#436754" }}
          data-slot={`ad-preview-cta-${cta.id}`}
          data-testid={`ad-preview-cta-${cta.id}`}
        >
          {cta.text || "Mas informacion"}
        </a>
      )}
      {editable ? (
        <button
          type="button"
          className="bo-anunciosIconBtn bo-adNodeTrash bo-adButtonTrash"
          data-tone="danger"
          aria-label="Eliminar boton"
          data-testid={`ad-button-${cta.id}-delete`}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={onDelete}
        >
          <Trash2 size={14} aria-hidden="true" />
        </button>
      ) : null}
    </Reorder.Item>
  );
}

export function AdButtons({
  buttons,
  website,
  editable,
  selectedId,
  onSelect,
  onChange,
  emptyHint,
}: {
  buttons: RestaurantAdCTA[];
  website: string;
  editable: boolean;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  onChange: (buttons: RestaurantAdCTA[]) => void;
  emptyHint?: string;
}) {
  if (!buttons.length) {
    return editable && emptyHint ? <p className="bo-adCanvasHint" data-testid="ad-canvas-buttons-empty">{emptyHint}</p> : null;
  }
  return (
    <Reorder.Group
      axis="y"
      values={buttons}
      onReorder={onChange}
      className="bo-adModalActions"
      data-testid="ad-preview-ctas"
    >
      {buttons.map((cta) => (
        <ButtonNode
          key={cta.id}
          cta={cta}
          website={website}
          editable={editable}
          selected={selectedId === cta.id}
          onSelect={onSelect}
          onChange={(patch) => onChange(buttons.map((entry) => (entry.id === cta.id ? { ...entry, ...patch } : entry)))}
          onDelete={() => onChange(buttons.filter((entry) => entry.id !== cta.id))}
        />
      ))}
    </Reorder.Group>
  );
}

/** The announcement itself: one column, image on top, text and buttons under it.
 * `editable` turns the same template into the live canvas. */
export function AdSurface({
  content,
  buttons,
  website,
  editable = false,
  selectedId,
  onSelect,
  onContentChange,
  onButtonsChange,
  onImagePick,
  emptyHint,
  surfaceProps,
  testId = "ad-preview",
}: {
  content: RestaurantAdContentElement[];
  buttons: RestaurantAdCTA[];
  website: string;
  editable?: boolean;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  onContentChange?: (content: RestaurantAdContentElement[]) => void;
  onButtonsChange?: (buttons: RestaurantAdCTA[]) => void;
  onImagePick?: (item: RestaurantAdContentElement) => void;
  emptyHint?: string;
  surfaceProps?: React.HTMLAttributes<HTMLDivElement>;
  testId?: string;
}) {
  return (
    <div
      {...surfaceProps}
      className={`bo-adModalPreview ${editable ? "bo-adCanvas" : "bo-anunciosPreview"} ${surfaceProps?.className ?? ""}`}
      data-testid={testId}
      data-slot={editable ? "ad-canvas" : "ad-preview"}
      data-editable={editable ? "true" : "false"}
    >
      <div className="bo-adModalBody" data-slot={editable ? "ad-canvas-body" : "ad-preview-body"}>
        <AdContentFlow
          content={content}
          editable={editable}
          selectedId={selectedId}
          onSelect={onSelect}
          onChange={(next) => onContentChange?.(next)}
          onImagePick={onImagePick}
          emptyHint={emptyHint}
        />
        <AdButtons
          buttons={buttons}
          website={website}
          editable={editable}
          selectedId={selectedId}
          onSelect={onSelect}
          onChange={(next) => onButtonsChange?.(next)}
        />
      </div>
    </div>
  );
}

function WizardCard({
  step,
  index,
  total,
  website,
  editable,
  onOpen,
  onStepChange,
  onCardButtonsChange,
}: {
  step: RestaurantAdStep;
  index: number;
  total: number;
  website: string;
  editable: boolean;
  onOpen: () => void;
  onStepChange?: (stepId: string, patch: Partial<RestaurantAdStep>) => void;
  /** Reorders the buttons inside this card (coord id ads_card_buttons_order_v1). */
  onCardButtonsChange?: (stepId: string, buttons: RestaurantAdCTA[]) => void;
}) {
  const controls = useDragControls();
  const startDrag = useCallback((event: React.PointerEvent) => {
    event.preventDefault();
    event.stopPropagation();
    controls.start(event);
  }, [controls]);
  const card = (
    <div
      className="bo-adWizardCard"
      style={stepBackground(step) ? { background: stepBackground(step) } : undefined}
      role={editable ? undefined : "button"}
      tabIndex={editable ? undefined : 0}
      onClick={editable ? undefined : onOpen}
      onDoubleClick={editable ? onOpen : undefined}
      onKeyDown={(event) => {
        if (!editable && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          onOpen();
        }
      }}
      data-testid={`ad-wizard-card-${step.id}`}
      data-slot="ad-wizard-card"
      aria-label={editable ? undefined : `Abrir anuncio ${index + 1} de ${total}`}
    >
      <span className="bo-adWizardCardBody" data-slot={`ad-wizard-card-${step.id}-body`}>
        {editable ? (
          <EditableText
            value={step.title}
            ariaLabel="Titulo del anuncio"
            placeholder="Titulo"
            testId={`ad-wizard-card-${step.id}-title`}
            className="bo-adWizardCardTitle"
            onCommit={(title) => onStepChange?.(step.id, { title })}
          />
        ) : (
          <span className="bo-adWizardCardTitle">{step.title}</span>
        )}
        {editable ? (
          <EditableText
            value={step.description}
            multiline
            ariaLabel="Descripcion del anuncio"
            placeholder="Descripcion"
            testId={`ad-wizard-card-${step.id}-description`}
            className="bo-adWizardCardDesc"
            onCommit={(description) => onStepChange?.(step.id, { description })}
          />
        ) : step.description ? (
          <span className="bo-adWizardCardDesc">{step.description}</span>
        ) : null}
        <span className="bo-adWizardCardActions" data-slot={`ad-wizard-card-${step.id}-actions`}>
          {editable ? (
            <Reorder.Group
              axis="y"
              values={step.buttons}
              onReorder={(buttons) => onCardButtonsChange?.(step.id, buttons)}
              className="bo-adModalActions bo-adWizardCardButtons"
              data-testid={`ad-wizard-card-${step.id}-buttons`}
            >
              {step.buttons.map((cta) => (
                <ButtonNode
                  key={cta.id}
                  cta={cta}
                  website={website}
                  editable
                  selected={false}
                  onChange={(patch) =>
                    onCardButtonsChange?.(step.id, step.buttons.map((entry) => (entry.id === cta.id ? { ...entry, ...patch } : entry)))
                  }
                  onDelete={() => onCardButtonsChange?.(step.id, step.buttons.filter((entry) => entry.id !== cta.id))}
                />
              ))}
            </Reorder.Group>
          ) : (
            step.buttons.map((cta) => (
              <a
                key={cta.id}
                href={buildCTAURL(website, cta)}
                target="_blank"
                rel="noopener noreferrer"
                className="bo-adModalCta bo-adWizardAction"
                style={{ ["--ad-primary" as string]: cta.color || "#436754" }}
                onClick={(event) => event.stopPropagation()}
                data-testid={`ad-wizard-card-${step.id}-${cta.id}`}
              >
                {cta.text || "Mas informacion"}
              </a>
            ))
          )}
          {step.see_more !== false ? (
            <button type="button" className="bo-adModalCta bo-adWizardMore" onClick={(event) => { event.stopPropagation(); onOpen(); }} data-testid={`ad-wizard-card-${step.id}-more`}>
              Ver mas
            </button>
          ) : null}
          {editable ? (
            <button
              type="button"
              className="bo-adModalCta bo-adWizardEdit"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => { event.stopPropagation(); onOpen(); }}
              data-testid={`ad-wizard-card-${step.id}-edit`}
            >
              Editar anuncio
            </button>
          ) : null}
        </span>
      </span>
      {editable ? (
        <button
          type="button"
          className="bo-anunciosDragHandle bo-adWizardGrip"
          aria-label={`Mover tarjeta ${index + 1}`}
          data-testid={`ad-wizard-card-${step.id}-grip`}
          onPointerDown={startDrag}
        >
          <GripVertical size={15} aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
  if (!editable) return card;
  return (
    <Reorder.Item
      value={step}
      as="div"
      layout="position"
      dragListener={false}
      dragControls={controls}
      dragMomentum={false}
      dragElastic={0.04}
      whileDrag={{ zIndex: 3 }}
      data-slot={`ad-wizard-item-${step.id}`}
    >
      {card}
    </Reorder.Item>
  );
}

/** Multiple layout: step 0 is the cards column, any other index renders that
 * announcement. Clicking a card (not one of its action buttons) advances. */
export function AdWizard({
  ad,
  website,
  steps,
  editable = false,
  stepIndex,
  onStepIndex,
  selectedId,
  onSelect,
  onStepChange,
  onStepsChange,
  onCardButtonsChange,
  onButtonsChange,
  onImagePick,
  testId = "ad-wizard",
}: {
  ad: RestaurantAd;
  website: string;
  steps: RestaurantAdStep[];
  editable?: boolean;
  stepIndex: number;
  onStepIndex?: (index: number) => void;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  onStepChange?: (stepId: string, patch: Partial<RestaurantAdStep>) => void;
  onStepsChange?: (steps: RestaurantAdStep[]) => void;
  /** Card-level buttons of one step, edited inline on the card itself. */
  onCardButtonsChange?: (stepId: string, buttons: RestaurantAdCTA[]) => void;
  /** Wizard-wide buttons: the same set under every announcement. */
  onButtonsChange?: (buttons: RestaurantAdCTA[]) => void;
  onImagePick?: (item: RestaurantAdContentElement) => void;
  testId?: string;
}) {
  const go = useCallback((index: number) => onStepIndex?.(Math.min(Math.max(index, 0), steps.length)), [onStepIndex, steps.length]);

  if (stepIndex > 0) {
    const step = steps[stepIndex - 1];
    if (!step) return null;
    const style = stepBackground(step) ? ({ background: stepBackground(step) } as React.CSSProperties) : undefined;
    return (
      <div className="bo-adWizardDetail" data-testid="ad-wizard-detail" data-step={stepIndex}>
        <button
          type="button"
          className="bo-adWizardBack"
          onClick={() => go(0)}
          data-testid="ad-wizard-back"
        >
          <ChevronLeft size={15} aria-hidden="true" />
          Volver
        </button>
        <AdSurface
          content={step.content}
          buttons={ad.ctas}
          website={website}
          editable={editable}
          selectedId={selectedId}
          onSelect={onSelect}
          onContentChange={(content) => onStepChange?.(step.id, { content })}
          onButtonsChange={(buttons) => onButtonsChange?.(buttons)}
          onImagePick={onImagePick}
          emptyHint="Anade titulo, texto o imagen a este anuncio."
          surfaceProps={{ style, "data-slot": "ad-wizard-step-surface" } as React.HTMLAttributes<HTMLDivElement>}
          testId={`${testId}-step`}
        />
      </div>
    );
  }

  return (
    <div
      className={`bo-adWizard ${editable ? "bo-adCanvas" : ""}`}
      data-testid={testId}
      data-slot="ad-wizard-cards"
      data-editable={editable ? "true" : "false"}
    >
      <Reorder.Group axis="y" values={steps} onReorder={(next) => onStepsChange?.(next)} className="bo-adWizardCards" data-testid="ad-wizard-card-list">
        {steps.map((step, index) => (
          <WizardCard
            key={step.id}
            step={step}
            index={index}
            total={steps.length}
            website={website}
            editable={editable}
            onOpen={() => go(index + 1)}
            onStepChange={onStepChange}
            onCardButtonsChange={onCardButtonsChange}
          />
        ))}
      </Reorder.Group>
      {!steps.length ? <p className="bo-adCanvasHint" data-testid="ad-wizard-empty">Sin anuncios: anade el primero desde el panel.</p> : null}
      {ad.name ? null : null}
    </div>
  );
}
