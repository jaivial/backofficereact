import { useCallback, useMemo, useState } from "react";

import { createClient } from "../../../../../api/client";
import type { LegalPage, LegalPageSlug, LegalPageSummary, LegalPageUpsertRequest } from "../../../../../api/types";

type UseLegalPagesListReturn = {
  pages: LegalPageSummary[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
};

export function useLegalPagesList(): UseLegalPagesListReturn {
  const api = useMemo(() => createClient({ baseUrl: "" }), []);
  const [pages, setPages] = useState<LegalPageSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.legalPages.list();
      if (res.success) {
        setPages(res.pages || []);
      } else {
        setError(res.message || "Error cargando páginas legales");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error cargando páginas legales");
    } finally {
      setLoading(false);
    }
  }, [api.legalPages]);

  return { pages, loading, error, reload };
}

type UseLegalPageReturn = {
  page: LegalPage | null;
  loading: boolean;
  error: string | null;
  saving: boolean;
  load: () => Promise<void>;
  save: (body: LegalPageUpsertRequest) => Promise<boolean>;
};

export function useLegalPage(slug: LegalPageSlug): UseLegalPageReturn {
  const api = useMemo(() => createClient({ baseUrl: "" }), []);
  const [page, setPage] = useState<LegalPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.legalPages.get(slug);
      if (res.success) {
        setPage(res.page);
      } else {
        setError(res.message || "Error cargando la página legal");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error cargando la página legal");
    } finally {
      setLoading(false);
    }
  }, [api.legalPages, slug]);

  const save = useCallback(
    async (body: LegalPageUpsertRequest): Promise<boolean> => {
      setSaving(true);
      setError(null);
      try {
        const res = await api.legalPages.upsert(slug, body);
        if (!res.success) {
          setError(res.message || "Error guardando la página legal");
          return false;
        }
        setPage((prev) => (prev ? { ...prev, ...body } : prev));
        return true;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error guardando la página legal");
        return false;
      } finally {
        setSaving(false);
      }
    },
    [api.legalPages, slug],
  );

  return { page, loading, error, saving, load, save };
}
