import React from "react";
import { ClipboardList, Pencil, Trash2, Users, X } from "lucide-react";
import { StableNodeResizer } from "./functionalComponents/StableNodeResizer/StableNodeResizer";
import { previewGeometry } from "./helpers/tables";
import { DRAW_PRESET_ICONS, STATUS_LABEL, TABLE_SIZE_MIN } from "./constants/tables";
import {
	drawElementSizeForPreset,
	drawPresetAssetImageUrl,
	drawPresetLabel,
	normalizeDrawElementDisplayMode,
	normalizeDrawElementKind,
	normalizeDrawElementPreset,
} from "./drawPresets";
import type { DrawElement, DrawNodeData, TableNodeData } from "./types/tables";

/**
 * Salon map building blocks shared by the reservas table manager and the POS
 * salon modal: React Flow node renderers plus the layout-element normalizer.
 */

/** Normalizes raw layout element rows (per-day `elements` or cross-day
 *  `draw_elements_template`) into the DrawElement shape the canvas renders. */
export function normalizeLayoutElements(raw: unknown): DrawElement[] {
	if (!Array.isArray(raw)) return [];
	return (raw as any[])
		.map((item) => {
			const id = String(item?.id || "").trim();
			if (!id) return null;
			const kind = normalizeDrawElementKind(item?.kind);
			const preset = normalizeDrawElementPreset(item?.preset);
			const displayMode = normalizeDrawElementDisplayMode(
				item?.display_mode ?? item?.displayMode,
			);
			const defaultSize = drawElementSizeForPreset(preset);
			return {
				id,
				kind,
				preset,
				displayMode,
				x: Number(item?.x || 0),
				y: Number(item?.y || 0),
				width: Math.max(24, Number(item?.width || defaultSize.width)),
				height: Math.max(24, Number(item?.height || defaultSize.height)),
				rotationDeg: Number(item?.rotationDeg || 0),
				label: String(item?.label || drawPresetLabel(preset)),
			} as DrawElement;
		})
		.filter(Boolean) as DrawElement[];
}

// === Table node renderer ===
function tableFromRFNode(data: TableNodeData): React.JSX.Element {
	const explicitSize =
		typeof data.width === "number" || typeof data.height === "number"
			? { width: data.width, height: data.height }
			: undefined;
	const geom = previewGeometry(
		data.shape,
		data.capacity,
		data.rectShortSides,
		explicitSize,
	);
	const shape = data.shape === "square" ? "is-square" : "is-round";
	const style: React.CSSProperties = {
		["--bo-table-fill" as any]: data.fillColor || "var(--bo-surface-2)",
		["--bo-table-outline" as any]: data.outlineColor || "var(--bo-border-2)",
		["--bo-table-texture" as any]: data.textureImageUrl
			? `url(${data.textureImageUrl})`
			: "none",
		transform: `rotate(${Number.isFinite(data.rotationDeg) ? data.rotationDeg : 0}deg)`,
		width: `${geom.width}px`,
		height: `${geom.height}px`,
	};
	const seatedNames = data.seatedNames || [];
	return (
		<div
			data-ui="table-node"
			className={`bo-tableMapNode ${shape}${data.assignMode ? " is-assign-mode" : ""}${data.isSelected ? " is-selected" : ""}${data.editable ? " is-editable" : ""}${data.isMultiSelected ? " is-multi-selected" : ""}`}
			style={style}
		>
			{data.editable ? (
				<StableNodeResizer
					isVisible={data.editable && Boolean(data.isSelected)}
					minWidth={TABLE_SIZE_MIN}
					minHeight={TABLE_SIZE_MIN}
					onResize={data.onResize}
					onResizeEnd={data.onResizeEnd}
				/>
			) : null}
			{geom.chairs.map((chair, idx) => (
				<span
					key={`node-chair-${idx}`}
					data-ui="chair"
					className="bo-tableMapChair"
					style={{ transform: `translate(${chair.x}px, ${chair.y}px)` }}
				/>
			))}
			<div data-ui="node-pax" className="bo-tableMapNodePax">
				<Users size={11} strokeWidth={1.8} aria-hidden="true" />
				<span data-ui="node-pax-value">{data.capacity} pax</span>
			</div>
			<div data-ui="node-number" className="bo-tableMapNodeNum">
				{data.numeroMesa || data.id}
			</div>
			<div
				data-ui="node-status"
				className={`bo-tableMapNodeStatus is-${data.status}`}
			>
				{STATUS_LABEL[data.status]}
			</div>
			{seatedNames.length > 0 ? (
				<div data-ui="node-seated-names" className="bo-tableMapNodeSeatedNames">
					{seatedNames.join(", ")}
				</div>
			) : null}
			{/* Edit-mode action overlay for the selected table (single selection) */}
			{data.editable &&
				data.isSelected &&
				!data.assignMode &&
				!data.isMultiSelected && (
					<div
						data-ui="table-action-overlay"
						className="bo-tableMultiSelectOverlay"
					>
						<button
							data-ui="table-edit-btn"
							type="button"
							className="bo-tableMultiSelectBtn"
							title="Editar mesa"
							aria-label="Editar mesa"
							onClick={(e) => {
								e.stopPropagation();
								data.onEditClick?.();
							}}
						>
							<Pencil size={12} strokeWidth={2} />
						</button>
						<button
							data-ui="table-delete-btn"
							type="button"
							className="bo-tableMultiSelectBtn bo-tableMultiSelectBtn--remove"
							title="Eliminar mesa"
							aria-label="Eliminar mesa"
							onClick={(e) => {
								e.stopPropagation();
								data.onDeleteClick?.();
							}}
						>
							<Trash2 size={12} strokeWidth={2} />
						</button>
					</div>
				)}
			{/* Multi-table selection overlay - buttons outside container on top-right */}
			{data.isMultiSelected && (
				<div
					data-ui="multi-select-overlay"
					className="bo-tableMultiSelectOverlay"
				>
					<button
						data-ui="multi-names-btn"
						type="button"
						className="bo-tableMultiSelectBtn"
						title="Nombres"
						onClick={(e) => {
							e.stopPropagation();
							data.onMultiNamesClick?.();
						}}
					>
						<ClipboardList size={12} strokeWidth={2} />
					</button>
					<button
						data-ui="multi-remove-btn"
						type="button"
						className="bo-tableMultiSelectBtn bo-tableMultiSelectBtn--remove"
						title="Quitar"
						onClick={(e) => {
							e.stopPropagation();
							data.onMultiRemoveClick?.();
						}}
					>
						<X size={12} strokeWidth={2} />
					</button>
				</div>
			)}
		</div>
	);
}

const TableNode = ({ data }: { data: TableNodeData }) => tableFromRFNode(data);

// === Draw element node renderer ===
const DrawElementNode = ({ data }: { data: DrawNodeData }) => {
	const assetImageUrl = drawPresetAssetImageUrl(data.preset);
	const showAsset = data.displayMode === "asset" || data.displayMode === "both";
	const showText = data.displayMode === "text" || data.displayMode === "both";
	const style: React.CSSProperties = {
		width: `${data.width}px`,
		height: `${data.height}px`,
		transform: `rotate(${data.rotationDeg}deg)`,
	};
	const cls =
		data.kind === "wall"
			? "is-wall"
			: data.kind === "image"
				? "is-image"
				: "is-obstacle";
	return (
		<div
			data-ui="draw-element"
			className={`bo-drawElementNode ${cls}${data.isSelected ? " is-selected" : ""}${assetImageUrl && showAsset ? " has-asset" : ""}${showText ? " has-text" : " no-text"}`}
			style={style}
		>
			<StableNodeResizer
				isVisible={data.editable}
				minWidth={24}
				minHeight={24}
				onResize={data.onResize}
				onResizeEnd={data.onResizeEnd}
			/>
			{data.editable && data.isSelected && data.onDelete ? (
				<button
					data-ui="delete-draw-element-btn"
					className="bo-drawElementDeleteBtn"
					type="button"
					aria-label={`Eliminar ${data.label}`}
					title={`Eliminar ${data.label}`}
					onMouseDown={(event) => {
						event.preventDefault();
						event.stopPropagation();
					}}
					onClick={(event) => {
						event.preventDefault();
						event.stopPropagation();
						data.onDelete?.();
					}}
				>
					<Trash2 size={13} strokeWidth={2} />
				</button>
			) : null}
			{showAsset ? (
				assetImageUrl ? (
					<img
						data-ui="draw-asset"
						className="bo-drawElementNodeAsset"
						src={assetImageUrl}
						alt=""
						aria-hidden="true"
					/>
				) : (
					<span
						data-ui="draw-icon"
						className="bo-drawElementNodeIcon"
						aria-hidden="true"
					>
						{DRAW_PRESET_ICONS[data.preset]}
					</span>
				)
			) : null}
			{showText ? (
				<span data-ui="draw-label" className="bo-drawElementNodeLabel">
					{data.label}
				</span>
			) : null}
		</div>
	);
};

export const NODE_TYPES = {
	restaurantTable: TableNode,
	drawElement: DrawElementNode,
};
