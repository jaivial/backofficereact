import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Beer,
  Check,
  ChevronDown,
  ChevronUp,
  CupSoda,
  Droplets,
  Eye,
  GripVertical,
  Martini,
  Plus,
  Settings2,
  Trash2,
  Upload,
  Wine,
} from "lucide-react";
import { motion } from "motion/react";
import { Reorder } from "motion/react";
import { useDragControls } from "motion/react";
import { usePageContext } from "vike-react/usePageContext";

import { useToasts } from "../../../../ui/feedback/useToasts";
import { useErrorToast } from "../../../../ui/feedback/useErrorToast";
import { LoadingSpinner } from "../../../../ui/feedback/LoadingSpinner";
import { Select } from "../../../../ui/inputs/Select";
import { Switch } from "../../../../ui/shadcn/Switch";
import { Modal } from "../../../../ui/overlays/Modal";
import { ModalHeader } from "../../../../ui/overlays/ModalHeader";
import { Panel } from "../../../../ui/shell/Panel";
import { PlusMinusCounter } from "../../../../ui/widgets/PlusMinusCounter";
import { Tabs } from "../../../../ui/nav/Tabs";
import { Breadcrumbs } from "../../../../ui/nav/Breadcrumbs";
import { ConfirmDialog } from "../../../../ui/overlays/ConfirmDialog";

import { useMenuEditor } from "./hooks/useMenuEditor";
import { MenuPreview } from "./functionalComponents/MenuPreview/MenuPreview";
import { MenuPublishPanel } from "./functionalComponents/MenuPublishPanel/MenuPublishPanel";
import { MenuSliderPanel, deriveSliderPreview } from "./functionalComponents/MenuSliderPanel/MenuSliderPanel";
import type { SliderPreviewState } from "./functionalComponents/MenuSliderPanel/MenuSliderPanel";
import { MenuPricing } from "./functionalComponents/MenuPricing/MenuPricing";
import { MenuSectionEditor } from "./functionalComponents/MenuSectionEditor/MenuSectionEditor";
import { DishImageAdvisorModalComponent } from "./functionalComponents/DishImageAdvisorModal/DishImageAdvisorModal";
import { ALLERGENS, beverageTypeOptions, dishVisibilityOptions, menuPreviewVisibilityOptions, menuTypeOptions, MENU_TYPES } from "./constants/menuEditor.constants";
import { menuTypeFullLabel, menuTypeQuerySlug } from "../../../../ui/widgets/menus/menuPresentation";
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
    <Modal open={open} title="Recortar imagen" onClose={busy ? () => undefined : onClose} widthPx={620} hideClose>
      <ModalHeader title="Recorte 1:1" onClose={busy ? () => undefined : onClose} />
      <div className="bo-modalBody bo-dishCropBody" data-slot="crear-dishCropBody">
        <div className="bo-dishCropViewportWrap" data-slot="crear-dishCropViewportWrap">
          <div
            ref={viewportRef}
            className="bo-dishCropViewport"
            data-slot="crear-dishCropViewport"
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
            <div className="bo-dishCropFrame" aria-hidden="true" data-slot="crear-dishCropFrame" />
          </div>
        </div>
        <div className="bo-dishCropControls" data-slot="crear-dishCropControls">
          <button className="bo-btn bo-btn--ghost bo-btn--sm" type="button" onClick={() => applyZoom(zoom - 0.1)} disabled={busy} data-testid="menu-crear-zoom-out">-</button>
          <input className="bo-dishCropRange" type="range" min={1} max={4} step={0.01} value={zoom} onChange={(event) => applyZoom(Number(event.target.value))} disabled={busy} aria-label="Control de zoom" data-testid="menu-crear-zoom-slider" />
          <button className="bo-btn bo-btn--ghost bo-btn--sm" type="button" onClick={() => applyZoom(zoom + 0.1)} disabled={busy} data-testid="menu-crear-zoom-in">+</button>
          <button className="bo-btn bo-btn--ghost bo-btn--sm" type="button" onClick={() => { setOffset({ x: 0, y: 0 }); setZoom(1); }} disabled={busy} data-testid="menu-crear-zoom-reset">Reset</button>
        </div>
      </div>
      <div className="bo-modalActions" data-slot="crear-modalActions">
        <button className="bo-btn bo-btn--ghost" type="button" onClick={onClose} disabled={busy} data-testid="menu-crear-cancel-crop">Cancelar</button>
        <button className="bo-btn bo-btn--primary" type="button" onClick={() => onConfirm({ zoom, offsetX: offset.x, offsetY: offset.y, viewportSize })} disabled={busy || viewportSize <= 0} data-testid="menu-crear-save-crop">
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

export function CrearPage({ onClose }: { onClose?: () => void } = {}) {
  const H = useMenuEditor();
  useErrorToast(H.error);

  const {
    error, initialSlider, menuId, isDraft, step, menuType, title, price, subtitles, active, showDishImages,
    showMenuPreviewImage, sections, includedCoffee, beverageType, beveragePrice, beverageHasSupplement,
    beverageOptions, beverageModalOpen, beverageDeleteTarget,
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
    refreshBeverageOptions, setBeverageOptionSelected, createBeverageOption,
    requestBeverageOptionDelete, confirmBeverageOptionDelete, cancelBeverageOptionDelete, closeBeverageModal,
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
    menuAIDishesById, loadingSectionTitles, toggleSameDayBooking,
  } = H;

  const { pushToast } = useToasts();
  const pageContext = usePageContext();
  const initialEditorTab: "platos" | "configuracion" =
    pageContext.urlParsed?.search?.tab === "configuracion" ? "configuracion" : "platos";
  const [editorTab, setEditorTab] = useState<"platos" | "configuracion">(initialEditorTab);
  const [pendingDishDelete, setPendingDishDelete] = useState<{ sectionClientId: string; dishClientId: string; dishLabel: string } | null>(null);

  const requestDishDelete = useCallback((sectionClientId: string, dishClientId: string, dishLabel: string) => {
    setPendingDishDelete({ sectionClientId, dishClientId, dishLabel });
  }, []);

  const [sliderPreview, setSliderPreview] = useState<SliderPreviewState>(() => deriveSliderPreview(initialSlider));
  const sliderPreviewMenuPayload = useMemo(
    () => ({ ...previewMenuPayload, slider_mode: sliderPreview.mode, slider_images: sliderPreview.images }),
    [previewMenuPayload, sliderPreview],
  );

  useEffect(() => {
    const win = previewFrameRef.current?.contentWindow;
    if (!win || previewThemeLoading || previewNeedsUpgrade) return;
    win.postMessage({ type: "vc_preview:update", theme_id: previewThemeId, menu_type: menuType || "closed_conventional", menu: sliderPreviewMenuPayload }, "*");
  }, [menuType, previewFrameRef, previewNeedsUpgrade, previewThemeId, previewThemeLoading, sliderPreviewMenuPayload]);

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
    <section className="bo-menuWizardPage" aria-label="Editor de menu" data-testid="menu-crear-page">
      <Breadcrumbs
        items={[
          { label: "Menus", href: `/app/menus?menutype=${encodeURIComponent(menuTypeQuerySlug(menuType))}` },
          { label: menuTypeFullLabel(menuType), href: `/app/menus?menutype=${encodeURIComponent(menuTypeQuerySlug(menuType))}` },
          { label: title.trim() || "Nuevo menu" },
        ]}
        className="bo-menuWizardBreadcrumbs"
      />
      <div className={`bo-saveTag is-${saveState}`} data-slot="crear-div">
        {saveState === "saving" ? "Guardando..." : saveState === "saved" ? "Guardado" : saveState === "error" ? "Error guardando" : ""}
      </div>

      {step !== 3 || isDraft ? (
        <div className="bo-stepBars" role="progressbar" aria-valuemin={1} aria-valuemax={4} aria-valuenow={step + 1} data-testid="menu-crear-step-progress">
          {[0, 1, 2, 3].map((idx) => (
            <div key={idx} className={`bo-stepBar ${idx === step ? "is-active" : ""} ${idx < step ? "is-done" : ""}`} data-testid={`menu-crear-step-bar-${idx}`} />
          ))}
        </div>
      ) : null}

      {/* Step 0: Menu Type Selection */}
      {step === 0 ? (
        <div className="bo-menuWizardPanel" data-slot="crear-menuWizardPanel">
          <h2 className="bo-sectionTitle" data-slot="menu-crear-tipo-menu">Tipo de menu</h2>
          <p className="bo-typeIntro" data-slot="crear-typeIntro">Elige una base para empezar. Luego podras editar todos los detalles del menu.</p>
          <div className="bo-typeGrid" data-slot="crear-typeGrid">
            {H.isSpecial !== undefined && menuTypeOptions.map((opt) => {
              const optData = MENU_TYPES.find((p) => p.value === opt.value) ?? MENU_TYPES[0];
              const Icon = optData.icon || Settings2;
              const isSelected = menuType === opt.value;
              return (
                <button
                  key={opt.value}
                  className={`bo-panel bo-typeCard ${isSelected ? "is-selected" : ""}`}
                  type="button"
                  disabled={!optData.enabled || busy}
                  onClick={() => setMenuType(opt.value)}
                  aria-pressed={isSelected}
                  data-testid={`menu-crear-type-card-${opt.value}`}
                >
                  <div className="bo-typeCardTop" data-slot="crear-typeCardTop">
                    <div className="bo-typeIconWrap" aria-hidden="true" data-slot="crear-typeIconWrap"><Icon size={18} /></div>
                    <div className={`bo-typeState ${isSelected ? "is-selected" : ""}`} data-slot="crear-div">
                      {isSelected ? <Check size={13} /> : null}
                      {isSelected ? "Seleccionado" : "Plantilla"}
                    </div>
                  </div>
                  <div className="bo-typeTitle" data-slot="crear-typeTitle">{opt.label}</div>
                  <div className="bo-typeDesc" data-slot="crear-typeDesc">{optData.description}</div>
                  <div className="bo-typeHint" data-slot="crear-typeHint">{optData.hint}</div>
                </button>
              );
            })}
          </div>
          <div className="bo-menuWizardActions bo-menuWizardActions--right" data-slot="crear-menuWizardActions--right">
            <button className="bo-btn bo-btn--primary" type="button" disabled={busy} onClick={() => void createDraftAndContinue()} data-testid="menu-crear-continue-type">
              Continuar
            </button>
          </div>
        </div>
      ) : null}

      {/* Step 1: Basic Data */}
      {step === 1 ? (
        <div className="bo-menuWizardPanel" data-slot="crear-menuWizardPanel">
          <h2 className="bo-sectionTitle" data-slot="menu-crear-datos-basicos">Datos basicos</h2>
          <div className="bo-form bo-form--menuWizard bo-form--menuWizardBasics" data-slot="crear-form--menuWizardBasics">
            <div className={`bo-menuBasicsMainRow ${hasSecondaryBasicsField ? "" : "is-single"}`} data-slot="crear-div">
              <div className="bo-field bo-menuBasicsField bo-menuBasicsField--title" data-slot="crear-menuBasicsField--title">
                <div className="bo-label" data-slot="crear-label">Titulo</div>
                <input className="bo-input" value={title} onChange={(e) => setTitle(e.target.value)} data-testid="menu-crear-title-input" />
              </div>
              {!isALaCarte && !isSpecial ? (
                <div className="bo-field bo-menuBasicsField bo-menuBasicsField--price" data-slot="crear-menuBasicsField--price">
                  <div className="bo-label" data-slot="crear-label">Precio</div>
                  <input className="bo-input" value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" data-testid="menu-crear-price-input" />
                </div>
              ) : null}
            </div>

            {!isSpecial ? (
              <div className="bo-field bo-field--full" data-slot="crear-field--full">
                <div className="bo-label" data-slot="crear-label">Subtitulos</div>
                <div className="bo-stackFields" data-slot="crear-stackFields">
                  {subtitles.map((line, idx) => (
                    <div key={`subtitle-${idx}`} className="bo-inlineField" data-slot="crear-inlineField">
                      <input className="bo-input" value={line} onChange={(e) => { const next = [...subtitles]; next[idx] = e.target.value; setSubtitles(next); }} data-testid={`menu-crear-subtitle-input-${idx}`} />
                      <button className="bo-btn bo-btn--ghost bo-inlineFieldIconBtn" type="button" aria-label={`Eliminar subtitulo ${idx + 1}`} disabled={subtitles.length <= 1} onClick={() => setSubtitles((prev) => prev.filter((_, i) => i !== idx))} data-testid={`menu-crear-subtitle-delete-${idx}`}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                  <button className="bo-btn bo-btn--ghost bo-btn--sm bo-subtitleAddBtn" type="button" onClick={() => setSubtitles((prev) => [...prev, ""])} data-testid="menu-crear-subtitle-add">
                    <Plus size={14} /> Añadir subtitulo
                  </button>
                </div>
              </div>
            ) : null}

            {!isSpecial ? (
              <div className="bo-field" data-slot="crear-field">
                <div className="bo-label" data-slot="crear-label">Cambiar tipo de menu</div>
                <Select className="bo-menuSettingSelect" value={menuType} onChange={setMenuType} options={menuTypeOptions} size="sm" ariaLabel="Seleccionar tipo de menu" />
              </div>
            ) : null}

            <div className="bo-menuBasicsSwitchRow" data-slot="crear-menuBasicsSwitchRow">
              <div className="bo-field" data-slot="crear-field">
                <div className="bo-label" data-slot="crear-label">Añadir foto preview</div>
                <Select className="bo-menuSettingSelect" value={showMenuPreviewImage ? "with_preview" : "without_preview"} onChange={(value) => setShowMenuPreviewImage(value === "with_preview")} options={menuPreviewVisibilityOptions} size="sm" ariaLabel="Visibilidad de foto preview" />
              </div>
            </div>

            {renderMenuPreviewUploadArea()}

            <div className="bo-menuBasicsSwitchRow" data-slot="crear-menuBasicsSwitchRow">
              <label className="bo-menuBasicsActiveToggle" data-slot="menu-crear-activo-label">
                <span className="bo-label" data-slot="crear-label">Activo</span>
                <Switch checked={active} onCheckedChange={setActive} />
                <span className="bo-mutedText" data-slot="crear-mutedText">{active ? "Activo" : "No activo"}</span>
              </label>
            </div>
          </div>

          <div className="bo-menuWizardActions bo-menuWizardActions--centered" data-slot="crear-menuWizardActions">
            <button className="bo-btn bo-btn--ghost bo-menuWizardActionsBack" type="button" onClick={() => setStep(0)} data-testid="menu-crear-step1-back">Volver</button>
            <button
              className="bo-btn bo-btn--primary" type="button"
              onClick={() => {
                if (!title.trim()) { pushToast({ kind: "error", title: "Titulo", message: "El titulo es obligatorio" }); return; }
                if (isSpecial) setStep(4);
                else setStep(2);
              }}
              data-testid="menu-crear-step1-continue"
            >
              Continuar
            </button>
          </div>
        </div>
      ) : null}

      {/* Step 2: Sections */}
      {step === 2 ? (
        <div className="bo-menuWizardPanel" data-slot="crear-menuWizardPanel">
          <h2 className="bo-sectionTitle" data-slot="menu-crear-secciones-menu">Secciones del menu</h2>
          <Reorder.Group axis="y" values={sectionOrder} onReorder={reorderSections} className="bo-sectionsBoard bo-reorderGroup">
            {sections.map((sec, idx) => (
              <ReorderSectionDragWrapper key={sec.clientId} value={sec.clientId} className="bo-sectionCard bo-reorderItem">
                {(startDrag) => (
                  <div className="bo-sectionCardHead" data-slot="crear-sectionCardHead">
                    <div className="bo-sectionReorder" data-slot="crear-sectionReorder">
                      <div className="bo-sectionMoveControls" data-slot="crear-sectionMoveControls">
                        <motion.button className="bo-sectionMoveBtn" type="button" aria-label={`Subir seccion ${sec.title || idx + 1}`} disabled={idx === 0} whileHover={chevronHover} whileTap={chevronTapUp} onPointerDown={(event) => event.stopPropagation()} onClick={() => moveSection(idx, idx - 1)} data-testid={`menu-crear-section-move-up-${idx}`}>
                          <ChevronUp size={14} />
                        </motion.button>
                        <motion.button className="bo-sectionMoveBtn" type="button" aria-label={`Bajar seccion ${sec.title || idx + 1}`} disabled={idx === sections.length - 1} whileHover={chevronHover} whileTap={chevronTapDown} onPointerDown={(event) => event.stopPropagation()} onClick={() => moveSection(idx, idx + 1)} data-testid={`menu-crear-section-move-down-${idx}`}>
                          <ChevronDown size={14} />
                        </motion.button>
                      </div>
                      <button className="bo-sectionDrag" type="button" aria-label={`Arrastrar seccion ${sec.title || idx + 1}`} onPointerDown={(event) => { event.preventDefault(); startDrag(event); }} data-testid={`menu-crear-section-drag-${idx}`}>
                        <GripVertical size={18} />
                      </button>
                    </div>
                    <input className="bo-input" value={sec.title} onChange={(e) => updateSection(sec.clientId, { title: e.target.value })} data-testid={`menu-crear-section-title-input-${idx}`} />
                    <button className="bo-btn bo-btn--ghost" type="button" aria-label={`Eliminar seccion ${sec.title || idx + 1}`} disabled={sections.length <= 1} onClick={() => removeSection(sec.clientId)} data-testid={`menu-crear-section-delete-${idx}`}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </ReorderSectionDragWrapper>
            ))}
          </Reorder.Group>

          <div className="bo-menuWizardActions" data-slot="crear-menuWizardActions">
            <button className="bo-btn bo-btn--ghost" type="button" onClick={addSection} data-testid="menu-crear-add-section">
              <Plus size={14} /> Añadir seccion
            </button>
            <div className="bo-menuWizardActionsRight" data-slot="crear-menuWizardActionsRight">
              <button className="bo-btn bo-btn--ghost" type="button" onClick={() => setStep(1)} data-testid="menu-crear-step2-back">Volver</button>
              <button className="bo-btn bo-btn--primary" type="button" onClick={() => setStep(3)} data-testid="menu-crear-step2-continue">Continuar</button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Step 3: Final Editor */}
      {step === 3 ? (
        <div
          className={[
            "bo-menuWizardFinal",
            editorTab === "configuracion" ? "is-configActive" : "is-platosActive",
            desktopPreviewOpen ? "is-previewOpen" : "is-previewHidden",
            desktopPreviewDocked ? "" : "is-previewUndocked",
          ].filter(Boolean).join(" ")}
          data-slot="menu-crear-final-editor-wrapper"
        >
          <div className="bo-menuEditorTabs" data-testid="menu-crear-editor-tabs">
            <Tabs
              tabs={[
                { id: "platos", label: "Platos", href: "#" },
                { id: "configuracion", label: "Configuracion", href: "#" },
              ]}
              activeId={editorTab}
              ariaLabel="Secciones del editor"
              mode="button"
              onNavigate={(_href, id) => {
                const next: "platos" | "configuracion" = id === "configuracion" ? "configuracion" : "platos";
                setEditorTab(next);
                const url = new URL(window.location.href);
                url.searchParams.set("tab", next);
                window.history.replaceState({}, "", url.pathname + url.search);
              }}
            />
          </div>

          <div className="bo-previewDesktopSwitch" data-testid="menu-crear-preview-toggle">
            <span className="bo-previewDesktopSwitchLabel" data-slot="crear-previewDesktopSwitchLabel"><Eye size={14} aria-hidden="true" /> Preview web</span>
            <Switch checked={desktopPreviewOpen} onCheckedChange={setDesktopPreviewOpen} aria-label={desktopPreviewOpen ? "Ocultar preview web" : "Mostrar preview web"} data-testid="menu-crear-preview-switch" />
          </div>

          <motion.div layout transition={paneLayoutTransition} className={`bo-editorPane bo-editorPane--platos ${mobileTab === "editor" ? "is-mobileActive" : ""}`} data-testid="menu-crear-editor-pane">
            {isSpecial ? (
              <Panel className="bo-accordionSection bo-sectionsEditor" data-slot="crear-sectionsEditor" title="Contenido del menu especial">
                {renderSpecialMenuImageUploadArea()}
              </Panel>
            ) : !hydrated ? (
              <div className="bo-sectionsEditor" aria-live="polite" aria-busy="true" data-slot="crear-sectionsEditor">
                {loadingSectionTitles.map((sectionTitle, idx) => (
                  <Panel key={`section-loading-${idx}`} className="bo-accordionSection" data-slot="crear-accordionSection" title={sectionTitle}>
                    <LoadingSpinner centered size="sm" label="Cargando platos..." />
                  </Panel>
                ))}
              </div>
            ) : (
              <>
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
                    requestDishDelete={requestDishDelete}
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
                    toggleSameDayBooking={toggleSameDayBooking}
                  />
                ))}                </Reorder.Group>
                <div className="bo-menuWizardActions bo-menuWizardActions--platosAddSection" data-testid="menu-crear-platos-add-section-row">
                  <button className="bo-btn bo-btn--ghost" type="button" onClick={addSection} data-testid="menu-crear-platos-add-section">
                    <Plus size={14} /> Añadir seccion
                  </button>
                </div>
              </>
            )}

            {isDraft ? (
              <div className="bo-menuWizardActions bo-menuWizardActions--publishDraft" data-testid="menu-crear-publish-panel">
                <button className="bo-btn bo-btn--primary" type="button" disabled={busy} onClick={() => void onPublish()} data-testid="menu-crear-publish-btn">
                  {busy ? "Publicando..." : "Publicar borrador"}
                </button>
              </div>
            ) : null}
          </motion.div>

          <motion.div layout transition={paneLayoutTransition} className={`bo-editorPane bo-editorPane--config ${editorTab === "configuracion" ? "is-mobileActive" : ""}`} data-testid="menu-crear-editor-pane-config">
              <motion.div layout transition={paneLayoutTransition} className="bo-panel bo-menuEditorHead" data-testid="menu-crear-editor-panel">
                <div className="bo-panelHead" data-slot="crear-panelHead">
                  <div data-slot="crear-div">
                    <div className="bo-panelTitle" data-slot="crear-panelTitle">Editor de menu</div>
                    <div className="bo-panelMeta" data-slot="crear-panelMeta">Titulo, subtitulos, precio y estado siguen editables</div>
                  </div>
                </div>
                <div className="bo-panelBody bo-form bo-form--menuWizard bo-form--menuWizardBasics" data-slot="crear-form--menuWizardBasics">
                  <div className={`bo-menuBasicsMainRow ${hasSecondaryBasicsField ? "" : "is-single"}`} data-slot="crear-div">
                    <div className="bo-field bo-menuBasicsField bo-menuBasicsField--title" data-slot="crear-menuBasicsField--title">
                      <div className="bo-label" data-slot="crear-label">Titulo</div>
                      <input className="bo-input" value={title} onChange={(e) => setTitle(e.target.value)} data-testid="menu-crear-final-title-input" />
                    </div>
                    {!isALaCarte && !isSpecial ? (
                      <div className="bo-field bo-menuBasicsField bo-menuBasicsField--price" data-slot="crear-menuBasicsField--price">
                        <div className="bo-label" data-slot="crear-label">Precio</div>
                        <input className="bo-input" value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" data-testid="menu-crear-final-price-input" />
                      </div>
                    ) : null}
                  </div>
                  {!isSpecial ? (
                    <div className="bo-field bo-field--full" data-slot="crear-field--full">
                      <div className="bo-label" data-slot="crear-label">Subtitulos</div>
                      <div className="bo-stackFields" data-slot="crear-stackFields">
                        {subtitles.map((line, idx) => (
                          <div key={`subtitle-final-${idx}`} className="bo-inlineField" data-slot="crear-inlineField">
                            <input className="bo-input" value={line} onChange={(e) => { const next = [...subtitles]; next[idx] = e.target.value; setSubtitles(next); }} data-testid={`menu-crear-final-subtitle-input-${idx}`} />
                            <button className="bo-btn bo-btn--ghost bo-inlineFieldIconBtn" type="button" aria-label={`Eliminar subtitulo ${idx + 1}`} disabled={subtitles.length <= 1} onClick={() => setSubtitles((prev) => prev.filter((_, i) => i !== idx))} data-testid={`menu-crear-final-subtitle-delete-${idx}`}>
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ))}
                        <button className="bo-btn bo-btn--ghost bo-btn--sm bo-subtitleAddBtn" type="button" onClick={() => setSubtitles((prev) => [...prev, ""])} data-testid="menu-crear-final-subtitle-add">
                          <Plus size={14} /> Añadir subtitulo
                        </button>
                      </div>
                    </div>
                  ) : null}
                  {!isSpecial ? (
                    <div className="bo-field" data-slot="crear-field">
                      <div className="bo-label" data-slot="crear-label">Visibilidad de platos</div>
                      <Select className="bo-menuSettingSelect" value={showDishImages ? "with_image" : "without_image"} onChange={(value) => setShowDishImages(value === "with_image")} options={dishVisibilityOptions} size="sm" ariaLabel="Visibilidad de platos en preview" />
                    </div>
                  ) : null}
                  {!isSpecial ? <MenuSliderPanel menuId={menuId} initialSlider={initialSlider} onSliderChange={setSliderPreview} /> : null}
                  <div className="bo-field" data-slot="crear-field">
                    <div className="bo-label" data-slot="crear-label">Añadir foto preview</div>
                    <Select className="bo-menuSettingSelect" value={showMenuPreviewImage ? "with_preview" : "without_preview"} onChange={(value) => setShowMenuPreviewImage(value === "with_preview")} options={menuPreviewVisibilityOptions} size="sm" ariaLabel="Visibilidad de foto preview en editor final" />
                  </div>
                  {renderMenuPreviewUploadArea()}
                  {!isSpecial ? (
                    <div className="bo-field" data-slot="crear-field">
                      <div className="bo-label" data-slot="crear-label">Cambiar tipo de menu</div>
                      <Select className="bo-menuSettingSelect" value={menuType} onChange={setMenuType} options={menuTypeOptions} size="sm" ariaLabel="Seleccionar tipo de menu en editor final" />
                    </div>
                  ) : null}
                  <div className="bo-menuBasicsSwitchRow" data-slot="crear-menuBasicsSwitchRow">
                    <label className="bo-menuBasicsActiveToggle" data-slot="menu-crear-activo-label">
                      <span className="bo-label" data-slot="crear-label">Activo</span>
                      <Switch checked={active} onCheckedChange={setActive} />
                      <span className="bo-mutedText" data-slot="crear-mutedText">{active ? "Activo" : "No activo"}</span>
                    </label>
                  </div>
                </div>
              </motion.div>

              {!isSpecial ? (
                <motion.div layout transition={paneLayoutTransition} className="bo-panel bo-settingsPanel">
                  <div className="bo-panelHead" data-slot="crear-panelHead">
                    <div className="bo-panelTitle" data-slot="crear-panelTitle"><Settings2 size={15} /> Configuracion</div>
                  </div>
                  <div className="bo-panelBody bo-form bo-form--menuWizard" data-slot="crear-form--menuWizard">
                    <div className="bo-field" data-slot="crear-field">
                      <div className="bo-label" data-slot="crear-label">Bebida</div>
                      <Select className="bo-menuSettingSelect" value={beverageType} onChange={setBeverageType} options={beverageTypeOptions} size="sm" ariaLabel="Tipo de bebida" />
                    </div>
                    {beverageType === "opcion" || beverageType === "ilimitada" ? (
                      <div className="bo-field" data-slot="crear-field">
                        <div className="bo-label" data-slot="crear-label">Bebidas incluidas</div>
                        <div className="bo-beverageIconRow" data-testid="menu-crear-beverage-icon-row">
                          {beverageOptions.filter((option) => option.selected).map((option) => {
                            const Icon = beverageIconForSlug(option.slug);
                            return (
                              <span
                                key={option.id}
                                className="bo-beverageIconChip is-selected"
                                title={option.name}
                                data-testid={`menu-crear-beverage-icon-${option.slug}`}
                              >
                                <Icon size={16} />
                              </span>
                            );
                          })}
                          <button
                            type="button"
                            className="bo-btn bo-btn--ghost bo-btn--sm bo-beverageAddBtn"
                            onClick={refreshBeverageOptions}
                            data-testid="menu-crear-beverage-add-plus"
                            aria-label="Gestionar bebidas incluidas"
                          >
                            <Plus size={16} />
                          </button>
                        </div>
                      </div>
                    ) : null}
                    {beverageType !== "no_incluida" ? (
                      <div className="bo-field" data-slot="crear-field">
                        <div className="bo-label" data-slot="crear-label">Precio por persona</div>
                        <input className="bo-input" value={beveragePrice} onChange={(e) => setBeveragePrice(e.target.value)} inputMode="decimal" data-testid="menu-crear-beverage-price-input" />
                      </div>
                    ) : null}
                    {beverageType === "ilimitada" ? (
                      <>
                        <div className="bo-field" data-slot="crear-field">
                          <div className="bo-label" data-slot="crear-label">Tiene suplemento</div>
                          <Switch checked={beverageHasSupplement} onCheckedChange={setBeverageHasSupplement} />
                        </div>
                        {beverageHasSupplement ? (
                          <div className="bo-field" data-slot="crear-field">
                            <div className="bo-label" data-slot="crear-label">Valor suplemento</div>
                            <input className="bo-input" value={beverageSupplementPrice} onChange={(e) => setBeverageSupplementPrice(e.target.value)} inputMode="decimal" data-testid="menu-crear-beverage-supplement-price-input" />
                          </div>
                        ) : null}
                      </>
                    ) : null}
                    <div className="bo-field" data-slot="crear-field">
                      <div className="bo-label" data-slot="crear-label">Minimo personas para reservar</div>
                      <input className="bo-input" value={minPartySize} onChange={(e) => setMinPartySize(e.target.value)} inputMode="numeric" data-testid="menu-crear-min-party-size-input" />
                    </div>
                    <div className="bo-field bo-mainLimitGroup" data-slot="crear-field-main-limit-group">
                      <div className="bo-field bo-field--inline" data-slot="crear-field--inline">
                        <div className="bo-label" style={{ marginRight: "auto" }} data-slot="crear-label">Limite maximo de principales por mesa</div>
                        <Switch checked={mainLimit} onCheckedChange={setMainLimit} data-testid="menu-crear-main-limit-switch" />
                      </div>
                      {mainLimit ? (
                        <div className="bo-field bo-mainLimitCounterField" data-slot="crear-field-main-limit-number">
                          <PlusMinusCounter
                            label="Numero maximo de principales por mesa"
                            value={Math.max(1, Number.parseInt(mainLimitNum || "1", 10) || 1)}
                            onDecrease={() => setMainLimitNum(String(Math.max(1, (Number.parseInt(mainLimitNum || "1", 10) || 1) - 1)))}
                            onIncrease={() => setMainLimitNum(String(Math.max(1, (Number.parseInt(mainLimitNum || "1", 10) || 1) + 1)))}
                            canDecrease={(Number.parseInt(mainLimitNum || "1", 10) || 1) > 1}
                            decrementAriaLabel="Reducir numero maximo de principales por mesa"
                            incrementAriaLabel="Aumentar numero maximo de principales por mesa"
                          />
                        </div>
                      ) : null}
                    </div>
                    <div className="bo-field bo-field--inline bo-coffeeField" data-slot="crear-field">
                      <div className="bo-label" data-slot="crear-label">Cafe incluido</div>
                      <Switch checked={includedCoffee} onCheckedChange={setIncludedCoffee} data-testid="menu-crear-coffee-switch" />
                    </div>
                    <div className="bo-field bo-field--full" data-slot="crear-field--full">
                      <div className="bo-label" data-slot="crear-label">Comentarios</div>
                      <textarea className="bo-input bo-textarea" value={comments.join("\n")} onChange={(e) => setComments(e.target.value.split("\n").filter((line) => line.trim() !== ""))} placeholder="Añade comentarios..." rows={2} style={{ minHeight: "60px", resize: "vertical" }} data-testid="menu-crear-comments-textarea" />
                    </div>
                  </div>
                </motion.div>
              ) : null}
            </motion.div>

          <MenuPreview
            previewThemeLoading={previewThemeLoading}
            previewNeedsUpgrade={previewNeedsUpgrade}
            previewThemeLabel={previewThemeLabel}
            previewThemeId={previewThemeId}
            menuType={menuType}
            previewMenuPayload={sliderPreviewMenuPayload}
            previewUrl={previewUrl}
            mobileTab={mobileTab}
            onMobileTabChange={setMobileTab}
            previewFrameRef={previewFrameRef}
          />
        </div>
      ) : null}

      {/* Step 4: Special Menu Image */}
      {step === 4 && isSpecial ? (
        <div className="bo-menuWizardPanel" data-slot="crear-menuWizardPanel">
          <h2 className="bo-sectionTitle" data-slot="menu-crear-imagen-menu">Imagen del menu</h2>
          <p className="bo-mutedText" style={{ marginBottom: 16 }} data-slot="crear-mutedText">
            Sube una imagen del menu especial para mostrarla en la plantilla web.
          </p>
          {renderSpecialMenuImageUploadArea()}
          <div className="bo-menuWizardActions" data-slot="crear-menuWizardActions">
            <button className="bo-btn bo-btn--ghost" type="button" onClick={() => setStep(1)} data-testid="menu-crear-step4-back">Volver</button>
            <button className="bo-btn bo-btn--primary" type="button" onClick={() => setStep(3)} data-testid="menu-crear-step4-continue">Continuar al editor</button>
          </div>
        </div>
      ) : null}

      {/* Hidden file inputs */}
      <input ref={dishImageInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="bo-hiddenFileInput" onChange={onDishImageFileSelected} data-testid="menu-crear-dish-image-input" />
      <input ref={menuPreviewImageInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="bo-hiddenFileInput" onChange={onMenuPreviewImageFileSelected} data-testid="menu-crear-preview-image-input" />
      <input ref={specialMenuImageInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain" className="bo-hiddenFileInput" onChange={onSpecialMenuImageFileSelected} data-testid="menu-crear-special-menu-image-input" />

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

      {/* Beverage options modal (WS-only mutations) */}
      <Modal open={beverageModalOpen} title="Bebidas" onClose={closeBeverageModal} widthPx={620} hideClose>
        <ModalHeader title="Selecciona bebidas" onClose={closeBeverageModal} />
        <div className="bo-modalBody" data-slot="crear-beverageModalBody">
          <div className="bo-allergenGrid" data-testid="menu-crear-beverage-grid">
            {beverageOptions.map((option) => {
              const Icon = beverageIconForSlug(option.slug);
              return (
                <div key={option.id} className="bo-beverageOptionCell" data-testid={`menu-crear-beverage-option-${option.slug}`}>
                  <button
                    type="button"
                    className={`bo-allergenCircle ${option.selected ? "is-selected" : ""}`}
                    onClick={() => setBeverageOptionSelected(option.id, !option.selected)}
                    data-testid={`menu-crear-beverage-toggle-${option.slug}`}
                  >
                    <span className="bo-allergenCircleIcon" data-slot="crear-beverageCircleIcon"><Icon size={16} /></span>
                    <span className="bo-allergenCircleLabel" data-slot="crear-beverageCircleLabel">{option.name}</span>
                  </button>
                  {option.is_custom ? (
                    <button
                      type="button"
                      className="bo-beverageDeleteBtn"
                      aria-label={`Eliminar ${option.name}`}
                      onClick={() => requestBeverageOptionDelete({ id: option.id, name: option.name })}
                      data-testid={`menu-crear-beverage-delete-${option.slug}`}
                    >
                      <Trash2 size={12} />
                    </button>
                  ) : null}
                </div>
              );
            })}
            <BeverageCustomAdd onAdd={createBeverageOption} />
          </div>
        </div>
      </Modal>

      {/* Beverage custom-delete confirmation (over the beverage modal) */}
      <ConfirmDialog
        title="Eliminar bebida"
        message={beverageDeleteTarget
          ? `¿Eliminar "${beverageDeleteTarget.name}"? Se quitará para este restaurante en todos los menús. Esta acción no se puede deshacer.`
          : ""}
        confirmText="Eliminar"
        cancelText="Cancelar"
        danger
        open={!!beverageDeleteTarget}
        onCancel={cancelBeverageOptionDelete}
        onClose={cancelBeverageOptionDelete}
        onConfirm={confirmBeverageOptionDelete}
      />

      {/* Allergen modal */}
      <Modal open={!!allergenModal?.open} title="Alergenos" onClose={() => setAllergenModal(null)} widthPx={620} hideClose>
        <ModalHeader title="Selecciona alergenos" onClose={() => setAllergenModal(null)} />
        <div className="bo-modalBody" data-slot="crear-modalBody">
          <div className="bo-allergenGrid" data-testid="menu-crear-allergen-grid">
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
                  data-testid={`menu-crear-allergen-${item.key}`}
                >
                  <span className="bo-allergenCircleIcon" data-slot="crear-allergenCircleIcon"><Icon size={16} /></span>
                  <span className="bo-allergenCircleLabel" data-slot="crear-allergenCircleLabel">{item.key}</span>
                </button>
              );
            })}
          </div>
        </div>
      </Modal>

      {/* Dish delete confirmation modal */}
      <ConfirmDialog
        title="Eliminar plato"
        message={pendingDishDelete
          ? `¿Eliminar el plato "${pendingDishDelete.dishLabel}" de esta seccion? Esta accion no se puede deshacer.`
          : ""}
        confirmText="Eliminar"
        cancelText="Cancelar"
        danger
        open={!!pendingDishDelete}
        onCancel={() => setPendingDishDelete(null)}
        onClose={() => setPendingDishDelete(null)}
        onConfirm={() => {
          if (!pendingDishDelete) return;
          removeDish(pendingDishDelete.sectionClientId, pendingDishDelete.dishClientId);
          setPendingDishDelete(null);
        }}
      />
    </section>
  );
}

function beverageIconForSlug(slug: string) {
  switch (slug) {
    case "agua":
      return Droplets;
    case "refrescos":
      return CupSoda;
    case "vino":
      return Wine;
    case "cerveza-de-barril":
    case "cerveza-de-tercio":
      return Beer;
    case "sangria":
      return Wine;
    case "martini":
      return Martini;
    default:
      return CupSoda;
  }
}

function BeverageCustomAdd({ onAdd }: { onAdd: (name: string) => void }) {
  const [value, setValue] = useState("");
  return (
    <div className="bo-beverageCustomAdd" data-testid="menu-crear-beverage-custom-add">
      <input
        className="bo-input"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Añadir bebida personalizada"
        data-testid="menu-crear-beverage-custom-input"
      />
      <button
        type="button"
        className="bo-btn bo-btn--ghost bo-btn--sm"
        onClick={() => {
          if (!value.trim()) return;
          onAdd(value.trim());
          setValue("");
        }}
        disabled={!value.trim()}
        data-testid="menu-crear-beverage-custom-confirm"
      >
        <Plus size={14} /> Añadir
      </button>
    </div>
  );
}
