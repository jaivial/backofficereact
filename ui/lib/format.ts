export function formatHHMM(t: string | null | undefined): string {
  if (!t) return "";
  const s = String(t).trim();
  const m = s.match(/(\d{1,2}):(\d{1,2})/);
  if (m) {
    const hh = Number(m[1]);
    const mm = Number(m[2]);
    if (Number.isFinite(hh) && Number.isFinite(mm) && hh >= 0 && hh <= 23 && mm >= 0 && mm <= 59) {
      return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
    }
  }
  if (s.length >= 5) return s.slice(0, 5);
  return s;
}

export function parseISODate(s: string): Date | null {
  const raw = String(s || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const [y, m, d] = raw.split("-").map((x) => Number(x));
  if (!y || !m || !d) return null;
  return new Date(Date.UTC(y, m - 1, d));
}

export function formatISODate(d: Date): string {
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function parseJSONArrayOrScalarString(raw: string | null): string[] {
  if (!raw) return [];
  const s = String(raw).trim();
  if (!s || s.toLowerCase() === "null") return [];
  if (s.startsWith("[")) {
    try {
      const arr = JSON.parse(s);
      if (Array.isArray(arr)) return arr.map((x) => String(x).trim()).filter(Boolean);
    } catch {
      // ignore
    }
  }
  return [s];
}

function parseJSONArrayOrScalarInt(raw: string | null): number[] {
  if (!raw) return [];
  const s = String(raw).trim();
  if (!s || s.toLowerCase() === "null") return [];
  if (s.startsWith("[")) {
    try {
      const arr = JSON.parse(s);
      if (Array.isArray(arr)) return arr.map((x) => Number(x)).filter((n) => Number.isFinite(n) && n > 0);
    } catch {
      // ignore
    }
  }
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? [n] : [];
}

export function formatArrozShort(typesRaw: string | null, servingsRaw: string | null): string {
  const types = parseJSONArrayOrScalarString(typesRaw);
  const servs = parseJSONArrayOrScalarInt(servingsRaw);
  if (!types.length || !servs.length) return "";
  const n = Math.min(types.length, servs.length);
  const parts: string[] = [];
  for (let i = 0; i < n; i++) {
    const t = types[i];
    const s = servs[i];
    if (!t || !s) continue;
    parts.push(`${t} x ${s}`);
  }
  return parts.join(", ");
}

// Splits "a|b" at the first top-level pipe (outside brackets/strings), or null.
function splitTopLevelPipe(s: string): [string, string] | null {
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === "[") depth++;
    else if (c === "]") depth = Math.max(0, depth - 1);
    else if (c === "|" && depth === 0) return [s.slice(0, i), s.slice(i + 1)];
  }
  return null;
}

function isStoredNil(v: string): boolean {
  const t = v.trim();
  return !t || t.toLowerCase() === "null" || t === "<nil>";
}

// Coordination id: modificadas-value-format.
// Formats booking_modifications old/new values for the Modificadas tab.
// Arroz changes are stored as `typesJSON|servingsJSON` and are rendered with
// the same "type x N" convention as formatArrozShort; a fully empty pair shows
// as "Sin arroz". Any other value passes through untouched.
export function formatModificationValue(raw: string | null | undefined): string {
  const s = String(raw ?? "").trim();
  if (!s) return "";
  const pair = splitTopLevelPipe(s);
  if (!pair) return s;
  const [leftRaw, rightRaw] = pair.map((p) => p.trim());
  const isJsonSide = (v: string) => isStoredNil(v) || v.startsWith("[");
  if (!isJsonSide(leftRaw) || !isJsonSide(rightRaw)) return s;
  const names = isStoredNil(leftRaw) ? [] : parseJSONArrayOrScalarString(leftRaw);
  const servs = isStoredNil(rightRaw) ? [] : parseJSONArrayOrScalarInt(rightRaw);
  if (!names.length && !servs.length) return "Sin arroz";
  const parts: string[] = [];
  const n = Math.min(names.length, servs.length);
  for (let i = 0; i < n; i++) parts.push(`${names[i]} x ${servs[i]}`);
  for (let i = n; i < names.length; i++) parts.push(names[i]);
  return parts.join(", ");
}

function onlyDigits(s: string): string {
  return String(s || "").replace(/[^0-9]/g, "");
}

export function formatPhone(countryCode: string | null | undefined, national: string | null | undefined): string {
  const cc = onlyDigits(countryCode || "") || "34";
  const num = onlyDigits(national || "");
  if (!num) return "";

  // Spanish: 9-digit grouping.
  const grouped = num.length === 9 ? num.replace(/^(\d{3})(\d{3})(\d{3})$/, "$1 $2 $3") : num;
  return `+${cc} ${grouped}`;
}
