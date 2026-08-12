// Repairs the GFM table delimiter rows MiniMax intermittently mangles (e.g. a
// stray "(" / ")" or other punctuation prepended to "|---|---|"). remark-gfm
// only recognises a table when every delimiter cell is ":?-+:?"; any other
// character on that row downgrades the whole block to a paragraph of literal
// pipes. This normalises delimiter rows so valid tables render as real tables.
//
// Conservative: a line is only rewritten when (a) the previous line looks like
// a pipe-table header and (b) after stripping non { | : - space } characters,
// every cell matches the GFM delimiter grammar. Header and data rows are
// always left untouched.

const PIPE_HEADER = /^\s*\|/;
const DELIM_CELL = /^:?-+:?$/;

/** Strip every character that is not legal in a GFM delimiter row. */
function stripDelimiterNoise(line: string): string {
  return line.replace(/[^|:\-\s]/g, "");
}

/** Normalise a single cleaned delimiter cell to its canonical minimal form,
 * preserving alignment colons and collapsing the dash run to three. */
function canonicalCell(cell: string): string {
  const c = cell.trim();
  const lead = c.startsWith(":");
  const trail = c.endsWith(":");
  const core = lead && trail ? ":---:" : lead ? ":---" : trail ? "---:" : "---";
  return core;
}

/** Rebuild a canonical delimiter row from its cleaned cells. */
function rebuildDelimiter(cleaned: string): string | null {
  const cells = cleaned
    .split("|")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  if (cells.length === 0) return null;
  if (!cells.every((c) => DELIM_CELL.test(c))) return null;
  return "| " + cells.map(canonicalCell).join(" | ") + " |";
}

export function repairGfmTables(text: string): string {
  const lines = text.split("\n");
  for (let i = 1; i < lines.length; i++) {
    if (!PIPE_HEADER.test(lines[i - 1])) continue;
    const cur = lines[i];
    if (!cur.includes("|")) continue;
    // Fast path: already a clean delimiter row.
    const cellsFast = cur
      .split("|")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    if (cellsFast.every((c) => DELIM_CELL.test(c))) continue;
    const rebuilt = rebuildDelimiter(stripDelimiterNoise(cur));
    if (rebuilt !== null) lines[i] = rebuilt;
  }
  return lines.join("\n");
}
