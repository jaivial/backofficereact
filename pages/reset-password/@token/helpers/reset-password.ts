import { createClient } from "../../../../api/client";
import type { PasswordResetPreview } from "../../../../api/types";

type ApiClient = ReturnType<typeof createClient>;

export function usePasswordResetValidation(
  api: ApiClient,
  token: string,
  onPreview: (preview: PasswordResetPreview) => void,
  onError: (error: string) => void,
  onDone: () => void,
) {
  let cancelled = false;
  const run = async () => {
    onDone();
    onError("");
    try {
      const res = await api.passwordResets.validate(token);
      if (cancelled) return;
      if (!res.success) {
        onError(res.message || "Token inválido o expirado");
        return;
      }
      onPreview(res.reset);
    } catch (err) {
      if (cancelled) return;
      onError(err instanceof Error ? err.message : "Token inválido o expirado");
    } finally {
      if (!cancelled) onDone();
    }
  };

  if (!token) {
    onError("Token inválido");
    onDone();
    return;
  }

  void run();
  return () => {
    cancelled = true;
  };
}

export function usePasswordResetSubmit(
  api: ApiClient,
  token: string,
  onError: (error: string) => void,
  onDone: () => void,
) {
  const submit = async (password: string, confirmPassword: string) => {
    onError("");
    try {
      const res = await api.passwordResets.confirm(token, password, confirmPassword);
      if (!res.success) {
        onError(res.message || "No se pudo restablecer");
        return;
      }
      onDone();
    } catch (err) {
      onError(err instanceof Error ? err.message : "No se pudo restablecer");
    }
  };

  return submit;
}
