import React from "react";
import { useData } from "vike-react/useData";
import { useAtomValue } from "jotai";
import { ChevronLeft, ChevronRight, UtensilsCrossed } from "lucide-react";
import { sessionAtom } from "../../../../../state/atoms";
import type { Data } from "./+data";

function formatPrice(price: string): string {
  const n = Number(price);
  if (!Number.isFinite(n)) return price;
  return `${n.toFixed(2).replace(".", ",")} €`;
}

export default function MobileMenuTypePage() {
  const session = useAtomValue(sessionAtom);
  const { groupLabel, groupDesc, menus, error } = useData<Data>();

  if (!session) return null;

  return (
    <div className="flex flex-col gap-4 p-4" data-ui="mobile-menu-type">
      <header className="pt-2 flex items-start gap-2" data-ui="mobile-menu-type-header">
        <a
          href="/m/app/menus"
          className="mt-1 p-1 rounded-lg text-[hsl(var(--muted-foreground))] no-underline"
          data-ui="mobile-menu-type-back"
          aria-label="Volver a tipos de menu"
        >
          <ChevronLeft size={20} strokeWidth={1.8} aria-hidden="true" />
        </a>
        <div>
          <h1 className="text-xl font-bold text-[hsl(var(--foreground))]" data-ui="mobile-menu-type-title">
            {groupLabel ?? "Menus"}
          </h1>
          {groupDesc ? (
            <p className="text-sm text-[hsl(var(--muted-foreground))]" data-ui="mobile-menu-type-subtitle">{groupDesc}</p>
          ) : null}
        </div>
      </header>

      {error ? (
        <div className="p-4 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]" data-ui="mobile-menu-type-error">
          <p className="text-sm text-[hsl(var(--muted-foreground))]">{error}</p>
        </div>
      ) : menus.length === 0 ? (
        <div className="p-4 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]" data-ui="mobile-menu-type-empty">
          <p className="text-sm text-[hsl(var(--muted-foreground))]">No hay menus de este tipo.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3" data-ui="mobile-menu-type-list" role="list">
          {menus.map((menu) => (
            <a
              key={menu.id}
              href={`/app/comida/menus/crear?menuId=${encodeURIComponent(String(menu.id))}`}
              className="flex items-center gap-4 p-4 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] no-underline active:scale-[0.99] transition-transform"
              data-ui="mobile-menu-row"
              data-menu-id={menu.id}
            >
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 bg-[hsl(var(--muted))]"
                data-ui="mobile-menu-row-icon-wrap"
                aria-hidden="true"
              >
                <UtensilsCrossed size={22} className="text-[hsl(var(--foreground))]" strokeWidth={1.8} aria-hidden="true" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-bold text-[hsl(var(--foreground))] truncate" data-ui="mobile-menu-row-title">
                  {menu.menu_title}
                </h3>
                <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5" data-ui="mobile-menu-row-meta">
                  {formatPrice(menu.price)}
                  {menu.is_draft ? " · Borrador" : menu.active ? " · Activo" : " · Inactivo"}
                </p>
              </div>
              <ChevronRight size={20} className="text-[hsl(var(--muted-foreground))] flex-shrink-0" strokeWidth={1.8} aria-hidden="true" />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
