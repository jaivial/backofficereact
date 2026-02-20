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
      className={cn("bo-menuV2Card", "bo-menuGlassPanel", menu.active ? "is-active" : "is-inactive", menu.is_draft && "is-draft")}
      role="listitem"
      tabIndex={0}
      onClick={openMenuEditor}
      onKeyDown={handleCardKeyDown}
      data-active={menu.active ? "true" : "false"}
      data-draft={menu.is_draft ? "true" : "false"}
      aria-label={`Abrir menu ${title}`}
    >
      <div className="bo-menuV2Main">
        <div className="bo-menuV2TitleRow">
          <h3 className="bo-menuV2Title">{title}</h3>
        </div>

        <div className="bo-menuV2Row bo-menuV2Row--meta">
          <div className="bo-menuV2Meta">
            <span className="bo-menuTag">{typeLabel}</span>
            {menu.is_draft ? <span className="bo-menuTag bo-menuTag--warn">Borrador</span> : null}
          </div>
          <div className="bo-menuV2Price">{priceLabel}</div>
        </div>
      </div>

      <div className="bo-menuV2Aside">
        <div className="bo-menuV2StatusCtrl">
          <span className={cn("bo-menuTag", "bo-menuTag--state", menu.active && "is-on")}>{statusLabel}</span>
          <div onClick={stopPropagation} onPointerDown={stopPropagation} onKeyDown={stopPropagation}>
            <Switch
              checked={!!menu.active}
              disabled={switchDisabled}
              onCheckedChange={handleToggle}
              aria-label={`Cambiar estado de menu ${title}`}
            />
          </div>
        </div>

        <div className="bo-menuV2Actions">
          <button
            className="bo-btn bo-btn--ghost bo-btn--sm bo-btn--glass bo-menuV2IconBtn"
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
            className="bo-btn bo-btn--ghost bo-btn--sm bo-btn--glass bo-menuV2IconBtn"
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
            className="bo-btn bo-btn--ghost bo-btn--danger bo-btn--sm bo-btn--glass bo-menuV2IconBtn"
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
