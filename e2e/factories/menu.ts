/**
 * Group-menu (draft) data factory for E2E tests.
 *
 * create  → POST /api/admin/group-menus-v2/drafts   (returns menu_id)
 * cleanup → DELETE /api/admin/group-menus-v2/{id}
 *
 * Drafts are safe to delete at any time (no published-state side effects).
 */
import type { TestApiClient } from "../helpers/api-client";

export type MenuType =
  | "closed_conventional"
  | "closed_group"
  | "a_la_carte"
  | "a_la_carte_group"
  | "special";

export interface MenuInput {
  menu_type?: MenuType;
}

export interface Menu {
  id: number;
  [key: string]: unknown;
}

export async function createMenuDraft(
  api: TestApiClient,
  overrides: MenuInput = {},
): Promise<Menu> {
  const res = await api.post<{ success: boolean; menu_id?: number; message?: string }>(
    "/api/admin/group-menus-v2/drafts",
    {
      menu_type: "closed_conventional",
      ...overrides,
    },
  );
  if (!res.success || typeof res.menu_id !== "number") {
    throw new Error(`createMenuDraft failed: ${res.message ?? "no menu_id in response"}`);
  }
  return { id: res.menu_id };
}

export async function deleteMenu(api: TestApiClient, id: number): Promise<void> {
  await api.delete(`/api/admin/group-menus-v2/${id}`);
}

export interface MenuFactory {
  create(overrides?: MenuInput): Promise<Menu>;
}

export function makeMenuFactory(api: TestApiClient): { factory: MenuFactory; cleanup: () => Promise<void> } {
  const created: number[] = [];
  return {
    factory: {
      async create(overrides?: MenuInput) {
        const menu = await createMenuDraft(api, overrides);
        created.push(menu.id);
        return menu;
      },
    },
    cleanup: async () => {
      await Promise.all(created.map((id) => deleteMenu(api, id).catch(() => undefined)));
    },
  };
}
