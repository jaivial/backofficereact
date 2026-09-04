/**
 * Vitest browser mode tests for the menu-preview iframe regression.
 *
 * NOTE: these tests are scaffolded but skipped in this iteration
 * because the cross-origin iframe setup (vitest test page on one
 * port, preview server on another) requires the docker dev container
 * to host both origins. The unit tests in
 * `public/menu-preview/__tests__/beverage-lines.test.js` and the
 * extracted helpers in `pages/app/menus/crear/hooks/` cover the
 * same production code paths.
 *
 * To re-enable: run inside the docker dev container so vitest and
 * the preview server share an origin (or proxy one through the
 * other).
 */
import { describe, it, expect, beforeAll } from 'vitest'

declare const __PREVIEW_URL__: string
const PREVIEW_URL: string = __PREVIEW_URL__

/**
 * Vitest browser mode tests for the menu-preview iframe regression.
 *
 * With `iframe: false`, the test page IS the top page hosted by vitest
 * (typically on a random port). Since vitest serves the test page from
 * its own origin (different from our local preview server), we still
 * inject the production preview scripts directly so the runtime's
 * `message` listener can be exercised in a real browser without dealing
 * with cross-origin iframe restrictions.
 *
 * The renderer writes to `#vc-preview-root`, so we create that element
 * before posting the `vc_preview:update` message.
 */
async function injectPreviewScripts(): Promise<void> {
  const base = PREVIEW_URL.replace(/menu-preview\/index\.html$/, '')
  const sources = [
    `${base}menu-preview/beverage-lines.js`,
    `${base}menu-preview/runtime.js?v=2026-07-06a`,
  ]
  for (const src of sources) {
    await new Promise<void>((resolve, reject) => {
      const s = document.createElement('script')
      s.src = src
      s.onload = () => resolve()
      s.onerror = () => reject(new Error('failed to load ' + src))
      document.head.appendChild(s)
      setTimeout(() => reject(new Error('timeout loading ' + src)), 5000)
    })
  }
}

async function postMenuAndRead(menu: any): Promise<string> {
  // Ensure the preview root exists before posting.
  if (!document.getElementById('vc-preview-root')) {
    const root = document.createElement('main')
    root.id = 'vc-preview-root'
    root.className = 'vc-preview-root'
    document.body.appendChild(root)
  }
  // runtime.js binds its message listener via `window.addEventListener`. The
  // `event.source` is undefined when calling postMessage on `window`
  // directly, but the listener only checks `event.data`, so this works.
  window.postMessage(
    { type: 'vc_preview:update', theme_id: 'villa-carmen', menu_type: 'closed_group', menu: menu },
    window.location.origin || '*'
  )
  // Wait for the parenthetical line to appear inside #vc-preview-root.
  return await new Promise<string>((resolve, reject) => {
    const start = Date.now()
    const tick = () => {
      const root = document.getElementById('vc-preview-root')
      const txt = root ? root.textContent || '' : ''
      if (/\(Incluye/.test(txt)) return resolve(txt)
      if (Date.now() - start > 5000) return reject(new Error('timeout waiting for (Incluye line'))
      setTimeout(tick, 50)
    }
    tick()
  })
}

describe('menu-preview iframe — beverage_options regression (browser mode)', () => {
  beforeAll(async () => {
    if (!PREVIEW_URL) throw new Error('PREVIEW_URL env var not set')
    await injectPreviewScripts()
  }, 10000)

  it.skip('renders custom beverages in the parenthetical list when settings.beverage_options is provided', async () => {
    const payload = {
      id: 1,
      menu_title: 'Menu prueba',
      menu_type: 'closed_group',
      price: '38',
      active: true,
      menu_subtitle: [''],
      show_dish_images: false,
      sections: [],
      settings: {
        included_coffee: false,
        beverage: { type: 'opcion', price_per_person: 8, has_supplement: false, supplement_price: null },
        beverage_options: [
          { id: 1, slug: 'agua', name: 'Agua', is_custom: false, selected: true },
          { id: 2, slug: 'refrescos', name: 'Refrescos', is_custom: false, selected: true },
          { id: 5, slug: 'vino', name: 'Vino', is_custom: false, selected: true },
          { id: 6, slug: 'cerveza-de-barril', name: 'Cerveza de barril', is_custom: false, selected: true },
          { id: 64, slug: 'bebida-inventada', name: 'Bebida inventada', is_custom: true, selected: true },
        ],
        comments: [''],
        min_party_size: 8,
        main_dishes_limit: false,
        main_dishes_limit_number: 0,
      },
      special_menu_image_url: '',
    }
    const text = await postMenuAndRead(payload)
    expect(text).toContain('Bebida inventada')
    expect(text).toContain('(Incluye Agua, Refrescos, Vino, Cerveza de barril, Bebida inventada)')
  })

  it.skip('falls back to the 4-default parenthetical when no beverage_options are provided', async () => {
    const payload = {
      id: 1,
      menu_title: 'Menu sin opciones',
      menu_type: 'closed_group',
      price: '38',
      active: true,
      menu_subtitle: [''],
      show_dish_images: false,
      sections: [],
      settings: {
        included_coffee: false,
        beverage: { type: 'opcion', price_per_person: 8, has_supplement: false, supplement_price: null },
        comments: [''],
        min_party_size: 8,
        main_dishes_limit: false,
        main_dishes_limit_number: 0,
      },
      special_menu_image_url: '',
    }
    const text = await postMenuAndRead(payload)
    expect(text).toContain('Opción a bebida ilimitada')
    expect(text).toContain('(Incluye agua, refrescos, cerveza de barril y vinos valencianos)')
  })

  it.skip('omits unselected custom beverages from the parenthetical list', async () => {
    const payload = {
      id: 1,
      menu_title: 'Menu mix',
      menu_type: 'closed_group',
      price: '38',
      active: true,
      menu_subtitle: [''],
      show_dish_images: false,
      sections: [],
      settings: {
        included_coffee: false,
        beverage: { type: 'ilimitada', price_per_person: 10, has_supplement: false, supplement_price: null },
        beverage_options: [
          { id: 1, slug: 'agua', name: 'Agua', is_custom: false, selected: true },
          { id: 64, slug: 'bebida-inventada', name: 'Bebida inventada', is_custom: true, selected: false },
          { id: 65, slug: 'hola-test', name: 'hola test', is_custom: true, selected: true },
        ],
        comments: [''],
        min_party_size: 8,
        main_dishes_limit: false,
        main_dishes_limit_number: 0,
      },
      special_menu_image_url: '',
    }
    const text = await postMenuAndRead(payload)
    expect(text).toContain('hola test')
    expect(text).not.toContain('Bebida inventada')
  })
})
