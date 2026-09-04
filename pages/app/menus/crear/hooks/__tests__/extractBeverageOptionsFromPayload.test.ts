import { describe, it, expect } from 'vitest'
import { extractBeverageOptionsFromPayload } from '../extractBeverageOptionsFromPayload'

describe('extractBeverageOptionsFromPayload (backoffice WS hello + beverage_options frames)', () => {
  it('extracts options from a hello payload (used when tracker load fails too)', () => {
    const payload = {
      type: 'hello',
      beverage_options: [
        { id: 1, slug: 'agua', name: 'Agua', is_custom: 0, selected: 1 },
        { id: 5, slug: 'refrescos', name: 'Refrescos', is_custom: 0, selected: 1 },
        { id: 64, slug: 'bebida-inventada', name: 'Bebida inventada', is_custom: 1, selected: 1 },
      ],
    }
    const out = extractBeverageOptionsFromPayload(payload)
    expect(out).toEqual([
      { id: 1, slug: 'agua', name: 'Agua', is_custom: false, selected: true },
      { id: 5, slug: 'refrescos', name: 'Refrescos', is_custom: false, selected: true },
      { id: 64, slug: 'bebida-inventada', name: 'Bebida inventada', is_custom: true, selected: true },
    ])
  })

  it('returns an empty array when payload has no beverage_options', () => {
    expect(extractBeverageOptionsFromPayload({ type: 'tracker_update' })).toEqual([])
    expect(extractBeverageOptionsFromPayload({ beverage_options: 'not-an-array' })).toEqual([])
  })

  it('drops rows missing id or name', () => {
    const out = extractBeverageOptionsFromPayload({
      type: 'beverage_options',
      options: [
        { id: 1, name: 'Agua', selected: true },
        { id: 2, name: '', selected: true },           // empty name → dropped
        { id: 0, name: 'NoId', selected: true },        // id=0 → dropped
        { slug: 'no-id', name: 'NoId' },                // missing id → dropped
      ],
    })
    expect(out).toEqual([{ id: 1, slug: '', name: 'Agua', is_custom: false, selected: true }])
  })

  it('normalizes selected/is_custom from boolean or 1/0', () => {
    const out = extractBeverageOptionsFromPayload({
      type: 'beverage_options',
      options: [
        { id: 1, name: 'A', is_custom: 1, selected: 0 },
        { id: 2, name: 'B', is_custom: true, selected: false },
        { id: 3, name: 'C', is_custom: false, selected: true },
      ],
    })
    expect(out[0]).toMatchObject({ is_custom: true, selected: false })
    expect(out[1]).toMatchObject({ is_custom: true, selected: false })
    expect(out[2]).toMatchObject({ is_custom: false, selected: true })
  })

  it('extracts from payload.options when present (beverage_options frame)', () => {
    const out = extractBeverageOptionsFromPayload({
      type: 'beverage_options',
      menu_id: 1,
      options: [{ id: 1, name: 'Agua', selected: true }],
    })
    expect(out).toEqual([{ id: 1, slug: '', name: 'Agua', is_custom: false, selected: true }])
  })
})
