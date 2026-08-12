import {
  test as base,
  type Page,
  expect,
  devices,
} from "@playwright/test";
import type { BOSession } from "../../api/types";

import { e2eEnv } from "../config";
import { login } from "../helpers/auth";
import { TestApiClient } from "../helpers/api-client";
import { makeBookingFactory, type BookingFactory } from "../factories/booking";
import { makeComidaFactory, type ComidaFactory } from "../factories/comida";
import { makeMenuFactory, type MenuFactory } from "../factories/menu";
import { makeStockItemFactory, type StockItemFactory } from "../factories/stock";
import {
  makeWarehouseFactory,
  type WarehouseFactory,
  makeStockCategoryFactory,
  type StockCategoryFactory,
} from "../factories/stock-extras";
import {
  makePOSProductFactory,
  type POSProductFactory,
  makePOSCategoryFactory,
  type POSCategoryFactory,
} from "../factories/pos";
import { makePOSVisitFactory, type POSVisitFactory } from "../factories/pos-visit";
import { makeScheduleFactory, type ScheduleFactory } from "../factories/horario";
import { makeCompensationFactory, type CompensationFactory } from "../factories/compensation";
import {
  APP_ROUTES,
  navigateTo,
  gotoAndWait,
  waitForAppReady,
} from "../helpers/navigation";

export { expect, devices };

// Convenience re-exports so a spec needs only `import { test, expect, routes } from "../fixtures/session"`.
export const routes = APP_ROUTES;
export { navigateTo, gotoAndWait, waitForAppReady };
export type { Page } from "@playwright/test";

// Re-export factory types for specs that want them
export type {
  BookingFactory,
  ComidaFactory,
  MenuFactory,
  StockItemFactory,
  WarehouseFactory,
  StockCategoryFactory,
  POSProductFactory,
  POSCategoryFactory,
  POSVisitFactory,
  ScheduleFactory,
  CompensationFactory,
};

/**
 * Mega-fixture: provides a logged-in page plus every data factory with
 * automatic cleanup. All factories are opt-in — only request the ones a test
 * uses, and the cleanup runs automatically when the test ends.
 *
 *   test("x", async ({ adminPage, api, bookingFactory, comidaFactory }) => { ... });
 */
export const test = base.extend<{
  adminPage: Page;
  adminTouchPage: Page;
  session: BOSession;
  api: TestApiClient;
  bookingFactory: BookingFactory;
  comidaFactory: ComidaFactory;
  menuFactory: MenuFactory;
  stockItemFactory: StockItemFactory;
  warehouseFactory: WarehouseFactory;
  stockCategoryFactory: StockCategoryFactory;
  posProductFactory: POSProductFactory;
  posCategoryFactory: POSCategoryFactory;
  posVisitFactory: POSVisitFactory;
  scheduleFactory: ScheduleFactory;
  compensationFactory: CompensationFactory;
}>({
  adminPage: async ({ browser }, use) => {
    const context = await browser.newContext({ ignoreHTTPSErrors: true });
    const page = await context.newPage();
    await login(page, {
      baseURL: e2eEnv.baseURL,
      email: e2eEnv.adminEmail,
      password: e2eEnv.adminPassword,
    });
    await use(page);
    await context.close();
  },

  adminTouchPage: async ({ browser }, use) => {
    const context = await browser.newContext({ ...devices["iPhone 12"], ignoreHTTPSErrors: true });
    const page = await context.newPage();
    await login(page, {
      baseURL: e2eEnv.baseURL,
      email: e2eEnv.adminEmail,
      password: e2eEnv.adminPassword,
    });
    await use(page);
    await context.close();
  },

  session: async ({ adminPage }, use) => {
    const result = await adminPage.evaluate(async () => {
      const response = await fetch("/api/admin/me", { credentials: "include" });
      return { ok: response.ok, body: await response.json() };
    });
    if (!result.ok || !result.body?.success || !result.body.session) {
      throw new Error(`Fixture session lookup failed: ${result.body?.message || "unknown error"}`);
    }
    await use(result.body.session as BOSession);
  },

  api: async ({ adminPage }, use) => {
    await use(new TestApiClient(adminPage));
  },

  bookingFactory: async ({ api }, use) => {
    const { factory, cleanup } = makeBookingFactory(api);
    await use(factory);
    await cleanup();
  },

  comidaFactory: async ({ api }, use) => {
    const { factory, cleanup } = makeComidaFactory(api);
    await use(factory);
    await cleanup();
  },

  menuFactory: async ({ api }, use) => {
    const { factory, cleanup } = makeMenuFactory(api);
    await use(factory);
    await cleanup();
  },

  stockItemFactory: async ({ api }, use) => {
    const { factory, cleanup } = makeStockItemFactory(api);
    await use(factory);
    await cleanup();
  },

  warehouseFactory: async ({ api }, use) => {
    const { factory, cleanup } = makeWarehouseFactory(api);
    await use(factory);
    await cleanup();
  },

  stockCategoryFactory: async ({ api }, use) => {
    const { factory, cleanup } = makeStockCategoryFactory(api);
    await use(factory);
    await cleanup();
  },

  posProductFactory: async ({ api }, use) => {
    const { factory, cleanup } = makePOSProductFactory(api);
    await use(factory);
    await cleanup();
  },

  posCategoryFactory: async ({ api }, use) => {
    const { factory, cleanup } = makePOSCategoryFactory(api);
    await use(factory);
    await cleanup();
  },

  posVisitFactory: async ({ api }, use) => {
    const { factory, cleanup } = makePOSVisitFactory(api);
    await use(factory);
    await cleanup();
  },

  scheduleFactory: async ({ api }, use) => {
    const { factory, cleanup } = makeScheduleFactory(api);
    await use(factory);
    await cleanup();
  },

  compensationFactory: async ({ api }, use) => {
    const { factory, cleanup } = makeCompensationFactory(api);
    await use(factory);
    await cleanup();
  },
});

export const testSession = test;
