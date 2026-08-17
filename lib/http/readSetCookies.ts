function splitCombinedSetCookie(value: string): string[] {
  return value
    .split(/,\s*(?=[^;,=\s]+\s*=)/)
    .map((cookie) => cookie.trim())
    .filter(Boolean);
}

export function readSetCookies(headers: Headers): string[] {
  const getSetCookie = (headers as any).getSetCookie as undefined | (() => string[]);
  if (typeof getSetCookie === "function") {
    const values = getSetCookie.call(headers)
      .filter((value) => typeof value === "string" && value.trim() !== "")
      .flatMap(splitCombinedSetCookie);
    if (values.length > 0) return values;
  }
  const fallback = headers.get("set-cookie");
  if (!fallback || fallback.trim() === "") return [];
  return splitCombinedSetCookie(fallback);
}
