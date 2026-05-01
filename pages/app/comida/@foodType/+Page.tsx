import React, { useMemo } from "react";
import { usePageContext } from "vike-react/usePageContext";

import { useErrorToast } from "../../../../ui/feedback/useErrorToast";
import { Switch } from "../../../../ui/shadcn/Switch";
import { Breadcrumbs } from "../../../../ui/nav/Breadcrumbs";
import type { BreadcrumbItem } from "../../../../ui/nav/Breadcrumbs";
import { FoodFilters } from "../_components/FoodFilters";
import { FoodItemModal } from "../_components/FoodItemModal";
import { FoodCategoryModal } from "../_components/FoodCategoryModal";
import { ConfirmDialog } from "../../../../ui/overlays/ConfirmDialog";
import { FOOD_TYPE_LABELS, FOOD_TYPE_SINGULAR } from "../_components/foodTypes";
import type { FoodType } from "../_components/foodTypes";
import type { Data } from "./+data";
import { useFoodTypePage } from "./hooks/useFoodTypePage";
import { useFilterOptions } from "./hooks/useFilterOptions";
import { FoodList } from "./functionalComponents/FoodList";

function FoodTypePage() {
  const pageContext = usePageContext();
  const data = pageContext.data as Data;
  useErrorToast(data.error);

  const {
    items,
    categories,
    page,
    setPage,
    pageSize,
    setPageSize,
    total,
    search,
    setSearch,
    tipoFilter,
    setTipoFilter,
    activeFilter,
    setActiveFilter,
    categoryFilter,
    setCategoryFilter,
    alergenoFilter,
    setAlergenoFilter,
    suplementoFilter,
    setSuplementoFilter,
    loading,
    processing,
    modalOpen,
    setModalOpen,
    editingItem,
    categoryModalOpen,
    setCategoryModalOpen,
    categoryBusy,
    deleteConfirm,
    setDeleteConfirm,
    pageActive,
    pageVisibilityLoading,
    showPageVisibilityToggle,
    foodType,
    totalPages,
    showPagerBtns,
    togglePageActive,
    onResetFilters,
    onOpenCreate,
    onOpenEdit,
    onOpenDetail,
    onSaveItem,
    onCreateCategory,
    onDeleteConfirm,
    onToggle,
  } = useFoodTypePage({ data });

  const { tipoOptions, categoryOptions, alergenoOptions } = useFilterOptions({
    foodType,
    items,
    categories,
  });

  const listLabel = FOOD_TYPE_LABELS[foodType];
  const singularLabel = FOOD_TYPE_SINGULAR[foodType];

  const breadcrumbs = useMemo<BreadcrumbItem[]>(() => [
    { label: "Carta", href: "/app/comida" },
    { label: listLabel },
  ], [listLabel]);

  const categorySelectOptions = (foodType === "platos" || foodType === "bebidas")
    ? categoryOptions.slice(1)
    : [];
  const showCategoryCreate = foodType === "platos" || foodType === "bebidas";
  const showItemModal = foodType !== "vinos";

  return (
    <section aria-label={`Carta ${listLabel}`} className="bo-foodPage" data-role="food-type-page">
      <div className="bo-container" data-slot="@foodType-container">
        <Breadcrumbs items={breadcrumbs} />

        <div className="bo-foodPage-hero" data-ui="food-type-hero">
          <div className="bo-foodPage-heroTop" data-ui="food-type-hero-top">
            <div className="bo-foodPage-heroTitles" data-ui="food-type-hero-titles">
              <h1 className="bo-pageTitle" data-role="food-type-title">{listLabel}</h1>
              <p className="bo-pageSubtitle" data-role="food-type-subtitle">
                Gestiona {listLabel.toLowerCase()} con filtros, paginacion y alta rapida.
              </p>
            </div>
            {showPageVisibilityToggle && (
              <div className="bo-foodPageVisibility" data-ui="food-page-visibility">
                <div className="bo-foodPageVisibilityRow" data-ui="food-page-visibility-row">
                  <span className="bo-foodPageVisibilityTitle" data-slot="@foodType-foodPageVisibilityTitle">
                    Pagina publica activa
                  </span>
                  <Switch
                    checked={pageActive}
                    onCheckedChange={togglePageActive}
                    disabled={pageVisibilityLoading}
                    data-ui="food-page-visibility-switch"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        <FoodFilters
          foodType={foodType}
          search={search}
          onSearchChange={(value) => {
            setSearch(value);
            setPage(1);
          }}
          tipoFilter={tipoFilter}
          onTipoChange={(value) => {
            setTipoFilter(value);
            setPage(1);
          }}
          tipoOptions={tipoOptions}
          activeFilter={activeFilter}
          onActiveChange={(value) => {
            setActiveFilter(value);
            setPage(1);
          }}
          categoryFilter={categoryFilter}
          onCategoryChange={(value) => {
            setCategoryFilter(value);
            setPage(1);
          }}
          categoryOptions={categoryOptions}
          alergenoFilter={alergenoFilter}
          onAlergenoChange={(value) => {
            setAlergenoFilter(value);
            setPage(1);
          }}
          alergenoOptions={alergenoOptions}
          suplementoFilter={suplementoFilter}
          onSuplementoChange={(value) => {
            setSuplementoFilter(value);
            setPage(1);
          }}
          onReset={onResetFilters}
          count={total}
        />

        <FoodList
          items={items}
          loading={loading}
          processing={processing}
          foodType={foodType}
          page={page}
          pageSize={pageSize}
          total={total}
          totalPages={totalPages}
          showPagerBtns={showPagerBtns}
          singularLabel={singularLabel}
          listLabel={listLabel}
          onOpenDetail={onOpenDetail}
          onOpenEdit={onOpenEdit}
          onDelete={(item) => setDeleteConfirm({ open: true, item })}
          onToggle={onToggle}
          onOpenCreate={onOpenCreate}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
      </div>

      {showItemModal ? (
        <FoodItemModal
          open={modalOpen}
          item={editingItem as import("../../../../api/types").FoodItem | null}
          foodType={foodType}
          categoryOptions={categorySelectOptions}
          onRequestCreateCategory={showCategoryCreate ? () => setCategoryModalOpen(true) : undefined}
          onClose={() => {
            if (!processing) setModalOpen(false);
          }}
          onSave={onSaveItem}
        />
      ) : null}

      <FoodCategoryModal
        open={foodType === "platos" && categoryModalOpen}
        busy={categoryBusy}
        onClose={() => {
          if (!categoryBusy) setCategoryModalOpen(false);
        }}
        onCreate={onCreateCategory}
      />

      <ConfirmDialog
        open={deleteConfirm.open}
        title="Eliminar elemento"
        message={deleteConfirm.item ? `Eliminar "${deleteConfirm.item.nombre}"? Esta accion no se puede deshacer.` : ""}
        confirmText="Eliminar"
        danger
        onClose={() => {
          if (!processing) setDeleteConfirm({ open: false, item: null });
        }}
        onConfirm={() => {
          void onDeleteConfirm();
        }}
      />
    </section>
  );
}

export default FoodTypePage;
