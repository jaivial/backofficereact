import { describe, it, expect } from "vitest";
import { repairGfmTables } from "./repairGfmTables";

describe("repairGfmTables", () => {
  it("repairs a delimiter row with a stray leading parenthesis", () => {
    // The exact malformation observed from MiniMax: the GFM delimiter row starts
    // with "(" so remark-gfm refuses to parse the block as a table.
    const input = [
      "¡Hola! El 23 de octubre hay 2 reservas con 10 personas.",
      "| Mes | Total Reservas | Total Personas |",
      "(|-------------|-----------------|-------------------|",
      "| Noviembre 23 | 2 | 10 |",
    ].join("\n");
    const out = repairGfmTables(input);
    expect(out).toContain("| --- | --- | --- |");
    expect(out).not.toContain("(|");
  });

  it("leaves a well-formed table untouched", () => {
    const input = [
      "| Mes | Total |",
      "| --- | --- |",
      "| Nov | 2 |",
    ].join("\n");
    expect(repairGfmTables(input)).toBe(input);
  });

  it("preserves alignment colons when rebuilding the delimiter", () => {
    const input = [
      "| Mes | Total |",
      "(|:---|---:|",
      "| Nov | 2 |",
    ].join("\n");
    expect(repairGfmTables(input)).toBe(
      ["| Mes | Total |", "| :--- | ---: |", "| Nov | 2 |"].join("\n"),
    );
  });

  it("ignores pipe-less prose lines", () => {
    const prose = "No hay tablas aqui, solo texto (con parentesis).";
    expect(repairGfmTables(prose)).toBe(prose);
  });

  it("does not corrupt a delimiter already surrounded by whitespace", () => {
    const input = [
      "| Mes |",
      " | --- | ",
      "| Nov |",
    ].join("\n");
    expect(repairGfmTables(input)).toBe(input);
  });
});
