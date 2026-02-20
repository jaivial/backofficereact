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

  // Guaranteed by server middleware, but keep render stable.
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
    <div className="bo-homePage">
      <header className="bo-homeHero">
        <div className="bo-homeKicker">Panel de administracion</div>
        <h1 className="bo-homeTitle">
          Bienvenido, <span className="bo-homeTitleAccent">{firstName}</span>
        </h1>
        <p className="bo-homeSub">Selecciona una seccion para empezar.</p>
      </header>

      <section className="bo-homeNav" aria-label="Accesos rapidos">
        <div className="bo-homeOrbit" role="navigation" aria-label="Secciones del backoffice">
          <div className="bo-homeRing bo-homeRing--outer" aria-hidden="true" />
          <div className="bo-homeRing bo-homeRing--inner" aria-hidden="true" />

          <div className="bo-homeCenter" aria-hidden="true">
            <ChefHat className="bo-homeCenterIcon" />
          </div>

          {orbitItems.map((item, index) => (
            <a
              key={item.key}
              className="bo-homeNode"
              href={item.href}
              style={{
                ["--bo-home-angle" as any]: `${item.angleDeg}deg`,
                ["--bo-home-node-delay" as any]: `${index * 42}ms`,
              }}
            >
              <span className="bo-homeNodeIcon" aria-hidden="true">
                {iconForSidebarItemKey(item.key, { size: 18, strokeWidth: 1.8 })}
              </span>
              <span className="bo-homeNodeLabel">{item.label}</span>
            </a>
          ))}
        </div>
      </section>

      <section className="bo-homeList" aria-label="Secciones (lista)">
        {items.map((item) => (
          <a key={`list-${item.key}`} className="bo-homeListItem" href={item.href}>
            <span className="bo-homeListIcon" aria-hidden="true">
              {iconForSidebarItemKey(item.key, { size: 18, strokeWidth: 1.8 })}
            </span>
            <span className="bo-homeListLabel">{item.label}</span>
          </a>
        ))}
      </section>
    </div>
  );
}
