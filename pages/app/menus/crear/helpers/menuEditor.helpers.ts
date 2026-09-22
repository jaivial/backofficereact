import { fitImageToBytes } from "../../../../../lib/imageBudget";
import type {
  EditorDish,
  EditorSection,
  MenuAIDishTracker,
  MenuPreviewTrackerPatch,
  MenuPreviewResolvedState,
  BasicsDraft,
  BasicsPayload,
  SectionDishSyncState,
} from "../types/menuEditor.types";
import type { GroupMenuV2, GroupMenuV2AIDish, GroupMenuV2AIImages, GroupMenuV2Dish, GroupMenuV2Section } from "../../../../../api/types";
import { DEFAULT_BEVERAGE, DISH_IMAGE_AI_MAX_KB, MENU_AI_TRACE_PREFIX } from "../constants/menuEditor.constants";
// Coordination id: dessert_section_source_v1
import { isGeneralDessertSection, normalizeDessertSource } from "../../../../../ui/widgets/menus/sectionPresentation";
// Coordination id: autosave_three_way_merge_v1 - shared echo-merge primitives.
import { mergeEditedText } from "../../../../../lib/autosaveGuard";

// =============================================================================
// Debug / Logging
// =============================================================================

export function logMenuAITrace(event: string, payload?: Record<string, unknown>): void {
  if (payload) {
    console.log(`${MENU_AI_TRACE_PREFIX} ${event}`, payload);
    return;
  }
  console.log(`${MENU_AI_TRACE_PREFIX} ${event}`);
}

export function debugMenuPerf(event: string, payload?: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  const globalDebug = (window as unknown as Record<string, unknown>).__MENU_PERF_DEBUG === true;
  let storageDebug = false;
  try {
    storageDebug = window.localStorage.getItem("menuPerfDebug") === "1";
  } catch {
    storageDebug = false;
  }
  if (!globalDebug && !storageDebug) return;
  console.log("[menus/crear perf]", event, payload ?? {});
}

// =============================================================================
// Boolean / Value Parsing
// =============================================================================

export function parseLooseBool(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  const text = String(value ?? "").trim().toLowerCase();
  if (!text) return fallback;
  if (text === "1" || text === "true" || text === "yes" || text === "si" || text === "on") return true;
  if (text === "0" || text === "false" || text === "no" || text === "off") return false;
  return fallback;
}

export function toNumOrNull(raw: string): number | null {
  const s = raw.trim();
  if (!s) return null;
  const n = Number(s.replace(",", "."));
  if (!Number.isFinite(n)) return null;
  return n;
}

export function formatEuro(value: number): string {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(Number(value || 0));
}

// =============================================================================
// ID Generation
// =============================================================================

export function uid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

// =============================================================================
// Position Helpers
// =============================================================================

export function withSectionPositions(sections: EditorSection[]): EditorSection[] {
  return sections.map((sec, idx) => (sec.position === idx ? sec : { ...sec, position: idx }));
}

export function withDishPositions(dishes: EditorDish[]): EditorDish[] {
  return dishes.map((dish, idx) => (dish.position === idx ? dish : { ...dish, position: idx }));
}

export function orderByClientId<T extends { clientId: string }>(items: T[], orderedClientIds: string[]): T[] {
  const byId = new Map(items.map((item) => [item.clientId, item]));
  const seen = new Set<string>();
  const ordered: T[] = [];

  for (const id of orderedClientIds) {
    const item = byId.get(id);
    if (!item || seen.has(id)) continue;
    ordered.push(item);
    seen.add(id);
  }

  for (const item of items) {
    if (seen.has(item.clientId)) continue;
    ordered.push(item);
  }

  return ordered;
}

// =============================================================================
// Menu Preview State
// =============================================================================

export function normalizeMenuPreviewPatch(raw: unknown): MenuPreviewTrackerPatch | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const patch: MenuPreviewTrackerPatch = {};

  const showRaw = row.show_menu_preview_image ?? row.showMenuPreviewImage;
  if (showRaw !== undefined) {
    patch.show_menu_preview_image = parseLooseBool(showRaw, false);
  }

  const imageRaw = row.menu_preview_image_url ?? row.menuPreviewImageUrl;
  if (typeof imageRaw === "string" && imageRaw.trim()) {
    patch.menu_preview_image_url = imageRaw.trim();
  } else if (imageRaw === null) {
    patch.menu_preview_image_url = "";
  }

  const aiRequestedRaw = row.menu_preview_ai_requested
    ?? row.menuPreviewAIRequested
    ?? row.ai_requested_img
    ?? row.aiRequestedImg
    ?? row.ai_requested
    ?? row.aiRequested;
  if (aiRequestedRaw !== undefined) {
    patch.ai_requested = parseLooseBool(aiRequestedRaw, false);
  }

  const aiGeneratingRaw = row.menu_preview_ai_generating
    ?? row.menuPreviewAIGenerating
    ?? row.ai_generating_img
    ?? row.aiGeneratingImg
    ?? row.ai_generating
    ?? row.aiGenerating;
  if (aiGeneratingRaw !== undefined) {
    patch.ai_generating = parseLooseBool(aiGeneratingRaw, false);
  }

  const aiGeneratedRaw = row.ai_generated_img ?? row.aiGeneratedImg;
  if (typeof aiGeneratedRaw === "string" && aiGeneratedRaw.trim()) {
    patch.ai_generated_img = aiGeneratedRaw.trim();
    if (!patch.menu_preview_image_url) {
      patch.menu_preview_image_url = patch.ai_generated_img;
    }
  } else if (aiGeneratedRaw === null) {
    patch.ai_generated_img = null;
  }

  return Object.keys(patch).length > 0 ? patch : null;
}

export function mergeMenuPreviewPatches(patches: Array<MenuPreviewTrackerPatch | null | undefined>): MenuPreviewTrackerPatch | null {
  const merged: MenuPreviewTrackerPatch = {};
  let hasAny = false;
  for (const patch of patches) {
    if (!patch) continue;
    if (patch.show_menu_preview_image !== undefined) {
      merged.show_menu_preview_image = patch.show_menu_preview_image;
      hasAny = true;
    }
    if (patch.menu_preview_image_url !== undefined) {
      merged.menu_preview_image_url = patch.menu_preview_image_url;
      hasAny = true;
    }
    if (patch.ai_requested !== undefined) {
      merged.ai_requested = patch.ai_requested;
      hasAny = true;
    }
    if (patch.ai_generating !== undefined) {
      merged.ai_generating = patch.ai_generating;
      hasAny = true;
    }
    if (patch.ai_generated_img !== undefined) {
      merged.ai_generated_img = patch.ai_generated_img;
      hasAny = true;
    }
  }
  return hasAny ? merged : null;
}

export function resolveMenuPreviewState(menu: GroupMenuV2 | null | undefined): MenuPreviewResolvedState {
  const merged = mergeMenuPreviewPatches([
    normalizeMenuPreviewPatch(menu),
    normalizeMenuPreviewPatch(menu?.menu_preview),
  ]);
  const menuPreviewImageUrl = String(
    merged?.menu_preview_image_url
      ?? (typeof merged?.ai_generated_img === "string" ? merged.ai_generated_img : "")
      ?? "",
  ).trim();
  const menuPreviewAIRequested = merged?.ai_requested ?? false;
  const menuPreviewAIGenerating = merged?.ai_generating ?? false;
  const showMenuPreviewImage = merged?.show_menu_preview_image
    ?? (menuPreviewImageUrl.length > 0 || menuPreviewAIRequested || menuPreviewAIGenerating);
  return {
    showMenuPreviewImage,
    menuPreviewImageUrl,
    menuPreviewAIRequested,
    menuPreviewAIGenerating,
  };
}

export function trackerMenuPreviewFromWSPayload(raw: unknown): MenuPreviewTrackerPatch | null {
  if (!raw || typeof raw !== "object") return null;
  const payload = raw as Record<string, unknown>;
  const nestedMenu = payload.menu && typeof payload.menu === "object"
    ? (payload.menu as Record<string, unknown>)
    : null;
  return mergeMenuPreviewPatches([
    normalizeMenuPreviewPatch(payload),
    normalizeMenuPreviewPatch(payload.menu_preview),
    normalizeMenuPreviewPatch(nestedMenu),
    normalizeMenuPreviewPatch(nestedMenu?.menu_preview),
  ]);
}

// =============================================================================
// AI Dish Tracker
// =============================================================================

export function normalizeMenuAIDish(raw: unknown): MenuAIDishTracker | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const dishIdRaw = row.dish_id ?? row.dishId ?? row.id;
  const dishId = Number(dishIdRaw);
  if (!Number.isFinite(dishId) || dishId <= 0) return null;
  const aiGeneratedImgRaw = row.ai_generated_img ?? row.aiGeneratedImg;
  return {
    dish_id: dishId,
    ai_requested: parseLooseBool(row.ai_requested ?? row.aiRequested ?? row.ai_requested_img ?? row.aiRequestedImg, false),
    ai_generating: parseLooseBool(row.ai_generating ?? row.aiGenerating ?? row.ai_generating_img ?? row.aiGeneratingImg, false),
    ai_generated_img: typeof aiGeneratedImgRaw === "string" && aiGeneratedImgRaw.trim()
      ? aiGeneratedImgRaw.trim()
      : null,
  };
}

export function mergeMenuAIDishes(items: MenuAIDishTracker[]): MenuAIDishTracker[] {
  const map = new Map<number, MenuAIDishTracker>();
  for (const item of items) {
    const prev = map.get(item.dish_id);
    if (!prev) {
      map.set(item.dish_id, item);
      continue;
    }
    map.set(item.dish_id, {
      dish_id: item.dish_id,
      ai_requested: item.ai_requested || prev.ai_requested,
      ai_generating: item.ai_generating,
      ai_generated_img: item.ai_generated_img ?? prev.ai_generated_img ?? null,
    });
  }
  return Array.from(map.values());
}

export function trackerFromAIImages(raw: GroupMenuV2AIImages | GroupMenuV2AIDish[] | null | undefined): MenuAIDishTracker[] {
  if (!raw) return [];
  const rows: MenuAIDishTracker[] = [];
  if (Array.isArray(raw)) {
    for (const item of raw) {
      const normalized = normalizeMenuAIDish(item);
      if (normalized) rows.push(normalized);
    }
    return mergeMenuAIDishes(rows);
  }

  if (Array.isArray(raw.dishes)) {
    for (const item of raw.dishes) {
      const normalized = normalizeMenuAIDish(item);
      if (normalized) rows.push(normalized);
    }
  }

  if (Array.isArray(raw.items)) {
    for (const item of raw.items) {
      const normalized = normalizeMenuAIDish(item);
      if (normalized) rows.push(normalized);
    }
  }

  const byDish = raw.by_dish;
  if (byDish && typeof byDish === "object") {
    for (const item of Object.values(byDish)) {
      const normalized = normalizeMenuAIDish(item);
      if (normalized) rows.push(normalized);
    }
  }

  return mergeMenuAIDishes(rows);
}

export function trackerFromSections(sections: GroupMenuV2Section[] | EditorSection[]): MenuAIDishTracker[] {
  const rows: MenuAIDishTracker[] = [];
  for (const section of sections) {
    const dishes = Array.isArray(section.dishes) ? section.dishes : [];
    for (const dish of dishes as Array<GroupMenuV2Dish | EditorDish>) {
      if (!dish?.id) continue;
      const rawDish = dish as GroupMenuV2Dish & { ai_requested_img?: unknown; ai_generating_img?: unknown };
      rows.push({
        dish_id: dish.id,
        ai_requested: parseLooseBool(dish.ai_requested ?? rawDish.ai_requested_img, false),
        ai_generating: parseLooseBool(dish.ai_generating ?? rawDish.ai_generating_img, false),
        ai_generated_img: typeof dish.ai_generated_img === "string" && dish.ai_generated_img.trim()
          ? dish.ai_generated_img.trim()
          : null,
      });
    }
  }
  return mergeMenuAIDishes(rows);
}

export function buildMenuAITracker(
  menu: GroupMenuV2 | null | undefined,
  fallbackSections: EditorSection[] = [],
): { dishes: MenuAIDishTracker[] } {
  const fromMenu = menu ? trackerFromAIImages(menu.ai_images) : [];
  const fromSections = menu?.sections?.length ? trackerFromSections(menu.sections) : trackerFromSections(fallbackSections);
  return { dishes: mergeMenuAIDishes([...fromMenu, ...fromSections]) };
}

export function trackerFromWSPayload(raw: unknown): MenuAIDishTracker[] {
  if (!raw || typeof raw !== "object") return [];
  const payload = raw as Record<string, unknown>;
  const rows: MenuAIDishTracker[] = [];

  const direct = normalizeMenuAIDish(payload);
  if (direct) rows.push(direct);

  if (Array.isArray(payload.dishes)) {
    for (const row of payload.dishes) {
      const normalized = normalizeMenuAIDish(row);
      if (normalized) rows.push(normalized);
    }
  }

  if (Array.isArray(payload.ai_dishes)) {
    for (const row of payload.ai_dishes) {
      const normalized = normalizeMenuAIDish(row);
      if (normalized) rows.push(normalized);
    }
  }

  if (payload.tracker && typeof payload.tracker === "object") {
    const tracker = payload.tracker as Record<string, unknown>;
    if (Array.isArray(tracker.items)) {
      for (const row of tracker.items) {
        const normalized = normalizeMenuAIDish(row);
        if (normalized) rows.push(normalized);
      }
    }
    if (Array.isArray(tracker.dishes)) {
      for (const row of tracker.dishes) {
        const normalized = normalizeMenuAIDish(row);
        if (normalized) rows.push(normalized);
      }
    }
  }

  if (payload.ai_images) {
    rows.push(...trackerFromAIImages(payload.ai_images as GroupMenuV2AIImages | GroupMenuV2AIDish[]));
  }

  if (payload.menu && typeof payload.menu === "object") {
    const menu = payload.menu as Record<string, unknown>;
    rows.push(...trackerFromAIImages(menu.ai_images as GroupMenuV2AIImages | GroupMenuV2AIDish[]));
    if (Array.isArray(menu.sections)) {
      rows.push(...trackerFromSections(menu.sections as GroupMenuV2Section[]));
    }
  }

  return mergeMenuAIDishes(rows);
}

export function updateMenuAITrackerDish(
  prev: { dishes: MenuAIDishTracker[] },
  dishId: number,
  patch: Partial<MenuAIDishTracker>,
): { dishes: MenuAIDishTracker[] } {
  if (!Number.isFinite(dishId) || dishId <= 0) return prev;
  let changed = false;
  let hasDish = false;
  const nextDishes = prev.dishes.map((dish) => {
    if (dish.dish_id !== dishId) return dish;
    hasDish = true;
    const nextDish: MenuAIDishTracker = {
      dish_id: dishId,
      ai_requested: patch.ai_requested ?? dish.ai_requested,
      ai_generating: patch.ai_generating ?? dish.ai_generating,
      ai_generated_img: patch.ai_generated_img ?? dish.ai_generated_img ?? null,
    };
    if (
      nextDish.ai_requested === dish.ai_requested
      && nextDish.ai_generating === dish.ai_generating
      && nextDish.ai_generated_img === dish.ai_generated_img
    ) {
      return dish;
    }
    changed = true;
    return nextDish;
  });
  if (!hasDish) {
    changed = true;
    nextDishes.push({
      dish_id: dishId,
      ai_requested: patch.ai_requested ?? false,
      ai_generating: patch.ai_generating ?? false,
      ai_generated_img: patch.ai_generated_img ?? null,
    });
  }
  return changed ? { dishes: mergeMenuAIDishes(nextDishes) } : prev;
}

export function buildGroupMenuAIWSURL(menuId: number): string {
  const wsURL = new URL("/api/admin/group-menus-v2/ws", window.location.href);
  wsURL.protocol = wsURL.protocol === "https:" ? "wss:" : "ws:";
  wsURL.searchParams.set("menuId", String(menuId));
  // Correlation id links browser, websocket frames, backend checkpoints and
  // public-menu output for full cross-boundary traceability.
  let correlationId = "";
  try {
    correlationId = window.sessionStorage.getItem("vcCorrelationId") || "";
  } catch {
    correlationId = "";
  }
  if (!correlationId) {
    correlationId = `bo-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
    try { window.sessionStorage.setItem("vcCorrelationId", correlationId); } catch { /* ignore */ }
  }
  wsURL.searchParams.set("correlationId", correlationId);
  return wsURL.toString();
}

// =============================================================================
// Image Processing
// =============================================================================

export async function fileToImage(file: File): Promise<HTMLImageElement> {
  const objectUrl = URL.createObjectURL(file);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("No se pudo leer la imagen"));
    };
    img.src = objectUrl;
  });
}

export async function canvasToWebPBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("No se pudo procesar la imagen"));
        return;
      }
      resolve(blob);
    }, "image/webp", quality);
  });
}

export function webpOutputName(fileName: string): string {
  const base = String(fileName || "dish-image").replace(/\.[^.]+$/, "").trim() || "dish-image";
  return `${base.replace(/\s+/g, "-")}.webp`;
}

export async function preprocessDishImageToWebp(file: File, maxSizeKB = DISH_IMAGE_AI_MAX_KB): Promise<File> {
  const { isSupportedDishImageFile } = await import("../../../../../lib/dishImageCrop");
  if (!isSupportedDishImageFile(file)) {
    throw new Error("Formato no soportado. Usa JPG, PNG, WEBP o GIF.");
  }
  return fitImageToBytes(file, Math.round(maxSizeKB * 1024), { maxEdge: 1600, name: webpOutputName(file.name) });
}

export function clampDishCropValue(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

// =============================================================================
// Payload Building
// =============================================================================

export function buildBasicsPayload(draft: BasicsDraft): BasicsPayload {
  return {
    menu_title: draft.title.trim(),
    price: toNumOrNull(draft.price) ?? 0,
    active: draft.active,
    menu_type: draft.menuType,
    menu_subtitle: draft.subtitles.map((s) => s.trim()).filter(Boolean),
    show_dish_images: draft.showDishImages,
    show_section_tabs: draft.showSectionTabs,
    show_menu_preview_image: draft.showMenuPreviewImage,
    included_coffee: draft.includedCoffee,
    beverage: {
      type: draft.beverageType,
      price_per_person: draft.beverageType === "no_incluida" ? null : toNumOrNull(draft.beveragePrice),
      has_supplement: draft.beverageType === "ilimitada" ? draft.beverageHasSupplement : false,
      supplement_price: draft.beverageType === "ilimitada" && draft.beverageHasSupplement ? toNumOrNull(draft.beverageSupplementPrice) : null,
    },
    comments: draft.comments.map((s) => s.trim()).filter(Boolean),
    important_info: draft.importantInfo.map((s) => s.trim()).filter(Boolean),
    min_party_size: Math.max(1, Number(draft.minPartySize) || 1),
    main_dishes_limit: draft.mainLimit,
    main_dishes_limit_number: Math.max(1, Number(draft.mainLimitNum) || 1),
  };
}

// =============================================================================
// Section Annotations
// =============================================================================

export function toEditorSectionAnnotations(raw: unknown, fallback: string[] = []): string[] {
  if (Array.isArray(raw)) {
    const annotations = raw.map((value) => String(value ?? ""));
    return annotations.length > 0 ? annotations : [""];
  }
  return fallback.length > 0 ? fallback : [""];
}

export function normalizeSectionAnnotations(values: string[] | null | undefined): string[] {
  if (!Array.isArray(values)) return [];
  return values
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

// =============================================================================
// Fingerprinting
// =============================================================================

export function getSectionAnnotationsFingerprint(section: EditorSection): string {
  return JSON.stringify(normalizeSectionAnnotations(section.annotations));
}

export function getSectionsAnnotationsFingerprintMap(sections: EditorSection[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const section of sections) {
    map[section.clientId] = getSectionAnnotationsFingerprint(section);
  }
  return map;
}

export function getSectionsFingerprint(sections: EditorSection[]): string {
  return JSON.stringify(
    sections.map((sec) => ({
      id: sec.id || null,
      title: sec.title,
      displayTitle: sec.displayTitle.trim(),
      subtitle: sec.subtitle,
      tabLabel: sec.tabLabel,
      kind: sec.kind,
      annotations: sec.annotations,
      dishes: sec.dishes.map((d) => ({
        id: d.id || null,
        catalog: d.catalog_dish_id || null,
        title: d.title,
        desc: d.description,
        descEnabled: d.description_enabled,
        allergens: d.allergens,
        supp: d.supplement_enabled,
        suppPrice: d.supplement_price,
        active: d.active,
      })),
    })),
  );
}

export function getSectionsStructureFingerprint(sections: EditorSection[]): string {
  return JSON.stringify(
    sections.map((sec, idx) => ({
      id: sec.id || null,
      clientId: sec.clientId,
      title: sec.title.trim(),
      displayTitle: sec.displayTitle.trim(),
      subtitle: sec.subtitle,
      tabLabel: sec.tabLabel,
      kind: sec.kind,
      // Coordination id: dessert_section_source_v1 - flipping the dessert source
      // must dirty the structure so the next save persists it.
      dessertSource: sec.dessertSource,
      position: idx,
    })),
  );
}

export function getSectionDishesFingerprint(section: EditorSection): string {
  return JSON.stringify(
    section.dishes.map((dish, idx) => ({
      id: dish.id || null,
      catalog: dish.catalog_dish_id || null,
      title: dish.title,
      description: dish.description,
      allergens: dish.allergens,
      supplement_enabled: dish.supplement_enabled,
      supplement_price: dish.supplement_price,
      description_enabled: dish.description_enabled,
      price: dish.price,
      active: dish.active,
      position: idx,
    })),
  );
}

export function getSectionsDishFingerprintMap(sections: EditorSection[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const section of sections) {
    map[section.clientId] = getSectionDishesFingerprint(section);
  }
  return map;
}

export function getDishPatchFingerprint(dish: EditorDish, isALaCarte: boolean): string {
  return JSON.stringify({
    id: dish.id || null,
    catalog: dish.catalog_dish_id || null,
    title: dish.title.trim(),
    description: dish.description,
    allergens: dish.allergens,
    supplement_enabled: dish.supplement_enabled,
    supplement_price: dish.supplement_price,
    description_enabled: dish.description_enabled,
    price: isALaCarte ? dish.price : null,
    active: dish.active,
  });
}

export function getSectionDishSyncState(section: EditorSection, isALaCarte: boolean): SectionDishSyncState {
  const ids = section.dishes.map((dish) => dish.id || 0);
  const byId: Record<string, string> = {};
  section.dishes.forEach((dish) => {
    if (!dish.id) return;
    byId[String(dish.id)] = getDishPatchFingerprint(dish, isALaCarte);
  });
  return {
    order: JSON.stringify(ids),
    byId,
  };
}

export function getSectionsDishSyncStateMap(sections: EditorSection[], isALaCarte: boolean): Record<string, SectionDishSyncState> {
  const map: Record<string, SectionDishSyncState> = {};
  sections.forEach((section) => {
    map[section.clientId] = getSectionDishSyncState(section, isALaCarte);
  });
  return map;
}

// =============================================================================
// Dish Equality
// =============================================================================

function arraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

export function areEditorDishesEqual(prev: EditorDish, next: EditorDish): boolean {
  return (
    prev.clientId === next.clientId
    && prev.id === next.id
    && prev.catalog_dish_id === next.catalog_dish_id
    && prev.title === next.title
    && prev.description === next.description
    && prev.description_enabled === next.description_enabled
    && arraysEqual(prev.allergens, next.allergens)
    && prev.supplement_enabled === next.supplement_enabled
    && prev.supplement_price === next.supplement_price
    && prev.price === next.price
    && prev.active === next.active
    && prev.position === next.position
    && prev.foto_url === next.foto_url
    && prev.ai_requested === next.ai_requested
    && prev.ai_generating === next.ai_generating
    && prev.ai_generated_img === next.ai_generated_img
  );
}

// =============================================================================
// API Mapping
// =============================================================================

export function mergeDishFromServer(prev: EditorDish | undefined, server: GroupMenuV2Dish, live?: EditorDish): EditorDish {
  const current = live ?? prev;
  const next = mapApiDish(server, current);
  if (!prev) return next;
  if (!live) {
    if (
      prev.id === next.id
      && prev.catalog_dish_id === next.catalog_dish_id
      && prev.title === next.title
      && prev.description === next.description
      && prev.description_enabled === next.description_enabled
      && arraysEqual(prev.allergens, next.allergens)
      && prev.supplement_enabled === next.supplement_enabled
      && prev.supplement_price === next.supplement_price
      && prev.price === next.price
      && prev.active === next.active
      && prev.position === next.position
      && prev.foto_url === next.foto_url
      && prev.ai_requested === next.ai_requested
      && prev.ai_generating === next.ai_generating
      && prev.ai_generated_img === next.ai_generated_img
    ) {
      return prev;
    }
    return next;
  }
  // Preserve every typable field the operator touched after the snapshot. Image
  // and ai fields still come from the server: they travel their own pipeline and
  // are never typed into a text input.
  return {
    ...next,
    clientId: live.clientId,
    title: mergeEditedText(prev.title, live.title, next.title),
    description: mergeEditedText(prev.description, live.description, next.description),
    description_enabled: Object.is(prev.description_enabled, live.description_enabled) ? next.description_enabled : live.description_enabled,
    allergens: arraysEqual(prev.allergens, live.allergens) ? next.allergens : live.allergens,
    supplement_enabled: Object.is(prev.supplement_enabled, live.supplement_enabled) ? next.supplement_enabled : live.supplement_enabled,
    supplement_price: Object.is(prev.supplement_price, live.supplement_price) ? next.supplement_price : live.supplement_price,
    price: Object.is(prev.price, live.price) ? next.price : live.price,
    active: Object.is(prev.active, live.active) ? next.active : live.active,
    // Not part of the dish payload/echo: keep the flag that the dedicated
    // same-day-booking fetch owns so a reconcile never clears it.
    same_day_booking_blocked: live.same_day_booking_blocked,
  };
}

// Field-level three-way merge for a dish already in editor shape. Shared by the
// section reconcile so a typed dish keeps its text while the server keeps every
// structural field (id, catalog id, image pipeline).
function mergeEditorDishFromServer(base: EditorDish, server: EditorDish, live: EditorDish): EditorDish {
  return {
    ...server,
    clientId: live.clientId,
    title: mergeEditedText(base.title, live.title, server.title),
    description: mergeEditedText(base.description, live.description, server.description),
    description_enabled: Object.is(base.description_enabled, live.description_enabled) ? server.description_enabled : live.description_enabled,
    allergens: arraysEqual(base.allergens, live.allergens) ? server.allergens : live.allergens,
    supplement_enabled: Object.is(base.supplement_enabled, live.supplement_enabled) ? server.supplement_enabled : live.supplement_enabled,
    supplement_price: Object.is(base.supplement_price, live.supplement_price) ? server.supplement_price : live.supplement_price,
    price: Object.is(base.price, live.price) ? server.price : live.price,
    active: Object.is(base.active, live.active) ? server.active : live.active,
    same_day_booking_blocked: live.same_day_booking_blocked,
  };
}

export function reconcileServerDishes(base: EditorDish[], server: EditorDish[], live: EditorDish[]): EditorDish[] {
  const baseByClient = new Map(base.map((dish) => [dish.clientId, dish]));
  const liveByClient = new Map(live.map((dish) => [dish.clientId, dish]));
  const serverClients = new Set(server.map((dish) => dish.clientId));
  const merged = server.map((serverDish) => {
    const liveDish = liveByClient.get(serverDish.clientId);
    if (!liveDish) return serverDish;
    return mergeEditorDishFromServer(baseByClient.get(serverDish.clientId) ?? liveDish, serverDish, liveDish);
  });
  for (const liveDish of live) {
    if (!serverClients.has(liveDish.clientId) && !baseByClient.has(liveDish.clientId)) merged.push(liveDish);
  }
  return merged;
}

// Coordination id: autosave_three_way_merge_v1
// Section-level counterpart of mergeDishFromServer. It applies a full server
// snapshot without rolling back the text the operator typed while the save was
// in flight, and keeps sections created after the snapshot was taken.
export function reconcileServerSections(
  snapshot: EditorSection[],
  server: EditorSection[],
  current: EditorSection[],
): EditorSection[] {
  const snapshotById = new Map(snapshot.map((section) => [section.clientId, section]));
  const currentById = new Map(current.map((section) => [section.clientId, section]));
  const serverIds = new Set(server.map((section) => section.clientId));
  const merged = server.map((serverSection) => {
    const live = currentById.get(serverSection.clientId);
    if (!live) return serverSection;
    const base = snapshotById.get(serverSection.clientId) ?? live;
    return {
      ...serverSection,
      title: mergeEditedText(base.title, live.title, serverSection.title),
      displayTitle: mergeEditedText(base.displayTitle, live.displayTitle, serverSection.displayTitle),
      subtitle: mergeEditedText(base.subtitle, live.subtitle, serverSection.subtitle),
      tabLabel: mergeEditedText(base.tabLabel, live.tabLabel, serverSection.tabLabel),
      annotations: JSON.stringify(base.annotations) === JSON.stringify(live.annotations)
        ? serverSection.annotations
        : live.annotations,
      // Merge dish-by-dish: the server keeps the structural fields it owns
      // (id, catalog id, image) while the operator's in-flight text wins.
      dishes: reconcileServerDishes(base.dishes, serverSection.dishes, live.dishes),
      expanded: live.expanded ?? serverSection.expanded,
    };
  });
  for (const live of current) {
    if (serverIds.has(live.clientId) || snapshotById.has(live.clientId)) continue;
    merged.push(live);
  }
  return merged;
}

export function mapApiDish(d: GroupMenuV2Dish, prev?: EditorDish): EditorDish {
  const description = d.description || "";
  const hasDescription = description.trim().length > 0;
  const aiGeneratedImg = typeof d.ai_generated_img === "string" && d.ai_generated_img.trim()
    ? d.ai_generated_img.trim()
    : (prev?.ai_generated_img ?? null);
  const aiGenerating = parseLooseBool(d.ai_generating ?? d.ai_generating_img, prev?.ai_generating ?? false);
  const aiRequested = parseLooseBool(d.ai_requested ?? d.ai_requested_img, prev?.ai_requested ?? aiGenerating);
  return {
    clientId: prev?.clientId || uid("dish"),
    id: d.id,
    catalog_dish_id: d.catalog_dish_id ?? null,
    title: d.title,
    description,
    // Prefer the persisted flag; only infer from content when the API omits it.
    // Falling back to hasDescription unconditionally re-enabled descriptions the
    // user had explicitly turned off.
    description_enabled:
      typeof d.description_enabled === "boolean"
        ? d.description_enabled
        : (prev?.description_enabled ?? hasDescription),
    allergens: d.allergens || [],
    supplement_enabled: !!d.supplement_enabled,
    supplement_price: d.supplement_price ?? null,
    price: d.price ?? null,
    active: d.active !== false,
    position: d.position || 0,
    foto_url: d.foto_url || d.image_url || aiGeneratedImg || prev?.foto_url,
    ai_requested: !!aiRequested,
    ai_generating: !!aiGenerating,
    ai_generated_img: aiGeneratedImg,
    // Coordination id: dessert_section_source_v1
    read_only: d.read_only === true,
  };
}

// Coordination id: dessert_section_source_v1
// A general-carta mirror owns no dish rows of its own, so a structure reconcile
// must adopt the server dish list instead of the (possibly empty) local copy.
// Any local rows are either the server-loaded carta or unconfirmed edits and are
// preserved; only an empty local list means we must take the server list.
export function mirrorShouldAdoptServerDishes(
  mapped: Pick<EditorSection, "kind" | "dessertSource" | "dishes">,
  local: Pick<EditorSection, "dishes"> | undefined,
): boolean {
  if (!isGeneralDessertSection(mapped.kind, mapped.dessertSource)) return false;
  return !local || local.dishes.length === 0;
}

export function mapApiSection(s: GroupMenuV2Section, prev?: EditorSection): EditorSection {
  const prevDishByID = new Map<number, EditorDish>();
  for (const dish of prev?.dishes || []) {
    if (dish.id) prevDishByID.set(dish.id, dish);
  }

  // Coordination id: comida_autosave_v1 — only omitted fields may fall back.
  const apiDisplayTitle = s.display_title === undefined ? prev?.displayTitle ?? s.title ?? "" : String(s.display_title);
  // Subtitle and tab_label fall back to prev only when the API omitted them
  // entirely (undefined). An empty string from the API is treated as an
  // intentional clear so server round-trips stay honest.
  const apiSubtitle = s.subtitle === undefined ? prev?.subtitle ?? "" : String(s.subtitle);
  const apiTabLabel = s.tab_label === undefined ? prev?.tabLabel ?? "" : String(s.tab_label);

  return {
    clientId: prev?.clientId || uid("section"),
    id: s.id,
    title: s.title,
    displayTitle: apiDisplayTitle,
    subtitle: apiSubtitle,
    tabLabel: apiTabLabel,
    kind: s.kind,
    // Coordination id: dessert_section_source_v1 - keep the previous value when
    // the API omits the field so an older payload never silently unlinks a mirror.
    dessertSource: normalizeDessertSource(s.kind, s.dessert_source ?? prev?.dessertSource),
    position: s.position || 0,
    annotations: toEditorSectionAnnotations(s.annotations, prev?.annotations),
    // Coordination id: menu_section_public_placement_v1
    public_page_active: s.public_page_active ?? prev?.public_page_active ?? false,
    web_placement: s.web_placement ?? prev?.web_placement ?? "inside_menus",
    expanded: prev?.expanded ?? false,
    dishes: (s.dishes || []).map((dish) => mapApiDish(dish, dish.id ? prevDishByID.get(dish.id) : undefined)),
  };
}

export function mapApiMenu(menu: GroupMenuV2, prevSections: EditorSection[] = []): {
  title: string;
  price: string;
  active: boolean;
  menuType: string;
  subtitles: string[];
  sections: EditorSection[];
  settings: {
    included_coffee: boolean;
    beverage: {
      type: string;
      price_per_person: number | null;
      has_supplement: boolean;
      supplement_price: number | null;
    };
    comments: string[];
    important_info: string[];
    min_party_size: number;
    main_dishes_limit: boolean;
    main_dishes_limit_number: number;
  };
  showDishImages: boolean;
  showSectionTabs: boolean;
  showMenuPreviewImage: boolean;
  menuPreviewImageUrl: string;
  menuPreviewAIRequested: boolean;
  menuPreviewAIGenerating: boolean;
} {
  const prevByID = new Map<number, EditorSection>();
  for (const sec of prevSections) {
    if (sec.id) prevByID.set(sec.id, sec);
  }

  const sections = (menu.sections || []).map((sec) => mapApiSection(sec, sec.id ? prevByID.get(sec.id) : undefined));
  const previewState = resolveMenuPreviewState(menu);

  return {
    title: menu.menu_title || "",
    price: menu.price || "0",
    active: !!menu.active,
    menuType: menu.menu_type || "closed_conventional",
    subtitles: menu.menu_subtitle || [],
    showDishImages: !!menu.show_dish_images,
    showSectionTabs: !!menu.show_section_tabs,
    showMenuPreviewImage: previewState.showMenuPreviewImage,
    menuPreviewImageUrl: previewState.menuPreviewImageUrl,
    menuPreviewAIRequested: previewState.menuPreviewAIRequested,
    menuPreviewAIGenerating: previewState.menuPreviewAIGenerating,
    sections,
    settings: {
      included_coffee: !!menu.settings?.included_coffee,
      beverage: {
        type: menu.settings?.beverage?.type || DEFAULT_BEVERAGE.type,
        price_per_person: menu.settings?.beverage?.price_per_person ?? null,
        has_supplement: !!menu.settings?.beverage?.has_supplement,
        supplement_price: menu.settings?.beverage?.supplement_price ?? null,
      },
      comments: menu.settings?.comments || [],
      important_info: menu.settings?.important_info || [],
      min_party_size: menu.settings?.min_party_size || 8,
      main_dishes_limit: !!menu.settings?.main_dishes_limit,
      main_dishes_limit_number: menu.settings?.main_dishes_limit_number || 1,
    },
  };
}
