import React, { useMemo, useState } from "react";
import {
  AlignLeft, Columns2, EyeOff, GripVertical, Heading, Image as ImageIcon, LayoutTemplate, Link2, List, Minus, MousePointerClick,
  PanelBottom, PanelTop, Quote, Square, Space, Ticket, Type,
} from "lucide-react";
import { cn } from "../../../../../ui/shadcn/utils";
import { EMAIL_BLOCKS, type BlockKind } from "./emailBuilderBlocks";
import { layerTree, type InsertPosition, type LayerNode } from "./emailBuilderDocument";
import { BLOCK_MIME, MOVE_MIME } from "./EmailBuilderCanvas";

/*
 * Left panel of the campaign HTML builder (campaign_html_builder_v1): the
 * component palette (click to add after the selection, or drag onto the canvas)
 * and the layers tree (select, drag to reorder), like Figma's left sidebar.
 */

const BLOCK_ICONS: Record<BlockKind, React.ReactNode> = {
  header: <PanelTop size={16} aria-hidden="true" />,
  hero: <LayoutTemplate size={16} aria-hidden="true" />,
  heading: <Heading size={16} aria-hidden="true" />,
  text: <AlignLeft size={16} aria-hidden="true" />,
  button: <MousePointerClick size={16} aria-hidden="true" />,
  image: <ImageIcon size={16} aria-hidden="true" />,
  columns: <Columns2 size={16} aria-hidden="true" />,
  list: <List size={16} aria-hidden="true" />,
  coupon: <Ticket size={16} aria-hidden="true" />,
  quote: <Quote size={16} aria-hidden="true" />,
  divider: <Minus size={16} aria-hidden="true" />,
  spacer: <Space size={16} aria-hidden="true" />,
  footer: <PanelBottom size={16} aria-hidden="true" />,
};

const LAYER_ICONS: Record<string, React.ReactNode> = {
  heading: <Heading size={13} aria-hidden="true" />,
  text: <Type size={13} aria-hidden="true" />,
  image: <ImageIcon size={13} aria-hidden="true" />,
  button: <MousePointerClick size={13} aria-hidden="true" />,
  link: <Link2 size={13} aria-hidden="true" />,
  divider: <Minus size={13} aria-hidden="true" />,
  list: <List size={13} aria-hidden="true" />,
  box: <Square size={13} aria-hidden="true" />,
};

export function BlockPalette({ onAdd }: { onAdd: (kind: BlockKind) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2 p-3" data-testid="email-builder-palette" data-observe="email-builder-palette">
      {EMAIL_BLOCKS.map((block) => (
        <button
          key={block.kind}
          type="button"
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData(BLOCK_MIME, block.kind);
            e.dataTransfer.effectAllowed = "copy";
          }}
          onClick={() => onAdd(block.kind)}
          title={`${block.description}. Clic para añadir o arrástralo al lienzo`}
          className="group grid cursor-grab justify-items-center gap-1.5 rounded-bo-md border border-solid border-bo-border bg-bo-surface-3 px-2 py-3 text-center transition hover:border-[#7c5cff]/60 hover:bg-bo-surface-2 active:cursor-grabbing"
          data-testid={`email-builder-block-${block.kind}`}
        >
          <span className="grid size-8 place-items-center rounded-lg bg-bo-surface-2 text-bo-muted transition group-hover:text-[#b9a8ff]" data-testid={`email-builder-block-${block.kind}-icon`}>
            {BLOCK_ICONS[block.kind]}
          </span>
          <span className="text-[12px] font-medium leading-tight text-bo-text" data-testid={`email-builder-block-${block.kind}-label`}>{block.label}</span>
        </button>
      ))}
    </div>
  );
}

type LayersProps = {
  html: string;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onMove: (id: string, targetId: string, position: InsertPosition) => void;
};

export function LayersPanel({ html, selectedId, onSelect, onMove }: LayersProps) {
  const layers = useMemo(() => layerTree(html), [html]);
  const [drop, setDrop] = useState<{ id: string; position: InsertPosition } | null>(null);

  const positionFor = (e: React.DragEvent, node: LayerNode): InsertPosition => {
    const r = e.currentTarget.getBoundingClientRect();
    return e.clientY < r.top + r.height / 2 ? "before" : node.kind === "box" && e.clientX > r.left + 40 + node.depth * 12 ? "inside" : "after";
  };

  return (
    <ul className="m-0 grid list-none grid-cols-[minmax(0,1fr)] gap-px p-2" aria-label="Capas del email" data-testid="email-builder-layers" data-observe="email-builder-layers">
      {layers.map((node) => (
        <li
          key={node.id}
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData(MOVE_MIME, node.id);
            e.dataTransfer.effectAllowed = "move";
          }}
          onDragOver={(e) => {
            if (!e.dataTransfer.types.includes(MOVE_MIME)) return;
            e.preventDefault();
            setDrop({ id: node.id, position: positionFor(e, node) });
          }}
          onDragLeave={() => setDrop(null)}
          onDrop={(e) => {
            e.preventDefault();
            const moved = e.dataTransfer.getData(MOVE_MIME);
            setDrop(null);
            if (moved && moved !== node.id) onMove(moved, node.id, positionFor(e, node));
          }}
          className={cn(
            "relative min-w-0",
            drop?.id === node.id && drop.position === "before" && "before:absolute before:inset-x-0 before:top-0 before:h-0.5 before:bg-[#22c55e]",
            drop?.id === node.id && drop.position === "after" && "after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-[#22c55e]",
          )}
          data-testid={`email-builder-layer-${node.id}`}
        >
          <button
            type="button"
            onClick={() => onSelect(node.id)}
            aria-current={selectedId === node.id || undefined}
            className={cn(
              "group flex h-8 w-full min-w-0 cursor-pointer items-center gap-1.5 rounded-md border-0 pr-2 text-left text-[12.5px] transition-colors",
              selectedId === node.id ? "bg-[#7c5cff]/20 text-bo-text" : "bg-transparent text-bo-muted hover:bg-bo-surface-2 hover:text-bo-text",
              drop?.id === node.id && drop.position === "inside" && "ring-1 ring-[#22c55e]",
            )}
            style={{ paddingLeft: 6 + node.depth * 12 }}
            data-testid={`email-builder-layer-btn-${node.id}`}
          >
            <GripVertical size={12} className="shrink-0 opacity-0 transition group-hover:opacity-50" aria-hidden="true" />
            <span className={cn("shrink-0", selectedId === node.id ? "text-[#b9a8ff]" : "text-bo-faint")} data-testid={`email-builder-layer-icon-${node.id}`}>
              {LAYER_ICONS[node.kind] ?? LAYER_ICONS.box}
            </span>
            <span className="shrink-0 font-medium" data-testid={`email-builder-layer-label-${node.id}`}>{node.label}</span>
            {node.hint && <span className="min-w-0 truncate text-bo-faint" data-testid={`email-builder-layer-hint-${node.id}`}>{node.hint}</span>}
            {node.hidden && <EyeOff size={12} className="ml-auto shrink-0 text-bo-faint" aria-label="Oculto en algún tamaño" />}
          </button>
        </li>
      ))}
    </ul>
  );
}
