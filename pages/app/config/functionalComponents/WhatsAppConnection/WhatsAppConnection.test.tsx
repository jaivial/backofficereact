import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  connection: vi.fn(),
  connect: vi.fn(),
  disconnect: vi.fn(),
  pushToast: vi.fn(),
}));

vi.mock("../../../../../api/client", () => ({
  createClient: () => ({
    members: {
      whatsappConnection: mocks.connection,
      whatsappConnect: mocks.connect,
      whatsappDisconnect: mocks.disconnect,
    },
  }),
}));

vi.mock("../../../../../ui/feedback/useToasts", () => ({
  useToasts: () => ({ pushToast: mocks.pushToast }),
}));

import { deriveState, qrToSrc, WhatsAppConnection } from "./WhatsAppConnection";

class MockWebSocket {
  static instances: MockWebSocket[] = [];
  static OPEN = 1;
  static CONNECTING = 0;

  readyState = MockWebSocket.CONNECTING;
  onopen: (() => void) | null = null;
  onmessage: ((event: MessageEvent<string>) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;

  constructor(readonly url: string) {
    MockWebSocket.instances.push(this);
  }

  open() {
    this.readyState = MockWebSocket.OPEN;
    this.onopen?.();
  }

  emit(payload: unknown) {
    this.onmessage?.({ data: JSON.stringify(payload) } as MessageEvent<string>);
  }

  close = vi.fn(() => {
    this.readyState = 3;
  });
}

describe("WhatsAppConnection", () => {
  beforeEach(() => {
    MockWebSocket.instances = [];
    vi.stubGlobal("WebSocket", MockWebSocket);
    mocks.connection.mockReset().mockResolvedValue({ success: true, entitled: true, connected: false, connection: null });
    mocks.connect.mockReset().mockResolvedValue({
      success: true,
      entitled: true,
      connected: false,
      connection: { status: "pending", connected: false, qr: "AAAA" },
    });
    mocks.disconnect.mockReset().mockResolvedValue({ success: true, entitled: true, connected: false, connection: null });
    mocks.pushToast.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses HTTP once, then WebSocket snapshots without polling", async () => {
    const view = render(<WhatsAppConnection />);

    await screen.findByRole("button", { name: "Conectar WhatsApp" });
    expect(mocks.connection).toHaveBeenCalledTimes(1);
    expect(MockWebSocket.instances).toHaveLength(1);
    expect(MockWebSocket.instances[0].url).toContain("/api/admin/members/whatsapp/ws");

    await act(async () => {
      MockWebSocket.instances[0].open();
      MockWebSocket.instances[0].emit({
        type: "whatsapp.connection",
        success: true,
        entitled: true,
        connected: false,
        connection: { status: "pending", connected: false, qr: "BBBB" },
      });
    });
    expect(screen.getByAltText("Código QR para vincular WhatsApp")).toHaveAttribute("src", "data:image/png;base64,BBBB");

    await act(async () => {
      MockWebSocket.instances[0].emit({
        type: "whatsapp.connection",
        success: true,
        entitled: true,
        connected: true,
        connection: { status: "connected", connected: true, phone: "34692747052" },
      });
    });
    expect(screen.getByText(/34692747052/)).toBeInTheDocument();
    expect(mocks.connection).toHaveBeenCalledTimes(1);

    view.unmount();
    expect(MockWebSocket.instances[0].close).toHaveBeenCalled();
  });

  it("connects with one QR button", async () => {
    render(<WhatsAppConnection />);
    const button = await screen.findByRole("button", { name: "Conectar WhatsApp" });
    fireEvent.click(button);

    await waitFor(() => expect(mocks.connect).toHaveBeenCalledWith({}));
    expect(await screen.findByAltText("Código QR para vincular WhatsApp")).toHaveAttribute("src", "data:image/png;base64,AAAA");
    expect(screen.queryByLabelText(/Número de teléfono/)).not.toBeInTheDocument();
  });

  it("cancels QR pairing and returns to disconnected UI", async () => {
    mocks.connection.mockResolvedValue({
      success: true,
      entitled: true,
      connected: false,
      connection: { status: "pending", connected: false, qr: "BBBB" },
    });
    render(<WhatsAppConnection />);

    fireEvent.click(await screen.findByRole("button", { name: "Cancelar vinculación" }));
    await waitFor(() => expect(mocks.disconnect).toHaveBeenCalledWith({ delete_instance: false }));
    expect(await screen.findByRole("button", { name: "Conectar WhatsApp" })).toBeEnabled();
  });

  it("renders nothing when subscription plan lacks WhatsApp", async () => {
    mocks.connection.mockResolvedValue({
      success: true,
      entitled: false,
      connected: false,
      code: "NEEDS_SUBSCRIPTION",
      connection: null,
    });
    render(<WhatsAppConnection />);

    await waitFor(() => expect(mocks.connection).toHaveBeenCalled());
    expect(screen.queryByLabelText("Bot de WhatsApp")).not.toBeInTheDocument();
  });

  it("confirms disconnect in reusable modal and clears busy state", async () => {
    mocks.connection.mockResolvedValue({
      success: true,
      entitled: true,
      connected: true,
      connection: { status: "connected", connected: true, phone: "34692747052" },
    });
    let resolveDisconnect!: (value: unknown) => void;
    mocks.disconnect.mockReturnValue(new Promise((resolve) => { resolveDisconnect = resolve; }));
    render(<WhatsAppConnection />);

    fireEvent.click(await screen.findByRole("button", { name: "Desconectar WhatsApp" }));
    const dialog = screen.getByRole("dialog", { name: "Desconectar WhatsApp" });
    expect(dialog).toHaveTextContent("El bot dejará de responder");
    expect(mocks.disconnect).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Desconectar" }));
    expect(await screen.findByRole("button", { name: "Procesando..." })).toBeDisabled();
    await act(async () => {
      resolveDisconnect({ success: true, entitled: true, connected: false, connection: null });
    });

    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Desconectar WhatsApp" })).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Conectar WhatsApp" })).toBeEnabled();
  });
});

describe("WhatsApp connection state", () => {
  it("normalizes QR sources", () => {
    expect(qrToSrc("AAAA")).toBe("data:image/png;base64,AAAA");
    expect(qrToSrc("data:image/png;base64,BBBB")).toBe("data:image/png;base64,BBBB");
  });

  it("derives locked, pending and connected states", () => {
    expect(deriveState({ entitled: false })).toBe("locked");
    expect(deriveState({ entitled: true, connected: false, connection: { status: "pending", connected: false, qr: "x" } })).toBe("qr_ready");
    expect(deriveState({ entitled: true, connected: true, connection: { status: "connected", connected: true } })).toBe("connected");
  });
});
