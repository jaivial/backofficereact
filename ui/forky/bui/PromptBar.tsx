"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createShader, playSweep, accentChain, ACCENTS } from "glimm";
import TextareaAutosize from "react-textarea-autosize";

/* The built-in "prism" palette is only cyan→indigo→magenta, so a sweep
 * reads as blue/purple. Build a true full-spectrum rainbow instead. */
const RAINBOW = accentChain([
  ACCENTS.red,
  ACCENTS.orange,
  ACCENTS.yellow,
  ACCENTS.green,
  ACCENTS.cyan,
  ACCENTS.blue,
  ACCENTS.purple,
]);

/* ─────────────────────────────────────────────────────────
 * PROMPT BAR
 * A composer with real controls: attach, @ data sources,
 * / commands, a model picker, dictation, and send.
 * Type @ or / to open the menus; ↑↓ + Enter to pick.
 * Variants: Rounded (card radius) · Pill (full radius).
 * ───────────────────────────────────────────────────────── */

function Icon({ children, size = 15, strokeWidth = 1.8 }: { children: React.ReactNode; size?: number; strokeWidth?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

const GLYPHS: Record<string, React.ReactNode> = {
  clip: <path d="m21.4 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />,
  chart: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
  layers: <g><path d="M12 2 2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5M2 12l10 5 10-5" /></g>,
  globe: <g><circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></g>,
};

/* real product marks, inline so the file stays self-contained */
const BRANDS: Record<string, React.ReactNode> = {
  figma: (
    <svg width="11" height="16" viewBox="0 0 38 57" aria-hidden="true">
      <path d="M9.5 57A9.5 9.5 0 0 0 19 47.5V38H9.5a9.5 9.5 0 0 0 0 19z" fill="#0ACF83" />
      <path d="M0 28.5A9.5 9.5 0 0 1 9.5 19H19v19H9.5A9.5 9.5 0 0 1 0 28.5z" fill="#A259FF" />
      <path d="M0 9.5A9.5 9.5 0 0 1 9.5 0H19v19H9.5A9.5 9.5 0 0 1 0 9.5z" fill="#F24E1E" />
      <path d="M19 0h9.5a9.5 9.5 0 1 1 0 19H19V0z" fill="#FF7262" />
      <path d="M38 28.5a9.5 9.5 0 1 1-19 0 9.5 9.5 0 0 1 19 0z" fill="#1ABCFE" />
    </svg>
  ),
  slack: (
    <svg width="15" height="15" viewBox="0 0 127 127" aria-hidden="true">
      <path d="M27.2 80c0 7.3-5.9 13.2-13.2 13.2C6.7 93.2.8 87.3.8 80c0-7.3 5.9-13.2 13.2-13.2h13.2V80zm6.6 0c0-7.3 5.9-13.2 13.2-13.2 7.3 0 13.2 5.9 13.2 13.2v33c0 7.3-5.9 13.2-13.2 13.2-7.3 0-13.2-5.9-13.2-13.2V80z" fill="#E01E5A" />
      <path d="M47 27.2c-7.3 0-13.2-5.9-13.2-13.2C33.8 6.7 39.7.8 47 .8c7.3 0 13.2 5.9 13.2 13.2v13.2H47zm0 6.7c7.3 0 13.2 5.9 13.2 13.2 0 7.3-5.9 13.2-13.2 13.2H13.9C6.6 60.3.7 54.4.7 47.1c0-7.3 5.9-13.2 13.2-13.2H47z" fill="#36C5F0" />
      <path d="M99.9 47.1c0-7.3 5.9-13.2 13.2-13.2 7.3 0 13.2 5.9 13.2 13.2 0 7.3-5.9 13.2-13.2 13.2H99.9V47.1zm-6.6 0c0 7.3-5.9 13.2-13.2 13.2-7.3 0-13.2-5.9-13.2-13.2V13.9C66.9 6.6 72.8.7 80.1.7c7.3 0 13.2 5.9 13.2 13.2v33.2z" fill="#2EB67D" />
      <path d="M80.1 99.8c7.3 0 13.2 5.9 13.2 13.2 0 7.3-5.9 13.2-13.2 13.2-7.3 0-13.2-5.9-13.2-13.2V99.8h13.2zm0-6.6c-7.3 0-13.2-5.9-13.2-13.2 0-7.3 5.9-13.2 13.2-13.2h33.1c7.3 0 13.2 5.9 13.2 13.2 0 7.3-5.9 13.2-13.2 13.2H80.1z" fill="#ECB22E" />
    </svg>
  ),
  gmail: (
    <svg width="15" height="12" viewBox="0 0 256 193" aria-hidden="true">
      <path d="M58.182 192.05V93.14L27.507 65.077 0 49.504v125.091c0 9.658 7.825 17.455 17.455 17.455h40.727Z" fill="#4285F4" />
      <path d="M197.818 192.05h40.727c9.659 0 17.455-7.826 17.455-17.455V49.505l-31.156 17.837-27.026 25.798v98.91Z" fill="#34A853" />
      <path d="m58.182 93.14-4.174-38.647 4.174-36.989L128 69.868l69.818-52.364 4.669 34.992-4.669 40.644L128 145.504 58.182 93.14Z" fill="#EA4335" />
      <path d="M197.818 17.504V93.14L256 49.504V26.231c0-21.585-24.64-33.89-41.89-20.945l-16.292 12.218Z" fill="#FBBC04" />
      <path d="m0 49.504 26.759 20.07L58.182 93.14V17.504L41.89 5.286C24.61-7.66 0 4.646 0 26.23v23.273Z" fill="#C5221F" />
    </svg>
  ),
};

// HOST-EDIT: the registry imports the host's attachment chip. Forky vendors a
// minimal stand-in so the composer needs no host module: same 1:1 square chip,
// upload state and remove button, backoffice-scoped test ids.
import { ComposerAttachmentChip } from "./ComposerAttachmentChip";

type Source = {
  key: string;
  name: string;
  desc: string;
  glyph?: string;
  brand?: string;
  attach?: boolean;
  connect?: boolean;
};

const SOURCES: Source[] = [
  { key: "attach", name: "Add photos & files", desc: "Upload from your computer", glyph: "clip", attach: true },
  { key: "scoop", name: "Scoop Data", desc: "Sales & churn metrics", glyph: "chart" },
  { key: "flavors", name: "Flavor records", desc: "26 makers, tags, links", glyph: "layers" },
  { key: "web", name: "Web search", desc: "Real-time news and info", glyph: "globe" },
  { key: "figma", name: "Figma", desc: "Design-to-code workflows", brand: "figma" },
  { key: "slack", name: "Slack", desc: "Read and manage Slack", brand: "slack" },
  { key: "gmail", name: "Gmail", desc: "Read and manage Gmail", brand: "gmail", connect: true },
];

const COMMANDS = [
  { key: "compare", name: "/compare", desc: "Flavor vs. last summer" },
  { key: "churn-plan", name: "/churn-plan", desc: "Draft a churn schedule" },
  { key: "restock", name: "/restock", desc: "Build a reorder list" },
  { key: "draft-email", name: "/draft-email", desc: "Write a supplier email" },
  { key: "summarize", name: "/summarize", desc: "Digest the thread so far" },
];

const MODELS = [
  { key: "sprinkles-5", name: "Sprinkles 5", tag: "Flagship" },
  { key: "vanilla-1", name: "Vanilla 1", tag: "Basic" },
  { key: "freezer-burn", name: "Freezer Burn 0.4", tag: "Stale" },
];

const FILES = ["flavor-chart.png", "summer-menu.pdf", "pos-export.csv"];

/* self-running demo: walk the @ menu, then the / menu, and repeat.
 * Any pointer or key interaction hands control to the user. */
const AUTO_STEPS: {
  draft: string;
  active?: number;
  connect?: boolean;
  modelOpen?: boolean;
  model?: string;
  hold: number;
}[] = [
  { draft: "", connect: false, model: "vanilla-1", hold: 1100 },
  { draft: "@", active: 0, hold: 900 },
  { draft: "@", active: 1, hold: 620 },
  { draft: "@", active: 4, hold: 620 },
  { draft: "@", active: 6, hold: 700 },
  { draft: "@", active: 6, connect: true, hold: 1000 },
  { draft: "", hold: 700 },
  { draft: "/", active: 0, hold: 900 },
  { draft: "/", active: 1, hold: 620 },
  { draft: "/", active: 3, hold: 1000 },
  { draft: "", hold: 800 },
  // open the model picker and upgrade to the flagship → rainbow sweep
  { draft: "", modelOpen: true, hold: 1200 },
  { draft: "", model: "sprinkles-5", hold: 2400 },
  { draft: "", hold: 900 },
];

/* the last @word or /word being typed, if any */
function parseToken(draft: string): { kind: "at" | "slash"; query: string; start: number } | null {
  const match = /(^|\s)([@/])([\w-]*)$/.exec(draft);
  if (!match) return null;
  return {
    kind: match[2] === "@" ? "at" : "slash",
    query: match[3].toLowerCase(),
    start: match.index + match[1].length,
  };
}

export default function PromptBar({
  variant = "Rounded",
  demo = true,
  tall = false,
  placeholder,
  onSend,
  /* ── embedding surface ────────────────────────────────
   * The gallery walkthrough owns its draft; a real surface does not. These props let a
   * host keep the draft (a mention picker needs the caret), cap it (API contract limit),
   * keep the built-in @ / slash menus out of the way of its own picker, drop the
   * demo-only controls, and float its own popover off the composer anchor. */
  value,
  onValueChange,
  maxLength,
  menus = true,
  controls = true,
  disabled = false,
  busy = false,
  sendBlocked = false,
  dictating = false,
  voiceBusy = false,
  onToggleDictation,
  textareaRef,
  onInputKeyDown,
  inputTestId,
  inputAriaLabel,
  sendTestId,
  sendLabel,
  children,
  onAttachFiles,
  attachments: attachmentChips,
  onRemoveAttachment,
  attachBlocked = false,
  attachBlockedReason,
  attachAccept,
}: {
  variant?: string;
  /** the self-running walkthrough; turn off when embedding in a real surface */
  demo?: boolean;
  /** hero sizing: a multi-line input with controls on their own row */
  tall?: boolean;
  placeholder?: string;
  onSend?: (text: string) => void;
  /** controlled draft — pass it to own the text, `onValueChange` to receive edits */
  value?: string;
  onValueChange?: (next: string) => void;
  /** hard cap on the draft, forwarded to the textarea */
  maxLength?: number;
  /** built-in @ / slash menus; off when the host runs its own picker on the same sigils */
  menus?: boolean;
  /** attach / model / dictation controls; off for a narrow, single-row composer */
  controls?: boolean;
  /** locks the whole composer (read-only draft) */
  disabled?: boolean;
  /** the host is submitting: the send control waits, the draft stays editable */
  busy?: boolean;
  /** the host refuses to send this draft (a gate): the draft stays editable, send stays off */
  sendBlocked?: boolean;
  /** the mic is open in the host: real capture, owned by `useVoiceTranscription` */
  dictating?: boolean;
  /** the host is uploading the clip and waiting for the transcript: the mic waits too */
  voiceBusy?: boolean;
  /** real dictation toggle. Passing it renders the mic even when `controls` is off (a host
   *  that runs its own attach/model chrome still dictates). */
  onToggleDictation?: () => void;
  /** exposes the textarea so the host can read the caret and re-focus after a pick */
  textareaRef?: React.Ref<HTMLTextAreaElement>;
  /** runs before the composer handles the key; a prevented event stops here */
  onInputKeyDown?: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  /** stable hooks for the host's test ids */
  inputTestId?: string;
  // HOST-EDIT: accessible name of the input, decoupled from the visible
  // placeholder (hosts that localize the placeholder keep the stable label the
  // e2e suite addresses). Keep on re-pull.
  inputAriaLabel?: string;
  sendTestId?: string;
  /** accessible name of the send control, in the host's language */
  sendLabel?: string;
  /** rendered inside the composer anchor, above the input (popovers, hints) */
  children?: React.ReactNode;
  /** REAL attachments ([SAGE-MEDIA-C01:upload]): passing it enables the picker — the host
   *  uploads the files and owns the chips. Absent → demo chips only (gallery unchanged). */
  onAttachFiles?: (files: File[]) => void;
  /** host-owned chips; upload state lives with the host ([SAGE-MEDIA-C02:media-ready]) */
  attachments?: { id: string; name: string; status?: "uploading" | "ready" | "error"; error?: string; previewUrl?: string; kind?: "image" | "document" }[];
  onRemoveAttachment?: (id: string) => void;
  /** [SAGE-MEDIA-C04:model-capability] the selected model has no vision: attach renders
   *  blocked and a popover tells the user why. */
  attachBlocked?: boolean;
  attachBlockedReason?: string;
  /** picker accept list (see `CHAT_MEDIA_ACCEPT`) */
  attachAccept?: string;
}) {
  const pill = variant === "Pill";
  const [internalDraft, setInternalDraft] = useState("");
  const draft = value ?? internalDraft;
  const setDraft = (next: string | ((current: string) => string)) => {
    const resolved = typeof next === "function" ? next(draft) : next;
    if (value === undefined) setInternalDraft(resolved);
    onValueChange?.(resolved);
  };
  const [dismissed, setDismissed] = useState(false);
  const [plusOpen, setPlusOpen] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);
  const [model, setModel] = useState(MODELS[1]);
  const [attachments, setAttachments] = useState<string[]>([]);
  const [attachBlockedOpen, setAttachBlockedOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  /** the host hides the demo controls AND handles uploads: one attach column joins the row */
  const attachColumn = !controls && !!onAttachFiles;
  const openAttachPicker = () => {
    if (attachBlocked) {
      setAttachBlockedOpen((current) => !current);
      return;
    }
    if (onAttachFiles) fileRef.current?.click();
  };
  const [connected, setConnected] = useState(false);
  const [active, setActive] = useState(0);
  const [auto, setAuto] = useState(demo);
  const [autoStep, setAutoStep] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const wide = expanded || tall;
  /* A host that hides the demo controls can still dictate: the mic then takes a column of its
   * own, right before send. */
  const mic = controls || !!onToggleDictation;
  const [rowBox, setRowBox] = useState<{ top: number; height: number } | null>(null);
  const [engaged, setEngaged] = useState(false);
  const [modelBox, setModelBox] = useState<{ top: number; height: number } | null>(null);
  const [modelHovered, setModelHovered] = useState<number | null>(null);
  const [modelMenuLeft, setModelMenuLeft] = useState(0);
  const [modelMenuBottom, setModelMenuBottom] = useState(0);
  const composerAnchorRef = useRef<HTMLDivElement>(null);
  const controlsRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const measureRef = useRef<HTMLSpanElement>(null);
  const modelRef = useRef<HTMLButtonElement>(null);
  const rowRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const modelRowRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const holdInputElement = (element: HTMLTextAreaElement | null) => {
    inputRef.current = element;
    if (typeof textareaRef === "function") textareaRef(element);
    else if (textareaRef) (textareaRef as { current: HTMLTextAreaElement | null }).current = element;
  };
  const glimmRef = useRef<HTMLCanvasElement>(null);
  const shaderRef = useRef<ReturnType<typeof createShader> | null>(null);
  const sweepingRef = useRef(false);

  /* hand control to the user: stop the demo loop, and when they aim at
   * the input itself, clear the demo's leftover draft for a clean start */
  const takeOver = (event: { target: EventTarget | null }) => {
    setAuto(false);
    if (auto && event.target === inputRef.current) setDraft("");
  };

  const token = dismissed || !menus ? null : parseToken(draft);
  const menu: "at" | "slash" | null = plusOpen ? "at" : token?.kind ?? null;
  const query = plusOpen ? "" : token?.query ?? "";

  const rows: { key: string; name: string; desc: string }[] =
    menu === "at"
      ? SOURCES.filter((s) => s.name.toLowerCase().includes(query))
      : menu === "slash"
        ? COMMANDS.filter((c) => c.name.slice(1).startsWith(query))
        : [];

  useEffect(() => {
    setActive(0);
    setEngaged(false);
  }, [menu, query]);

  /* a single highlight glides to the active row instead of each row
   * toggling its own background — matches the gliding pill in the nav */
  useLayoutEffect(() => {
    const target = rowRefs.current[active];
    if (target) setRowBox({ top: target.offsetTop, height: target.offsetHeight });
  }, [menu, query, active, connected, rows.length]);

  /* same gliding highlight in the model menu — floats to the hovered
   * row, falling back to the currently-selected model */
  const modelIndex = MODELS.findIndex((m) => m.key === model.key);
  useLayoutEffect(() => {
    if (!modelOpen) return;
    const target = modelRowRefs.current[modelHovered ?? modelIndex];
    if (target) setModelBox({ top: target.offsetTop, height: target.offsetHeight });
  }, [modelOpen, modelHovered, modelIndex]);

  /* The menu is outside the clipped composer, so align it to the model
   * trigger by measurement instead of pinning it to the far-right edge. */
  useLayoutEffect(() => {
    if (!modelOpen || !composerAnchorRef.current || !modelRef.current) return;
    const anchorRect = composerAnchorRef.current.getBoundingClientRect();
    const triggerRect = modelRef.current.getBoundingClientRect();
    setModelMenuLeft(Math.max(0, Math.min(triggerRect.left - anchorRect.left, anchorRect.width - 176)));
    setModelMenuBottom(anchorRect.bottom - triggerRect.top + 8);
  }, [modelOpen, wide, model.name]);

  useEffect(() => {
    if (!modelOpen) setModelHovered(null);
  }, [modelOpen]);

  /* Build the shader with a pinned hue phase. createShader seeds its
   * internal hueShift from Math.random(), which made the sweep a different
   * colour on every reload — pin it so the rainbow is identical each time. */
  const makeShader = () => {
    const canvas = glimmRef.current;
    if (!canvas) return null;
    const random = Math.random;
    Math.random = () => 0;
    try {
      return createShader({
        canvas,
        palette: RAINBOW,
        direction: "ltr",
        bandTight: 10,
        swellAmount: 0.85,
      });
    } finally {
      Math.random = random;
    }
  };

  /* Glimm shader lives inside the composer, invisible at rest. Selecting
   * the flagship model fires a one-shot rainbow sweep across the interior. */
  useEffect(() => {
    /* Only the demo's model picker can trigger a sweep, so a host that hides the
     * controls never celebrates - and never needs the WebGL context either. */
    if (!controls) return;
    shaderRef.current = makeShader();
    return () => {
      shaderRef.current?.destroy();
      shaderRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controls]);

  const celebrate = () => {
    if (sweepingRef.current) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // Recreate the shader per sweep so uTime restarts at 0 — the hue phase
    // (which drifts with time) is then identical on every trigger.
    shaderRef.current?.destroy();
    const shader = makeShader();
    shaderRef.current = shader;
    if (!shader) return;
    sweepingRef.current = true;
    const sweep = playSweep(shader, {
      palette: RAINBOW,
      direction: "ltr",
      sweepMs: 570,
      outroMs: 80,
      peakAlpha: 1.3,
      bandTight: 10,
      brightness: 1.4,
      swellAmount: 1,
      waveSpeed: 1.8,
      easing: "easeOutExpo",
    });
    sweep.done.finally(() => {
      sweepingRef.current = false;
    });
  };

  const selectModel = (next: (typeof MODELS)[number]) => {
    setModel(next);
    setModelOpen(false);
    if (next.key === "sprinkles-5") celebrate();
  };

  /* autoplay: apply the current step, then advance after its hold */
  useEffect(() => {
    if (!auto) return;
    const step = AUTO_STEPS[autoStep % AUTO_STEPS.length];
    setDraft(step.draft);
    if (step.active !== undefined) setActive(step.active);
    if (step.connect !== undefined) setConnected(step.connect);
    if (step.modelOpen !== undefined) setModelOpen(step.modelOpen);
    if (step.model) {
      const next = MODELS.find((m) => m.key === step.model);
      if (next) selectModel(next);
    }
    const t = setTimeout(() => setAutoStep((s) => s + 1), step.hold);
    return () => clearTimeout(t);
  }, [auto, autoStep]);

  /* Keep wrapped text above the controls; TextareaAutosize owns the height. */
  useLayoutEffect(() => {
    const input = inputRef.current;
    const controls = controlsRef.current;
    const measure = measureRef.current;
    const modelButton = modelRef.current;
    if (!input || !controls || !measure || !modelButton) return;

    const fixedControlsWidth = 28 * 3 + modelButton.offsetWidth;
    const inlineGaps = 4 * 4;
    const inlineInputWidth = controls.clientWidth - fixedControlsWidth - inlineGaps;
    const needsFullWidth = draft.includes("\n") || measure.offsetWidth + 8 > inlineInputWidth;
    if (needsFullWidth !== expanded) {
      setExpanded(needsFullWidth);
    }
  }, [draft, expanded]);

  /* clicking anywhere outside the composer closes the open menus */
  useEffect(() => {
    if (!modelOpen && !plusOpen) return;
    const close = (event: PointerEvent) => {
      if (!(event.target as Element).closest("[data-promptbar]")) {
        setModelOpen(false);
        setPlusOpen(false);
      }
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [modelOpen, plusOpen]);

  const closeMenus = () => {
    setPlusOpen(false);
    setModelOpen(false);
    setAttachBlockedOpen(false);
  };

  const pick = (row: { key: string; name: string }) => {
    const source = SOURCES.find((s) => s.key === row.key);
    if (source?.attach) {
      if (attachBlocked) {
        setAttachBlockedOpen(true);
      } else if (onAttachFiles) {
        // [SAGE-MEDIA-C01:upload] real picker: the host uploads and tracks the chips.
        fileRef.current?.click();
      } else {
        setAttachments((current) => [...current, FILES[current.length % FILES.length]]);
      }
      if (token) setDraft(draft.slice(0, token.start));
    } else if (menu === "at") {
      setDraft(`${token ? draft.slice(0, token.start) : draft}@${row.name} `);
    } else {
      setDraft(`${token ? draft.slice(0, token.start) : draft}${row.name} `);
    }
    setPlusOpen(false);
    setDismissed(false);
    inputRef.current?.focus();
  };

  const hostChips = attachmentChips ?? [];
  const canSend = !disabled && !busy && !sendBlocked && (draft.trim().length > 0 || attachments.length > 0 || hostChips.some((chip) => chip.status === "ready"));
  /* Dictated text arrives in bursts. Rather than letting each burst snap in, the input text is
   * eased back to full opacity on every growth, so a new phrase reads as a soft fade-in instead of
   * a hard repaint. Cheap by construction: one class swap per burst, no extra React state in the
   * hot path beyond the nonce the effect below already needs. */
  const dictationNonce = useRef(0);
  const [dictationFade, setDictationFade] = useState(false);
  const lastDictated = useRef("");

  useEffect(() => {
    if (!dictating) {
      lastDictated.current = "";
      setDictationFade(false);
      return;
    }
    // Only a GROWING draft counts as newly transcribed speech; a user edit must not flicker.
    if (draft.length <= lastDictated.current.length) {
      lastDictated.current = draft;
      return;
    }
    lastDictated.current = draft;
    const id = ++dictationNonce.current;
    setDictationFade(true);
    // Drop the class on the next frame so the CSS transition runs from dim back to full.
    const raf = requestAnimationFrame(() => {
      if (dictationNonce.current === id) setDictationFade(false);
    });
    return () => cancelAnimationFrame(raf);
  }, [draft, dictating]);

  const send = () => {
    if (!canSend) return;
    onSend?.(draft.trim());
    setDraft("");
    setAttachments([]);
    closeMenus();
  };

  return (
    <div
      data-promptbar
      data-testid="beautifului-prompt-bar"
      className={demo ? "flex min-h-[384px] w-full max-w-105 flex-col justify-end pb-8" : "w-full"}
      onPointerDownCapture={takeOver}
      onKeyDownCapture={takeOver}
    >
      {/* composer is the anchor — menus grow up from its top edge */}
      <div ref={composerAnchorRef} className="relative">
      {children}
      {/* ── @ / slash menu ─────────────────────────────── */}
      {menu && (
        <div
          onMouseLeave={() => setEngaged(false)}
          className="absolute inset-x-0 bottom-full z-10 mb-2 rounded-[10px] bg-surface p-1 shadow-raised"
          style={{ animation: "pop-in 180ms cubic-bezier(0.23,1,0.32,1) both", transformOrigin: "bottom center" }}
        >
          {/* single gliding highlight — appears once a row is hovered */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-1 rounded-[6px] bg-hover"
            style={{
              top: rowBox?.top ?? 0,
              height: rowBox?.height ?? 0,
              opacity: rowBox && engaged && rows.length > 0 ? 1 : 0,
              transition:
                "top 220ms cubic-bezier(0.23,1,0.32,1), height 220ms cubic-bezier(0.23,1,0.32,1), opacity 150ms ease",
            }}
          />
          {rows.map((row, i) => {
            const source = menu === "at" ? SOURCES.find((s) => s.key === row.key) : undefined;
            return (
              <button
                key={row.key}
                type="button"
                ref={(el) => {
                  rowRefs.current[i] = el;
                }}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => {
                  setActive(i);
                  setEngaged(true);
                }}
                onClick={() => pick(row)}
                className="relative z-10 flex h-9 w-full items-center gap-2.5 rounded-[6px] px-2 text-left"
              >
                {source && (
                  <span className="flex size-5.5 shrink-0 items-center justify-center text-ink-2">
                    {source.brand ? BRANDS[source.brand] : <Icon size={15}>{GLYPHS[source.glyph ?? "clip"]}</Icon>}
                  </span>
                )}
                <span className="shrink-0 text-[12.5px] font-medium text-ink">
                  {row.name}
                </span>
                <span className="min-w-0 flex-1 truncate text-[12px] text-ink-3">{row.desc}</span>
                {source?.connect && (
                  <span
                    role="button"
                    tabIndex={-1}
                    onClick={(event) => {
                      event.stopPropagation();
                      setConnected((current) => !current);
                    }}
                    className={`shrink-0 text-[12px] font-medium transition-colors duration-100 ${
                      connected ? "text-green" : "text-accent-ink hover:underline"
                    }`}
                  >
                    {connected ? "Connected" : "Connect"}
                  </span>
                )}
              </button>
            );
          })}
          {rows.length === 0 && (
            <div className="flex h-9 items-center px-2 text-[12px] text-ink-3">
              No matches for “{query}”
            </div>
          )}
          <div className="mt-1 border-t border-line px-2 pt-1.5 pb-1 text-[11px] text-ink-3">
            {menu === "at" ? "Type to search sources & files" : "Type to search commands"}
          </div>
        </div>
      )}

      {/* ── model menu ─────────────────────────────────── */}
      {modelOpen && (
        <div
          onMouseLeave={() => setModelHovered(null)}
          className="absolute z-10 w-44 rounded-[10px] bg-surface p-1 shadow-raised"
          style={{ left: modelMenuLeft, bottom: modelMenuBottom, animation: "pop-in 180ms cubic-bezier(0.23,1,0.32,1) both", transformOrigin: "bottom left" }}
        >
          {/* single gliding highlight — floats to the hovered / selected row */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-1 rounded-[6px] bg-hover"
            style={{
              top: modelBox?.top ?? 0,
              height: modelBox?.height ?? 0,
              opacity: modelBox && modelHovered !== null ? 1 : 0,
              transition:
                "top 220ms cubic-bezier(0.23,1,0.32,1), height 220ms cubic-bezier(0.23,1,0.32,1), opacity 150ms ease",
            }}
          />
          {MODELS.map((m, i) => (
            <button
              key={m.key}
              type="button"
              ref={(el) => {
                modelRowRefs.current[i] = el;
              }}
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => setModelHovered(i)}
              onClick={() => {
                selectModel(m);
                inputRef.current?.focus();
              }}
              className="relative z-10 flex h-7.5 w-full items-center gap-2 rounded-[6px] px-2 text-left"
            >
              <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-ink">{m.name}</span>
              <span className="shrink-0 text-[11px] text-ink-3">{m.tag}</span>
              <span className={`shrink-0 text-ink ${m.key === model.key ? "" : "invisible"}`}>
                <Icon size={13} strokeWidth={2.5}><path d="M20 6L9 17l-5-5" /></Icon>
              </span>
            </button>
          ))}
        </div>
      )}

      {/* ── composer ───────────────────────────────────── */}
      <div
        className={`relative isolate flex flex-col overflow-hidden border border-line bg-surface shadow-card transition-[border-color,border-radius] duration-150 focus-within:border-line-strong ${
          tall ? "gap-2.5 p-3.5" : "gap-1.5 p-1.5"
        } ${
          pill ? (attachments.length > 0 || wide ? "rounded-[24px]" : "rounded-full") : tall ? "rounded-[22px]" : "rounded-[14px]"
        }`}
      >
        {/* rainbow glimm sweep — plays across the interior on model change.
            explicit w/h: a <canvas> is a replaced element and won't stretch
            to inset-0 alone, which feeds back into the shader's ResizeObserver. */}
        <canvas
          ref={glimmRef}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 h-full w-full"
          style={{ borderRadius: "inherit" }}
        />
        <span
          ref={measureRef}
          aria-hidden="true"
          className="pointer-events-none absolute invisible whitespace-pre text-[13px] leading-[18px]"
        >
          {draft}
        </span>

        {(attachments.length > 0 || hostChips.length > 0) && (
          <div className={`flex flex-wrap gap-1.5 pt-0.5 ${pill ? "px-1" : "px-0.5"}`}>
            {hostChips.map((chip) => (
              <span key={chip.id} data-testid={`prompt-bar-media-chip-wrap-${chip.id}`} style={{ animation: "pop-in 200ms cubic-bezier(0.23,1,0.32,1) both" }}>
                <ComposerAttachmentChip
                  id={chip.id}
                  name={chip.name}
                  kind={chip.kind}
                  previewUrl={chip.previewUrl}
                  status={chip.status}
                  error={chip.error}
                  onRemove={() => onRemoveAttachment?.(chip.id)}
                  testIdPrefix="forky-prompt-bar-media-chip"
                />
              </span>
            ))}
            {attachments.map((file, i) => (
              <span
                key={`${file}-${i}`}
                className={`flex h-6.5 items-center gap-1.5 bg-field py-1 pr-1 pl-1.5 text-[11.5px] text-ink-2 shadow-hairline ${
                  pill ? "rounded-full" : "rounded-chip"
                }`}
                style={{ animation: "pop-in 200ms cubic-bezier(0.23,1,0.32,1) both" }}
              >
                <Icon size={12}><g><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /></g></Icon>
                <span className="max-w-36 truncate">{file}</span>
                <button
                  type="button"
                  aria-label={`Remove ${file}`}
                  onClick={() => setAttachments((current) => current.filter((_, j) => j !== i))}
                  className={`-my-1 flex size-6 items-center justify-center text-ink-3 transition-colors duration-100 hover:bg-hover hover:text-ink ${
                    pill ? "rounded-full" : "rounded-[5px]"
                  }`}
                >
                  <Icon size={10} strokeWidth={2.5}><path d="M18 6L6 18M6 6l12 12" /></Icon>
                </button>
              </span>
            ))}
          </div>
        )}

        <div
          ref={controlsRef}
          className={`grid items-end gap-x-1 gap-y-1.5 ${
            !controls
              ? attachColumn
                ? mic
                  ? "grid-cols-[minmax(0,1fr)_28px_28px_28px]"
                  : "grid-cols-[minmax(0,1fr)_28px_auto]"
                : mic
                  ? "grid-cols-[minmax(0,1fr)_28px_28px]"
                  : "grid-cols-[minmax(0,1fr)_auto]"
              : wide
                ? "grid-cols-[28px_auto_minmax(0,1fr)_28px_28px]"
                : "grid-cols-[28px_minmax(0,1fr)_auto_28px_28px]"
          }`}
        >
          {controls && (
          <button
            type="button"
            aria-label="Add attachments and sources"
            aria-expanded={plusOpen}
            onClick={() => {
              setModelOpen(false);
              setPlusOpen((current) => !current);
              inputRef.current?.focus();
            }}
            className={`flex size-7 shrink-0 items-center justify-center justify-self-start text-ink-3 transition-[background-color,color,transform] duration-150 hover:bg-hover hover:text-ink active:scale-[0.94] ${
              pill ? "rounded-full" : "rounded-[8px]"
            } ${plusOpen ? "bg-hover text-ink" : ""} ${wide ? "col-start-1 row-start-2" : "col-start-1 row-start-1"}`}
          >
            <Icon size={16} strokeWidth={2}><path d="M12 5v14M5 12h14" /></Icon>
          </button>
          )}

          <TextareaAutosize
            ref={holdInputElement}
            minRows={1}
            maxRows={5}
            value={draft}
            maxLength={maxLength}
            disabled={disabled}
            data-testid={inputTestId}
            onChange={(event) => {
              setDraft(event.target.value);
              setDismissed(false);
              setPlusOpen(false);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && (event.metaKey || event.ctrlKey) && !event.nativeEvent.isComposing) return;
              onInputKeyDown?.(event);
              if (event.defaultPrevented) return;
              if (menu && rows.length > 0) {
                if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                  event.preventDefault();
                  setEngaged(true);
                  setActive((current) => (current + (event.key === "ArrowDown" ? 1 : rows.length - 1)) % rows.length);
                  return;
                }
                if ((event.key === "Enter" && !event.shiftKey) || event.key === "Tab") {
                  event.preventDefault();
                  pick(rows[active]);
                  return;
                }
              }
              if (event.key === "Escape") {
                setDismissed(true);
                closeMenus();
                return;
              }
              if (event.key === "Enter" && !event.shiftKey && !event.metaKey && !event.ctrlKey && !event.nativeEvent.isComposing) {
                event.preventDefault();
                send();
              }
            }}
            placeholder={dictating ? "Listening…" : placeholder ?? "Write a message…"}
            aria-label={inputAriaLabel ?? placeholder ?? "Prompt"}
            style={{
              // 220ms matches the house fade-in (150ms) plus a touch of tail, so dictation feels
              // continuous with the rest of the beautiful-ui motion rather than faster than it.
              transition: "opacity 220ms cubic-bezier(0.23,1,0.32,1)",
              opacity: dictationFade ? 0.55 : 1,
            }}
            className={`${tall ? "min-h-[68px] px-2 py-2 text-[14px] leading-5" : "min-h-7 px-1 py-[5px] text-[13px] leading-[18px]"} min-w-0 w-full resize-none overflow-y-auto bg-transparent text-ink outline-none [overflow-wrap:anywhere] placeholder:text-ink-3 ${
              !controls
                ? "col-start-1 row-start-1"
                : wide
                  ? "col-span-full col-start-1 row-start-1"
                  : "col-start-2 row-start-1"
            }`}
          />

          {/* model picker */}
          {controls && (
          <button
            ref={modelRef}
            type="button"
            aria-expanded={modelOpen}
            aria-label="Choose model"
            onClick={() => {
              setPlusOpen(false);
              setModelOpen((current) => !current);
            }}
            className={`flex h-7 shrink-0 items-center gap-1 px-1.5 text-[12px] font-medium text-ink-2 transition-colors duration-150 hover:bg-hover hover:text-ink ${
              pill ? "rounded-full" : "rounded-[8px]"
            } ${wide ? "col-start-2 row-start-2 justify-self-start" : "col-start-3 row-start-1"}`}
          >
            {model.name}
            <span className="text-ink-3">
              <Icon size={11} strokeWidth={2.4}><path d="M6 9l6 6 6-6" /></Icon>
            </span>
          </button>
          )}

          {/* attach — real picker when the host handles uploads ([SAGE-MEDIA-C01:upload]); blocked
              with a popover when the selected model has no vision ([SAGE-MEDIA-C04:model-capability]) */}
          {attachColumn && (
            <div className={`relative flex shrink-0 items-center justify-self-start col-start-2 row-start-1`}>
              <input
                ref={fileRef}
                type="file"
                multiple
                accept={attachAccept}
                data-testid="prompt-bar-attach-input"
                className="hidden"
                onChange={(event) => {
                  const files = Array.from(event.target.files ?? []);
                  event.target.value = "";
                  if (files.length) onAttachFiles?.(files);
                }}
              />
              <button
                type="button"
                aria-label={attachBlocked ? (attachBlockedReason ?? "Attachments blocked") : "Add photos & files"}
                aria-expanded={attachBlocked ? attachBlockedOpen : undefined}
                data-testid="prompt-bar-attach-button"
                onClick={openAttachPicker}
                className={`flex size-7 shrink-0 items-center justify-center transition-[background-color,color,transform] duration-150 active:scale-[0.94] ${
                  pill ? "rounded-full" : "rounded-[8px]"
                } ${attachBlocked ? "cursor-not-allowed text-ink-3 opacity-60" : "text-ink-3 hover:bg-hover hover:text-ink"}`}
              >
                <Icon size={15} strokeWidth={2}>{GLYPHS.clip}</Icon>
              </button>
              {attachBlocked && attachBlockedOpen && (
                <div
                  role="tooltip"
                  data-testid="prompt-bar-attach-blocked-popover"
                  className="absolute bottom-full left-0 z-30 mb-2 w-56 rounded-[10px] border border-line bg-surface p-2 text-[11.5px] leading-snug text-ink-2 shadow-card"
                >
                  {attachBlockedReason ?? "The selected model cannot analyze media."}
                </div>
              )}
            </div>
          )}

          {/* dictation — the host records and uploads; this only reflects it */}
          {mic && (
          <button
            type="button"
            aria-label={dictating ? "Stop dictation" : "Start dictation"}
            aria-pressed={dictating}
            disabled={voiceBusy}
            onClick={() => onToggleDictation?.()}
            className={`flex size-7 shrink-0 items-center justify-center transition-[background-color,color,transform] duration-150 active:scale-[0.94] disabled:opacity-60 ${
              pill ? "rounded-full" : "rounded-[8px]"
            } ${dictating ? "bg-accent-tint text-accent-ink" : "text-ink-3 hover:bg-hover hover:text-ink"} ${wide ? "col-start-4 row-start-2" : !controls ? (attachColumn ? "col-start-3 row-start-1" : "col-start-2 row-start-1") : "col-start-4 row-start-1"}`}
          >
            {dictating ? (
              <span className="flex h-3.5 items-center gap-[2.5px]">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="w-[2.5px] rounded-full bg-current"
                    style={{ height: "100%", animation: `eq-bounce 900ms ease-in-out ${i * 150}ms infinite` }}
                  />
                ))}
              </span>
            ) : (
              <Icon size={15} strokeWidth={2}><g><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v3" /></g></Icon>
            )}
          </button>
          )}

          {/* send — tactile square (round in the pill variant) */}
          <button
            type="button"
            aria-label={sendLabel ?? "Send"}
            data-testid={sendTestId}
            disabled={!canSend}
            onClick={send}
            className={`flex shrink-0 items-center justify-center transition-[background-color,color,transform] duration-200 enabled:active:scale-[0.94] ${
              /* a host that hides the controls is a real surface: thumb-sized on phones,
                 the registry's 28px square from `md` up */
              !controls ? "size-9 md:size-7" : "size-7"
            } ${
              pill ? "rounded-full" : "rounded-[10px] md:rounded-[8px]"
            } ${!controls ? (attachColumn ? (mic ? "col-start-4 row-start-1" : "col-start-3 row-start-1") : mic ? "col-start-3 row-start-1" : "col-start-2 row-start-1") : wide ? "col-start-5 row-start-2" : "col-start-5 row-start-1"}`}
            style={{
              background: canSend ? "var(--ink)" : "var(--line-strong)",
              color: canSend ? "var(--surface)" : "var(--ink-2)",
            }}
          >
            <Icon size={16} strokeWidth={2.4}><path d="M12 19V5M5 12l7-7 7 7" /></Icon>
          </button>
        </div>
      </div>
      </div>
    </div>
  );
}
