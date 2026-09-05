import { describe, it, expect } from 'vitest'
import { buildPreviewMenuPayload, type BuildPreviewMenuPayloadInput } from '../buildPreviewMenuPayload'

const toNumOrNull = (raw: string) => {
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}

const identity: (values: string[] | null | undefined) => string[] = (values) => Array.isArray(values) ? values : []

const baseInput = (overrides: Partial<BuildPreviewMenuPayloadInput> = {}): BuildPreviewMenuPayloadInput => ({
  menuId: 1,
  title: 'Menu prueba',
  menuType: 'closed_group',
  price: '38',
  active: true,
  subtitles: ['Linea 1'],
  showDishImages: true,
  showSectionTabs: false,
  showMenuPreviewImage: false,
  menuPreviewImageUrl: '',
  menuPreviewAIRequested: false,
  menuPreviewAIGenerating: false,
  beverageType: 'opcion',
  beveragePrice: '8',
  beverageHasSupplement: false,
  beverageSupplementPrice: '',
  beverageOptions: [
    { id: 1, slug: 'agua', name: 'Agua', is_custom: false, selected: true },
    { id: 2, slug: 'refrescos', name: 'Refrescos', is_custom: false, selected: true },
    { id: 5, slug: 'vino', name: 'Vino', is_custom: false, selected: true },
    { id: 6, slug: 'cerveza-de-barril', name: 'Cerveza de barril', is_custom: false, selected: true },
  ],
  includedCoffee: true,
  minPartySize: '8',
  mainLimit: false,
  mainLimitNum: '1',
  comments: [''],
  specialMenuImage: null,
  menuAITracker: {},
  sections: [],
  normalizeSectionAnnotations: identity,
  menuAIDishesById: new Map(),
  toNumOrNull,
  ...overrides,
})

describe('buildPreviewMenuPayload (preview iframe payload builder)', () => {
  it('forwards the live beverage_options list into settings.beverage_options', () => {
    const out = buildPreviewMenuPayload(baseInput())
    expect(out.settings.beverage_options).toEqual([
      { id: 1, slug: 'agua', name: 'Agua', is_custom: false, selected: true },
      { id: 2, slug: 'refrescos', name: 'Refrescos', is_custom: false, selected: true },
      { id: 5, slug: 'vino', name: 'Vino', is_custom: false, selected: true },
      { id: 6, slug: 'cerveza-de-barril', name: 'Cerveza de barril', is_custom: false, selected: true },
    ])
  })

  it('reflects newly added custom beverages in the next render', () => {
    const out = buildPreviewMenuPayload(baseInput({
      beverageOptions: [
        { id: 1, slug: 'agua', name: 'Agua', is_custom: false, selected: true },
        { id: 64, slug: 'bebida-inventada', name: 'Bebida inventada', is_custom: true, selected: true },
      ],
    }))
    expect(out.settings.beverage_options).toEqual([
      { id: 1, slug: 'agua', name: 'Agua', is_custom: false, selected: true },
      { id: 64, slug: 'bebida-inventada', name: 'Bebida inventada', is_custom: true, selected: true },
    ])
  })

  it('emits an empty array when no options have been fetched yet', () => {
    const out = buildPreviewMenuPayload(baseInput({ beverageOptions: [] }))
    expect(out.settings.beverage_options).toEqual([])
  })

  it('coerces beverage.price_per_person and supplement_price via toNumOrNull', () => {
    const out = buildPreviewMenuPayload(baseInput({
      beveragePrice: '12.5',
      beverageSupplementPrice: '3',
    }))
    expect(out.settings.beverage.price_per_person).toBe(12.5)
    expect(out.settings.beverage.supplement_price).toBe(3)
  })

  it('passes through menu_type, active, included_coffee and other top-level fields', () => {
    const out = buildPreviewMenuPayload(baseInput({
      menuType: 'a_la_carte_group',
      active: false,
      includedCoffee: false,
      minPartySize: '12',
    }))
    expect(out.menu_type).toBe('a_la_carte_group')
    expect(out.active).toBe(false)
    expect(out.settings.included_coffee).toBe(false)
    expect(out.settings.min_party_size).toBe(12)
  })

  it('falls back to closed_conventional when menuType is empty', () => {
    const out = buildPreviewMenuPayload(baseInput({ menuType: '' }))
    expect(out.menu_type).toBe('closed_conventional')
  })

  it('maps sections and dishes with normalized AI tracker data', () => {
    const out = buildPreviewMenuPayload(baseInput({
      menuAIDishesById: new Map([
        [99, { ai_requested: true, ai_generating: true, ai_generated_img: '/ai/99.png' }],
      ]),
      sections: [{
        id: 'sec-1',
        title: 'Entrantes',
        kind: 'starters',
        position: 0,
        annotations: null,
        dishes: [{
          id: 99,
          title: 'Ensalada',
          description: 'Fresca',
          description_enabled: true,
          allergens: [],
          supplement_enabled: false,
          supplement_price: null,
          active: true,
          price: '0',
          position: 0,
          foto_url: null,
          ai_requested: false,
          ai_generating: false,
          ai_generated_img: null,
        }],
      }],
    }))
    expect(out.sections).toHaveLength(1)
    expect(out.sections[0].dishes[0]).toMatchObject({
      id: 99,
      title: 'Ensalada',
      ai_requested: true,
      ai_generating: true,
      ai_requested_img: true,
      ai_generating_img: true,
      ai_generated_img: '/ai/99.png',
    })
  })

  it('falls back to dish-level AI fields when no tracker entry matches the id', () => {
    const out = buildPreviewMenuPayload(baseInput({
      sections: [{
        id: 1, title: 'Principales', kind: 'mains', position: 0, annotations: null,
        dishes: [{
          id: 7, title: 'Paella', description: '', description_enabled: false,
          allergens: [], supplement_enabled: false, supplement_price: null,
          active: true, price: '0', position: 0, foto_url: null,
          ai_requested: true, ai_generating: false, ai_generated_img: '/ai/7.png',
        }],
      }],
    }))
    expect(out.sections[0].dishes[0].ai_requested_img).toBe(true)
    expect(out.sections[0].dishes[0].ai_generated_img).toBe('/ai/7.png')
  })
})
