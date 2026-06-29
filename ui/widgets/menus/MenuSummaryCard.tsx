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
  className,
  onToggleActive,
  onOpenEditor,
  onRequestChangeType,
  onRequestDelete,
}: {
  menu: GroupMenuV2Summary;
  switchDisabled: boolean;
  actionsDisabled: boolean;
  className?: string;
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
      className={cn("bo-panel", "bo-menuV2Card", menu.active ? "is-active" : "is-inactive", menu.is_draft && "is-draft", className)}
      role="listitem"
      tabIndex={0}
      onClick={openMenuEditor}
      onKeyDown={handleCardKeyDown}
      data-active={menu.active ? "true" : "false"}
      data-draft={menu.is_draft ? "true" : "false"}
      data-testid={`menu-summary-${menu.id}`}
      aria-label={`Abrir menu ${title}`}
    >
      <div className="bo-menuV2Main" data-slot="menu-summary-main">
        <div className="bo-menuV2TitleRow" data-slot="menu-summary-title-row">
          <h3 className="bo-menuV2Title" data-slot="menu-summary-title">{title}</h3>
        </div>

        <div className="bo-menuV2Row bo-menuV2Row--meta" data-slot="menu-summary-meta-row">
          <div className="bo-menuV2Meta" data-slot="menu-summary-tags">
            <span className="bo-menuTag" data-slot="menu-summary-type-tag">{typeLabel}</span>
            {menu.is_draft ? <span className="bo-menuTag bo-menuTag--warn" data-slot="menu-summary-draft-tag">Borrador</span> : null}
          </div>
          <div className="bo-menuV2Price" data-slot="menu-summary-price">{priceLabel}</div>
        </div>
      </div>

      <div className="bo-menuV2Aside" data-slot="menu-summary-aside">
        <div className="bo-menuV2StatusCtrl" data-slot="menu-summary-status-controls">
          <span className={cn("bo-menuTag", "bo-menuTag--state", menu.active && "is-on")} data-slot="menu-summary-status-tag">{statusLabel}</span>
          <div onClick={stopPropagation} onPointerDown={stopPropagation} onKeyDown={stopPropagation} data-slot="menu-summary-switch-wrapper">
            <Switch
              checked={!!menu.active}
              disabled={switchDisabled}
              onCheckedChange={handleToggle}
              aria-label={`Cambiar estado de menu ${title}`}
            />
          </div>
        </div>

        <div className="bo-menuV2Actions" data-slot="menu-summary-actions">
          <button
            className="bo-btn bo-btn--ghost bo-btn--sm bo-btn--glass bo-menuV2IconBtn"
            type="button"
            disabled={actionsDisabled}
            onClick={handleChangeType}
            onKeyDown={stopPropagation}
            data-testid={`menu-summary-change-type-${menu.id}`}
            aria-label={`Cambiar tipo de menu ${title}`}
            title="Cambiar tipo"
            data-slot="menu-summary-change-type-btn"
          >
            <Repeat2 size={14} aria-hidden="true" focusable={false} />
          </button>
          <button
            className="bo-btn bo-btn--ghost bo-btn--sm bo-btn--glass bo-menuV2IconBtn"
            type="button"
            disabled={actionsDisabled}
            onClick={handleEdit}
            onKeyDown={stopPropagation}
            data-testid={`menu-summary-edit-${menu.id}`}
            aria-label={`Editar menu ${title}`}
            title="Editar"
            data-slot="menu-summary-edit-btn"
          >
            <PencilLine size={14} aria-hidden="true" focusable={false} />
          </button>
          <button
            className="bo-btn bo-btn--ghost bo-btn--danger bo-btn--sm bo-btn--glass bo-menuV2IconBtn"
            type="button"
            disabled={actionsDisabled}
            onClick={handleDelete}
            onKeyDown={stopPropagation}
            data-testid={`menu-summary-delete-${menu.id}`}
            aria-label={`Eliminar menu ${title}`}
            title="Eliminar"
            data-slot="menu-summary-delete-btn"
          >
            <Trash2 size={14} aria-hidden="true" focusable={false} />
          </button>
        </div>
      </div>
    </article>
  );
});
