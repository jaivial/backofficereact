import React, { useCallback, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Filter, FilterX, Search } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import { Select } from "../../../../ui/inputs/Select";

type ActiveFilter = "all" | "active" | "inactive";

interface FilterOption {
  value: string;
  label: string;
}

interface FoodFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  tipoFilter: string;
  onTipoChange: (value: string) => void;
  tipoOptions: FilterOption[];
  activeFilter: ActiveFilter;
  onActiveChange: (value: ActiveFilter) => void;
  onReset: () => void;
  count: number;
}

const ACTIVE_OPTIONS: { value: ActiveFilter; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "active", label: "Activos" },
  { value: "inactive", label: "Inactivos" },
];

export const FoodFilters = React.memo(function FoodFilters({
  search,
  onSearchChange,
  tipoFilter,
  onTipoChange,
  tipoOptions,
  activeFilter,
  onActiveChange,
  onReset,
  count,
}: FoodFiltersProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const reduceMotion = useReducedMotion();

  const hasFilters = useMemo(
    () => search.trim().length > 0 || tipoFilter !== "" || activeFilter !== "all",
    [search, tipoFilter, activeFilter],
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
            <div className="bo-foodFiltersGrid">
              {/* Search */}
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

              {/* Tipo filter */}
              <div className="bo-field bo-foodFilter bo-foodFilter--tipo">
                <span className="bo-label">Tipo</span>
                <Select
                  value={tipoFilter}
                  onChange={onTipoChange}
                  options={tipoOptions}
                  ariaLabel="Tipo"
                />
              </div>

              {/* Active filter */}
              <div className="bo-field bo-foodFilter bo-foodFilter--active">
                <span className="bo-label">Estado</span>
                <Select
                  value={activeFilter}
                  onChange={(v) => onActiveChange(v as ActiveFilter)}
                  options={ACTIVE_OPTIONS}
                  ariaLabel="Estado"
                />
              </div>

              {/* Clear filters */}
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
