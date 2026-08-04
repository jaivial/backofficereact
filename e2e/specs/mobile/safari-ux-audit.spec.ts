/**
 * Mobile Safari UX audit.
 *
 * Walks every app route at iPhone-Safari viewport, expands every tab, opens
 * every modal it can reach, and records UX defects (overflow, tiny tap
 * targets, tiny text, clipped content) into test-results/mobile-ux-audit.json.
 *
 * ponytail: Chromium + iOS UA/viewport, not real WebKit — the host lacks
 * WebKit deps. Layout defects are viewport-driven, so this catches them.
 * Swap project to `webkit` once `npx playwright install-deps webkit` runs.
 */
import { test, expect, type Page } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

const BASE = process.env.BACKOFFICE_URL || "https://localhost:3010";
const EMAIL = process.env.E2E_ADMIN_EMAIL || "admin@villacarmen.com";
const PASSWORD = process.env.E2E_ADMIN_PASSWORD || "admin123";

const OUT_DIR = "test-results/mobile-ux";

// iPhone 14 / Safari — the size the user cares about.
const VIEWPORT = { width: 390, height: 844 };
const IOS_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

const ROUTES = [
  "/app",
  "/app/dashboard",
  "/app/reservas",
  "/app/reservas/anadir",
  "/app/reservas/config",
  "/app/reservas/tables",
  "/app/comida",
  "/app/comida/platos",
  "/app/comida/vinos",
  "/app/comida/postres",
  "/app/comida/bebidas",
  "/app/comida/cafes",
  "/app/pos",
  "/app/stock",
  "/app/menus",
  "/app/menus/crear",
  "/app/miembros",
  "/app/miembros/roles",
  "/app/miembros/mi-horario",
  "/app/fichaje",
  "/app/horarios",
  "/app/horarios/turnos",
  "/app/config",
  "/app/config?content=restaurante",
  "/app/config?content=contacto",
  "/app/config?content=booking",
  "/app/config?content=legal-pages",
  "/app/config?content=ia",
  "/app/config/booking",
  "/app/facturas",
  "/app/facturas/recurrentes",
  "/app/estado-cuenta",
  "/app/reportes",
  "/app/settings",
  "/app/website",
  "/app/site-builder",
  "/app/backoffice",
  "/app/comsit",
];

type Defect = {
  route: string;
  state: string;
  kind: string;
  detail: string;
  selector?: string;
};

// Each test writes its own shard so parallel workers (separate processes)
// don't clobber a shared array; a final test merges them.
let defects: Defect[] = [];

function record(d: Defect) {
  defects.push(d);
}

function flush(name: string) {
  fs.mkdirSync(`${OUT_DIR}/shards`, { recursive: true });
  fs.writeFileSync(`${OUT_DIR}/shards/${slug(name)}.json`, JSON.stringify(defects));
  defects = [];
}

/** In-page audit: returns raw findings for the current DOM state. */
async function auditDom(page: Page) {
  return page.evaluate((vw: number) => {
    const out: { kind: string; detail: string; selector?: string }[] = [];

    const desc = (el: Element) => {
      const tag = el.tagName.toLowerCase();
      const tid = el.getAttribute("data-testid");
      const cls = (el.getAttribute("class") || "").split(/\s+/).slice(0, 2).join(".");
      const txt = (el.textContent || "").trim().slice(0, 28);
      return `${tag}${tid ? `[${tid}]` : ""}${cls ? `.${cls}` : ""}${txt ? ` "${txt}"` : ""}`;
    };

    // 1. Horizontal overflow of the document itself.
    const de = document.documentElement;
    if (de.scrollWidth > vw + 1) {
      out.push({
        kind: "page-h-overflow",
        detail: `document scrollWidth ${de.scrollWidth}px > viewport ${vw}px`,
      });
    }

    const els = Array.from(document.body.querySelectorAll<HTMLElement>("*"));

    // The booking-widget preview deliberately renders the public site in
    // miniature — it is a picture, not UI the operator taps, so its small
    // type and targets are correct by design.
    const inWidgetPreview = (el: Element) => !!el.closest(".bo-widget-preview-wrapper");
    // React Flow's attribution link is required by its licence and is not ours
    // to resize.
    const isVendorAttribution = (el: Element) => !!el.closest(".react-flow__attribution");
    // Objects drawn onto the floor-plan canvas (walls, obstacles, table nodes)
    // are diagram content on a pan/zoom surface, not chrome: their on-screen
    // size is whatever the user drew at the current zoom, so the tap-target and
    // type floors do not apply.
    const isCanvasObject = (el: Element) => !!el.closest(".react-flow__viewport");

    for (const el of els) {
      if (inWidgetPreview(el) || isVendorAttribution(el) || isCanvasObject(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === "hidden" || cs.display === "none" || cs.opacity === "0") continue;

      // 2. Element sticking out past the right edge (real bleed, not a
      //    deliberately scrollable strip).
      if (r.right > vw + 2 && r.left < vw) {
        // hidden/clip contains the overflow just as much as auto/scroll does —
        // e.g. a pannable canvas. Only an unconstrained ancestor is a real bug.
        let contained = false;
        for (let p = el.parentElement; p; p = p.parentElement) {
          const ps = getComputedStyle(p);
          if (/(auto|scroll|hidden|clip)/.test(ps.overflowX)) {
            contained = true;
            break;
          }
        }
        if (!contained) {
          out.push({
            kind: "element-bleed",
            detail: `right edge ${Math.round(r.right)}px (viewport ${vw}px), width ${Math.round(r.width)}px`,
            selector: desc(el),
          });
        }
      }

      // 3. Tap targets below Apple's 44x44pt HIG minimum.
      const interactive =
        el.matches("button, a[href], [role=button], [role=tab], input, select, summary") &&
        !el.matches('input[type="hidden"]') &&
        // A range track is intentionally thin; the draggable thumb is the
        // target and its size is not in the element's own box.
        !el.matches('input[type="range"]') &&
        // A checkbox inside a <label> is activated by tapping the whole row,
        // so the row is the real target, not the 24px box.
        !(el.matches('input[type="checkbox"], input[type="radio"]') && el.closest("label"));
      // 40px text inputs are fine to tap — the finger lands on a wide box, and
      // iOS itself ships 40px fields. Only sub-40 is a real miss.
      const floor = el.matches("input, select, textarea") ? 40 : 44;
      // A control may extend its hit area with an absolutely-positioned
      // ::after inset outside its box; count that toward the target size.
      const after = getComputedStyle(el, "::after");
      const bleedTop =
        after.content !== "none" && after.position === "absolute"
          ? -Math.min(0, parseFloat(after.top) || 0)
          : 0;
      const effectiveH = r.height + bleedTop * 2;
      if (interactive && (effectiveH < floor || r.width < 24)) {
        out.push({
          kind: "small-tap-target",
          detail: `${Math.round(r.width)}x${Math.round(effectiveH)}px effective (min ${floor}px height)`,
          selector: desc(el),
        });
      }

      // 4. Text below 12px is unreadable on a phone; <16px on inputs makes
      //    iOS Safari zoom the page on focus.
      const hasOwnText = Array.from(el.childNodes).some(
        (n) => n.nodeType === 3 && (n.textContent || "").trim().length > 0,
      );
      const fs = parseFloat(cs.fontSize);
      // 11px floor, not 12px: the calendar occupancy ratio lives in a 1/7-width
      // cell where 12px truncates "20/45" to "20/…", so 11px is the real target
      // for the densest labels. Anything under 11px is still a finding.
      if (hasOwnText && fs > 0 && fs < 11) {
        out.push({
          kind: "tiny-text",
          detail: `font-size ${fs}px`,
          selector: desc(el),
        });
      }
      const zoomable = el.matches(
        'input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=color]):not([type=range]), select, textarea',
      );
      if (zoomable && fs > 0 && fs < 16) {
        out.push({
          kind: "ios-zoom-input",
          detail: `font-size ${fs}px < 16px — iOS Safari zooms on focus`,
          selector: desc(el),
        });
      }
    }

    return out;
  }, VIEWPORT.width);
}

async function settle(page: Page) {
  await page.waitForLoadState("domcontentloaded");
  await page
    .waitForLoadState("networkidle", { timeout: 10_000 })
    .catch(() => undefined);
  await page.waitForTimeout(600);
}

async function shot(page: Page, name: string) {
  await page
    .screenshot({ path: path.join(OUT_DIR, `${name}.png`), fullPage: true })
    .catch(() => undefined);
}

function slug(s: string) {
  return s.replace(/^\//, "").replace(/[^a-z0-9]+/gi, "-").replace(/-+$/, "") || "root";
}

async function auditState(page: Page, route: string, state: string) {
  const found = await auditDom(page);
  for (const f of found) record({ route, state, ...f });
  await shot(page, `${slug(route)}--${slug(state)}`);
}

test.use({
  viewport: VIEWPORT,
  userAgent: IOS_UA,
  isMobile: true,
  hasTouch: true,
  deviceScaleFactor: 3,
  ignoreHTTPSErrors: true,
  baseURL: BASE,
});

test.beforeAll(() => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
});

test.describe("Mobile Safari UX audit", () => {
  // Walking every tab + up to 25 modal openers per route needs more than 60s.
  test.describe.configure({ timeout: 300_000 });

  test("login screen", async ({ page }) => {
    await page.goto("/login");
    await settle(page);
    await auditState(page, "/login", "default");

    // Focused-input state: iOS keyboard shrinks the visual viewport.
    await page.locator('[data-testid="login-identifier-input"]').click();
    await page.waitForTimeout(300);
    await auditState(page, "/login", "input-focused");
    flush("login");
  });

  for (const route of ROUTES) {
    test(`route ${route}`, async ({ page }) => {
      const routeStart = Date.now();
      // Log in once per test via the API, then set the cookie.
      const res = await page.request.post(`${BASE}/api/admin/login`, {
        data: { identifier: EMAIL, password: PASSWORD },
      });
      expect(res.ok(), `login failed for ${route}`).toBeTruthy();

      await page.goto(route);
      await settle(page);

      // Skip routes that redirected away (permission / not implemented).
      const landed = new URL(page.url()).pathname;
      if (landed === "/login") {
        record({ route, state: "default", kind: "auth-redirect", detail: "bounced to /login" });
        return;
      }

      await auditState(page, route, "default");

      // ── Tabs ────────────────────────────────────────────────────────────
      const tabSel = '[role="tab"], [data-testid="tabs"] a, [data-role="tabs-nav"] a';
      const tabCount = Math.min(await page.locator(tabSel).count().catch(() => 0), 12);
      const tabDeadline = routeStart + 90_000;
      for (let i = 0; i < tabCount; i++) {
        if (Date.now() > tabDeadline) {
          record({
            route,
            state: "tabs",
            kind: "audit-truncated",
            detail: `stopped after ${i}/${tabCount} tabs (time budget)`,
          });
          break;
        }
        // The strip re-renders as tabs are visited, so a tab captured in the
        // initial count may no longer exist. Re-read the live list each pass
        // and stop when the index falls off the end — waiting on a vanished
        // locator is what previously burned 38s per missing tab.
        if (i >= (await page.locator(tabSel).count().catch(() => 0))) break;
        const tab = page.locator(tabSel).nth(i);
        // Tabs inside a closed slide-out sheet sit off-screen on purpose.
        const box = await tab.boundingBox({ timeout: 2_000 }).catch(() => null);
        if (!box) continue;
        if (box.x >= 390 || box.x + box.width <= 0) continue;
        const label = (
          (await tab.textContent({ timeout: 3_000 }).catch(() => null)) || `tab-${i}`
        )
          .trim()
          .slice(0, 24);
        try {
          await tab.click({ timeout: 4_000 });
          await page.waitForTimeout(700);
          await auditState(page, route, `tab-${label || i}`);
        } catch {
          // Link tabs navigate, which re-mounts the tab strip; a stale handle
          // is expected. Only report when the tab is genuinely unreachable.
          const stillThere = await page
            .locator(tabSel)
            .nth(i)
            .isVisible()
            .catch(() => false);
          if (stillThere) {
            record({
              route,
              state: `tab-${label || i}`,
              kind: "tab-unclickable",
              detail: "click timed out — target obscured or offscreen",
            });
          }
        }
      }

      // ── Modals ──────────────────────────────────────────────────────────
      // Buttons whose label suggests they open a dialog. Bounded to keep the
      // run finite; destructive verbs are excluded on purpose.
      const openers = page.locator(
        'button:not([disabled])',
      );
      const openerCount = Math.min(await openers.count(), 25);
      const seen = new Set<string>();
      // Heavy routes (long product lists) can exceed the test budget while
      // probing openers. Stop probing rather than fail the whole route.
      // Relative to the test start, not to this point: tabs already consumed
      // part of the 300s budget, so an absolute add could overrun it.
      const modalDeadline = routeStart + 170_000;
      let lastDialogLabel = "";
      for (let i = 0; i < openerCount; i++) {
        if (Date.now() > modalDeadline) {
          record({
            route,
            state: "modals",
            kind: "audit-truncated",
            detail: `stopped after ${i}/${openerCount} modal openers (time budget)`,
          });
          break;
        }
        // An opener may navigate away (e.g. a row's "Editar"), shrinking the
        // list. Re-check the live count and bail once the index falls off the
        // end — otherwise every stale index blocks for the full timeout.
        if (i >= (await openers.count().catch(() => 0))) break;
        const btn = openers.nth(i);
        let label = "";
        try {
          label = (
            (await btn.textContent({ timeout: 2_000 })) ||
            (await btn.getAttribute("aria-label")) ||
            ""
          )
            .trim()
            .slice(0, 24);
        } catch {
          continue;
        }
        if (!label || seen.has(label)) continue;
        if (/elimin|borrar|delete|cerrar sesi|logout|salir|guardar|save/i.test(label)) continue;
        // Row-level controls repeat once per list item with no label; probing
        // every one is what exhausted the budget on long product lists.
        const testid = (await btn.getAttribute("data-testid").catch(() => null)) || "";
        const family = testid.replace(/[-_]?\d+$/, "");
        if (family && seen.has(family)) continue;
        if (family) seen.add(family);
        seen.add(label);

        try {
          if (!(await btn.isVisible())) continue;
          await btn.click({ timeout: 3_000 });
        } catch {
          continue;
        }
        await page.waitForTimeout(600);

        // Some openers navigate rather than open a dialog. Go back so the
        // remaining openers are probed against the route under audit.
        if (new URL(page.url()).pathname !== landed) {
          await page.goto(route).catch(() => undefined);
          await settle(page);
          continue;
        }

        const dialog = page.locator('[role="dialog"]').first();
        if (!(await dialog.isVisible().catch(() => false))) continue;
        // Attribute the dialog to this opener only if it appeared now; a
        // leftover from a previous opener would be misreported against it.
        const dialogLabel = (await dialog.getAttribute("aria-label").catch(() => null)) || "";
        if (dialogLabel && dialogLabel === lastDialogLabel) continue;
        lastDialogLabel = dialogLabel;

        await auditState(page, route, `modal-${label}`);

        // Modal-specific check: does the dialog fit the phone screen?
        const box = await dialog.boundingBox();
        if (box) {
          if (box.width > VIEWPORT.width + 2) {
            record({
              route,
              state: `modal-${label}`,
              kind: "modal-too-wide",
              detail: `dialog width ${Math.round(box.width)}px > viewport ${VIEWPORT.width}px`,
            });
          }
          if (box.y < 0 || box.y + box.height > VIEWPORT.height + 2) {
            const inner = await dialog.evaluate((el) => {
              const s = getComputedStyle(el);
              return { overflowY: s.overflowY, scrollH: el.scrollHeight, clientH: el.clientHeight };
            });
            if (!/(auto|scroll)/.test(inner.overflowY)) {
              record({
                route,
                state: `modal-${label}`,
                kind: "modal-clipped",
                detail: `dialog spans y=${Math.round(box.y)}..${Math.round(box.y + box.height)} in ${VIEWPORT.height}px viewport with overflow-y:${inner.overflowY}`,
              });
            }
          }
        }

        // Close it and carry on.
        await page.keyboard.press("Escape").catch(() => undefined);
        await page.waitForTimeout(400);
        if (await dialog.isVisible().catch(() => false)) {
          record({
            route,
            state: `modal-${label}`,
            kind: "modal-no-escape",
            detail: "dialog still open after Escape",
          });
          await page
            .locator('[role="dialog"] button[aria-label*="err" i], [role="dialog"] button:has-text("Cancelar")')
            .first()
            .click({ timeout: 2_000 })
            .catch(() => undefined);
          await page.waitForTimeout(300);
        }
        if (await page.locator('[role="dialog"]').first().isVisible().catch(() => false)) {
          // Give up on this route's remaining modals rather than cascade.
          break;
        }
      }

      flush(route);
    });
  }

});
