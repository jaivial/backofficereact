/**
 * Deterministic MiniMax SSE stub for the Forky e2e suite.
 * Speaks the Anthropic-compatible Messages API subset the backend uses
 * (POST {base}/v1/messages with stream:true) and emits a canned Spanish
 * reply that echoes the user's last message. Run standalone:
 *   bun e2e/forky-minimax-stub.ts   (port from FORKY_STUB_PORT, default 8099)
 */
import http from "node:http";

const PORT = Number(process.env.FORKY_STUB_PORT || 8099);

const server = http.createServer((req, res) => {
  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
    return;
  }
  if (req.method !== "POST" || !req.url?.endsWith("/v1/messages")) {
    res.writeHead(404);
    res.end();
    return;
  }

  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    let prompt = "";
    let wantStream = true;
    try {
      const j = JSON.parse(body);
      wantStream = j.stream !== false;
      const last = Array.isArray(j.messages) ? j.messages.at(-1) : undefined;
      const content = last?.content;
      if (Array.isArray(content) && typeof content[0]?.text === "string") {
        prompt = content[0].text;
      } else if (typeof content === "string") {
        prompt = content;
      }
    } catch {
      /* ignore malformed */
    }

    const reply = `¡Hola! Soy Forky, tu asistente de Villa Carmen. Has escrito: "${prompt.slice(0, 60)}"`;
    if (!wantStream) {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(
        JSON.stringify({
          id: "msg_stub_1",
          type: "message",
          role: "assistant",
          model: "MiniMax-M3",
          content: [{ type: "text", text: reply }],
          stop_reason: "end_turn",
          usage: { input_tokens: 10, output_tokens: 20 },
        })
      );
      return;
    }

    res.writeHead(200, {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      connection: "keep-alive",
    });
    res.write(
      `event: message_start\ndata: ${JSON.stringify({
        type: "message_start",
        message: { id: "msg_stub_1", content: [], model: "MiniMax-M3", role: "assistant" },
      })}\n\n`
    );
    const chunks = [reply.slice(0, 18), reply.slice(18, 42), reply.slice(42)];
    let i = 0;
    const tick = () => {
      if (i >= chunks.length) {
        res.write(
          `event: message_delta\ndata: ${JSON.stringify({
            type: "message_delta",
            delta: { stop_reason: "end_turn" },
            usage: { output_tokens: 20 },
          })}\n\n`
        );
        res.write(`event: message_stop\ndata: ${JSON.stringify({ type: "message_stop" })}\n\n`);
        res.end();
        return;
      }
      res.write(
        `event: content_block_delta\ndata: ${JSON.stringify({
          type: "content_block_delta",
          index: 0,
          delta: { type: "text_delta", text: chunks[i] },
        })}\n\n`
      );
      i += 1;
      setTimeout(tick, 100);
    };
    setTimeout(tick, 80);
  });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`forky-minimax-stub listening on 127.0.0.1:${PORT}`);
});
