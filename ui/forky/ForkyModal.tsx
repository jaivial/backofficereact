import { useEffect, useLayoutEffect, useRef, useCallback, useState } from "react";
import { gsap } from "gsap";
import {
  ActionBarPrimitive,
  ErrorPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
  useAui,
} from "@assistant-ui/react";
import { useAtom } from "jotai";

import { ForkyChart, stripForkyChartBlocks } from "./ForkyChart";
import {
  buildForkyAttachmentRefs,
  buildForkyMessageContent,
  extractForkyAttachmentText,
  FORKY_ATTACH_ACCEPT,
  isMediaAttachment,
  nextForkyAttachmentId,
  uploadForkyAttachment,
  validateForkyFiles,
  type ForkyAttachment,
} from "./forkyAttachments";
import {
  forkyVoiceExtension,
  forkyVoiceFileName,
  formatForkyVoiceClock,
  transcribeForkyAudio,
} from "./forkyVoice";
import { useForkyVoiceRecorder } from "./useForkyVoiceRecorder";
import { useForkyVoiceMessage, VoicePlayer } from "./VoicePlayer";
import { ForkyDoc, ForkyWidget, stripForkyRichBlocks } from "./ForkyRichBlocks";
import { repairGfmTables } from "./repairGfmTables";
import { MarkdownText } from "../assistant-ui/markdown-text";
import { ForkySquishMascot as HermesMascot } from "./ForkySquishMascot";
import {
  BuiIsland,
  LoadingState,
  MessageBubble,
  PromptBar,
  TaskRows,
} from "./bui";
import {
  CopyIcon,
  RefreshCwIcon,
  ArrowDownIcon,
  XIcon,
} from "lucide-react";

import { ChatBubbleMotionProvider } from "./chat-motion";

import { forkyOpenAtom } from "../../state/atoms";
import { ForkyRuntimeProvider, useForkyClient } from "./forkyRuntime";
import { useForkyTurnSteps } from "./forkyStatus";

// ---------------------------------------------------------------------------
// beautifului.dev design language (tokens in
// components/styles/features/forky/forky-bui.css, exposed as Tailwind
// utilities: bg-fui-surface, text-fui-ink, ...). The Hermes mascot is kept as
// the assistant identity across every state. The literal beautifului.dev
// components (ui/forky/bui/) always render inside <BuiIsland>, which scopes
// their own stylesheet (forky-bui-island.css) so neither side leaks.
// ---------------------------------------------------------------------------

const actionBtn =
  "flex size-6 items-center justify-center rounded-[6px] text-fui-ink-3 transition-colors duration-100 hover:bg-fui-hover-2 hover:text-fui-ink-2";

// ---------------------------------------------------------------------------
// Loading state while assistant is generating — the literal beautifului.dev
// LoadingState (pixel-grid loader + shimmer label + mono elapsed timer).
// ---------------------------------------------------------------------------
/** Human label of a tool step in the live trace (the model sees the raw name). */
function forkyToolLabel(tool: string): string {
  if (tool === "admin_catalog") return "Buscando la operación";
  if (tool === "admin_describe") return "Leyendo la operación";
  if (tool === "admin_call") return "Ejecutando en el backoffice";
  return tool.replace(/_/g, " ");
}

function AssistantLoading() {
  const steps = useForkyTurnSteps();
  return (
    <div
      data-testid="forky-assistant-loading"
      className="fui-anim w-full py-2"
      style={{ animation: "fui-fade-in 300ms ease-out both" }}
    >
      <BuiIsland>
        {/* Pending turn = the beautifului thinking trace of what the run observed so
            far, with the pixel-grid LoadingState as its fallback underneath. */}
        <div data-testid="forky-thinking-state">
          <TaskRows
            testIdPrefix="forky-taskrows"
            rows={[
              { primary: "Leyendo la pregunta", status: steps.length > 0 ? "completed" : "running" },
              // The tools the turn really called, as the WS reports them (status: tool):
              // every landed call is done, the latest one is still running.
              ...steps.map((tool, index) => ({
                primary: forkyToolLabel(tool),
                status: index === steps.length - 1 ? ("running" as const) : ("completed" as const),
              })),
              { primary: "Escribiendo la respuesta", status: "pending" },
            ]}
          />
        </div>
        <div data-testid="forky-loading-fallback" className="mt-1 w-fit">
          <LoadingState label="Pensando" variant="Drive" />
        </div>
      </BuiIsland>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Message components (beautifului "Chat" panel patterns)
// ---------------------------------------------------------------------------
// Strip ForkyChart JSON blocks (rendered separately) and repair the GFM table
// delimiter rows MiniMax intermittently mangles, so columnar data renders as a
// real table instead of literal pipes.
const forkyPreprocess = (text: string): string =>
  repairGfmTables(stripForkyRichBlocks(stripForkyChartBlocks(text)));

function AssistantMessage() {
  const [copied, setCopied] = useState(false);
  const [mounted, setMounted] = useState(false);
  const messageRef = useRef<HTMLDivElement>(null);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => () => {
    if (copyTimerRef.current !== null) clearTimeout(copyTimerRef.current);
  }, []);

  const handleCopy = useCallback(() => {
    const text = messageRef.current?.textContent;
    if (!text) return;
    void navigator.clipboard.writeText(text).catch(() => undefined);
    setCopied(true);
    if (copyTimerRef.current !== null) clearTimeout(copyTimerRef.current);
    copyTimerRef.current = setTimeout(() => setCopied(false), 2000);
  }, []);

  return (
    <MessagePrimitive.Root
      data-testid="forky-assistant-message"
      className="group/message w-full py-2.5"
      style={{ animation: "fui-fade-up 400ms cubic-bezier(0.23,1,0.32,1) both", transformOrigin: "top left" }}
    >
      {/* The turn in the shared chat-bubble layout: the Hermes mascot stays the avatar of the
          run, outside the bubble, and the reply rides in the vendored MessageBubble. */}
      <MessageBubble
        role="assistant"
        author="Forky"
        surface="forky-admin"
        bubbleTestId="forky-bubble-assistant"
        avatarTestId="forky-avatar-assistant"
        avatar={
          <span data-testid="forky-avatar-orb" className="flex items-center" style={{ height: 28 }}>
            <span className="shrink-0" style={{ transform: "scale(0.42)", transformOrigin: "left center", width: 27, height: 27 }}>
              {mounted && <HermesMascot state="solving" size={64} />}
            </span>
          </span>
        }
      >
      <div
        ref={messageRef}
        data-testid="forky-assistant-message-text"
        className="min-w-0 text-[13px] leading-relaxed text-fui-ink [&_p]:my-0"
      >
        <MessagePrimitive.Parts components={{ Text: ({ text }: { text: string }) => (
          <>
            <ForkyChart text={text} />
            <ForkyWidget text={text} />
            <ForkyDoc text={text} />
            <MarkdownText preprocess={forkyPreprocess} />
          </>
        ) }} />
        {/* A failed turn (WS/session/model error) must be visible: without
            this the message stays an empty bubble and the chat looks stuck. */}
        <MessagePrimitive.Error>
          <ErrorPrimitive.Root
            data-testid="forky-message-error"
            className="mt-1 flex items-center gap-2 rounded-[8px] bg-fui-red-tint px-3 py-2 text-[13px] text-fui-red"
          >
            <span data-slot="forkyModal-bg-fui-red" aria-hidden className="size-1.5 shrink-0 rounded-full bg-fui-red" />
            <ErrorPrimitive.Message className="block">
              No he podido responder. Revisa la conexión y vuelve a intentarlo.
            </ErrorPrimitive.Message>
          </ErrorPrimitive.Root>
        </MessagePrimitive.Error>
      </div>
      {/* Actions — appear on hover (beautifului streaming-text action row) */}
      <div data-slot="forkyModal-motion-reduce:transition-non" className="flex items-center gap-0.5 pl-0 opacity-0 transition-opacity duration-300 group-focus-within/message:opacity-100 group-hover/message:opacity-100 motion-reduce:transition-none">
        <button data-testid="button"
          type="button"
          aria-label={copied ? "Copiado" : "Copiar respuesta"}
          onClick={handleCopy}
          className={actionBtn}
          style={{ border: "none" }}
        >
          {copied ? (
            <span data-slot="forkyModal-text-fui-green" className="text-[11px] text-fui-green">✓</span>
          ) : (
            <CopyIcon className="size-3.5" />
          )}
        </button>
        {/* Reload regenerates the assistant message; ActionBarPrimitive
            disables itself while the thread is running or when reload is
            not available for this message. */}
        <ActionBarPrimitive.Reload
          className={actionBtn}
          style={{ border: "none" }}
          aria-label="Regenerar respuesta"
          data-testid="forky-regenerate-button"
        >
          <RefreshCwIcon className="size-3.5" />
        </ActionBarPrimitive.Reload>
      </div>
      </MessageBubble>
    </MessagePrimitive.Root>
  );
}

function UserMessage() {
  return (
    <MessagePrimitive.Root
      data-testid="forky-user-message"
      className="fui-anim w-full py-1"
      style={{ animation: "fui-fade-up 400ms cubic-bezier(0.23,1,0.32,1) both" }}
    >
      {/* My turn mirrors to the right in the shared layout, with no avatar. */}
      <MessageBubble
        role="user"
        author="Tú"
        surface="forky-admin"
        bubbleTestId="forky-bubble-user"
        avatarTestId="forky-avatar-user"
      >
        <UserMessageContent />
      </MessageBubble>
    </MessagePrimitive.Root>
  );
}

// Reads the message id from the provider, so it must render INSIDE
// MessagePrimitive.Root (the hook is what decides voice vs plain text turn).
function UserMessageContent() {
  // A voice turn renders as a note: the player first, then the whisper
  // transcript muted underneath — what Forky understood, readable without
  // looking like something the user typed. A reloaded row replays the exact
  // same shape (audio_url comes back on the message itself).
  const voice = useForkyVoiceMessage();
  if (voice) {
    return (
      <>
        <div data-testid="forky-voice-message" className="mb-1.5">
          <VoicePlayer url={voice.url} durationMs={voice.durationMs} />
        </div>
        <div
          data-testid="forky-user-message-text"
          className="whitespace-pre-wrap break-words text-[12px] leading-snug text-fui-ink-3"
        >
          <MessagePrimitive.Parts />
        </div>
      </>
    );
  }
  return (
    <div data-testid="forky-user-message-text" className="text-[13px] leading-[1.4]">
      <MessagePrimitive.Parts />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty state — breathing orb kept, greeting + suggestion chips in BUI style.
// ---------------------------------------------------------------------------
const SUGGESTIONS = [
  "¿Cuántas reservas hay hoy?",
  "Muestra el menú del día",
  "¿Qué horarios tenemos?",
];

function EmptyState() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  return (
    <div
      data-testid="forky-empty-state"
      className="flex h-full flex-col items-center justify-center gap-7 px-6 text-center"
    >
      {/* Large breathing orb */}
      {mounted && (
        <div data-slot="forkyModal-div" style={{ animation: "fui-fade-in 500ms ease-out both" }}>
          <HermesMascot state="breathing" size={112} />
        </div>
      )}

      {/* Greeting */}
      <h2
        data-testid="forky-empty-title"
        className="text-xl font-medium tracking-tight text-fui-ink"
        style={{ animation: "fui-fade-up 500ms cubic-bezier(0.23,1,0.32,1) 150ms both" }}
      >
        ¿En qué puedo ayudarte?
      </h2>

      {/* Suggestion chips (beautifului pill buttons) */}
      <div data-slot="forkyModal-gap-2" className="flex flex-wrap justify-center gap-2">
        {SUGGESTIONS.map((suggestion, i) => (
          <ThreadPrimitive.Suggestion
            key={suggestion}
            prompt={suggestion}
            send
            asChild
          >
            <div data-slot="forkyModal-hover:text-fui-ink"
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  (e.currentTarget as HTMLElement).click();
                }
              }}
              className="cursor-pointer rounded-[8px] bg-fui-surface px-3 py-1.5 text-[12.5px] font-medium text-fui-ink-2 transition-colors duration-200 hover:bg-fui-hover hover:text-fui-ink"
              style={{
                boxShadow: "var(--fui-shadow-btn)",
                animation: `fui-fade-up 400ms cubic-bezier(0.23,1,0.32,1) ${250 + i * 70}ms both`,
              }}
            >
              {suggestion}
            </div>
          </ThreadPrimitive.Suggestion>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Composer — the literal beautifului.dev PromptBar inside a BuiIsland. Sends
// through the assistant-ui composer runtime (setText + send), which queues
// the message when a run is already in flight.
//
// F2 attachments: the clip control (Control UI chat-composer-attachment chips
// above the input) picks files, forkyAttachments.ts validates the caps, and
// then the flow splits (coord forky_attachments_v1): textual files are read in
// place and ride INSIDE the message content (buildForkyMessageContent), while
// images and PDFs upload to Bunny via the existing media endpoint and travel
// as `attachments[]` refs in the WS frame — the server re-reads the bytes and
// hands the model real image/document blocks. The demo @ /sources menu is
// demo-only chrome; a real surface passes controls={false}, which also gives
// the clip its own column.
//
// F3 voice (coord forky_media_transcribe_v1): the mic records, then TWO calls
// run IN PARALLEL — POST media/upload to Bunny and POST transcribe to the
// backend, where the local whisper model transcribes while the upload is
// still in flight. The turn then leaves as ONE frame: content = transcript
// (the model's prompt, and the muted caption under the player) and
// `audio` = {url, duration_ms}, which the backend stores on the
// assistant_messages row so the note replays at its own timestamp after a
// reload. The transcript never travels through the visible input.
// ---------------------------------------------------------------------------
function ChatComposer() {
  const aui = useAui();
  const client = useForkyClient();
  const [attachments, setAttachments] = useState<ForkyAttachment[]>([]);
  // F3 voice: the mic records; "processing" = the parallel upload + transcription
  // and the send that follows them. voiceError is the honest failure state
  // (never a fake transcript).
  const [voicePhase, setVoicePhase] = useState<"idle" | "processing">("idle");
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const recorder = useForkyVoiceRecorder();

  const upsertAttachment = useCallback((next: ForkyAttachment) => {
    setAttachments((current) => current.map((a) => (a.id === next.id ? next : a)));
  }, []);

  const readAttachment = useCallback(
    (attachment: ForkyAttachment) => {
      extractForkyAttachmentText(attachment.file)
        .then((text) => {
          upsertAttachment({ ...attachment, status: "ready", text: text ?? undefined });
        })
        .catch((err: unknown) => {
          upsertAttachment({
            ...attachment,
            status: "error",
            error: err instanceof Error ? err.message : "fallo de lectura",
          });
        });
    },
    [upsertAttachment],
  );

  // Media (images/PDFs) uploads to Bunny so the model receives real content;
  // the chip shows the honest 0-100 from the XHR upload events.
  const uploadAttachment = useCallback(
    (attachment: ForkyAttachment) => {
      uploadForkyAttachment(attachment.file, (percent) => {
        upsertAttachment({ ...attachment, progress: percent });
      })
        .then(({ url, path }) => {
          upsertAttachment({ ...attachment, status: "ready", url, path, progress: 100 });
        })
        .catch((err: unknown) => {
          upsertAttachment({
            ...attachment,
            status: "error",
            error: err instanceof Error ? err.message : "fallo de subida",
          });
        });
    },
    [upsertAttachment],
  );

  const handleAttachFiles = useCallback(
    (files: File[]) => {
      setAttachments((current) => {
        const { accepted, rejected } = validateForkyFiles(files, current.length);
        const next: ForkyAttachment[] = [];
        // Refusals stay visible as error chips — an honest error, never silence.
        for (const { file, reason } of rejected) {
          next.push({
            id: nextForkyAttachmentId(),
            file,
            name: file.name,
            mime: file.type,
            size: file.size,
            status: "error",
            error: reason,
          });
        }
        for (const file of accepted) {
          const isMedia = isMediaAttachment(file);
          const attachment: ForkyAttachment = {
            id: nextForkyAttachmentId(),
            file,
            name: file.name,
            mime: file.type,
            size: file.size,
            status: isMedia ? "uploading" : "reading",
          };
          if (file.type.startsWith("image/")) {
            attachment.previewUrl = URL.createObjectURL(file);
          }
          next.push(attachment);
          // Both preparations are async; the chip shows the Control UI
          // upload/progress state until it lands (or fails).
          queueMicrotask(() => (isMedia ? uploadAttachment(attachment) : readAttachment(attachment)));
        }
        return [...current, ...next];
      });
    },
    [readAttachment, uploadAttachment],
  );

  const removeAttachment = useCallback((id: string) => {
    setAttachments((current) => {
      const target = current.find((a) => a.id === id);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return current.filter((a) => a.id !== id);
    });
  }, []);

  const readingCount = attachments.filter((a) => a.status === "reading").length;
  const uploadingCount = attachments.filter((a) => a.status === "uploading").length;
  const preparingCount = readingCount + uploadingCount;
  const readyAttachments = attachments.filter((a) => a.status === "ready");
  const errorAttachments = attachments.filter((a) => a.status === "error");

  const handleSend = useCallback(
    (text: string) => {
      // Send gates on the preparation: a half-read file would ride without its
      // content and a half-uploaded one without its ref. Error chips never
      // block — they are just honest metadata.
      if (preparingCount > 0) return;
      const content = buildForkyMessageContent(text, [...readyAttachments, ...errorAttachments]);
      // Media refs ride the frame next to the content (forky_attachments_v1):
      // one send = one FIFO batch, consumed by the model adapter.
      client.pushPendingAttachments(buildForkyAttachmentRefs(attachments));
      aui.composer.setText(content);
      aui.composer.send();
      for (const a of attachments) {
        if (a.previewUrl) URL.revokeObjectURL(a.previewUrl);
      }
      setAttachments([]);
    },
    [aui, attachments, client, errorAttachments, preparingCount, readyAttachments],
  );

  // F3 voice send. Two things run IN PARALLEL the moment recording stops:
  // the clip uploads to Bunny (the player's URL) and the SAME bytes go to the
  // backend's STT endpoint, where the local whisper model transcribes while
  // that upload is still in flight. Only when both land does the turn go out:
  // ONE frame carrying the transcript (what the model reads as the prompt) and
  // the clip's URL (what the row stores, so a reload replays the note).
  // The visible PromptBar keeps its own draft: aui.composer is the adapter
  // bridge only, so the transcript never appears in the input box. A failure in
  // either leg shows the honest error and NOTHING is sent — no half a note.
  const sendVoiceClip = useCallback(
    async (clip: { blob: Blob; durationMs: number }) => {
      setVoiceError(null);
      setVoicePhase("processing");
      try {
        const recordedAt = Date.now();
        const name = forkyVoiceFileName(recordedAt, forkyVoiceExtension(clip.blob.type));
        const file = new File([clip.blob], name, { type: clip.blob.type });
        const [{ url }, transcript] = await Promise.all([
          uploadForkyAttachment(file),
          transcribeForkyAudio(clip.blob),
        ]);
        // Queue BEFORE the send so the adapter run consumes this turn's meta:
        // an empty attachment batch keeps the FIFO alignment with the refs. The
        // meta becomes the frame's `audio` field AND the player under the bubble.
        client.pushPendingVoice({ url, durationMs: clip.durationMs });
        client.pushPendingAttachments([]);
        // Bridge straight to the adapter: the transcript is the model's prompt,
        // and it is what the bubble shows muted under the player (the visible
        // PromptBar owns a different draft, so its input stays untouched).
        aui.composer.setText(transcript.text);
        aui.composer.send();
      } catch (err) {
        setVoiceError(err instanceof Error ? err.message : "No se pudo enviar la nota de voz");
      } finally {
        setVoicePhase("idle");
      }
    },
    [aui, client],
  );

  const handleToggleDictation = useCallback(() => {
    if (voicePhase === "processing") return;
    setVoiceError(null);
    if (recorder.phase === "recording") {
      void recorder.stop().then((clip) => {
        if (clip) void sendVoiceClip(clip);
      });
      return;
    }
    recorder.start().catch((err: Error) => {
      setVoiceError(err.message || "No se pudo iniciar la grabación");
    });
  }, [recorder, sendVoiceClip, voicePhase]);

  const handleCancelDictation = useCallback(() => {
    recorder.cancel();
    setVoiceError(null);
  }, [recorder]);

  const recording = recorder.phase === "recording";
  const dictating = recording || voicePhase === "processing";

  return (
    <div data-testid="forky-composer-root" className="shrink-0 p-1.5">
      <BuiIsland>
        <PromptBar
          demo={false}
          placeholder="Pregunta lo que quieras"
          inputAriaLabel="Prompt"
          sendLabel="Send"
          controls={false}
          sendBlocked={readingCount > 0 || dictating}
          attachAccept={FORKY_ATTACH_ACCEPT}
          onAttachFiles={handleAttachFiles}
          onRemoveAttachment={removeAttachment}
          attachments={attachments.map((a) => ({
            id: a.id,
            name: a.name,
            mime: a.mime,
            status: a.status === "reading" ? "uploading" : a.status,
            error: a.error,
            previewUrl: a.previewUrl,
          }))}
          onSend={handleSend}
          dictating={dictating}
          voiceBusy={voicePhase === "processing"}
          onToggleDictation={handleToggleDictation}
        >
          {dictating && (
            <div
              data-testid="forky-voice-recording-chip"
              className="flex items-center gap-2 px-1 pb-1.5 text-[11.5px] text-fui-ink-2"
            >
              {recording ? (
                <>
                  <span className="size-1.5 shrink-0 rounded-full bg-fui-red" style={{ animation: "eq-bounce 900ms ease-in-out infinite" }} />
                  <span data-testid="forky-voice-timer" className="tabular-nums">{formatForkyVoiceClock(recorder.elapsedMs)}</span>
                  <button
                    type="button"
                    data-testid="forky-voice-cancel"
                    onClick={handleCancelDictation}
                    className="rounded-[6px] px-1.5 py-0.5 text-[11px] text-fui-ink-3 transition-colors duration-100 hover:bg-fui-hover hover:text-fui-ink-2"
                  >
                    Cancelar
                  </button>
                </>
              ) : (
                <span data-testid="forky-voice-processing">Enviando la nota de voz…</span>
              )}
            </div>
          )}
        </PromptBar>
      </BuiIsland>
      {voiceError && (
        <p
          data-testid="forky-voice-error"
          role="alert"
          className="mt-1 px-2 text-center text-[11.5px] text-fui-red"
        >
          {voiceError}
        </p>
      )}
      <p
        data-testid="forky-composer-disclaimer"
        className="mt-2 text-center text-[11px] text-fui-ink-3"
      >
        Forky puede cometer errores. Verifica información importante.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Scroll anchor (beautifului pill with card shadow)
// ---------------------------------------------------------------------------
function ScrollToBottomButton({
  onClick,
  newCount
}: {
  onClick: () => void;
  newCount: number;
}) {
  if (newCount === 0) return null;

  return (
    <button data-testid="hover-translate-y-px"
      type="button"
      onClick={onClick}
      className="absolute inset-x-0 bottom-24 z-20 mx-auto flex w-fit items-center gap-1.5 rounded-full bg-fui-surface px-3.5 py-1.5 text-xs text-fui-ink-2 transition-transform duration-200 hover:-translate-y-px"
      style={{ boxShadow: "var(--fui-shadow-card)", animation: "fui-fade-up 300ms cubic-bezier(0.23,1,0.32,1) both" }}
    >
      <ArrowDownIcon className="size-3 opacity-60" />
      {newCount} {newCount === 1 ? "mensaje nuevo" : "mensajes nuevos"}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Chat pane — beautifului chat panel: rounded-[14px] surface card with a
// hairline header (title + close), scrolling body and the prompt bar below.
// ---------------------------------------------------------------------------
function ChatPane({ onClose }: { onClose: () => void }) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [newMessages, setNewMessages] = useState(0);

  // Track scroll position
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = viewport;
      const atBottom = scrollHeight - scrollTop - clientHeight < 50;
      setIsAtBottom(atBottom);
      if (atBottom) setNewMessages(0);
    };

    viewport.addEventListener("scroll", handleScroll);
    return () => viewport.removeEventListener("scroll", handleScroll);
  }, []);

  // Auto-scroll on new messages if at bottom
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const observer = new MutationObserver(() => {
      if (isAtBottom) {
        viewport.scrollTo({
          top: viewport.scrollHeight,
          behavior: "smooth",
        });
      } else {
        setNewMessages((n) => n + 1);
      }
    });

    observer.observe(viewport, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [isAtBottom]);

  const scrollToBottom = useCallback(() => {
    const viewport = viewportRef.current;
    if (viewport) {
      viewport.scrollTo({ top: viewport.scrollHeight, behavior: "smooth" });
    }
    setIsAtBottom(true);
    setNewMessages(0);
  }, []);

  return (
    <div
      data-testid="forky-chat-surface"
      className="relative h-full min-h-0 w-full overflow-hidden p-0 md:p-5"
    >
      <div data-testid="forky-chat-layout" className="relative z-10 flex h-full min-h-0 w-full items-stretch justify-center">
        {/* Chat panel (beautifului surface card) */}
        <div
          data-testid="forky-chat-panel"
          className="relative flex min-h-0 w-full flex-col overflow-hidden bg-fui-surface md:w-auto md:min-w-[720px] md:max-w-4xl md:rounded-[14px]"
          style={{ boxShadow: "var(--fui-shadow-card)" }}
        >
          {/* Header — hairline bar with title and close action */}
          <div data-slot="forkyModal-p-1.5" className="flex shrink-0 items-center justify-between border-b border-fui-line p-1.5">
            <div data-slot="forkyModal-pl-1" className="flex items-center gap-2 pl-1">
              <span data-slot="forkyModal-text-fui-ink" className="text-[13px] font-semibold text-fui-ink">Forky</span>
              <span data-slot="forkyModal-text-fui-ink" className="text-[12px] text-fui-ink-3">Asistente del restaurante</span>
            </div>
            <div data-slot="forkyModal-gap-1" className="flex items-center gap-1">
              <div
                role="button"
                tabIndex={0}
                onClick={onClose}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onClose(); }}
                data-testid="forky-close-button"
                className="flex size-6 cursor-pointer items-center justify-center rounded-[6px] text-fui-ink-3 transition-colors duration-100 hover:bg-fui-hover hover:text-fui-ink-2"
                aria-label="Cerrar asistente"
              >
                <XIcon className="size-4" />
              </div>
            </div>
          </div>

          <div
            data-testid="forky-chat-body"
            className="relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden"
          >
            <ThreadPrimitive.Root data-testid="forky-thread-root" className="flex h-full min-h-0 flex-col">
              <ThreadPrimitive.Viewport
                ref={viewportRef}
                data-testid="forky-thread-viewport"
                className="min-h-0 flex-1 overflow-y-auto px-3 pt-2.5 pb-1"
              >
                <ThreadPrimitive.Empty>
                  <EmptyState />
                </ThreadPrimitive.Empty>
                {/* One island (and one motion scope) for the whole thread: the turns
                    render with the vendored bubble utilities and the shared
                    chat-bubble entrance. Coordination id: FORKY-ADMIN-TOOLS-S01. */}
                <div data-testid="forky-messages-container" className="flex flex-col gap-2.5">
                  <BuiIsland className="min-w-0 flex-1" data-obs="forky.admin.thread" data-coord="FORKY-ADMIN-TOOLS-S01">
                    <ChatBubbleMotionProvider testId="forky-chat-bubble-motion">
                      <ThreadPrimitive.Messages
                        components={{ AssistantMessage, UserMessage }}
                      />
                    </ChatBubbleMotionProvider>
                  </BuiIsland>
                </div>
                <ThreadPrimitive.If running>
                  <AssistantLoading />
                </ThreadPrimitive.If>
              </ThreadPrimitive.Viewport>

              {/* Scroll to bottom indicator */}
              {!isAtBottom && newMessages > 0 && (
                <ScrollToBottomButton onClick={scrollToBottom} newCount={newMessages} />
              )}

              <ChatComposer />
            </ThreadPrimitive.Root>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Modal
// ---------------------------------------------------------------------------
export function ForkyModal() {
  const [open, setOpen] = useAtom(forkyOpenAtom);
  const overlayRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!open || !overlayRef.current) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        overlayRef.current,
        { opacity: 0 },
        { opacity: 1, duration: 0.3, ease: "power2.out" }
      );
      gsap.fromTo(
        "[data-testid='forky-chat-surface']",
        { opacity: 0, y: 24, scale: 0.96 },
        { opacity: 1, y: 0, scale: 1, duration: 0.4, ease: "power3.out", delay: 0.05 }
      );
    }, overlayRef);
    return () => ctx.revert();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const overlay = overlayRef.current;
    // Focus the composer on open so the user can start typing immediately.
    if (overlay) {
      const composer = overlay.querySelector<HTMLElement>("textarea");
      (composer ?? overlay.querySelector<HTMLElement>("button"))?.focus();
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        // The first Escape only closes an open @ // or model menu inside the
        // PromptBar (its menus render with shadow-raised); the modal closes on
        // the next one.
        if (overlayRef.current?.querySelector(".bui-scope .shadow-raised")) return;
        event.stopPropagation();
        setOpen(false);
        return;
      }
      if (event.key !== "Tab") return;
      const overlay = overlayRef.current;
      if (!overlay) return;
      const focusables = () =>
        Array.from(
          overlay.querySelectorAll<HTMLElement>(
            'button, textarea, input, select, a[href], [tabindex]:not([tabindex="-1"])'
          )
        ).filter((el) => !el.hasAttribute("disabled"));
      const items = focusables();
      if (items.length === 0) return;
      const firstEl = items[0];
      const lastEl = items[items.length - 1];
      if (event.shiftKey && document.activeElement === firstEl) {
        event.preventDefault();
        lastEl.focus();
      } else if (!event.shiftKey && document.activeElement === lastEl) {
        event.preventDefault();
        firstEl.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown, true);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.body.style.overflow = "";
    };
  }, [open, setOpen]);

  if (!open) return null;

  const handleBackgroundClick = (e: React.MouseEvent) => {
    // Only close if clicking directly on the background, not on children
    if (e.target === e.currentTarget) {
      setOpen(false);
    }
  };

  return (
    <div
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-label="Asistente Forky"
      data-testid="forky-modal"
      className="fixed inset-0 z-[200] h-[100dvh] w-screen bg-slate-900/60 backdrop-blur-md dark:bg-slate-950/95"
      onClick={handleBackgroundClick}
    >
      <ForkyRuntimeProvider>
        <ChatPane onClose={() => setOpen(false)} />
      </ForkyRuntimeProvider>
    </div>
  );
}
