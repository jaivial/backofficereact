import React, { useCallback, useMemo } from "react";
import { Plus, Trash2 } from "lucide-react";
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

  return (
    <div className={`flex flex-col gap-3 ${className}`} data-ui="mandatory-menu-selector">
      {selectedMenus.map((menu, idx) => (
        <div
          key={`${menu.id}-${idx}`}
          className="flex flex-row items-center gap-2"
          data-ui="menu-row"
          data-row-index={idx}
        >
          <Select
            value={String(menu.id)}
            onChange={(v) => handleMenuSelect(idx, v)}
            options={menuOptions}
            size="sm"
            ariaLabel={`Seleccionar menu para fila ${idx + 1}`}
            className="flex-1"
          />

          <label
            className="flex items-center gap-1.5 text-sm whitespace-nowrap"
            data-ui="choose-main-label"
          >
            <input
              type="checkbox"
              checked={menuChooseMain.includes(menu.id)}
              onChange={(e) => handleChooseMainToggle(menu.id, e.target.checked)}
              className="bo-checkbox"
              data-ui="choose-main-checkbox"
            />
            <span className="text-(--bo-muted)">Principales seleccionables</span>
          </label>

          {selectedMenuIds.length > 1 && (
            <button
              type="button"
              onClick={() => handleDeleteRow(idx)}
              className="bo-btn bo-btn--ghost bo-btn--icon p-1.5"
              aria-label={`Eliminar menu ${menu.menu_title}`}
              data-ui="delete-row-btn"
            >
              <Trash2 size={16} strokeWidth={1.8} aria-hidden="true" />
            </button>
          )}
        </div>
      ))}

      {menus.length > selectedMenuIds.length && (
        <button
          type="button"
          onClick={handleAddRow}
          className="bo-btn bo-btn--ghost flex items-center justify-center gap-1.5"
          data-ui="add-menu-btn"
        >
          <Plus size={16} strokeWidth={1.8} aria-hidden="true" />
          <span>Añadir menu</span>
        </button>
      )}

      {menus.length === 0 && (
        <div className="text-(--bo-muted) text-sm" data-ui="no-menus-message">
          No hay menus disponibles
        </div>
      )}
    </div>
  );
}
