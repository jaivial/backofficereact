import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Eye, EyeOff, GripVertical, MessageSquareText, Plus, Search, Settings2, Trash2 } from "lucide-react";
import { AnimatePresence, motion, Reorder } from "motion/react";
import type { EditorSection } from "../../types/menuEditor.types";
import type { DishCatalogItem } from "../../../../../../api/types";
import { LoadingSpinner } from "../../../../../../ui/feedback/LoadingSpinner";
import { ScrollArea } from "../../../../../../ui/layout/ScrollArea";
import { Switch } from "../../../../../../ui/shadcn/Switch";
import { MenuItemEditor } from "../MenuItemEditor/MenuItemEditor";
import { ALLERGENS } from "../../constants/menuEditor.constants";
import { useDragControls } from "motion/react";

export type SectionDishTab = "active" | "inactive" | "annotations" | "settings";

const ALLERGEN_ALIASES: Record<string, string> = {
  lacteos: "leche",
  frutos_secos: "frutos de cascara",
};

export type MenuSectionEditorProps = {
  sec: EditorSection;
  secIdx: number;
  sectionsCount: number;
  isALaCarte: boolean;
  showDishImages: boolean;
  showSectionTabs: boolean;
  reorderTransition: any;
  reorderWhileDrag: any;
  chevronHover: any;
  chevronTapUp: any;
  chevronTapDown: any;
  moveSection: (from: number, to: number) => void;
  handleSectionToggle: (clientId: string, willExpand: boolean) => void;
  updateSection: (clientId: string, patch: Partial<EditorSection>) => void;
  reorderDishes: (sectionClientId: string, orderedClientIds: string[]) => void;
  setAllergenModal: React.Dispatch<React.SetStateAction<{ open: boolean; sectionClientId: string; dishClientId: string } | null>>;
  requestDishDelete: (sectionClientId: string, dishClientId: string, dishLabel: string) => void;
  updateDish: (sectionClientId: string, dishClientId: string, patch: Partial<EditorSection["dishes"][number]>) => void;
  updateSectionAnnotation: (sectionClientId: string, annotationIdx: number, value: string) => void;
  addSectionAnnotation: (sectionClientId: string) => void;
  removeSectionAnnotation: (sectionClientId: string, annotationIdx: number) => void;
  setSectionDescriptionsEnabled: (sectionClientId: string, enabled: boolean) => void;
  pickDishImage: (sectionClientId: string, dishClientId: string) => void;
  addDish: (sectionClientId: string, fromCatalog?: DishCatalogItem) => void;
  handleSearch: (sectionClientId: string, term: string) => void;
  searchTerm: string;
  searchItems: DishCatalogItem[];
  sectionLoadingState?: "loading" | "error" | null;
  onReorderSectionStartDrag: (sectionClientId: string, event: React.PointerEvent<Element>) => void;
  toggleSameDayBooking: (sectionClientId: string, dishClientId: string, blocked: boolean) => void;
  requestSectionDelete: (sectionClientId: string, sectionLabel: string) => void;
};

function ReorderSectionContainer({ value, className, transition, whileDrag, children }: {
  value: string;
  className: string;
  transition?: any;
  whileDrag?: any;
  children: React.ReactNode;
}) {
  const dragControls = useDragControls();
  const startDrag = useCallback(
    (event: React.PointerEvent<Element>) => { dragControls.start(event); },
    [dragControls],
  );
  return (
    <Reorder.Item
      as="div"
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
      {/* Pass startDrag through a data attribute or context if needed */}
      {children}
    </Reorder.Item>
  );
}

export function MenuSectionEditor({
  sec, secIdx, sectionsCount, isALaCarte, showDishImages, showSectionTabs,
  reorderTransition, reorderWhileDrag, chevronHover, chevronTapUp, chevronTapDown,
  moveSection, handleSectionToggle, updateSection, reorderDishes,
  setAllergenModal, requestDishDelete, updateDish,
  updateSectionAnnotation, addSectionAnnotation, removeSectionAnnotation,
  setSectionDescriptionsEnabled,
  pickDishImage, addDish, handleSearch, searchTerm, searchItems,
  sectionLoadingState, onReorderSectionStartDrag, toggleSameDayBooking, requestSectionDelete,
}: MenuSectionEditorProps) {
  const [dishTab, setDishTab] = useState<SectionDishTab>("active");
  const sectionLabel = sec.title.trim() || `seccion ${secIdx + 1}`;
  const activeDishCount = useMemo(() => sec.dishes.reduce((total, dish) => total + (dish.active ? 1 : 0), 0), [sec.dishes]);
  const inactiveDishCount = sec.dishes.length - activeDishCount;
  const annotationCount = useMemo(() => {
    if (!Array.isArray(sec.annotations)) return 0;
    return sec.annotations.filter((v) => v.trim().length > 0).length;
  }, [sec.annotations]);
  const visibleDishes = useMemo(
    () => (dishTab === "annotations" || dishTab === "settings"
      ? []
      : sec.dishes.filter((dish) => (dishTab === "active" ? dish.active : !dish.active))),
    [dishTab, sec.dishes],
  );
  const activeTabId = `bo-section-dishes-active-${sec.clientId}`;
  const inactiveTabId = `bo-section-dishes-inactive-${sec.clientId}`;
  const annotationsTabId = `bo-section-dishes-annotations-${sec.clientId}`;
  const settingsTabId = `bo-section-dishes-settings-${sec.clientId}`;
  const dishPanelId = `bo-section-dishes-panel-${sec.clientId}`;
  // Coordination id: menu-section-description-enabled-v1. The section switch means
  // "descriptions are allowed in this section", not "show every description". It reads
  // on when a single dish description is on, or when the operator armed it without
  // having opted any dish in yet, so turning one dish on never disturbs the others.
  const [descriptionsArmed, setDescriptionsArmed] = useState(false);
  const anyDescriptionEnabled = sec.dishes.some((dish) => dish.description_enabled);
  const descriptionsEnabled = anyDescriptionEnabled || descriptionsArmed;

  // Turning the last dish description off disarms the section, so the switch and the
  // dishes never disagree once the section holds no visible description at all.
  useEffect(() => {
    if (anyDescriptionEnabled) setDescriptionsArmed(false);
  }, [anyDescriptionEnabled]);

  useEffect(() => {
    if (dishTab === "annotations" || dishTab === "settings") return;
    if (dishTab === "active" && activeDishCount > 0) return;
    if (dishTab === "inactive" && inactiveDishCount > 0) return;
    if (activeDishCount > 0) { setDishTab("active"); return; }
    if (inactiveDishCount > 0) setDishTab("inactive");
  }, [activeDishCount, dishTab, inactiveDishCount]);

  const handleDishTabChange = useCallback((nextTab: SectionDishTab) => setDishTab(nextTab), []);
  const handleAddDish = useCallback(() => { setDishTab("active"); addDish(sec.clientId); }, [addDish, sec.clientId]);
  const handleAddDishFromCatalog = useCallback((item: DishCatalogItem) => { setDishTab("active"); addDish(sec.clientId, item); }, [addDish, sec.clientId]);

  const handleReorderVisibleDishes = useCallback(
    (orderedVisibleClientIds: string[]) => {
      if (orderedVisibleClientIds.length !== visibleDishes.length) return;
      let visibleCursor = 0;
      const nextOrder = sec.dishes.map((dish) => {
        const matchesTab = dishTab === "active" ? dish.active : !dish.active;
        if (!matchesTab) return dish.clientId;
        const nextClientId = orderedVisibleClientIds[visibleCursor];
        visibleCursor += 1;
        return nextClientId ?? dish.clientId;
      });
      reorderDishes(sec.clientId, nextOrder);
    },
    [dishTab, reorderDishes, sec.clientId, sec.dishes, visibleDishes.length],
  );

  return (
    <div className="bo-panel bo-accordionSection bo-reorderItem" data-section-editor={sec.clientId} data-testid={`menu-section-editor-${sec.clientId}`}>
      <div className="bo-accordionHeadRow" data-slot="menuSectionEditor-accordionHeadRow">
        <div className="bo-sectionReorder bo-sectionReorder--accordion" data-slot="menuSectionEditor-sectionReorder--accordion">
          <div className="bo-sectionMoveControls" data-slot="menuSectionEditor-sectionMoveControls">
            <motion.button
              className="bo-sectionMoveBtn"
              type="button"
              aria-label={`Subir seccion ${sec.title || secIdx + 1}`}
              disabled={secIdx === 0}
              whileHover={chevronHover}
              whileTap={chevronTapUp}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => moveSection(secIdx, secIdx - 1)}
              data-testid={`menu-section-editor-move-up-${secIdx}`}
            >
              <ChevronUp size={14} />
            </motion.button>
            <motion.button
              className="bo-sectionMoveBtn"
              type="button"
              aria-label={`Bajar seccion ${sec.title || secIdx + 1}`}
              disabled={secIdx === sectionsCount - 1}
              whileHover={chevronHover}
              whileTap={chevronTapDown}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => moveSection(secIdx, secIdx + 1)}
              data-testid={`menu-section-editor-move-down-${secIdx}`}
            >
              <ChevronDown size={14} />
            </motion.button>
          </div>
          <button
            className="bo-sectionDrag"
            type="button"
            aria-label={`Arrastrar seccion ${sec.title || secIdx + 1}`}
            onPointerDown={(event) => {
              event.preventDefault();
              onReorderSectionStartDrag(sec.clientId, event);
            }}
            data-testid={`menu-section-editor-drag-${secIdx}`}
          >
            <GripVertical size={18} />
          </button>
        </div>
        <button
          className="bo-accordionHead"
          type="button"
          onClick={() => handleSectionToggle(sec.clientId, !sec.expanded)}
          aria-expanded={sec.expanded}
          data-testid={`menu-section-editor-toggle-${secIdx}`}
        >
          <span className="bo-accordionHeadLeft" data-slot="menuSectionEditor-accordionHeadLeft">
            <span
              className="bo-label"
              data-slot="menuSectionEditor-titleLabel"
              data-testid={`menu-section-editor-title-label-${secIdx}`}
            >
              Titulo
            </span>
            <input
              className="bo-input"
              value={sec.title}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => updateSection(sec.clientId, { title: e.target.value })}
              aria-label={`Titulo de la seccion ${secIdx + 1}`}
              data-testid={`menu-section-editor-title-${secIdx}`}
            />
          </span>
          <span className="bo-accordionHeadRight" data-slot="menuSectionEditor-accordionHeadRight">
            <span className="bo-accordionBadge" data-slot="menuSectionEditor-accordionBadge">{sec.dishes.length}</span>
            <motion.span
              animate={{ rotate: sec.expanded ? 180 : 0 }}
              transition={{ duration: 0.16, ease: "easeOut" }}
              data-testid={`menu-section-editor-chevron-${sec.clientId}`}
            >
              <ChevronDown size={14} data-testid={`menu-section-editor-chevron-icon-${sec.clientId}`} />
            </motion.span>
          </span>
        </button>
      </div>

      <AnimatePresence initial={false}>
      {sec.expanded ? (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
          style={{ overflow: "hidden" }}
          className="bo-accordionBody"
          data-slot="menuSectionEditor-accordionBody"
          data-testid={`menu-section-editor-body-${sec.clientId}`}
        >
          <div className="bo-sectionDishTabs" role="tablist" aria-label="Filtro de platos" data-testid={`menu-section-editor-tabs-${sec.clientId}`}>
            <button
              id={activeTabId}
              className={`bo-sectionDishTab ${dishTab === "active" ? "is-active" : ""}`}
              type="button"
              role="tab"
              aria-label="Platos activos"
              aria-selected={dishTab === "active"}
              aria-controls={dishPanelId}
              tabIndex={dishTab === "active" ? 0 : -1}
              onClick={() => handleDishTabChange("active")}
              data-testid={`menu-section-editor-tab-active-${sec.clientId}`}
            >
              <span className="bo-sectionDishTabLabel" data-slot="menuSectionEditor-sectionDishTabLabel">Activos</span>
              <span className="bo-sectionDishTabIcon" data-slot="menuSectionEditor-sectionDishTabIcon" data-testid={`menu-section-editor-tab-active-icon-${sec.clientId}`}><Eye size={14} /></span>
              <span className="bo-sectionDishTabCount" data-slot="menuSectionEditor-sectionDishTabCount">{activeDishCount}</span>
            </button>
            <button
              id={inactiveTabId}
              className={`bo-sectionDishTab ${dishTab === "inactive" ? "is-active" : ""}`}
              type="button"
              role="tab"
              aria-label="Platos inactivos"
              aria-selected={dishTab === "inactive"}
              aria-controls={dishPanelId}
              tabIndex={dishTab === "inactive" ? 0 : -1}
              onClick={() => handleDishTabChange("inactive")}
              data-testid={`menu-section-editor-tab-inactive-${sec.clientId}`}
            >
              <span className="bo-sectionDishTabLabel" data-slot="menuSectionEditor-sectionDishTabLabel">Inactivos</span>
              <span className="bo-sectionDishTabIcon" data-slot="menuSectionEditor-sectionDishTabIcon" data-testid={`menu-section-editor-tab-inactive-icon-${sec.clientId}`}><EyeOff size={14} /></span>
              <span className="bo-sectionDishTabCount" data-slot="menuSectionEditor-sectionDishTabCount">{inactiveDishCount}</span>
            </button>
            <button
              id={annotationsTabId}
              className={`bo-sectionDishTab ${dishTab === "annotations" ? "is-active" : ""}`}
              type="button"
              role="tab"
              aria-label="Anotaciones"
              aria-selected={dishTab === "annotations"}
              aria-controls={dishPanelId}
              tabIndex={dishTab === "annotations" ? 0 : -1}
              onClick={() => handleDishTabChange("annotations")}
              data-testid={`menu-section-editor-tab-annotations-${sec.clientId}`}
            >
              <span className="bo-sectionDishTabLabel" data-slot="menuSectionEditor-sectionDishTabLabel">Anotaciones</span>
              <span className="bo-sectionDishTabIcon" data-slot="menuSectionEditor-sectionDishTabIcon"><MessageSquareText size={14} /></span>
              <span className="bo-sectionDishTabCount" data-slot="menuSectionEditor-sectionDishTabCount">{annotationCount}</span>
            </button>
            <button
              id={settingsTabId}
              className={`bo-sectionDishTab ${dishTab === "settings" ? "is-active" : ""}`}
              type="button"
              role="tab"
              aria-label="Ajustes de platos"
              aria-selected={dishTab === "settings"}
              aria-controls={dishPanelId}
              tabIndex={dishTab === "settings" ? 0 : -1}
              onClick={() => handleDishTabChange("settings")}
              data-testid={`menu-section-editor-tab-settings-${sec.clientId}`}
            >
              <span className="bo-sectionDishTabLabel" data-testid={`menu-section-editor-tab-settings-label-${sec.clientId}`}>Ajustes</span>
              <span className="bo-sectionDishTabIcon" data-testid={`menu-section-editor-tab-settings-icon-${sec.clientId}`}><Settings2 size={14} /></span>
            </button>
          </div>

          <div
            id={dishPanelId}
            className="bo-sectionDishTabPanel"
            data-slot="menu-section-dish-panel"
            role="tabpanel"
            aria-labelledby={
              dishTab === "active"
                ? activeTabId
                : dishTab === "inactive"
                  ? inactiveTabId
                  : dishTab === "annotations"
                    ? annotationsTabId
                    : settingsTabId
            }
          >
            {dishTab === "annotations" ? (
              <div className="bo-field bo-field--full" data-slot="menuSectionEditor-field--full">
                <div className="bo-stackFields" data-slot="menuSectionEditor-stackFields">
                  {sec.annotations.map((line, idx) => (
                    <div key={`${sec.clientId}-annotation-${idx}`} className="bo-inlineField" data-slot="menuSectionEditor-inlineField">
                      <textarea
                        className="bo-input bo-textarea"
                        value={line}
                        onChange={(e) => updateSectionAnnotation(sec.clientId, idx, e.target.value)}
                        placeholder="Anotacion"
                        rows={2}
                        style={{ minHeight: "2.8em", fontSize: "16px", resize: "vertical" }}
                        data-testid={`menu-section-editor-annotation-textarea-${sec.clientId}-${idx}`}
                      />
                      <button
                        className="bo-btn bo-btn--ghost"
                        type="button"
                        aria-label={`Eliminar anotacion ${idx + 1} de ${sectionLabel}`}
                        disabled={sec.annotations.length <= 1}
                        onClick={() => removeSectionAnnotation(sec.clientId, idx)}
                        data-testid={`menu-section-editor-annotation-delete-${sec.clientId}-${idx}`}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                  <button
                    className="bo-btn bo-btn--ghost bo-commentAddBtn"
                    type="button"
                    onClick={() => addSectionAnnotation(sec.clientId)}
                    data-testid={`menu-section-editor-annotation-add-${sec.clientId}`}
                  >
                    <Plus size={14} /> Añadir anotacion
                  </button>
                </div>
              </div>
            ) : dishTab === "settings" ? (
              <div className="bo-stackFields" data-testid={`menu-section-editor-settings-${sec.clientId}`} data-coordination-id="menu-section-settings-v1">
                <div className="bo-field bo-field--full" data-slot="menuSectionEditor-settings-displayTitleField">
                  <label
                    className="bo-label"
                    htmlFor={`menu-section-editor-settings-display-title-${sec.clientId}`}
                    data-slot="menuSectionEditor-settings-displayTitleLabel"
                  >
                    Titulo a mostrar
                  </label>
                  <input
                    id={`menu-section-editor-settings-display-title-${sec.clientId}`}
                    className="bo-input"
                    value={sec.displayTitle}
                    onChange={(e) => updateSection(sec.clientId, { displayTitle: e.target.value })}
                    placeholder="Titulo visible en la web"
                    aria-required="true"
                    data-testid={`menu-section-editor-settings-display-title-${sec.clientId}`}
                    data-coordination-id="menu-section-display-title-v1"
                  />
                  {sec.displayTitle.trim().length === 0 ? (
                    <div className="bo-mutedText" data-testid={`menu-section-editor-settings-display-title-error-${sec.clientId}`}>
                      El titulo a mostrar es obligatorio (el guardado lo rechaza).
                    </div>
                  ) : null}
                </div>

                <div className="bo-field bo-field--full" data-slot="menuSectionEditor-settings-subtitleField">
                  <label
                    className="bo-label"
                    htmlFor={`menu-section-editor-settings-subtitle-${sec.clientId}`}
                    data-slot="menuSectionEditor-settings-subtitleLabel"
                  >
                    Subtitulo
                  </label>
                  <textarea
                    id={`menu-section-editor-settings-subtitle-${sec.clientId}`}
                    className="bo-input bo-textarea"
                    value={sec.subtitle}
                    onChange={(e) => updateSection(sec.clientId, { subtitle: e.target.value })}
                    placeholder="Descripcion breve que aparece debajo del titulo en cursiva"
                    rows={2}
                    style={{ minHeight: "3em", fontSize: "16px", resize: "vertical" }}
                    data-testid={`menu-section-editor-settings-subtitle-${sec.clientId}`}
                    data-coordination-id="menu-section-subtitle-v1"
                  />
                </div>

                {showSectionTabs ? (
                  <div className="bo-field bo-field--full" data-slot="menuSectionEditor-settings-tabLabelField">
                    <label
                      className="bo-label"
                      htmlFor={`menu-section-editor-settings-tab-label-${sec.clientId}`}
                      data-slot="menuSectionEditor-settings-tabLabelLabel"
                    >
                      Texto de la pestana
                    </label>
                    <input
                      id={`menu-section-editor-settings-tab-label-${sec.clientId}`}
                      className="bo-input"
                      value={sec.tabLabel}
                      onChange={(e) => updateSection(sec.clientId, { tabLabel: e.target.value })}
                      placeholder="Etiqueta de la pestana"
                      data-testid={`menu-section-editor-settings-tab-label-${sec.clientId}`}
                      data-coordination-id="menu-section-tab-label-v1"
                    />
                  </div>
                ) : null}

                <div className="bo-field bo-field--inline" data-slot="menuSectionEditor-settings-descriptionField">
                  <div data-testid={`menu-section-editor-settings-description-copy-${sec.clientId}`}>
                    <div className="bo-label" data-testid={`menu-section-editor-settings-description-title-${sec.clientId}`}>Descripciones</div>
                    <div className="bo-mutedText" data-testid={`menu-section-editor-settings-description-state-${sec.clientId}`}>
                      {descriptionsEnabled ? "Descripciones activadas por plato" : "No mostrar descripciones"}
                    </div>
                  </div>
                  <Switch
                    checked={descriptionsEnabled}
                    onCheckedChange={(enabled) => {
                      setDescriptionsArmed(enabled);
                      setSectionDescriptionsEnabled(sec.clientId, enabled);
                    }}
                    aria-label={descriptionsEnabled ? "No mostrar descripciones" : "Permitir descripciones"}
                    data-testid={`menu-section-editor-settings-description-switch-${sec.clientId}`}
                    data-coordination-id="menu-section-description-enabled-v1"
                  />
                </div>

                <button
                  type="button"
                  className="bo-btn bo-btn--danger bo-btn--block"
                  onClick={() => requestSectionDelete(sec.clientId, sec.title)}
                  data-testid={`menu-section-editor-settings-delete-${sec.clientId}`}
                  data-coordination-id="menu-section-delete-v1"
                >
                  <Trash2 size={14} /> Eliminar seccion
                </button>
              </div>
            ) : visibleDishes.length > 0 ? (
              <Reorder.Group
                axis="y"
                values={visibleDishes.map((dish) => dish.clientId)}
                onReorder={handleReorderVisibleDishes}
                className="bo-dishesStack bo-reorderGroup"
              >
                {visibleDishes.map((dish, dishIdx) => (
                  <MenuItemEditor
                    key={dish.clientId}
                    sectionClientId={sec.clientId}
                    dish={dish}
                    dishIdx={dishIdx}
                    isALaCarte={isALaCarte}
                    showDishImages={showDishImages}
                    mediaLoading={dish.ai_generating}
                    startDishDrag={() => {}}
                    pickDishImage={pickDishImage}
                    setAllergenModal={setAllergenModal}
                    requestDishDelete={requestDishDelete}
                    updateDish={updateDish}
                    toggleSameDayBooking={toggleSameDayBooking}
                    reorderTransition={reorderTransition}
                    reorderWhileDrag={reorderWhileDrag}
                  />
                ))}
              </Reorder.Group>
            ) : sectionLoadingState === "loading" ? (
              <LoadingSpinner centered size="sm" label="Cargando platos..." />
            ) : (
              <div className="bo-dishesEmpty" role="status" aria-live="polite" data-slot="menuSectionEditor-dishesEmpty">
                {dishTab === "active"
                  ? "No hay platos activos en esta seccion."
                  : "No hay platos inactivos en esta seccion."}
              </div>
            )}
          </div>

          {dishTab === "active" || dishTab === "inactive" ? (
            <>
              <div className="bo-dishAddRow" data-slot="menuSectionEditor-dishAddRow">
                <div className="bo-dishSearchWrap" data-slot="menuSectionEditor-dishSearchWrap">
                  <Search size={14} aria-hidden="true" />
                  <input
                    className="bo-input bo-dishSearch"
                    value={searchTerm}
                    onChange={(e) => handleSearch(sec.clientId, e.target.value)}
                    placeholder="Buscar en catalogo..."
                    aria-label={`Buscar plato en catalogo para ${sectionLabel}`}
                    data-testid={`menu-section-editor-dish-search-${sec.clientId}`}
                  />
                </div>
                {searchTerm.trim().length >= 2 && searchItems.length > 0 ? (
                  <ScrollArea dataSlot="menu-section-editor-search-results"><div className="bo-dishSearchResults" role="listbox" aria-label="Resultados de busqueda" data-testid={`menu-section-editor-search-results-${sec.clientId}`}>
                    {searchItems.map((item) => (
                      <button
                        key={item.id}
                        className="bo-dishSearchResultItem"
                        type="button"
                        onClick={() => handleAddDishFromCatalog(item)}
                        role="option"
                        aria-selected={false}
                        data-testid={`menu-section-editor-search-result-${item.id}`}
                      >
                        <span className="bo-dishSearchResultTitle" data-slot="menuSectionEditor-dishSearchResultTitle">{item.title}</span>
                        {item.allergens && item.allergens.length > 0 ? (
                          <span className="bo-dishSearchResultAllergens" aria-label="Alergenos" data-slot="menuSectionEditor-dishSearchResultAllergens">
                            {item.allergens.map((allergen) => {
                              const key = allergen.trim().toLowerCase();
                              const entry = ALLERGENS.find((item) => item.key.toLowerCase() === (ALLERGEN_ALIASES[key] ?? key));
                              if (!entry) return null;
                              const Icon = entry.icon;
                              return <span key={`${entry.key}-${allergen}`} className="bo-dishSearchResultAllergenIcon" title={entry.key}><Icon size={14} aria-hidden="true" /></span>;
                            })}
                          </span>
                        ) : null}
                      </button>
                    ))}
                  </div>
                </ScrollArea>
                ) : null}
                <button
                  className="bo-btn bo-btn--ghost bo-btn--sm"
                  type="button"
                  onClick={handleAddDish}
                  aria-label={`Añadir plato a ${sectionLabel}`}
                  data-testid={`menu-section-editor-add-dish-${sec.clientId}`}
                >
                  <Plus size={14} /> Añadir plato
                </button>
              </div>
            </>
          ) : null}
        </motion.div>
      ) : null}
      </AnimatePresence>
    </div>
  );
}
