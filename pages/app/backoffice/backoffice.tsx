import React, { useMemo } from "react";
import { useAtomValue } from "jotai";
import { ChefHat } from "lucide-react";

import type { SidebarItem } from "../../../lib/rbac";
import { sidebarItemsForRole } from "../../../lib/rbac";
import { sessionAtom } from "../../../state/atoms";
import { iconForSidebarItemKey } from "../../../ui/nav/sectionIcons";
import type { OrbitItem } from "./types/index";

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
    <div className="bo-homePage" data-ui="backoffice-home">
      <header className="bo-homeHero" data-ui="backoffice-hero">
        <div className="bo-homeKicker" data-ui="backoffice-kicker">Panel de administracion</div>
        <h1 className="bo-homeTitle" data-ui="backoffice-title">
          Bienvenido, <span className="bo-homeTitleAccent" data-ui="backoffice-name">{firstName}</span>
        </h1>
        <p className="bo-homeSub" data-ui="backoffice-subtitle">Selecciona una seccion para empezar.</p>
      </header>

      <section className="bo-homeNav" data-ui="backoffice-nav-orbit" aria-label="Accesos rapidos">
        <div className="bo-homeOrbit" role="navigation" aria-label="Secciones del backoffice" data-slot="backoffice-secciones-del-backof">
          <div className="bo-homeRing bo-homeRing--outer" aria-hidden="true" data-ui="ring-outer" />
          <div className="bo-homeRing bo-homeRing--inner" aria-hidden="true" data-ui="ring-inner" />

          <div className="bo-homeCenter" aria-hidden="true" data-ui="orbit-center">
            <ChefHat className="bo-homeCenterIcon" />
          </div>

          {orbitItems.map((item, index) => (
            <a
              key={item.key}
              className="bo-homeNode"
              href={item.href}
              data-ui="orbit-node"
              data-role="nav-item"
              style={{
                ["--bo-home-angle" as any]: `${item.angleDeg}deg`,
                ["--bo-home-node-delay" as any]: `${index * 42}ms`,
              }}
            >
              <span className="bo-homeNodeIcon" aria-hidden="true" data-ui="orbit-node-icon">
                {iconForSidebarItemKey(item.key, { size: 18, strokeWidth: 1.8 })}
              </span>
              <span className="bo-homeNodeLabel" data-ui="orbit-node-label">{item.label}</span>
            </a>
          ))}
        </div>
      </section>

      <section className="bo-homeList" data-ui="backoffice-nav-list" aria-label="Secciones (lista)">
        {items.map((item) => (
          <a key={`list-${item.key}`} className="bo-homeListItem" href={item.href} data-ui="list-item" data-role="nav-item">
            <span className="bo-homeListIcon" aria-hidden="true" data-ui="list-item-icon">
              {iconForSidebarItemKey(item.key, { size: 18, strokeWidth: 1.8 })}
            </span>
            <span className="bo-homeListLabel" data-ui="list-item-label">{item.label}</span>
          </a>
        ))}
      </section>
    </div>
  );
}
