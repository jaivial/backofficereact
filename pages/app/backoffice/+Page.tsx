import React, { useMemo } from "react";
import { useAtomValue } from "jotai";
import { ChefHat } from "lucide-react";

import type { SidebarItem } from "../../../lib/rbac";
import { sidebarItemsForRole } from "../../../lib/rbac";
import { sessionAtom } from "../../../state/atoms";
import { iconForSidebarItemKey } from "../../../ui/nav/sectionIcons";

type OrbitItem = SidebarItem & { angleDeg: number };

export default function Page() {
  const session = useAtomValue(sessionAtom);

  if (!session) return null;

  const { role, sectionAccess, roleImportance, name } = session.user;

  const items = useMemo(() => sidebarItemsForRole(role, sectionAccess, roleImportance), [role, roleImportance, sectionAccess]);

  const orbitItems = useMemo<OrbitItem[]>(() => {
    return items.map((item, index) => {
      return {
        ...item,
        angleDeg: items.length <= 1 ? -90 : (index / items.length) * 360 - 90,
      };
    });
  }, [items]);

  const firstName = useMemo(() => {
    const raw = String(name ?? "").trim();
    if (!raw) return "equipo";
    const [first] = raw.split(/\s+/);
    return first || raw;
  }, [name]);

  return (
    <div className="flex flex-col min-h-screen bg-bo-bg">
      <header className="flex items-center justify-between p-4 border-b border-bo-border">
        <div className="text-xs text-muted">Panel de administración</div>
        <h1 className="text-xl font-semibold text-bo-text">
          Bienvenido, <span className="text-bo-accent font-semibold">{firstName}</span>
        </h1>
        <p className="text-muted">Selecciona una sección para empezar.</p>
      </header>

      <section className="flex-1 flex items-center justify-center" aria-label="Accesos rápidos">
        <div className="relative w-[400px] h-[400px]" role="navigation" aria-label="Secciones del backoffice">
          <div className="absolute inset-0 rounded-full border border-bo-border opacity-30" aria-hidden="true" />
          <div className="absolute inset-8 rounded-full border border-bo-border opacity-20" aria-hidden="true" />

          <div className="absolute inset-0 flex items-center justify-center" aria-hidden="true">
            <ChefHat className="w-16 h-16 text-bo-accent opacity-60" />
          </div>
          {orbitItems.map((item, index) => (
            <a
              key={item.key}
              href={item.href}
              className="absolute flex flex-col items-center gap-1 text-center top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-bo-muted no-underline transition-colors duration-150 hover:text-bo-accent"
              style={{
                transform: `rotate(${item.angleDeg}deg) translateY(-160px) rotate(-${item.angleDeg}deg)`,
                animationDelay: `${index * 42}ms`,
              }}
            >
              <span className="flex items-center justify-center w-12 h-12 rounded-[18px] bg-bo-surface border border-bo-border text-inherit transition-colors duration-150 group-hover:border-bo-accent" aria-hidden="true">
                {iconForSidebarItemKey(item.key, { size: 18, strokeWidth: 1.8 })}
              </span>
              <span className="text-bo-base">{item.label}</span>
            </a>
          ))}
        </div>
      </section>

      <section className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3" aria-label="Secciones (lista)">
        {items.map((item) => (
          <a key={`list-${item.key}`} href={item.href} className="flex items-center gap-3 p-4 rounded-bo-sm bg-bo-surface border border-bo-border text-bo-text no-underline transition-colors duration-150 hover:border-bo-accent group">
            <span className="flex items-center justify-center w-10 h-10 rounded-bo-sm bg-bo-surface-2 text-bo-muted transition-colors duration-150 group-hover:text-bo-accent" aria-hidden="true">
              {iconForSidebarItemKey(item.key, { size: 18, strokeWidth: 1.8 })}
            </span>
            <span className="font-bo-medium text-inherit transition-colors duration-150 group-hover:text-bo-accent">{item.label}</span>
          </a>
        ))}
      </section>
    </div>
  );
}
