/**
 * Comida (food catalog) data factory for E2E tests.
 *
 * create  → POST /api/admin/comida/{tipo}   (create item)
 * cleanup → DELETE /api/admin/comida/{tipo}/{id}
 *
 * `tipo` is one of: platos, vinos, postres, bebidas, cafes.
 */
import type { TestApiClient } from "../helpers/api-client";

export type ComidaTipo = "platos" | "vinos" | "postres" | "bebidas" | "cafes";

export interface ComidaItemInput {
  nombre?: string;
  descripcion?: string;
  tipo?: string;
  precio?: number;
  active?: boolean;
  alergenos?: string[];
  // platos-specific
  categoria?: string;
  titulo?: string;
  suplemento?: number;
  // vinos-specific
  bodega?: string;
  denominacion_origen?: string;
  graduacion?: string;
  anyo?: string;
  [key: string]: unknown;
}

export interface ComidaItem {
  num: number;
  item: Record<string, unknown>;
  [key: string]: unknown;
}

let counter = 0;
function e2eName(tipo: string): string {
  return `E2E ${tipo} ${Date.now()}-${++counter}`;
}

export async function createComidaItem(
  api: TestApiClient,
  tipo: ComidaTipo,
  overrides: ComidaItemInput = {},
): Promise<ComidaItem> {
  const res = await api.post<{ success: boolean; num?: number; item?: Record<string, unknown>; message?: string }>(
    `/api/admin/comida/${tipo}`,
    {
      nombre: e2eName(tipo),
      precio: 10,
      active: true,
      ...overrides,
    },
  );
  if (!res.success || typeof res.num !== "number") {
    throw new Error(`createComidaItem(${tipo}) failed: ${res.message ?? "no num in response"}`);
  }
  return { num: res.num, item: res.item ?? {} };
}

export async function deleteComidaItem(
  api: TestApiClient,
  tipo: ComidaTipo,
  id: number,
): Promise<void> {
  await api.delete(`/api/admin/comida/${tipo}/${id}`);
}

export interface ComidaFactory {
  create(tipo: ComidaTipo, overrides?: ComidaItemInput): Promise<ComidaItem>;
}

export function makeComidaFactory(api: TestApiClient): { factory: ComidaFactory; cleanup: () => Promise<void> } {
  const created: Array<{ tipo: ComidaTipo; id: number }> = [];
  return {
    factory: {
      async create(tipo: ComidaTipo, overrides?: ComidaItemInput) {
        const item = await createComidaItem(api, tipo, overrides);
        created.push({ tipo, id: item.num });
        return item;
      },
    },
    cleanup: async () => {
      await Promise.all(
        created.map(({ tipo, id }) => deleteComidaItem(api, tipo, id).catch(() => undefined)),
      );
    },
  };
}
