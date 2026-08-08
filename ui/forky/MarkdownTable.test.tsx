import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// These styled markup overrides mirror `ForkyMarkdownText` in ForkyModal.tsx.
const tableComponents = {
  table: (props: React.HTMLAttributes<HTMLTableElement>) => (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-xs" data-testid="forky-markdown-table" {...props} />
    </div>
  ),
  th: (props: React.ThHTMLAttributes<HTMLTableCellElement>) => (
    <th className="border px-2 py-1" {...props} />
  ),
  td: (props: React.TdHTMLAttributes<HTMLTableCellElement>) => (
    <td className="border px-2 py-1" {...props} />
  ),
} as const;

const BOOKINGS_MD = `Tienes 2 reservas:

| Fecha | Hora | Personas | Cliente |
|---|---|---|---|
| 2026-08-10 | 20:30 | 2 | Ana Pérez |
| 2026-08-11 | 21:00 | 4 | Luis García |`;

describe("Markdown GFM table rendering (as wired in ForkyModal)", () => {
  it("renders pipe tables as semantic <table> without raw pipes leaking", () => {
    const { container } = render(
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={tableComponents}>
        {BOOKINGS_MD}
      </ReactMarkdown>,
    );
    const table = container.querySelector("table");
    expect(table).not.toBeNull();
    const headers = Array.from(table!.querySelectorAll("th")).map((th) => th.textContent ?? "");
    expect(headers).toEqual(["Fecha", "Hora", "Personas", "Cliente"]);
    expect(table!.textContent).toContain("Ana Pérez");
    expect(table!.textContent).not.toContain("---|---|---");
    // The styled wrapper (data-testid) must be present, mirroring ForkyMarkdownText.
    expect(container.querySelector('[data-testid="forky-markdown-table"]')).not.toBeNull();
  });

  it("leaves prose outside the table untouched", () => {
    const { container } = render(
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{BOOKINGS_MD}</ReactMarkdown>,
    );
    expect(container.textContent).toContain("Tienes 2 reservas:");
  });
});
