import React, { useMemo, useState } from "react";
import {
  AlignLeft, ChevronRight, Columns2, EyeOff, Heading, Image as ImageIcon, LayoutTemplate, Link2, List, Minus, MousePointerClick,
  PanelBottom, PanelTop, Quote, Space, Square, Ticket, Type,
} from "lucide-react";
import { cn } from "../../../../../ui/shadcn/utils";
import { EMAIL_BLOCKS, type BlockKind } from "./emailBuilderBlocks";
import { layerTree, type InsertPosition, type LayerNode } from "./emailBuilderDocument";
import { BLOCK_MIME, MOVE_MIME } from "./EmailBuilderCanvas";

/*
 * Left panel of the campaign HTML builder (campaign_html_builder_v1): the
 * component palette (click to add after the selection, or drag onto the canvas)
 * and the layers tree, drawn like a file tree (│ ├ └ connectors, collapsible
 * branches, drag to reorder), like Figma's left sidebar.
 */

type Icon = typeof AlignLeft;

const BLOCK_ICONS: Record<BlockKind, Icon> = {
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

const LAYER_ICONS: Record<string, Icon> = {
  heading: Heading,
  text: Type,
  image: ImageIcon,
  button: MousePointerClick,
  link: Link2,
  divider: Minus,
  list: List,
  box: Square,
};

export function BlockPalette({ onAdd }: { onAdd: (kind: BlockKind) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2 p-3" data-testid="email-builder-palette" data-observe="email-builder-palette">
      {EMAIL_BLOCKS.map((block) => {
        const BlockIcon = BLOCK_ICONS[block.kind];
        return (
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
              <BlockIcon size={16} aria-hidden="true" data-testid={`email-builder-block-${block.kind}-svg`} />
            </span>
            <span className="text-[12px] font-medium leading-tight text-bo-text" data-testid={`email-builder-block-${block.kind}-label`}>{block.label}</span>
          </button>
        );
      })}
    </div>
  );
}

type LayersProps = {
  html: string;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onMove: (id: string, targetId: string, position: InsertPosition) => void;
};

/** Width of one tree level (guide column) in px. */
const LEVEL = 14;
const LINE = "absolute bg-bo-border-2";

/** Tree connectors of a row: │ guides of the open ancestors, then ├ or └ to the node. */
function TreeLines({ node, rowId }: { node: LayerNode; rowId: string }) {
  if (node.depth === 0) return null;
  return (
    <span className="flex shrink-0 self-stretch" aria-hidden="true" data-testid={`${rowId}-tree`}>
      {node.guides.slice(1).map((open, level) => (
        <span key={level} className="relative shrink-0" style={{ width: LEVEL }} data-testid={`${rowId}-guide-${level}`}>
          {open && <span className={cn(LINE, "inset-y-0 left-1/2 w-px")} data-testid={`${rowId}-guide-${level}-line`} />}
        </span>
      ))}
      <span className="relative shrink-0" style={{ width: LEVEL }} data-testid={`${rowId}-elbow`}>
        <span className={cn(LINE, "left-1/2 top-0 w-px", node.last ? "h-1/2" : "h-full")} data-testid={`${rowId}-elbow-stem`} />
        <span className={cn(LINE, "left-1/2 top-1/2 h-px w-1/2")} data-testid={`${rowId}-elbow-arm`} />
      </span>
    </span>
  );
}

export function LayersPanel({ html, selectedId, onSelect, onMove }: LayersProps) {
  const layers = useMemo(() => layerTree(html), [html]);
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const [drop, setDrop] = useState<{ id: string; position: InsertPosition } | null>(null);
  // A branch is hidden while any ancestor is folded; the selection keeps its path open.
  const visible = layers.filter((node) => !node.ancestors.some((a) => collapsed.has(a)));

  const toggle = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const positionFor = (e: React.DragEvent, node: LayerNode): InsertPosition => {
    const r = e.currentTarget.getBoundingClientRect();
    return e.clientY < r.top + r.height / 2 ? "before" : node.kind === "box" && e.clientX > r.left + 40 + node.depth * LEVEL ? "inside" : "after";
  };

  return (
    <ul className="m-0 grid list-none grid-cols-[minmax(0,1fr)] p-2" aria-label="Capas del email" role="tree" data-testid="email-builder-layers" data-observe="email-builder-layers">
      {visible.map((node) => {
        const rowId = `email-builder-layer-${node.id}`;
        const open = !collapsed.has(node.id);
        const selected = selectedId === node.id;
        const LayerIcon = LAYER_ICONS[node.kind] ?? LAYER_ICONS.box;
        return (
          <li
            key={node.id}
            role="treeitem"
            aria-level={node.depth + 1}
            aria-expanded={node.hasChildren ? open : undefined}
            aria-selected={selected}
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
              drop?.id === node.id && drop.position === "before" && "before:absolute before:inset-x-0 before:top-0 before:z-10 before:h-0.5 before:bg-[#22c55e]",
              drop?.id === node.id && drop.position === "after" && "after:absolute after:inset-x-0 after:bottom-0 after:z-10 after:h-0.5 after:bg-[#22c55e]",
            )}
            data-testid={rowId}
          >
            <div
              className={cn(
                "flex h-7 min-w-0 items-stretch rounded-md pl-1 transition-colors",
                selected ? "bg-[#7c5cff]/20" : "hover:bg-bo-surface-2",
                drop?.id === node.id && drop.position === "inside" && "ring-1 ring-[#22c55e]",
              )}
              data-testid={`${rowId}-row`}
            >
              <TreeLines node={node} rowId={rowId} />
              {node.hasChildren ? (
                <button
                  type="button"
                  onClick={() => toggle(node.id)}
                  aria-label={open ? `Plegar ${node.label}` : `Desplegar ${node.label}`}
                  className="grid w-4 shrink-0 cursor-pointer place-items-center border-0 bg-transparent text-bo-faint hover:text-bo-text"
                  data-testid={`${rowId}-toggle`}
                >
                  <ChevronRight size={12} aria-hidden="true" className={cn("transition-transform", open && "rotate-90")} data-testid={`${rowId}-toggle-icon`} />
                </button>
              ) : (
                <span className="w-4 shrink-0" aria-hidden="true" data-testid={`${rowId}-toggle-spacer`} />
              )}
              <button
                type="button"
                onClick={() => onSelect(node.id)}
                aria-current={selected || undefined}
                className={cn(
                  "flex min-w-0 flex-1 cursor-pointer items-center gap-1.5 border-0 bg-transparent pr-2 text-left text-[12.5px]",
                  selected ? "text-bo-text" : "text-bo-muted hover:text-bo-text",
                )}
                data-testid={`email-builder-layer-btn-${node.id}`}
              >
                <span className={cn("shrink-0", selected ? "text-[#b9a8ff]" : "text-bo-faint")} data-testid={`email-builder-layer-icon-${node.id}`}>
                  <LayerIcon size={13} aria-hidden="true" data-testid={`email-builder-layer-svg-${node.id}`} />
                </span>
                <span className="shrink-0 font-medium" data-testid={`email-builder-layer-label-${node.id}`}>{node.label}</span>
                {node.hint && <span className="min-w-0 truncate text-bo-faint" data-testid={`email-builder-layer-hint-${node.id}`}>{node.hint}</span>}
                {node.channel !== "all" && (
                  <span
                    className={cn("ml-auto shrink-0 rounded px-1 text-[10px] font-semibold", node.channel === "whatsapp" ? "bg-[#25d366]/15 text-[#4ade80]" : "bg-[#60a5fa]/15 text-[#93c5fd]")}
                    title={node.channel === "whatsapp" ? "Solo WhatsApp" : "Solo email"}
                    data-testid={`email-builder-layer-channel-${node.id}`}
                  >
                    {node.channel === "whatsapp" ? "WA" : "Email"}
                  </span>
                )}
                {node.hidden && <EyeOff size={12} className={cn("shrink-0 text-bo-faint", node.channel === "all" && "ml-auto")} aria-label="Oculto en algún tamaño" data-testid={`email-builder-layer-hidden-${node.id}`} />}
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
