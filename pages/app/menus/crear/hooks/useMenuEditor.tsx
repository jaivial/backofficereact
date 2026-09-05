import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Sparkles, Trash2, Upload } from "lucide-react";
import { usePageContext } from "vike-react/usePageContext";
import { useReducedMotion } from "motion/react";

import { createClient } from "../../../../../api/client";
import type {
  DishCatalogItem,
  GroupMenuV2,
  GroupMenuV2Section,
  MenuSlider,
} from "../../../../../api/types";
import { cropSquareImageToWebp, isSupportedDishImageFile, MAX_DISH_IMAGE_INPUT_BYTES } from "../../../../../lib/dishImageCrop";
import { processSpecialMenuFile } from "../../../../../lib/specialMenuUpload";
import { useToasts } from "../../../../../ui/feedback/useToasts";

import {
  buildBasicsPayload,
  buildMenuAITracker,
  clampDishCropValue,
  getDishPatchFingerprint,
  getSectionsDishFingerprintMap,
  getSectionsDishSyncStateMap,
  getSectionsFingerprint,
  getSectionsStructureFingerprint,
  getSectionsAnnotationsFingerprintMap,
  mapApiDish,
  mapApiMenu,
  mapApiSection,
  mergeDishFromServer,
  mergeMenuAIDishes,
  normalizeMenuPreviewPatch,
  normalizeSectionAnnotations,
  parseLooseBool,
  preprocessDishImageToWebp,
  resolveMenuPreviewState,
  toNumOrNull,
  trackerFromWSPayload,
  trackerMenuPreviewFromWSPayload,
  uid,
  updateMenuAITrackerDish,
  withDishPositions,
  withSectionPositions,
  orderByClientId,
  logMenuAITrace,
  buildGroupMenuAIWSURL,
} from "../helpers/menuEditor.helpers";
import { DEFAULT_BEVERAGE, DISH_IMAGE_AI_MAX_KB } from "../constants/menuEditor.constants";
import type { BeverageOption, BeverageDeleteTarget } from "../types/menuEditor.types";
import { extractBeverageOptionsFromPayload } from "./extractBeverageOptionsFromPayload";
import { buildPreviewMenuPayload } from "./buildPreviewMenuPayload";
import {
  BasicsDraft,
  BasicsPayload,
  DishImageCropConfirm,
  DishImageCropDraft,
  EditorDish,
  EditorSection,
  MenuAIDishTracker,
  MenuPreviewImageDraft,
  MenuPreviewTrackerPatch,
  MenuAITrackerState,
  MenuPreviewResolvedState,
  PersistedEditorDish,
  PersistedEditorSection,
  PreviewThemeConfig,
  SaveState,
  SectionDishSyncState,
} from "../types/menuEditor.types";

export type UseMenuEditorReturn = {
  // State
  error: string | null;
  initialSlider: MenuSlider | null;
  menuId: number | null;
  isDraft: boolean;
  step: number;
  menuType: string;
  title: string;
  price: string;
  subtitles: string[];
  active: boolean;
  showDishImages: boolean;
  showSectionTabs: boolean;
  showMenuPreviewImage: boolean;
  menuPreviewImageUrl: string;
  menuPreviewAIRequested: boolean;
  menuPreviewAIGenerating: boolean;
  sections: EditorSection[];
  includedCoffee: boolean;
  beverageType: string;
  beverageOptions: BeverageOption[];
  beverageModalOpen: boolean;
  beverageDeleteTarget: BeverageDeleteTarget | null;
  beveragePrice: string;
  beverageHasSupplement: boolean;
  beverageSupplementPrice: string;
  minPartySize: string;
  mainLimit: boolean;
  mainLimitNum: string;
  comments: string[];
  specialMenuImage: string | null;
  menuPreviewImageBusy: boolean;
  specialMenuImageBusy: boolean;
  saveState: SaveState;
  busy: boolean;
  hydrated: boolean;
  mobileTab: "editor" | "preview";
  desktopPreviewOpen: boolean;
  desktopPreviewDocked: boolean;
  previewThemeConfig: PreviewThemeConfig | null;
  previewThemeLoading: boolean;
  allergenModal: { open: boolean; sectionClientId: string; dishClientId: string } | null;
  searchTerms: Record<string, string>;
  searchResults: Record<string, DishCatalogItem[]>;
  sectionLoadingState: Record<string, "loading" | "error" | null>;
  menuAITracker: MenuAITrackerState;
  dishImageTarget: { sectionClientId: string; dishClientId: string } | null;
  dishImageAdvisorDraft: DishImageCropDraft | null;
  dishImageAdvisorBusy: boolean;
  dishImageCropDraft: DishImageCropDraft | null;
  dishImageBusy: boolean;
  menuPreviewImageAdvisorDraft: MenuPreviewImageDraft | null;
  menuPreviewImageAdvisorBusy: boolean;
  menuPreviewImageCropDraft: MenuPreviewImageDraft | null;
  menuPreviewImageCropBusy: boolean;

  // Derived
  isALaCarte: boolean;
  isSpecial: boolean;
  hasSecondaryBasicsField: boolean;
  basicsDraft: BasicsDraft;
  basicsPayload: BasicsPayload;
  basicsFingerprint: string;
  sectionsFingerprint: string;
  shouldReduceMotion: boolean;
  sectionOrder: string[];
  menuAIDishesById: Map<number, MenuAIDishTracker>;
  dishImageAdvisorPreviewKB: number;
  menuPreviewImageAdvisorPreviewKB: number;
  loadingSectionTitles: string[];
  previewThemeId: string;
  previewThemeLabel: string;
  previewNeedsUpgrade: boolean;
  previewMenuPayload: Record<string, unknown>;
  previewUrl: string;

  // Refs
  previewFrameRef: React.MutableRefObject<HTMLIFrameElement | null>;
  dishImageInputRef: React.MutableRefObject<HTMLInputElement | null>;
  menuPreviewImageInputRef: React.MutableRefObject<HTMLInputElement | null>;
  specialMenuImageInputRef: React.MutableRefObject<HTMLInputElement | null>;

  // Setters
  setMenuId: (id: number | null) => void;
  setIsDraft: (v: boolean) => void;
  setStep: (step: number) => void;
  setMenuType: (type: string) => void;
  setTitle: (title: string) => void;
  setPrice: (price: string) => void;
  setSubtitles: React.Dispatch<React.SetStateAction<string[]>>;
  setActive: (active: boolean) => void;
  setShowDishImages: (show: boolean) => void;
  setShowSectionTabs: (show: boolean) => void;
  setShowMenuPreviewImage: (show: boolean) => void;
  setMenuPreviewImageUrl: (url: string) => void;
  setMenuPreviewAIRequested: (v: boolean) => void;
  setMenuPreviewAIGenerating: (v: boolean) => void;
  setSections: React.Dispatch<React.SetStateAction<EditorSection[]>>;
  setIncludedCoffee: (v: boolean) => void;
  setBeverageType: (type: string) => void;
  setBeveragePrice: (price: string) => void;
  refreshBeverageOptions: () => void;
  setBeverageOptionSelected: (optionId: number, selected: boolean) => void;
  createBeverageOption: (name: string) => void;
  requestBeverageOptionDelete: (option: BeverageDeleteTarget) => void;
  confirmBeverageOptionDelete: () => void;
  cancelBeverageOptionDelete: () => void;
  closeBeverageModal: () => void;
  setBeverageHasSupplement: (v: boolean) => void;
  setBeverageSupplementPrice: (price: string) => void;
  setMinPartySize: (size: string) => void;
  setMainLimit: (v: boolean) => void;
  setMainLimitNum: (num: string) => void;
  setComments: (comments: string[]) => void;
  setSpecialMenuImage: (img: string | null) => void;
  setSaveState: React.Dispatch<React.SetStateAction<SaveState>>;
  setBusy: (v: boolean) => void;
  setHydrated: (v: boolean) => void;
  setMobileTab: (tab: "editor" | "preview") => void;
  setDesktopPreviewOpen: (v: boolean) => void;
  setDesktopPreviewDocked: (v: boolean) => void;
  setAllergenModal: React.Dispatch<React.SetStateAction<{ open: boolean; sectionClientId: string; dishClientId: string } | null>>;
  setMenuAITracker: React.Dispatch<React.SetStateAction<MenuAITrackerState>>;
  setDishImageTarget: React.Dispatch<React.SetStateAction<{ sectionClientId: string; dishClientId: string } | null>>;
  setDishImageAdvisorDraft: React.Dispatch<React.SetStateAction<DishImageCropDraft | null>>;
  setDishImageAdvisorBusy: React.Dispatch<React.SetStateAction<boolean>>;
  setDishImageCropDraft: React.Dispatch<React.SetStateAction<DishImageCropDraft | null>>;
  setDishImageBusy: React.Dispatch<React.SetStateAction<boolean>>;
  setMenuPreviewImageAdvisorDraft: React.Dispatch<React.SetStateAction<MenuPreviewImageDraft | null>>;
  setMenuPreviewImageAdvisorBusy: React.Dispatch<React.SetStateAction<boolean>>;
  setMenuPreviewImageCropDraft: React.Dispatch<React.SetStateAction<MenuPreviewImageDraft | null>>;
  setMenuPreviewImageCropBusy: React.Dispatch<React.SetStateAction<boolean>>;
  setSearchTerms: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  setSearchResults: React.Dispatch<React.SetStateAction<Record<string, DishCatalogItem[]>>>;
  setSectionLoadingState: React.Dispatch<React.SetStateAction<Record<string, "loading" | "error" | null>>>;
  setSectionLoadedDishes: React.Dispatch<React.SetStateAction<Set<string>>>;
  setMenuPreviewImageBusy: React.Dispatch<React.SetStateAction<boolean>>;
  setSpecialMenuImageBusy: React.Dispatch<React.SetStateAction<boolean>>;

  // Actions
  patchBasics: (opts: { payload: BasicsPayload; fingerprint: string; force?: boolean }) => Promise<void>;
  syncSectionsAndDishes: (opts: { sectionsSnapshot: EditorSection[]; fingerprint: string; force?: boolean }) => Promise<EditorSection[]>;
  applyDishAIState: (dishId: number, patch: Partial<MenuAIDishTracker> & { foto_url?: string | null }) => void;
  applyMenuPreviewAIState: (patch: MenuPreviewTrackerPatch) => void;
  applyAITrackerSnapshot: (rows: MenuAIDishTracker[]) => void;
  createDraftAndContinue: () => Promise<void>;
  addSection: () => void;
  removeSection: (clientId: string) => void;
  updateSection: (clientId: string, patch: Partial<EditorSection>) => void;
  fetchSectionDishes: (clientId: string) => Promise<void>;
  handleSectionToggle: (clientId: string, willExpand: boolean) => void;
  updateSectionAnnotation: (sectionClientId: string, annotationIdx: number, value: string) => void;
  addSectionAnnotation: (sectionClientId: string) => void;
  removeSectionAnnotation: (sectionClientId: string, annotationIdx: number) => void;
  setSectionDescriptionsEnabled: (sectionClientId: string, enabled: boolean) => void;
  moveSection: (from: number, to: number) => void;
  reorderSections: (orderedClientIds: string[]) => void;
  addDish: (sectionClientId: string, fromCatalog?: DishCatalogItem) => void;
  updateDish: (sectionClientId: string, dishClientId: string, patch: Partial<EditorDish>) => void;
  removeDish: (sectionClientId: string, dishClientId: string) => void;
  reorderDishes: (sectionClientId: string, orderedClientIds: string[]) => void;
  handleSearch: (sectionClientId: string, term: string) => void;
  pickDishImage: (sectionClientId: string, dishClientId: string) => void;
  onDishImageFileSelected: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onDishImageAdvisorImprove: () => Promise<void>;
  onDishImageCropConfirm: (crop: DishImageCropConfirm) => Promise<void>;
  onPublish: () => Promise<void>;
  openSpecialMenuImagePicker: () => void;
  onSpecialMenuImageFileSelected: (event: React.ChangeEvent<HTMLInputElement>) => void;
  openMenuPreviewImagePicker: () => void;
  onMenuPreviewImageFileSelected: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onMenuPreviewImageAdvisorImprove: () => Promise<void>;
  onMenuPreviewImageCropConfirm: (crop: DishImageCropConfirm) => Promise<void>;
  resolvePersistedDishTarget: (target: { sectionClientId: string; dishClientId: string }) => Promise<{ section: PersistedEditorSection; dish: PersistedEditorDish }>;
  moveDishImageAdvisorToCrop: () => void;
  moveMenuPreviewImageAdvisorToCrop: () => void;
  requestMenuAITrackerSync: () => void;
  closeDishImageAdvisor: (opts?: { keepTarget?: boolean }) => void;
  closeDishImageCropper: (opts?: { keepTarget?: boolean }) => void;
  closeMenuPreviewImageAdvisor: () => void;
  closeMenuPreviewImageCropper: () => void;
  toggleSameDayBooking: (sectionClientId: string, dishClientId: string, blocked: boolean) => Promise<void>;

  // Render helpers (defined inside the hook for access to state)
  renderMenuPreviewUploadArea: () => React.ReactNode;
  renderSpecialMenuImageUploadArea: () => React.ReactNode;
};

export function useMenuEditor(): UseMenuEditorReturn {
  const pageContext = usePageContext();
  const data = pageContext.data as { menu: GroupMenuV2 | null; slider?: MenuSlider | null; error: string | null };
  const api = useMemo(() => createClient({ baseUrl: "" }), []);
  const { pushToast } = useToasts();
  const initialSlider = data.slider ?? null;
  const initialMenuPreviewState = useMemo(() => resolveMenuPreviewState(data.menu), []);

  const [error, setError] = useState<string | null>(data.error);
  const [menuId, setMenuId] = useState<number | null>(data.menu?.id ?? null);
  const [isDraft, setIsDraft] = useState<boolean>(data.menu?.is_draft ?? false);
  const [step, setStep] = useState<number>(data.menu ? 3 : 0);
  const [menuType, setMenuType] = useState<string>(data.menu?.menu_type || "closed_conventional");
  const [title, setTitle] = useState<string>(data.menu?.menu_title || "");
  const [price, setPrice] = useState<string>(data.menu?.price || "0");
  const [subtitles, setSubtitles] = useState<string[]>(data.menu?.menu_subtitle?.length ? data.menu.menu_subtitle : [""]);
  const [active, setActive] = useState<boolean>(data.menu?.active ?? false);
  const [showDishImages, setShowDishImages] = useState<boolean>(!!data.menu?.show_dish_images);
  // Coordination id: menu_section_tabs_flag (backoffice -> DB -> public API -> preact)
  const [showSectionTabs, setShowSectionTabs] = useState<boolean>(!!data.menu?.show_section_tabs);
  const [showMenuPreviewImage, setShowMenuPreviewImage] = useState<boolean>(initialMenuPreviewState.showMenuPreviewImage);
  const [sections, setSections] = useState<EditorSection[]>([]);
  const [includedCoffee, setIncludedCoffee] = useState<boolean>(false);
  const [beverageType, setBeverageType] = useState<string>(DEFAULT_BEVERAGE.type);
  const [beverageOptions, setBeverageOptions] = useState<BeverageOption[]>([]);
  const [beverageModalOpen, setBeverageModalOpen] = useState(false);
  const [beverageDeleteTarget, setBeverageDeleteTarget] = useState<BeverageDeleteTarget | null>(null);
  const [beveragePrice, setBeveragePrice] = useState<string>("");
  const [beverageHasSupplement, setBeverageHasSupplement] = useState<boolean>(false);
  const [beverageSupplementPrice, setBeverageSupplementPrice] = useState<string>("");
  const [minPartySize, setMinPartySize] = useState<string>("8");
  const [mainLimit, setMainLimit] = useState<boolean>(false);
  const [mainLimitNum, setMainLimitNum] = useState<string>("1");
  const [comments, setComments] = useState<string[]>([""]);
  const [specialMenuImage, setSpecialMenuImage] = useState<string | null>(data.menu?.special_menu_image_url || null);
  const [menuPreviewImageUrl, setMenuPreviewImageUrl] = useState<string>(initialMenuPreviewState.menuPreviewImageUrl);
  const [menuPreviewAIRequested, setMenuPreviewAIRequested] = useState<boolean>(initialMenuPreviewState.menuPreviewAIRequested);
  const [menuPreviewAIGenerating, setMenuPreviewAIGenerating] = useState<boolean>(initialMenuPreviewState.menuPreviewAIGenerating);
  const [menuPreviewImageBusy, setMenuPreviewImageBusy] = useState(false);
  const [specialMenuImageBusy, setSpecialMenuImageBusy] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [busy, setBusy] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [mobileTab, setMobileTab] = useState<"editor" | "preview">("editor");
  const [desktopPreviewOpen, setDesktopPreviewOpen] = useState(data.menu?.editor_preview_open !== false);
  const [desktopPreviewDocked, setDesktopPreviewDocked] = useState(true);
  const [previewThemeConfig, setPreviewThemeConfig] = useState<PreviewThemeConfig | null>(null);
  const [previewThemeLoading, setPreviewThemeLoading] = useState(true);
  const [allergenModal, setAllergenModal] = useState<{ open: boolean; sectionClientId: string; dishClientId: string } | null>(null);
  const [searchTerms, setSearchTerms] = useState<Record<string, string>>({});
  const [searchResults, setSearchResults] = useState<Record<string, DishCatalogItem[]>>({});
  const [sectionLoadingState, setSectionLoadingState] = useState<Record<string, "loading" | "error" | null>>({});
  const [menuAITracker, setMenuAITracker] = useState<MenuAITrackerState>(() => buildMenuAITracker(data.menu));
  const [dishImageTarget, setDishImageTarget] = useState<{ sectionClientId: string; dishClientId: string } | null>(null);
  const [dishImageAdvisorDraft, setDishImageAdvisorDraft] = useState<DishImageCropDraft | null>(null);
  const [dishImageAdvisorBusy, setDishImageAdvisorBusy] = useState(false);
  const [dishImageCropDraft, setDishImageCropDraft] = useState<DishImageCropDraft | null>(null);
  const [dishImageBusy, setDishImageBusy] = useState(false);
  const [menuPreviewImageAdvisorDraft, setMenuPreviewImageAdvisorDraft] = useState<MenuPreviewImageDraft | null>(null);
  const [menuPreviewImageAdvisorBusy, setMenuPreviewImageAdvisorBusy] = useState(false);
  const [menuPreviewImageCropDraft, setMenuPreviewImageCropDraft] = useState<MenuPreviewImageDraft | null>(null);
  const [menuPreviewImageCropBusy, setMenuPreviewImageCropBusy] = useState(false);

  const searchTimerRef = useRef<Record<string, number>>({});
  const dishImageInputRef = useRef<HTMLInputElement | null>(null);
  const menuPreviewImageInputRef = useRef<HTMLInputElement | null>(null);
  const specialMenuImageInputRef = useRef<HTMLInputElement | null>(null);
  const previewDockTimerRef = useRef<number | null>(null);
  const previewFrameRef = useRef<HTMLIFrameElement | null>(null);
  const syncTimerRef = useRef<number | null>(null);
  const annotationsTimerRef = useRef<number | null>(null);
  const basicsTimerRef = useRef<number | null>(null);
  const menuAIWSRetryRef = useRef<number | null>(null);
  const menuAIWSSocketRef = useRef<WebSocket | null>(null);
  const menuAIWSAttemptsRef = useRef(0);
  const beverageWSMenuIdRef = useRef<number | null>(null);
  const menuAIWSAuthToastShownRef = useRef(false);
  const dishImageAdvisorDraftRef = useRef<DishImageCropDraft | null>(null);
  const dishImageCropDraftRef = useRef<DishImageCropDraft | null>(null);
  const menuPreviewImageAdvisorDraftRef = useRef<MenuPreviewImageDraft | null>(null);
  const menuPreviewImageCropDraftRef = useRef<MenuPreviewImageDraft | null>(null);
  const pushToastRef = useRef(pushToast);
  const menuAITrackerRef = useRef<MenuAITrackerState>(menuAITracker);
  const sectionsRef = useRef<EditorSection[]>([]);
  const renderCountRef = useRef(0);
  const lastSavedBasicsRef = useRef<string>("");
  const inFlightBasicsRef = useRef<string | null>(null);
  const lastSavedSectionsRef = useRef<string>("");
  const lastSavedSectionsStructureRef = useRef<string>("");
  const lastSavedSectionDishesRef = useRef<Record<string, string>>({});
  const lastSavedSectionAnnotationsRef = useRef<Record<string, string>>({});
  const lastSavedSectionDishSyncRef = useRef<Record<string, SectionDishSyncState>>({});
  const inFlightSectionsRef = useRef<string | null>(null);
  const inFlightSectionAnnotationsRef = useRef<Record<string, string>>({});
  const syncRequestSeqRef = useRef(0);
  const sameDayBookingBlockedRef = useRef<Set<number>>(new Set());

  const isALaCarte = menuType === "a_la_carte" || menuType === "a_la_carte_group";
  const isSpecial = menuType === "special";
  const hasSecondaryBasicsField = !isALaCarte && !isSpecial;

  const basicsDraft = useMemo<BasicsDraft>(
    () => ({
      title,
      price,
      active,
      menuType,
      subtitles,
      showDishImages,
      showSectionTabs,
      showMenuPreviewImage,
      desktopPreviewOpen,
      includedCoffee,
      beverageType,
      beveragePrice,
      beverageHasSupplement,
      beverageSupplementPrice,
      comments,
      minPartySize,
      mainLimit,
      mainLimitNum,
    }),
    [active, beverageHasSupplement, beveragePrice, beverageSupplementPrice, beverageType, comments, desktopPreviewOpen, includedCoffee, mainLimit, mainLimitNum, menuType, minPartySize, price, showDishImages, showSectionTabs, showMenuPreviewImage, subtitles, title],
  );
  const basicsPayload = useMemo(() => buildBasicsPayload(basicsDraft), [basicsDraft]);
  const basicsFingerprint = useMemo(() => JSON.stringify(basicsPayload), [basicsPayload]);
  const sectionsFingerprint = useMemo(() => getSectionsFingerprint(sections), [sections]);
  const shouldReduceMotion = useReducedMotion() ?? false;
  const sectionOrder = useMemo(() => sections.map((sec) => sec.clientId), [sections]);
  const menuAIDishesById = useMemo(() => {
    const map = new Map<number, MenuAIDishTracker>();
    for (const row of menuAITracker.dishes) {
      if (!row || !Number.isFinite(row.dish_id) || row.dish_id <= 0) continue;
      map.set(row.dish_id, row);
    }
    return map;
  }, [menuAITracker]);
  const dishImageAdvisorPreviewKB = useMemo(
    () => (dishImageAdvisorDraft?.file?.size ? Math.round(dishImageAdvisorDraft.file.size / 1024) : 0),
    [dishImageAdvisorDraft],
  );
  const menuPreviewImageAdvisorPreviewKB = useMemo(
    () => (menuPreviewImageAdvisorDraft?.file?.size ? Math.round(menuPreviewImageAdvisorDraft.file.size / 1024) : 0),
    [menuPreviewImageAdvisorDraft],
  );
  const loadingSectionTitles = useMemo(() => {
    const fromMenu = Array.isArray(data.menu?.sections) ? data.menu.sections : [];
    if (fromMenu.length > 0) {
      return fromMenu.map((section, idx) => section.title?.trim() || `Seccion ${idx + 1}`);
    }
    return ["Entrantes", "Principales", "Postres"];
  }, [data.menu]);

  // Sync refs
  useEffect(() => { sectionsRef.current = sections; }, [sections]);
  useEffect(() => { dishImageAdvisorDraftRef.current = dishImageAdvisorDraft; }, [dishImageAdvisorDraft]);
  useEffect(() => { dishImageCropDraftRef.current = dishImageCropDraft; }, [dishImageCropDraft]);
  useEffect(() => { menuPreviewImageAdvisorDraftRef.current = menuPreviewImageAdvisorDraft; }, [menuPreviewImageAdvisorDraft]);
  useEffect(() => { menuPreviewImageCropDraftRef.current = menuPreviewImageCropDraft; }, [menuPreviewImageCropDraft]);
  useEffect(() => { pushToastRef.current = pushToast; }, [pushToast]);
  useEffect(() => { menuAITrackerRef.current = menuAITracker; }, [menuAITracker]);

  const [sectionLoadedDishes, setSectionLoadedDishes] = useState<Set<string>>(() => {
    const persisted = new Set<string>();
    if (data.menu?.sections) {
      for (const sec of data.menu.sections) {
        if (sec.id) persisted.add(String(sec.id));
      }
    }
    return persisted;
  });

  // --- patchBasics ---
  const patchBasics = useCallback(
    async ({ payload, fingerprint, force = false }: { payload: BasicsPayload; fingerprint: string; force?: boolean }) => {
      if (!menuId) return;
      if (!force && (lastSavedBasicsRef.current === fingerprint || inFlightBasicsRef.current === fingerprint)) return;
      inFlightBasicsRef.current = fingerprint;
      setSaveState("saving");
      try {
        const res = await api.menus.gruposV2.patchBasics(menuId, payload);
        if (!res.success) throw new Error(res.message || "No se pudo guardar");
        lastSavedBasicsRef.current = fingerprint;
        setSaveState("saved");
      } catch (e) {
        setSaveState("error");
        pushToast({ kind: "error", title: "Error", message: e instanceof Error ? e.message : "No se pudo guardar" });
      } finally {
        if (inFlightBasicsRef.current === fingerprint) {
          inFlightBasicsRef.current = null;
        }
      }
    },
    [api, menuId, pushToast],
  );

  // --- syncSectionsAndDishes ---
  const syncSectionsAndDishes = useCallback(
    async ({ sectionsSnapshot, fingerprint, force = false }: { sectionsSnapshot: EditorSection[]; fingerprint: string; force?: boolean }) => {
      if (!menuId || sectionsSnapshot.length === 0) return sectionsSnapshot;
      if (!force && (lastSavedSectionsRef.current === fingerprint || inFlightSectionsRef.current === fingerprint)) {
        return sectionsSnapshot;
      }

      const requestSeq = syncRequestSeqRef.current + 1;
      syncRequestSeqRef.current = requestSeq;
      inFlightSectionsRef.current = fingerprint;
      setSaveState("saving");

      try {
        let rebuilt = sectionsSnapshot.map((section, idx) => ({
          ...section,
          position: idx,
          dishes: section.dishes,
        }));
        let needsStateReconcile = false;

        const shouldSyncStructure = force
          || getSectionsStructureFingerprint(sectionsSnapshot) !== lastSavedSectionsStructureRef.current
          || rebuilt.some((section) => !section.id);

        if (shouldSyncStructure) {
          const structure = rebuilt.map((sec, idx) => ({
            id: sec.id,
            title: sec.title.trim() || "Seccion",
            kind: sec.kind,
            position: idx,
            annotations: normalizeSectionAnnotations(sec.annotations),
          }));
          const resSections = await api.menus.gruposV2.putSections(menuId, structure);
          if (!resSections.success) throw new Error(resSections.message || "No se pudieron guardar las secciones");
          needsStateReconcile = true;
          rebuilt = (resSections.sections || []).map((sec, idx) => {
            const local = rebuilt[idx];
            const mapped = mapApiSection(sec, local);
            mapped.dishes = withDishPositions(local?.dishes || []);
            return mapped;
          });
        }

        const changedSectionClientIds = force
          ? new Set(rebuilt.map((section) => section.clientId))
          : new Set(rebuilt.filter((section) => getSectionsDishFingerprintMap([section])[section.clientId] !== lastSavedSectionDishesRef.current[section.clientId]).map((section) => section.clientId));

        for (const section of rebuilt) {
          if (!section.id || !changedSectionClientIds.has(section.clientId)) continue;

          const previousSectionSyncState = lastSavedSectionDishSyncRef.current[section.clientId];
          const nextSectionSyncState = { order: "", byId: {} }; // placeholder

          const allSectionDishesPersisted = section.dishes.every((dish) => !!dish.id);
          const canSyncBySingleDishPatch = !force && !shouldSyncStructure && !!previousSectionSyncState && allSectionDishesPersisted;

          const sectionSyncState = {
            ids: section.dishes.map((dish) => dish.id || 0),
            byId: {} as Record<string, string>,
          };
          section.dishes.forEach((dish) => {
            if (!dish.id) return;
            sectionSyncState.byId[String(dish.id)] = getDishPatchFingerprint(dish, isALaCarte);
          });
          const order = JSON.stringify(sectionSyncState.ids);
          const currentOrder = previousSectionSyncState ? previousSectionSyncState.order : "";
          const orderChanged = order !== currentOrder;
          if (canSyncBySingleDishPatch && !orderChanged) {
            const changedDishes = section.dishes.filter((dish) => {
              if (!dish.id) return false;
              const dishId = String(dish.id);
              return sectionSyncState.byId[dishId] !== (previousSectionSyncState?.byId[dishId] ?? "");
            });
            const hasUnsupportedPatch = changedDishes.some((dish) => dish.title.trim().length === 0);
            if (!hasUnsupportedPatch && changedDishes.length > 0) {
              for (const dish of changedDishes) {
                if (!dish.id) continue;
                const trimmedTitle = dish.title.trim();
                if (!trimmedTitle) continue;
                const patched = await api.menus.gruposV2.patchSectionDish(menuId, section.id, dish.id, {
                  catalog_dish_id: dish.catalog_dish_id ?? null,
                  title: trimmedTitle,
                  description: dish.description,
                  description_enabled: dish.description_enabled,
                  allergens: dish.allergens,
                  supplement_enabled: dish.supplement_enabled,
                  supplement_price: dish.supplement_price,
                  price: isALaCarte ? dish.price : null,
                  active: dish.active,
                });
                if (!patched.success) throw new Error(patched.message || "No se pudo guardar el plato");
              }
            }
          }

          const payloadDishes: Array<{
            id?: number; catalog_dish_id?: number | null; title: string; description: string; description_enabled: boolean; allergens: string[];
            supplement_enabled: boolean; supplement_price: number | null; price: number | null; active: boolean;
          }> = [];
          const localDishes: EditorDish[] = [];
          let localDishMutated = false;

          for (const dish of section.dishes) {
            const trimmedTitle = dish.title.trim();
            if (!trimmedTitle) continue;
            let catalogId = dish.catalog_dish_id ?? null;
            if (!catalogId && !dish.id) {
              const upsert = await api.menus.dishesCatalog.upsert({
                id: undefined, title: trimmedTitle, description: dish.description.trim(),
                allergens: dish.allergens, default_supplement_enabled: dish.supplement_enabled,
                default_supplement_price: dish.supplement_price,
              });
              if (upsert.success) catalogId = upsert.dish.id;
            }
            if (catalogId && !dish.catalog_dish_id) {
              localDishMutated = true;
              localDishes.push({ ...dish, catalog_dish_id: catalogId });
            } else {
              localDishes.push(dish);
            }
            payloadDishes.push({
              id: dish.id, catalog_dish_id: catalogId, title: trimmedTitle, description: dish.description,
              description_enabled: dish.description_enabled,
              allergens: dish.allergens, supplement_enabled: dish.supplement_enabled,
              supplement_price: dish.supplement_price, price: isALaCarte ? dish.price : null, active: dish.active,
            });
          }

          if (localDishMutated) needsStateReconcile = true;
          section.dishes = withDishPositions(localDishes);

          const saved = await api.menus.gruposV2.putSectionDishes(menuId, section.id, payloadDishes);
          if (!saved.success) throw new Error(saved.message || "No se pudieron guardar los platos");

          const prevByID = new Map<number, EditorDish>();
          section.dishes.forEach((dish) => { if (dish.id) prevByID.set(dish.id, dish); });
          const merged = (saved.dishes || []).map((dish, dishIdx) => {
            const prev = (dish.id ? prevByID.get(dish.id) : undefined) || section.dishes[dishIdx];
            return mergeDishFromServer(prev, dish);
          });
          if (merged.length === section.dishes.length && merged.every((dish, idx) => dish === section.dishes[idx])) {
            // no-op
          } else {
            needsStateReconcile = true;
            section.dishes = merged;
          }
        }

        if (syncRequestSeqRef.current !== requestSeq) return sectionsSnapshot;
        if (needsStateReconcile) setSections(rebuilt);
        const savedSource = needsStateReconcile ? rebuilt : sectionsSnapshot;
        lastSavedSectionsRef.current = needsStateReconcile ? getSectionsFingerprint(savedSource) : fingerprint;
        lastSavedSectionsStructureRef.current = getSectionsStructureFingerprint(savedSource);
        lastSavedSectionDishesRef.current = getSectionsDishFingerprintMap(savedSource);
        lastSavedSectionAnnotationsRef.current = getSectionsAnnotationsFingerprintMap(savedSource);
        lastSavedSectionDishSyncRef.current = getSectionsDishSyncStateMap(savedSource, isALaCarte);
        setSaveState("saved");
        return savedSource;
      } finally {
        if (inFlightSectionsRef.current === fingerprint) inFlightSectionsRef.current = null;
      }
    },
    [api, isALaCarte, menuId],
  );

  // --- useEffect: auto-save basics ---
  useEffect(() => {
    if (!hydrated || !menuId || step < 1) return;
    if (lastSavedBasicsRef.current === basicsFingerprint || inFlightBasicsRef.current === basicsFingerprint) return;
    if (basicsTimerRef.current) window.clearTimeout(basicsTimerRef.current);
    basicsTimerRef.current = window.setTimeout(() => {
      void patchBasics({ payload: basicsPayload, fingerprint: basicsFingerprint });
    }, 500);
    return () => { if (basicsTimerRef.current) window.clearTimeout(basicsTimerRef.current); };
  }, [basicsFingerprint, basicsPayload, hydrated, menuId, patchBasics, step]);

  // --- useEffect: auto-save sections ---
  useEffect(() => {
    if (!hydrated || !menuId || step < 2) return;
    if (lastSavedSectionsRef.current === sectionsFingerprint || inFlightSectionsRef.current === sectionsFingerprint) return;
    const snapshot = sections;
    if (syncTimerRef.current) window.clearTimeout(syncTimerRef.current);
    syncTimerRef.current = window.setTimeout(() => {
      void (async () => {
        try {
          await syncSectionsAndDishes({ sectionsSnapshot: snapshot, fingerprint: sectionsFingerprint });
        } catch (e) {
          setSaveState("error");
          pushToast({ kind: "error", title: "Error", message: e instanceof Error ? e.message : "No se pudo guardar" });
        }
      })();
    }, 700);
    return () => { if (syncTimerRef.current) window.clearTimeout(syncTimerRef.current); };
  }, [hydrated, menuId, pushToast, sections, sectionsFingerprint, step, syncSectionsAndDishes]);

  // --- useEffect: auto-save annotations ---
  useEffect(() => {
    if (!hydrated || !menuId || step < 3) return;
    const changedSections = sections
      .filter((section): section is PersistedEditorSection => !!section.id)
      .map((section) => {
        const annotations = normalizeSectionAnnotations(section.annotations);
        const fingerprint = JSON.stringify(annotations);
        return { id: section.id, clientId: section.clientId, annotations, fingerprint };
      })
      .filter(({ clientId, fingerprint }) => (
        fingerprint !== (lastSavedSectionAnnotationsRef.current[clientId] || "")
        && fingerprint !== (inFlightSectionAnnotationsRef.current[clientId] || "")
      ));

    if (changedSections.length === 0) return;
    if (annotationsTimerRef.current) window.clearTimeout(annotationsTimerRef.current);
    annotationsTimerRef.current = window.setTimeout(() => {
      void (async () => {
        setSaveState("saving");
        for (const section of changedSections) {
          inFlightSectionAnnotationsRef.current[section.clientId] = section.fingerprint;
        }
        try {
          for (const section of changedSections) {
            const res = await api.menus.gruposV2.patchSectionAnnotations(menuId, section.id, section.annotations);
            if (!res.success) throw new Error(res.message || "No se pudieron guardar las anotaciones");
            const persistedFingerprint = JSON.stringify(normalizeSectionAnnotations(res.annotations ?? section.annotations));
            lastSavedSectionAnnotationsRef.current[section.clientId] = persistedFingerprint;
            delete inFlightSectionAnnotationsRef.current[section.clientId];
          }
          setSaveState("saved");
        } catch (e) {
          setSaveState("error");
          pushToast({ kind: "error", title: "Error", message: e instanceof Error ? e.message : "No se pudieron guardar las anotaciones" });
        } finally {
          for (const section of changedSections) {
            if (inFlightSectionAnnotationsRef.current[section.clientId] === section.fingerprint) {
              delete inFlightSectionAnnotationsRef.current[section.clientId];
            }
          }
        }
      })();
    }, 600);
    return () => { if (annotationsTimerRef.current) window.clearTimeout(annotationsTimerRef.current); };
  }, [api, hydrated, menuId, pushToast, sections, step]);

  // --- applyDishAIState ---
  const applyDishAIState = useCallback(
    (dishId: number, patch: Partial<MenuAIDishTracker> & { foto_url?: string | null }) => {
      if (!Number.isFinite(dishId) || dishId <= 0) return;
      setMenuAITracker((prev) => updateMenuAITrackerDish(prev, dishId, patch));
      setSections((prev) => {
        let changed = false;
        const next = prev.map((section) => {
          let sectionChanged = false;
          const dishes = section.dishes.map((dish) => {
            if (dish.id !== dishId) return dish;
            const nextDish: EditorDish = {
              ...dish,
              ai_requested: patch.ai_requested ?? dish.ai_requested,
              ai_generating: patch.ai_generating ?? dish.ai_generating,
              ai_generated_img: patch.ai_generated_img ?? dish.ai_generated_img ?? null,
              foto_url: patch.foto_url ?? (!patch.ai_generating && patch.ai_generated_img ? patch.ai_generated_img : dish.foto_url),
            };
            if (nextDish.ai_requested === dish.ai_requested && nextDish.ai_generating === dish.ai_generating && nextDish.ai_generated_img === dish.ai_generated_img && nextDish.foto_url === dish.foto_url) return dish;
            sectionChanged = true;
            changed = true;
            return nextDish;
          });
          return sectionChanged ? { ...section, dishes } : section;
        });
        return changed ? next : prev;
      });
    },
    [],
  );

  // --- applyMenuPreviewAIState ---
  const applyMenuPreviewAIState = useCallback((patch: MenuPreviewTrackerPatch) => {
    if (patch.show_menu_preview_image !== undefined) {
      setShowMenuPreviewImage((prev) => (prev === patch.show_menu_preview_image ? prev : patch.show_menu_preview_image!));
    }
    if (patch.ai_requested !== undefined) setMenuPreviewAIRequested((prev) => (prev === patch.ai_requested ? prev : patch.ai_requested!));
    if (patch.ai_generating !== undefined) setMenuPreviewAIGenerating((prev) => (prev === patch.ai_generating ? prev : patch.ai_generating!));
    const nextURLRaw = patch.menu_preview_image_url ?? (typeof patch.ai_generated_img === "string" ? patch.ai_generated_img : undefined);
    if (nextURLRaw !== undefined) {
      const nextURL = String(nextURLRaw || "").trim();
      setMenuPreviewImageUrl((prev) => (prev === nextURL ? prev : nextURL));
      if (nextURL) setShowMenuPreviewImage(true);
    }
    if (patch.show_menu_preview_image === undefined && (patch.ai_requested || patch.ai_generating)) {
      setShowMenuPreviewImage(true);
    }
  }, []);

  // --- applyAITrackerSnapshot ---
  const applyAITrackerSnapshot = useCallback((rows: MenuAIDishTracker[]) => {
    if (!rows.length) return;
    const mergedRows = mergeMenuAIDishes(rows);
    const currentByDish = new Map<number, MenuAIDishTracker>();
    for (const row of menuAITrackerRef.current.dishes) {
      if (!Number.isFinite(row.dish_id) || row.dish_id <= 0) continue;
      currentByDish.set(row.dish_id, row);
    }
    const changedDishIds: number[] = [];
    for (const row of mergedRows) {
      const prev = currentByDish.get(row.dish_id);
      if (!prev || prev.ai_requested !== row.ai_requested || prev.ai_generating !== row.ai_generating || prev.ai_generated_img !== row.ai_generated_img) {
        changedDishIds.push(row.dish_id);
      }
    }
    if (changedDishIds.length === 0) return;
    const byDish = new Map<number, MenuAIDishTracker>();
    for (const row of mergedRows) byDish.set(row.dish_id, row);
    setMenuAITracker((prev) => ({ dishes: mergeMenuAIDishes([...prev.dishes, ...mergedRows]) }));
    setSections((prev) => {
      let changed = false;
      const next = prev.map((section) => {
        let sectionChanged = false;
        const dishes = section.dishes.map((dish) => {
          if (!dish.id) return dish;
          const tracked = byDish.get(dish.id);
          if (!tracked) return dish;
          const nextDish: EditorDish = {
            ...dish,
            ai_requested: tracked.ai_requested,
            ai_generating: tracked.ai_generating,
            ai_generated_img: tracked.ai_generated_img ?? null,
            foto_url: (!tracked.ai_generating && tracked.ai_generated_img) ? (tracked.ai_generated_img || dish.foto_url) : dish.foto_url,
          };
          if (nextDish.ai_requested === dish.ai_requested && nextDish.ai_generating === dish.ai_generating && nextDish.ai_generated_img === dish.ai_generated_img && nextDish.foto_url === dish.foto_url) return dish;
          changed = true;
          sectionChanged = true;
          return nextDish;
        });
        return sectionChanged ? { ...section, dishes } : section;
      });
      return changed ? next : prev;
    });
  }, []);

  // --- WebSocket effect ---
  useEffect(() => {
    if (!menuId) return;
    let disposed = false;
    let socket: WebSocket | null = null;

    const parseEventKind = (rawType: string): "started" | "completed" | "failed" | null => {
      const type = rawType.trim().toLowerCase();
      if (!type) return null;
      if (type === "started" || type === "ai_image_started") return "started";
      if (type === "completed" || type === "ai_image_completed") return "completed";
      if (type === "failed" || type === "ai_image_failed") return "failed";
      return null;
    };

    const applyMessageTracker = (payload: unknown) => {
      const rows = trackerFromWSPayload(payload);
      if (rows.length > 0) applyAITrackerSnapshot(rows);
      const previewPatch = trackerMenuPreviewFromWSPayload(payload);
      if (previewPatch) applyMenuPreviewAIState(previewPatch);
    };

    const applyBeverageOptions = (payload: Record<string, unknown>) => {
      const next = extractBeverageOptionsFromPayload(payload);
      setBeverageOptions(next);
      // Named observation point: frontend state updated from a backend frame.
      console.log(`[checkpoint] beverage_options_applied count=${next.length}`);
    };

    const scheduleReconnect = () => {
      if (disposed) return;
      menuAIWSAttemptsRef.current += 1;
      const attempt = menuAIWSAttemptsRef.current;
      const backoffMs = Math.min(12000, 700 * (2 ** Math.max(0, attempt - 1)));
      const jitterMs = Math.round(Math.random() * 280);
      if (menuAIWSRetryRef.current) window.clearTimeout(menuAIWSRetryRef.current);
      menuAIWSRetryRef.current = window.setTimeout(() => {
        if (disposed) return;
        connect();
      }, backoffMs + jitterMs);
    };

    const connect = () => {
      if (disposed) return;
      const wsURL = buildGroupMenuAIWSURL(menuId);
      try {
        socket = new WebSocket(wsURL);
      } catch {
        scheduleReconnect();
        return;
      }
      menuAIWSSocketRef.current = socket;

      socket.addEventListener("open", () => {
        if (disposed) { socket?.close(); return; }
        menuAIWSAttemptsRef.current = 0;
        if (menuAIWSRetryRef.current) window.clearTimeout(menuAIWSRetryRef.current);
      });

      socket.addEventListener("message", (event: MessageEvent) => {
        if (disposed) return;
        let payload: Record<string, unknown> | null = null;
        try { payload = JSON.parse(String(event.data ?? "")) as Record<string, unknown>; } catch { return; }
        const type = String(payload.type ?? "").trim().toLowerCase();
        if (type === "beverage_options" || type === "beverage_error") {
          applyBeverageOptions(payload);
          return;
        }
        if (type === "sync" || type === "ai_update" || type === "tracker_update"
          || type === "hello" || type === "snapshot"
          || type === "preview_image_completed" || type === "preview_image_failed") {
          applyMessageTracker(payload);
          if (Array.isArray(payload.beverage_options)) applyBeverageOptions(payload);
        }
      });

      socket.addEventListener("close", () => {
        if (disposed) return;
        menuAIWSSocketRef.current = null;
        scheduleReconnect();
      });

      socket.addEventListener("error", () => {
        if (disposed) return;
        menuAIWSSocketRef.current = null;
        scheduleReconnect();
      });
    };

    connect();
    return () => {
      disposed = true;
      menuAIWSSocketRef.current = null;
      socket?.close();
      if (menuAIWSRetryRef.current) window.clearTimeout(menuAIWSRetryRef.current);
    };
  }, [menuId, applyAITrackerSnapshot, applyMenuPreviewAIState]);

  // --- Preview Theme ---
  const normalizePreviewThemeId = useCallback((rawThemeId?: string | null): string => {
    const raw = String(rawThemeId || "").trim().toLowerCase();
    if (!raw) return "villa-carmen";
    const alias = raw.replace(/[_\s]+/g, "-").replace(/[^a-z0-9-]/g, "").replace(/-+/g, "-").replace(/^-|-$/g, "");
    const compact = alias.replace(/-/g, "");
    if (alias === "preact-copy" || alias === "preactcopy") return "villa-carmen";
    if (alias === "villa-carmen" || compact === "villacarmen" || compact === "villacaren") return "villa-carmen";
    return alias || "villa-carmen";
  }, []);

  const previewThemeId = useMemo(() => {
    if (!previewThemeConfig) return "villa-carmen";
    const fromOverride = previewThemeConfig.overrides[menuType || "closed_conventional"];
    return normalizePreviewThemeId(fromOverride || previewThemeConfig.default_theme_id || "villa-carmen");
  }, [menuType, normalizePreviewThemeId, previewThemeConfig]);

  const previewThemeLabel = useMemo(() => {
    if (!previewThemeConfig) return "Plantilla no disponible";
    const options = Array.isArray(previewThemeConfig.themes) ? previewThemeConfig.themes : [];
    const match = options.find((theme) => theme.id === previewThemeId);
    return match?.name || previewThemeId;
  }, [previewThemeConfig, previewThemeId]);

  const previewNeedsUpgrade = useMemo(() => {
    if (menuType === "special") return false;
    if (!previewThemeConfig) return false;
    return previewThemeConfig.assigned === false;
  }, [menuType, previewThemeConfig]);

  const previewUrl = "/menu-preview/index.html";

  const previewMenuPayload = useMemo(
    () =>
      buildPreviewMenuPayload({
        menuId,
        title,
        menuType,
        price,
        active,
        subtitles,
        showDishImages,
        showSectionTabs,
        showMenuPreviewImage,
        menuPreviewImageUrl,
        menuPreviewAIRequested,
        menuPreviewAIGenerating,
        beverageType,
        beveragePrice,
        beverageHasSupplement,
        beverageSupplementPrice,
        beverageOptions,
        includedCoffee,
        minPartySize,
        mainLimit,
        mainLimitNum,
        comments,
        specialMenuImage,
        menuAITracker,
        sections,
        normalizeSectionAnnotations,
        menuAIDishesById,
        toNumOrNull,
      }),
    [
      active,
      beverageHasSupplement,
      beverageOptions,
      beveragePrice,
      beverageSupplementPrice,
      beverageType,
      comments,
      includedCoffee,
      mainLimit,
      mainLimitNum,
      menuAIDishesById,
      menuAITracker,
      menuId,
      menuType,
      minPartySize,
      price,
      sections,
      showDishImages,
      showSectionTabs,
      showMenuPreviewImage,
      menuPreviewImageUrl,
      menuPreviewAIRequested,
      menuPreviewAIGenerating,
      specialMenuImage,
      subtitles,
      title,
    ],
  );


  // --- preview theme fetch ---
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setPreviewThemeLoading(true);
      try {
        const res = await api.settings.getWebsiteMenuTemplates();
        if (cancelled || !res.success) return;
        const overrides = (res.overrides as Record<string, string>) || {};
        const assigned = typeof res.assigned === "boolean" ? res.assigned : (Boolean((res.default_theme_id || "").trim()) || Object.keys(overrides).length > 0);
        setPreviewThemeConfig({
          assigned,
          default_theme_id: res.default_theme_id || "villa-carmen",
          overrides,
          themes: Array.isArray(res.themes) ? res.themes : [],
        });
      } catch {
        if (!cancelled) setPreviewThemeConfig(null);
      } finally {
        if (!cancelled) setPreviewThemeLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [api]);

  // Preview updates are sent by CrearPage, which adds hydrated slider data to
  // the payload before posting. Keeping one owner prevents duplicate iframe renders.

  // --- createDraftAndContinue ---
  const createDraftAndContinue = useCallback(async () => {
    setBusy(true);
    try {
      const created = await api.menus.gruposV2.createDraft({ menu_type: menuType });
      if (!created.success) throw new Error(created.message || "No se pudo crear borrador");
      const loaded = await api.menus.gruposV2.get(created.menu_id);
      if (!loaded.success) throw new Error(loaded.message || "No se pudo cargar borrador");
      const mapped = mapApiMenu(loaded.menu);
      const mappedIsALaCarte = mapped.menuType === "a_la_carte" || mapped.menuType === "a_la_carte_group";
      setMenuId(created.menu_id);
      setIsDraft(true);
      setTitle(mapped.title);
      setPrice(mapped.price || "0");
      setActive(mapped.active);
      setSubtitles(mapped.subtitles.length ? mapped.subtitles : [""]);
      setShowDishImages(mapped.showDishImages);
      setShowSectionTabs(mapped.showSectionTabs);
      setShowMenuPreviewImage(mapped.showMenuPreviewImage);
      setDesktopPreviewOpen(mapped.desktopPreviewOpen);
      setMenuPreviewImageUrl(mapped.menuPreviewImageUrl);
      setMenuPreviewAIRequested(mapped.menuPreviewAIRequested);
      setMenuPreviewAIGenerating(mapped.menuPreviewAIGenerating);
      setSections(mapped.sections);
      setMenuAITracker(buildMenuAITracker(loaded.menu, mapped.sections));
      setIncludedCoffee(mapped.settings.included_coffee);
      setBeverageType(mapped.settings.beverage.type);
      setBeveragePrice(mapped.settings.beverage.price_per_person == null ? "" : String(mapped.settings.beverage.price_per_person));
      setBeverageHasSupplement(mapped.settings.beverage.has_supplement);
      setBeverageSupplementPrice(mapped.settings.beverage.supplement_price == null ? "" : String(mapped.settings.beverage.supplement_price));
      setMinPartySize(String(mapped.settings.min_party_size));
      setMainLimit(mapped.settings.main_dishes_limit);
      setMainLimitNum(String(mapped.settings.main_dishes_limit_number));
      setComments(mapped.settings.comments.length ? mapped.settings.comments : [""]);
      const mappedBasicsPayload = buildBasicsPayload({
        title: mapped.title, price: mapped.price || "0", active: mapped.active, menuType: mapped.menuType,
        subtitles: mapped.subtitles.length ? mapped.subtitles : [""], showDishImages: mapped.showDishImages, showSectionTabs: mapped.showSectionTabs,
        showMenuPreviewImage: mapped.showMenuPreviewImage, desktopPreviewOpen: mapped.desktopPreviewOpen,
        includedCoffee: mapped.settings.included_coffee,
        beverageType: mapped.settings.beverage.type,
        beveragePrice: mapped.settings.beverage.price_per_person == null ? "" : String(mapped.settings.beverage.price_per_person),
        beverageHasSupplement: mapped.settings.beverage.has_supplement,
        beverageSupplementPrice: mapped.settings.beverage.supplement_price == null ? "" : String(mapped.settings.beverage.supplement_price),
        comments: mapped.settings.comments.length ? mapped.settings.comments : [""],
        minPartySize: String(mapped.settings.min_party_size),
        mainLimit: mapped.settings.main_dishes_limit,
        mainLimitNum: String(mapped.settings.main_dishes_limit_number),
      });
      lastSavedBasicsRef.current = JSON.stringify(mappedBasicsPayload);
      inFlightBasicsRef.current = null;
      lastSavedSectionsRef.current = getSectionsFingerprint(mapped.sections);
      lastSavedSectionsStructureRef.current = getSectionsStructureFingerprint(mapped.sections);
      lastSavedSectionDishesRef.current = getSectionsDishFingerprintMap(mapped.sections);
      lastSavedSectionAnnotationsRef.current = getSectionsAnnotationsFingerprintMap(mapped.sections);
      lastSavedSectionDishSyncRef.current = getSectionsDishSyncStateMap(mapped.sections, mappedIsALaCarte);
      inFlightSectionsRef.current = null;
      inFlightSectionAnnotationsRef.current = {};
      syncRequestSeqRef.current = 0;
      setSaveState("idle");
      window.history.replaceState({}, "", `/app/comida/menus/crear?menuId=${created.menu_id}`);
      setStep(1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo crear borrador");
    } finally {
      setBusy(false);
    }
  }, [api, menuType]);

  // --- addSection ---
  const addSection = useCallback(() => {
    setSections((prev) => [
      ...prev,
      { clientId: uid("section"), title: "Nueva seccion", kind: "custom", position: prev.length, annotations: [""], dishes: [], expanded: true },
    ]);
  }, []);

  // --- removeSection ---
  const removeSection = useCallback((clientId: string) => {
    setSections((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((s) => s.clientId !== clientId).map((s, i) => ({ ...s, position: i }));
    });
  }, []);

  // --- updateSection ---
  const updateSection = useCallback((clientId: string, patch: Partial<EditorSection>) => {
    setSections((prev) => {
      let changed = false;
      const next = prev.map((sec) => {
        if (sec.clientId !== clientId) return sec;
        for (const [k, v] of Object.entries(patch) as Array<[keyof EditorSection, EditorSection[keyof EditorSection]]>) {
          if (!Object.is(sec[k], v)) { changed = true; return { ...sec, ...patch }; }
        }
        return sec;
      });
      return changed ? next : prev;
    });
  }, []);

  // --- fetchSectionDishes ---
  const fetchSectionDishes = useCallback(
    async (clientId: string) => {
      const section = sections.find((s) => s.clientId === clientId);
      if (!section || !section.id || !menuId) return;
      const cacheKey = String(section.id);
      if (sectionLoadedDishes.has(cacheKey)) return;
      if (sectionLoadingState[clientId] === "loading") return;
      setSectionLoadingState((prev) => ({ ...prev, [clientId]: "loading" }));
      try {
        const res = await api.menus.gruposV2.getSectionDishes(menuId, section.id);
        if (res.success && res.dishes) {
          setSections((prev) => prev.map((sec) => {
            if (sec.clientId !== clientId) return sec;
            return {
              ...sec,
              dishes: sec.dishes.map((existingDish) => {
                const updated = res.dishes.find((d: GroupMenuV2Section["dishes"][number]) => d.id === existingDish.id);
                return updated ? mapApiDish(updated, existingDish) : existingDish;
              }),
            };
          }));
          setSectionLoadedDishes((prev) => new Set(prev).add(cacheKey));
          setSectionLoadingState((prev) => ({ ...prev, [clientId]: null }));
        } else {
          setSectionLoadingState((prev) => ({ ...prev, [clientId]: "error" }));
          pushToast({ kind: "error", title: "Error", message: res.success ? "No se pudieron cargar los platos" : (res.message || "No se pudieron cargar los platos") });
        }
      } catch (err) {
        setSectionLoadingState((prev) => ({ ...prev, [clientId]: "error" }));
        pushToast({ kind: "error", title: "Error", message: err instanceof Error ? err.message : "Error al cargar platos" });
      }
    },
    [api, menuId, pushToast, sections, sectionLoadedDishes, sectionLoadingState],
  );

  // --- handleSectionToggle ---
  const handleSectionToggle = useCallback(
    (clientId: string, willExpand: boolean) => {
      if (willExpand) {
        const section = sections.find((s) => s.clientId === clientId);
        if (section?.id && menuId) {
          const cacheKey = String(section.id);
          if (!sectionLoadedDishes.has(cacheKey)) fetchSectionDishes(clientId);
        }
      }
      updateSection(clientId, { expanded: willExpand });
    },
    [sections, menuId, sectionLoadedDishes, fetchSectionDishes, updateSection],
  );

  // --- updateSectionAnnotation ---
  const updateSectionAnnotation = useCallback((sectionClientId: string, annotationIdx: number, value: string) => {
    setSections((prev) => {
      let changed = false;
      const next = prev.map((sec) => {
        if (sec.clientId !== sectionClientId) return sec;
        if (annotationIdx < 0 || annotationIdx >= sec.annotations.length) return sec;
        if (sec.annotations[annotationIdx] === value) return sec;
        const annotations = [...sec.annotations];
        annotations[annotationIdx] = value;
        changed = true;
        return { ...sec, annotations };
      });
      return changed ? next : prev;
    });
  }, []);

  // --- addSectionAnnotation ---
  const addSectionAnnotation = useCallback((sectionClientId: string) => {
    setSections((prev) => prev.map((sec) => {
      if (sec.clientId !== sectionClientId) return sec;
      return { ...sec, annotations: [...sec.annotations, ""] };
    }));
  }, []);

  // --- removeSectionAnnotation ---
  const removeSectionAnnotation = useCallback((sectionClientId: string, annotationIdx: number) => {
    setSections((prev) => prev.map((sec) => {
      if (sec.clientId !== sectionClientId) return sec;
      if (sec.annotations.length <= 1) return sec;
      if (annotationIdx < 0 || annotationIdx >= sec.annotations.length) return sec;
      const annotations = sec.annotations.filter((_, idx) => idx !== annotationIdx);
      return { ...sec, annotations: annotations.length > 0 ? annotations : [""] };
    }));
  }, []);

  // Coordination id: menu-section-description-enabled-v1. Switching the section off
  // cascades to every dish of that section and clears the description text, exactly as
  // the per-dish switch does, so both entry points leave the same state behind.
  const setSectionDescriptionsEnabled = useCallback((sectionClientId: string, enabled: boolean) => {
    setSections((prev) => {
      let changed = false;
      const next = prev.map((sec) => {
        if (sec.clientId !== sectionClientId) return sec;
        let sectionChanged = false;
        const dishes = sec.dishes.map((dish) => {
          if (dish.description_enabled === enabled) return dish;
          sectionChanged = true;
          return { ...dish, description_enabled: enabled, description: enabled ? dish.description : "" };
        });
        if (!sectionChanged) return sec;
        changed = true;
        return { ...sec, dishes };
      });
      return changed ? next : prev;
    });
  }, []);

  // --- moveSection ---
  const moveSection = useCallback((from: number, to: number) => {
    if (from === to) return;
    setSections((prev) => {
      if (from < 0 || from >= prev.length || to < 0 || to >= prev.length) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return withSectionPositions(next);
    });
  }, []);

  // --- reorderSections ---
  const reorderSections = useCallback((orderedClientIds: string[]) => {
    setSections((prev) => {
      if (orderedClientIds.length === prev.length && prev.every((section, idx) => section.clientId === orderedClientIds[idx])) return prev;
      return withSectionPositions(orderByClientId(prev, orderedClientIds));
    });
  }, []);

  // --- addDish ---
  const addDish = useCallback((sectionClientId: string, fromCatalog?: DishCatalogItem) => {
    setSections((prev) => prev.map((sec) => {
      if (sec.clientId !== sectionClientId) return sec;
      const dish: EditorDish = {
        clientId: uid("dish"),
        id: undefined,
        // comida_items IDs are not menu_dishes_catalog IDs; persist a snapshot instead.
        catalog_dish_id: undefined,
        title: fromCatalog?.title || "Nuevo plato",
        description: fromCatalog?.description || "",
        description_enabled: (fromCatalog?.description || "").trim().length > 0,
        allergens: fromCatalog?.allergens || [],
        supplement_enabled: fromCatalog?.default_supplement_enabled || false,
        supplement_price: fromCatalog?.default_supplement_price ?? null,
        price: isALaCarte ? 0 : null,
        active: true,
        position: sec.dishes.length,
        foto_url: fromCatalog?.foto_url || fromCatalog?.image_url,
        ai_requested: false,
        ai_generating: false,
        ai_generated_img: null,
      };
      return { ...sec, dishes: [...sec.dishes, dish] };
    }));
  }, [isALaCarte]);

  // --- updateDish ---
  const updateDish = useCallback((sectionClientId: string, dishClientId: string, patch: Partial<EditorDish>) => {
    setSections((prev) => {
      let changed = false;
      const next = prev.map((sec) => {
        if (sec.clientId !== sectionClientId) return sec;
        let dishChanged = false;
        const dishes = sec.dishes.map((dish) => {
          if (dish.clientId !== dishClientId) return dish;
          for (const [k, v] of Object.entries(patch) as Array<[keyof EditorDish, EditorDish[keyof EditorDish]]>) {
            if (!Object.is(dish[k], v)) { dishChanged = true; return { ...dish, ...patch }; }
          }
          return dish;
        });
        if (!dishChanged) return sec;
        changed = true;
        return { ...sec, dishes };
      });
      return changed ? next : prev;
    });
  }, []);

  // --- removeDish ---
  const removeDish = useCallback((sectionClientId: string, dishClientId: string) => {
    setSections((prev) => prev.map((sec) => {
      if (sec.clientId !== sectionClientId) return sec;
      return { ...sec, dishes: sec.dishes.filter((dish) => dish.clientId !== dishClientId).map((dish, idx) => ({ ...dish, position: idx })) };
    }));
  }, []);

  // --- reorderDishes ---
  const reorderDishes = useCallback((sectionClientId: string, orderedClientIds: string[]) => {
    setSections((prev) => prev.map((sec) => {
      if (sec.clientId !== sectionClientId) return sec;
      if (orderedClientIds.length === sec.dishes.length && sec.dishes.every((dish, idx) => dish.clientId === orderedClientIds[idx])) return sec;
      return { ...sec, dishes: withDishPositions(orderByClientId(sec.dishes, orderedClientIds)) };
    }));
  }, []);

  // --- handleSearch ---
  const handleSearch = useCallback(
    (sectionClientId: string, term: string) => {
      setSearchTerms((prev) => ({ ...prev, [sectionClientId]: term }));
      const existing = searchTimerRef.current[sectionClientId];
      if (existing) window.clearTimeout(existing);
      if (term.trim().length < 2) { setSearchResults((prev) => ({ ...prev, [sectionClientId]: [] })); return; }
      searchTimerRef.current[sectionClientId] = window.setTimeout(() => {
        void (async () => {
          const res = await api.menus.dishesCatalog.search(term.trim(), 8);
          if (!res.success) return;
          setSearchResults((prev) => ({ ...prev, [sectionClientId]: res.items }));
        })();
      }, 240);
    },
    [api],
  );

  // --- pickDishImage ---
  const pickDishImage = useCallback((sectionClientId: string, dishClientId: string) => {
    setDishImageTarget({ sectionClientId, dishClientId });
    const input = dishImageInputRef.current;
    if (!input) return;
    input.value = "";
    input.click();
  }, []);

  // --- onDishImageFileSelected ---
  const onDishImageFileSelected = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.currentTarget.value = "";
      if (!file || !dishImageTarget) return;
      if (!isSupportedDishImageFile(file)) { pushToast({ kind: "error", title: "Error", message: "Formato no soportado. Usa JPG, PNG, WEBP o GIF." }); return; }
      if (file.size > MAX_DISH_IMAGE_INPUT_BYTES) { pushToast({ kind: "error", title: "Error", message: "La imagen excede 15MB." }); return; }
      const nextTarget = { ...dishImageTarget };
      setDishImageAdvisorBusy(true);
      closeDishImageCropper({ keepTarget: true });
      closeDishImageAdvisor({ keepTarget: true });
      void (async () => {
        try {
          const preprocessed = await preprocessDishImageToWebp(file, DISH_IMAGE_AI_MAX_KB);
          const objectUrl = URL.createObjectURL(preprocessed);
          setDishImageAdvisorDraft((prev) => {
            if (prev?.objectUrl) URL.revokeObjectURL(prev.objectUrl);
            return { sectionClientId: nextTarget.sectionClientId, dishClientId: nextTarget.dishClientId, file: preprocessed, objectUrl };
          });
        } catch (error) {
          pushToast({ kind: "error", title: "Error", message: error instanceof Error ? error.message : "No se pudo procesar la imagen" });
          setDishImageTarget(null);
        } finally {
          setDishImageAdvisorBusy(false);
        }
      })();
    },
    [dishImageTarget, pushToast],
  );

  // --- resolvePersistedDishTarget ---
  const resolvePersistedDishTarget = useCallback(
    async (target: { sectionClientId: string; dishClientId: string }): Promise<{ section: PersistedEditorSection; dish: PersistedEditorDish }> => {
      let latestSections = sectionsRef.current;
      let section = latestSections.find((row) => row.clientId === target.sectionClientId);
      let dish = section?.dishes.find((row) => row.clientId === target.dishClientId);
      if (!section || !dish) throw new Error("No se encontro el plato seleccionado");
      if (!section.id || !dish.id) {
        const synced = await syncSectionsAndDishes({ sectionsSnapshot: latestSections, fingerprint: getSectionsFingerprint(latestSections), force: true });
        if (Array.isArray(synced)) latestSections = synced;
        section = latestSections.find((row) => row.clientId === target.sectionClientId);
        dish = section?.dishes.find((row) => row.clientId === target.dishClientId);
      }
      if (!section?.id || !dish?.id) throw new Error("Guarda el plato antes de subir la imagen");
      return { section: section as PersistedEditorSection, dish: dish as PersistedEditorDish };
    },
    [syncSectionsAndDishes],
  );

  // --- onDishImageAdvisorImprove ---
  const onDishImageAdvisorImprove = useCallback(async () => {
    if (!dishImageAdvisorDraft || !menuId) return;
    const draft = dishImageAdvisorDraft;
    setDishImageAdvisorBusy(true);
    let targetDishId: number | null = null;
    try {
      const { section, dish } = await resolvePersistedDishTarget({ sectionClientId: draft.sectionClientId, dishClientId: draft.dishClientId });
      targetDishId = dish.id;
      applyDishAIState(dish.id, { ai_requested: true, ai_generating: true });
      const res = await api.menus.gruposV2.uploadSectionDishImageAI(menuId, section.id, dish.id, draft.file);
      if (!res.success) throw new Error(res.message || "No se pudo iniciar la mejora con IA");
      closeDishImageAdvisor();
      requestMenuAITrackerSync();
      pushToast({ kind: "success", title: "Mejora iniciada", message: "La imagen se esta procesando con IA en segundo plano." });
    } catch (error) {
      if (targetDishId) applyDishAIState(targetDishId, { ai_generating: false });
      pushToast({ kind: "error", title: "Error", message: error instanceof Error ? error.message : "No se pudo iniciar la mejora con IA" });
    } finally {
      setDishImageAdvisorBusy(false);
    }
  }, [api, applyDishAIState, dishImageAdvisorDraft, menuId, pushToast, resolvePersistedDishTarget]);

  // --- onDishImageCropConfirm ---
  const onDishImageCropConfirm = useCallback(
    async (crop: DishImageCropConfirm) => {
      if (!dishImageCropDraft || !menuId) return;
      setDishImageBusy(true);
      try {
        const webpFile = await cropSquareImageToWebp(dishImageCropDraft.file, { ...crop, outputSizePx: 1024, maxSizeKB: 150 });
        const { section, dish } = await resolvePersistedDishTarget({ sectionClientId: dishImageCropDraft.sectionClientId, dishClientId: dishImageCropDraft.dishClientId });
        const res = await api.menus.gruposV2.uploadSectionDishImage(menuId, section.id, dish.id, webpFile);
        if (!res.success) throw new Error(res.message || "No se pudo subir la imagen");
        updateDish(dishImageCropDraft.sectionClientId, dishImageCropDraft.dishClientId, { foto_url: res.dish?.foto_url || res.dish?.image_url || undefined });
        closeDishImageCropper();
        pushToast({ kind: "success", title: "Imagen actualizada", message: `Imagen optimizada (${Math.max(1, Math.round(webpFile.size / 1024))}KB)` });
      } catch (error) {
        pushToast({ kind: "error", title: "Error", message: error instanceof Error ? error.message : "No se pudo actualizar la imagen" });
      } finally {
        setDishImageBusy(false);
      }
    },
    [api, dishImageCropDraft, menuId, pushToast, resolvePersistedDishTarget, updateDish],
  );

  // --- onPublish ---
  const onPublish = useCallback(async () => {
    if (!menuId) return;
    setBusy(true);
    try {
      await patchBasics({ payload: basicsPayload, fingerprint: basicsFingerprint, force: true });
      await syncSectionsAndDishes({ sectionsSnapshot: sections, fingerprint: sectionsFingerprint, force: true });
      const res = await api.menus.gruposV2.publish(menuId);
      if (!res.success) throw new Error(res.message || "No se pudo publicar");
      setIsDraft(false);
      pushToast({ kind: "success", title: "Menu publicado", message: "El menu se ha publicado correctamente" });
    } catch (e) {
      pushToast({ kind: "error", title: "Error", message: e instanceof Error ? e.message : "No se pudo publicar" });
    } finally {
      setBusy(false);
    }
  }, [api, basicsFingerprint, basicsPayload, menuId, patchBasics, pushToast, sections, sectionsFingerprint, syncSectionsAndDishes]);

  // --- openSpecialMenuImagePicker ---
  const openSpecialMenuImagePicker = useCallback(() => {
    if (!menuId || specialMenuImageBusy || busy) return;
    const input = specialMenuImageInputRef.current;
    if (!input) return;
    input.value = "";
    input.click();
  }, [busy, menuId, specialMenuImageBusy]);

  // --- onSpecialMenuImageFileSelected ---
  const onSpecialMenuImageFileSelected = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFile = event.target.files?.[0];
      event.currentTarget.value = "";
      if (!selectedFile) return;
      if (!menuId) { pushToast({ kind: "error", title: "Error", message: "Guarda primero el menu para subir imagen." }); return; }
      setSpecialMenuImageBusy(true);
      setSaveState("saving");
      void (async () => {
        try {
          const { file } = await processSpecialMenuFile(selectedFile);
          const res = await api.menus.gruposV2.uploadSpecialMenuImage(menuId, file);
          if (!res.success) throw new Error(res.message || "No se pudo subir la imagen del menu especial");
          const imageUrl = String(res.imageUrl || "").trim();
          if (!imageUrl) throw new Error("No se recibio la URL de la imagen subida");
          setSpecialMenuImage(imageUrl);
          setSaveState("saved");
          pushToast({ kind: "success", title: "Imagen actualizada", message: "Imagen del menu especial subida correctamente." });
        } catch (error) {
          setSaveState("error");
          pushToast({ kind: "error", title: "Error", message: error instanceof Error ? error.message : "No se pudo subir la imagen del menu especial" });
        } finally {
          setSpecialMenuImageBusy(false);
        }
      })();
    },
    [api, menuId, pushToast],
  );

  // --- openMenuPreviewImagePicker ---
  const openMenuPreviewImagePicker = useCallback(() => {
    const input = menuPreviewImageInputRef.current;
    if (!input) return;
    input.value = "";
    input.click();
  }, []);

  // --- onMenuPreviewImageFileSelected ---
  const onMenuPreviewImageFileSelected = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.currentTarget.value = "";
      if (!file) return;
      if (!menuId) { pushToast({ kind: "error", title: "Error", message: "Guarda primero el menú para subir imagen." }); return; }
      if (!isSupportedDishImageFile(file)) { pushToast({ kind: "error", title: "Error", message: "Formato no soportado. Usa JPG, PNG, WEBP o GIF." }); return; }
      if (file.size > MAX_DISH_IMAGE_INPUT_BYTES) { pushToast({ kind: "error", title: "Error", message: "La imagen excede 15MB." }); return; }
      setShowMenuPreviewImage(true);
      setMenuPreviewImageBusy(true);
      closeMenuPreviewImageCropper();
      closeMenuPreviewImageAdvisor();
      setMenuPreviewImageAdvisorBusy(true);
      void (async () => {
        try {
          const preprocessed = await preprocessDishImageToWebp(file, DISH_IMAGE_AI_MAX_KB);
          const objectUrl = URL.createObjectURL(preprocessed);
          setMenuPreviewImageAdvisorDraft((prev) => {
            if (prev?.objectUrl) URL.revokeObjectURL(prev.objectUrl);
            return { file: preprocessed, objectUrl };
          });
        } catch (error) {
          pushToast({ kind: "error", title: "Error", message: error instanceof Error ? error.message : "No se pudo procesar la imagen" });
        } finally {
          setMenuPreviewImageAdvisorBusy(false);
          setMenuPreviewImageBusy(false);
        }
      })();
    },
    [menuId, pushToast],
  );

  // --- onMenuPreviewImageAdvisorImprove ---
  const onMenuPreviewImageAdvisorImprove = useCallback(async () => {
    if (!menuPreviewImageAdvisorDraft || !menuId) return;
    setMenuPreviewImageAdvisorBusy(true);
    setMenuPreviewImageBusy(true);
    setSaveState("saving");
    applyMenuPreviewAIState({ show_menu_preview_image: true, ai_requested: true, ai_generating: true });
    try {
      const res = await api.menus.gruposV2.uploadMenuPreviewImageAI(menuId, menuPreviewImageAdvisorDraft.file);
      if (!res.success) throw new Error(res.message || "No se pudo iniciar la mejora con IA");
      closeMenuPreviewImageAdvisor();
      requestMenuAITrackerSync();
      setSaveState("saved");
      pushToast({ kind: "success", title: "Mejora iniciada", message: "La imagen preview se esta procesando con IA en segundo plano." });
    } catch (error) {
      applyMenuPreviewAIState({ ai_generating: false });
      setSaveState("error");
      pushToast({ kind: "error", title: "Error", message: error instanceof Error ? error.message : "No se pudo iniciar la mejora con IA" });
    } finally {
      setMenuPreviewImageAdvisorBusy(false);
      setMenuPreviewImageBusy(false);
    }
  }, [api, applyMenuPreviewAIState, menuId, menuPreviewImageAdvisorDraft, pushToast]);

  // --- onMenuPreviewImageCropConfirm ---
  const onMenuPreviewImageCropConfirm = useCallback(
    async (crop: DishImageCropConfirm) => {
      if (!menuPreviewImageCropDraft || !menuId) return;
      setMenuPreviewImageCropBusy(true);
      setMenuPreviewImageBusy(true);
      setSaveState("saving");
      try {
        const webpFile = await cropSquareImageToWebp(menuPreviewImageCropDraft.file, { ...crop, outputSizePx: 1024, maxSizeKB: 150 });
        const res = await api.menus.gruposV2.uploadMenuPreviewImage(menuId, webpFile);
        if (!res.success) throw new Error(res.message || "No se pudo subir la imagen");
        applyMenuPreviewAIState({ show_menu_preview_image: true, menu_preview_image_url: res.imageUrl || "", ai_requested: false, ai_generating: false, ai_generated_img: res.imageUrl || null });
        closeMenuPreviewImageCropper();
        setSaveState("saved");
        pushToast({ kind: "success", title: "Imagen actualizada", message: `Imagen optimizada (${Math.max(1, Math.round(webpFile.size / 1024))}KB)` });
      } catch (error) {
        setSaveState("error");
        pushToast({ kind: "error", title: "Error", message: error instanceof Error ? error.message : "No se pudo actualizar la imagen" });
      } finally {
        setMenuPreviewImageCropBusy(false);
        setMenuPreviewImageBusy(false);
      }
    },
    [api, applyMenuPreviewAIState, menuId, menuPreviewImageCropDraft, pushToast],
  );

  // --- moveDishImageAdvisorToCrop ---
  const moveDishImageAdvisorToCrop = useCallback(() => {
    setDishImageAdvisorDraft((advisorDraft) => {
      if (!advisorDraft) return null;
      setDishImageCropDraft((prevCrop) => {
        if (prevCrop?.objectUrl && prevCrop.objectUrl !== advisorDraft.objectUrl) URL.revokeObjectURL(prevCrop.objectUrl);
        return advisorDraft;
      });
      return null;
    });
    setDishImageAdvisorBusy(false);
  }, []);

  // --- moveMenuPreviewImageAdvisorToCrop ---
  const moveMenuPreviewImageAdvisorToCrop = useCallback(() => {
    setMenuPreviewImageAdvisorDraft((advisorDraft) => {
      if (!advisorDraft) return null;
      setMenuPreviewImageCropDraft((prevCrop) => {
        if (prevCrop?.objectUrl && prevCrop.objectUrl !== advisorDraft.objectUrl) URL.revokeObjectURL(prevCrop.objectUrl);
        return advisorDraft;
      });
      return null;
    });
    setMenuPreviewImageAdvisorBusy(false);
  }, []);

  // --- requestMenuAITrackerSync ---
  const requestMenuAITrackerSync = useCallback(() => {
    const ws = menuAIWSSocketRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN || !menuId) return;
    try { ws.send(JSON.stringify({ type: "sync", menuId })); } catch { /* ignore */ }
  }, [menuId]);

  // --- Beverage options: WS-only mutations (no REST) ---
  const sendBeverageMessage = useCallback((message: Record<string, unknown>) => {
    const ws = menuAIWSSocketRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN || !menuId) {
      pushToast({ kind: "error", title: "Error", message: "Conexion no disponible. Intentalo de nuevo." });
      return;
    }
    beverageWSMenuIdRef.current = menuId;
    let correlationId = "";
    try { correlationId = window.sessionStorage.getItem("vcCorrelationId") || ""; } catch { correlationId = ""; }
    try { ws.send(JSON.stringify({ ...message, menu_id: menuId, correlation_id: correlationId })); } catch { /* ignore */ }
    // Named observation point: frontend sent a websocket mutation.
    console.log(`[checkpoint] beverage_ws_sent type=${String(message.type ?? "")} menu_id=${menuId}`);
  }, [menuId, pushToast]);

  const refreshBeverageOptions = useCallback(() => {
    setBeverageModalOpen(true);
    sendBeverageMessage({ type: "beverage_refresh" });
  }, [sendBeverageMessage]);

  const setBeverageOptionSelected = useCallback((optionId: number, selected: boolean) => {
    setBeverageOptions((prev) => prev.map((option) => (option.id === optionId ? { ...option, selected } : option)));
    sendBeverageMessage({ type: "beverage_set", option_id: optionId, selected });
  }, [sendBeverageMessage]);

  const createBeverageOption = useCallback((name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    sendBeverageMessage({ type: "beverage_create", name: trimmed });
  }, [sendBeverageMessage]);

  const requestBeverageOptionDelete = useCallback((option: BeverageDeleteTarget) => {
    setBeverageDeleteTarget(option);
  }, []);

  const confirmBeverageOptionDelete = useCallback(() => {
    if (!beverageDeleteTarget) return;
    sendBeverageMessage({ type: "beverage_delete", option_id: beverageDeleteTarget.id });
    setBeverageDeleteTarget(null);
  }, [beverageDeleteTarget, sendBeverageMessage]);

  const cancelBeverageOptionDelete = useCallback(() => {
    setBeverageDeleteTarget(null);
  }, []);

  const closeBeverageModal = useCallback(() => {
    setBeverageModalOpen(false);
  }, []);

  // --- closeDishImageAdvisor ---
  const closeDishImageAdvisor = useCallback((opts?: { keepTarget?: boolean }) => {
    setDishImageAdvisorDraft((prev) => { if (prev?.objectUrl) URL.revokeObjectURL(prev.objectUrl); return null; });
    setDishImageAdvisorBusy(false);
    if (!opts?.keepTarget) setDishImageTarget(null);
  }, []);

  // --- closeDishImageCropper ---
  const closeDishImageCropper = useCallback((opts?: { keepTarget?: boolean }) => {
    setDishImageCropDraft((prev) => { if (prev?.objectUrl) URL.revokeObjectURL(prev.objectUrl); return null; });
    setDishImageBusy(false);
    if (!opts?.keepTarget) setDishImageTarget(null);
  }, []);

  // --- closeMenuPreviewImageAdvisor ---
  const closeMenuPreviewImageAdvisor = useCallback(() => {
    setMenuPreviewImageAdvisorDraft((prev) => { if (prev?.objectUrl) URL.revokeObjectURL(prev.objectUrl); return null; });
    setMenuPreviewImageAdvisorBusy(false);
  }, []);

  // --- closeMenuPreviewImageCropper ---
  const closeMenuPreviewImageCropper = useCallback(() => {
    setMenuPreviewImageCropDraft((prev) => { if (prev?.objectUrl) URL.revokeObjectURL(prev.objectUrl); return null; });
    setMenuPreviewImageCropBusy(false);
  }, []);

  // --- toggleSameDayBooking ---
  const toggleSameDayBooking = useCallback(
    async (sectionClientId: string, dishClientId: string, blocked: boolean) => {
      const snapshot = sectionsRef.current;
      let targetDishId: number | undefined;
      for (const sec of snapshot) {
        for (const d of sec.dishes) {
          if (d.clientId === dishClientId) { targetDishId = d.id; break; }
        }
        if (targetDishId) break;
      }
      if (!menuId || !targetDishId) return;

      setSections((prev) => {
        let changed = false;
        const next = prev.map((sec) => {
          if (sec.clientId !== sectionClientId) return sec;
          const dishes = sec.dishes.map((d) => {
            if (d.clientId !== dishClientId) return d;
            changed = true;
            return { ...d, same_day_booking_blocked: blocked };
          });
          return changed ? { ...sec, dishes } : sec;
        });
        return changed ? next : prev;
      });

      try {
        if (blocked) {
          const res = await api.menus.gruposV2.setSameDayBookingBlocked(menuId, targetDishId);
          if (!res.success) throw new Error(res.message || "No se pudo bloquear la reserva mismo dia");
          sameDayBookingBlockedRef.current = new Set(sameDayBookingBlockedRef.current).add(targetDishId);
        } else {
          const res = await api.menus.gruposV2.setSameDayBookingAllowed(menuId, targetDishId);
          if (!res.success) throw new Error(res.message || "No se pudo desbloquear la reserva mismo dia");
          const next = new Set(sameDayBookingBlockedRef.current);
          next.delete(targetDishId);
          sameDayBookingBlockedRef.current = next;
        }
      } catch (e) {
        setSections((prev) => {
          const next = prev.map((sec) => {
            if (sec.clientId !== sectionClientId) return sec;
            const dishes = sec.dishes.map((d) => {
              if (d.clientId !== dishClientId) return d;
              return { ...d, same_day_booking_blocked: sameDayBookingBlockedRef.current.has(d.id ?? 0) };
            });
            return { ...sec, dishes };
          });
          return next;
        });
        pushToast({ kind: "error", title: "Error", message: e instanceof Error ? e.message : "No se pudo actualizar la reserva mismo dia" });
      }
    },
    [api, menuId, pushToast],
  );

  // --- Hydration effect ---
  useEffect(() => {
    if (!data.menu) {
      lastSavedBasicsRef.current = "";
      inFlightBasicsRef.current = null;
      lastSavedSectionsRef.current = "";
      lastSavedSectionsStructureRef.current = "";
      lastSavedSectionDishesRef.current = {};
      lastSavedSectionAnnotationsRef.current = {};
      lastSavedSectionDishSyncRef.current = {};
      inFlightSectionsRef.current = null;
      inFlightSectionAnnotationsRef.current = {};
      syncRequestSeqRef.current = 0;
      setMenuAITracker({ dishes: [] });
      setSpecialMenuImage(null);
      setMenuPreviewImageUrl("");
      setMenuPreviewAIRequested(false);
      setMenuPreviewAIGenerating(false);
      setHydrated(true);
      return;
    }
    const mapped = mapApiMenu(data.menu, sections);
    const mappedIsALaCarte = mapped.menuType === "a_la_carte" || mapped.menuType === "a_la_carte_group";
    setTitle(mapped.title);
    setPrice(mapped.price);
    setActive(mapped.active);
    setMenuType(mapped.menuType);
    setSubtitles(mapped.subtitles.length ? mapped.subtitles : [""]);
    setShowDishImages(mapped.showDishImages);
    setShowSectionTabs(mapped.showSectionTabs);
    setShowMenuPreviewImage(mapped.showMenuPreviewImage);
    setDesktopPreviewOpen(mapped.desktopPreviewOpen);
    setMenuPreviewImageUrl(mapped.menuPreviewImageUrl);
    setMenuPreviewAIRequested(mapped.menuPreviewAIRequested);
    setMenuPreviewAIGenerating(mapped.menuPreviewAIGenerating);
    setSpecialMenuImage(mapped.specialMenuImageUrl || null);
    setSections(mapped.sections);
    setMenuAITracker(buildMenuAITracker(data.menu, mapped.sections));
    setIncludedCoffee(mapped.settings.included_coffee);
    setBeverageType(mapped.settings.beverage.type);
    setBeveragePrice(mapped.settings.beverage.price_per_person == null ? "" : String(mapped.settings.beverage.price_per_person));
    setBeverageHasSupplement(mapped.settings.beverage.has_supplement);
    setBeverageSupplementPrice(mapped.settings.beverage.supplement_price == null ? "" : String(mapped.settings.beverage.supplement_price));
    setMinPartySize(String(mapped.settings.min_party_size));
    setMainLimit(mapped.settings.main_dishes_limit);
    setMainLimitNum(String(mapped.settings.main_dishes_limit_number));
    setComments(mapped.settings.comments.length ? mapped.settings.comments : [""]);
    const mappedBasicsPayload = buildBasicsPayload({
      title: mapped.title, price: mapped.price, active: mapped.active, menuType: mapped.menuType,
      subtitles: mapped.subtitles.length ? mapped.subtitles : [""], showDishImages: mapped.showDishImages, showSectionTabs: mapped.showSectionTabs,
      showMenuPreviewImage: mapped.showMenuPreviewImage, desktopPreviewOpen: mapped.desktopPreviewOpen,
      includedCoffee: mapped.settings.included_coffee,
      beverageType: mapped.settings.beverage.type,
      beveragePrice: mapped.settings.beverage.price_per_person == null ? "" : String(mapped.settings.beverage.price_per_person),
      beverageHasSupplement: mapped.settings.beverage.has_supplement,
      beverageSupplementPrice: mapped.settings.beverage.supplement_price == null ? "" : String(mapped.settings.beverage.supplement_price),
      comments: mapped.settings.comments.length ? mapped.settings.comments : [""],
      minPartySize: String(mapped.settings.min_party_size),
      mainLimit: mapped.settings.main_dishes_limit,
      mainLimitNum: String(mapped.settings.main_dishes_limit_number),
    });
    lastSavedBasicsRef.current = JSON.stringify(mappedBasicsPayload);
    lastSavedSectionsRef.current = getSectionsFingerprint(mapped.sections);
    lastSavedSectionsStructureRef.current = getSectionsStructureFingerprint(mapped.sections);
    lastSavedSectionDishesRef.current = getSectionsDishFingerprintMap(mapped.sections);
    lastSavedSectionAnnotationsRef.current = getSectionsAnnotationsFingerprintMap(mapped.sections);
    lastSavedSectionDishSyncRef.current = getSectionsDishSyncStateMap(mapped.sections, mappedIsALaCarte);
    inFlightBasicsRef.current = null;
    inFlightSectionsRef.current = null;
    inFlightSectionAnnotationsRef.current = {};
    syncRequestSeqRef.current = 0;
    setHydrated(true);

    const loadedMenuId = data.menu?.id;
    if (loadedMenuId) {
      void (async () => {
        try {
          const res = await api.menus.gruposV2.getSameDayBooking(loadedMenuId);
          if (res.success && Array.isArray(res.dish_ids)) {
            const blockedSet = new Set<number>(res.dish_ids);
            sameDayBookingBlockedRef.current = blockedSet;
            setSections((prev) => {
              let changed = false;
              const next = prev.map((sec) => {
                const dishes = sec.dishes.map((d) => {
                  const blocked = d.id ? blockedSet.has(d.id) : false;
                  if (d.same_day_booking_blocked === blocked) return d;
                  changed = true;
                  return { ...d, same_day_booking_blocked: blocked };
                });
                return changed ? { ...sec, dishes } : sec;
              });
              return changed ? next : prev;
            });
          }
        } catch { /* ignore */ }
      })();
    }
  }, []);

  // --- Preview dock timer effect ---
  useEffect(() => {
    if (previewDockTimerRef.current) window.clearTimeout(previewDockTimerRef.current);
    if (desktopPreviewOpen) { setDesktopPreviewDocked(true); return; }
    setDesktopPreviewDocked(true);
    previewDockTimerRef.current = window.setTimeout(() => { setDesktopPreviewDocked(false); previewDockTimerRef.current = null; }, 600);
    return () => { if (previewDockTimerRef.current) { window.clearTimeout(previewDockTimerRef.current); previewDockTimerRef.current = null; } };
  }, [desktopPreviewOpen]);

  // --- renderMenuPreviewUploadArea ---
  const renderMenuPreviewUploadArea = () => {
    if (!showMenuPreviewImage) return null;
    const statusMessage = menuPreviewAIGenerating ? "Generando imagen con IA..." : menuPreviewImageBusy || menuPreviewImageAdvisorBusy || menuPreviewImageCropBusy ? "Procesando imagen..." : "JPG, PNG, WEBP o GIF. Se optimiza a WebP de hasta 150KB.";
    const uploadLabel = menuPreviewImageBusy || menuPreviewImageAdvisorBusy || menuPreviewImageCropBusy ? "Procesando..." : "Subir imagen";
    const menuPreviewUploadDisabled = !menuId || menuPreviewImageBusy || menuPreviewImageAdvisorBusy || menuPreviewImageCropBusy || menuPreviewAIGenerating;

    // Compact single-cell picker matching the "Slider de imagenes" section, so
    // both image controls in this panel look and behave the same way.
    return (
      <div className="bo-field bo-field--full" data-slot="useMenuEditor-field--full">
        <div className="bo-label" data-slot="useMenuEditor-label">Foto preview del menu</div>
        <div className="bo-sliderGrid bo-sliderGrid--preview" data-slot="useMenuEditor-menuPreviewGrid">
          {menuPreviewAIGenerating ? (
            <div className="bo-sliderCell bo-sliderPendingCell" role="status" aria-live="polite" data-testid="menu-preview-ai-skeleton">
              <Sparkles size={16} aria-hidden="true" />
              <span data-slot="useMenuEditor-span">Generando...</span>
            </div>
          ) : menuPreviewImageUrl ? (
            <div className="bo-sliderCell" data-slot="useMenuEditor-menuPreviewCell">
              <img className="bo-sliderThumb" src={menuPreviewImageUrl} alt="Foto preview del menu" />
              <button
                className="bo-sliderDelete"
                type="button"
                disabled={menuPreviewUploadDisabled}
                onClick={() => setMenuPreviewImageUrl("")}
                aria-label="Eliminar foto preview"
                data-testid="menu-editor-delete-preview-image-btn"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ) : (
            <button
              className="bo-sliderCell bo-sliderAddCell"
              type="button"
              disabled={menuPreviewUploadDisabled}
              onClick={openMenuPreviewImagePicker}
              aria-label={uploadLabel}
              data-testid="menu-editor-upload-preview-image-btn"
            >
              <Upload size={18} aria-hidden="true" />
            </button>
          )}
        </div>
        <div className="bo-menuPreviewStatus bo-mutedText" data-slot="useMenuEditor-mutedText">{statusMessage}</div>
      </div>
    );
  };

  // --- renderSpecialMenuImageUploadArea ---
  const renderSpecialMenuImageUploadArea = () => {
    const specialMenuUploadDisabled = !menuId || specialMenuImageBusy || busy;
    return (
      <div className="bo-specialImageUpload" data-slot="useMenuEditor-specialImageUpload">
        {specialMenuImage ? (
          <div className="bo-specialImagePreview" data-slot="useMenuEditor-specialImagePreview">
            <img src={specialMenuImage} alt="Menu especial" />
            <div className="bo-menuPreviewActions" data-slot="useMenuEditor-menuPreviewActions">
              <button className="bo-btn bo-btn--ghost bo-btn--sm" type="button" disabled={specialMenuUploadDisabled} onClick={openSpecialMenuImagePicker} data-testid="menu-editor-change-special-image-btn">
                <Upload size={14} /> {specialMenuImageBusy ? "Procesando..." : "Cambiar imagen"}
              </button>
              <button className="bo-btn bo-btn--ghost bo-btn--danger" type="button" disabled={specialMenuUploadDisabled} onClick={() => setSpecialMenuImage(null)} data-testid="menu-editor-delete-special-image-btn">
                <Trash2 size={14} /> Eliminar
              </button>
            </div>
          </div>
        ) : (
          <div className="bo-specialImageDropzone" data-slot="useMenuEditor-specialImageDropzone">
            <Upload size={48} />
            <p data-slot="useMenuEditor-ial">Sube la imagen del menu especial</p>
            <p className="bo-mutedText" data-slot="useMenuEditor-mutedText">PDF, Word, TXT, PNG, JPG, WEBP o GIF hasta 10MB</p>
            <button className="bo-btn bo-btn--ghost bo-btn--sm" type="button" disabled={specialMenuUploadDisabled} onClick={openSpecialMenuImagePicker} data-testid="menu-editor-upload-special-image-btn">
              <Upload size={14} /> {specialMenuImageBusy ? "Procesando..." : "Subir imagen"}
            </button>
          </div>
        )}
      </div>
    );
  };

  return {
    // State
    error, initialSlider, menuId, isDraft, step, menuType, title, price, subtitles, active, showDishImages, showSectionTabs,
    showMenuPreviewImage, menuPreviewImageUrl, menuPreviewAIRequested, menuPreviewAIGenerating,
    sections, includedCoffee, beverageType, beveragePrice, beverageHasSupplement, beverageSupplementPrice,
    beverageOptions, beverageModalOpen, beverageDeleteTarget,
    minPartySize, mainLimit, mainLimitNum, comments, specialMenuImage, menuPreviewImageBusy,
    specialMenuImageBusy, saveState, busy, hydrated, mobileTab, desktopPreviewOpen, desktopPreviewDocked,
    previewThemeConfig, previewThemeLoading, allergenModal, searchTerms, searchResults,
    sectionLoadingState, menuAITracker, dishImageTarget, dishImageAdvisorDraft, dishImageAdvisorBusy,
    dishImageCropDraft, dishImageBusy, menuPreviewImageAdvisorDraft, menuPreviewImageAdvisorBusy,
    menuPreviewImageCropDraft, menuPreviewImageCropBusy,
    // Derived
    isALaCarte, isSpecial, hasSecondaryBasicsField, basicsDraft, basicsPayload, basicsFingerprint,
    sectionsFingerprint, shouldReduceMotion, sectionOrder, menuAIDishesById,
    dishImageAdvisorPreviewKB, menuPreviewImageAdvisorPreviewKB, loadingSectionTitles,
    previewThemeId, previewThemeLabel, previewNeedsUpgrade, previewMenuPayload, previewUrl,
    // Refs
    previewFrameRef, dishImageInputRef, menuPreviewImageInputRef, specialMenuImageInputRef,
    // Setters
    setMenuId, setIsDraft, setStep, setMenuType, setTitle, setPrice, setSubtitles, setActive,
    setShowDishImages, setShowSectionTabs, setShowMenuPreviewImage, setMenuPreviewImageUrl, setMenuPreviewAIRequested,
    setMenuPreviewAIGenerating, setSections, setIncludedCoffee, setBeverageType, setBeveragePrice,
    refreshBeverageOptions, setBeverageOptionSelected, createBeverageOption,
    requestBeverageOptionDelete, confirmBeverageOptionDelete, cancelBeverageOptionDelete, closeBeverageModal,
    setBeverageHasSupplement, setBeverageSupplementPrice, setMinPartySize, setMainLimit, setMainLimitNum,
    setComments, setSpecialMenuImage, setSaveState, setBusy, setHydrated, setMobileTab,
    setDesktopPreviewOpen, setDesktopPreviewDocked, setAllergenModal, setMenuAITracker,
    setDishImageTarget, setDishImageAdvisorDraft, setDishImageAdvisorBusy, setDishImageCropDraft,
    setDishImageBusy, setMenuPreviewImageAdvisorDraft, setMenuPreviewImageAdvisorBusy,
    setMenuPreviewImageCropDraft, setMenuPreviewImageCropBusy, setSearchTerms, setSearchResults,
    setSectionLoadingState, setSectionLoadedDishes, setMenuPreviewImageBusy, setSpecialMenuImageBusy,
    // Actions
    patchBasics, syncSectionsAndDishes, applyDishAIState, applyMenuPreviewAIState,
    applyAITrackerSnapshot, createDraftAndContinue, addSection, removeSection, updateSection,
    fetchSectionDishes, handleSectionToggle, updateSectionAnnotation, addSectionAnnotation,
    removeSectionAnnotation, setSectionDescriptionsEnabled, moveSection, reorderSections, addDish, updateDish, removeDish,
    reorderDishes, handleSearch, pickDishImage, onDishImageFileSelected, onDishImageAdvisorImprove,
    onDishImageCropConfirm, onPublish, openSpecialMenuImagePicker, onSpecialMenuImageFileSelected,
    openMenuPreviewImagePicker, onMenuPreviewImageFileSelected, onMenuPreviewImageAdvisorImprove,
    onMenuPreviewImageCropConfirm, resolvePersistedDishTarget, moveDishImageAdvisorToCrop,
    moveMenuPreviewImageAdvisorToCrop, requestMenuAITrackerSync, closeDishImageAdvisor,
    closeDishImageCropper, closeMenuPreviewImageAdvisor, closeMenuPreviewImageCropper,
    toggleSameDayBooking,
    // Render helpers
    renderMenuPreviewUploadArea,
    renderSpecialMenuImageUploadArea,
  };
}
