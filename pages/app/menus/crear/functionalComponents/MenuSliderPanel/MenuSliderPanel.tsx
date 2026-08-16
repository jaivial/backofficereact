import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Plus, Sparkles, Trash2 } from "lucide-react";
import { createClient } from "../../../../../../api/client";
import type { MenuSlider, MenuSliderImage, SliderMode } from "../../../../../../api/types";
import { Modal } from "../../../../../../ui/overlays/Modal";
import { ModalHeader } from "../../../../../../ui/overlays/ModalHeader";
import { Select } from "../../../../../../ui/inputs/Select";
import { useToasts } from "../../../../../../ui/feedback/useToasts";
import { buildGroupMenuAIWSURL } from "../../helpers/menuEditor.helpers";

const MODE_OPTIONS = [
  { value: "default", label: "Imagenes por defecto" },
  { value: "custom", label: "Imagenes propias" },
  { value: "both", label: "Por defecto + propias" },
  { value: "hidden", label: "Ocultar slider" },
];

const MAX_GRID = 5; // 5 previews + 1 "add" cell = two rows of 3.
const EMPTY_IMAGES: MenuSliderImage[] = [];

// A pending image the user picked, waiting on the AI-or-raw decision.
type AdvisorDraft = { file: File; previewUrl: string; kb: number };

export type SliderPreviewState = {
  mode: SliderMode;
  images: string[];
};

export function deriveSliderPreview(slider: MenuSlider | null | undefined): SliderPreviewState {
  const allImages = slider?.images ?? EMPTY_IMAGES;
  const mode = slider?.mode ?? "default";
  const images = mode === "default" ? allImages.filter((image) => image.is_default)
    : mode === "custom" ? allImages.filter((image) => !image.is_default)
    : mode === "hidden" ? EMPTY_IMAGES
    : allImages;
  return { mode, images: images.map((image) => image.image_url) };
}

export function MenuSliderPanel({
  menuId,
  initialSlider = null,
  onSliderChange,
}: {
  menuId: number | null;
  initialSlider?: MenuSlider | null;
  onSliderChange?: (slider: SliderPreviewState) => void;
}) {
  const api = useRef(createClient({ baseUrl: "" })).current;
  const { pushToast } = useToasts();
  const [slider, setSlider] = useState<MenuSlider | null>(initialSlider);
  const [pendingGeneration, setPendingGeneration] = useState<string | null>(null);
  const [recentImageID, setRecentImageID] = useState<number | null>(null);
  const pendingGenerationRef = useRef<string | null>(null);
  const [seeAll, setSeeAll] = useState(false);
  const [advisor, setAdvisor] = useState<AdvisorDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const load = useCallback(async () => {
    if (!menuId) return;
    const res = await api.menus.gruposV2.getSlider(menuId);
    if (res.success) setSlider(res.slider);
  }, [api, menuId]);

  useEffect(() => {
    // The SSR `+data.ts` already fetches the slider and passes it as
    // `initialSlider`. Re-fetching on mount is a redundant round-trip for
    // every page load; a fresh copy is only needed after AI/upload/delete
    // actions, which call `load()` directly.
    if (initialSlider) return;
    void load();
  }, [initialSlider, load]);

  const preview = useMemo(() => deriveSliderPreview(slider), [slider]);
  const allImages = slider?.images ?? EMPTY_IMAGES;
  const mode = preview.mode;
  const aiEnabled = slider?.ai_enabled ?? false;
  const images = useMemo(
    () => mode === "default" ? allImages.filter((i) => i.is_default)
      : mode === "custom" ? allImages.filter((i) => !i.is_default)
      : mode === "hidden" ? EMPTY_IMAGES
      : allImages,
    [allImages, mode],
  );

  useEffect(() => {
    onSliderChange?.(preview);
  }, [onSliderChange, preview]);

  useEffect(() => {
    pendingGenerationRef.current = pendingGeneration;
  }, [pendingGeneration]);

  useEffect(() => {
    if (!menuId) return;
    let socket: WebSocket | null = null;
    let disposed = false;

    const connect = () => {
      if (disposed) return;
      socket = new WebSocket(buildGroupMenuAIWSURL(menuId));
      socket.addEventListener("message", (event) => {
        let payload: Record<string, unknown>;
        try { payload = JSON.parse(String(event.data ?? "")) as Record<string, unknown>; } catch { return; }
        const generationID = String(payload.generation_id ?? "");
        if (!generationID || generationID !== pendingGenerationRef.current) return;
        const type = String(payload.type ?? "").toLowerCase();
        if (type === "slider_image_completed") {
          const completed = payload.image as Partial<MenuSliderImage> | undefined;
          if (completed?.id && completed.image_url) {
            setSlider((current) => current ? {
              ...current,
              mode: current.mode === "default" || current.mode === "hidden" ? "both" : current.mode,
              images: [...current.images.filter((image) => image.id !== completed.id), completed as MenuSliderImage],
            } : current);
            setRecentImageID(Number(completed.id));
          }
          setPendingGeneration(null);
          void load();
        }
        if (type === "slider_image_failed") {
          setPendingGeneration(null);
          pushToast({ kind: "error", title: "IA", message: String(payload.message ?? "No se pudo mejorar la imagen") });
        }
      });
      socket.addEventListener("close", () => { if (!disposed) window.setTimeout(connect, 1000); });
    };
    connect();
    return () => { disposed = true; socket?.close(); };
  }, [load, menuId, pushToast]);

  const changeMode = async (next: string) => {
    if (!menuId) return;
    setSlider((s) => (s ? { ...s, mode: next as SliderMode } : s));
    await api.menus.gruposV2.patchSlider(menuId, next as SliderMode);
  };

  const openPicker = () => fileInputRef.current?.click();

  const onFile = (ev: React.ChangeEvent<HTMLInputElement>) => {
    const file = ev.target.files?.[0];
    ev.target.value = "";
    if (!file) return;
    // Swap the draft (fade-out/fade-in handled by Modal's AnimatePresence when
    // one is already open — no unmount gap because `advisor` stays truthy).
    const previewUrl = URL.createObjectURL(file);
    setAdvisor((prev) => {
      if (prev) URL.revokeObjectURL(prev.previewUrl);
      return { file, previewUrl, kb: Math.round(file.size / 1024) };
    });
  };

  const closeAdvisor = () => {
    setAdvisor((prev) => {
      if (prev) URL.revokeObjectURL(prev.previewUrl);
      return null;
    });
  };

  const uploadRaw = async () => {
    if (!menuId || !advisor) return;
    setBusy(true);
    const res = await api.menus.gruposV2.uploadSliderImage(menuId, advisor.file);
    setBusy(false);
    if (res.success) {
      closeAdvisor();
      await load();
    }
  };

  const improveWithAI = async () => {
    if (!menuId || !advisor) return;
    setBusy(true);
    const generationID = crypto.randomUUID();
    setPendingGeneration(generationID);
    const res = await api.menus.gruposV2.generateSliderAIImage(menuId, advisor.file, generationID);
    setBusy(false);
    if (!res.success) {
      setPendingGeneration(null);
      pushToast({ kind: "error", title: "IA", message: res.message || "No se pudo iniciar la mejora con IA" });
      return;
    }
    closeAdvisor();
  };

  const removeImage = async (img: MenuSliderImage) => {
    if (!menuId) return;
    const res = await api.menus.gruposV2.deleteSliderImage(menuId, img.id);
    if (res.success) await load();
  };

  if (!menuId) {
    return (
      <div className="bo-field" data-slot="sliderPanel-field">
        <div className="bo-label" data-slot="sliderPanel-label">Slider de imagenes</div>
        <p className="bo-mutedText">Guarda el menu para configurar el slider.</p>
      </div>
    );
  }

  const recentImage = recentImageID ? images.find((image) => image.id === recentImageID) : undefined;
  const gridCells = recentImage && images.length > MAX_GRID
    ? [...images.filter((image) => image.id !== recentImage.id).slice(0, MAX_GRID - 1), recentImage]
    : images.slice(0, MAX_GRID);
  const hasMore = images.length > MAX_GRID;

  const renderCell = (img: MenuSliderImage) => (
    <div key={img.id} className="bo-sliderCell" data-slot="sliderPanel-cell">
      <img className="bo-sliderThumb" src={img.image_url} alt="" loading="lazy" />
      <button
        type="button"
        className="bo-sliderDelete"
        aria-label="Eliminar imagen"
        onClick={() => void removeImage(img)}
        data-testid="slider-delete"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );

  const addCell = (key: string) => (
    <button
      key={key}
      type="button"
      className="bo-sliderCell bo-sliderAddCell"
      onClick={openPicker}
      aria-label="Añadir imagen"
      data-testid="slider-add"
    >
      <Plus size={20} />
    </button>
  );

  const pendingCell = (
    <div key="pending" className="bo-sliderCell bo-sliderPendingCell" role="status" aria-label="Mejorando imagen con IA" data-testid="slider-ai-skeleton">
      <Sparkles size={18} />
      <span>Mejorando...</span>
    </div>
  );

  return (
    <div className="bo-field" data-slot="sliderPanel-field">
      <div className="bo-label" data-slot="sliderPanel-label">Slider de imagenes</div>
      <Select
        className="bo-menuSettingSelect"
        value={mode}
        onChange={changeMode}
        options={MODE_OPTIONS}
        size="sm"
        ariaLabel="Modo del slider de imagenes"
        data-testid="slider-mode-select"
      />

      {mode !== "hidden" ? (
        <>
          <div className="bo-sliderGrid" data-slot="sliderPanel-grid">
            {gridCells.map(renderCell)}
            {pendingGeneration ? pendingCell : addCell("add")}
          </div>
          {hasMore ? (
            <button
              type="button"
              className="bo-btn bo-btn--ghost bo-btn--sm"
              onClick={() => setSeeAll(true)}
              data-testid="slider-see-all"
            >
              Ver todas ({images.length})
            </button>
          ) : null}
        </>
      ) : null}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={onFile}
        data-testid="slider-file-input"
      />

      {/* Ver todas — full grid in the reused glass modal. */}
      <Modal open={seeAll} title="Imagenes del slider" onClose={() => setSeeAll(false)} widthPx={640} hideClose>
        <ModalHeader title="Imagenes del slider" onClose={() => setSeeAll(false)} />
        <div className="bo-modalBody">
          <div className="bo-sliderGrid bo-sliderGrid--all" data-slot="sliderPanel-allGrid">
            {images.map(renderCell)}
            {addCell("add-all")}
          </div>
        </div>
      </Modal>

      {/* AI advisor — same modal as "Asesor IA de imagen". */}
      <Modal
        open={!!advisor}
        title="Asesor IA de imagen"
        onClose={busy ? () => undefined : closeAdvisor}
        widthPx={620}
        hideClose
      >
        <ModalHeader title="Asesor IA de imagen" onClose={busy ? () => undefined : closeAdvisor} />
        <div className="bo-modalBody bo-dishAIAdvisorBody">
          <div className="bo-dishAIAdvisorCopy">
            <p className="bo-dishAIAdvisorLead">
              Mejorar esta imagen con IA la adapta al formato 16:9 del slider y eleva la presentacion de tu menu.
            </p>
            <p className="bo-dishAIAdvisorHint">Imagen: {Math.max(1, advisor?.kb ?? 0)}KB.</p>
          </div>
          {advisor ? (
            <div className="bo-dishAIAdvisorPreviewWrap">
              <img className="bo-dishAIAdvisorPreview" src={advisor.previewUrl} alt="Previsualizacion" />
            </div>
          ) : null}
        </div>
        <div className="bo-modalActions bo-dishAIAdvisorActions">
          <button
            className="bo-btn bo-btn--advisorSecondary"
            type="button"
            onClick={() => void uploadRaw()}
            disabled={busy}
            data-testid="slider-advisor-continue-without-ai"
          >
            Continuar sin mejorar
          </button>
          {aiEnabled ? (
            <button
              className="bo-btn bo-btn--advisorPrimary"
              type="button"
              onClick={() => void improveWithAI()}
              disabled={busy}
              data-testid="slider-advisor-improve-with-ai"
            >
              <Sparkles size={15} />
              <span>{busy ? "Mejorando con IA..." : "Mejorar con IA"}</span>
            </button>
          ) : null}
        </div>
      </Modal>
    </div>
  );
}
