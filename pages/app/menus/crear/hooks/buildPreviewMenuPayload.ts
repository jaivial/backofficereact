import type { BeverageOption } from '../types/menuEditor.types'

/**
 * Pure builder for the menu-preview iframe payload.
 *
 * Extracted from `useMenuEditor` to make the shape unit-testable and so
 * runtime.js consumers (the iframe) can be told the live `beverage_options`
 * without the React hook having to expose the full state slice.
 *
 * Mirrors the public-API menu payload shape used by preactvillacarmen
 * (see `PublicMenu` / `MenuCartaConvencional.beverageNote`). The iframe
 * reads `menu.settings.beverage` and `menu.settings.beverage_options` via
 * `groupBeverageLines(menu)` in `public/menu-preview/beverage-lines.js`.
 */

export type BuildPreviewMenuPayloadInput = {
  menuId: number | null
  title: string
  menuType: string
  price: string
  active: boolean
  subtitles: string[]
  showDishImages: boolean
  showMenuPreviewImage: boolean
  menuPreviewImageUrl: string
  menuPreviewAIRequested: boolean
  menuPreviewAIGenerating: boolean
  beverageType: string
  beveragePrice: string
  beverageHasSupplement: boolean
  beverageSupplementPrice: string
  beverageOptions: BeverageOption[]
  includedCoffee: boolean
  minPartySize: string
  mainLimit: boolean
  mainLimitNum: string
  comments: string[]
  specialMenuImage: string | null
  menuAITracker: unknown
  sections: Array<{
    id?: number | string | null
    title: string
    kind?: string
    position?: number
    annotations?: unknown
    dishes: Array<{
      id?: number | string | null
      title: string
      description?: string | null
      description_enabled?: boolean
      allergens?: unknown
      supplement_enabled?: boolean
      supplement_price?: number | string | null
      active?: boolean
      price?: number | string | null
      position?: number
      foto_url?: string | null
      ai_requested?: boolean
      ai_generating?: boolean
      ai_generated_img?: string | null
    }>
  }>
  normalizeSectionAnnotations: (values: string[] | null | undefined) => string[]
  menuAIDishesById: Map<number | string, {
    ai_requested?: boolean
    ai_generating?: boolean
    ai_generated_img?: string | null
  }>
  toNumOrNull: (raw: string) => number | null
}

export function buildPreviewMenuPayload(input: BuildPreviewMenuPayloadInput) {
  const {
    menuId,
    title,
    menuType,
    price,
    active,
    subtitles,
    showDishImages,
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
  } = input

  return {
    id: menuId,
    menu_title: title,
    menu_type: menuType || 'closed_conventional',
    price,
    active,
    menu_subtitle: subtitles,
    show_dish_images: showDishImages,
    show_menu_preview_image: showMenuPreviewImage,
    menu_preview_image_url: menuPreviewImageUrl || '',
    menu_preview_ai_requested: menuPreviewAIRequested,
    menu_preview_ai_generating: menuPreviewAIGenerating,
    ai_requested_img: menuPreviewAIRequested,
    ai_generating_img: menuPreviewAIGenerating,
    ai_generated_img: menuPreviewImageUrl || null,
    settings: {
      included_coffee: includedCoffee,
      beverage: {
        type: beverageType,
        price_per_person: toNumOrNull(beveragePrice),
        has_supplement: beverageHasSupplement,
        supplement_price: toNumOrNull(beverageSupplementPrice),
      },
      // Forward the live beverage option list so the preview iframe can
      // render custom beverages in the parenthetical line. Without this the
      // iframe used a hardcoded 4-default fallback.
      beverage_options: beverageOptions,
      comments,
      min_party_size: Number.parseInt(minPartySize || '0', 10) || 0,
      main_dishes_limit: mainLimit,
      main_dishes_limit_number: Number.parseInt(mainLimitNum || '0', 10) || 0,
    },
    ai_images: menuAITracker,
    sections: sections.map((section, sectionIdx) => ({
      id: section.id ?? null,
      title: section.title,
      kind: section.kind,
      position: section.position ?? sectionIdx,
      annotations: normalizeSectionAnnotations(section.annotations as string[] | null | undefined),
      dishes: section.dishes.map((dish, dishIdx) => {
        const tracked = dish.id != null ? menuAIDishesById.get(dish.id) : null
        const aiRequested = tracked?.ai_requested ?? dish.ai_requested
        const aiGenerating = tracked?.ai_generating ?? dish.ai_generating
        const aiGeneratedImg = tracked?.ai_generated_img ?? dish.ai_generated_img ?? null
        return {
          id: dish.id ?? null,
          title: dish.title,
          description: dish.description,
          description_enabled: dish.description_enabled,
          allergens: dish.allergens,
          supplement_enabled: dish.supplement_enabled,
          supplement_price: dish.supplement_price,
          active: dish.active,
          price: dish.price,
          position: dish.position ?? dishIdx,
          foto_url: dish.foto_url,
          ai_requested: aiRequested,
          ai_generating: aiGenerating,
          ai_requested_img: aiRequested,
          ai_generating_img: aiGenerating,
          ai_generated_img: aiGeneratedImg,
        }
      }),
    })),
    special_menu_image_url: specialMenuImage || '',
  }
}
