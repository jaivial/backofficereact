import { createClient } from "../../../../api/client";
import type { MemberInvitationPreview } from "../../../../api/types";

type ApiClient = ReturnType<typeof createClient>;

export function useInvitationValidation(
  api: ApiClient,
  token: string,
  onInvitation: (invitation: MemberInvitationPreview) => void,
  onError: (error: string) => void,
  onDone: () => void,
) {
  let cancelled = false;
  const run = async () => {
    onDone();
    onError("");
    try {
      const res = await api.invitations.validate(token);
      if (cancelled) return;
      if (!res.success) {
        onError(res.message || "Invitación inválida o expirada");
        return;
      }
      onInvitation(res.invitation);
    } catch (err) {
      if (cancelled) return;
      onError(err instanceof Error ? err.message : "Invitación inválida o expirada");
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

export function useOnboardingStart(
  api: ApiClient,
  token: string,
  onError: (error: string) => void,
) {
  const start = async () => {
    onError("");
    try {
      const res = await api.invitations.onboarding.start(token);
      if (!res.success) {
        onError(res.message || "No se pudo iniciar onboarding");
        return;
      }
      window.location.href = `/onboarding/${encodeURIComponent(res.onboardingGuid)}`;
    } catch (err) {
      onError(err instanceof Error ? err.message : "No se pudo iniciar onboarding");
    }
  };
  return start;
}
