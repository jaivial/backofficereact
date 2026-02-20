import React, { useCallback, useMemo, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronUp, Filter, FilterX, Plus } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { usePageContext } from "vike-react/usePageContext";

import { createClient } from "../../../api/client";
import type { GroupMenuV2Summary } from "../../../api/types";
import { useErrorToast } from "../../../ui/feedback/useErrorToast";
import { useToasts } from "../../../ui/feedback/useToasts";
import { Select } from "../../../ui/inputs/Select";
import { ConfirmDialog } from "../../../ui/overlays/ConfirmDialog";
import { cn } from "../../../ui/shadcn/utils";
import { MenuSummaryCard } from "../../../ui/widgets/menus/MenuSummaryCard";
import { MenuTypeChangeModal } from "../../../ui/widgets/menus/MenuTypeChangeModal";
import { MenuTypePanelGrid } from "../../../ui/widgets/menus/MenuTypePanelGrid";
import { MENU_TYPE_ORDER, menuTypeLabel } from "../../../ui/widgets/menus/menuPresentation";

type PageData = {
  menus: GroupMenuV2Summary[];
  error: string | null;
};

type MenuStatusFilter = "all" | "active" | "inactive";
type MenuSortOption = "created_desc" | "created_asc" | "price_asc" | "price_desc";

const MENU_STATUS_FILTER_OPTIONS: { value: MenuStatusFilter; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "active", label: "Activos" },
  { value: "inactive", label: "Inactivos" },
];
const MENU_SORT_OPTIONS: { value: MenuSortOption; label: string }[] = [
  { value: "created_desc", label: "Adicion mas nueva" },
  { value: "created_asc", label: "Adicion mas antigua" },
  { value: "price_asc", label: "Precio ascendente" },
  { value: "price_desc", label: "Precio descendente" },
];

function normalizedSearchValue(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function menuAddedAt(menu: Pick<GroupMenuV2Summary, "id" | "created_at" | "modified_at">): number {
  const createdAtMs = menu.created_at ? Date.parse(menu.created_at) : Number.NaN;
  if (Number.isFinite(createdAtMs)) return createdAtMs;
  const modifiedAtMs = menu.modified_at ? Date.parse(menu.modified_at) : Number.NaN;
  if (Number.isFinite(modifiedAtMs)) return modifiedAtMs;
  return menu.id;
}

function menuPriceNumber(menu: Pick<GroupMenuV2Summary, "price">): number {
  const n = Number(menu.price);
  return Number.isFinite(n) ? n : 0;
}

type MenuFiltersProps = {
  searchText: string;
  statusFilter: MenuStatusFilter;
  menuTypeFilter: string;
  sortBy: MenuSortOption;
  menuTypeOptions: string[];
  hasFilters: boolean;
  summaryText: string;
  disableActions: boolean;
  onSearchChange: (value: string) => void;
  onStatusFilterChange: (value: MenuStatusFilter) => void;
  onMenuTypeFilterChange: (value: string) => void;
  onSortByChange: (value: MenuSortOption) => void;
  onResetFilters: () => void;
};

const MenuFilters = React.memo(function MenuFilters({
  searchText,
  statusFilter,
  menuTypeFilter,
  sortBy,
  menuTypeOptions,
  hasFilters,
  summaryText,
  disableActions,
  onSearchChange,
  onStatusFilterChange,
  onMenuTypeFilterChange,
  onSortByChange,
  onResetFilters,
}: MenuFiltersProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const reduceMotion = useReducedMotion();
  const menuTypeFilterOptions = useMemo(
    () => [
      { value: "all", label: "Todos los tipos" },
      ...menuTypeOptions.map((type) => ({ value: type, label: menuTypeLabel(type) })),
    ],
    [menuTypeOptions],
  );

  const toggleExpanded = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  return (
    <div className="bo-menuV2Filters" aria-label="Filtros de menus">
      <div className="bo-menuV2FiltersHead">
        <div className="bo-menuV2FiltersTitle">
          <Filter size={15} />
          <span>Filtros</span>
        </div>
        <button
          className="bo-btn bo-btn--ghost bo-btn--sm bo-menuV2FiltersToggle"
          type="button"
          onClick={toggleExpanded}
          aria-expanded={isExpanded}
          aria-label={isExpanded ? "Colapsar filtros" : "Expandir filtros"}
        >
          {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </button>
      </div>

      <AnimatePresence initial={false}>
        {isExpanded ? (
          <motion.div
            key="expanded-filters"
            style={{ overflow: "hidden" }}
            initial={reduceMotion ? { opacity: 1, height: "auto" } : { opacity: 0, height: 0, y: -6 }}
            animate={{ opacity: 1, height: "auto", y: 0 }}
            exit={reduceMotion ? { opacity: 1, height: "auto" } : { opacity: 0, height: 0, y: -6 }}
            transition={reduceMotion ? { duration: 0 } : { duration: 0.5, ease: "easeInOut" }}
          >
            <div className="bo-menuV2FiltersGrid">
              <label className="bo-field bo-menuV2Filter bo-menuV2Filter--search">
                <span className="bo-label">Buscar por titulo</span>
                <input
                  className="bo-input"
                  type="search"
                  value={searchText}
                  placeholder="Ejemplo: San Valentin"
                  onChange={(e) => onSearchChange(e.target.value)}
                />
              </label>

              <label className="bo-field bo-menuV2Filter bo-menuV2Filter--status">
                <span className="bo-label">Estado</span>
                <Select
                  value={statusFilter}
                  onChange={(value) => onStatusFilterChange(value as MenuStatusFilter)}
                  options={MENU_STATUS_FILTER_OPTIONS}
                  ariaLabel="Estado"
                />
              </label>

              <label className="bo-field bo-menuV2Filter bo-menuV2Filter--type">
                <span className="bo-label">Tipo de menu</span>
                <Select value={menuTypeFilter} onChange={onMenuTypeFilterChange} options={menuTypeFilterOptions} ariaLabel="Tipo de menu" />
              </label>

              <label className="bo-field bo-menuV2Filter bo-menuV2Filter--sort">
                <span className="bo-label">Ordenar</span>
                <Select value={sortBy} onChange={(value) => onSortByChange(value as MenuSortOption)} options={MENU_SORT_OPTIONS} ariaLabel="Ordenar" />
              </label>
            </div>

            <div className="bo-menuV2FiltersFoot">
              <div className="bo-mutedText bo-menuV2FiltersCount">{summaryText}</div>
              <div className="bo-menuV2FiltersActions">
                <button
                  className={cn("bo-btn bo-btn--ghost bo-btn--sm bo-menuV2ClearBtn", !hasFilters && "is-hidden")}
                  type="button"
                  disabled={disableActions || !hasFilters}
                  onClick={onResetFilters}
                  tabIndex={hasFilters ? 0 : -1}
                  aria-hidden={!hasFilters}
                >
                  <FilterX size={15} />
                  Limipiar filtros
                </button>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
});

export default function Page() {
  const pageContext = usePageContext();
  // Guard against missing or malformed data
  const data = (pageContext.data as PageData) || { menus: [], error: null };
  const api = useMemo(() => createClient({ baseUrl: "" }), []);
  const { pushToast } = useToasts();

  const [togglingMenuId, setTogglingMenuId] = useState<number | null>(null);
  const [deletingMenuId, setDeletingMenuId] = useState<number | null>(null);
  const [changingMenuTypeId, setChangingMenuTypeId] = useState<number | null>(null);

  const error = data.error;
  // Ensure menus is always an array to prevent iteration errors
  const menusData = Array.isArray(data.menus) ? data.menus : [];
  const [menus, setMenus] = useState<GroupMenuV2Summary[]>(menusData);
  const [confirmDel, setConfirmDel] = useState<{ open: boolean; menu: GroupMenuV2Summary | null }>({ open: false, menu: null });
  const [changeTypeDialog, setChangeTypeDialog] = useState<{ open: boolean; menu: GroupMenuV2Summary | null; nextType: string }>({
    open: false,
    menu: null,
    nextType: "closed_conventional",
  });
  const [searchText, setSearchText] = useState("");
  const [showTypeSelector, setShowTypeSelector] = useState(true);
  const [statusFilter, setStatusFilter] = useState<MenuStatusFilter>("all");
  const [menuTypeFilter, setMenuTypeFilter] = useState("all");
  const [sortBy, setSortBy] = useState<MenuSortOption>("created_desc");
  useErrorToast(error);

  const disableGlobalActions = deletingMenuId !== null || changingMenuTypeId !== null;

  const openEditor = useCallback((id?: number) => {
    const url = id ? `/app/menus/crear?menuId=${encodeURIComponent(String(id))}` : "/app/menus/crear";
    window.location.href = url;
  }, []);

  const onToggleActive = useCallback(
    async (menuId: number) => {
      setTogglingMenuId(menuId);
      try {
        const res = await api.menus.gruposV2.toggleActive(menuId);
        if (!res.success) {
          pushToast({ kind: "error", title: "Error", message: res.message || "No se pudo cambiar el estado" });
          return;
        }
        setMenus((prev) => prev.map((m) => (m.id === menuId ? { ...m, active: !!res.active } : m)));
      } finally {
        setTogglingMenuId((current) => (current === menuId ? null : current));
      }
    },
    [api, pushToast],
  );

  const onDelete = useCallback(async () => {
    const menu = confirmDel.menu;
    if (!menu) return;
    setDeletingMenuId(menu.id);
    try {
      const res = await api.menus.gruposV2.delete(menu.id);
      if (!res.success) {
        pushToast({ kind: "error", title: "Error", message: res.message || "No se pudo eliminar" });
        return;
      }
      setMenus((prev) => prev.filter((m) => m.id !== menu.id));
      setConfirmDel({ open: false, menu: null });
      pushToast({ kind: "success", title: "Eliminado" });
    } finally {
      setDeletingMenuId(null);
    }
  }, [api, confirmDel.menu, pushToast]);

  const requestDelete = useCallback((menu: GroupMenuV2Summary) => {
    setConfirmDel({ open: true, menu });
  }, []);

  const closeDeleteConfirm = useCallback(() => {
    setConfirmDel({ open: false, menu: null });
  }, []);

  const requestChangeType = useCallback((menu: GroupMenuV2Summary) => {
    setChangeTypeDialog({
      open: true,
      menu,
      nextType: menu.menu_type || "closed_conventional",
    });
  }, []);

  const closeChangeTypeDialog = useCallback(() => {
    if (changingMenuTypeId !== null) return;
    setChangeTypeDialog({ open: false, menu: null, nextType: "closed_conventional" });
  }, [changingMenuTypeId]);

  const onChangeTypeConfirm = useCallback(async () => {
    const menu = changeTypeDialog.menu;
    if (!menu) return;

    const previousType = menu.menu_type || "closed_conventional";
    const requestedType = changeTypeDialog.nextType || previousType;
    if (requestedType === previousType) {
      closeChangeTypeDialog();
      return;
    }

    setChangingMenuTypeId(menu.id);
    setMenus((prev) => prev.map((item) => (item.id === menu.id ? { ...item, menu_type: requestedType } : item)));

    try {
      const res = await api.menus.gruposV2.patchMenuType(menu.id, requestedType);
      if (!res.success) {
        throw new Error(res.message || "No se pudo cambiar el tipo de menu");
      }

      const savedType = res.menu_type || requestedType;
      setMenus((prev) => prev.map((item) => (item.id === menu.id ? { ...item, menu_type: savedType } : item)));
      pushToast({ kind: "success", title: "Tipo actualizado" });
      setChangeTypeDialog({ open: false, menu: null, nextType: "closed_conventional" });
    } catch (error) {
      setMenus((prev) => prev.map((item) => (item.id === menu.id ? { ...item, menu_type: previousType } : item)));
      pushToast({
        kind: "error",
        title: "Error",
        message: error instanceof Error ? error.message : "No se pudo cambiar el tipo de menu",
      });
    } finally {
      setChangingMenuTypeId((current) => (current === menu.id ? null : current));
    }
  }, [api, changeTypeDialog.menu, changeTypeDialog.nextType, closeChangeTypeDialog, pushToast]);

  const onChangeTypeSelection = useCallback((value: string) => {
    setChangeTypeDialog((prev) => (prev.open ? { ...prev, nextType: value } : prev));
  }, []);

  const resetFilters = useCallback(() => {
    setSearchText("");
    setStatusFilter("all");
    setMenuTypeFilter("all");
    setSortBy("created_desc");
  }, []);

  const handleSearchChange = useCallback((value: string) => {
    setSearchText(value);
  }, []);

  const handleStatusFilterChange = useCallback((value: MenuStatusFilter) => {
    setStatusFilter(value);
  }, []);

  const handleMenuTypeFilterChange = useCallback((value: string) => {
    setMenuTypeFilter(value);
  }, []);

  const handleSortByChange = useCallback((value: MenuSortOption) => {
    setSortBy(value);
  }, []);

  const menuTypeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const menu of menus) {
      const menuType = menu.menu_type || "closed_conventional";
      counts[menuType] = (counts[menuType] || 0) + 1;
    }
    return counts;
  }, [menus]);

  const menuTypeOptions = useMemo(() => {
    const out: string[] = [];
    const seen = new Set<string>();
    for (const type of MENU_TYPE_ORDER.concat(menus.map((m) => m.menu_type || "closed_conventional"))) {
      if (!type || seen.has(type)) continue;
      seen.add(type);
      out.push(type);
    }
    return out;
  }, [menus]);

  const filteredMenus = useMemo(() => {
    const searchNorm = normalizedSearchValue(searchText);
    const next = menus.filter((menu) => {
      const menuType = menu.menu_type || "closed_conventional";
      if (statusFilter === "active" && !menu.active) return false;
      if (statusFilter === "inactive" && menu.active) return false;
      if (menuTypeFilter !== "all" && menuType !== menuTypeFilter) return false;
      if (!searchNorm) return true;
      return normalizedSearchValue(menu.menu_title || "").includes(searchNorm);
    });

    next.sort((a, b) => {
      if (sortBy === "created_asc") return menuAddedAt(a) - menuAddedAt(b);
      if (sortBy === "price_asc") return menuPriceNumber(a) - menuPriceNumber(b);
      if (sortBy === "price_desc") return menuPriceNumber(b) - menuPriceNumber(a);
      return menuAddedAt(b) - menuAddedAt(a);
    });

    return next;
  }, [menuTypeFilter, menus, searchText, sortBy, statusFilter]);

  const hasFilters = useMemo(
    () => searchText.trim().length > 0 || statusFilter !== "all" || menuTypeFilter !== "all" || sortBy !== "created_desc",
    [menuTypeFilter, searchText, sortBy, statusFilter],
  );

  const summaryText = useMemo(() => `${filteredMenus.length} de ${menus.length} menus`, [filteredMenus.length, menus.length]);

  const confirmMessage = useMemo(
    () => (confirmDel.menu ? `Eliminar #${confirmDel.menu.id} (${confirmDel.menu.menu_title})?` : ""),
    [confirmDel.menu],
  );

  const handleTypePanelClick = useCallback((type: string) => {
    setShowTypeSelector(false);
    setMenuTypeFilter(type);
  }, []);

  const handleBackToPanels = useCallback(() => {
    setShowTypeSelector(true);
    resetFilters();
  }, [resetFilters]);

  return (
    <section aria-label="Menus" className={cn("bo-menuV2Page", showTypeSelector && "is-selector")}>
      {showTypeSelector ? (
        <MenuTypePanelGrid countsByType={menuTypeCounts} onSelect={handleTypePanelClick} />
      ) : (
        <>
          <button className="bo-menuBackBtn" type="button" onClick={handleBackToPanels}>
            <ChevronLeft size={16} /> Volver a tipos de menu
          </button>

          <MenuFilters
            searchText={searchText}
            statusFilter={statusFilter}
            menuTypeFilter={menuTypeFilter}
            sortBy={sortBy}
            menuTypeOptions={menuTypeOptions}
            hasFilters={hasFilters}
            summaryText={summaryText}
            disableActions={disableGlobalActions}
            onSearchChange={handleSearchChange}
            onStatusFilterChange={handleStatusFilterChange}
            onMenuTypeFilterChange={handleMenuTypeFilterChange}
            onSortByChange={handleSortByChange}
            onResetFilters={resetFilters}
          />

          <div className="bo-menuV2Grid" role="list" aria-label="Lista de menus">
            {filteredMenus.map((menu) => (
              <MenuSummaryCard
                key={menu.id}
                menu={menu}
                switchDisabled={disableGlobalActions || togglingMenuId === menu.id}
                actionsDisabled={disableGlobalActions || changingMenuTypeId === menu.id}
                onToggleActive={onToggleActive}
                onOpenEditor={openEditor}
                onRequestChangeType={requestChangeType}
                onRequestDelete={requestDelete}
              />
            ))}

            {!filteredMenus.length ? (
              <div className="bo-menuV2Empty">{menus.length ? "No hay menus que coincidan con los filtros." : "No hay menus creados todavia."}</div>
            ) : null}
          </div>
        </>
      )}

      <button className="bo-menuFab" type="button" aria-label="Crear menu" onClick={() => openEditor()}>
        <Plus size={26} />
      </button>

      <ConfirmDialog
        open={confirmDel.open}
        title="Eliminar menu"
        message={confirmMessage}
        confirmText="Eliminar"
        danger
        onClose={closeDeleteConfirm}
        onConfirm={onDelete}
      />
      <MenuTypeChangeModal
        open={changeTypeDialog.open}
        title="Cambiar tipo de menu"
        currentType={changeTypeDialog.menu?.menu_type || "closed_conventional"}
        nextType={changeTypeDialog.nextType}
        saving={changingMenuTypeId !== null}
        onClose={closeChangeTypeDialog}
        onNextTypeChange={onChangeTypeSelection}
        onConfirm={() => void onChangeTypeConfirm()}
      />
    </section>
  );
}
