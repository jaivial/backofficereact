import type { BOSession } from "../api/types";

declare global {
  namespace Vike {
    interface PageContext {
      bo?: { theme: "dark" | "light"; session: BOSession | null };
    }

    interface PageContextServer {
      boRequest?: { cookieHeader?: string; backendOrigin?: string };
    }
  }
}

export {};

