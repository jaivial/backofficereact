import React, { useCallback, useMemo } from "react";
import { Plus, Trash2 } from "lucide-react";
import { cn } from "../shadcn/utils";
import { Select } from "../inputs/Select";
import type { MenuSelectorItem } from "../../api/types";

type MandatoryMenuSelectorProps = {
  menus: MenuSelectorItem[];
  selectedMenuIds: number[];
  menuChooseMain: number[];
  onChange: (menuIds: number[], menuChooseMain: number[]) => void;
  className?: string;
};

const MENU_TYPE_LABELS: Record<string, string> = {
  closed_conventional: "Cerrado convencional",
  a_la_carte_group: "Menu grupo a la carta",
  closed_group: "Menu de grupo cerrado",
  special: "Especial",
  a_la_carte: "A la carta convencional",
};

function getMenuTypeLabel(menuType: string): string {
  return MENU_TYPE_LABELS[menuType] ?? menuType;
}

export function MandatoryMenuSelector({
  menus,
  selectedMenuIds,
  menuChooseMain,
  onChange,
  className = "",
}: MandatoryMenuSelectorProps) {
  const menuOptions = useMemo(() => {
    return menus.map((m) => ({
      value: String(m.id),
      label: m.menu_title,
      right: getMenuTypeLabel(m.menu_type),
    }));
  }, [menus]);

  const selectedMenus = useMemo(() => {
    return selectedMenuIds
      .map((id) => menus.find((m) => m.id === id))
      .filter((m): m is MenuSelectorItem => m != null);
  }, [selectedMenuIds, menus]);

  const handleMenuSelect = useCallback(
    (rowIndex: number, menuId: string) => {
      const newIds = [...selectedMenuIds];
      newIds[rowIndex] = Number(menuId);
      onChange(newIds, menuChooseMain);
    },
    [selectedMenuIds, menuChooseMain, onChange],
  );

  const handleChooseMainToggle = useCallback(
    (menuId: number, checked: boolean) => {
      if (checked) {
        onChange(selectedMenuIds, [...menuChooseMain, menuId]);
      } else {
        onChange(selectedMenuIds, menuChooseMain.filter((id) => id !== menuId));
      }
    },
    [selectedMenuIds, menuChooseMain, onChange],
  );

  const handleAddRow = useCallback(() => {
    // Find a menu that's not already selected
    const availableMenu = menus.find((m) => !selectedMenuIds.includes(m.id));
    if (availableMenu) {
      onChange([...selectedMenuIds, availableMenu.id], menuChooseMain);
    } else {
      onChange([...selectedMenuIds, menus[0]?.id ?? 0], menuChooseMain);
    }
  }, [menus, selectedMenuIds, menuChooseMain, onChange]);

  const handleDeleteRow = useCallback(
    (rowIndex: number) => {
      const menuIdToRemove = selectedMenuIds[rowIndex];
      const newIds = selectedMenuIds.filter((_, i) => i !== rowIndex);
      const newChooseMain = menuChooseMain.filter((id) => id !== menuIdToRemove);
      onChange(newIds, newChooseMain);
    },
    [selectedMenuIds, menuChooseMain, onChange],
  );

  // Empty state - show prompt to add first menu
  if (selectedMenuIds.length === 0) {
    return (
      <div
        className={cn("flex flex-col items-center justify-center py-8 px-4 rounded-xl border-2 border-dashed border-(--bo-border) bg-(--bo-surface-2)", className)}
        data-ui="mandatory-menu-selector-empty"
        data-slot="mandatory-menu-selector-empty"
      >
        <div className="text-(--bo-muted) text-sm text-center mb-4" data-slot="mandatory-menu-selector-prompt">
          Selecciona un menú para continuar
        </div>
        <button
          type="button"
          onClick={handleAddRow}
          disabled={menus.length === 0}
          className="bo-btn primary flex items-center gap-2"
          data-ui="add-first-menu-btn"
        >
          <Plus size={16} strokeWidth={1.8} aria-hidden="true" />
          <span>Añadir menú</span>
        </button>
        {menus.length === 0 && (
          <div className="text-(--bo-faint) text-xs mt-3" data-slot="mandatory-menu-selector-no-menus">
            No hay menus disponibles
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-3", className)} data-ui="mandatory-menu-selector" data-slot="mandatory-menu-selector">
      {/* Header row - hidden on mobile */}
      <div className="hidden sm:flex flex-row items-center gap-3 px-3 py-1 text-xs text-(--bo-muted) uppercase tracking-wide" data-slot="mandatory-menu-selector-header">
        <div className="flex-1" data-slot="mandatory-menu-selector-header-menu">Menú</div>
        <div className="w-36 text-center" data-slot="mandatory-menu-selector-header-main">Principales</div>
        <div className="w-10" data-slot="mandatory-menu-selector-header-actions"></div>
      </div>

      {selectedMenus.map((menu, idx) => (
        <div
          key={`${menu.id}-${idx}`}
          className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 p-3 sm:p-3 rounded-lg bg-(--bo-surface-2) border border-(--bo-border)"
          data-ui="menu-row"
          data-row-index={idx}
        >
          {/* Menu selector - centered on mobile */}
          <div className="flex flex-col items-center sm:items-start flex-1 min-w-0 w-full" data-slot="mandatory-menu-selector-menu-field">
            <Select
              value={String(menu.id)}
              onChange={(v) => handleMenuSelect(idx, v)}
              options={menuOptions}
              size="sm"
              ariaLabel={`Seleccionar menú ${idx + 1}`}
              className="w-full sm:w-auto sm:min-w-[200px]"
            />
            {/* Show menu type label on mobile */}
            <div className="sm:hidden text-xs text-(--bo-muted) mt-1" data-slot="mandatory-menu-selector-menu-type">
              {getMenuTypeLabel(menu.menu_type)}
            </div>
          </div>

          {/* Checkbox - centered on mobile and desktop */}
          <div className="flex items-center justify-center gap-2 sm:w-36" data-slot="mandatory-menu-selector-checkbox-field">
            <label
              className="flex items-center gap-2 cursor-pointer"
              data-ui="choose-main-label"
            >
              <input
                type="checkbox"
                checked={menuChooseMain.includes(menu.id)}
                onChange={(e) => handleChooseMainToggle(menu.id, e.target.checked)}
                className="bo-checkbox"
                data-ui="choose-main-checkbox"
              />
              <span className="text-sm text-(--bo-text) sm:hidden" data-slot="mandatory-menu-selector-checkbox-label">Principales</span>
            </label>
          </div>

          {/* Delete button - centered on mobile */}
          <div className="flex justify-center sm:w-10" data-slot="mandatory-menu-selector-delete-field">
            {selectedMenuIds.length > 1 && (
              <button
                type="button"
                onClick={() => handleDeleteRow(idx)}
                className="bo-btn bo-btn--ghost bo-btn--icon p-2 text-(--bo-muted) hover:text-(--bo-text-danger) transition-colors duration-150"
                aria-label={`Eliminar menú ${menu.menu_title}`}
                data-ui="delete-row-btn"
              >
                <Trash2 size={16} strokeWidth={1.8} aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
      ))}

      {/* Add more button */}
      {menus.length > selectedMenuIds.length && (
        <button
          type="button"
          onClick={handleAddRow}
          className="bo-btn bo-btn--ghost flex items-center justify-center gap-2 py-2 text-sm w-fit mx-auto"
          data-ui="add-menu-btn"
        >
          <Plus size={16} strokeWidth={1.8} aria-hidden="true" />
          <span>Añadir otro menú</span>
        </button>
      )}

      {/* No menus available */}
      {menus.length === 0 && selectedMenuIds.length === 0 && (
        <div className="text-center py-6 text-(--bo-muted) text-sm" data-ui="no-menus-message" data-slot="mandatory-menu-selector-no-menus">
          No hay menús disponibles
        </div>
      )}
    </div>
  );
}
