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
          <span className="text-muted-foreground">({count})</span>
        </div>
        <button
          className="h-8 rounded-lg border border-white/[0.06] bg-transparent text-foreground inline-flex items-center justify-center gap-2 text-xs transition-colors hover:bg-white/[0.04]"
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
            <div className="grid grid-gap-3 mt-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
              <div className="grid gap-2">
                <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                  <Search size={14} />
                  Buscar
                </span>
                <div className="relative">
                  <input
                    className="h-10 rounded-md border border bg-white/5 text-foreground pl-8 px-3 outline-none min-w-0 transition-colors"
                    type="search"
                    value={search}
                    placeholder="Buscar por nombre..."
                    onChange={(e) => onSearchChange(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1">Tipo</span>
                <Select value={tipoFilter} onChange={onTipoChange} options={tipoOptions} ariaLabel="Tipo" />
              </div>

              <div className="grid gap-2">
                <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1">Estado</span>
                <Select
                  value={activeFilter}
                  onChange={(v) => onActiveChange(v as ActiveFilter)}
                  options={ACTIVE_OPTIONS}
                  ariaLabel="Estado"
                />
              </div>

              {supportsCategories ? (
                <div className="grid gap-2">
                  <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1">Categoria</span>
                  <Select
                    value={categoryFilter}
                    onChange={onCategoryChange}
                    options={categoryOptions}
                    ariaLabel="Categoria"
                  />
                </div>
              ) : null}

              {supportsAlergenos ? (
                <div className="grid gap-2">
                  <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1">Alergeno</span>
                  <Select
                    value={alergenoFilter}
                    onChange={onAlergenoChange}
                    options={alergenoOptions}
                    ariaLabel="Alergeno"
                  />
                </div>
              ) : null}

              {supportsSuplemento ? (
                <div className="grid gap-2">
                  <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1">Suplemento</span>
                  <Select
                    value={suplementoFilter}
                    onChange={(v) => onSuplementoChange(v as SuplementoFilter)}
                    options={SUPLEMENTO_OPTIONS}
                    ariaLabel="Suplemento"
                  />
                </div>
              ) : null}

              <div className="flex items-center">
                <button
                  className={`h-8 px-[10px] rounded-sm border border bg-transparent text-foreground inline-flex items-center justify-center gap-1.5 text-xs transition-colors hover:bg-card-hover disabled:opacity-55 disabled:cursor-not-allowed ${hasFilters ? "" : "hidden"}`}
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
