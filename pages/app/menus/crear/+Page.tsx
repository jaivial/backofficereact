import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronUp,
  Eye,
  GripVertical,
  PencilLine,
  Plus,
  Search,
  Settings2,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";
import { motion, Reorder, useDragControls, useReducedMotion } from "motion/react";
import { usePageContext } from "vike-react/usePageContext";

import { createClient } from "../../../../api/client";
import type { DishCatalogItem, GroupMenuV2, GroupMenuV2Dish, GroupMenuV2Section } from "../../../../api/types";
import { useErrorToast } from "../../../../ui/feedback/useErrorToast";
import { useToasts } from "../../../../ui/feedback/useToasts";
import { Select } from "../../../../ui/inputs/Select";
import { Modal } from "../../../../ui/overlays/Modal";
import { Switch } from "../../../../ui/shadcn/Switch";

type PageData = {
  menu: GroupMenuV2 | null;
  error: string | null;
};

type EditorDish = {
  clientId: string;
  id?: number;
  catalog_dish_id?: number | null;
  title: string;
  description: string;
  allergens: string[];
  supplement_enabled: boolean;
  supplement_price: number | null;
  price: number | null;
  active: boolean;
  position: number;
};

type EditorSection = {
  clientId: string;
  id?: number;
  title: string;
  kind: string;
  position: number;
  dishes: EditorDish[];
  expanded?: boolean;
};

type SaveState = "idle" | "saving" | "saved" | "error";

type ReorderItemContainerProps = {
  as?: "div" | "article";
  value: string;
  className: string;
  transition?: any;
  whileDrag?: any;
  children: (startDrag: (event: React.PointerEvent<Element>) => void) => React.ReactNode;
};

type BasicsDraft = {
  title: string;
  price: string;
  active: boolean;
  menuType: string;
  subtitles: string[];
  includedCoffee: boolean;
  beverageType: string;
  beveragePrice: string;
  beverageHasSupplement: boolean;
  beverageSupplementPrice: string;
  comments: string[];
  minPartySize: string;
  mainLimit: boolean;
  mainLimitNum: string;
};

type BasicsPayload = {
  menu_title: string;
  price: number;
  active: boolean;
  menu_type: string;
  menu_subtitle: string[];
  included_coffee: boolean;
  beverage: {
    type: string;
    price_per_person: number | null;
    has_supplement: boolean;
    supplement_price: number | null;
  };
  comments: string[];
  min_party_size: number;
  main_dishes_limit: boolean;
  main_dishes_limit_number: number;
};

const MENU_TYPES = [
  { value: "closed_conventional", label: "Menu cerrado convencional", enabled: true },
  { value: "closed_group", label: "Menu cerrado de grupo", enabled: true },
  { value: "a_la_carte", label: "A la carta convencional", enabled: true },
  { value: "a_la_carte_group", label: "A la carta grupo", enabled: true },
  { value: "special", label: "Menu especial", enabled: true },
] as const;

const DEFAULT_BEVERAGE = {
  type: "no_incluida",
  price_per_person: null as number | null,
  has_supplement: false,
  supplement_price: null as number | null,
};

const ALLERGENS = [
  { key: "Gluten", icon: "G" },
  { key: "Crustaceos", icon: "C" },
  { key: "Huevos", icon: "H" },
  { key: "Pescado", icon: "P" },
  { key: "Cacahuetes", icon: "CA" },
  { key: "Soja", icon: "S" },
  { key: "Leche", icon: "L" },
  { key: "Frutos de cascara", icon: "FC" },
  { key: "Apio", icon: "A" },
  { key: "Mostaza", icon: "M" },
  { key: "Sesamo", icon: "SE" },
  { key: "Sulfitos", icon: "SU" },
  { key: "Altramuces", icon: "AL" },
  { key: "Moluscos", icon: "MO" },
] as const;

const sectionKindOptions: { value: string; label: string }[] = [
  { value: "entrantes", label: "Entrantes" },
  { value: "principales", label: "Principales" },
  { value: "postres", label: "Postres" },
  { value: "custom", label: "Custom" },
];

const beverageTypeOptions: { value: string; label: string }[] = [
  { value: "no_incluida", label: "No incluida" },
  { value: "opcion", label: "Opcion bebida ilimitada" },
  { value: "ilimitada", label: "Bebida ilimitada" },
];

function uid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function withSectionPositions(sections: EditorSection[]): EditorSection[] {
  return sections.map((sec, idx) => (sec.position === idx ? sec : { ...sec, position: idx }));
}

function withDishPositions(dishes: EditorDish[]): EditorDish[] {
  return dishes.map((dish, idx) => (dish.position === idx ? dish : { ...dish, position: idx }));
}

function orderByClientId<T extends { clientId: string }>(items: T[], orderedClientIds: string[]): T[] {
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

function ReorderItemContainer({ as = "div", value, className, transition, whileDrag, children }: ReorderItemContainerProps) {
  const dragControls = useDragControls();

  const startDrag = useCallback(
    (event: React.PointerEvent<Element>) => {
      dragControls.start(event);
    },
    [dragControls],
  );

  return (
    <Reorder.Item
      as={as}
      value={value}
      className={className}
      dragListener={false}
      dragControls={dragControls}
      transition={transition}
      whileDrag={whileDrag}
    >
      {children(startDrag)}
    </Reorder.Item>
  );
}

function toNumOrNull(raw: string): number | null {
  const s = raw.trim();
  if (!s) return null;
  const n = Number(s.replace(",", "."));
  if (!Number.isFinite(n)) return null;
  return n;
}

function buildBasicsPayload(draft: BasicsDraft): BasicsPayload {
  return {
    menu_title: draft.title.trim() || "Nuevo menu",
    price: toNumOrNull(draft.price) ?? 0,
    active: draft.active,
    menu_type: draft.menuType,
    menu_subtitle: draft.subtitles.map((s) => s.trim()).filter(Boolean),
    included_coffee: draft.includedCoffee,
    beverage: {
      type: draft.beverageType,
      price_per_person: draft.beverageType === "no_incluida" ? null : toNumOrNull(draft.beveragePrice),
      has_supplement: draft.beverageType === "ilimitada" ? draft.beverageHasSupplement : false,
      supplement_price: draft.beverageType === "ilimitada" && draft.beverageHasSupplement ? toNumOrNull(draft.beverageSupplementPrice) : null,
    },
    comments: draft.comments.map((s) => s.trim()).filter(Boolean),
    min_party_size: Math.max(1, Number(draft.minPartySize) || 1),
    main_dishes_limit: draft.mainLimit,
    main_dishes_limit_number: Math.max(1, Number(draft.mainLimitNum) || 1),
  };
}

function getSectionsFingerprint(sections: EditorSection[]): string {
  return JSON.stringify(
    sections.map((sec) => ({
      id: sec.id || null,
      title: sec.title,
      kind: sec.kind,
      dishes: sec.dishes.map((d) => ({
        id: d.id || null,
        catalog: d.catalog_dish_id || null,
        title: d.title,
        desc: d.description,
        allergens: d.allergens,
        supp: d.supplement_enabled,
        suppPrice: d.supplement_price,
        active: d.active,
      })),
    })),
  );
}

function mapApiDish(d: GroupMenuV2Dish, prev?: EditorDish): EditorDish {
  return {
    clientId: prev?.clientId || uid("dish"),
    id: d.id,
    catalog_dish_id: d.catalog_dish_id ?? null,
    title: d.title,
    description: d.description,
    allergens: d.allergens || [],
    supplement_enabled: !!d.supplement_enabled,
    supplement_price: d.supplement_price ?? null,
    price: d.price ?? null,
    active: d.active !== false,
    position: d.position || 0,
  };
}

function mapApiSection(s: GroupMenuV2Section, prev?: EditorSection): EditorSection {
  const prevDishByID = new Map<number, EditorDish>();
  for (const dish of prev?.dishes || []) {
    if (dish.id) prevDishByID.set(dish.id, dish);
  }

  return {
    clientId: prev?.clientId || uid("section"),
    id: s.id,
    title: s.title,
    kind: s.kind,
    position: s.position || 0,
    expanded: prev?.expanded ?? true,
    dishes: (s.dishes || []).map((dish) => mapApiDish(dish, dish.id ? prevDishByID.get(dish.id) : undefined)),
  };
}

function mapApiMenu(menu: GroupMenuV2, prevSections: EditorSection[] = []): {
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
    min_party_size: number;
    main_dishes_limit: boolean;
    main_dishes_limit_number: number;
  };
} {
  const prevByID = new Map<number, EditorSection>();
  for (const sec of prevSections) {
    if (sec.id) prevByID.set(sec.id, sec);
  }

  const sections = (menu.sections || []).map((sec) => mapApiSection(sec, sec.id ? prevByID.get(sec.id) : undefined));

  return {
    title: menu.menu_title || "",
    price: menu.price || "0",
    active: !!menu.active,
    menuType: menu.menu_type || "closed_conventional",
    subtitles: menu.menu_subtitle || [],
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
      min_party_size: menu.settings?.min_party_size || 8,
      main_dishes_limit: !!menu.settings?.main_dishes_limit,
      main_dishes_limit_number: menu.settings?.main_dishes_limit_number || 1,
    },
  };
}

export default function Page() {
  const pageContext = usePageContext();
  const data = pageContext.data as PageData;
  const api = useMemo(() => createClient({ baseUrl: "" }), []);
  const { pushToast } = useToasts();

  const [error, setError] = useState<string | null>(data.error);
  useErrorToast(error);
  const [menuId, setMenuId] = useState<number | null>(data.menu?.id ?? null);

  const [step, setStep] = useState<number>(data.menu ? 3 : 0);
  const [menuType, setMenuType] = useState<string>(data.menu?.menu_type || "closed_conventional");
  const [title, setTitle] = useState<string>(data.menu?.menu_title || "");
  const [price, setPrice] = useState<string>(data.menu?.price || "0");
  const [subtitles, setSubtitles] = useState<string[]>(data.menu?.menu_subtitle?.length ? data.menu.menu_subtitle : [""]);
  const [active, setActive] = useState<boolean>(data.menu?.active ?? false);
  const [sections, setSections] = useState<EditorSection[]>([]);

  const [includedCoffee, setIncludedCoffee] = useState<boolean>(false);
  const [beverageType, setBeverageType] = useState<string>(DEFAULT_BEVERAGE.type);
  const [beveragePrice, setBeveragePrice] = useState<string>("");
  const [beverageHasSupplement, setBeverageHasSupplement] = useState<boolean>(false);
  const [beverageSupplementPrice, setBeverageSupplementPrice] = useState<string>("");
  const [minPartySize, setMinPartySize] = useState<string>("8");
  const [mainLimit, setMainLimit] = useState<boolean>(false);
  const [mainLimitNum, setMainLimitNum] = useState<string>("1");
  const [comments, setComments] = useState<string[]>([""]);
  const [specialMenuImage, setSpecialMenuImage] = useState<string | null>(null);

  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [busy, setBusy] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [mobileTab, setMobileTab] = useState<"editor" | "preview">("editor");
  const [desktopPreviewOpen, setDesktopPreviewOpen] = useState(true);
  const [desktopPreviewDocked, setDesktopPreviewDocked] = useState(true);
  const [previewOrigin, setPreviewOrigin] = useState<string>((import.meta as any).env?.VITE_PREVIEW_WEB_ORIGIN || "http://localhost:5173");

  const [allergenModal, setAllergenModal] = useState<{ open: boolean; sectionClientId: string; dishClientId: string } | null>(null);
  const [searchTerms, setSearchTerms] = useState<Record<string, string>>({});
  const [searchResults, setSearchResults] = useState<Record<string, DishCatalogItem[]>>({});

  const searchTimerRef = useRef<Record<string, number>>({});
  const previewDockTimerRef = useRef<number | null>(null);
  const syncTimerRef = useRef<number | null>(null);
  const basicsTimerRef = useRef<number | null>(null);
  const lastSavedBasicsRef = useRef<string>("");
  const inFlightBasicsRef = useRef<string | null>(null);
  const lastSavedSectionsRef = useRef<string>("");
  const inFlightSectionsRef = useRef<string | null>(null);

  const steps = [0, 1, 2, 3];

  const isALaCarte = menuType === "a_la_carte" || menuType === "a_la_carte_group";
  const isSpecial = menuType === "special";

  const basicsDraft = useMemo<BasicsDraft>(
    () => ({
      title,
      price,
      active,
      menuType,
      subtitles,
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
    [
      active,
      beverageHasSupplement,
      beveragePrice,
      beverageSupplementPrice,
      beverageType,
      comments,
      includedCoffee,
      mainLimit,
      mainLimitNum,
      menuType,
      minPartySize,
      price,
      subtitles,
      title,
    ],
  );
  const basicsPayload = useMemo(() => buildBasicsPayload(basicsDraft), [basicsDraft]);
  const basicsFingerprint = useMemo(() => JSON.stringify(basicsPayload), [basicsPayload]);
  const sectionsFingerprint = useMemo(() => getSectionsFingerprint(sections), [sections]);
  const shouldReduceMotion = useReducedMotion();
  const sectionOrder = useMemo(() => sections.map((sec) => sec.clientId), [sections]);
  const paneLayoutTransition = useMemo(
    () =>
      shouldReduceMotion
        ? { duration: 0 }
        : {
            duration: 0.6,
            ease: [0.22, 1, 0.36, 1] as const,
          },
    [shouldReduceMotion],
  );
  const reorderTransition = useMemo(
    () =>
      shouldReduceMotion
        ? { duration: 0 }
        : {
            type: "spring",
            stiffness: 420,
            damping: 32,
            mass: 0.38,
          },
    [shouldReduceMotion],
  );
  const reorderWhileDrag = useMemo(
    () =>
      shouldReduceMotion
        ? undefined
        : {
            scale: 1.012,
            borderColor: "rgba(185, 168, 255, 0.56)",
            boxShadow: "0 16px 34px rgba(8, 10, 20, 0.5)",
          },
    [shouldReduceMotion],
  );
  const chevronHover = shouldReduceMotion ? undefined : { scale: 1.05 };
  const chevronTapUp = shouldReduceMotion ? undefined : { scale: 0.9, y: -2 };
  const chevronTapDown = shouldReduceMotion ? undefined : { scale: 0.9, y: 2 };

  useEffect(() => {
    if (!data.menu) {
      lastSavedBasicsRef.current = "";
      inFlightBasicsRef.current = null;
      lastSavedSectionsRef.current = "";
      inFlightSectionsRef.current = null;
      setHydrated(true);
      return;
    }

    const mapped = mapApiMenu(data.menu, sections);
    setTitle(mapped.title);
    setPrice(mapped.price);
    setActive(mapped.active);
    setMenuType(mapped.menuType);
    setSubtitles(mapped.subtitles.length ? mapped.subtitles : [""]);
    setSections(mapped.sections);
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
      title: mapped.title,
      price: mapped.price,
      active: mapped.active,
      menuType: mapped.menuType,
      subtitles: mapped.subtitles.length ? mapped.subtitles : [""],
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
    inFlightBasicsRef.current = null;
    inFlightSectionsRef.current = null;
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (previewDockTimerRef.current) {
      window.clearTimeout(previewDockTimerRef.current);
      previewDockTimerRef.current = null;
    }

    if (desktopPreviewOpen) {
      setDesktopPreviewDocked(true);
      return;
    }

    // Keep the preview docked while it fades out, then collapse the layout.
    setDesktopPreviewDocked(true);
    previewDockTimerRef.current = window.setTimeout(() => {
      setDesktopPreviewDocked(false);
      previewDockTimerRef.current = null;
    }, 600);

    return () => {
      if (previewDockTimerRef.current) {
        window.clearTimeout(previewDockTimerRef.current);
        previewDockTimerRef.current = null;
      }
    };
  }, [desktopPreviewOpen]);

  const previewUrl = useMemo(() => {
    const q = new URLSearchParams();
    q.set("boPreview", "1");
    if (menuId) q.set("menuId", String(menuId));
    q.set("_bo_preview_origin", previewOrigin);
    return `/preview-web/menufindesemana?${q.toString()}`;
  }, [menuId, previewOrigin]);

  const patchBasics = useCallback(
    async ({ payload, fingerprint, force = false }: { payload: BasicsPayload; fingerprint: string; force?: boolean }) => {
      if (!menuId) return;

      if (!force && (lastSavedBasicsRef.current === fingerprint || inFlightBasicsRef.current === fingerprint)) {
        return;
      }

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

  const syncSectionsAndDishes = useCallback(
    async ({
      sectionsSnapshot,
      fingerprint,
      force = false,
    }: {
      sectionsSnapshot: EditorSection[];
      fingerprint: string;
      force?: boolean;
    }) => {
      if (!menuId || sectionsSnapshot.length === 0) return;

      if (!force && (lastSavedSectionsRef.current === fingerprint || inFlightSectionsRef.current === fingerprint)) {
        return;
      }

      inFlightSectionsRef.current = fingerprint;
      setSaveState("saving");

      try {
        const structure = sectionsSnapshot.map((sec, idx) => ({
          id: sec.id,
          title: sec.title.trim() || "Seccion",
          kind: sec.kind,
          position: idx,
        }));

        const resSections = await api.menus.gruposV2.putSections(menuId, structure);
        if (!resSections.success) {
          throw new Error(resSections.message || "No se pudieron guardar las secciones");
        }

        const rebuilt = (resSections.sections || []).map((sec, idx) => {
          const local = sectionsSnapshot[idx];
          const mapped = mapApiSection(sec, local);
          mapped.dishes = (local?.dishes || []).map((d, dIdx) => ({ ...d, position: dIdx }));
          return mapped;
        });

        for (const section of rebuilt) {
          if (!section.id) continue;

          const payloadDishes: Array<{
            id?: number;
            catalog_dish_id?: number | null;
            title: string;
            description: string;
            allergens: string[];
            supplement_enabled: boolean;
            supplement_price: number | null;
            price: number | null;
            active: boolean;
          }> = [];

          for (const dish of section.dishes) {
            const trimmedTitle = dish.title.trim();
            if (!trimmedTitle) continue;

            let catalogId = dish.catalog_dish_id ?? null;
            if (!catalogId) {
              const upsert = await api.menus.dishesCatalog.upsert({
                id: undefined,
                title: trimmedTitle,
                description: dish.description.trim(),
                allergens: dish.allergens,
                default_supplement_enabled: dish.supplement_enabled,
                default_supplement_price: dish.supplement_price,
              });
              if (upsert.success) {
                catalogId = upsert.dish.id;
              }
            }

            payloadDishes.push({
              id: dish.id,
              catalog_dish_id: catalogId,
              title: trimmedTitle,
              description: dish.description,
              allergens: dish.allergens,
              supplement_enabled: dish.supplement_enabled,
              supplement_price: dish.supplement_price,
              price: isALaCarte ? dish.price : null,
              active: dish.active,
            });
          }

          const saved = await api.menus.gruposV2.putSectionDishes(menuId, section.id, payloadDishes);
          if (!saved.success) {
            throw new Error(saved.message || "No se pudieron guardar los platos");
          }

          section.dishes = (saved.dishes || []).map((dish) => {
            const prev = section.dishes.find((x) => x.id === dish.id);
            return mapApiDish(dish, prev);
          });
        }

        setSections(rebuilt);
        lastSavedSectionsRef.current = getSectionsFingerprint(rebuilt);
        setSaveState("saved");
      } finally {
        if (inFlightSectionsRef.current === fingerprint) {
          inFlightSectionsRef.current = null;
        }
      }
    },
    [api, menuId],
  );

  useEffect(() => {
    if (!hydrated || !menuId || step < 1) return;
    if (lastSavedBasicsRef.current === basicsFingerprint || inFlightBasicsRef.current === basicsFingerprint) return;

    if (basicsTimerRef.current) window.clearTimeout(basicsTimerRef.current);
    basicsTimerRef.current = window.setTimeout(() => {
      void patchBasics({ payload: basicsPayload, fingerprint: basicsFingerprint });
    }, 500);

    return () => {
      if (basicsTimerRef.current) window.clearTimeout(basicsTimerRef.current);
    };
  }, [basicsFingerprint, basicsPayload, hydrated, menuId, patchBasics, step]);

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

    return () => {
      if (syncTimerRef.current) window.clearTimeout(syncTimerRef.current);
    };
  }, [hydrated, menuId, pushToast, sections, sectionsFingerprint, step, syncSectionsAndDishes]);

  const createDraftAndContinue = useCallback(async () => {
    setBusy(true);
    try {
      const created = await api.menus.gruposV2.createDraft({ menu_type: menuType });
      if (!created.success) throw new Error(created.message || "No se pudo crear borrador");

      const loaded = await api.menus.gruposV2.get(created.menu_id);
      if (!loaded.success) throw new Error(loaded.message || "No se pudo cargar borrador");

      const mapped = mapApiMenu(loaded.menu);
      setMenuId(created.menu_id);
      setTitle(mapped.title);
      setPrice(mapped.price || "0");
      setActive(mapped.active);
      setSubtitles(mapped.subtitles.length ? mapped.subtitles : [""]);
      setSections(mapped.sections);
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
        title: mapped.title,
        price: mapped.price || "0",
        active: mapped.active,
        menuType: mapped.menuType,
        subtitles: mapped.subtitles.length ? mapped.subtitles : [""],
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
      inFlightSectionsRef.current = null;
      setSaveState("idle");

      window.history.replaceState({}, "", `/app/menus/crear?menuId=${created.menu_id}`);
      setStep(1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo crear borrador");
    } finally {
      setBusy(false);
    }
  }, [api, menuType]);

  const addSection = useCallback(() => {
    setSections((prev) => [
      ...prev,
      {
        clientId: uid("section"),
        title: "Nueva seccion",
        kind: "custom",
        position: prev.length,
        dishes: [],
        expanded: true,
      },
    ]);
  }, []);

  const removeSection = useCallback((clientId: string) => {
    setSections((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((s) => s.clientId !== clientId).map((s, i) => ({ ...s, position: i }));
    });
  }, []);

  const updateSection = useCallback((clientId: string, patch: Partial<EditorSection>) => {
    setSections((prev) => prev.map((sec) => (sec.clientId === clientId ? { ...sec, ...patch } : sec)));
  }, []);

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

  const reorderSections = useCallback((orderedClientIds: string[]) => {
    setSections((prev) => withSectionPositions(orderByClientId(prev, orderedClientIds)));
  }, []);

  const addDish = useCallback((sectionClientId: string, fromCatalog?: DishCatalogItem) => {
    setSections((prev) =>
      prev.map((sec) => {
        if (sec.clientId !== sectionClientId) return sec;
        const dish: EditorDish = {
          clientId: uid("dish"),
          id: undefined,
          catalog_dish_id: fromCatalog?.id,
          title: fromCatalog?.title || "Nuevo plato",
          description: fromCatalog?.description || "",
          allergens: fromCatalog?.allergens || [],
          supplement_enabled: fromCatalog?.default_supplement_enabled || false,
          supplement_price: fromCatalog?.default_supplement_price ?? null,
          price: isALaCarte ? 0 : null,
          active: true,
          position: sec.dishes.length,
        };
        return { ...sec, dishes: [...sec.dishes, dish] };
      }),
    );
  }, [isALaCarte]);

  const updateDish = useCallback((sectionClientId: string, dishClientId: string, patch: Partial<EditorDish>) => {
    setSections((prev) =>
      prev.map((sec) => {
        if (sec.clientId !== sectionClientId) return sec;
        return {
          ...sec,
          dishes: sec.dishes.map((dish) => (dish.clientId === dishClientId ? { ...dish, ...patch } : dish)),
        };
      }),
    );
  }, []);

  const removeDish = useCallback((sectionClientId: string, dishClientId: string) => {
    setSections((prev) =>
      prev.map((sec) => {
        if (sec.clientId !== sectionClientId) return sec;
        return {
          ...sec,
          dishes: sec.dishes
            .filter((dish) => dish.clientId !== dishClientId)
            .map((dish, idx) => ({ ...dish, position: idx })),
        };
      }),
    );
  }, []);

  const reorderDishes = useCallback((sectionClientId: string, orderedClientIds: string[]) => {
    setSections((prev) =>
      prev.map((sec) => {
        if (sec.clientId !== sectionClientId) return sec;
        return {
          ...sec,
          dishes: withDishPositions(orderByClientId(sec.dishes, orderedClientIds)),
        };
      }),
    );
  }, []);

  const handleSearch = useCallback(
    (sectionClientId: string, term: string) => {
      setSearchTerms((prev) => ({ ...prev, [sectionClientId]: term }));

      const existing = searchTimerRef.current[sectionClientId];
      if (existing) window.clearTimeout(existing);

      if (term.trim().length < 2) {
        setSearchResults((prev) => ({ ...prev, [sectionClientId]: [] }));
        return;
      }

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

  const onPublish = useCallback(async () => {
    if (!menuId) return;
    setBusy(true);
    try {
      await patchBasics({ payload: basicsPayload, fingerprint: basicsFingerprint, force: true });
      await syncSectionsAndDishes({ sectionsSnapshot: sections, fingerprint: sectionsFingerprint, force: true });
      const res = await api.menus.gruposV2.publish(menuId);
      if (!res.success) throw new Error(res.message || "No se pudo publicar");
      pushToast({ kind: "success", title: "Menu guardado" });
      window.location.href = "/app/menus";
    } catch (e) {
      pushToast({ kind: "error", title: "Error", message: e instanceof Error ? e.message : "No se pudo publicar" });
    } finally {
      setBusy(false);
    }
  }, [api, basicsFingerprint, basicsPayload, menuId, patchBasics, pushToast, sections, sectionsFingerprint, syncSectionsAndDishes]);

  return (
    <section className="bo-menuWizardPage" aria-label="Editor de menu">
      <div className="bo-menuWizardTop">
        <button className="bo-btn bo-btn--ghost" type="button" onClick={() => (window.location.href = "/app/menus")}>
          <ArrowLeft size={16} /> Volver a menus
        </button>
        <div className={`bo-saveTag is-${saveState}`}>{saveState === "saving" ? "Guardando..." : saveState === "saved" ? "Guardado" : saveState === "error" ? "Error guardando" : ""}</div>
      </div>

      <div className="bo-stepBars" role="progressbar" aria-valuemin={1} aria-valuemax={4} aria-valuenow={step + 1}>
        {steps.map((idx) => (
          <div key={idx} className={`bo-stepBar ${idx === step ? "is-active" : ""} ${idx < step ? "is-done" : ""}`} />
        ))}
      </div>

      {step === 0 ? (
        <div className="bo-menuWizardPanel">
          <h2 className="bo-sectionTitle">Tipo de menu</h2>
          <div className="bo-typeGrid">
            {MENU_TYPES.map((opt) => (
              <button
                key={opt.value}
                className={`bo-typeCard ${menuType === opt.value ? "is-selected" : ""}`}
                type="button"
                disabled={!opt.enabled || busy}
                onClick={() => setMenuType(opt.value)}
              >
                <div className="bo-typeTitle">{opt.label}</div>
                {!opt.enabled ? <div className="bo-typeSoon">Proximamente</div> : null}
              </button>
            ))}
          </div>
          <div className="bo-menuWizardActions">
            <button className="bo-btn bo-btn--primary" type="button" disabled={busy} onClick={() => void createDraftAndContinue()}>
              Continuar
            </button>
          </div>
        </div>
      ) : null}

      {step === 1 ? (
        <div className="bo-menuWizardPanel">
          <h2 className="bo-sectionTitle">Datos basicos</h2>
          <div className="bo-form bo-form--menuWizard">
            <div className="bo-field">
              <div className="bo-label">Titulo</div>
              <input className="bo-input" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>

            {!isALaCarte && !isSpecial ? (
              <div className="bo-field">
                <div className="bo-label">Precio</div>
                <input className="bo-input" value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" />
              </div>
            ) : null}

            {isSpecial ? (
              <div className="bo-field">
                <div className="bo-label">¿Tiene precio fijo?</div>
                <Switch checked={!!Number(price)} onCheckedChange={(checked) => setPrice(checked ? "0" : "")} />
                {Number(price) > 0 && (
                  <input
                    className="bo-input"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    inputMode="decimal"
                    placeholder="Precio"
                    style={{ marginTop: 8 }}
                  />
                )}
              </div>
            ) : null}

            <div className="bo-field">
              <div className="bo-label">Activo</div>
              <Switch checked={active} onCheckedChange={setActive} />
            </div>

            {!isSpecial ? (
              <div className="bo-field bo-field--full">
                <div className="bo-label">Subtitulos</div>
                <div className="bo-stackFields">
                  {subtitles.map((line, idx) => (
                    <div key={`subtitle-${idx}`} className="bo-inlineField">
                      <input
                        className="bo-input"
                        value={line}
                        onChange={(e) => {
                          const next = [...subtitles];
                          next[idx] = e.target.value;
                          setSubtitles(next);
                        }}
                      />
                      <button
                        className="bo-btn bo-btn--ghost"
                        type="button"
                        aria-label={`Eliminar subtitulo ${idx + 1}`}
                        disabled={subtitles.length <= 1}
                        onClick={() => setSubtitles((prev) => prev.filter((_, i) => i !== idx))}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                  <button className="bo-btn bo-btn--ghost" type="button" onClick={() => setSubtitles((prev) => [...prev, ""])}>
                    <Plus size={14} /> Añadir subtitulo
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          <div className="bo-menuWizardActions">
            <button className="bo-btn bo-btn--ghost" type="button" onClick={() => setStep(0)}>
              Volver
            </button>
            <button
              className="bo-btn bo-btn--primary"
              type="button"
              onClick={() => {
                if (!title.trim()) {
                  pushToast({ kind: "error", title: "Titulo", message: "El titulo es obligatorio" });
                  return;
                }
                if (isSpecial) {
                  setStep(4);
                } else {
                  setStep(2);
                }
              }}
            >
              Continuar
            </button>
          </div>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="bo-menuWizardPanel">
          <h2 className="bo-sectionTitle">Secciones del menu</h2>

          <Reorder.Group axis="y" values={sectionOrder} onReorder={reorderSections} className="bo-sectionsBoard bo-reorderGroup">
            {sections.map((sec, idx) => (
              <ReorderItemContainer
                key={sec.clientId}
                as="div"
                value={sec.clientId}
                className="bo-sectionCard bo-reorderItem"
                transition={reorderTransition}
                whileDrag={reorderWhileDrag}
              >
                {(startDrag) => (
                  <div className="bo-sectionCardHead">
                    <div className="bo-sectionReorder">
                      <div className="bo-sectionMoveControls">
                        <motion.button
                          className="bo-sectionMoveBtn"
                          type="button"
                          aria-label={`Subir seccion ${sec.title || idx + 1}`}
                          disabled={idx === 0}
                          whileHover={chevronHover}
                          whileTap={chevronTapUp}
                          onPointerDown={(event) => event.stopPropagation()}
                          onClick={() => moveSection(idx, idx - 1)}
                        >
                          <ChevronUp size={14} />
                        </motion.button>
                        <motion.button
                          className="bo-sectionMoveBtn"
                          type="button"
                          aria-label={`Bajar seccion ${sec.title || idx + 1}`}
                          disabled={idx === sections.length - 1}
                          whileHover={chevronHover}
                          whileTap={chevronTapDown}
                          onPointerDown={(event) => event.stopPropagation()}
                          onClick={() => moveSection(idx, idx + 1)}
                        >
                          <ChevronDown size={14} />
                        </motion.button>
                      </div>
                      <button
                        className="bo-sectionDrag"
                        type="button"
                        aria-label={`Arrastrar seccion ${sec.title || idx + 1}`}
                        onPointerDown={(event) => {
                          event.preventDefault();
                          startDrag(event);
                        }}
                      >
                        <GripVertical size={18} />
                      </button>
                    </div>
                    <input className="bo-input" value={sec.title} onChange={(e) => updateSection(sec.clientId, { title: e.target.value })} />
                    {!isALaCarte ? (
                      <Select
                        className="bo-sectionKindSelect"
                        value={sec.kind}
                        onChange={(value) => updateSection(sec.clientId, { kind: value })}
                        options={sectionKindOptions}
                        size="sm"
                        ariaLabel={`Tipo de seccion ${sec.title || idx + 1}`}
                      />
                    ) : null}
                    <button
                      className="bo-btn bo-btn--ghost"
                      type="button"
                      aria-label={`Eliminar seccion ${sec.title || idx + 1}`}
                      disabled={sections.length <= 1}
                      onClick={() => removeSection(sec.clientId)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </ReorderItemContainer>
            ))}
          </Reorder.Group>

          <div className="bo-menuWizardActions">
            <button className="bo-btn bo-btn--ghost" type="button" onClick={addSection}>
              <Plus size={14} /> Añadir seccion
            </button>
            <div className="bo-menuWizardActionsRight">
              <button className="bo-btn bo-btn--ghost" type="button" onClick={() => setStep(1)}>
                Volver
              </button>
              <button className="bo-btn bo-btn--primary" type="button" onClick={() => setStep(3)}>
                Continuar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {step === 3 ? (
        <div
          className={[
            "bo-menuWizardFinal",
            desktopPreviewOpen ? "" : "is-previewHidden",
            desktopPreviewDocked ? "" : "is-previewUndocked",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <div className="bo-previewDesktopSwitch">
            <span className="bo-previewDesktopSwitchLabel">
              <Eye size={14} aria-hidden="true" />
              Preview web
            </span>
            <Switch
              checked={desktopPreviewOpen}
              onCheckedChange={setDesktopPreviewOpen}
              aria-label={desktopPreviewOpen ? "Ocultar preview web" : "Mostrar preview web"}
            />
          </div>

          <div className="bo-previewSwitchGlass">
            <button className={`bo-previewSwitchBtn ${mobileTab === "editor" ? "is-active" : ""}`} type="button" onClick={() => setMobileTab("editor")}>
              <PencilLine size={14} aria-hidden="true" />
              <span>Editor</span>
            </button>
            <button className={`bo-previewSwitchBtn ${mobileTab === "preview" ? "is-active" : ""}`} type="button" onClick={() => setMobileTab("preview")}>
              <Eye size={14} aria-hidden="true" />
              <span>Preview</span>
            </button>
          </div>

          <motion.div layout transition={paneLayoutTransition} className={`bo-editorPane ${mobileTab === "editor" ? "is-mobileActive" : ""}`}>
            <motion.div layout transition={paneLayoutTransition} className="bo-panel bo-menuEditorHead">
              <div className="bo-panelHead">
                <div>
                  <div className="bo-panelTitle">Editor de menu</div>
                  <div className="bo-panelMeta">Titulo, subtitulos y precio siguen editables</div>
                </div>
              </div>
              <div className="bo-panelBody bo-form bo-form--menuWizard">
                <div className="bo-field">
                  <div className="bo-label">Titulo</div>
                  <input className="bo-input" value={title} onChange={(e) => setTitle(e.target.value)} />
                </div>
                <div className="bo-field">
                  <div className="bo-label">Precio</div>
                  <input className="bo-input" value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" />
                </div>
                <div className="bo-field bo-field--full">
                  <div className="bo-label">Subtitulos</div>
                  <div className="bo-stackFields">
                    {subtitles.map((line, idx) => (
                      <div key={`subtitle-final-${idx}`} className="bo-inlineField">
                        <input
                          className="bo-input"
                          value={line}
                          onChange={(e) => {
                            const next = [...subtitles];
                            next[idx] = e.target.value;
                            setSubtitles(next);
                          }}
                        />
                        <button
                          className="bo-btn bo-btn--ghost"
                          type="button"
                          aria-label={`Eliminar subtitulo ${idx + 1}`}
                          disabled={subtitles.length <= 1}
                          onClick={() => setSubtitles((prev) => prev.filter((_, i) => i !== idx))}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                    <button className="bo-btn bo-btn--ghost" type="button" onClick={() => setSubtitles((prev) => [...prev, ""])}>
                      <Plus size={14} /> Añadir subtitulo
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>

            <Reorder.Group axis="y" values={sectionOrder} onReorder={reorderSections} className="bo-sectionsEditor bo-reorderGroup">
              {sections.map((sec, secIdx) => (
                <ReorderItemContainer
                  key={sec.clientId}
                  as="div"
                  value={sec.clientId}
                  className="bo-panel bo-accordionSection bo-reorderItem"
                  transition={reorderTransition}
                  whileDrag={reorderWhileDrag}
                >
                  {(startSectionDrag) => (
                    <>
                      <div className="bo-accordionHeadRow">
                        <div className="bo-sectionReorder bo-sectionReorder--accordion">
                          <div className="bo-sectionMoveControls">
                            <motion.button
                              className="bo-sectionMoveBtn"
                              type="button"
                              aria-label={`Subir seccion ${sec.title || secIdx + 1}`}
                              disabled={secIdx === 0}
                              whileHover={chevronHover}
                              whileTap={chevronTapUp}
                              onPointerDown={(event) => event.stopPropagation()}
                              onClick={() => moveSection(secIdx, secIdx - 1)}
                            >
                              <ChevronUp size={14} />
                            </motion.button>
                            <motion.button
                              className="bo-sectionMoveBtn"
                              type="button"
                              aria-label={`Bajar seccion ${sec.title || secIdx + 1}`}
                              disabled={secIdx === sections.length - 1}
                              whileHover={chevronHover}
                              whileTap={chevronTapDown}
                              onPointerDown={(event) => event.stopPropagation()}
                              onClick={() => moveSection(secIdx, secIdx + 1)}
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
                              startSectionDrag(event);
                            }}
                          >
                            <GripVertical size={18} />
                          </button>
                        </div>
                        <button
                          className="bo-accordionHead"
                          type="button"
                          onClick={() => updateSection(sec.clientId, { expanded: !sec.expanded })}
                        >
                          <span className="bo-accordionHeadLeft">
                            <input
                              className="bo-input"
                              value={sec.title}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => updateSection(sec.clientId, { title: e.target.value })}
                            />
                          </span>
                          {sec.expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                      </div>

                      {sec.expanded !== false ? (
                        <div className="bo-panelBody">
                          <Reorder.Group
                            axis="y"
                            values={sec.dishes.map((dish) => dish.clientId)}
                            onReorder={(orderedDishClientIds) => reorderDishes(sec.clientId, orderedDishClientIds)}
                            className="bo-dishesStack bo-reorderGroup"
                          >
                            {sec.dishes.map((dish, dishIdx) => (
                              <ReorderItemContainer
                                key={dish.clientId}
                                as="article"
                                value={dish.clientId}
                                className="bo-dishCard bo-reorderItem"
                                transition={reorderTransition}
                                whileDrag={reorderWhileDrag}
                              >
                                {(startDishDrag) => (
                                  <>
                                    <button
                                      className="bo-dishDrag"
                                      type="button"
                                      aria-label={`Arrastrar plato ${dish.title || dishIdx + 1}`}
                                      onPointerDown={(event) => {
                                        event.preventDefault();
                                        startDishDrag(event);
                                      }}
                                    >
                                      <GripVertical size={14} />
                                    </button>
                                    <div className="bo-dishFields">
                                      <input
                                        className="bo-input"
                                        value={dish.title}
                                        onChange={(e) => updateDish(sec.clientId, dish.clientId, { title: e.target.value })}
                                        placeholder="Titulo plato"
                                      />
                                      <textarea
                                        className="bo-input bo-textarea"
                                        value={dish.description}
                                        onChange={(e) => updateDish(sec.clientId, dish.clientId, { description: e.target.value })}
                                        placeholder="Descripcion"
                                      />

                                      {isALaCarte ? (
                                        <div className="bo-dishPriceRow">
                                          <label className="bo-label">Precio</label>
                                          <input
                                            className="bo-input bo-priceInput"
                                            inputMode="decimal"
                                            value={dish.price == null ? "" : String(dish.price)}
                                            onChange={(e) =>
                                              updateDish(sec.clientId, dish.clientId, {
                                                price: toNumOrNull(e.target.value),
                                              })
                                            }
                                            placeholder="0.00"
                                          />
                                        </div>
                                      ) : null}

                                      <div className="bo-dishRow">
                                        <label className="bo-checkRow">
                                          <Switch
                                            checked={dish.supplement_enabled}
                                            onCheckedChange={(checked) =>
                                              updateDish(sec.clientId, dish.clientId, {
                                                supplement_enabled: checked,
                                                supplement_price: checked ? dish.supplement_price : null,
                                              })
                                            }
                                          />
                                          <span>Suplemento</span>
                                        </label>
                                        {dish.supplement_enabled ? (
                                          <input
                                            className="bo-input bo-suppInput"
                                            inputMode="decimal"
                                            value={dish.supplement_price == null ? "" : String(dish.supplement_price)}
                                            onChange={(e) =>
                                              updateDish(sec.clientId, dish.clientId, {
                                                supplement_price: toNumOrNull(e.target.value),
                                              })
                                            }
                                            placeholder="0.00"
                                          />
                                        ) : null}

                                        <button
                                          className="bo-btn bo-btn--ghost"
                                          type="button"
                                          onClick={() => setAllergenModal({ open: true, sectionClientId: sec.clientId, dishClientId: dish.clientId })}
                                        >
                                          <Sparkles size={14} /> Alergenos
                                        </button>
                                        <button
                                          className="bo-btn bo-btn--ghost"
                                          type="button"
                                          aria-label={`Eliminar plato ${dish.title || dishIdx + 1}`}
                                          onClick={() => removeDish(sec.clientId, dish.clientId)}
                                        >
                                          <Trash2 size={14} />
                                        </button>
                                      </div>

                                      {dish.allergens.length > 0 ? (
                                        <div className="bo-allergenRow">
                                          {dish.allergens.map((name) => (
                                            <span key={`${dish.clientId}-${name}`} className="bo-allergenPill">
                                              {name}
                                            </span>
                                          ))}
                                        </div>
                                      ) : null}
                                    </div>
                                  </>
                                )}
                              </ReorderItemContainer>
                            ))}
                          </Reorder.Group>

                          <div className="bo-dishAddRow">
                            <button className="bo-btn bo-btn--ghost bo-btn--sm bo-dishAddBtn" type="button" onClick={() => addDish(sec.clientId)}>
                              <Plus size={12} /> Añadir plato
                            </button>
                          </div>

                          <div className="bo-searchCatalogRow">
                            <div className="bo-searchCatalogInputWrap">
                              <Search size={14} className="bo-searchCatalogIcon" aria-hidden="true" />
                              <input
                                className="bo-input bo-searchCatalogInput"
                                placeholder="Buscar plato en base de datos"
                                value={searchTerms[sec.clientId] || ""}
                                onChange={(e) => handleSearch(sec.clientId, e.target.value)}
                              />
                            </div>
                            {(searchResults[sec.clientId] || []).length > 0 ? (
                              <div className="bo-searchResults">
                                {(searchResults[sec.clientId] || []).map((item) => (
                                  <button
                                    key={`${sec.clientId}-${item.id}`}
                                    type="button"
                                    className="bo-searchResultBtn"
                                    onClick={() => addDish(sec.clientId, item)}
                                  >
                                    <span>{item.title}</span>
                                    <span className="bo-mutedText">Añadir</span>
                                  </button>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      ) : null}
                    </>
                  )}
                </ReorderItemContainer>
              ))}
            </Reorder.Group>

            <motion.div layout transition={paneLayoutTransition} className="bo-panel bo-settingsPanel">
              <div className="bo-panelHead">
                <div className="bo-panelTitle">
                  <Settings2 size={15} /> Configuracion
                </div>
              </div>
              <div className="bo-panelBody bo-form bo-form--menuWizard">
                <div className="bo-field">
                  <div className="bo-label">Bebida</div>
                  <Select
                    className="bo-menuSettingSelect"
                    value={beverageType}
                    onChange={setBeverageType}
                    options={beverageTypeOptions}
                    size="sm"
                    ariaLabel="Tipo de bebida"
                  />
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
                        <input
                          className="bo-input"
                          value={beverageSupplementPrice}
                          onChange={(e) => setBeverageSupplementPrice(e.target.value)}
                          inputMode="decimal"
                        />
                      </div>
                    ) : null}
                  </>
                ) : null}

                <div className="bo-field">
                  <div className="bo-label">Minimo personas para reservar</div>
                  <input className="bo-input" value={minPartySize} onChange={(e) => setMinPartySize(e.target.value)} inputMode="numeric" />
                </div>

                <div className="bo-field">
                  <div className="bo-label">Limite maximo de principales por mesa</div>
                  <Switch checked={mainLimit} onCheckedChange={setMainLimit} />
                </div>

                {mainLimit ? (
                  <div className="bo-field">
                    <div className="bo-label">Numero de principales</div>
                    <input className="bo-input" value={mainLimitNum} onChange={(e) => setMainLimitNum(e.target.value)} inputMode="numeric" />
                  </div>
                ) : null}

                <div className="bo-field">
                  <div className="bo-label">Cafe incluido</div>
                  <Switch checked={includedCoffee} onCheckedChange={setIncludedCoffee} />
                </div>

                <div className="bo-field bo-field--full">
                  <div className="bo-label">Comentarios</div>
                  <div className="bo-stackFields">
                    {comments.map((line, idx) => (
                      <div key={`comment-${idx}`} className="bo-inlineField">
                        <input
                          className="bo-input"
                          value={line}
                          onChange={(e) => {
                            const next = [...comments];
                            next[idx] = e.target.value;
                            setComments(next);
                          }}
                        />
                        <button
                          className="bo-btn bo-btn--ghost"
                          type="button"
                          aria-label={`Eliminar comentario ${idx + 1}`}
                          disabled={comments.length <= 1}
                          onClick={() => setComments((prev) => prev.filter((_, i) => i !== idx))}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                    <button className="bo-btn bo-btn--ghost bo-commentAddBtn" type="button" onClick={() => setComments((prev) => [...prev, ""])}>
                      <Plus size={14} /> Añadir comentario
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>

            <motion.div layout transition={paneLayoutTransition} className="bo-menuWizardActions bo-menuWizardActions--final">
              <button className="bo-btn bo-btn--ghost" type="button" onClick={() => setStep(2)} disabled={busy}>
                Volver
              </button>
              <button className="bo-btn bo-btn--primary" type="button" onClick={() => void onPublish()} disabled={busy}>
                <Check size={16} /> Añadir
              </button>
            </motion.div>
          </motion.div>

          <aside className={`bo-previewPane ${mobileTab === "preview" ? "is-mobileActive" : ""}`}>
            <div className="bo-previewHead">
              <div>
                <div className="bo-panelTitle">Preview web</div>
                <div className="bo-panelMeta">Plantilla menufindesemana en tiempo real</div>
              </div>
              <div className="bo-previewOriginSwitch">
                <button
                  className={`bo-chip bo-menuOriginChip ${previewOrigin.includes(":5173") ? "is-on" : ""}`}
                  type="button"
                  onClick={() => setPreviewOrigin("http://localhost:5173")}
                >
                  :5173
                </button>
                <button
                  className={`bo-chip bo-menuOriginChip ${previewOrigin.includes(":5174") ? "is-on" : ""}`}
                  type="button"
                  onClick={() => setPreviewOrigin("http://localhost:5174")}
                >
                  :5174
                </button>
              </div>
            </div>
            <iframe className="bo-previewFrame" title="Preview menu" src={previewUrl} />
          </aside>
        </div>
      ) : null}

      <Modal open={!!allergenModal?.open} title="Alergenos" onClose={() => setAllergenModal(null)} widthPx={620}>
        <div className="bo-modalHead">
          <div className="bo-modalTitle">Selecciona alergenos</div>
          <button className="bo-modalX" type="button" onClick={() => setAllergenModal(null)} aria-label="Cerrar">
            ×
          </button>
        </div>
        <div className="bo-modalBody">
          <div className="bo-allergenGrid">
            {ALLERGENS.map((item) => {
              const open = allergenModal;
              if (!open) return null;
              const sec = sections.find((s) => s.clientId === open.sectionClientId);
              const dish = sec?.dishes.find((d) => d.clientId === open.dishClientId);
              const selected = !!dish?.allergens.includes(item.key);
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
                  <span className="bo-allergenCircleIcon">{item.icon}</span>
                  <span className="bo-allergenCircleLabel">{item.key}</span>
                </button>
              );
            })}
          </div>
        </div>
      </Modal>

      {step === 4 && isSpecial ? (
        <div className="bo-menuWizardPanel">
          <h2 className="bo-sectionTitle">Imagen del menu</h2>
          <p className="bo-mutedText" style={{ marginBottom: 16 }}>
            Sube una imagen del menu especial (PDF, Word, imagen)
          </p>

          <div className="bo-specialImageUpload">
            {specialMenuImage ? (
              <div className="bo-specialImagePreview">
                <img src={specialMenuImage} alt="Menu especial" />
                <button
                  className="bo-btn bo-btn--ghost bo-btn--danger"
                  type="button"
                  onClick={() => setSpecialMenuImage(null)}
                >
                  <Trash2 size={14} /> Eliminar
                </button>
              </div>
            ) : (
              <div className="bo-specialImageDropzone">
                <Upload size={48} />
                <p>Arrastra una imagen o haz clic para seleccionar</p>
                <p className="bo-mutedText">PDF, Word, PNG, JPG hasta 10MB</p>
                <input
                  type="file"
                  accept="image/*,.pdf,.doc,.docx,.txt"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      // TODO: Handle file upload
                      setSpecialMenuImage(URL.createObjectURL(file));
                    }
                  }}
                />
              </div>
            )}
          </div>

          <div className="bo-menuWizardActions">
            <button className="bo-btn bo-btn--ghost" type="button" onClick={() => setStep(1)}>
              Volver
            </button>
            <button className="bo-btn bo-btn--primary" type="button" onClick={() => setStep(3)}>
              Continuar al editor
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
