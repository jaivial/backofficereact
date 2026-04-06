import React from "react";
import { EyeOff, Trash2 } from "lucide-react";
import type { PageNode, NodeStyle } from "../../../../../api/site-builder-types";
import { toInputValue } from "../../helpers/siteBuilder.helpers";
import { parseNodeProps, parseNodeStyle } from "../../helpers/siteBuilder.helpers";

export type SiteSettingsProps = {
  selectedNode: PageNode | null;
  selectedNodeStyle: NodeStyle;
  onClose: () => void;
  onDeleteNode: (nodeId: string) => void;
  onUpdateProps: (patch: Record<string, unknown>) => void;
  onUpdateStyle: (patch: Partial<NodeStyle>) => void;
};

export function SiteSettings({
  selectedNode,
  selectedNodeStyle,
  onClose,
  onDeleteNode,
  onUpdateProps,
  onUpdateStyle,
}: SiteSettingsProps) {
  if (!selectedNode) return null;

  const nodeProps = parseNodeProps(selectedNode);
  const nodeStyle = parseNodeStyle(selectedNode);

  return (
    <aside className="bo-siteBuilderRightPanel" data-ui="right-panel">
      <div className="bo-siteBuilderPanelHeader" data-ui="right-panel-header">
        <h3 data-ui="right-panel-title">Propiedades</h3>
        <button
          className="bo-btn bo-btn--ghost bo-btn--sm"
          type="button"
          onClick={onClose}
          aria-label="Ocultar propiedades"
          data-ui="right-panel-hide"
        >
          <EyeOff size={16} />
        </button>
      </div>

      <div className="bo-siteBuilderProperties" data-ui="properties">
        <div className="bo-siteBuilderPropertyGroup" data-ui="property-group-type">
          <span className="bo-siteBuilderPropertyLabel" data-ui="property-label-type">Tipo</span>
          <span className="bo-siteBuilderPropertyType" data-ui="property-value-type">{selectedNode.type}</span>
        </div>

        {selectedNode.type === "hero" ? (
          <>
            <HeroPropertyGroup
              title={toInputValue(nodeProps.title)}
              subtitle={toInputValue(nodeProps.subtitle)}
              buttonText={toInputValue(nodeProps.buttonText)}
              buttonHref={toInputValue(nodeProps.buttonHref)}
              onUpdate={onUpdateProps}
            />
          </>
        ) : null}

        {selectedNode.type === "text" ? (
          <TextPropertyGroup
            content={toInputValue(nodeProps.content)}
            onUpdate={onUpdateProps}
          />
        ) : null}

        {selectedNode.type === "heading" ? (
          <HeadingPropertyGroup
            text={toInputValue(nodeProps.text)}
            level={Number(nodeProps.level) || 2}
            onUpdate={onUpdateProps}
          />
        ) : null}

        {selectedNode.type === "image" ? (
          <ImagePropertyGroup
            src={toInputValue(nodeProps.src)}
            alt={toInputValue(nodeProps.alt)}
            onUpdate={onUpdateProps}
          />
        ) : null}

        {selectedNode.type === "button" ? (
          <ButtonPropertyGroup
            text={toInputValue(nodeProps.text)}
            href={toInputValue(nodeProps.href)}
            variant={toInputValue(nodeProps.variant) || "primary"}
            onUpdate={onUpdateProps}
          />
        ) : null}

        {selectedNode.type === "spacer" ? (
          <SpacerPropertyGroup
            height={Number(nodeProps.height) || 40}
            onUpdate={onUpdateProps}
          />
        ) : null}

        <StylePropertyGroups
          nodeStyle={nodeStyle}
          onUpdate={onUpdateStyle}
        />

        <div className="bo-siteBuilderPropertyActions" data-ui="property-actions">
          <button
            className="bo-btn bo-btn--danger"
            type="button"
            onClick={() => onDeleteNode(selectedNode.id)}
            data-ui="property-delete-node"
          >
            <Trash2 size={16} />
            <span data-ui="property-delete-node-label">Eliminar componente</span>
          </button>
        </div>
      </div>
    </aside>
  );
}

function HeroPropertyGroup({
  title, subtitle, buttonText, buttonHref, onUpdate,
}: {
  title: string;
  subtitle: string;
  buttonText: string;
  buttonHref: string;
  onUpdate: (patch: Record<string, unknown>) => void;
}) {
  return (
    <>
      <div className="bo-siteBuilderPropertyGroup" data-ui="property-group-hero-title">
        <label className="bo-siteBuilderPropertyLabel" htmlFor="hero-title" data-ui="property-label-hero-title">Titulo</label>
        <input
          id="hero-title" type="text" className="bo-input"
          value={title} onChange={(e) => onUpdate({ title: e.target.value })}
          data-ui="property-input-hero-title"
        />
      </div>
      <div className="bo-siteBuilderPropertyGroup" data-ui="property-group-hero-subtitle">
        <label className="bo-siteBuilderPropertyLabel" htmlFor="hero-subtitle" data-ui="property-label-hero-subtitle">Subtitulo</label>
        <textarea
          id="hero-subtitle" className="bo-input bo-textarea"
          value={subtitle} onChange={(e) => onUpdate({ subtitle: e.target.value })}
          data-ui="property-input-hero-subtitle"
        />
      </div>
      <div className="bo-siteBuilderPropertyGroup" data-ui="property-group-hero-button-text">
        <label className="bo-siteBuilderPropertyLabel" htmlFor="hero-button-text" data-ui="property-label-hero-button-text">Texto del boton</label>
        <input
          id="hero-button-text" type="text" className="bo-input"
          value={buttonText} onChange={(e) => onUpdate({ buttonText: e.target.value })}
          data-ui="property-input-hero-button-text"
        />
      </div>
      <div className="bo-siteBuilderPropertyGroup" data-ui="property-group-hero-button-href">
        <label className="bo-siteBuilderPropertyLabel" htmlFor="hero-button-href" data-ui="property-label-hero-button-href">URL del boton</label>
        <input
          id="hero-button-href" type="text" className="bo-input"
          value={buttonHref} onChange={(e) => onUpdate({ buttonHref: e.target.value })}
          data-ui="property-input-hero-button-href"
        />
      </div>
    </>
  );
}

function TextPropertyGroup({
  content, onUpdate,
}: {
  content: string;
  onUpdate: (patch: Record<string, unknown>) => void;
}) {
  return (
    <div className="bo-siteBuilderPropertyGroup" data-ui="property-group-text-content">
      <label className="bo-siteBuilderPropertyLabel" htmlFor="text-content" data-ui="property-label-text-content">Contenido</label>
      <textarea
        id="text-content" className="bo-input bo-textarea bo-textarea--lg"
        value={content} onChange={(e) => onUpdate({ content: e.target.value })}
        data-ui="property-input-text-content"
      />
    </div>
  );
}

function HeadingPropertyGroup({
  text, level, onUpdate,
}: {
  text: string;
  level: number;
  onUpdate: (patch: Record<string, unknown>) => void;
}) {
  return (
    <>
      <div className="bo-siteBuilderPropertyGroup" data-ui="property-group-heading-text">
        <label className="bo-siteBuilderPropertyLabel" htmlFor="heading-text" data-ui="property-label-heading-text">Texto</label>
        <input
          id="heading-text" type="text" className="bo-input"
          value={text} onChange={(e) => onUpdate({ text: e.target.value })}
          data-ui="property-input-heading-text"
        />
      </div>
      <div className="bo-siteBuilderPropertyGroup" data-ui="property-group-heading-level">
        <label className="bo-siteBuilderPropertyLabel" htmlFor="heading-level" data-ui="property-label-heading-level">Nivel</label>
        <select
          id="heading-level" className="bo-input"
          value={level} onChange={(e) => onUpdate({ level: Number(e.target.value) })}
          data-ui="property-input-heading-level"
        >
          <option value={1} data-ui="property-input-heading-level-option-h1">H1</option>
          <option value={2} data-ui="property-input-heading-level-option-h2">H2</option>
          <option value={3} data-ui="property-input-heading-level-option-h3">H3</option>
          <option value={4} data-ui="property-input-heading-level-option-h4">H4</option>
          <option value={5} data-ui="property-input-heading-level-option-h5">H5</option>
          <option value={6} data-ui="property-input-heading-level-option-h6">H6</option>
        </select>
      </div>
    </>
  );
}

function ImagePropertyGroup({
  src, alt, onUpdate,
}: {
  src: string;
  alt: string;
  onUpdate: (patch: Record<string, unknown>) => void;
}) {
  return (
    <>
      <div className="bo-siteBuilderPropertyGroup" data-ui="property-group-image-src">
        <label className="bo-siteBuilderPropertyLabel" htmlFor="image-src" data-ui="property-label-image-src">URL de imagen</label>
        <input
          id="image-src" type="text" className="bo-input"
          value={src} onChange={(e) => onUpdate({ src: e.target.value })}
          data-ui="property-input-image-src"
        />
      </div>
      <div className="bo-siteBuilderPropertyGroup" data-ui="property-group-image-alt">
        <label className="bo-siteBuilderPropertyLabel" htmlFor="image-alt" data-ui="property-label-image-alt">Texto alternativo</label>
        <input
          id="image-alt" type="text" className="bo-input"
          value={alt} onChange={(e) => onUpdate({ alt: e.target.value })}
          data-ui="property-input-image-alt"
        />
      </div>
    </>
  );
}

function ButtonPropertyGroup({
  text, href, variant, onUpdate,
}: {
  text: string;
  href: string;
  variant: string;
  onUpdate: (patch: Record<string, unknown>) => void;
}) {
  return (
    <>
      <div className="bo-siteBuilderPropertyGroup" data-ui="property-group-button-text">
        <label className="bo-siteBuilderPropertyLabel" htmlFor="button-text" data-ui="property-label-button-text">Texto</label>
        <input
          id="button-text" type="text" className="bo-input"
          value={text} onChange={(e) => onUpdate({ text: e.target.value })}
          data-ui="property-input-button-text"
        />
      </div>
      <div className="bo-siteBuilderPropertyGroup" data-ui="property-group-button-href">
        <label className="bo-siteBuilderPropertyLabel" htmlFor="button-href" data-ui="property-label-button-href">URL</label>
        <input
          id="button-href" type="text" className="bo-input"
          value={href} onChange={(e) => onUpdate({ href: e.target.value })}
          data-ui="property-input-button-href"
        />
      </div>
      <div className="bo-siteBuilderPropertyGroup" data-ui="property-group-button-variant">
        <label className="bo-siteBuilderPropertyLabel" htmlFor="button-variant" data-ui="property-label-button-variant">Variante</label>
        <select
          id="button-variant" className="bo-input"
          value={variant} onChange={(e) => onUpdate({ variant: e.target.value })}
          data-ui="property-input-button-variant"
        >
          <option value="primary">Primary</option>
          <option value="secondary">Secondary</option>
          <option value="outline">Outline</option>
          <option value="ghost">Ghost</option>
        </select>
      </div>
    </>
  );
}

function SpacerPropertyGroup({
  height, onUpdate,
}: {
  height: number;
  onUpdate: (patch: Record<string, unknown>) => void;
}) {
  return (
    <div className="bo-siteBuilderPropertyGroup" data-ui="property-group-spacer-height">
      <label className="bo-siteBuilderPropertyLabel" htmlFor="spacer-height" data-ui="property-label-spacer-height">Altura (px)</label>
      <input
        id="spacer-height" type="number" className="bo-input"
        value={height} onChange={(e) => onUpdate({ height: Number(e.target.value) || 0 })}
        data-ui="property-input-spacer-height"
      />
    </div>
  );
}

function StylePropertyGroups({
  nodeStyle, onUpdate,
}: {
  nodeStyle: NodeStyle;
  onUpdate: (patch: Partial<NodeStyle>) => void;
}) {
  return (
    <>
      <div className="bo-siteBuilderPropertyGroup" data-ui="property-group-style-padding-top">
        <label className="bo-siteBuilderPropertyLabel" htmlFor="style-padding-top" data-ui="property-label-style-padding-top">Padding superior (px)</label>
        <input
          id="style-padding-top" type="number" className="bo-input"
          value={Number(nodeStyle.paddingTop ?? 0)}
          onChange={(e) => onUpdate({ paddingTop: Number(e.target.value) || 0 })}
          data-ui="property-input-style-padding-top"
        />
      </div>
      <div className="bo-siteBuilderPropertyGroup" data-ui="property-group-style-padding-bottom">
        <label className="bo-siteBuilderPropertyLabel" htmlFor="style-padding-bottom" data-ui="property-label-style-padding-bottom">Padding inferior (px)</label>
        <input
          id="style-padding-bottom" type="number" className="bo-input"
          value={Number(nodeStyle.paddingBottom ?? 0)}
          onChange={(e) => onUpdate({ paddingBottom: Number(e.target.value) || 0 })}
          data-ui="property-input-style-padding-bottom"
        />
      </div>
      <div className="bo-siteBuilderPropertyGroup" data-ui="property-group-style-background-color">
        <label className="bo-siteBuilderPropertyLabel" htmlFor="style-background-color" data-ui="property-label-style-background-color">Fondo</label>
        <input
          id="style-background-color" type="text" className="bo-input"
          placeholder="#ffffff o var(--token)"
          value={toInputValue(nodeStyle.backgroundColor)}
          onChange={(e) => onUpdate({ backgroundColor: e.target.value })}
          data-ui="property-input-style-background-color"
        />
      </div>
      <div className="bo-siteBuilderPropertyGroup" data-ui="property-group-style-text-color">
        <label className="bo-siteBuilderPropertyLabel" htmlFor="style-text-color" data-ui="property-label-style-text-color">Color de texto</label>
        <input
          id="style-text-color" type="text" className="bo-input"
          placeholder="#111111 o var(--token)"
          value={toInputValue(nodeStyle.textColor)}
          onChange={(e) => onUpdate({ textColor: e.target.value })}
          data-ui="property-input-style-text-color"
        />
      </div>
      <div className="bo-siteBuilderPropertyGroup" data-ui="property-group-style-max-width">
        <label className="bo-siteBuilderPropertyLabel" htmlFor="style-max-width" data-ui="property-label-style-max-width">Ancho maximo</label>
        <input
          id="style-max-width" type="text" className="bo-input"
          placeholder="1200px, 80ch, min(100%, 960px)"
          value={toInputValue(nodeStyle.maxWidth)}
          onChange={(e) => onUpdate({ maxWidth: e.target.value })}
          data-ui="property-input-style-max-width"
        />
      </div>
    </>
  );
}
