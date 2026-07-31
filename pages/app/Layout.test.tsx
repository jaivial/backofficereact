import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Provider, createStore } from "jotai";

import Layout from "./+Layout";
import { posFullscreenAtom } from "../../state/atoms";

const pageContext = { urlPathname: "/app/pos", bo: { session: { activeRestaurantId: 1, user: { role: "admin", sectionAccess: [], roleImportance: 50 } } } };

vi.mock("vike-react/usePageContext", () => ({ usePageContext: () => pageContext }));
vi.mock("../../ui/shell/Sidebar", () => ({ Sidebar: () => <nav data-testid="sidebar" /> }));
vi.mock("../../ui/shell/Topbar", () => ({ Topbar: () => <header data-testid="topbar" /> }));
vi.mock("motion/react", () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  motion: { div: ({ children }: { children: React.ReactNode }) => <div>{children}</div> },
  useReducedMotion: () => true,
}));

describe("app Layout POS fullscreen", () => {
  beforeEach(() => {
    pageContext.urlPathname = "/app/pos";
  });

  it("renders topbar and normal main by default", () => {
    render(<Provider><Layout>content</Layout></Provider>);
    expect(screen.getByTestId("topbar")).toBeInTheDocument();
    expect(screen.getByTestId("app-layout-main")).not.toHaveClass("bo-main--immersive");
  });

  it("hides topbar and goes immersive when posFullscreenAtom is on", () => {
    const store = createStore();
    store.set(posFullscreenAtom, true);
    render(<Provider store={store}><Layout>content</Layout></Provider>);
    expect(screen.queryByTestId("topbar")).not.toBeInTheDocument();
    expect(screen.getByTestId("app-layout-main")).toHaveClass("bo-main--immersive");
    expect(screen.getByTestId("app-layout-main")).toHaveClass("bo-main--pos-fullscreen");
    expect(screen.queryByTestId("sidebar")).not.toBeInTheDocument();
  });

  it("ignores posFullscreenAtom outside /app/pos", () => {
    pageContext.urlPathname = "/app/dashboard";
    const store = createStore();
    store.set(posFullscreenAtom, true);
    render(<Provider store={store}><Layout>content</Layout></Provider>);
    expect(screen.getByTestId("topbar")).toBeInTheDocument();
    expect(screen.getByTestId("app-layout-main")).not.toHaveClass("bo-main--immersive");
  });
});
