import { useCallback, useRef, useState } from "react";

import type { Vino } from "../../../../../../../../api/types";
import { createClient } from "../../../../../../../../api/client";
import { useToasts } from "../../../../../../../../ui/feedback/useToasts";

export type WineImageState = {
  uploading: boolean;
  generating: boolean;
  imageUrl: string | null;
};

export function useWineImage(vino: Vino | null) {
  const api = useRef(createClient({ baseUrl: "" }));
  const { pushToast } = useToasts();
  const [uploading, setUploading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(
    () => vino?.foto_url ?? vino?.ai_generated_img ?? null,
  );

  const uploadImage = useCallback(
    async (file: File): Promise<string | null> => {
      if (!vino) return null;
      setUploading(true);
      try {
        const res = await api.current.comida.vinos.uploadImage(vino.num, file);
        if (!res.success) {
          pushToast({ kind: "error", title: "Error", message: res.message || "No se pudo subir la imagen" });
          return null;
        }
        const url = (res as any).foto_url as string;
        setImageUrl(url);
        pushToast({ kind: "success", title: "Imagen subida" });
        return url;
      } catch {
        pushToast({ kind: "error", title: "Error", message: "Error subiendo imagen" });
        return null;
      } finally {
        setUploading(false);
      }
    },
    [vino, pushToast],
  );

  const uploadImageAI = useCallback(
    async (file: File): Promise<boolean> => {
      if (!vino) return false;
      setGenerating(true);
      try {
        const res = await api.current.comida.vinos.uploadImageAI(vino.num, file);
        if (!res.success) {
          pushToast({ kind: "error", title: "Error", message: res.message || "No se pudo iniciar la generacion AI" });
          setGenerating(false);
          return false;
        }
        pushToast({ kind: "info", title: "Generando imagen AI..." });
        return true;
      } catch {
        pushToast({ kind: "error", title: "Error", message: "Error iniciando generacion AI" });
        setGenerating(false);
        return false;
      }
    },
    [vino, pushToast],
  );

  const updateFromWS = useCallback((data: { ai_generated_img?: string | null; foto_url?: string }) => {
    if (data.ai_generated_img) {
      setImageUrl(data.ai_generated_img);
    }
    if (data.foto_url) {
      setImageUrl(data.foto_url);
    }
    setGenerating(false);
  }, []);

  const setGeneratingFromWS = useCallback((value: boolean) => {
    setGenerating(value);
  }, []);

  return {
    uploading,
    generating,
    imageUrl,
    uploadImage,
    uploadImageAI,
    updateFromWS,
    setGeneratingFromWS,
    setImageUrl,
  };
}
