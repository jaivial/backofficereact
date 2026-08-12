import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { repairGfmTables } from "./repairGfmTables";

// MarkdownText (assistant-ui) runs `preprocess -> react-markdown + remark-gfm`.
// This test exercises that same pipeline to prove GFM tables render as a
// semantic <table> and that MiniMax's malformed delimiter rows are repaired.
function renderMd(md: string) {
  return render(
    <ReactMarkdown remarkPlugins={[remarkGfm]}>{repairGfmTables(md)}</ReactMarkdown>,
  );
}

const BOOKINGS_MD = `Tienes 2 reservas:

| Fecha | Hora | Personas | Cliente |
|---|---|---|---|
| 2026-08-10 | 20:30 | 2 | Ana Pérez |
| 2026-08-11 | 21:00 | 4 | Luis García |`;

// The exact malformation observed from MiniMax: the delimiter row starts with
// "(", which remark-gfm rejects, downgrading the block to literal pipes.
const MALFORMED_MD = `¡Hola! 2 reservas con 10 personas.
| Mes | Total Reservas | Total Personas |
(|-------------|-----------------|-------------------|
| Noviembre 23 | 2 | 10 |`;

describe("Forky markdown table pipeline", () => {
  it("renders a valid GFM table as a semantic <table>", () => {
    const { container } = renderMd(BOOKINGS_MD);
    const table = container.querySelector("table");
    expect(table).not.toBeNull();
    const headers = Array.from(table!.querySelectorAll("th")).map((th) => th.textContent ?? "");
    expect(headers).toEqual(["Fecha", "Hora", "Personas", "Cliente"]);
    expect(table!.textContent).toContain("Ana Pérez");
    expect(table!.textContent).not.toContain("---|---|---");
  });

  it("repairs a malformed delimiter row so it renders as a <table>", () => {
    const { container } = renderMd(MALFORMED_MD);
    const table = container.querySelector("table");
    expect(table).not.toBeNull();
    const headers = Array.from(table!.querySelectorAll("th")).map((th) => th.textContent ?? "");
    expect(headers).toEqual(["Mes", "Total Reservas", "Total Personas"]);
    // Raw pipes must not leak into the prose.
    expect(container.textContent).not.toContain("(|");
  });

  it("leaves prose outside the table untouched", () => {
    const { container } = renderMd(BOOKINGS_MD);
    expect(container.textContent).toContain("Tienes 2 reservas:");
  });
});
