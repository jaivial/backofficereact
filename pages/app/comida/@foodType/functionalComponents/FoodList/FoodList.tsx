import React from "react";
import { Plus } from "lucide-react";

import { LoadingSpinner } from "../../../../../../ui/feedback/LoadingSpinner";
import { Select } from "../../../../../../ui/inputs/Select";
import { FloatingActionButton } from "../../../../../../ui/actions/FloatingActionButton";
import { FoodItemCard } from "../../../_components/FoodItemCard";
import type { ListItem } from "../../types";
import type { FoodType } from "../../../_components/foodTypes";
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
}: FoodListProps) {
  if (loading) {
    return (
      <div className="bo-foodLoading" data-ui="food-list-loading">
        <LoadingSpinner centered size="sm" label="Cargando..." />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="bo-foodEmpty" data-ui="food-list-empty">
        <p data-role="food-list-empty-text">No hay {listLabel.toLowerCase()} con estos filtros.</p>
        <p data-role="food-list-empty-hint">Usa el boton + para anadir el primer {singularLabel}.</p>
      </div>
    );
  }

  return (
    <>
      <div className="bo-foodGrid pb-4" role="list" data-ui="food-list-grid">
        {items.map((item) => (
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
        ))}
      </div>

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

      <FloatingActionButton
        icon={<Plus size={24} data-role="food-list-create-icon" />}
        aria-label={`Anadir ${singularLabel}`}
        onClick={onOpenCreate}
        data-role="food-list-create-btn"
      />
    </>
  );
}
