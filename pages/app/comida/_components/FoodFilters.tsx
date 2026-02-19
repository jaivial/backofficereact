import React, { useCallback, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Filter, FilterX, Search } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import { Select } from "../../../../ui/inputs/Select";
import type { FoodType } from "./foodTypes";

type ActiveFilter = "all" | "active" | "inactive";
type SuplementoFilter = "all" | "yes" | "no";

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
}: FoodFiltersProps) {
  const [isExpanded, setIsExpanded] = useState(true);
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
    <div className="bo-foodFilters" aria-label="Filtros">
      <div className="bo-foodFiltersHead">
        <div className="bo-foodFiltersTitle">
          <Filter size={15} />
          <span>Filtros</span>
          <span className="bo-foodFiltersCount">({count})</span>
        </div>
        <button
          className="bo-btn bo-btn--ghost bo-btn--sm bo-foodFiltersToggle"
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
            <div className="bo-foodFiltersGrid bo-foodFiltersGrid--extended">
              <div className="bo-field bo-foodFilter bo-foodFilter--search">
                <span className="bo-label">
                  <Search size={14} />
                  Buscar
                </span>
                <div className="bo-input-wrapper">
                  <input
                    className="bo-input"
                    type="search"
                    value={search}
                    placeholder="Buscar por nombre..."
                    onChange={(e) => onSearchChange(e.target.value)}
                  />
                </div>
              </div>

              <div className="bo-field bo-foodFilter bo-foodFilter--tipo">
                <span className="bo-label">Tipo</span>
                <Select value={tipoFilter} onChange={onTipoChange} options={tipoOptions} ariaLabel="Tipo" />
              </div>

              <div className="bo-field bo-foodFilter bo-foodFilter--active">
                <span className="bo-label">Estado</span>
                <Select
                  value={activeFilter}
                  onChange={(v) => onActiveChange(v as ActiveFilter)}
                  options={ACTIVE_OPTIONS}
                  ariaLabel="Estado"
                />
              </div>

              {supportsCategories ? (
                <div className="bo-field bo-foodFilter">
                  <span className="bo-label">Categoria</span>
                  <Select
                    value={categoryFilter}
                    onChange={onCategoryChange}
                    options={categoryOptions}
                    ariaLabel="Categoria"
                  />
                </div>
              ) : null}

              {supportsAlergenos ? (
                <div className="bo-field bo-foodFilter">
                  <span className="bo-label">Alergeno</span>
                  <Select
                    value={alergenoFilter}
                    onChange={onAlergenoChange}
                    options={alergenoOptions}
                    ariaLabel="Alergeno"
                  />
                </div>
              ) : null}

              {supportsSuplemento ? (
                <div className="bo-field bo-foodFilter">
                  <span className="bo-label">Suplemento</span>
                  <Select
                    value={suplementoFilter}
                    onChange={(v) => onSuplementoChange(v as SuplementoFilter)}
                    options={SUPLEMENTO_OPTIONS}
                    ariaLabel="Suplemento"
                  />
                </div>
              ) : null}

              <div className="bo-foodFilterActions">
                <button
                  className={`bo-btn bo-btn--ghost bo-btn--sm bo-foodClearBtn ${hasFilters ? "" : "is-hidden"}`}
                  type="button"
                  disabled={!hasFilters}
                  onClick={onReset}
                  tabIndex={hasFilters ? 0 : -1}
                  aria-hidden={!hasFilters}
                >
                  <FilterX size={15} />
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
