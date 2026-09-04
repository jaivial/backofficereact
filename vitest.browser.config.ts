import { defineConfig } from 'vitest/config'
import path from 'node:path'

/**
 * Vitest browser mode config for the menu-preview iframe regression suite.
 *
 * Runs the iframe (`public/menu-preview/index.html`) in a real Chromium
 * instance via the playwright provider, then posts a `vc_preview:update`
 * message with a menu payload that includes a custom beverage option and
 * asserts the rendered DOM contains the custom name.
 *
 * Run: `bun run test:browser`
 *
 * Honors `VITEST_BROWSER_EXEC` env var to override the chromium binary
 * path (the docker dev image pre-caches a newer revision than the bundled
 * playwright package expects).
 */
const launchOptions: Record<string, unknown> = process.env.VITEST_BROWSER_EXEC
  ? { executablePath: process.env.VITEST_BROWSER_EXEC }
  : {}

export default defineConfig({
  resolve: {
    alias: {
      three: path.resolve(process.cwd(), 'node_modules/three'),
    },
  },
  define: {
    // Fixed port so the browser test can find the static preview
    // server booted by test/global-setup.ts (vitest globalSetup runs after
    // config evaluation, so we can't read process.env.PREVIEW_URL here).
    __PREVIEW_URL__: JSON.stringify('http://127.0.0.1:39573/menu-preview/index.html'),
  },
  test: {
    globals: true,
    include: ['public/menu-preview/__tests__/*.browser.test.{ts,js}'],
    browser: {
      enabled: true,
      name: 'chromium',
      provider: 'playwright',
      headless: true,
      // Don't wrap tests in an iframe: tests run on the top page so we can
      // navigate it to the preview URL directly.
      iframe: false,
      launchOptions,
    },
    globalSetup: ['./test/global-setup.ts'],

  },
})
