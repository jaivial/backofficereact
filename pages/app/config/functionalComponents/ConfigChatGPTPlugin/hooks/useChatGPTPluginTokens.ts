import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "../../../../../../api/client";
import type { ChatGPTPluginToken } from "../../../../../../api/types";

export type UseChatGPTPluginTokensReturn = {
  tokens: ChatGPTPluginToken[];
  manifestUrl: string;
  label: string;
  setLabel: (v: string) => void;
  issuedToken: string;
  clearIssuedToken: () => void;
  load: () => Promise<void>;
  issue: () => Promise<boolean>;
  revoke: () => Promise<number>;
  loaded: boolean;
  busy: boolean;
  error: string | null;
};

export function useChatGPTPluginTokens(): UseChatGPTPluginTokensReturn {
  const api = useMemo(() => createClient({ baseUrl: "" }), []);
  const [tokens, setTokens] = useState<ChatGPTPluginToken[]>([]);
  const [manifestUrl, setManifestUrl] = useState("");
  const [label, setLabel] = useState("");
  const [issuedToken, setIssuedToken] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await api.config.getChatGPTPluginTokens();
      if (res.success) {
        setTokens(res.tokens ?? []);
        setManifestUrl(res.manifest_url ?? "");
        setError(null);
      } else {
        setError(res.message ?? "No se pudieron cargar los tokens");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron cargar los tokens");
    } finally {
      setLoaded(true);
    }
  }, [api.config]);

  useEffect(() => {
    void load();
  }, [load]);

  const issue = useCallback(async (): Promise<boolean> => {
    setBusy(true);
    try {
      const res = await api.config.issueChatGPTPluginToken({ label: label.trim() });
      if (!res.success) {
        setError(res.message ?? "No se pudo crear el token");
        return false;
      }
      // The secret is shown once and then cleared from state: the server keeps
      // only a digest, so it can never be displayed again.
      setIssuedToken(res.token);
      setLabel("");
      setError(null);
      await load();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear el token");
      return false;
    } finally {
      setBusy(false);
    }
  }, [api.config, label, load]);

  const revoke = useCallback(async (): Promise<number> => {
    setBusy(true);
    try {
      const res = await api.config.revokeChatGPTPluginTokens();
      if (!res.success) {
        setError(res.message ?? "No se pudieron revocar los tokens");
        return 0;
      }
      setError(null);
      await load();
      return res.revoked ?? 0;
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron revocar los tokens");
      return 0;
    } finally {
      setBusy(false);
    }
  }, [api.config, load]);

  return {
    tokens, manifestUrl, label, setLabel, issuedToken, clearIssuedToken: useCallback(() => setIssuedToken(""), []),
    load, issue, revoke, loaded, busy, error,
  };
}
