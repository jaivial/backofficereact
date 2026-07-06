import { useCallback, useMemo, useState } from "react";

import { createClient } from "../../../../../../api/client";
import type { RestaurantBranding } from "../../../../../../api/types";

function defaultBranding(): RestaurantBranding {
  return {
    brandName: "",
    logoUrl: "",
    primaryColor: "",
    accentColor: "",
    emailFromName: "",
    emailFromAddress: "",
  };
}

type UseBrandingReturn = {
  branding: RestaurantBranding;
  setField: <K extends keyof RestaurantBranding>(key: K, value: RestaurantBranding[K]) => void;
  save: () => Promise<boolean>;
  load: () => Promise<void>;
  uploadLogo: (file: File) => Promise<string | null>;
  uploading: boolean;
  saving: boolean;
  loaded: boolean;
};

export function useBranding(): UseBrandingReturn {
  const api = useMemo(() => createClient({ baseUrl: "" }), []);
  const [branding, setBranding] = useState<RestaurantBranding>(defaultBranding());
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const setField = useCallback(
    <K extends keyof RestaurantBranding>(key: K, value: RestaurantBranding[K]) => {
      setBranding((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const load = useCallback(async () => {
    try {
      const res = await api.settings.getBranding();
      if (res.success) {
        setBranding(res.branding);
      }
    } catch {
      // keep defaults on error
    }
    setLoaded(true);
  }, [api.settings]);

  const save = useCallback(async (): Promise<boolean> => {
    setSaving(true);
    try {
      const res = await api.settings.setBranding(branding);
      if (!res.success) return false;
      setBranding(res.branding);
      return true;
    } catch {
      return false;
    } finally {
      setSaving(false);
    }
  }, [api.settings, branding]);

  const uploadLogo = useCallback(
    async (file: File): Promise<string | null> => {
      setUploading(true);
      try {
        const res = await api.settings.uploadBrandingLogo(file);
        if (!res.success) return null;
        setBranding((prev) => ({ ...prev, logoUrl: res.logoUrl }));
        return res.logoUrl;
      } catch {
        return null;
      } finally {
        setUploading(false);
      }
    },
    [api.settings],
  );

  return { branding, setField, save, load, uploadLogo, uploading, saving, loaded };
}