import React, { useState } from "react";
import { useAtomValue } from "jotai";
import { ChevronRight, UtensilsCrossed } from "lucide-react";
import { sessionAtom } from "../../../../state/atoms";
import { usePageContext } from "vike-react/usePageContext";

type MenuType = "desayuno" | "almuerzo" | "cena" | "bar";

const MENU_TYPE_LABELS: Record<MenuType, string> = {
  desayuno: "Desayuno",
  almuerzo: "Almuerzo",
  cena: "Cena",
  bar: "Bar",
};

const MENU_TYPE_COLORS: Record<MenuType, string> = {
  desayuno: "bg-amber-500",
  almuerzo: "bg-emerald-500",
  cena: "bg-indigo-500",
  bar: "bg-rose-500",
};

function MenuTypeCard({ type, href }: { type: MenuType; href: string }) {
  const label = MENU_TYPE_LABELS[type];
  const color = MENU_TYPE_COLORS[type];
  return (
    <a
      href={href}
      className="flex items-center gap-4 p-4 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] no-underline active:scale-[0.99] transition-transform"
      data-ui="mobile-menu-type-card"
      data-role={type}
    >
      <div
        className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}
        data-ui="mobile-menu-type-icon-wrap"
        aria-hidden="true"
      >
        <UtensilsCrossed size={22} className="text-white" strokeWidth={1.8} aria-hidden="true" />
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="text-base font-bold text-[hsl(var(--foreground))]" data-ui="mobile-menu-type-label">{label}</h3>
        <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5" data-ui="mobile-menu-type-desc">Ver menus y precios</p>
      </div>
      <ChevronRight size={20} className="text-[hsl(var(--muted-foreground))] flex-shrink-0" strokeWidth={1.8} aria-hidden="true" />
    </a>
  );
}

export default function MobileMenusPage() {
  const session = useAtomValue(sessionAtom);
  const menuTypes: MenuType[] = ["desayuno", "almuerzo", "cena", "bar"];

  if (!session) return null;

  return (
    <div className="flex flex-col gap-4 p-4" data-ui="mobile-menus">
      <header className="pt-2" data-ui="mobile-menus-header">
        <h1 className="text-xl font-bold text-[hsl(var(--foreground))]" data-ui="mobile-menus-title">Menus</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))]" data-ui="mobile-menus-subtitle">Selecciona un tipo de menu</p>
      </header>

      <div className="flex flex-col gap-3" data-ui="mobile-menu-types-list" role="list">
        {menuTypes.map((type) => (
          <MenuTypeCard
            key={type}
            type={type}
            href={`/m/app/menus/${type}`}
          />
        ))}
      </div>
    </div>
  );
}
