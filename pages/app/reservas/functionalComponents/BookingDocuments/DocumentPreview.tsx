import React, { useEffect, useMemo, useState } from "react";
import { FileWarning } from "lucide-react";

import { documentKind, type BookingDocument, type DocumentKind } from "../../../../../api/bookingDocuments";
import { PdfPreview } from "../../../../../ui/pdf/PdfPreview";

/**
 * Renders a stored booking document inline. Each heavy parser (pdf.js, mammoth,
 * SheetJS) is imported dynamically so opening the list never downloads them, and
 * so SSR never touches `window`.
 * Coordination id: booking_documents_v1
 */
export function DocumentPreview({ doc }: { doc: BookingDocument }) {
  const kind = useMemo(() => documentKind(doc), [doc]);
  const url = doc.url || "";

  switch (kind) {
    case "image":
      return (
        <div className="bo-documentPreview bo-documentPreview--image" data-testid="booking-document-preview-image" data-document-kind="image">
          <img src={url} alt={doc.title || doc.original_filename} data-testid="booking-document-preview-img" />
        </div>
      );
    case "pdf":
      return (
        <div className="bo-documentPreview" data-testid="booking-document-preview-pdf" data-document-kind="pdf">
          <PdfPreview url={url} maxWidth={720} testId="booking-document-preview-pdf-view" />
        </div>
      );
    case "markdown":
      return <MarkdownPreview url={url} testId="booking-document-preview-markdown" />;
    case "text":
      return <TextPreview url={url} testId="booking-document-preview-text" />;
    case "docx":
      return <DocxPreview url={url} testId="booking-document-preview-docx" />;
    case "sheet":
      return <SheetPreview url={url} testId="booking-document-preview-sheet" />;
    default:
      return <UnsupportedPreview doc={doc} />;
  }
}

/** Text / markdown: a tab toggle between the raw text and the rendered markdown. */
function MarkdownPreview({ url, testId }: { url: string; testId: string }) {
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rendered, setRendered] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch(url, { credentials: "include" })
      .then((res) => (res.ok ? res.text() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((body) => { if (alive) setText(body); })
      .catch((e) => { if (alive) setError(e instanceof Error ? e.message : "No se pudo leer el archivo"); });
    return () => { alive = false; };
  }, [url]);

  if (error) return <PreviewError message={error} testId={`${testId}-error`} />;
  if (text == null) return <p className="bo-muted" data-testid={`${testId}-loading`}>Cargando documento…</p>;

  return (
    <div className="bo-documentPreview" data-testid={testId} data-document-kind="markdown">
      <div className="bo-displayToggle" role="tablist" aria-label="Vista del documento" data-slot="booking-document-preview-tabs">
        <button
          type="button"
          role="tab"
          aria-selected={!rendered}
          className={`bo-displayToggleBtn${rendered ? "" : " is-active"}`}
          onClick={() => setRendered(false)}
          data-testid={`${testId}-tab-text`}
        >
          Texto
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={rendered}
          className={`bo-displayToggleBtn${rendered ? " is-active" : ""}`}
          onClick={() => setRendered(true)}
          data-testid={`${testId}-tab-markdown`}
        >
          Markdown
        </button>
      </div>
      {rendered ? (
        <MarkdownBody text={text} testId={`${testId}-markdown`} />
      ) : (
        <pre className="bo-documentText" data-testid={`${testId}-text`}>
          {text}
        </pre>
      )}
    </div>
  );
}

/** Markdown body. react-markdown + remark-gfm are already project dependencies. */
function MarkdownBody({ text, testId }: { text: string; testId: string }) {
  const [mod, setMod] = useState<{ Markdown: any; remarkGfm: any } | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    Promise.all([import("react-markdown"), import("remark-gfm")])
      .then(([markdown, gfm]) => {
        if (alive) setMod({ Markdown: markdown.default, remarkGfm: gfm.default });
      })
      .catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, []);
  if (failed) return <pre className="bo-documentText" data-testid={`${testId}-fallback`}>{text}</pre>;
  if (!mod) return <p className="bo-muted" data-testid={`${testId}-loading`}>Cargando vista…</p>;
  return (
    <div className="bo-documentMarkdown" data-testid={testId}>
      <mod.Markdown remarkPlugins={[mod.remarkGfm]}>{text}</mod.Markdown>
    </div>
  );
}

function TextPreview({ url, testId }: { url: string; testId: string }) {
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    fetch(url, { credentials: "include" })
      .then((res) => (res.ok ? res.text() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((body) => { if (alive) setText(body); })
      .catch((e) => { if (alive) setError(e instanceof Error ? e.message : "No se pudo leer el archivo"); });
    return () => { alive = false; };
  }, [url]);
  if (error) return <PreviewError message={error} testId={`${testId}-error`} />;
  if (text == null) return <p className="bo-muted" data-testid={`${testId}-loading`}>Cargando documento…</p>;
  return (
    <pre className="bo-documentText" data-testid={testId} data-document-kind="text">
      {text}
    </pre>
  );
}

/** DOCX -> HTML via mammoth, loaded on demand. */
function DocxPreview({ url, testId }: { url: string; testId: string }) {
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const [{ default: mammoth }, buffer] = await Promise.all([
          import("mammoth"),
          fetch(url, { credentials: "include" }).then((res) => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return res.arrayBuffer();
          }),
        ]);
        const result = await mammoth.convertToHtml({ arrayBuffer: buffer });
        if (alive) setHtml(String(result.value || ""));
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : "No se pudo leer el documento");
      }
    })();
    return () => { alive = false; };
  }, [url]);
  if (error) return <PreviewError message={error} testId={`${testId}-error`} />;
  if (html == null) return <p className="bo-muted" data-testid={`${testId}-loading`}>Cargando documento…</p>;
  // mammoth output is generated from the file itself, never from user markup.
  return (
    <div
      className="bo-documentRichText"
      data-testid={testId}
      data-document-kind="docx"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

/** XLS/XLSX/CSV -> HTML table via read-excel-file, loaded on demand. */
function SheetPreview({ url, testId }: { url: string; testId: string }) {
  const [sheets, setSheets] = useState<string[] | null>(null);
  const [rows, setRows] = useState<unknown[][] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const [{ default: readXlsxFile }, buffer] = await Promise.all([
          import("read-excel-file/browser"),
          fetch(url, { credentials: "include" }).then((res) => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return res.arrayBuffer();
          }),
        ]);
        // No options: readXlsxFile resolves with every sheet, already parsed.
        const parsed = await readXlsxFile(buffer);
        if (!alive) return;
        const sheets = (Array.isArray(parsed) ? parsed : []).map((entry) => ({
          name: String(entry.sheet ?? ""),
          data: (entry.data ?? []) as unknown[][],
        }));
        setSheets(sheets.map((entry) => entry.name));
        setRows(sheets.length ? sheets[0].data : []);
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : "No se pudo leer la hoja de cálculo");
      }
    })();
    return () => { alive = false; };
  }, [url]);

  if (error) return <PreviewError message={error} testId={`${testId}-error`} />;
  if (!rows) return <p className="bo-muted" data-testid={`${testId}-loading`}>Cargando hoja de cálculo…</p>;
  const [header, ...body] = rows;
  return (
    <div className="bo-documentPreview" data-testid={testId} data-document-kind="sheet">
      {sheets && sheets.length > 1 ? (
        <p className="bo-muted" data-testid={`${testId}-sheets`}>
          {sheets.length} hojas · mostrando la primera
        </p>
      ) : null}
      <div className="bo-documentSheetScroll">
        <table className="bo-table bo-documentSheet" data-testid={`${testId}-table`}>
          <thead>
            <tr>
              {(header || []).map((cell, i) => (
                <th key={i}>{String(cell ?? "")}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {body.map((row, i) => (
              <tr key={i}>
                {row.map((cell, j) => (
                  <td key={j}>{String(cell ?? "")}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Slides, zip, unknown types: no inline preview, but the file stays usable. */
function UnsupportedPreview({ doc }: { doc: BookingDocument }) {
  return (
    <div className="bo-documentPreview bo-documentPreview--unsupported" data-testid="booking-document-preview-unsupported" data-document-kind="other">
      <FileWarning size={28} strokeWidth={1.6} aria-hidden="true" data-slot="booking-document-unsupported-icon" />
      <p data-testid="booking-document-preview-unsupported-text">
        No hay vista previa para este tipo de archivo. Ábrelo en una pestaña nueva o descárgalo.
      </p>
      <a
        className="bo-btn bo-btn--primary"
        href={doc.url}
        target="_blank"
        rel="noreferrer"
        data-testid="booking-document-preview-unsupported-open"
      >
        Abrir documento
      </a>
    </div>
  );
}

function PreviewError({ message, testId }: { message: string; testId: string }) {
  return (
    <div className="bo-documentPreview bo-documentPreview--unsupported" data-testid={testId}>
      <p>No se pudo previsualizar: {message}</p>
    </div>
  );
}

export type { DocumentKind };
