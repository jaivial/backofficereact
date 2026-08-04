import React, { useMemo, useRef } from "react";

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
import { useBreadcrumbFadeout } from "../../_components/hooks/useBreadcrumbFadeout";
import { FoodDetailAllergenModal } from "./functionalComponents/FoodDetailAllergenModal";
import type { LucideIcon } from "lucide-react";
import { FOOD_TYPE_ICONS } from "./constants";
import { FoodDetailAIAdvisor } from "./functionalComponents/FoodDetailAIAdvisor";
import { formatEuro, normalizeToCardAllergens } from "./helpers";

function FoodDetailPage() {
  const sectionRef = useRef<HTMLElement>(null);

  // Fade-out before breadcrumb navigation
  useBreadcrumbFadeout(sectionRef);

  const {
    item,
    foodType,
    isPlate,
    isBebida,
    isWine,
    supportsQuickEditor,
    isPostre,
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
    quickTipo, setQuickTipo,
    quickPrecio, setQuickPrecio,
    quickSuplemento, setQuickSuplemento,
    quickHasSuplemento, setQuickHasSuplemento,
    quickCategoria, setQuickCategoria,
    quickDescripcion, setQuickDescripcion,
    quickActive, setQuickActive,
    quickCanSave,
    quickTipoOptions,
    quickCategorySelectOptions,
    onQuickSave,
    onWineSave,
    openAllergenModal,
    onToggleAllergenAndPersist,
    handleBebidaCatAdd,
    handleBebidaCatOptimistic,
    handleImageSelect,
    handleImageUpdate,
    handleAIAdvisorClose,
    handleAIContinueWithout,
    handleAIEnhance,
    isNew,
  } = useFoodDetailPage();

  // ⚠ All hooks MUST be called unconditionally, before any early return.
  // Vike can re-render this component mid-transition with different pageContext,
  // and React will throw "Hooks order changed" if hooks after an early return
  // were not called in the previous render.

  const title = useMemo(() => {
    if (!item && !isNew) return "Detalle no disponible";
    if (isNew) return "Nuevo elemento";
    return item!.nombre || `Elemento #${itemNum}`;
  }, [item, itemNum, isNew]);

  const breadcrumbs = useMemo<BreadcrumbItem[]>(() => {
    const foodTypeLabel = FOOD_TYPE_LABELS[foodType as FoodType] ?? "Carta";
    const items: BreadcrumbItem[] = [
      { label: "Carta", href: "/app/comida" },
      { label: foodTypeLabel, href: `/app/comida/${foodType}` },
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

  const HeroIcon = useMemo(() =>
    (FOOD_TYPE_ICONS[foodType as keyof typeof FOOD_TYPE_ICONS] || (() => null)) as LucideIcon,
    [foodType],
  );

  // Early return for wine must happen AFTER all hooks to comply with Rules of Hooks.
  // Otherwise Vike's page transitions can trigger a mismatch when the component is
  // re-rendered mid-exit with a different pageContext where isWine is false.
  if (isWine) {
    return (
      <WineDetailEditor
        vino={item as import("../../../../../api/types").Vino}
        isNew={false}
        onSave={onWineSave}
      />
    );
  }

  return (
    <section ref={sectionRef} aria-label="Detalle comida" className="bo-content-grid bo-memberDetailPage bo-foodDetailPage bo-fadeout" data-role="food-detail-page">
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
            fileInputRef={fileInputRef as React.RefObject<HTMLInputElement>}
            onImageSelect={handleImageSelect}
            onImageUpdate={handleImageUpdate}
          />

          {/* ── Title + badges head above quick editor ── */}
          {item && !isWine ? (
            <div className="bo-panelHead bo-foodDetailQuickHead flex-col items-stretch gap-1" data-ui="food-detail-editor-head">
              <div className="flex items-center gap-2 min-w-0" data-ui="food-detail-editor-title-row">
                <HeroIcon
                  className="bo-foodDetailTypeIcon shrink-0"
                  size={18}
                  aria-hidden="true"
                  data-ui="food-detail-editor-title-icon"
                />
                <span className="truncate" data-role="food-detail-editor-title">{title}</span>
              </div>
              {heroBadges.length > 0 ? (
                <div className="flex flex-wrap gap-1.5" data-slot="food-detail-editor-badge-row">
                  {heroBadges.map((badge) => (
                    <span
                      key={badge.id}
                      className={`bo-badge ${badge.className}`}
                      data-role="food-detail-editor-badge"
                    >
                      {badge.label}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          {supportsQuickEditor && (currentFoodItem || isNew) ? (
            <FoodDetailQuickEditor
              isPlate={isPlate}
              isBebida={isBebida}
              savingQuick={savingQuick}
              quickCanSave={quickCanSave}
              quickName={quickName}
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
              onQuickTipoChange={setQuickTipo}
              onQuickPrecioChange={setQuickPrecio}
              onQuickSuplementoChange={setQuickSuplemento}
              onQuickHasSuplementoChange={setQuickHasSuplemento}
              onQuickCategoriaChange={setQuickCategoria}
              onQuickDescripcionChange={setQuickDescripcion}
              onQuickActiveChange={setQuickActive}
              onQuickSave={onQuickSave}
              onAddCategoryClick={() => setBebidaCatModalOpen(true)}
              allergenList={allergenList}
              savingAllergens={savingAllergens}
              onOpenAllergenModal={openAllergenModal}
              onToggleAllergen={onToggleAllergenAndPersist}
              itemId={isNew ? null : itemNum}
              productionType={currentFoodItem?.production_type === "MANUFACTURED" ? "MANUFACTURED" : "RAW"}
              source={isPostre ? "postres" : "comida"}
              stockRecipeId={currentFoodItem?.stock_recipe_id ?? null}
            />
          ) : null}

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
