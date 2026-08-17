type RequestHeaders = Record<string, string | string[] | undefined>;

type RequestLike = {
  headers?: RequestHeaders;
  socket?: unknown;
};

function firstHeaderValue(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value;
  return typeof raw === "string" ? raw.split(",", 1)[0].trim().toLowerCase() : "";
}

/**
 * Resolve the public request scheme before proxying to the backend.
 *
 * The backoffice process can sit behind Cloudflare/nginx, so the backend must
 * not infer the scheme from the internal hop. The deployment proxy is the
 * trusted source of forwarded headers; direct local TLS remains supported.
 */
export function requestScheme(req: RequestLike): "http" | "https" {
  const cfVisitor = firstHeaderValue(req.headers?.["cf-visitor"]);
  if (cfVisitor) {
    try {
      const parsed = JSON.parse(cfVisitor) as { scheme?: unknown };
      if (parsed.scheme === "http" || parsed.scheme === "https") return parsed.scheme;
    } catch {
      // Ignore malformed proxy metadata and continue with the next signal.
    }
  }

  const forwarded = firstHeaderValue(req.headers?.["x-forwarded-proto"]);
  if (forwarded === "http" || forwarded === "https") return forwarded;

  const socket = req.socket as { encrypted?: boolean | null } | undefined;
  return socket?.encrypted ? "https" : "http";
}
