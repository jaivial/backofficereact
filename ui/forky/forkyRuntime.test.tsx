import { afterEach, describe, expect, it } from "vitest";

import {
  ForkyWsClient,
  type ForkyHistoryMessage,
  type ForkyTurnEvent,
} from "./forkyRuntime";

/** Minimal in-memory WebSocket stand-in for the transport tests. */
class FakeWebSocket {
  static instances: FakeWebSocket[] = [];
  readyState = 0;
  sent: string[] = [];
  onopen: ((ev: unknown) => void) | null = null;
  onmessage: ((ev: { data: unknown }) => void) | null = null;
  onclose: ((ev: unknown) => void) | null = null;
  onerror: ((ev: unknown) => void) | null = null;

  constructor(public url: string) {
    FakeWebSocket.instances.push(this);
  }

  send(data: string): void {
    this.sent.push(data);
  }

  close(code?: number, reason?: string): void {
    this.readyState = 3;
    this.onclose?.({ code, reason });
  }

  open(): void {
    this.readyState = 1;
    this.onopen?.({});
  }

  receive(frame: unknown): void {
    this.onmessage?.({ data: JSON.stringify(frame) });
  }

  lastSentJSON(): Record<string, unknown> {
    return JSON.parse(this.sent[this.sent.length - 1] ?? "{}") as Record<string, unknown>;
  }
}

function makeClient(options?: { maxReconnectAttempts?: number }): {
  client: ForkyWsClient;
  history: ForkyHistoryMessage[];
} {
  const history: ForkyHistoryMessage[] = [];
  const client = new ForkyWsClient({
    url: "ws://test/assistant",
    WebSocketImpl: FakeWebSocket as never,
    onHistory: (h) => history.push(...h),
    reconnectBaseMs: 5,
    reconnectMaxMs: 10,
    maxReconnectAttempts: options?.maxReconnectAttempts ?? 2,
  });
  return { client, history };
}

function helloFrame(sessionId: number | null, history: ForkyHistoryMessage[] = []) {
  return { type: "hello", session_id: sessionId, history };
}

async function collectTurn(
  client: ForkyWsClient,
  content: string,
  abort?: AbortSignal
): Promise<ForkyTurnEvent[]> {
  const events: ForkyTurnEvent[] = [];
  for await (const event of client.runTurn(content, abort)) {
    events.push(event);
  }
  return events;
}

afterEach(() => {
  FakeWebSocket.instances = [];
  localStorage.clear();
});

describe("ForkyWsClient", () => {
  it("sends hello and seeds history + session id from the hello frame", async () => {
    const { client, history } = makeClient();
    const connected = client.ensureConnected();
    const ws = FakeWebSocket.instances[0];
    expect(ws).toBeDefined();
    ws.open();
    expect(ws.lastSentJSON()).toEqual({ type: "hello", session_id: null });

    ws.receive(helloFrame(42, [
      { role: "user", content: "u1" },
      { role: "assistant", content: "a1" },
    ]));
    await connected;

    expect(history).toEqual([
      { role: "user", content: "u1" },
      { role: "assistant", content: "a1" },
    ]);
    expect(localStorage.getItem("forky_session_id")).toBe("42");
    client.dispose();
  });

  it("reuses the stored session id on reconnect", async () => {
    localStorage.setItem("forky_session_id", "7");
    const { client } = makeClient();
    const connected = client.ensureConnected();
    FakeWebSocket.instances[0].open();
    FakeWebSocket.instances[0].receive(helloFrame(7));
    await connected;

    // Force a reconnect by disposing and reconnecting.
    client.dispose();
    const again = client.ensureConnected();
    const ws2 = FakeWebSocket.instances[1];
    ws2.open();
    expect(ws2.lastSentJSON()).toEqual({ type: "hello", session_id: 7 });
    ws2.receive(helloFrame(7));
    await again;
    client.dispose();
  });

  it("streams status, delta and done in order for one turn", async () => {
    const { client } = makeClient();
    const turn = collectTurn(client, "hola");
    const ws = FakeWebSocket.instances[0];
    ws.open();
    ws.receive(helloFrame(1));
    await new Promise((r) => setTimeout(r, 0));

    ws.receive({ type: "status", state: "thinking" });
    ws.receive({ type: "delta", text: "Hola, " });
    ws.receive({ type: "delta", text: "soy Forky" });
    ws.receive({ type: "done" });

    const events = await turn;
    expect(events.map((e) => e.type)).toEqual(["status", "delta", "delta", "done"]);
    expect(ws.sent.some((s) => JSON.parse(s).type === "message")).toBe(true);
    expect(JSON.parse(ws.sent.find((s) => JSON.parse(s).type === "message")!)).toMatchObject({
      type: "message",
      content: "hola",
    });
    client.dispose();
  });

  it("surfaces server errors as error events", async () => {
    const { client } = makeClient();
    const turn = collectTurn(client, "hola");
    const ws = FakeWebSocket.instances[0];
    ws.open();
    ws.receive(helloFrame(1));
    await new Promise((r) => setTimeout(r, 0));

    ws.receive({ type: "error", message: "busy" });
    const events = await turn;
    expect(events[0]).toMatchObject({ type: "error", message: "busy" });
    client.dispose();
  });

  it("rejects a second concurrent turn while one is in flight", async () => {
    const { client } = makeClient();
    const first = collectTurn(client, "primera");
    const ws = FakeWebSocket.instances[0];
    ws.open();
    ws.receive(helloFrame(1));
    await new Promise((r) => setTimeout(r, 0));

    const second = collectTurn(client, "segunda");
    const events = await second;
    expect(events[0]).toMatchObject({ type: "error", message: "busy" });

    ws.receive({ type: "done" });
    await first;
    client.dispose();
  });

  it("aborts an in-flight turn and closes the socket", async () => {
    const { client } = makeClient();
    const controller = new AbortController();
    const turn = collectTurn(client, "hola", controller.signal);
    const ws = FakeWebSocket.instances[0];
    ws.open();
    ws.receive(helloFrame(1));
    await new Promise((r) => setTimeout(r, 0));

    controller.abort();
    const events = await turn;
    expect(events).toEqual([]);
    client.dispose();
  });

  it("reconnects mid-turn and re-sends the pending message", async () => {
    const { client } = makeClient({ maxReconnectAttempts: 3 });
    const turn = collectTurn(client, "pendiente");
    const ws = FakeWebSocket.instances[0];
    ws.open();
    ws.receive(helloFrame(5));
    await new Promise((r) => setTimeout(r, 0));

    // Server drops the connection before answering.
    ws.close();
    await new Promise((r) => setTimeout(r, 30));

    const ws2 = FakeWebSocket.instances[1];
    expect(ws2).toBeDefined();
    ws2.open();
    ws2.receive(helloFrame(5));
    await new Promise((r) => setTimeout(r, 0));
    expect(ws2.lastSentJSON()).toEqual({ type: "message", content: "pendiente" });

    ws2.receive({ type: "delta", text: "ok" });
    ws2.receive({ type: "done" });
    const events = await turn;
    expect(events.map((e) => e.type)).toEqual(["delta", "done"]);
    client.dispose();
  });
});
