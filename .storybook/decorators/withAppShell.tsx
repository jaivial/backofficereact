import type { Decorator } from "@storybook/react";
import React, { useMemo, useRef } from "react";
import { Provider as JotaiProvider, createStore } from "jotai";

import type { BOSession } from "../../api/types";
import { sessionAtom, sessionMovingExpirationAtom, themeAtom, type ThemeMode } from "../../state/atoms";
import { Sidebar } from "../../ui/shell/Sidebar";
import { Topbar } from "../../ui/shell/Topbar";
import { ToastStack } from "../../ui/feedback/ToastStack";
import { setPageContext } from "../mocks/usePageContext";

const MOCK_SESSION: BOSession = {
  user: {
    id: 1,
    email: "admin@villacarmen.local",
    name: "Admin",
    role: "admin",
    roleImportance: 90,
    sectionAccess: ["reservas", "menus", "comida", "miembros", "horarios", "fichaje", "facturas", "reportes", "estado_cuenta", "website"],
  },
  restaurants: [{ id: 1, slug: "villacarmen", name: "Alqueria Villa Carmen" }],
  activeRestaurantId: 1,
};

type AppShellParams = {
  title?: string;
  pathname?: string;
  data?: Record<string, unknown>;
  session?: BOSession;
  noShell?: boolean;
};

function getShellParams(context: any): AppShellParams {
  return context.parameters?.appShell ?? {};
}

const withAppShell: Decorator = (Story, context) => {
  const params = getShellParams(context);
  const pathname = params.pathname ?? "/app/dashboard";
  const data = params.data ?? {};
  const session = params.session ?? MOCK_SESSION;
  const noShell = params.noShell ?? false;

  // Set page context synchronously during render so the story
  // component sees the correct data on its first render.
  const lastCtxKey = useRef("");
  const ctxKey = `${pathname}:${JSON.stringify(data)}`;
  if (lastCtxKey.current !== ctxKey) {
    setPageContext({ urlPathname: pathname, data, routeParams: {} });
    lastCtxKey.current = ctxKey;
  }

  const store = useMemo(() => {
    const s = createStore();
    s.set(themeAtom, "dark" as ThemeMode);
    s.set(sessionAtom, session);
    s.set(sessionMovingExpirationAtom, new Date(Date.now() + 3600000).toISOString());
    return s;
  }, [session]);

  if (noShell) {
    return (
      <JotaiProvider store={store}>
        <ToastStack />
        <Story />
      </JotaiProvider>
    );
  }

  const isReservasTables = pathname.startsWith("/app/reservas/tables");

  return (
    <JotaiProvider store={store}>
      <ToastStack />
      <div className="bo-app bo-app--page" data-slot="storybook-app-shell">
        <Sidebar
          pathname={pathname}
          role={session.user.role}
          sectionAccess={session.user.sectionAccess}
          roleImportance={session.user.roleImportance}
        />
        <main className={`bo-main${isReservasTables ? " bo-main--immersive" : ""}`}>
          {isReservasTables ? null : <Topbar title={params.title ?? "Backoffice"} />}
          <Story />
        </main>
      </div>
    </JotaiProvider>
  );
};

export default withAppShell;
