// Types for the menu editor page

export type EditorDish = {
  clientId: string;
  id?: number;
  catalog_dish_id?: number | null;
  title: string;
  description: string;
  description_enabled: boolean;
  allergens: string[];
  supplement_enabled: boolean;
  supplement_price: number | null;
  price: number | null;
  active: boolean;
  position: number;
  foto_url?: string;
  ai_requested: boolean;
  ai_generating: boolean;
  ai_generated_img?: string | null;
  same_day_booking_blocked?: boolean;
};

export type MenuAIDishTracker = {
  dish_id: number;
  ai_requested: boolean;
  ai_generating: boolean;
  ai_generated_img?: string | null;
};

export type MenuAITrackerState = {
  dishes: MenuAIDishTracker[];
};

export type MenuPreviewTrackerPatch = {
  show_menu_preview_image?: boolean;
  menu_preview_image_url?: string;
  ai_requested?: boolean;
  ai_generating?: boolean;
  ai_generated_img?: string | null;
};

export type MenuPreviewResolvedState = {
  showMenuPreviewImage: boolean;
  menuPreviewImageUrl: string;
  menuPreviewAIRequested: boolean;
  menuPreviewAIGenerating: boolean;
};

export type EditorSection = {
  clientId: string;
  id?: number;
  title: string;
  kind: string;
  position: number;
  annotations: string[];
  dishes: EditorDish[];
  expanded?: boolean;
  dishesLoaded?: boolean;
  dishesLoading?: boolean;
};

export type PersistedEditorSection = EditorSection & { id: number };
export type PersistedEditorDish = EditorDish & { id: number };

export type SaveState = "idle" | "saving" | "saved" | "error";

export type BasicsDraft = {
  title: string;
  price: string;
  active: boolean;
  menuType: string;
  subtitles: string[];
  showDishImages: boolean;
  showSectionTabs: boolean;
  showMenuPreviewImage: boolean;
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

export type BasicsPayload = {
  menu_title: string;
  price: number;
  active: boolean;
  menu_type: string;
  menu_subtitle: string[];
  show_dish_images: boolean;
  show_section_tabs: boolean;
  show_menu_preview_image: boolean;
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

export type PreviewThemeConfig = {
  assigned: boolean;
  default_theme_id: string;
  overrides: Record<string, string>;
  themes: { id: string; name?: string }[];
};

export type DishImageCropDraft = {
  sectionClientId: string;
  dishClientId: string;
  file: File;
  objectUrl: string;
};

export type MenuPreviewImageDraft = {
  file: File;
  objectUrl: string;
};

export type DishImageCropConfirm = {
  zoom: number;
  offsetX: number;
  offsetY: number;
  viewportSize: number;
};

export type SectionDishSyncState = {
  order: string;
  byId: Record<string, string>;
};

export type AllergenItem = {
  key: string;
  icon: React.ComponentType<{ size?: number }>;
};

export type BeverageOption = {
  id: number;
  slug: string;
  name: string;
  is_custom: boolean;
  selected: boolean;
};

export type BeverageDeleteTarget = {
  id: number;
  name: string;
};
