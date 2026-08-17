type SessionCheckResult = { success?: boolean; session?: { user?: unknown } };
type SessionCheck = () => Promise<SessionCheckResult>;

function hasSessionUser(result: SessionCheckResult): boolean {
  return result.success === true && typeof result.session?.user === "object" && result.session.user !== null;
}

export async function confirmLoginSession(
  check: SessionCheck,
  options: { retryDelayMs?: number } = {},
): Promise<void> {
  const retryDelayMs = options.retryDelayMs ?? 150;
  let lastError: unknown = new Error("Session could not be confirmed");

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const result = await check();
      if (hasSessionUser(result)) return;
      lastError = new Error("Session could not be confirmed");
    } catch (error) {
      lastError = error;
    }

    if (attempt === 0 && retryDelayMs > 0) {
      await new Promise<void>((resolve) => window.setTimeout(resolve, retryDelayMs));
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Session could not be confirmed");
}
