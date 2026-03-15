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

      <section className="bo-orbitSection" aria-label="Accesos rápidos">
        <div className="bo-orbitContainer" role="navigation" aria-label="Secciones del backoffice">
          <div className="bo-orbitRing bo-orbitRing--outer" aria-hidden="true" />
          <div className="bo-orbitRing bo-orbitRing--inner" aria-hidden="true" />

          <div className="bo-orbitCenter" aria-hidden="true">
            <ChefHat className="bo-orbitIcon" />
          </div>
          {orbitItems.map((item, index) => (
            <a
              key={item.key}
              href={item.href}
              className="bo-orbitItem"
              style={{
                transform: `rotate(${item.angleDeg}deg) translateY(-160px) rotate(-${item.angleDeg}deg)`,
                animationDelay: `${index * 42}ms`,
              }}
            >
              <span className="bo-orbitItemIcon" aria-hidden="true">
                {iconForSidebarItemKey(item.key, { size: 18, strokeWidth: 1.8 })}
              </span>
              <span className="bo-orbitItemLabel">{item.label}</span>
            </a>
          ))}
        </div>
      </section>

      <section className="bo-sectionList" aria-label="Secciones (lista)">
        {items.map((item) => (
          <a key={`list-${item.key}`} href={item.href} className="bo-sectionItem group">
            <span className="bo-sectionItemIcon" aria-hidden="true">
              {iconForSidebarItemKey(item.key, { size: 18, strokeWidth: 1.8 })}
            </span>
            <span className="bo-sectionItemLabel">{item.label}</span>
          </a>
        ))}
      </section>
    </div>
  );
}
