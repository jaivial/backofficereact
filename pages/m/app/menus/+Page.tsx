import React from "react";
import { useAtomValue } from "jotai";
import { ChevronRight, UtensilsCrossed } from "lucide-react";
import { sessionAtom } from "../../../../state/atoms";
import { MENU_TYPE_GROUPS, type MenuTypeGroup } from "./menuTypeGroups";

function MenuTypeCard({ group }: { group: MenuTypeGroup }) {
  return (
    <a
      href={`/m/app/menus/${group.slug}`}
      className="flex items-center gap-4 p-4 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] no-underline active:scale-[0.99] transition-transform"
      data-ui="mobile-menu-type-card"
      data-role={group.slug}
    >
      <div
        className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${group.color}`}
        data-ui="mobile-menu-type-icon-wrap"
        aria-hidden="true"
      >
        <UtensilsCrossed size={22} className="text-white" strokeWidth={1.8} aria-hidden="true" />
      </div>
      <div className="flex-1 min-w-0" data-slot="menus-min-w-0">
        <h3 className="text-base font-bold text-[hsl(var(--foreground))]" data-ui="mobile-menu-type-label">{group.label}</h3>
        <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5" data-ui="mobile-menu-type-desc">{group.desc}</p>
      </div>
      <ChevronRight size={20} className="text-[hsl(var(--muted-foreground))] flex-shrink-0" strokeWidth={1.8} aria-hidden="true" />
    </a>
  );
}

export default function MobileMenusPage() {
  const session = useAtomValue(sessionAtom);

  if (!session) return null;

  return (
    <div className="flex flex-col gap-4 p-4" data-ui="mobile-menus">
      <header className="pt-2" data-ui="mobile-menus-header">
        <h1 className="text-xl font-bold text-[hsl(var(--foreground))]" data-ui="mobile-menus-title">Menús</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))]" data-ui="mobile-menus-subtitle">Selecciona un tipo de menu</p>
      </header>

      <div className="flex flex-col gap-3" data-ui="mobile-menu-types-list" role="list">
        {MENU_TYPE_GROUPS.map((group) => (
          <MenuTypeCard key={group.slug} group={group} />
        ))}
      </div>
    </div>
  );
}
