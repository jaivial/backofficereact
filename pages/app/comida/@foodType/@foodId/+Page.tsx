import React, { useMemo } from "react";

import { Breadcrumbs } from "../../../../../ui/nav/Breadcrumbs";
import type { BreadcrumbItem } from "../../../../../ui/nav/Breadcrumbs";
import { Panel } from "../../../../../ui/shell/Panel";
import { FOOD_TYPE_LABELS } from "../../_components/foodTypes";
import type { FoodType } from "../../_components/foodTypes";
import { WineDetailEditor } from "./functionalComponents/WineDetailEditor/WineDetailEditor";
import { BeverageCategoryModal } from "../../_components/BeverageCategoryModal";
import type { Data } from "./+data";
import type { HeroBadge } from "./types";
import { useFoodDetailPage } from "./hooks/useFoodDetailPage";
import { FoodDetailHero } from "./functionalComponents/FoodDetailHero";
import { FoodDetailQuickEditor } from "./functionalComponents/FoodDetailQuickEditor";
import { FoodDetailAllergens } from "./functionalComponents/FoodDetailAllergens";
import { FoodDetailAllergenModal } from "./functionalComponents/FoodDetailAllergenModal";
import { FoodDetailAIAdvisor } from "./functionalComponents/FoodDetailAIAdvisor";
import { formatEuro, normalizeToCardAllergens } from "./helpers";

function FoodDetailPage() {
  const {
    item,
    foodType,
    isPlate,
    isBebida,
    isWine,
    supportsQuickEditor,
    itemNum,
    currentFoodItem,
    categoriesLoading,
    savingQuick,
    savingAllergens,
    allergenModalOpen,
    setAllergenModalOpen,
    allergenDraft,
    bebidaCatModalOpen,
    setBebidaCatModalOpen,
    imagePreview,
    uploading,
    showAIAdvisor,
    aiBusy,
    aiGenerating,
    quickAllergens,
    fileInputRef,
    quickName, setQuickName,
    quickTitulo, setQuickTitulo,
    quickTipo, setQuickTipo,
    quickPrecio, setQuickPrecio,
    quickSuplemento, setQuickSuplemento,
    quickHasSuplemento, setQuickHasSuplemento,
    quickCategoria, setQuickCategoria,
    quickDescripcion, setQuickDescripcion,
    quickActive, setQuickActive,
    quickDirty,
    quickCanSave,
    quickTipoOptions,
    quickCategorySelectOptions,
    onWineSave,
    openAllergenModal,
    onToggleAllergenAndPersist,
    handleBebidaCatAdd,
    handleBebidaCatOptimistic,
    handleImageSelect,
    handleAIAdvisorClose,
    handleAIContinueWithout,
    handleAIEnhance,
    isNew,
  } = useFoodDetailPage();

  if (isWine) {
    return (
      <WineDetailEditor
        vino={item as import("../../../../../api/types").Vino}
        isNew={false}
        onSave={onWineSave}
      />
    );
  }

  const title = useMemo(() => {
    if (!item && !isNew) return "Detalle no disponible";
    if (isNew) return "Nuevo elemento";
    return item!.nombre || `Elemento #${itemNum}`;
  }, [item, itemNum, isNew]);

  const breadcrumbs = useMemo<BreadcrumbItem[]>(() => {
    const items: BreadcrumbItem[] = [
      { label: "Carta", href: "/app/comida" },
      { label: FOOD_TYPE_LABELS[foodType as FoodType], href: `/app/comida/${foodType}` },
    ];
    if (item) {
      items.push({ label: item.nombre || `#${itemNum}` });
    }
    return items;
  }, [foodType, item, itemNum]);

  const heroBadges = useMemo<HeroBadge[]>(() => {
    if (!item) return [];
    const badges: HeroBadge[] = [
      {
        id: "state",
        label: item.active ? "Activo" : "Inactivo",
        className: item.active ? "bo-badge--active" : "bo-badge--inactive",
      },
    ];

    if (item.tipo) badges.push({ id: "tipo", label: item.tipo, className: "bo-badge--lila" });

    const food = item as any;
    if (food.categoria) badges.push({ id: "categoria", label: food.categoria, className: "bo-badge--cyan" });
    if (isPlate && Number(food.suplemento || 0) > 0) {
      badges.push({ id: "extra", label: `+${formatEuro(food.suplemento || 0)}`, className: "bo-badge--yellow" });
    }

    return badges;
  }, [foodType, isPlate, item]);

  const allergenList = useMemo<string[]>(() => {
    if (!item) return [];
    if (isPlate) return quickAllergens.filter((a) => a.trim().length > 0);
    const alergenos = Array.isArray((item as any).alergenos) ? (item as any).alergenos : [];
    return normalizeToCardAllergens(alergenos).filter((a) => a.trim().length > 0);
  }, [isPlate, item, quickAllergens]);

  const imageUrl = useMemo(() => {
    if (!item) return "";
    return String((item as any).foto_url || "").trim();
  }, [item]);

  return (
    <section aria-label="Detalle comida" className="bo-content-grid bo-memberDetailPage bo-foodDetailPage" data-role="food-detail-page">
      <div className="bo-foodDetailTopbar" data-ui="food-detail-topbar">
        <Breadcrumbs items={breadcrumbs} />
        {item ? (
          <span className={`bo-badge bo-badge--sm ${item.active ? "bo-badge--active" : "bo-badge--inactive"}`} data-role="food-detail-status-badge">
            {item.active ? "Visible" : "Oculto"}
          </span>
        ) : null}
      </div>

      {!item && !isNew ? (
        <Panel
          className="bo-foodDetailPanel"
          title="Elemento no disponible"
          meta="No se pudo cargar el detalle solicitado."
          data-ui="food-detail-empty-panel"
        />
      ) : (
        <>
          <FoodDetailHero
            item={item}
            foodType={foodType}
            title={title}
            aiGenerating={aiGenerating}
            imageUrl={imagePreview || imageUrl}
            uploading={uploading}
            aiBusy={aiBusy}
            supportsQuickEditor={supportsQuickEditor || isNew}
            heroBadges={isNew ? [] : heroBadges}
            fileInputRef={fileInputRef as React.RefObject<HTMLInputElement>}
            onImageSelect={handleImageSelect}
          />

          {supportsQuickEditor && (currentFoodItem || isNew) ? (
            <FoodDetailQuickEditor
              isPlate={isPlate}
              isBebida={isBebida}
              savingQuick={savingQuick}
              quickDirty={quickDirty}
              quickCanSave={quickCanSave}
              quickName={quickName}
              quickTitulo={quickTitulo}
              quickTipo={quickTipo}
              quickPrecio={quickPrecio}
              quickSuplemento={quickSuplemento}
              quickHasSuplemento={quickHasSuplemento}
              quickCategoria={quickCategoria}
              quickDescripcion={quickDescripcion}
              quickActive={quickActive}
              categoriesLoading={categoriesLoading}
              quickTipoOptions={quickTipoOptions}
              quickCategorySelectOptions={quickCategorySelectOptions}
              onQuickNameChange={setQuickName}
              onQuickTituloChange={setQuickTitulo}
              onQuickTipoChange={setQuickTipo}
              onQuickPrecioChange={setQuickPrecio}
              onQuickSuplementoChange={setQuickSuplemento}
              onQuickHasSuplementoChange={setQuickHasSuplemento}
              onQuickCategoriaChange={setQuickCategoria}
              onQuickDescripcionChange={setQuickDescripcion}
              onQuickActiveChange={setQuickActive}
              onQuickSave={handleAIEnhance}
              onAddCategoryClick={() => setBebidaCatModalOpen(true)}
            />
          ) : null}

          <FoodDetailAllergens
            allergenList={allergenList}
            supportsQuickEditor={supportsQuickEditor}
            savingAllergens={savingAllergens}
            onOpenAllergenModal={openAllergenModal}
            onToggleAllergen={onToggleAllergenAndPersist}
          />

          {supportsQuickEditor ? (
            <FoodDetailAllergenModal
              open={allergenModalOpen}
              allergenDraft={allergenDraft}
              savingAllergens={savingAllergens}
              onToggleAllergen={onToggleAllergenAndPersist}
              onClose={() => setAllergenModalOpen(false)}
            />
          ) : null}

          {isBebida ? (
            <BeverageCategoryModal
              open={bebidaCatModalOpen}
              defaultCategoryNames={["Refrescos", "Aguas", "Zumos", "Cervezas", "Copas", "Licores", "Cocktails"]}
              onClose={() => setBebidaCatModalOpen(false)}
              onAddCategory={handleBebidaCatAdd}
              onOptimisticAdd={handleBebidaCatOptimistic}
            />
          ) : null}

          <FoodDetailAIAdvisor
            show={showAIAdvisor && !!imagePreview}
            imagePreview={imagePreview}
            aiBusy={aiBusy}
            onClose={handleAIAdvisorClose}
            onContinueWithout={handleAIContinueWithout}
            onEnhance={handleAIEnhance}
          />
        </>
      )}
    </section>
  );
}

export default FoodDetailPage;
