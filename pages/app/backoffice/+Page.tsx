import React, { useMemo } from "react";
import { usePageContext } from "vike-react/usePageContext";
import { useAtomValue } from "jotai";
import { sessionAtom } from "../../../state/atoms";

import { sidebarItemsForRole, type SidebarItem } from "../../../lib/navigation";
import { iconForSidebarItemKey } from "../../../ui/nav/sectionIcons";
import type { OrbitItem } from "./types/index";

export default function Page() {
  const pageContext = usePageContext();
  const atomSession = useAtomValue(sessionAtom);
  const session = pageContext.bo?.session ?? atomSession;

  const role = session?.user?.role ?? "admin";
  const sectionAccess = session?.user?.sectionAccess ?? [];
  const roleImportance = session?.user?.roleImportance ?? 100;
  const appVersion = session?.user?.appVersion ?? "0.2";
  const name = session?.user?.name ?? "Admin";

  const items = useMemo(() => sidebarItemsForRole(role, sectionAccess, roleImportance, appVersion), [role, roleImportance, sectionAccess, appVersion]);

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

      <section className="bo-homeNav" aria-label="Accesos rapidos" data-ui="backoffice-nav-orbit">
        <div className="bo-homeOrbit" role="navigation" aria-label="Secciones del backoffice" data-ui="orbit-nav">
          <div className="bo-homeRing bo-homeRing--outer" aria-hidden="true" data-ui="ring-outer" />
          <div className="bo-homeRing bo-homeRing--inner" aria-hidden="true" data-ui="ring-inner" />

          <div className="bo-homeCenter" aria-hidden="true" data-ui="orbit-center">
            <img className="bo-homeCenterLogo" src="https://herorestaurantmedia.b-cdn.net/icon/ChatGPT_Image_Jul_15__2026__05_39_27_PM-removebg-preview.png" alt="" />
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

      <section className="bo-homeList" aria-label="Secciones (lista)" data-ui="backoffice-nav-list">
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
