import React, { useCallback, useLayoutEffect, useRef } from "react";
import { GripVertical, Trash2 } from "lucide-react";
import { useDragControls } from "motion/react";
import { Reorder } from "motion/react";
import type { EditorDish } from "../../types/menuEditor.types";
import { formatEuro, toNumOrNull } from "../../helpers/menuEditor.helpers";
import { FoodDishCard } from "../../../../../../ui/widgets/food/FoodDishCard";
import { Switch } from "../../../../../../ui/shadcn/Switch";

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
  removeDish: (sectionClientId: string, dishClientId: string) => void;
  updateDish: (sectionClientId: string, dishClientId: string, patch: Partial<EditorDish>) => void;
  reorderTransition?: any;
  reorderWhileDrag?: any;
};

function WheatOffIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="2" x2="22" y1="2" y2="22" />
      <path d="M10 4v16" />
      <path d="m2 22 10-10" />
    </svg>
  );
}

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
  startDishDrag, pickDishImage, setAllergenModal, removeDish, updateDish,
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
          onMediaAction={() => pickDishImage(sectionClientId, dish.clientId)}
          mediaActionAriaLabel={`Subir imagen para ${dishLabel}`}
          inactive={!dish.active}
          priceLabel={isALaCarte ? formatEuro(dish.price ?? 0) : undefined}
          footerActions={(
            <div className="bo-dishRowActionsInline bo-dishRowActionsInline--split">
              <button
                className="bo-btn bo-btn--ghost bo-btn--sm bo-dishIconOnlyBtn bo-dishAllergenIconBtn"
                type="button"
                aria-label={`Editar alergenos de ${dishLabel}`}
                onClick={() => setAllergenModal({ open: true, sectionClientId, dishClientId: dish.clientId })}
              >
                <WheatOffIcon size={14} />
              </button>
              <button
                className="bo-btn bo-btn--ghost bo-btn--sm bo-dishIconOnlyBtn bo-dishDeleteIconBtn"
                type="button"
                aria-label={`Eliminar plato ${dishLabel}`}
                onClick={() => removeDish(sectionClientId, dish.clientId)}
              >
                <Trash2 size={14} />
              </button>
            </div>
          )}
        >
          <div className="bo-dishEditorContent">
            <div className="bo-dishCardHead">
              <button
                className="bo-dishDrag"
                type="button"
                aria-label={`Arrastrar plato ${dishLabel}`}
                onPointerDown={(event) => {
                  event.preventDefault();
                  startDishDragLocal(event);
                }}
              >
                <GripVertical size={14} />
              </button>
              <label className="bo-checkRow">
                <Switch
                  checked={dish.active}
                  onCheckedChange={(checked) => {
                    updateDish(sectionClientId, dish.clientId, { active: checked });
                  }}
                />
                <span>Activo</span>
              </label>
            </div>
            <div className="bo-dishFields">
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
              />
              <label className="bo-checkRow">
                <Switch
                  checked={dish.description_enabled}
                  onCheckedChange={(checked) => {
                    updateDish(sectionClientId, dish.clientId, {
                      description_enabled: checked,
                      description: checked ? dish.description : "",
                    });
                  }}
                />
                <span>Descripcion</span>
              </label>
              {dish.description_enabled ? (
                <textarea
                  className="bo-input bo-textarea"
                  value={dish.description}
                  onChange={(e) => updateDish(sectionClientId, dish.clientId, { description: e.target.value })}
                  placeholder="Descripcion"
                />
              ) : null}

              {isALaCarte ? (
                <div className="bo-dishPriceRow">
                  <label className="bo-label">Precio</label>
                  <input
                    className="bo-input bo-priceInput"
                    inputMode="decimal"
                    value={dish.price == null ? "" : String(dish.price)}
                    onChange={(e) =>
                      updateDish(sectionClientId, dish.clientId, { price: toNumOrNull(e.target.value) })
                    }
                    placeholder="0.00"
                  />
                </div>
              ) : null}
              <div className="bo-dishFieldsSide">
                {dish.allergens.length > 0 ? (
                  <div className="bo-allergenRow">
                    {dish.allergens.map((name) => (
                      <span key={`${dish.clientId}-${name}`} className="bo-allergenPill">{name}</span>
                    ))}
                  </div>
                ) : null}
                <div className="bo-dishRow">
                  <div className="bo-dishRowInlineControls">
                    <label className="bo-checkRow">
                      <Switch
                        checked={dish.supplement_enabled}
                        onCheckedChange={(checked) => {
                          updateDish(sectionClientId, dish.clientId, {
                            supplement_enabled: checked,
                            supplement_price: checked ? dish.supplement_price : null,
                          });
                        }}
                      />
                      <span>Suplemento</span>
                    </label>
                    {dish.supplement_enabled ? (
                      <input
                        className="bo-input bo-suppInput"
                        inputMode="decimal"
                        value={dish.supplement_price == null ? "" : String(dish.supplement_price)}
                        onChange={(e) =>
                          updateDish(sectionClientId, dish.clientId, { supplement_price: toNumOrNull(e.target.value) })
                        }
                        placeholder="€"
                      />
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </FoodDishCard>
      )}
    </ReorderItemContainer>
  );
}
