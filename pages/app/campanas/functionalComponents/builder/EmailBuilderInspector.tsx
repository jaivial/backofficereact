import React, { useEffect, useMemo, useRef, useState } from "react";
import { AlignCenter, AlignLeft, AlignRight, ArrowDown, ArrowUp, ArrowUpLeft, Copy, ImageUp, Loader2, Trash2 } from "lucide-react";
import { cn } from "../../../../../ui/shadcn/utils";
import { Select } from "../../../../../ui/inputs/Select";
import {
  UNSUBSCRIBE_PLACEHOLDER, elementKind, elementLabel, findById, isTextElement, parseFragment, readChannel, readGroup, readVisibility,
  splitClasses, writeChannel, writeGroup, writeVisibility, type BlockChannel, type ClassGroupId, type Visibility,
} from "./emailBuilderDocument";

/*
 * Right panel of the campaign HTML builder (campaign_html_builder_v1): the
 * properties of the selected element. Content (text, link, image) edits the
 * element itself; every style control reads and writes Tailwind classes, for
 * every size or only from tablet up (`md:`), so the design stays plain
 * Tailwind HTML and responsive.
 */

export type InspectorActions = {
  update: (id: string, fn: (el: HTMLElement) => void) => void;
  selectParent: () => void;
  move: (direction: -1 | 1) => void;
  duplicate: () => void;
  remove: () => void;
  uploadImage?: (file: File) => Promise<string>;
};

type Props = { html: string; selectedId: string | null; accent: string; websiteUrl: string; actions: InspectorActions };

type Option = { value: string; label: string };
const opts = (pairs: [string, string][]): Option[] => pairs.map(([value, label]) => ({ value, label }));
const SPACING = ["0", "1", "2", "3", "4", "5", "6", "8", "10", "12", "16"];
const FONT_SIZES = opts([["text-xs", "12 px"], ["text-sm", "14 px"], ["text-base", "16 px"], ["text-lg", "18 px"], ["text-xl", "20 px"], ["text-2xl", "24 px"], ["text-3xl", "30 px"], ["text-4xl", "36 px"], ["text-5xl", "48 px"]]);
const WEIGHTS = opts([["font-normal", "Normal"], ["font-medium", "Media"], ["font-semibold", "Seminegrita"], ["font-bold", "Negrita"], ["font-extrabold", "Extra"]]);
const LEADING = opts([["leading-tight", "Compacto"], ["leading-snug", "Ajustado"], ["leading-normal", "Normal"], ["leading-relaxed", "Amplio"], ["leading-loose", "Muy amplio"]]);
const RADIUS = opts([["rounded-none", "Sin redondeo"], ["rounded", "4 px"], ["rounded-md", "6 px"], ["rounded-lg", "8 px"], ["rounded-xl", "12 px"], ["rounded-2xl", "16 px"], ["rounded-full", "Píldora"]]);
const MAX_WIDTH = opts([["max-w-[120px]", "120 px"], ["max-w-[180px]", "180 px"], ["max-w-[240px]", "240 px"], ["max-w-[320px]", "320 px"], ["max-w-[480px]", "480 px"], ["max-w-[600px]", "600 px"], ["max-w-full", "100 %"]]);
const WIDTH = opts([["w-auto", "Automático"], ["w-full", "100 %"], ["w-1/2", "50 %"], ["w-1/3", "33 %"], ["w-2/3", "66 %"]]);
const SWATCHES = ["#ffffff", "#f3f4f6", "#e5e7eb", "#9ca3af", "#4b5563", "#111827", "#000000", "#b91c1c", "#ea580c", "#ca8a04", "#15803d", "#0e7490", "#1d4ed8", "#7c3aed"];
// Tailwind palette entries the blocks use, so the colour inputs show the real colour.
const NAMED: Record<string, string> = {
  white: "#ffffff", black: "#000000", "gray-50": "#f9fafb", "gray-100": "#f3f4f6", "gray-200": "#e5e7eb", "gray-400": "#9ca3af",
  "gray-500": "#6b7280", "gray-600": "#4b5563", "gray-700": "#374151", "gray-900": "#111827",
};

function hexOf(token: string | null, kind: "text" | "bg"): string {
  if (!token) return "";
  const v = token.slice(kind.length + 1);
  const arbitrary = /^\[(#[0-9a-fA-F]{3,8})\]$/.exec(v)?.[1];
  return arbitrary ?? NAMED[v] ?? "";
}

const CAPTION = "text-[11px] font-semibold uppercase tracking-[0.08em] text-bo-faint";
const INPUT = "h-8 w-full min-w-0 rounded-md border border-bo-border bg-bo-surface-3 px-2 text-[12.5px] text-bo-text outline-none transition focus:border-[#7c5cff]/70";

function Field({ label, children, testId }: { label: string; children: React.ReactNode; testId: string }) {
  return (
    <label className="grid min-w-0 gap-1" data-testid={testId}>
      <span className="text-[11px] text-bo-muted" data-testid={`${testId}-label`}>{label}</span>
      {children}
    </label>
  );
}

/** Inspector selector: the backoffice Select (bo-selectBtn--sm + bo-selectList). */
function SelectField({ label, value, options, onChange, testId, emptyLabel = "—" }: { label: string; value: string | null; options: Option[]; onChange: (v: string | null) => void; testId: string; emptyLabel?: string }) {
  // A class typed by hand (raw classes field, AI) still shows as the current value.
  const all = [{ value: "", label: emptyLabel }, ...options, ...(value && !options.some((o) => o.value === value) ? [{ value, label: value }] : [])];
  return (
    <div className="grid min-w-0 gap-1" data-testid={testId}>
      <span className="text-[11px] text-bo-muted" data-testid={`${testId}-label`}>{label}</span>
      <Select
        size="sm"
        className="w-full"
        style={{ width: "100%", minWidth: 0 }}
        ariaLabel={label}
        value={value ?? ""}
        onChange={(v) => onChange(v || null)}
        options={all}
        menuMinWidthPx={140}
        data-testid={`${testId}-select`}
      />
    </div>
  );
}

function ColorField({ label, value, onChange, testId, accent }: { label: string; value: string; onChange: (hex: string | null) => void; testId: string; accent: string }) {
  return (
    <div className="grid gap-1.5" data-testid={testId}>
      <span className="text-[11px] text-bo-muted" data-testid={`${testId}-label`}>{label}</span>
      <div className="flex flex-wrap items-center gap-1" data-testid={`${testId}-swatches`}>
        {[accent, ...SWATCHES].map((hex, i) => (
          <button
            key={`${hex}-${i}`}
            type="button"
            title={i === 0 ? `Color de marca ${hex}` : hex}
            onClick={() => onChange(hex)}
            className={cn("size-5 cursor-pointer rounded-full border-0 p-0 ring-1 ring-white/15 transition hover:scale-110", value.toLowerCase() === hex.toLowerCase() && "ring-2 ring-[#b9a8ff]")}
            style={{ background: hex }}
            data-testid={`${testId}-swatch-${i}`}
          />
        ))}
        <input type="color" value={value || "#000000"} onChange={(e) => onChange(e.currentTarget.value)} className="size-6 cursor-pointer rounded border-0 bg-transparent p-0" aria-label={`${label} personalizado`} data-testid={`${testId}-picker`} />
        <button type="button" onClick={() => onChange(null)} className="ml-auto cursor-pointer border-0 bg-transparent p-0 text-[11px] text-bo-faint underline-offset-2 hover:text-bo-text hover:underline" data-testid={`${testId}-clear`}>
          Quitar
        </button>
      </div>
    </div>
  );
}

function Segmented<T extends string>({ value, options, onChange, testId, label }: { value: T; options: { value: T; label: React.ReactNode; title: string }[]; onChange: (v: T) => void; testId: string; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="grid auto-cols-fr grid-flow-col gap-0.5 rounded-md border border-bo-border bg-bo-surface-3 p-0.5" data-testid={testId}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          aria-label={o.title}
          title={o.title}
          onClick={() => onChange(o.value)}
          className={cn("flex h-7 cursor-pointer items-center justify-center gap-1 rounded-[5px] border-0 px-1 text-[11.5px] transition-colors", value === o.value ? "bg-bo-surface-2 text-bo-text" : "bg-transparent text-bo-muted hover:text-bo-text")}
          data-testid={`${testId}-${o.value}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Text input that commits on blur/Enter, so typing never floods the undo history. */
function CommitInput({ value, onCommit, testId, multiline, placeholder, mono }: { value: string; onCommit: (v: string) => void; testId: string; multiline?: boolean; placeholder?: string; mono?: boolean }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const commit = () => draft !== value && onCommit(draft);
  return multiline ? (
    <textarea
      className={cn(INPUT, "h-auto min-h-[76px] resize-y py-1.5 leading-snug", mono && "font-mono text-[11.5px]")}
      value={draft}
      placeholder={placeholder}
      onChange={(e) => setDraft(e.currentTarget.value)}
      onBlur={commit}
      data-testid={testId}
    />
  ) : (
    <input
      className={INPUT}
      value={draft}
      placeholder={placeholder}
      onChange={(e) => setDraft(e.currentTarget.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()}
      data-testid={testId}
    />
  );
}

function Section({ title, children, testId }: { title: string; children: React.ReactNode; testId: string }) {
  return (
    <section className="grid gap-2.5 border-b border-bo-border px-3 py-3" data-testid={testId}>
      <h4 className={cn(CAPTION, "m-0")} data-testid={`${testId}-title`}>{title}</h4>
      {children}
    </section>
  );
}

export function EmailBuilderInspector({ html, selectedId, accent, websiteUrl, actions }: Props) {
  const [scope, setScope] = useState<"" | "md:">("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const el = useMemo(() => findById(parseFragment(html), selectedId), [html, selectedId]);

  if (!el || !selectedId) {
    return (
      <div className="grid gap-2 p-4 text-[12.5px] leading-relaxed text-bo-muted" data-testid="email-builder-inspector-empty">
        <p className="m-0 font-medium text-bo-text" data-testid="email-builder-inspector-empty-title">Selecciona un elemento</p>
        <p className="m-0" data-testid="email-builder-inspector-empty-help">
          Haz clic en el lienzo o en una capa para editar su texto, enlace, imagen y estilo. Doble clic sobre un texto para escribir directamente.
        </p>
      </div>
    );
  }

  const classes = splitClasses(el.getAttribute("class"));
  const kind = elementKind(el);
  const tag = el.tagName.toLowerCase();
  const setClasses = (next: string[]) => actions.update(selectedId, (node) => (next.length ? node.setAttribute("class", next.join(" ")) : node.removeAttribute("class")));
  const group = (id: ClassGroupId) => readGroup(classes, id, scope);
  const setGroup = (id: ClassGroupId, value: string | null) => setClasses(writeGroup(classes, id, value, scope));
  const spacing = (axis: "px" | "py" | "mt" | "mb", id: ClassGroupId) => {
    const current = group(id);
    return (
      <SelectField
        label={{ px: "Relleno horizontal", py: "Relleno vertical", mt: "Margen arriba", mb: "Margen abajo" }[axis]}
        value={current}
        options={SPACING.map((n) => ({ value: `${axis}-${n}`, label: `${Number(n) * 4} px` }))}
        onChange={(v) => setGroup(id, v)}
        testId={`email-builder-inspector-${axis}`}
      />
    );
  };
  const textColor = hexOf(group("textColor"), "text");
  const bgColor = hexOf(group("bgColor"), "bg");
  const isText = isTextElement(el);

  const pickImage = async (file: File | undefined) => {
    if (!file || !actions.uploadImage) return;
    setUploading(true);
    try {
      const url = await actions.uploadImage(file);
      actions.update(selectedId, (node) => node.setAttribute("src", url));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="grid content-start" data-testid="email-builder-inspector" data-observe="email-builder-inspector" data-selected-tag={tag}>
      <div className="flex items-center gap-1 border-b border-bo-border px-3 py-2" data-testid="email-builder-inspector-head">
        <div className="min-w-0 flex-1" data-testid="email-builder-inspector-name">
          <p className="m-0 truncate text-[13px] font-semibold text-bo-text" data-testid="email-builder-inspector-label">{elementLabel(el)}</p>
          <p className="m-0 font-mono text-[10.5px] text-bo-faint" data-testid="email-builder-inspector-tag">&lt;{tag}&gt;</p>
        </div>
        {[
          { icon: <ArrowUpLeft size={14} data-testid="email-builder-inspector-parent-icon" />, title: "Seleccionar contenedor (Esc)", onClick: actions.selectParent, id: "parent" },
          { icon: <ArrowUp size={14} data-testid="email-builder-inspector-up-icon" />, title: "Subir", onClick: () => actions.move(-1), id: "up" },
          { icon: <ArrowDown size={14} data-testid="email-builder-inspector-down-icon" />, title: "Bajar", onClick: () => actions.move(1), id: "down" },
          { icon: <Copy size={14} data-testid="email-builder-inspector-duplicate-icon" />, title: "Duplicar (Ctrl+D)", onClick: actions.duplicate, id: "duplicate" },
          { icon: <Trash2 size={14} data-testid="email-builder-inspector-delete-icon" />, title: "Eliminar (Supr)", onClick: actions.remove, id: "delete" },
        ].map((b) => (
          <button
            key={b.id}
            type="button"
            title={b.title}
            aria-label={b.title}
            onClick={b.onClick}
            className={cn("grid size-7 cursor-pointer place-items-center rounded-md border-0 bg-transparent text-bo-muted transition hover:bg-bo-surface-2 hover:text-bo-text", b.id === "delete" && "hover:text-[#ff9c9c]")}
            data-testid={`email-builder-inspector-${b.id}`}
          >
            {b.icon}
          </button>
        ))}
      </div>

      {(isText || tag === "a" || tag === "img") && (
        <Section title="Contenido" testId="email-builder-inspector-content">
          {isText && (
            <Field label={el.children.length ? "Contenido (HTML)" : "Texto"} testId="email-builder-inspector-text">
              <CommitInput
                multiline
                value={el.children.length ? el.innerHTML : el.textContent ?? ""}
                onCommit={(v) => actions.update(selectedId, (node) => (el.children.length ? (node.innerHTML = v) : (node.textContent = v)))}
                testId="email-builder-inspector-text-input"
              />
            </Field>
          )}
          {tag === "a" && (
            <Field label="Enlace (URL)" testId="email-builder-inspector-href">
              <CommitInput value={el.getAttribute("href") ?? ""} placeholder="https://" onCommit={(v) => actions.update(selectedId, (node) => node.setAttribute("href", v.trim()))} testId="email-builder-inspector-href-input" />
              <span className="flex flex-wrap gap-1.5" data-testid="email-builder-inspector-href-presets">
                {websiteUrl && (
                  <button type="button" className="rounded-full border border-bo-border px-2 py-0.5 text-[11px] text-bo-muted hover:text-bo-text" onClick={() => actions.update(selectedId, (node) => node.setAttribute("href", websiteUrl))} data-testid="email-builder-inspector-href-website">
                    Web del restaurante
                  </button>
                )}
                <button type="button" className="rounded-full border border-bo-border px-2 py-0.5 text-[11px] text-bo-muted hover:text-bo-text" onClick={() => actions.update(selectedId, (node) => node.setAttribute("href", UNSUBSCRIBE_PLACEHOLDER))} data-testid="email-builder-inspector-href-unsubscribe">
                  Enlace de baja
                </button>
              </span>
            </Field>
          )}
          {tag === "img" && (
            <>
              <Field label="Imagen (URL)" testId="email-builder-inspector-src">
                <CommitInput value={el.getAttribute("src") ?? ""} placeholder="https://" onCommit={(v) => actions.update(selectedId, (node) => node.setAttribute("src", v.trim()))} testId="email-builder-inspector-src-input" />
              </Field>
              {actions.uploadImage && (
                <>
                  <button
                    type="button"
                    disabled={uploading}
                    onClick={() => fileRef.current?.click()}
                    className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-bo-border bg-bo-surface-2 text-[12px] text-bo-text transition hover:border-[#7c5cff]/60 disabled:opacity-60"
                    data-testid="email-builder-inspector-upload"
                  >
                    {uploading ? <Loader2 size={14} className="animate-spin" aria-hidden="true" data-testid="email-builder-inspector-upload-icon-loading" /> : <ImageUp size={14} aria-hidden="true" data-testid="email-builder-inspector-upload-icon-idle" />}
                    {uploading ? "Subiendo…" : "Subir imagen"}
                  </button>
                  <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => void pickImage(e.currentTarget.files?.[0])} data-testid="email-builder-inspector-upload-input" />
                </>
              )}
              <Field label="Texto alternativo" testId="email-builder-inspector-alt">
                <CommitInput value={el.getAttribute("alt") ?? ""} onCommit={(v) => actions.update(selectedId, (node) => node.setAttribute("alt", v))} testId="email-builder-inspector-alt-input" />
              </Field>
            </>
          )}
        </Section>
      )}

      <Section title="Estilo" testId="email-builder-inspector-style">
        <Segmented
          label="Tamaños a los que se aplica"
          value={scope}
          onChange={setScope}
          options={[
            { value: "", label: "Todos", title: "Móvil, tablet y escritorio" },
            { value: "md:", label: "Tablet y escritorio", title: "Solo desde 768 px (md:)" },
          ]}
          testId="email-builder-inspector-scope"
        />
        {kind !== "image" && kind !== "divider" && (
          <>
            <Segmented
              label="Alineación del texto"
              value={(group("textAlign") ?? "") as string}
              onChange={(v) => setGroup("textAlign", v || null)}
              options={[
                { value: "text-left", label: <AlignLeft size={14} data-testid="email-builder-inspector-align-left-icon" />, title: "Izquierda" },
                { value: "text-center", label: <AlignCenter size={14} data-testid="email-builder-inspector-align-center-icon" />, title: "Centro" },
                { value: "text-right", label: <AlignRight size={14} data-testid="email-builder-inspector-align-right-icon" />, title: "Derecha" },
              ]}
              testId="email-builder-inspector-align"
            />
            <div className="grid grid-cols-2 gap-2" data-testid="email-builder-inspector-type-row">
              <SelectField label="Tamaño" value={group("fontSize")} options={FONT_SIZES} onChange={(v) => setGroup("fontSize", v)} testId="email-builder-inspector-font-size" />
              <SelectField label="Peso" value={group("fontWeight")} options={WEIGHTS} onChange={(v) => setGroup("fontWeight", v)} testId="email-builder-inspector-font-weight" />
            </div>
            <SelectField label="Interlineado" value={group("lineHeight")} options={LEADING} onChange={(v) => setGroup("lineHeight", v)} testId="email-builder-inspector-leading" />
            <ColorField label="Color del texto" value={textColor} accent={accent} onChange={(hex) => setGroup("textColor", hex ? `text-[${hex}]` : null)} testId="email-builder-inspector-text-color" />
          </>
        )}
        <ColorField label="Fondo" value={bgColor} accent={accent} onChange={(hex) => setGroup("bgColor", hex ? `bg-[${hex}]` : null)} testId="email-builder-inspector-bg-color" />
        <div className="grid grid-cols-2 gap-2" data-testid="email-builder-inspector-spacing-row">
          {spacing("px", "paddingX")}
          {spacing("py", "paddingY")}
          {spacing("mt", "marginTop")}
          {spacing("mb", "marginBottom")}
        </div>
        <div className="grid grid-cols-2 gap-2" data-testid="email-builder-inspector-box-row">
          <SelectField label="Esquinas" value={group("radius")} options={RADIUS} onChange={(v) => setGroup("radius", v)} testId="email-builder-inspector-radius" />
          <SelectField label="Ancho" value={group("width")} options={WIDTH} onChange={(v) => setGroup("width", v)} testId="email-builder-inspector-width" />
        </div>
        <SelectField label="Ancho máximo" value={group("maxWidth")} options={MAX_WIDTH} onChange={(v) => setGroup("maxWidth", v)} testId="email-builder-inspector-max-width" emptyLabel="Sin límite" />
      </Section>

      <Section title="Visibilidad" testId="email-builder-inspector-visibility">
        <Segmented<Visibility>
          label="Mostrar en"
          value={readVisibility(classes)}
          onChange={(v) => setClasses(writeVisibility(classes, v))}
          options={[
            { value: "all", label: "Todos", title: "Visible en todos los tamaños" },
            { value: "mobile", label: "Solo móvil", title: "Oculto desde 640 px" },
            { value: "desktop", label: "Sin móvil", title: "Oculto por debajo de 640 px" },
          ]}
          testId="email-builder-inspector-visibility-mode"
        />
        {/* campaign_block_channel_v1: one design, two channels. */}
        <span className="mt-1 text-[11px] font-medium text-bo-muted" data-testid="email-builder-inspector-channel-caption">Canal de envío</span>
        <Segmented<BlockChannel>
          label="Canal de envío"
          value={readChannel(el)}
          onChange={(v) => actions.update(selectedId, (node) => writeChannel(node, v))}
          options={[
            { value: "all", label: "Ambos", title: "Se envía por email y por WhatsApp" },
            { value: "email", label: "Email", title: "Solo en el email: no aparece en el WhatsApp" },
            { value: "whatsapp", label: "WhatsApp", title: "Solo en el WhatsApp: no aparece en el email" },
          ]}
          testId="email-builder-inspector-channel-mode"
        />
        <p className="m-0 text-[11px] leading-snug text-bo-faint" data-testid="email-builder-inspector-channel-help">
          Así el WhatsApp puede ser una versión breve del email.
        </p>
      </Section>

      <Section title="Clases Tailwind" testId="email-builder-inspector-classes">
        <CommitInput multiline mono value={classes.join(" ")} onCommit={(v) => setClasses(splitClasses(v))} testId="email-builder-inspector-classes-input" />
        <p className="m-0 text-[11px] leading-snug text-bo-faint" data-testid="email-builder-inspector-classes-help">
          Cualquier clase de Tailwind v3, con prefijos sm: y md: para tablet y escritorio.
        </p>
      </Section>
    </div>
  );
}
