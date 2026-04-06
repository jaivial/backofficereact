import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronUp,
  Eye,
  GripVertical,
  Plus,
  Settings2,
  Trash2,
  Upload,
} from "lucide-react";
import { motion } from "motion/react";
import { Reorder } from "motion/react";
import { useDragControls } from "motion/react";

import { useToasts } from "../../../../ui/feedback/useToasts";
import { useErrorToast } from "../../../../ui/feedback/useErrorToast";
import { LoadingSpinner } from "../../../../ui/feedback/LoadingSpinner";
import { Select } from "../../../../ui/inputs/Select";
import { Switch } from "../../../../ui/shadcn/Switch";
import { Modal } from "../../../../ui/overlays/Modal";

import { useMenuEditor } from "./hooks/useMenuEditor";
import { MenuPreview } from "./functionalComponents/MenuPreview/MenuPreview";
import { MenuPublishPanel } from "./functionalComponents/MenuPublishPanel/MenuPublishPanel";
import { MenuPricing } from "./functionalComponents/MenuPricing/MenuPricing";
import { MenuSectionEditor } from "./functionalComponents/MenuSectionEditor/MenuSectionEditor";
import { DishImageAdvisorModalComponent } from "./functionalComponents/DishImageAdvisorModal/DishImageAdvisorModal";
import { ALLERGENS, beverageTypeOptions, dishVisibilityOptions, menuPreviewVisibilityOptions, menuTypeOptions } from "./constants/menuEditor.constants";
import type { DishImageCropConfirm } from "./types/menuEditor.types";

function DishImageCropModalComponent({
  open,
  imageUrl,
  busy,
  onClose,
  onConfirm,
}: {
  open: boolean;
  imageUrl: string;
  busy: boolean;
  onClose: () => void;
  onConfirm: (payload: DishImageCropConfirm) => void;
}) {
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [naturalSize, setNaturalSize] = useState({ width: 1, height: 1 });
  const [viewportSize, setViewportSize] = useState(0);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const pointerDragRef = useRef<{ pointerId: number; startX: number; startY: number; originX: number; originY: number } | null>(null);

  useEffect(() => {
    if (!open) return;
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    setNaturalSize({ width: 1, height: 1 });
    pointerDragRef.current = null;
  }, [imageUrl, open]);

  useEffect(() => {
    if (!open) return;
    const node = viewportRef.current;
    if (!node) return;
    const update = () => { setViewportSize(Math.max(1, Math.round(node.clientWidth || 0))); };
    update();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(update);
    ro.observe(node);
    return () => ro.disconnect();
  }, [open]);

  const baseScale = useMemo(() => {
    if (viewportSize <= 0) return 1;
    return Math.max(viewportSize / naturalSize.width, viewportSize / naturalSize.height);
  }, [naturalSize.height, naturalSize.width, viewportSize]);

  const getOffsetBounds = useCallback((nextZoom: number) => {
    const renderedWidth = naturalSize.width * baseScale * nextZoom;
    const renderedHeight = naturalSize.height * baseScale * nextZoom;
    return { x: Math.max(0, (renderedWidth - viewportSize) / 2), y: Math.max(0, (renderedHeight - viewportSize) / 2) };
  }, [baseScale, naturalSize.height, naturalSize.width, viewportSize]);

  const clampOffset = useCallback((x: number, y: number, nextZoom = zoom) => {
    const bounds = getOffsetBounds(nextZoom);
    return { x: Math.min(bounds.x, Math.max(-bounds.x, x)), y: Math.min(bounds.y, Math.max(-bounds.y, y)) };
  }, [getOffsetBounds, zoom]);

  const applyZoom = useCallback((nextRawZoom: number) => {
    const nextZoom = Math.min(4, Math.max(1, nextRawZoom));
    setZoom(nextZoom);
    setOffset((prev) => clampOffset(prev.x, prev.y, nextZoom));
  }, [clampOffset]);

  const onPointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (busy || event.pointerType === "touch") return;
    if (event.button !== 0) return;
    event.preventDefault();
    pointerDragRef.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, originX: offset.x, originY: offset.y };
    event.currentTarget.setPointerCapture(event.pointerId);
  }, [busy, offset.x, offset.y]);

  const onPointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const drag = pointerDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.preventDefault();
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    setOffset(clampOffset(drag.originX + dx, drag.originY + dy));
  }, [clampOffset]);

  const onPointerUp = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const drag = pointerDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    pointerDragRef.current = null;
    try { event.currentTarget.releasePointerCapture(event.pointerId); } catch { /* ignore */ }
  }, []);

  const onWheel = useCallback((event: React.WheelEvent<HTMLDivElement>) => {
    if (busy) return;
    event.preventDefault();
    const delta = event.deltaY < 0 ? 0.08 : -0.08;
    applyZoom(zoom + delta);
  }, [applyZoom, busy, zoom]);

  return (
    <Modal open={open} title="Recortar imagen" onClose={busy ? () => undefined : onClose} widthPx={620}>
      <div className="bo-modalHead">
        <div className="bo-modalTitle">Recorte 1:1</div>
        <button className="bo-modalX" type="button" onClick={onClose} aria-label="Cerrar" disabled={busy}>×</button>
      </div>
      <div className="bo-modalBody bo-dishCropBody">
        <div className="bo-dishCropViewportWrap">
          <div
            ref={viewportRef}
            className="bo-dishCropViewport"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onWheel={onWheel}
          >
            <img
              src={imageUrl}
              alt="Previsualizacion del recorte"
              className="bo-dishCropImage"
              draggable={false}
              style={{ transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px)) scale(${zoom})` }}
              onLoad={(event) => {
                const img = event.currentTarget;
                setNaturalSize({ width: Math.max(1, img.naturalWidth || img.width || 1), height: Math.max(1, img.naturalHeight || img.height || 1) });
              }}
            />
            <div className="bo-dishCropFrame" aria-hidden="true" />
          </div>
        </div>
        <div className="bo-dishCropControls">
          <button className="bo-btn bo-btn--ghost bo-btn--sm" type="button" onClick={() => applyZoom(zoom - 0.1)} disabled={busy}>-</button>
          <input className="bo-dishCropRange" type="range" min={1} max={4} step={0.01} value={zoom} onChange={(event) => applyZoom(Number(event.target.value))} disabled={busy} aria-label="Control de zoom" />
          <button className="bo-btn bo-btn--ghost bo-btn--sm" type="button" onClick={() => applyZoom(zoom + 0.1)} disabled={busy}>+</button>
          <button className="bo-btn bo-btn--ghost bo-btn--sm" type="button" onClick={() => { setOffset({ x: 0, y: 0 }); setZoom(1); }} disabled={busy}>Reset</button>
        </div>
      </div>
      <div className="bo-modalActions">
        <button className="bo-btn bo-btn--ghost" type="button" onClick={onClose} disabled={busy}>Cancelar</button>
        <button className="bo-btn bo-btn--primary" type="button" onClick={() => onConfirm({ zoom, offsetX: offset.x, offsetY: offset.y, viewportSize })} disabled={busy || viewportSize <= 0}>
          {busy ? "Procesando..." : "Guardar imagen"}
        </button>
      </div>
    </Modal>
  );
}

function ReorderSectionDragWrapper({ value, className, children }: { value: string; className: string; children: (startDrag: (event: React.PointerEvent<Element>) => void) => React.ReactNode }) {
  const dragControls = useDragControls();
  const startDrag = useMemo(() => (event: React.PointerEvent<Element>) => { dragControls.start(event); }, [dragControls]);
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
    >
      {children(startDrag)}
    </Reorder.Item>
  );
}

export function CrearPage() {
  const H = useMenuEditor();
  useErrorToast(H.error);

  const {
    error, menuId, isDraft, step, menuType, title, price, subtitles, active, showDishImages,
    showMenuPreviewImage, sections, includedCoffee, beverageType, beveragePrice, beverageHasSupplement,
    beverageSupplementPrice, minPartySize, mainLimit, mainLimitNum, comments, specialMenuImage,
    menuPreviewImageBusy, specialMenuImageBusy, saveState, busy, hydrated, mobileTab, desktopPreviewOpen,
    desktopPreviewDocked, previewThemeConfig, previewThemeLoading, allergenModal, searchTerms, searchResults,
    sectionLoadingState, menuAITracker, dishImageTarget, dishImageAdvisorDraft, dishImageAdvisorBusy,
    dishImageCropDraft, dishImageBusy, menuPreviewImageAdvisorDraft, menuPreviewImageAdvisorBusy,
    menuPreviewImageCropDraft, menuPreviewImageCropBusy,
    isALaCarte, isSpecial, hasSecondaryBasicsField,
    shouldReduceMotion, sectionOrder,
    dishImageAdvisorPreviewKB, menuPreviewImageAdvisorPreviewKB,
    previewThemeId, previewThemeLabel, previewNeedsUpgrade, previewMenuPayload, previewUrl,
    previewFrameRef, dishImageInputRef, menuPreviewImageInputRef, specialMenuImageInputRef,
    setStep, setMenuType, setTitle, setPrice, setSubtitles, setActive,
    setShowDishImages, setShowMenuPreviewImage, setSections, setIncludedCoffee, setBeverageType,
    setBeveragePrice, setBeverageHasSupplement, setBeverageSupplementPrice, setMinPartySize,
    setMainLimit, setMainLimitNum, setComments, setSpecialMenuImage, setSaveState, setBusy,
    setHydrated, setMobileTab, setDesktopPreviewOpen,
    setAllergenModal, setMenuAITracker, setDishImageTarget, setDishImageAdvisorDraft,
    setDishImageAdvisorBusy, setDishImageCropDraft, setDishImageBusy,
    setMenuPreviewImageAdvisorDraft, setMenuPreviewImageAdvisorBusy,
    setMenuPreviewImageCropDraft, setMenuPreviewImageCropBusy, setSearchTerms, setSearchResults,
    setSectionLoadingState, setMenuPreviewImageBusy, setSpecialMenuImageBusy,
    patchBasics, syncSectionsAndDishes, createDraftAndContinue, addSection, removeSection,
    updateSection, handleSectionToggle, updateSectionAnnotation, addSectionAnnotation,
    removeSectionAnnotation, moveSection, reorderSections, addDish, updateDish, removeDish,
    reorderDishes, handleSearch, pickDishImage, onDishImageFileSelected, onDishImageAdvisorImprove,
    onDishImageCropConfirm, onPublish, openSpecialMenuImagePicker, onSpecialMenuImageFileSelected,
    openMenuPreviewImagePicker, onMenuPreviewImageFileSelected, onMenuPreviewImageAdvisorImprove,
    onMenuPreviewImageCropConfirm, resolvePersistedDishTarget, moveDishImageAdvisorToCrop,
    moveMenuPreviewImageAdvisorToCrop, closeDishImageAdvisor, closeDishImageCropper,
    closeMenuPreviewImageAdvisor, closeMenuPreviewImageCropper, renderMenuPreviewUploadArea,
    renderSpecialMenuImageUploadArea, basicsFingerprint, basicsPayload, sectionsFingerprint,
    menuAIDishesById, loadingSectionTitles,
  } = H;

  const { pushToast } = useToasts();

  const paneLayoutTransition = useMemo(
    () => shouldReduceMotion
      ? { duration: 0 }
      : { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const },
    [shouldReduceMotion],
  );
  const reorderTransition = useMemo(
    () => shouldReduceMotion
      ? { duration: 0 }
      : { duration: 0.18, ease: [0.2, 0, 0, 1] as const },
    [shouldReduceMotion],
  );
  const reorderWhileDrag = useMemo(
    () => shouldReduceMotion
      ? undefined
      : { borderColor: "rgba(185, 168, 255, 0.56)", boxShadow: "0 16px 34px rgba(8, 10, 20, 0.5)" },
    [shouldReduceMotion],
  );
  const chevronHover = shouldReduceMotion ? undefined : { scale: 1.05 };
  const chevronTapUp = shouldReduceMotion ? undefined : { scale: 0.9, y: -2 };
  const chevronTapDown = shouldReduceMotion ? undefined : { scale: 0.9, y: 2 };

  const sectionOrderDragRefs = useRef<Record<string, (event: React.PointerEvent<Element>) => void>>({});

  const handleReorderSectionStartDrag = (sectionClientId: string, event: React.PointerEvent<Element>) => {
    // The Reorder.Group handles drag via children, so this is a no-op here
    // The actual drag is triggered by the grip button inside MenuSectionEditor
  };

  const menuPreviewUploadDisabled = !menuId || menuPreviewImageBusy || menuPreviewImageAdvisorBusy || menuPreviewImageCropBusy || H.menuPreviewAIGenerating;
  const specialMenuUploadDisabled = !menuId || specialMenuImageBusy || busy;

  return (
    <section className="bo-menuWizardPage" aria-label="Editor de menu">
      <div className="bo-menuWizardTop">
        <button className="bo-btn bo-btn--ghost" type="button" onClick={() => (window.location.href = "/app/menus")}>
          <ArrowLeft size={16} /> Volver a menus
        </button>
        <div className={`bo-saveTag is-${saveState}`}>
          {saveState === "saving" ? "Guardando..." : saveState === "saved" ? "Guardado" : saveState === "error" ? "Error guardando" : ""}
        </div>
      </div>

      <div className="bo-stepBars" role="progressbar" aria-valuemin={1} aria-valuemax={4} aria-valuenow={step + 1}>
        {[0, 1, 2, 3].map((idx) => (
          <div key={idx} className={`bo-stepBar ${idx === step ? "is-active" : ""} ${idx < step ? "is-done" : ""}`} />
        ))}
      </div>

      {/* Step 0: Menu Type Selection */}
      {step === 0 ? (
        <div className="bo-menuWizardPanel">
          <h2 className="bo-sectionTitle">Tipo de menu</h2>
          <p className="bo-typeIntro">Elige una base para empezar. Luego podras editar todos los detalles del menu.</p>
          <div className="bo-typeGrid">
            {H.isSpecial !== undefined && menuTypeOptions.map((opt) => {
              const MENU_TYPES = require("./constants/menuEditor.constants").MENU_TYPES;
              const optData = MENU_TYPES.find((p: any) => p.value === opt.value) || { icon: Settings2, description: "" };
              const Icon = optData.icon || Settings2;
              const isSelected = menuType === opt.value;
              return (
                <button
                  key={opt.value}
                  className={`bo-typeCard bo-menuGlassPanel ${isSelected ? "is-selected" : ""}`}
                  type="button"
                  disabled={!optData.enabled || busy}
                  onClick={() => setMenuType(opt.value)}
                  aria-pressed={isSelected}
                >
                  <div className="bo-typeCardTop">
                    <div className="bo-typeIconWrap" aria-hidden="true"><Icon size={18} /></div>
                    <div className={`bo-typeState ${isSelected ? "is-selected" : ""}`}>
                      {isSelected ? <Check size={13} /> : null}
                      {isSelected ? "Seleccionado" : "Plantilla"}
                    </div>
                  </div>
                  <div className="bo-typeTitle">{opt.label}</div>
                  <div className="bo-typeDesc">{optData.description}</div>
                  <div className="bo-typeHint">{optData.hint}</div>
                </button>
              );
            })}
          </div>
          <div className="bo-menuWizardActions bo-menuWizardActions--right">
            <button className="bo-btn bo-btn--primary" type="button" disabled={busy} onClick={() => void createDraftAndContinue()}>
              Continuar
            </button>
          </div>
        </div>
      ) : null}

      {/* Step 1: Basic Data */}
      {step === 1 ? (
        <div className="bo-menuWizardPanel">
          <h2 className="bo-sectionTitle">Datos basicos</h2>
          <div className="bo-form bo-form--menuWizard bo-form--menuWizardBasics">
            <div className={`bo-menuBasicsMainRow ${hasSecondaryBasicsField ? "" : "is-single"}`}>
              <div className="bo-field bo-menuBasicsField bo-menuBasicsField--title">
                <div className="bo-label">Titulo</div>
                <input className="bo-input" value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              {!isALaCarte && !isSpecial ? (
                <div className="bo-field bo-menuBasicsField bo-menuBasicsField--price">
                  <div className="bo-label">Precio</div>
                  <input className="bo-input" value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" />
                </div>
              ) : null}
            </div>

            {!isSpecial ? (
              <div className="bo-field bo-field--full">
                <div className="bo-label">Subtitulos</div>
                <div className="bo-stackFields">
                  {subtitles.map((line, idx) => (
                    <div key={`subtitle-${idx}`} className="bo-inlineField">
                      <input className="bo-input" value={line} onChange={(e) => { const next = [...subtitles]; next[idx] = e.target.value; setSubtitles(next); }} />
                      <button className="bo-btn bo-btn--ghost bo-inlineFieldIconBtn" type="button" aria-label={`Eliminar subtitulo ${idx + 1}`} disabled={subtitles.length <= 1} onClick={() => setSubtitles((prev) => prev.filter((_, i) => i !== idx))}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                  <button className="bo-btn bo-btn--ghost bo-btn--sm bo-subtitleAddBtn" type="button" onClick={() => setSubtitles((prev) => [...prev, ""])}>
                    <Plus size={14} /> Añadir subtitulo
                  </button>
                </div>
              </div>
            ) : null}

            {!isSpecial ? (
              <div className="bo-field">
                <div className="bo-label">Cambiar tipo de menu</div>
                <Select className="bo-menuSettingSelect" value={menuType} onChange={setMenuType} options={menuTypeOptions} size="sm" ariaLabel="Seleccionar tipo de menu" />
              </div>
            ) : null}

            <div className="bo-menuBasicsSwitchRow">
              <div className="bo-field">
                <div className="bo-label">Añadir foto preview</div>
                <Select className="bo-menuSettingSelect" value={showMenuPreviewImage ? "with_preview" : "without_preview"} onChange={(value) => setShowMenuPreviewImage(value === "with_preview")} options={menuPreviewVisibilityOptions} size="sm" ariaLabel="Visibilidad de foto preview" />
              </div>
            </div>

            <div className="bo-menuBasicsSwitchRow">
              <label className="bo-menuBasicsActiveToggle">
                <span className="bo-label">Activo</span>
                <Switch checked={active} onCheckedChange={setActive} />
                <span className="bo-mutedText">{active ? "Activo" : "No activo"}</span>
              </label>
            </div>

            {renderMenuPreviewUploadArea()}
          </div>

          <div className="bo-menuWizardActions">
            <button className="bo-btn bo-btn--ghost" type="button" onClick={() => setStep(0)}>Volver</button>
            <button
              className="bo-btn bo-btn--primary" type="button"
              onClick={() => {
                if (!title.trim()) { pushToast({ kind: "error", title: "Titulo", message: "El titulo es obligatorio" }); return; }
                if (isSpecial) setStep(4);
                else setStep(2);
              }}
            >
              Continuar
            </button>
          </div>
        </div>
      ) : null}

      {/* Step 2: Sections */}
      {step === 2 ? (
        <div className="bo-menuWizardPanel">
          <h2 className="bo-sectionTitle">Secciones del menu</h2>
          <Reorder.Group axis="y" values={sectionOrder} onReorder={reorderSections} className="bo-sectionsBoard bo-reorderGroup">
            {sections.map((sec, idx) => (
              <ReorderSectionDragWrapper key={sec.clientId} value={sec.clientId} className="bo-sectionCard bo-reorderItem">
                {(startDrag) => (
                  <div className="bo-sectionCardHead">
                    <div className="bo-sectionReorder">
                      <div className="bo-sectionMoveControls">
                        <motion.button className="bo-sectionMoveBtn" type="button" aria-label={`Subir seccion ${sec.title || idx + 1}`} disabled={idx === 0} whileHover={chevronHover} whileTap={chevronTapUp} onPointerDown={(event) => event.stopPropagation()} onClick={() => moveSection(idx, idx - 1)}>
                          <ChevronUp size={14} />
                        </motion.button>
                        <motion.button className="bo-sectionMoveBtn" type="button" aria-label={`Bajar seccion ${sec.title || idx + 1}`} disabled={idx === sections.length - 1} whileHover={chevronHover} whileTap={chevronTapDown} onPointerDown={(event) => event.stopPropagation()} onClick={() => moveSection(idx, idx + 1)}>
                          <ChevronDown size={14} />
                        </motion.button>
                      </div>
                      <button className="bo-sectionDrag" type="button" aria-label={`Arrastrar seccion ${sec.title || idx + 1}`} onPointerDown={(event) => { event.preventDefault(); startDrag(event); }}>
                        <GripVertical size={18} />
                      </button>
                    </div>
                    <input className="bo-input" value={sec.title} onChange={(e) => updateSection(sec.clientId, { title: e.target.value })} />
                    <button className="bo-btn bo-btn--ghost" type="button" aria-label={`Eliminar seccion ${sec.title || idx + 1}`} disabled={sections.length <= 1} onClick={() => removeSection(sec.clientId)}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </ReorderSectionDragWrapper>
            ))}
          </Reorder.Group>

          <div className="bo-menuWizardActions">
            <button className="bo-btn bo-btn--ghost" type="button" onClick={addSection}>
              <Plus size={14} /> Añadir seccion
            </button>
            <div className="bo-menuWizardActionsRight">
              <button className="bo-btn bo-btn--ghost" type="button" onClick={() => setStep(1)}>Volver</button>
              <button className="bo-btn bo-btn--primary" type="button" onClick={() => setStep(3)}>Continuar</button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Step 3: Final Editor */}
      {step === 3 ? (
        <div
          className={[
            "bo-menuWizardFinal",
            desktopPreviewOpen ? "is-previewOpen" : "is-previewHidden",
            desktopPreviewDocked ? "" : "is-previewUndocked",
          ].filter(Boolean).join(" ")}
        >
          <div className="bo-previewDesktopSwitch">
            <span className="bo-previewDesktopSwitchLabel"><Eye size={14} aria-hidden="true" /> Preview web</span>
            <Switch checked={desktopPreviewOpen} onCheckedChange={setDesktopPreviewOpen} aria-label={desktopPreviewOpen ? "Ocultar preview web" : "Mostrar preview web"} />
          </div>

          <motion.div layout transition={paneLayoutTransition} className={`bo-editorPane ${mobileTab === "editor" ? "is-mobileActive" : ""}`}>
            <motion.div layout transition={paneLayoutTransition} className="bo-panel bo-menuEditorHead">
              <div className="bo-panelHead">
                <div>
                  <div className="bo-panelTitle">Editor de menu</div>
                  <div className="bo-panelMeta">Titulo, subtitulos, precio y estado siguen editables</div>
                </div>
              </div>
              <div className="bo-panelBody bo-form bo-form--menuWizard bo-form--menuWizardBasics">
                <div className={`bo-menuBasicsMainRow ${hasSecondaryBasicsField ? "" : "is-single"}`}>
                  <div className="bo-field bo-menuBasicsField bo-menuBasicsField--title">
                    <div className="bo-label">Titulo</div>
                    <input className="bo-input" value={title} onChange={(e) => setTitle(e.target.value)} />
                  </div>
                  {!isALaCarte && !isSpecial ? (
                    <div className="bo-field bo-menuBasicsField bo-menuBasicsField--price">
                      <div className="bo-label">Precio</div>
                      <input className="bo-input" value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" />
                    </div>
                  ) : null}
                </div>
                {!isSpecial ? (
                  <div className="bo-field bo-field--full">
                    <div className="bo-label">Subtitulos</div>
                    <div className="bo-stackFields">
                      {subtitles.map((line, idx) => (
                        <div key={`subtitle-final-${idx}`} className="bo-inlineField">
                          <input className="bo-input" value={line} onChange={(e) => { const next = [...subtitles]; next[idx] = e.target.value; setSubtitles(next); }} />
                          <button className="bo-btn bo-btn--ghost bo-inlineFieldIconBtn" type="button" aria-label={`Eliminar subtitulo ${idx + 1}`} disabled={subtitles.length <= 1} onClick={() => setSubtitles((prev) => prev.filter((_, i) => i !== idx))}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                      <button className="bo-btn bo-btn--ghost bo-btn--sm bo-subtitleAddBtn" type="button" onClick={() => setSubtitles((prev) => [...prev, ""])}>
                        <Plus size={14} /> Añadir subtitulo
                      </button>
                    </div>
                  </div>
                ) : null}
                {!isSpecial ? (
                  <div className="bo-field">
                    <div className="bo-label">Visibilidad de platos</div>
                    <Select className="bo-menuSettingSelect" value={showDishImages ? "with_image" : "without_image"} onChange={(value) => setShowDishImages(value === "with_image")} options={dishVisibilityOptions} size="sm" ariaLabel="Visibilidad de platos en preview" />
                  </div>
                ) : null}
                <div className="bo-field">
                  <div className="bo-label">Añadir foto preview</div>
                  <Select className="bo-menuSettingSelect" value={showMenuPreviewImage ? "with_preview" : "without_preview"} onChange={(value) => setShowMenuPreviewImage(value === "with_preview")} options={menuPreviewVisibilityOptions} size="sm" ariaLabel="Visibilidad de foto preview en editor final" />
                </div>
                {!isSpecial ? (
                  <div className="bo-field">
                    <div className="bo-label">Cambiar tipo de menu</div>
                    <Select className="bo-menuSettingSelect" value={menuType} onChange={setMenuType} options={menuTypeOptions} size="sm" ariaLabel="Seleccionar tipo de menu en editor final" />
                  </div>
                ) : null}
                <div className="bo-menuBasicsSwitchRow">
                  <label className="bo-menuBasicsActiveToggle">
                    <span className="bo-label">Activo</span>
                    <Switch checked={active} onCheckedChange={setActive} />
                    <span className="bo-mutedText">{active ? "Activo" : "No activo"}</span>
                  </label>
                </div>
                {renderMenuPreviewUploadArea()}
              </div>
            </motion.div>

            {isSpecial ? (
              <div className="bo-panel bo-accordionSection bo-sectionsEditor">
                <div className="bo-panelHead">
                  <div className="bo-panelTitle">Contenido del menu especial</div>
                </div>
                <div className="bo-panelBody">
                  {renderSpecialMenuImageUploadArea()}
                </div>
              </div>
            ) : !hydrated ? (
              <div className="bo-sectionsEditor" aria-live="polite" aria-busy="true">
                {loadingSectionTitles.map((sectionTitle, idx) => (
                  <div key={`section-loading-${idx}`} className="bo-panel bo-accordionSection">
                    <div className="bo-panelHead">
                      <div className="bo-panelTitle">{sectionTitle}</div>
                    </div>
                    <div className="bo-panelBody">
                      <LoadingSpinner centered size="sm" label="Cargando platos..." />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <Reorder.Group axis="y" values={sectionOrder} onReorder={reorderSections} className="bo-sectionsEditor bo-reorderGroup">
                {sections.map((sec, secIdx) => (
                  <MenuSectionEditor
                    key={sec.clientId}
                    sec={sec}
                    secIdx={secIdx}
                    sectionsCount={sections.length}
                    isALaCarte={isALaCarte}
                    showDishImages={showDishImages}
                    reorderTransition={reorderTransition}
                    reorderWhileDrag={reorderWhileDrag}
                    chevronHover={chevronHover}
                    chevronTapUp={chevronTapUp}
                    chevronTapDown={chevronTapDown}
                    moveSection={moveSection}
                    handleSectionToggle={handleSectionToggle}
                    updateSection={updateSection}
                    reorderDishes={reorderDishes}
                    setAllergenModal={setAllergenModal}
                    removeDish={removeDish}
                    updateDish={updateDish}
                    updateSectionAnnotation={updateSectionAnnotation}
                    addSectionAnnotation={addSectionAnnotation}
                    removeSectionAnnotation={removeSectionAnnotation}
                    pickDishImage={pickDishImage}
                    addDish={addDish}
                    handleSearch={handleSearch}
                    searchTerm={searchTerms[sec.clientId] || ""}
                    searchItems={searchResults[sec.clientId] ?? []}
                    sectionLoadingState={sectionLoadingState[sec.clientId]}
                    onReorderSectionStartDrag={handleReorderSectionStartDrag}
                  />
                ))}
              </Reorder.Group>
            )}

            {!isSpecial ? (
              <motion.div layout transition={paneLayoutTransition} className="bo-panel bo-settingsPanel">
                <div className="bo-panelHead">
                  <div className="bo-panelTitle"><Settings2 size={15} /> Configuracion</div>
                </div>
                <div className="bo-panelBody bo-form bo-form--menuWizard">
                  <div className="bo-field">
                    <div className="bo-label">Bebida</div>
                    <Select className="bo-menuSettingSelect" value={beverageType} onChange={setBeverageType} options={beverageTypeOptions} size="sm" ariaLabel="Tipo de bebida" />
                  </div>
                  {beverageType !== "no_incluida" ? (
                    <div className="bo-field">
                      <div className="bo-label">Precio por persona</div>
                      <input className="bo-input" value={beveragePrice} onChange={(e) => setBeveragePrice(e.target.value)} inputMode="decimal" />
                    </div>
                  ) : null}
                  {beverageType === "ilimitada" ? (
                    <>
                      <div className="bo-field">
                        <div className="bo-label">Tiene suplemento</div>
                        <Switch checked={beverageHasSupplement} onCheckedChange={setBeverageHasSupplement} />
                      </div>
                      {beverageHasSupplement ? (
                        <div className="bo-field">
                          <div className="bo-label">Valor suplemento</div>
                          <input className="bo-input" value={beverageSupplementPrice} onChange={(e) => setBeverageSupplementPrice(e.target.value)} inputMode="decimal" />
                        </div>
                      ) : null}
                    </>
                  ) : null}
                  <div className="bo-field">
                    <div className="bo-label">Minimo personas para reservar</div>
                    <input className="bo-input" value={minPartySize} onChange={(e) => setMinPartySize(e.target.value)} inputMode="numeric" />
                  </div>
                  <div className="bo-field bo-field--inline">
                    <div className="bo-label" style={{ marginRight: "auto" }}>Limite maximo de principales por mesa</div>
                    <Switch checked={mainLimit} onCheckedChange={setMainLimit} />
                  </div>
                  <div className="bo-field">
                    <div className="bo-label">Cafe incluido</div>
                    <Switch checked={includedCoffee} onCheckedChange={setIncludedCoffee} />
                  </div>
                  <div className="bo-field bo-field--full">
                    <div className="bo-label">Comentarios</div>
                    <textarea className="bo-input bo-textarea" value={comments.join("\n")} onChange={(e) => setComments(e.target.value.split("\n").filter((line) => line.trim() !== ""))} placeholder="Añade comentarios..." rows={2} style={{ minHeight: "60px", resize: "vertical" }} />
                  </div>
                </div>
              </motion.div>
            ) : null}

            {isDraft ? (
              <div className="bo-menuWizardActions bo-menuWizardActions--publishDraft">
                <button className="bo-btn bo-btn--primary" type="button" disabled={busy} onClick={() => void onPublish()}>
                  {busy ? "Publicando..." : "Publicar borrador"}
                </button>
              </div>
            ) : null}
          </motion.div>

          <MenuPreview
            previewThemeLoading={previewThemeLoading}
            previewNeedsUpgrade={previewNeedsUpgrade}
            previewThemeLabel={previewThemeLabel}
            previewThemeId={previewThemeId}
            menuType={menuType}
            previewMenuPayload={previewMenuPayload}
            previewUrl={previewUrl}
            mobileTab={mobileTab}
            onMobileTabChange={setMobileTab}
            previewFrameRef={previewFrameRef}
          />
        </div>
      ) : null}

      {/* Step 4: Special Menu Image */}
      {step === 4 && isSpecial ? (
        <div className="bo-menuWizardPanel">
          <h2 className="bo-sectionTitle">Imagen del menu</h2>
          <p className="bo-mutedText" style={{ marginBottom: 16 }}>
            Sube una imagen del menu especial para mostrarla en la plantilla web.
          </p>
          {renderSpecialMenuImageUploadArea()}
          <div className="bo-menuWizardActions">
            <button className="bo-btn bo-btn--ghost" type="button" onClick={() => setStep(1)}>Volver</button>
            <button className="bo-btn bo-btn--primary" type="button" onClick={() => setStep(3)}>Continuar al editor</button>
          </div>
        </div>
      ) : null}

      {/* Hidden file inputs */}
      <input ref={dishImageInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="bo-hiddenFileInput" onChange={onDishImageFileSelected} />
      <input ref={menuPreviewImageInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="bo-hiddenFileInput" onChange={onMenuPreviewImageFileSelected} />
      <input ref={specialMenuImageInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain" className="bo-hiddenFileInput" onChange={onSpecialMenuImageFileSelected} />

      {/* Dish image advisor modal */}
      <DishImageAdvisorModalComponent
        open={!!dishImageAdvisorDraft}
        imageUrl={dishImageAdvisorDraft?.objectUrl || ""}
        imageKB={dishImageAdvisorPreviewKB}
        busy={dishImageAdvisorBusy}
        subjectLabel="plato"
        onClose={() => closeDishImageAdvisor()}
        onContinueWithoutAI={moveDishImageAdvisorToCrop}
        onImproveWithAI={() => void onDishImageAdvisorImprove()}
      />

      {/* Dish image crop modal */}
      <DishImageCropModalComponent
        open={!!dishImageCropDraft}
        imageUrl={dishImageCropDraft?.objectUrl || ""}
        busy={dishImageBusy}
        onClose={() => closeDishImageCropper()}
        onConfirm={(payload) => void onDishImageCropConfirm(payload)}
      />

      {/* Menu preview image advisor modal */}
      <DishImageAdvisorModalComponent
        open={!!menuPreviewImageAdvisorDraft}
        imageUrl={menuPreviewImageAdvisorDraft?.objectUrl || ""}
        imageKB={menuPreviewImageAdvisorPreviewKB}
        busy={menuPreviewImageAdvisorBusy}
        subjectLabel="la portada del menu"
        onClose={closeMenuPreviewImageAdvisor}
        onContinueWithoutAI={moveMenuPreviewImageAdvisorToCrop}
        onImproveWithAI={() => void onMenuPreviewImageAdvisorImprove()}
      />

      {/* Menu preview image crop modal */}
      <DishImageCropModalComponent
        open={!!menuPreviewImageCropDraft}
        imageUrl={menuPreviewImageCropDraft?.objectUrl || ""}
        busy={menuPreviewImageCropBusy}
        onClose={closeMenuPreviewImageCropper}
        onConfirm={(payload) => void onMenuPreviewImageCropConfirm(payload)}
      />

      {/* Allergen modal */}
      <Modal open={!!allergenModal?.open} title="Alergenos" onClose={() => setAllergenModal(null)} widthPx={620}>
        <div className="bo-modalHead">
          <div className="bo-modalTitle">Selecciona alergenos</div>
          <button className="bo-modalX" type="button" onClick={() => setAllergenModal(null)} aria-label="Cerrar">×</button>
        </div>
        <div className="bo-modalBody">
          <div className="bo-allergenGrid">
            {ALLERGENS.map((item) => {
              const open = allergenModal;
              if (!open) return null;
              const sec = sections.find((s) => s.clientId === open.sectionClientId);
              const dish = sec?.dishes.find((d) => d.clientId === open.dishClientId);
              const selected = !!dish?.allergens.includes(item.key);
              const Icon = item.icon;
              return (
                <button
                  key={item.key}
                  type="button"
                  className={`bo-allergenCircle ${selected ? "is-selected" : ""}`}
                  onClick={() => {
                    if (!dish) return;
                    const set = new Set(dish.allergens);
                    if (set.has(item.key)) set.delete(item.key);
                    else set.add(item.key);
                    updateDish(open.sectionClientId, open.dishClientId, { allergens: Array.from(set) });
                  }}
                >
                  <span className="bo-allergenCircleIcon"><Icon size={16} /></span>
                  <span className="bo-allergenCircleLabel">{item.key}</span>
                </button>
              );
            })}
          </div>
        </div>
      </Modal>
    </section>
  );
}
