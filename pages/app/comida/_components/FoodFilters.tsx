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
    <div className="bo-filters" aria-label="Filtros">
      <div className="bo-filtersHeader">
        <div className="bo-filtersTitle">
          <Filter size={15} />
          <span>Filtros</span>
          <span className="bo-filtersCount">({count})</span>
        </div>
        <button
          className="bo-btnToggle"
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
            <div className="bo-grid bo-grid-gap-3 bo-mt-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
              <div className="bo-field">
                <span className="bo-fieldLabel">
                  <Search size={14} />
                  Buscar
                </span>
                <div className="bo-inputWrapper">
                  <input
                    className="bo-input bo-input--withIcon"
                    type="search"
                    value={search}
                    placeholder="Buscar por nombre..."
                    onChange={(e) => onSearchChange(e.target.value)}
                  />
                </div>
              </div>

              <div className="bo-field">
                <span className="bo-fieldLabel">Tipo</span>
                <Select value={tipoFilter} onChange={onTipoChange} options={tipoOptions} ariaLabel="Tipo" />
              </div>

              <div className="bo-field">
                <span className="bo-fieldLabel">Estado</span>
                <Select
                  value={activeFilter}
                  onChange={(v) => onActiveChange(v as ActiveFilter)}
                  options={ACTIVE_OPTIONS}
                  ariaLabel="Estado"
                />
              </div>

              {supportsCategories ? (
                <div className="bo-field">
                  <span className="bo-fieldLabel">Categoria</span>
                  <Select
                    value={categoryFilter}
                    onChange={onCategoryChange}
                    options={categoryOptions}
                    ariaLabel="Categoria"
                  />
                </div>
              ) : null}

              {supportsAlergenos ? (
                <div className="bo-field">
                  <span className="bo-fieldLabel">Alergeno</span>
                  <Select
                    value={alergenoFilter}
                    onChange={onAlergenoChange}
                    options={alergenoOptions}
                    ariaLabel="Alergeno"
                  />
                </div>
              ) : null}

              {supportsSuplemento ? (
                <div className="bo-field">
                  <span className="bo-fieldLabel">Suplemento</span>
                  <Select
                    value={suplementoFilter}
                    onChange={(v) => onSuplementoChange(v as SuplementoFilter)}
                    options={SUPLEMENTO_OPTIONS}
                    ariaLabel="Suplemento"
                  />
                </div>
              ) : null}

              <div className="bo-actionsRow">
                <button
                  className={`bo-btnClear ${hasFilters ? "" : "bo-hidden"}`}
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
