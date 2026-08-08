import { afterEach, describe, expect, it } from "vitest";

import {
  ForkyWsClient,
  recoverEncodedReply,
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

describe("recoverEncodedReply", () => {
  // base64 of: "¡Hola! 😄 Para la semana que viene (17 al 23 de agosto de 2026), tenes **dos reservas**"
  const b64 =
    "wqFIb2xhISDwn5iEIFBhcmEgbGEgc2VtYW5hIHF1ZSB2aWVuZSAoMTcgYWwgMjMgZGUgYWdvc3RvIGRlIDIwMjYpLCB0ZW5lcyAqKmRvcyByZXNlcnZhcyoq";

  it("decodes a base64-wrapped reply to readable text", () => {
    const out = recoverEncodedReply(b64);
    expect(out).toContain("reservas");
    expect(out).not.toBe(b64);
  });

  it("leaves plain Spanish prose untouched", () => {
    const plain = "¡Hola! Hoy tienes 2 reservas confirmadas 😊\n";
    expect(recoverEncodedReply(plain)).toBe(plain);
  });

  it("leaves markdown tables untouched", () => {
    const table = "| Fecha | Hora |\n|---|---|\n| 10 | 20:30 |";
    expect(recoverEncodedReply(table)).toBe(table);
  });

  it("rejects binary garbage (keeps original)", () => {
    const garbage = "wodobGEbm8gaGF5IHJlc2VydmFzIHBhcmEgaG95ICEgwr9BcsOtIHVuIGRpYSBtw6Fz";
    expect(recoverEncodedReply(garbage)).toBe(garbage);
  });

  it("decodes misaligned base64 (length % 4 != 0)", () => {
    // ASCII payload so btoa (Latin-1) is deterministic across jsdom/node.
    const good = btoa("reservas de la semana proxima para el lunes");
    const mis = good.slice(0, -1); // force length % 4 == 3
    const out = recoverEncodedReply(mis);
    expect(out).toContain("reservas de la semana");
    expect(out).not.toBe(mis);
  });

  it("strips MiniMax CJK and filler symbols from a normal (non-base64) reply", () => {
    const garbled =
      "©Hhoye, tienes 7 reservas con 具体的 y 人数. " +
      "3Cléspero! 😄 ⚳ 共pó de suiernos! 😊";
    const out = recoverEncodedReply(garbled);
    // CJK ideographs and filler symbols are removed; accents and emoji survive.
    expect(out).not.toContain("具体");
    expect(out).not.toContain("人数");
    expect(out).not.toContain("共");
    expect(out).not.toContain("©");
    expect(out).not.toContain("⚳");
    expect(out).toContain("Cléspero");
    expect(out).toContain("😄");
    expect(out).toContain("😊");
  });

  it("does not touch Spanish accents, digits, punctuation or emoji when cleaning", () => {
    const clean = "¡Hola! 👋 Hoy tienes 7 reservas para 49 comensales: García y López 😊";
    const out = recoverEncodedReply(clean);
    expect(out).toBe(clean);
  });

  it("strips CJK inside otherwise-clean markdown tables", () => {
    const table =
      "| Fecha | Cliente | Personas |\n" +
      "|---|---|---|\n" +
      "| 19/07 | García | 具体的 6 |";
    const out = recoverEncodedReply(table);
    expect(out).not.toContain("具体");
    expect(out).toContain("--|---|---|");
    expect(out).toContain("García");
  });

  it("decodes base64 wrapped in markdown code fences / quotes", () => {
    // ASCII payload keeps btoa (Latin-1) deterministic across runtimes.
    const msg = "Hola! Hoy tienes 1 reserva confirmada para el 2026-09-26.";
    const b64 = btoa(msg);
    expect(recoverEncodedReply("```\n" + b64 + "\n```")).toBe(msg);
    expect(recoverEncodedReply("```json\n" + b64 + "\n```")).toBe(msg);
    expect(recoverEncodedReply('"' + b64 + '"')).toBe(msg);
  });

  it("recovers a truncated base64 payload (len%4 == 1)", () => {
    const good = btoa("reservas de la semana proxima para el lunes con detalle");
    // Trim 3 chars so the payload length % 4 == 1, which makes a bare atob
    // throw; the resilient path must still recover the readable head.
    const truncated = good.slice(0, good.length - 3);
    expect(truncated.length % 4).toBe(1);
    const out = recoverEncodedReply(truncated);
    expect(out).toContain("reservas");
    expect(out).not.toBe(truncated);
  });
});
