import { createElement, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { setForkyVisualState } from "./forkyStatus";
import {
  AssistantRuntimeProvider,
  fromThreadMessageLike,
  generateId,
  useLocalRuntime,
  type AssistantRuntime,
  type ChatModelAdapter,
  type ChatModelRunResult,
} from "@assistant-ui/react";

// ---------------------------------------------------------------------------
// WebSocket transport for the Forky assistant.
//
// Wire protocol (JSON text frames), per the shared contract v1:
//   client -> server: {type:"hello", session_id:<int|null>}
//                     {type:"message", content:"..."}
//                     {type:"ping"}
//   server -> client: {type:"hello", session_id:<int>, history:[{role,content}]}
//                     {type:"status", state:"thinking"|"streaming"}
//                     {type:"delta", text:"..."}
//                     {type:"done"}
//                     {type:"error", message:"..."}
//                     {type:"pong"}
// ---------------------------------------------------------------------------

const SESSION_STORAGE_KEY = "forky_session_id";

export type ForkyHistoryMessage = { role: "user" | "assistant"; content: string };

/** Public events surfaced by a single conversational turn. */
export type ForkyTurnEvent =
  | { type: "status"; state: string }
  | { type: "delta"; text: string }
  | { type: "done" }
  | { type: "error"; message: string };

type InternalTurnEvent = ForkyTurnEvent | { type: "__abort" };

type WebSocketLike = {
  readyState: number;
  send(data: string): void;
  close(code?: number, reason?: string): void;
  onopen: ((ev: unknown) => void) | null;
  onmessage: ((ev: { data: unknown }) => void) | null;
  onclose: ((ev: unknown) => void) | null;
  onerror: ((ev: unknown) => void) | null;
};

type WebSocketCtor = new (url: string) => WebSocketLike;

const WS_OPEN = 1;

export type ForkyWsClientOptions = {
  url: string;
  /** Injectable for tests. Defaults to the global WebSocket. */
  WebSocketImpl?: WebSocketCtor;
  /** Called once per connection with the seeded history from the hello frame. */
  onHistory?: (history: ForkyHistoryMessage[]) => void;
  reconnectBaseMs?: number;
  reconnectMaxMs?: number;
  maxReconnectAttempts?: number;
  /** Client keepalive interval; keeps the server read deadline from expiring. */
  keepaliveMs?: number;
  /** Fail a turn when the server sends nothing at all for this long. */
  turnIdleTimeoutMs?: number;
};

/** Minimal promise-backed FIFO queue bridging socket callbacks to the turn generator. */
class AsyncQueue<T> {
  private items: T[] = [];
  private resolvers: Array<(value: T) => void> = [];

  push(item: T): void {
    const resolve = this.resolvers.shift();
    if (resolve) resolve(item);
    else this.items.push(item);
  }

  next(): Promise<T> {
    if (this.items.length > 0) return Promise.resolve(this.items.shift() as T);
    return new Promise<T>((resolve) => this.resolvers.push(resolve));
  }
}

type ActiveTurn = {
  queue: AsyncQueue<InternalTurnEvent>;
  content: string;
  acked: boolean;
  /** Watchdog: fails the turn when the server goes silent (never fires after done/error). */
  idleTimer: ReturnType<typeof setTimeout> | null;
};

export class ForkyWsClient {
  private readonly url: string;
  private readonly WS: WebSocketCtor;
  private readonly reconnectBaseMs: number;
  private readonly reconnectMaxMs: number;
  private readonly maxReconnectAttempts: number;
  private readonly keepaliveMs: number;
  private readonly turnIdleTimeoutMs: number;

  private ws: WebSocketLike | null = null;
  private connecting: Promise<void> | null = null;
  private handshakeDone = false;
  private handshakeResolve: (() => void) | null = null;
  private handshakeReject: ((err: Error) => void) | null = null;
  private historyDelivered = false;
  private onHistory?: (history: ForkyHistoryMessage[]) => void;

  private intentionalClose = false;
  private disposed = false;
  private busy = false;
  private activeTurn: ActiveTurn | null = null;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private keepaliveTimer: ReturnType<typeof setInterval> | null = null;

  constructor(options: ForkyWsClientOptions) {
    this.url = options.url;
    this.WS = options.WebSocketImpl ?? (globalThis as { WebSocket?: WebSocketCtor }).WebSocket!;
    this.onHistory = options.onHistory;
    this.reconnectBaseMs = options.reconnectBaseMs ?? 800;
    this.reconnectMaxMs = options.reconnectMaxMs ?? 8000;
    this.maxReconnectAttempts = options.maxReconnectAttempts ?? 5;
    this.keepaliveMs = options.keepaliveMs ?? 30_000;
    this.turnIdleTimeoutMs = options.turnIdleTimeoutMs ?? 120_000;
  }

  setHistoryHandler(handler: (history: ForkyHistoryMessage[]) => void): void {
    this.onHistory = handler;
  }

  /** Open the socket (if needed) and resolve once the hello handshake completes. */
  ensureConnected(): Promise<void> {
    if (this.ws && this.handshakeDone) return Promise.resolve();
    if (this.connecting) return this.connecting;
    this.connecting = this.openSocket();
    return this.connecting;
  }

  /** Drive one user turn, yielding status/delta/done/error events in order. */
  async *runTurn(content: string, abortSignal?: AbortSignal): AsyncGenerator<ForkyTurnEvent, void> {
    if (abortSignal?.aborted) return;
    if (this.busy) {
      yield { type: "error", message: "busy" };
      return;
    }

    try {
      await this.ensureConnected();
    } catch {
      yield { type: "error", message: "connection_failed" };
      return;
    }

    this.busy = true;
    const queue = new AsyncQueue<InternalTurnEvent>();
    const turn: ActiveTurn = { queue, content, acked: false, idleTimer: null };
    this.activeTurn = turn;
    this.armTurnIdleTimer(turn);

    const onAbort = () => {
      this.close(1000, "aborted");
      queue.push({ type: "__abort" });
    };
    abortSignal?.addEventListener("abort", onAbort);

    this.rawSend({ type: "message", content });

    try {
      while (true) {
        const event = await queue.next();
        if (event.type === "__abort") return;
        if (event.type === "done") {
          yield { type: "done" };
          return;
        }
        if (event.type === "error") {
          yield event;
          return;
        }
        yield event; // status | delta
      }
    } finally {
      abortSignal?.removeEventListener("abort", onAbort);
      this.clearTurnIdleTimer(turn);
      this.activeTurn = null;
      this.busy = false;
    }
  }

  /** Close the socket for good and stop reconnecting. */
  dispose(): void {
    this.disposed = true;
    this.close(1000, "dispose");
  }

  /** Check if the client has been disposed. */
  isDisposed(): boolean {
    return this.disposed;
  }

  private close(code: number, reason: string): void {
    this.intentionalClose = true;
    this.clearReconnectTimer();
    this.stopKeepalive();
    this.connecting = null;
    this.handshakeDone = false;
    const ws = this.ws;
    this.ws = null;
    if (ws) {
      try {
        ws.close(code, reason);
      } catch {
        /* ignore */
      }
    }
  }

  private openSocket(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.handshakeResolve = resolve;
      this.handshakeReject = reject;
      this.intentionalClose = false;
      this.historyDelivered = false;
      let ws: WebSocketLike;
      try {
        ws = new this.WS(this.url);
      } catch (err) {
        reject(err instanceof Error ? err : new Error("ws_construct_failed"));
        return;
      }
      this.ws = ws;
      ws.onopen = () => this.rawSend({ type: "hello", session_id: this.readSessionId() });
      ws.onmessage = (ev) => this.handleMessage(ev.data);
      ws.onclose = () => this.handleClose();
      ws.onerror = () => {
        /* close handler drives recovery */
      };
    });
  }

  private handleMessage(raw: unknown): void {
    let frame: Record<string, unknown>;
    try {
      frame = JSON.parse(typeof raw === "string" ? raw : String(raw));
    } catch {
      return;
    }
    // Any frame proves the server is alive: restart the turn watchdog.
    if (this.activeTurn) this.armTurnIdleTimer(this.activeTurn);
    switch (frame.type) {
      case "hello": {
        const sessionId = frame.session_id;
        if (typeof sessionId === "number") this.writeSessionId(sessionId);
        this.handshakeDone = true;
        this.connecting = null;
        this.reconnectAttempts = 0;
        this.startKeepalive();
        if (!this.historyDelivered) {
          this.historyDelivered = true;
          const history = Array.isArray(frame.history) ? (frame.history as ForkyHistoryMessage[]) : [];
          this.onHistory?.(history);
        }
        this.handshakeResolve?.();
        this.handshakeResolve = null;
        this.handshakeReject = null;
        // Reconnected mid-turn: re-send the pending user message (deduped by the
        // one-in-flight guard; the UI already holds the user message).
        if (this.activeTurn && !this.activeTurn.acked) {
          this.rawSend({ type: "message", content: this.activeTurn.content });
        }
        break;
      }
      case "status":
        this.activeTurn?.queue.push({ type: "status", state: String(frame.state ?? "") });
        break;
      case "delta":
        this.activeTurn?.queue.push({ type: "delta", text: String(frame.text ?? "") });
        break;
      case "done":
        if (this.activeTurn) {
          this.activeTurn.acked = true;
          this.activeTurn.queue.push({ type: "done" });
        }
        break;
      case "error":
        // A handshake-time error ("session not found", "session_token required")
        // arrives instead of the hello frame: reject the pending connect so the
        // turn fails fast instead of awaiting a handshake that never resolves.
        if (!this.handshakeDone && this.handshakeReject) {
          this.rejectHandshake(new Error(String(frame.message ?? "error")));
          this.forgetSessionId();
          this.close(1000, "handshake_error");
          break;
        }
        if (this.activeTurn) {
          this.activeTurn.acked = true;
          this.activeTurn.queue.push({ type: "error", message: String(frame.message ?? "error") });
        }
        break;
      case "pong":
      default:
        break;
    }
  }

  private handleClose(): void {
    const wasHandshaking = this.handshakeResolve !== null;
    this.handshakeDone = false;
    this.ws = null;
    this.stopKeepalive();

    if (this.intentionalClose) {
      this.rejectHandshake(new Error("closed"));
      return;
    }

    // Unexpected close mid-turn: reconnect with backoff and resume.
    if (this.activeTurn && !this.activeTurn.acked) {
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        this.activeTurn.queue.push({ type: "error", message: "connection_lost" });
        this.rejectHandshake(new Error("connection_lost"));
        return;
      }
      this.reconnectAttempts += 1;
      const delay = Math.min(
        this.reconnectBaseMs * 2 ** (this.reconnectAttempts - 1),
        this.reconnectMaxMs,
      );
      this.clearReconnectTimer();
      this.connecting = null;
      this.reconnectTimer = setTimeout(() => {
        this.connecting = this.openSocket();
        this.connecting.catch(() => {
          /* handled by handleClose */
        });
      }, delay);
      return;
    }

    // Idle close: drop the socket and reconnect lazily on the next turn.
    this.connecting = null;
    if (wasHandshaking) this.rejectHandshake(new Error("closed"));
  }

  private rejectHandshake(err: Error): void {
    const reject = this.handshakeReject;
    this.handshakeResolve = null;
    this.handshakeReject = null;
    reject?.(err);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  /** Restart the per-turn silence watchdog. */
  private armTurnIdleTimer(turn: ActiveTurn): void {
    this.clearTurnIdleTimer(turn);
    if (this.turnIdleTimeoutMs <= 0) return;
    turn.idleTimer = setTimeout(() => {
      turn.acked = true;
      turn.queue.push({ type: "error", message: "timeout" });
    }, this.turnIdleTimeoutMs);
  }

  private clearTurnIdleTimer(turn: ActiveTurn): void {
    if (turn.idleTimer !== null) {
      clearTimeout(turn.idleTimer);
      turn.idleTimer = null;
    }
  }

  /**
   * Send an application-level ping periodically. The server enforces a read
   * deadline on the socket and closes it when no client frame arrives in time,
   * which otherwise kills idle chats between questions.
   */
  private startKeepalive(): void {
    this.stopKeepalive();
    if (this.keepaliveMs <= 0) return;
    this.keepaliveTimer = setInterval(() => this.rawSend({ type: "ping" }), this.keepaliveMs);
  }

  private stopKeepalive(): void {
    if (this.keepaliveTimer !== null) {
      clearInterval(this.keepaliveTimer);
      this.keepaliveTimer = null;
    }
  }

  private rawSend(frame: Record<string, unknown>): void {
    if (this.ws && this.ws.readyState === WS_OPEN) {
      this.ws.send(JSON.stringify(frame));
    }
  }

  private readSessionId(): number | null {
    try {
      const raw = globalThis.localStorage?.getItem(SESSION_STORAGE_KEY);
      if (!raw) return null;
      const parsed = Number.parseInt(raw, 10);
      return Number.isFinite(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }

  private writeSessionId(sessionId: number): void {
    try {
      globalThis.localStorage?.setItem(SESSION_STORAGE_KEY, String(sessionId));
    } catch {
      /* ignore */
    }
  }

  /** Drop a session id the server rejected so the next connect starts fresh. */
  private forgetSessionId(): void {
    try {
      globalThis.localStorage?.removeItem(SESSION_STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }
}

/** Same-origin backoffice WS endpoint (the Express proxy forwards it to the backend). */
export function forkyWsURL(): string {
  const proto = window.location.protocol === "https:" ? "wss" : "ws";
  return `${proto}://${window.location.host}/api/admin/assistant/ws`;
}

function lastUserText(messages: ChatModelRunOptionsMessages): string {
  const last = messages[messages.length - 1];
  if (!last) return "";
  const parts = last.content;
  if (typeof parts === "string") return parts;
  return parts
    .filter((part): part is { type: "text"; text: string } => part.type === "text")
    .map((part) => part.text)
    .join("");
}

// `run` receives the resolved ThreadMessage list; we only need the text of the
// final user message. Kept structurally typed to avoid importing internal types.
type ChatModelRunOptionsMessages = ReadonlyArray<{
  content: string | ReadonlyArray<{ type: string; text?: string }>;
}>;

// The MiniMax model intermittently wraps a whole reply in base64 (an encoding
// quirk). The backend recovers most cases, but this client-side guard keeps the
// live chat readable even when a raw blob reaches the browser or comes back from
// history. Idempotent: ordinary Spanish prose is never base64-sniffable.
export function recoverEncodedReply(text: string): string {
  // Strip markdown code-fence backticks / quotes MiniMax sometimes wraps
  // around a base64-wrapped reply, then cleanse CJK/filler glyphs first so
  // every short-circuit below returns clean text.
  const wrapped = stripBase64Wrapper(text);
  const input = cleanseMinimaxReply(wrapped);
  const stripped = input.replace(/[\s]+/g, "");
  const body = stripped.replace(/=+$/, "");
  if (body.length < 16) return input;
  if (!/^[A-Za-z0-9+/_-]+$/.test(body)) return input;

  // Decode the largest clean base64 chunk. MiniMax sometimes truncates the
  // payload mid-stream (len%4==1 makes atob throw), so drop trailing chars and
  // keep the longest prefix that decodes to readable text.
  for (let drop = 0; drop <= 8; drop++) {
    const candidate = drop === 0 ? body : body.slice(0, body.length - drop);
    if (candidate.length % 4 === 1) continue; // never a valid quad
    const t = candidate.replace(/-/g, "+").replace(/_/g, "/");
    let dec: string;
    try {
      const bin = atob(t + "=".repeat((4 - (t.length % 4)) % 4));
      const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
      dec = new TextDecoder("utf-8").decode(bytes);
    } catch {
      continue;
    }
    if (dec.length === 0) continue;
    // Accept only if mostly printable human text. Replacement chars (�)
    // from a truncated tail count as NON-printable, so a cut-off reply still
    // passes (head is readable) while binary garbage is rejected.
    let printable = 0;
    for (const ch of dec) {
      const cp = ch.codePointAt(0)!;
      if (cp === 0xfffd) continue;
      if (cp >= 0x20 || ch === "\n" || ch === "\r" || ch === "\t") printable++;
    }
    if (printable / dec.length < 0.9) continue;
    // Repair double-escaped newlines/tabs, then cleanse once more.
    const repaired = dec.replace(/\\n/g, "\n").replace(/\\t/g, "\t").replace(/\\r/g, "\r");
    return cleanseMinimaxReply(repaired);
  }
  return input;
}

// Remove markdown code-fence backticks / quotes / labels MiniMax may print
// around a base64-wrapped reply. Never touches the interior payload.
function stripBase64Wrapper(text: string): string {
  // Only strip backtick fences / quotes / fence language-tags that actually
  // wrap the payload. Do NOT trim general whitespace/newlines here: ordinary
  // prose must round-trip unchanged.
  let t = text;
  let changed = true;
  while (changed) {
    changed = false;
    for (const p of ["```", "`", '"', "'", "<base64>", "data:"]) {
      if (t.startsWith(p)) { t = t.slice(p.length); changed = true; }
    }
    // A fence with a language tag ("```json..."): drop everything after the
    // fence up to (and including) the first non-tag character run / newline.
    if (t.startsWith("json") || t.startsWith("text") || t.startsWith("base64")) {
      const endTag = t.search(/[\s`]/);
      t = endTag === -1 ? "" : t.slice(endTag);
      changed = true;
    }
    for (const p of ["```", "`", '"', "'"]) {
      if (t.endsWith(p)) { t = t.slice(0, t.length - p.length); changed = true; }
    }
  }
  return t;
}

function cleanseMinimaxReply(text: string): string {
  const cleaned = text.replace(/[\u{3400}-\u{4dbf}\u{4e00}-\u{9fff}\u{f900}-\u{faff}\u{20000}-\u{2fa1f}\u{3000}\u{3001}\u{3002}\u{300c}\u{300d}\u{ff01}\u{ff0c}\u{ff1f}\u{2140}-\u{2aff}\u{a9}\u{26b3}]/gu, "");
  if (cleaned === text) return text;
  // Re-flow whitespace: strip leading/trailing spaces per line, collapse runs.
  return cleaned
    .split("\n")
    .map((ln) => ln.replace(/^ +| +$/g, "").replace(/ +/g, " "))
    .join("\n")
    .replace(/^\n+|\n+$/g, "")
    .trim();
}

/** Build a ChatModelAdapter that drives the given WS client. */
export function createForkyChatModelAdapter(client: ForkyWsClient): ChatModelAdapter {
  return {
    async *run({ messages, abortSignal }) {
      const content = lastUserText(messages as unknown as ChatModelRunOptionsMessages);
      let raw = "";
      setForkyVisualState("think");
      let started = false;
      const display = () => recoverEncodedReply(raw);
      for await (const event of client.runTurn(content, abortSignal)) {
        if (event.type === "status") {
          if (!started) {
            started = true;
            setForkyVisualState("think");
          }
          yield {
            content: raw ? [{ type: "text", text: display() }] : [],
            status: { type: "running" },
          } satisfies ChatModelRunResult;
        } else if (event.type === "delta") {
          raw += event.text;
          if (!started) {
            started = true;
            setForkyVisualState("talk");
          }
          yield {
            content: [{ type: "text", text: display() }],
            status: { type: "running" },
          } satisfies ChatModelRunResult;
        } else if (event.type === "done") {
          setForkyVisualState("happy");
          window.setTimeout(() => setForkyVisualState("idle"), 1200);
          yield {
            content: [{ type: "text", text: display() }],
            status: { type: "complete", reason: "stop" },
          } satisfies ChatModelRunResult;
          return;
        } else if (event.type === "error") {
          setForkyVisualState("idle");
          throw new Error(event.message || "Forky error");
        }
      }
      setForkyVisualState("idle");
    },
  };
}

/** Replace the empty thread with the seeded history (oldest-first). */
function seedHistory(runtime: AssistantRuntime, history: ForkyHistoryMessage[]): void {
  if (history.length === 0) return;
  const existing = runtime.thread.getState().messages;
  if (existing.length > 0) return;

  const messages: Array<{ message: ReturnType<typeof fromThreadMessageLike>; parentId: string | null }> = [];
  let parentId: string | null = null;
  for (const item of history) {
    // Old base64-wrapped replies persisted before the guard existed must render
    // as readable text when replayed from history.
    const content =
      item.role === "assistant" ? recoverEncodedReply(item.content) : item.content;
    const message = fromThreadMessageLike(
      { role: item.role, content },
      generateId(),
      { type: "complete", reason: "unknown" },
    );
    messages.push({ message, parentId });
    parentId = message.id;
  }
  runtime.thread.import({ headId: parentId, messages });
}

/**
 * Provider wrapping AssistantRuntimeProvider with a local runtime backed by the
 * Forky WS transport. Mount it around the chat chrome; on unmount the socket is
 * disposed. History is seeded from the hello frame once the socket connects.
 * 
 * NOTE: Uses useState to ensure a fresh client on each mount (StrictMode-safe).
 */
export function ForkyRuntimeProvider({ children }: { children: ReactNode }) {
  // useState ensures a new client is created on each mount (StrictMode remounts)
  const [client] = useState(() => new ForkyWsClient({ url: forkyWsURL() }));
  const adapter = useMemo(() => createForkyChatModelAdapter(client), [client]);
  const runtime = useLocalRuntime(adapter);

  useEffect(() => {
    client.setHistoryHandler((history) => seedHistory(runtime, history));
    client.ensureConnected().catch(() => {
      /* first user turn will retry */
    });
    return () => client.dispose();
  }, [client, runtime]);

  return createElement(AssistantRuntimeProvider, { runtime }, children);
}
