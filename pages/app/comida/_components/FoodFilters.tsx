import React, { useCallback, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Filter, FilterX } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import { Select } from "../../../../ui/inputs/Select";
import { Switch } from "../../../../ui/shadcn/Switch";
import type { FoodType } from "./foodTypes";
import type { ActiveFilter, SuplementoFilter } from "../@foodType/types";

interface FilterOption {
  value: string;
  label: string;
}

interface FoodFiltersProps {
  foodType: FoodType;
  search: string;
  onSearchChange: (value: string) => void;
  tipoFilter: string;
  onTipoChange: (value: string) => void;
  tipoOptions: FilterOption[];
  activeFilter: ActiveFilter;
  onActiveChange: (value: ActiveFilter) => void;
  categoryFilter: string;
  onCategoryChange: (value: string) => void;
  categoryOptions: FilterOption[];
  alergenoFilter: string;
  onAlergenoChange: (value: string) => void;
  alergenoOptions: FilterOption[];
  suplementoFilter: SuplementoFilter;
  onSuplementoChange: (value: SuplementoFilter) => void;
  onReset: () => void;
  count: number;
  showImages: boolean;
  onShowImagesChange: (value: boolean) => void;
}

const ACTIVE_OPTIONS: { value: ActiveFilter; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "active", label: "Activos" },
  { value: "inactive", label: "Inactivos" },
];

const SUPLEMENTO_OPTIONS: { value: SuplementoFilter; label: string }[] = [
  { value: "all", label: "Con y sin suplemento" },
  { value: "yes", label: "Con suplemento" },
  { value: "no", label: "Sin suplemento" },
];

export const FoodFilters = React.memo(function FoodFilters({
  foodType,
  search,
  onSearchChange,
  tipoFilter,
  onTipoChange,
  tipoOptions,
  activeFilter,
  onActiveChange,
  categoryFilter,
  onCategoryChange,
  categoryOptions,
  alergenoFilter,
  onAlergenoChange,
  alergenoOptions,
  suplementoFilter,
  onSuplementoChange,
  onReset,
  count,
  showImages,
  onShowImagesChange,
}: FoodFiltersProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const reduceMotion = useReducedMotion();

  const supportsCategories = foodType === "platos";
  const supportsAlergenos = foodType === "platos" || foodType === "postres";
  const supportsSuplemento = foodType === "platos";

  const hasFilters = useMemo(
    () =>
      search.trim().length > 0
      || tipoFilter !== ""
      || activeFilter !== "all"
      || categoryFilter !== ""
      || alergenoFilter !== ""
      || suplementoFilter !== "all",
    [search, tipoFilter, activeFilter, categoryFilter, alergenoFilter, suplementoFilter],
  );

  const toggleExpanded = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  return (
    <div className="bo-foodFilters" aria-label="Filtros" data-ui="food-filters-container">
      <div className="bo-foodFiltersHead" data-ui="food-filters-header">
        <div className="bo-foodFiltersTitle" data-ui="food-filters-title">
          <Filter size={15} data-ui="food-filters-icon" />
          <span data-role="food-filters-label">Filtros</span>
          <span className="bo-foodFiltersCount" data-role="food-filters-count">({count})</span>
        </div>
        <div className="bo-foodFiltersExtras" data-ui="food-filters-extras">
          <div className="bo-foodFilter bo-foodFilter--images" data-slot="food-filters-images">
            <span className="bo-label" data-role="food-filters-images-label">Mostrar imagenes</span>
            <Switch
              checked={showImages}
              onCheckedChange={onShowImagesChange}
              data-ui="food-show-images-switch"
              aria-label="mostrar imagenes"
            />
          </div>
          <button
            className="bo-btn bo-btn--ghost bo-btn--sm bo-foodFiltersToggle"
            type="button"
            onClick={toggleExpanded}
            aria-expanded={isExpanded}
            aria-label={isExpanded ? "Colapsar filtros" : "Expandir filtros"}
            data-ui="food-filters-toggle-btn"
          >
            {isExpanded ? <ChevronUp size={15} data-ui="food-filters-toggle-icon-up" /> : <ChevronDown size={15} data-ui="food-filters-toggle-icon-down" />}
          </button>
        </div>
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
            data-ui="food-filters-expandable"
          >
            <div className="bo-foodFiltersGrid bo-foodFiltersGrid--extended" data-ui="food-filters-grid">
              <div className="bo-field bo-foodFilter bo-foodFilter--search" data-slot="food-filters-search">
                <span className="bo-label" data-role="food-filters-search-label">Buscar</span>
                <div className="bo-input-wrapper" data-ui="food-filters-search-input-wrapper">
                  <input
                    className="bo-input"
                    type="search"
                    value={search}
                    placeholder="Buscar por nombre..."
                    onChange={(e) => onSearchChange(e.target.value)}
                    data-role="food-filters-search-input"
                  />
                </div>
              </div>

              <div className="bo-field bo-foodFilter bo-foodFilter--tipo" data-slot="food-filters-tipo">
                <span className="bo-label" data-role="food-filters-tipo-label">Tipo</span>
                <Select value={tipoFilter} onChange={onTipoChange} options={tipoOptions} ariaLabel="Tipo" />
              </div>

              <div className="bo-field bo-foodFilter bo-foodFilter--active" data-slot="food-filters-active">
                <span className="bo-label" data-role="food-filters-active-label">Estado</span>
                <Select
                  value={activeFilter}
                  onChange={(v) => onActiveChange(v as ActiveFilter)}
                  options={ACTIVE_OPTIONS}
                  ariaLabel="Estado"
                />
              </div>

              {supportsCategories ? (
                <div className="bo-field bo-foodFilter" data-slot="food-filters-category">
                  <span className="bo-label" data-role="food-filters-category-label">Categoria</span>
                  <Select
                    value={categoryFilter}
                    onChange={onCategoryChange}
                    options={categoryOptions}
                    ariaLabel="Categoria"
                  />
                </div>
              ) : null}

              {supportsAlergenos ? (
                <div className="bo-field bo-foodFilter" data-slot="food-filters-alergeno">
                  <span className="bo-label" data-role="food-filters-alergeno-label">Alergeno</span>
                  <Select
                    value={alergenoFilter}
                    onChange={onAlergenoChange}
                    options={alergenoOptions}
                    ariaLabel="Alergeno"
                  />
                </div>
              ) : null}

              {supportsSuplemento ? (
                <div className="bo-field bo-foodFilter" data-slot="food-filters-suplemento">
                  <span className="bo-label" data-role="food-filters-suplemento-label">Suplemento</span>
                  <Select
                    value={suplementoFilter}
                    onChange={(v) => onSuplementoChange(v as SuplementoFilter)}
                    options={SUPLEMENTO_OPTIONS}
                    ariaLabel="Suplemento"
                  />
                </div>
              ) : null}

              <div className="bo-foodFilterActions" data-ui="food-filters-actions">
                <button
                  className={`bo-btn bo-btn--ghost bo-btn--sm bo-foodClearBtn ${hasFilters ? "" : "is-hidden"}`}
                  type="button"
                  disabled={!hasFilters}
                  onClick={onReset}
                  tabIndex={hasFilters ? 0 : -1}
                  aria-hidden={!hasFilters}
                  data-ui="food-filters-clear-btn"
                >
                  <FilterX size={15} data-ui="food-filters-clear-icon" />
                  Limpiar
                </button>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
});
