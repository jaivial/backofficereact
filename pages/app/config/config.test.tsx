import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("motion/react", () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  },
  useReducedMotion: () => true,
}));

vi.mock("vike-react/usePageContext", () => ({
  usePageContext: () => mockPageContext,
}));

const mockSession = (appVersion: string) => ({
  user: { id: 1, email: "root@villacarmen.com", name: "Root", role: "root", roleImportance: 100, sectionAccess: [], appVersion },
  restaurants: [{ id: 1, slug: "villa", name: "Villa" }],
  activeRestaurantId: 1,
});

let mockPageContext: {
  bo: { session: ReturnType<typeof mockSession> | null };
  urlParsed: { search: Record<string, unknown> };
  data: Record<string, unknown>;
};

vi.mock("jotai", () => ({
  atom: (init: unknown) => ({ init }),
  useAtomValue: () => mockPageContext.bo?.session ?? null,
  useSetAtom: () => vi.fn(),
  useAtom: () => [null, vi.fn()],
}));

vi.mock("lucide-react", () => {
  const icon = () => <span data-testid="mock-icon" />;
  return {
    Building2: icon,
    LayoutGrid: icon,
    Phone: icon,
    UtensilsCrossed: icon,
    CalendarDays: icon,
    Scale: icon,
    Sparkles: icon,
    Cloud: icon,
    Megaphone: icon,
  };
});

vi.mock("../../../api/client", () => ({
  createClient: () => ({
    auth: { setPreference: vi.fn().mockResolvedValue({ success: true }) },
    config: { getDefaults: vi.fn(), getDefaultFloors: vi.fn(), getRestaurantInfo: vi.fn() },
    ads: {},
  }),
}));

vi.mock("../../../ui/feedback/useToasts", () => ({
  useToasts: () => ({ pushToast: vi.fn(), toasts: [] }),
}));

vi.mock("../../../ui/feedback/useErrorToast", () => ({
  useErrorToast: () => undefined,
}));

vi.mock("../../../ui/hooks/useBooleanPreference", () => ({
  useBooleanPreference: () => [false, vi.fn()],
}));

vi.mock("../../../ui/feedback/InlineAlert", () => ({
  InlineAlert: ({ title }: { title?: string }) => <div data-testid="mock-inline-alert">{title}</div>,
}));

vi.mock("../../../ui/nav/Tabs", () => ({
  Tabs: ({ tabs, onNavigate }: { tabs: { id: string; label: string }[]; onNavigate: (href: string, id: string) => void }) => (
    <nav data-testid="mock-config-tabs">
      {tabs.map((tab) => (
        <a key={tab.id} data-testid={`config-tab-${tab.id}`} href={`#${tab.id}`} onClick={(e) => { e.preventDefault(); onNavigate(`#${tab.id}`, tab.id); }}>
          {tab.label}
        </a>
      ))}
    </nav>
  ),
}));

vi.mock("./functionalComponents/ConfigRestaurante/ConfigRestaurante", () => ({
  ConfigRestauranteContent: () => <div data-testid="mock-config-restaurante">Restaurante</div>,
}));
vi.mock("./functionalComponents/ConfigContacto/ConfigContacto", () => ({
  ConfigContactoContent: () => <div data-testid="mock-config-contacto">Contacto</div>,
}));
vi.mock("./booking/BookingManager", () => ({
  BookingManager: () => <div data-testid="mock-config-booking">Booking</div>,
}));
vi.mock("./functionalComponents/ConfigLegalPages/ConfigLegalPages", () => ({
  ConfigLegalPages: () => <div data-testid="mock-config-legal">Legal</div>,
}));
vi.mock("./functionalComponents/ConfigAIImage/ConfigAIImage", () => ({
  ConfigAIImage: () => <div data-testid="mock-config-ia">IA</div>,
}));
vi.mock("./functionalComponents/ConfigMiniMax/ConfigMiniMax", () => ({
  ConfigMiniMax: () => <div data-testid="mock-config-minimax">MiniMax</div>,
}));
vi.mock("./functionalComponents/ConfigBunnyStorage/ConfigBunnyStorage", () => ({
  ConfigBunnyStorage: () => <div data-testid="mock-config-cdn">CDN</div>,
}));
vi.mock("./functionalComponents/ConfigWhatsAppBot/ConfigWhatsAppBot", () => ({
  ConfigWhatsAppBot: () => <div data-testid="mock-config-bot">Bot</div>,
}));
vi.mock("./functionalComponents/ConfigAnuncios/ConfigAnuncios", () => ({
  ConfigAnuncios: () => <div data-testid="mock-config-anuncios">Anuncios</div>,
}));

import Page from "./config";

function makeData(search: Record<string, unknown> = {}) {
  mockPageContext = {
    bo: { session: mockSession("0.2") },
    urlParsed: { search },
    data: {
      defaults: {},
      floors: [],
      restaurantInfo: { direccion: "", telefono: "", email: "", website: "", cif: "", direccionFacturacion: "", clasificacion: "sociedad", tipoEmpresa: "sl" },
      hourSplitDetailsOpen: false,
      error: null,
    },
  };
}

describe("Config page — Anuncios tab A/B version gating", () => {
  it("hides the Anuncios tab for a v0.1 user", () => {
    makeData();
    mockPageContext.bo!.session = mockSession("0.1");
    render(<Page />);
    expect(screen.getByTestId("config-tab-restaurante")).toBeTruthy();
    expect(screen.queryByTestId("config-tab-anuncios")).toBeNull();
  });

  it("shows the Anuncios tab for a v0.2 user", () => {
    makeData();
    mockPageContext.bo!.session = mockSession("0.2");
    render(<Page />);
    expect(screen.getByTestId("config-tab-anuncios")).toBeTruthy();
  });

  it("does not render the Anuncios editor for a v0.1 user even with ?content=anuncios", () => {
    makeData({ content: "anuncios" });
    mockPageContext.bo!.session = mockSession("0.1");
    render(<Page />);
    expect(screen.queryByTestId("mock-config-anuncios")).toBeNull();
  });

  it("renders the Anuncios editor for a v0.2 user with ?content=anuncios", () => {
    makeData({ content: "anuncios" });
    mockPageContext.bo!.session = mockSession("0.2");
    render(<Page />);
    expect(screen.getByTestId("mock-config-anuncios")).toBeTruthy();
  });
});
