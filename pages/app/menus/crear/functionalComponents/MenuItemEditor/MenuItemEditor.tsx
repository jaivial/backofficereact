import React, { useCallback, useLayoutEffect, useRef } from "react";
import { GripVertical, Trash2, Wheat } from "lucide-react";
import { useDragControls } from "motion/react";
import { Reorder } from "motion/react";
import type { EditorDish } from "../../types/menuEditor.types";
import { formatEuro, toNumOrNull } from "../../helpers/menuEditor.helpers";
import { FoodDishCard } from "../../../../../../ui/widgets/food/FoodDishCard";
import { Switch } from "../../../../../../ui/shadcn/Switch";
import { ALLERGENS } from "../../constants/menuEditor.constants";

export type MenuItemEditorProps = {
  sectionClientId: string;
  dish: EditorDish;
  dishIdx: number;
  isALaCarte: boolean;
  showDishImages: boolean;
  mediaLoading: boolean;
  startDishDrag: (event: React.PointerEvent<Element>) => void;
  pickDishImage: (sectionClientId: string, dishClientId: string) => void;
  setAllergenModal: React.Dispatch<React.SetStateAction<{ open: boolean; sectionClientId: string; dishClientId: string } | null>>;
  requestDishDelete: (sectionClientId: string, dishClientId: string, dishLabel: string) => void;
  updateDish: (sectionClientId: string, dishClientId: string, patch: Partial<EditorDish>) => void;
  toggleSameDayBooking: (sectionClientId: string, dishClientId: string, blocked: boolean) => void;
  reorderTransition?: any;
  reorderWhileDrag?: any;
};

function ReorderItemContainer({ as = "div", value, className, transition, whileDrag, children }: {
  as?: "div" | "article";
  value: string;
  className: string;
  transition?: any;
  whileDrag?: any;
  children: (startDrag: (event: React.PointerEvent<Element>) => void) => React.ReactNode;
}) {
  const dragControls = useDragControls();
  const startDrag = useCallback(
    (event: React.PointerEvent<Element>) => { dragControls.start(event); },
    [dragControls],
  );
  return (
    <Reorder.Item
      as={as}
      value={value}
      className={className}
      layout="position"
      dragListener={false}
      dragControls={dragControls}
      dragMomentum={false}
      dragElastic={0.04}
      transition={transition}
      whileDrag={whileDrag}
    >
      {children(startDrag)}
    </Reorder.Item>
  );
}

export function MenuItemEditor({
  sectionClientId, dish, dishIdx, isALaCarte, showDishImages, mediaLoading,
  startDishDrag, pickDishImage, setAllergenModal, requestDishDelete, updateDish, toggleSameDayBooking,
  reorderTransition, reorderWhileDrag,
}: MenuItemEditorProps) {
  const dishLabel = dish.title || `Plato ${dishIdx + 1}`;
  const titleTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  const syncTitleTextareaHeight = useCallback(() => {
    const node = titleTextareaRef.current;
    if (!node) return;
    node.style.height = "auto";
    node.style.height = `${node.scrollHeight}px`;
  }, []);

  useLayoutEffect(() => {
    syncTitleTextareaHeight();
    const rafId = window.requestAnimationFrame(syncTitleTextareaHeight);
    return () => window.cancelAnimationFrame(rafId);
  }, [dish.title, syncTitleTextareaHeight]);

  return (
    <ReorderItemContainer
      value={dish.clientId}
      className="bo-dishReorderItem bo-reorderItem"
      transition={reorderTransition}
      whileDrag={reorderWhileDrag}
    >
      {(startDishDragLocal) => (
        <FoodDishCard
          className="bo-dishCard bo-dishCard--horizontal"
          bodyClassName="bo-dishCardBody"
          debugId={`section:${sectionClientId}:dish:${dish.clientId}`}
          title={dishLabel}
          imageUrl={dish.foto_url}
          showMedia={showDishImages}
          mediaLoading={mediaLoading}
          showTitleRow={false}
          onMediaAction={() => pickDishImage(sectionClientId, dish.clientId)}
          mediaActionAriaLabel={`Subir imagen para ${dishLabel}`}
          inactive={!dish.active}
          priceLabel={isALaCarte ? formatEuro(dish.price ?? 0) : undefined}
          footerActions={(
            <div className="bo-dishRowActionsInline bo-dishRowActionsInline--split" data-slot="menuItemEditor-dishRowActionsInline--split">
              <button
                className="bo-btn bo-btn--ghost bo-btn--sm bo-dishIconOnlyBtn bo-dishAllergenIconBtn"
                type="button"
                aria-label={`Editar alergenos de ${dishLabel}`}
                onClick={() => setAllergenModal({ open: true, sectionClientId, dishClientId: dish.clientId })}
                data-testid={`menu-item-editor-allergen-btn-${dish.clientId}`}
              >
                <Wheat size={16} data-slot="menuItemEditor-allergenIcon" />
                <span className="bo-dishAllergenText" data-slot="menuItemEditor-allergenText">Editar alergenos</span>
              </button>
              <button
                className="bo-btn bo-btn--ghost bo-btn--sm bo-dishIconOnlyBtn bo-dishDeleteIconBtn"
                type="button"
                aria-label={`Eliminar plato ${dishLabel}`}
                onClick={() => requestDishDelete(sectionClientId, dish.clientId, dishLabel)}
                data-testid={`menu-item-editor-delete-btn-${dish.clientId}`}
              >
                <Trash2 size={14} />
              </button>
            </div>
          )}
        >
          <div className="bo-dishEditorContent" data-slot="menuItemEditor-dishEditorContent">
            <div className="bo-dishCardHead" data-slot="menuItemEditor-dishCardHead">
              <button
                className="bo-dishDrag"
                type="button"
                aria-label={`Arrastrar plato ${dishLabel}`}
                onPointerDown={(event) => {
                  event.preventDefault();
                  startDishDragLocal(event);
                }}
                data-testid={`menu-item-editor-drag-${dish.clientId}`}
              >
                <GripVertical size={14} />
              </button>
              <label className="bo-checkRow" data-slot="menuItemEditor-checkRow">
                <Switch
                  checked={dish.active}
                  onCheckedChange={(checked) => {
                    updateDish(sectionClientId, dish.clientId, { active: checked });
                  }}
                  data-testid={`menu-item-editor-active-switch-${dish.clientId}`}
                />
                <span data-slot="menuItemEditor-ivo">Activo</span>
              </label>
            </div>
            <div className="bo-dishFields" data-slot="menuItemEditor-dishFields">
              <textarea
                className="bo-input bo-textarea bo-dishTitleTextarea"
                rows={1}
                value={dish.title}
                ref={titleTextareaRef}
                onInput={(e) => {
                  const node = e.currentTarget;
                  node.style.height = "auto";
                  node.style.height = `${node.scrollHeight}px`;
                }}
                onChange={(e) => updateDish(sectionClientId, dish.clientId, { title: e.target.value })}
                placeholder="Titulo plato"
                data-testid={`menu-item-editor-title-input-${dish.clientId}`}
              />
              <label className="bo-checkRow" data-slot="menuItemEditor-checkRow">
                <Switch
                  checked={dish.description_enabled}
                  onCheckedChange={(checked) => {
                    updateDish(sectionClientId, dish.clientId, {
                      description_enabled: checked,
                      description: checked ? dish.description : "",
                    });
                  }}
                  data-testid={`menu-item-editor-description-switch-${dish.clientId}`}
                />
                <span data-slot="menuItemEditor-ion">Descripcion</span>
              </label>
              {dish.description_enabled ? (
                <textarea
                  className="bo-input bo-textarea"
                  value={dish.description}
                  onChange={(e) => updateDish(sectionClientId, dish.clientId, { description: e.target.value })}
                  placeholder="Descripcion"
                  data-testid={`menu-item-editor-description-input-${dish.clientId}`}
                />
              ) : null}

              {isALaCarte ? (
                <div className="bo-dishPriceRow" data-slot="menuItemEditor-dishPriceRow">
                  <label className="bo-label" data-slot="menuItemEditor-label">Precio</label>
                  <input
                    className="bo-input bo-priceInput"
                    inputMode="decimal"
                    value={dish.price == null ? "" : String(dish.price)}
                    onChange={(e) =>
                      updateDish(sectionClientId, dish.clientId, { price: toNumOrNull(e.target.value) })
                    }
                    placeholder="0.00"
                    data-testid={`menu-item-editor-price-input-${dish.clientId}`}
                  />
                </div>
              ) : null}
              <div className="bo-dishFieldsSide" data-slot="menuItemEditor-dishFieldsSide">
                <div className="bo-dishRow" data-slot="menuItemEditor-dishRow">
                  <div className="bo-dishRowInlineControls" data-slot="menuItemEditor-dishRowInlineControls">
                    <div className="bo-dishSupplementRow" data-slot="menuItemEditor-supplementRow">
                      <label className="bo-checkRow" data-slot="menuItemEditor-checkRow">
                        <Switch
                          checked={dish.supplement_enabled}
                          onCheckedChange={(checked) => {
                            updateDish(sectionClientId, dish.clientId, {
                              supplement_enabled: checked,
                              supplement_price: checked ? dish.supplement_price : null,
                            });
                          }}
                          data-testid={`menu-item-editor-supplement-switch-${dish.clientId}`}
                        />
                        <span data-slot="menuItemEditor-nto">Suplemento</span>
                      </label>
                      {dish.supplement_enabled ? (
                        <div className="bo-dishSupplementInputWrap" data-slot="menuItemEditor-supplementInputWrap">
                          <input
                            className="bo-input bo-suppInput"
                            inputMode="decimal"
                            value={dish.supplement_price == null ? "" : String(dish.supplement_price)}
                            onChange={(e) =>
                              updateDish(sectionClientId, dish.clientId, { supplement_price: toNumOrNull(e.target.value) })
                            }
                            placeholder="0.00"
                            data-testid={`menu-item-editor-supplement-input-${dish.clientId}`}
                          />
                          <span className="bo-dishSupplementCurrency" aria-hidden="true" data-slot="menuItemEditor-supplementCurrency">€</span>
                        </div>
                      ) : null}
                    </div>
                    <label className="bo-checkRow" data-slot="menuItemEditor-checkRow">
                      <Switch
                        checked={dish.same_day_booking_blocked ?? false}
                        onCheckedChange={(checked) => {
                          toggleSameDayBooking(sectionClientId, dish.clientId, checked);
                        }}
                        disabled={!dish.id}
                        data-testid={`menu-item-editor-same-day-booking-switch-${dish.clientId}`}
                      />
                      <span data-slot="menuItemEditor-sdb">No permitir reserva mismo dia</span>
                    </label>
                  </div>
                </div>
              </div>
              {dish.allergens.length > 0 ? (
                <div className="bo-allergenRow" data-slot="menuItemEditor-allergenRow">
                  <span className="bo-label bo-allergenRowLabel" data-slot="menuItemEditor-allergenLabel">Alergenos</span>
                  <div className="bo-allergenBadges" data-slot="menuItemEditor-allergenBadges">
                    {dish.allergens.map((name) => {
                      const entry = ALLERGENS.find((item) => item.key === name);
                      const Icon = entry?.icon;
                      return (
                        <span key={`${dish.clientId}-${name}`} className="bo-allergenPill" title={name} data-slot="menuItemEditor-allergenPill">
                          {Icon ? <Icon size={14} aria-hidden="true" /> : null}
                          <span data-slot="menuItemEditor-span">{name}</span>
                        </span>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </FoodDishCard>
      )}
    </ReorderItemContainer>
  );
}
