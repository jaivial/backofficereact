import React, { useMemo } from "react";
import { Plus } from "lucide-react";

import type { FoodCategory } from "../../../../../../api/types";
import { LoadingSpinner } from "../../../../../../ui/feedback/LoadingSpinner";
import { Select } from "../../../../../../ui/inputs/Select";
import { FloatingActionButton } from "../../../../../../ui/actions/FloatingActionButton";
import { Accordion } from "../../../../../../ui/overlays/Accordion";
import { FoodItemCard } from "../../../_components/FoodItemCard";
import type { ListItem } from "../../types";
import type { FoodType } from "../../../_components/foodTypes";
import { groupItemsByCategory } from "../../helpers";
import { PAGE_SIZE_OPTIONS } from "../../constants";

interface FoodListProps {
  items: ListItem[];
  loading: boolean;
  processing: boolean;
  foodType: FoodType;
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  showPagerBtns: boolean;
  singularLabel: string;
  onOpenDetail: (item: ListItem) => void;
  onOpenEdit: (item: ListItem) => void;
  onDelete: (item: ListItem) => void;
  onToggle: (item: ListItem) => void;
  onOpenCreate: () => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  listLabel: string;
  showMedia?: boolean;
  /** Food-type catalogue, used to build one accordion section per beverage category. */
  categories?: FoodCategory[];
}

export function FoodList({
  items,
  loading,
  processing,
  foodType,
  page,
  pageSize,
  total,
  totalPages,
  showPagerBtns,
  singularLabel,
  onOpenDetail,
  onOpenEdit,
  onDelete,
  onToggle,
  onOpenCreate,
  onPageChange,
  onPageSizeChange,
  listLabel,
  showMedia = true,
  categories = [],
}: FoodListProps) {
  const safeItems = Array.isArray(items) ? items : [];
  // Bebidas groups its rows into one accordion section per category, using the
  // same panel shell as the dish sections of the menu editor.
  // Coordination id: bebidas_category_sections_v1
  const isCategorized = foodType === "bebidas";
  const categorySections = useMemo(
    () => (isCategorized ? groupItemsByCategory(safeItems, categories) : []),
    [isCategorized, safeItems, categories],
  );
  const renderCard = (item: ListItem) => (
    <FoodItemCard
      key={item.num}
      item={item}
      foodType={foodType}
      busy={processing}
      onOpen={() => onOpenDetail(item)}
      onEdit={() => onOpenEdit(item)}
      onDelete={() => onDelete(item)}
      onToggle={() => {
        void onToggle(item);
      }}
      showMedia={showMedia}
    />
  );
  const createButton = (
    <FloatingActionButton
      icon={<Plus size={24} data-role="food-list-create-icon" />}
      aria-label={`Anadir ${singularLabel}`}
      onClick={onOpenCreate}
      data-role="food-list-create-btn"
    />
  );

  if (loading) {
    return (
      <>
        <div className="bo-foodLoading" data-ui="food-list-loading">
          <LoadingSpinner centered size="sm" label="Cargando..." />
        </div>
        {createButton}
      </>
    );
  }

  if (safeItems.length === 0) {
    return (
      <>
        <div className="bo-foodEmpty" data-ui="food-list-empty">
          <p data-role="food-list-empty-text">No hay {listLabel.toLowerCase()} con estos filtros.</p>
          <p data-role="food-list-empty-hint">Usa el boton + para anadir el primer {singularLabel}.</p>
        </div>
        {createButton}
      </>
    );
  }

  return (
    <>
      {isCategorized ? (
        <div className="bo-beverageCategorySections" data-ui="beverage-category-sections" data-role="beverage-category-sections">
          {categorySections.map((section) => (
            <Accordion
              key={section.key}
              variant="panel"
              className="bo-beverageCategorySection"
              title={section.name}
              defaultOpen
              testId={`food-beverage-category-${section.key}`}
              bodyClassName="bo-beverageCategoryBody"
              actions={
                <span
                  className="bo-accordionBadge"
                  data-slot="food-beverage-category-count"
                  data-testid={`food-beverage-category-count-${section.key}`}
                >
                  {section.items.length}
                </span>
              }
            >
              <div className="bo-foodGrid" role="list" data-ui="food-list-category-grid" data-role="food-list-category-grid">
                {section.items.map((item) => renderCard(item))}
              </div>
            </Accordion>
          ))}
        </div>
      ) : (
        <div className="bo-foodGrid pb-4" role="list" data-ui="food-list-grid" data-role="food-list-grid">
          {safeItems.map((item) => renderCard(item))}
        </div>
      )}

      <div className={`bo-pager${showPagerBtns ? "" : " is-solo"}`} aria-label="Paginacion" data-ui="food-list-pager">
        <div className="bo-pagerText" data-role="food-list-pager-info">
          Pagina {page} de {totalPages} · {total} resultados
        </div>
        <div className="bo-foodPagerExtras" data-ui="food-list-pager-extras">
          <Select
            value={String(pageSize)}
            onChange={(value: string) => {
              const next = Number(value);
              onPageSizeChange(Number.isFinite(next) ? next : 24);
              onPageChange(1);
            }}
            options={PAGE_SIZE_OPTIONS}
            ariaLabel="Elementos por pagina"
            size="sm"
          />
          {showPagerBtns ? (
            <div className="bo-pagerBtns" data-ui="food-list-pager-buttons">
              <button
                className="bo-btn bo-btn--ghost"
                type="button"
                onClick={() => onPageChange(Math.max(1, page - 1))}
                disabled={page <= 1 || loading}
                data-role="food-list-pager-prev"
              >
                Anterior
              </button>
              <button
                className="bo-btn bo-btn--ghost"
                type="button"
                onClick={() => onPageChange(Math.min(totalPages, page + 1))}
                disabled={page >= totalPages || loading}
                data-role="food-list-pager-next"
              >
                Siguiente
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {createButton}
    </>
  );
}
