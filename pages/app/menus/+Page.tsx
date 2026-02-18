import React, { useCallback, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Filter, FilterX, PencilLine, Plus, Trash2, BookOpen, Lock, Users, UtensilsCrossed, UsersRound, Star } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { usePageContext } from "vike-react/usePageContext";

import { createClient } from "../../../api/client";
import type { GroupMenuV2Summary } from "../../../api/types";
import { useErrorToast } from "../../../ui/feedback/useErrorToast";
import { useToasts } from "../../../ui/feedback/useToasts";
import { Select } from "../../../ui/inputs/Select";
import { ConfirmDialog } from "../../../ui/overlays/ConfirmDialog";
import { Switch } from "../../../ui/shadcn/Switch";

type PageData = {
  menus: GroupMenuV2Summary[];
  error: string | null;
};

type MenuStatusFilter = "all" | "active" | "inactive";
type MenuSortOption = "created_desc" | "created_asc" | "price_asc" | "price_desc";

const ORDERED_MENU_TYPES: string[] = ["closed_conventional", "closed_group", "a_la_carte", "a_la_carte_group", "special"];

const MENU_TYPE_PANELS = [
  { value: "closed_conventional", label: "Menu cerrado convencional", icon: Lock, description: "Menu fijo con precio cerrado" },
  { value: "closed_group", label: "Menu cerrado grupo", icon: Users, description: "Menu fijo para grupos" },
  { value: "a_la_carte", label: "A la carta convencional", icon: UtensilsCrossed, description: "Carta con platos a elegir" },
  { value: "a_la_carte_group", label: "A la carta grupo", icon: UsersRound, description: "Carta para grupos" },
  { value: "special", label: "Menu especial", icon: Star, description: "Menu especial con imagen" },
] as const;
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

function formatPrice(price: string): string {
  const n = Number(price);
  if (!Number.isFinite(n)) return price;
  return `${n.toFixed(2)} €`;
}

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

function menuTypeLabel(kind: string): string {
  if (kind === "closed_group") return "Cerrado grupo";
  if (kind === "a_la_carte") return "A la carta";
  if (kind === "a_la_carte_group") return "A la carta grupo";
  if (kind === "special") return "Especial";
  return "Cerrado convencional";
}

type MenuCardProps = {
  menu: GroupMenuV2Summary;
  switchDisabled: boolean;
  actionsDisabled: boolean;
  onToggleActive: (menuId: number) => Promise<void>;
  onOpenEditor: (menuId: number) => void;
  onRequestDelete: (menu: GroupMenuV2Summary) => void;
};

const MenuCard = React.memo(function MenuCard({
  menu,
  switchDisabled,
  actionsDisabled,
  onToggleActive,
  onOpenEditor,
  onRequestDelete,
}: MenuCardProps) {
  const title = menu.menu_title || "Sin titulo";
  const typeLabel = useMemo(() => menuTypeLabel(menu.menu_type || "closed_conventional"), [menu.menu_type]);
  const priceLabel = useMemo(() => formatPrice(menu.price), [menu.price]);
  const statusLabel = menu.active ? "Activo" : "Inactivo";

  const handleToggle = useCallback(() => {
    void onToggleActive(menu.id);
  }, [menu.id, onToggleActive]);

  const handleEdit = useCallback(() => {
    onOpenEditor(menu.id);
  }, [menu.id, onOpenEditor]);

  const handleDelete = useCallback(() => {
    onRequestDelete(menu);
  }, [menu, onRequestDelete]);

  return (
    <article className="bo-menuV2Card" role="listitem">
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
          <span className={`bo-menuTag bo-menuTag--state ${menu.active ? "is-on" : ""}`}>{statusLabel}</span>
          <Switch
            checked={!!menu.active}
            disabled={switchDisabled}
            onCheckedChange={handleToggle}
            aria-label={`Estado menu ${title}`}
          />
        </div>

        <div className="bo-menuV2Actions">
          <button
            className="bo-btn bo-btn--ghost bo-btn--sm bo-menuV2IconBtn"
            type="button"
            disabled={actionsDisabled}
            onClick={handleEdit}
            aria-label={`Editar menu ${title}`}
            title="Editar"
          >
            <PencilLine size={14} />
          </button>
          <button
            className="bo-btn bo-btn--ghost bo-btn--danger bo-btn--sm bo-menuV2IconBtn"
            type="button"
            disabled={actionsDisabled}
            onClick={handleDelete}
            aria-label={`Eliminar menu ${title}`}
            title="Eliminar"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </article>
  );
});

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
                <input className="bo-input" type="search" value={searchText} placeholder="Ejemplo: San Valentin" onChange={(e) => onSearchChange(e.target.value)} />
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
                  className={`bo-btn bo-btn--ghost bo-btn--sm bo-menuV2ClearBtn ${hasFilters ? "" : "is-hidden"}`.trim()}
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
  const data = pageContext.data as PageData;
  const api = useMemo(() => createClient({ baseUrl: "" }), []);
  const { pushToast } = useToasts();

  const [togglingMenuId, setTogglingMenuId] = useState<number | null>(null);
  const [deletingMenuId, setDeletingMenuId] = useState<number | null>(null);

  const error = data.error;
  const [menus, setMenus] = useState<GroupMenuV2Summary[]>(data.menus || []);
  const [confirmDel, setConfirmDel] = useState<{ open: boolean; menu: GroupMenuV2Summary | null }>({ open: false, menu: null });
  const [searchText, setSearchText] = useState("");
  const [showTypeSelector, setShowTypeSelector] = useState(true);
  const [statusFilter, setStatusFilter] = useState<MenuStatusFilter>("all");
  const [menuTypeFilter, setMenuTypeFilter] = useState("all");
  const [sortBy, setSortBy] = useState<MenuSortOption>("created_desc");
  useErrorToast(error);

  const disableGlobalActions = deletingMenuId !== null;

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

  const menuTypeOptions = useMemo(() => {
    const out: string[] = [];
    const seen = new Set<string>();
    for (const type of ORDERED_MENU_TYPES.concat(menus.map((m) => m.menu_type || "closed_conventional"))) {
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
    <section aria-label="Menus" className="bo-menuV2Page">
      {showTypeSelector && menus.length > 0 ? (
        <div className="bo-menuTypePanels">
          <div className="bo-menuTypePanelsGrid">
            {MENU_TYPE_PANELS.map((panel) => {
              const Icon = panel.icon;
              const count = menus.filter((m) => (m.menu_type || "closed_conventional") === panel.value).length;
              return (
                <button
                  key={panel.value}
                  className="bo-menuTypePanel"
                  type="button"
                  onClick={() => handleTypePanelClick(panel.value)}
                >
                  <div className="bo-menuTypePanelIcon">
                    <Icon size={28} />
                  </div>
                  <div className="bo-menuTypePanelLabel">{panel.label}</div>
                  <div className="bo-menuTypePanelDesc">{panel.description}</div>
                  {count > 0 && <div className="bo-menuTypePanelCount">{count} menu{count !== 1 ? "s" : ""}</div>}
                </button>
              );
            })}
          </div>
        </div>
      ) : (
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
      )}

      {!showTypeSelector && (
        <button className="bo-btn bo-btn--ghost bo-menuBackBtn" type="button" onClick={handleBackToPanels}>
          <ChevronUp size={16} /> Volver a tipos de menu
        </button>
      )}

      <div className="bo-menuV2Grid" role="list" aria-label="Lista de menus">
        {filteredMenus.map((menu) => (
          <MenuCard
            key={menu.id}
            menu={menu}
            switchDisabled={disableGlobalActions || togglingMenuId === menu.id}
            actionsDisabled={disableGlobalActions}
            onToggleActive={onToggleActive}
            onOpenEditor={openEditor}
            onRequestDelete={requestDelete}
          />
        ))}

        {!filteredMenus.length ? (
          <div className="bo-menuV2Empty">{menus.length ? "No hay menus que coincidan con los filtros." : "No hay menus creados todavia."}</div>
        ) : null}
      </div>

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
    </section>
  );
}
