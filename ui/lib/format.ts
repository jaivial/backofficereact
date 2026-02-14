export function formatHHMM(t: string | null | undefined): string {
  if (!t) return "";
  const s = String(t).trim();
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

