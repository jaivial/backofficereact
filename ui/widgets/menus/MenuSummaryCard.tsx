import React, { useCallback, useMemo } from "react";

import type { GroupMenuV2Summary } from "../../../api/types";
import { cn } from "../../shadcn/utils";
import { Switch } from "../../shadcn/Switch";
import { PencilLine, Repeat2, Trash2 } from "lucide-react";
import { formatMenuPrice, menuTypeLabel } from "./menuPresentation";

export const MenuSummaryCard = React.memo(function MenuSummaryCard({
  menu,
  switchDisabled,
  actionsDisabled,
  onToggleActive,
  onOpenEditor,
  onRequestChangeType,
  onRequestDelete,
}: {
  menu: GroupMenuV2Summary;
  switchDisabled: boolean;
  actionsDisabled: boolean;
  onToggleActive: (menuId: number) => Promise<void>;
  onOpenEditor: (menuId: number) => void;
  onRequestChangeType: (menu: GroupMenuV2Summary) => void;
  onRequestDelete: (menu: GroupMenuV2Summary) => void;
}) {
  const title = menu.menu_title || "Sin titulo";
  const typeLabel = useMemo(() => menuTypeLabel(menu.menu_type || "closed_conventional"), [menu.menu_type]);
  const priceLabel = useMemo(() => formatMenuPrice(menu.price), [menu.price]);
  const statusLabel = menu.active ? "Activo" : "Inactivo";

  const openMenuEditor = useCallback(() => {
    onOpenEditor(menu.id);
  }, [menu.id, onOpenEditor]);

  const handleCardKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLElement>) => {
      if (event.key === "Enter" || event.key === " " || event.key === "Spacebar") {
        event.preventDefault();
        openMenuEditor();
      }
    },
    [openMenuEditor],
  );

  const stopPropagation = useCallback((event: React.SyntheticEvent) => {
    event.stopPropagation();
  }, []);

  const handleChangeType = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      stopPropagation(event);
      onRequestChangeType(menu);
    },
    [menu, onRequestChangeType, stopPropagation],
  );

  const handleEdit = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      stopPropagation(event);
      onOpenEditor(menu.id);
    },
    [menu.id, onOpenEditor, stopPropagation],
  );

  const handleDelete = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      stopPropagation(event);
      onRequestDelete(menu);
    },
    [menu, onRequestDelete, stopPropagation],
  );

  const handleToggle = useCallback(() => {
    void onToggleActive(menu.id);
  }, [menu.id, onToggleActive]);

  return (
    <article
      className={cn(
        "rounded-xl border border-white/[0.06] bg-gradient-to-b from-white/[0.04] to-black/[0.10] p-4 flex items-center justify-between gap-4 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-lg hover:border-white/[0.12] cursor-pointer",
        menu.active ? "opacity-100" : "opacity-60",
        menu.is_draft && "border-yellow-500/30 bg-yellow-500/5"
      )}
      role="listitem"
      tabIndex={0}
      onClick={openMenuEditor}
      onKeyDown={handleCardKeyDown}
      data-active={menu.active ? "true" : "false"}
      data-draft={menu.is_draft ? "true" : "false"}
      aria-label={`Abrir menu ${title}`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-2">
          <h3 className="text-sm font-semibold truncate">{title}</h3>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-white/10 text-white/80 border border-white/[0.06]">{typeLabel}</span>
            {menu.is_draft ? <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">Borrador</span> : null}
          </div>
          <div className="text-sm font-semibold text-primary">{priceLabel}</div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span className={cn("px-1.5 py-0.5 text-[10px] font-medium rounded border", menu.active ? "bg-green-500/20 text-green-400 border-green-500/30" : "bg-white/10 text-white/60 border-white/[0.06]")}>{statusLabel}</span>
          <div onClick={stopPropagation} onPointerDown={stopPropagation} onKeyDown={stopPropagation}>
            <Switch
              checked={!!menu.active}
              disabled={switchDisabled}
              onCheckedChange={handleToggle}
              aria-label={`Cambiar estado de menu ${title}`}
            />
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            className="w-8 h-8 rounded-lg border border-white/[0.06] bg-white/[0.02] text-muted-foreground grid place-items-center cursor-pointer transition-all hover:bg-white/[0.04] hover:text-foreground"
            type="button"
            disabled={actionsDisabled}
            onClick={handleChangeType}
            onKeyDown={stopPropagation}
            aria-label={`Cambiar tipo de menu ${title}`}
            title="Cambiar tipo"
          >
            <Repeat2 size={14} aria-hidden="true" focusable={false} />
          </button>
          <button
            className="w-8 h-8 rounded-lg border border-white/[0.06] bg-white/[0.02] text-muted-foreground grid place-items-center cursor-pointer transition-all hover:bg-white/[0.04] hover:text-foreground"
            type="button"
            disabled={actionsDisabled}
            onClick={handleEdit}
            onKeyDown={stopPropagation}
            aria-label={`Editar menu ${title}`}
            title="Editar"
          >
            <PencilLine size={14} aria-hidden="true" focusable={false} />
          </button>
          <button
            className="w-8 h-8 rounded-lg border border-white/[0.06] bg-white/[0.02] text-red-400 grid place-items-center cursor-pointer transition-all hover:bg-red-500/20 hover:text-red-300"
            type="button"
            disabled={actionsDisabled}
            onClick={handleDelete}
            onKeyDown={stopPropagation}
            aria-label={`Eliminar menu ${title}`}
            title="Eliminar"
          >
            <Trash2 size={14} aria-hidden="true" focusable={false} />
          </button>
        </div>
      </div>
    </article>
  );
});
