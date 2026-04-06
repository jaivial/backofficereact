import { useAtomValue, useSetAtom } from "jotai";
import { useMemo, useState } from "react";

import { createClient } from "../../api/client";
import { sessionAtom } from "../../state/atoms";
import { useErrorToast } from "../../ui/feedback/useErrorToast";
import { createChangePasswordHandler } from "./helpers/onSubmit";

export default function ChangePasswordPage() {
  const api = useMemo(() => createClient({ baseUrl: "" }), []);
  const session = useAtomValue(sessionAtom);
  const setSession = useSetAtom(sessionAtom);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useErrorToast(error);

  const onSubmit = createChangePasswordHandler({
    api,
    password,
    confirmPassword,
    session,
    setSession,
    setError,
    setBusy,
  });

  return (
    <div className="bo-stage" data-ui="change-password-stage">
      <div className="bo-window bo-window--auth" data-ui="change-password-window">
        <div className="bo-authCard" role="main" aria-label="Cambiar password" data-ui="change-password-card">
          <div className="bo-title" data-ui="change-password-title">Actualizar password</div>
          <div className="bo-authSub" data-ui="change-password-subtitle">
            Debes establecer una nueva password para continuar.
          </div>

          <form onSubmit={onSubmit} className="bo-form" data-ui="change-password-form">
            <label className="bo-field" data-ui="change-password-field-password">
              <div className="bo-label" data-ui="change-password-label-password">Nueva password</div>
              <input
                className="bo-input"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                data-ui="change-password-input-password"
              />
            </label>

            <label className="bo-field" data-ui="change-password-field-confirm">
              <div className="bo-label" data-ui="change-password-label-confirm">Repetir password</div>
              <input
                className="bo-input"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                data-ui="change-password-input-confirm"
              />
            </label>

            <button
              className="bo-btn bo-btn--primary"
              type="submit"
              disabled={busy}
              data-ui="change-password-submit"
            >
              {busy ? "Guardando..." : "Confirmar"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
