import { describe, it, expect } from 'vitest'
import { groupBeverageLines, formatEuro, selectedBeverageNames } from '../beverage-lines.js'

const beverage = (overrides = {}) => ({
  id: 1,
  slug: 'agua',
  name: 'Agua',
  is_custom: false,
  selected: true,
  ...overrides,
})

const menu = (overrides = {}) => ({
  settings: {
    beverage: { type: 'opcion', price_per_person: 8, has_supplement: false, supplement_price: null },
    beverage_options: [],
    ...overrides,
  },
})

describe('preview runtime — groupBeverageLines (regression for hardcoded parens)', () => {
  it('uses the 4-default fallback when no beverage_options are returned', () => {
    const lines = groupBeverageLines(menu())
    expect(lines).toHaveLength(4)
    expect(lines[0]).toBe('Opción a bebida ilimitada +8 € pax')
    expect(lines[3]).toBe('(Incluye agua, refrescos, cerveza de barril y vinos valencianos)')
  })

  it('reflects custom beverages in the parenthetical list when present', () => {
    const lines = groupBeverageLines(menu({
      beverage_options: [
        beverage({ name: 'Agua', selected: true }),
        beverage({ name: 'Refrescos', selected: true }),
        beverage({ name: 'Vino', selected: true }),
        beverage({ name: 'Cerveza de barril', selected: true }),
        beverage({ id: 64, slug: 'bebida-inventada', name: 'Bebida inventada', is_custom: true, selected: true }),
      ],
    }))
    expect(lines[3]).toBe('(Incluye Agua, Refrescos, Vino, Cerveza de barril, Bebida inventada)')
  })

  it('omits unselected custom beverages from the parenthetical list', () => {
    const lines = groupBeverageLines(menu({
      beverage_options: [
        beverage({ name: 'Agua', selected: true }),
        beverage({ id: 64, slug: 'bebida-inventada', name: 'Bebida inventada', is_custom: true, selected: false }),
        beverage({ id: 65, slug: 'hola-test', name: 'hola test', is_custom: true, selected: true }),
      ],
    }))
    expect(lines[3]).toBe('(Incluye Agua, hola test)')
  })

  it('renders the ilimitada variant with the same fallback behaviour', () => {
    const lines = groupBeverageLines(menu({
      beverage: { type: 'ilimitada', price_per_person: 10, has_supplement: false, supplement_price: null },
    }))
    expect(lines[0]).toBe('Bebida ilimitada +10 € pax')
    expect(lines[3]).toBe('(Incluye agua, refrescos, cerveza de barril y vinos valencianos)')
  })

  it('returns the single-line fallback for no_incluida', () => {
    expect(groupBeverageLines(menu({
      beverage: { type: 'no_incluida', price_per_person: null, has_supplement: false, supplement_price: null },
    }))).toEqual(['Bebida a parte'])
  })

  it('coerces price_per_person via formatEuro and tolerates NaN', () => {
    expect(groupBeverageLines(menu({
      beverage: { type: 'opcion', price_per_person: 12.5, has_supplement: false, supplement_price: null },
    }))[0]).toBe('Opción a bebida ilimitada +12.5 € pax')
    expect(groupBeverageLines(menu({
      beverage: { type: 'opcion', price_per_person: 'not-a-number', has_supplement: false, supplement_price: null },
    }))[0]).toBe('Opción a bebida ilimitada +8 € pax')
  })
})

describe('preview runtime — selectedBeverageNames', () => {
  it('returns names of selected options', () => {
    expect(selectedBeverageNames(menu({
      beverage_options: [
        beverage({ name: 'Agua', selected: true }),
        beverage({ id: 2, slug: 'r', name: 'Refrescos', selected: true }),
        beverage({ id: 64, slug: 'x', name: 'X', selected: false }),
      ],
    }))).toEqual(['Agua', 'Refrescos'])
  })

  it('treats missing `selected` as selected (matches backend public-API shape)', () => {
    expect(selectedBeverageNames(menu({
      beverage_options: [{ name: 'Agua' }],
    }))).toEqual(['Agua'])
  })

  it('handles empty/missing options gracefully', () => {
    expect(selectedBeverageNames(menu())).toEqual([])
    expect(selectedBeverageNames({ settings: {} })).toEqual([])
  })
})

describe('preview runtime — formatEuro', () => {
  it('formats integer euros without trailing zeros', () => expect(formatEuro(8)).toBe('8 €'))
  it('formats 1-decimal euros stripping trailing zero', () => expect(formatEuro(8.5)).toBe('8.5 €'))
  it('formats 2-decimal euros unchanged', () => expect(formatEuro(8.25)).toBe('8.25 €'))
  it('returns "0 €" for non-numeric input', () => expect(formatEuro('nope')).toBe('0 €'))
})
