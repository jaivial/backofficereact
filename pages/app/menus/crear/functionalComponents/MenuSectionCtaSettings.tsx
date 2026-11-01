import React, { useMemo, useState } from "react";

import { createClient } from "../../../../../api/client";
import type { MenuSectionCta, MenuSectionCtaTarget } from "../../../../../api/types";
import { AutosaveInput } from "../../../../../ui/inputs/AutosaveInput";
import { Select } from "../../../../../ui/inputs/Select";
import { Switch } from "../../../../../ui/shadcn/Switch";
import { useToasts } from "../../../../../ui/feedback/useToasts";
import type { EditorSection } from "../types/menuEditor.types";

// Coordination id: menu_section_cta_v1
// Menu settings > "Botón en sección": an optional button under any dish
// section of the public menu, pointing at a whitelisted public route. Saved per
// section (PUT /admin/group-menus-v2/{id}/sections/{sectionId}/cta).

const TARGET_OPTIONS: Array<{ value: MenuSectionCtaTarget; label: string; defaultLabel: string }> = [
  { value: "cafes", label: "Carta de cafés (/cafes)", defaultLabel: "Ver carta de cafés" },
];

const emptyCta = (): MenuSectionCta => ({ enabled: false, label: TARGET_OPTIONS[0].defaultLabel, target: TARGET_OPTIONS[0].value });

export function MenuSectionCtaSettings({
  menuId,
  sections,
  onSectionCtaSaved,
}: {
  menuId: number | null;
  sections: EditorSection[];
  onSectionCtaSaved: (sectionId: number, cta: MenuSectionCta) => void;
}) {
  const api = useMemo(() => createClient({ baseUrl: "" }), []);
  const { pushToast } = useToasts();
  const [drafts, setDrafts] = useState<Record<number, MenuSectionCta>>({});
  const [savingId, setSavingId] = useState<number | null>(null);
  const persisted = sections.filter((section): section is EditorSection & { id: number } => typeof section.id === "number" && section.id > 0);

  if (!menuId || persisted.length === 0) return null;

  const current = (section: EditorSection & { id: number }): MenuSectionCta => drafts[section.id] ?? section.cta ?? emptyCta();

  const save = async (sectionId: number, next: MenuSectionCta) => {
    setSavingId(sectionId);
    try {
      const res = await api.menus.gruposV2.putSectionCta(menuId, sectionId, next);
      if (!res.success) {
        pushToast({ kind: "error", title: "Error", message: res.message || "No se pudo guardar el botón" });
        return;
      }
      onSectionCtaSaved(sectionId, res.cta);
      setDrafts((prev) => {
        const copy = { ...prev };
        delete copy[sectionId];
        return copy;
      });
      pushToast({ kind: "success", title: next.enabled ? "Botón guardado" : "Botón desactivado" });
    } catch {
      pushToast({ kind: "error", title: "Error", message: "Error de conexión" });
    } finally {
      setSavingId(null);
    }
  };

  return (
    <section className="bo-menuConfigSection" data-testid="menu-section-cta-panel" data-coordination-id="menu_section_cta_v1">
      <div className="bo-menuConfigSectionHead" data-testid="menu-section-cta-head">
        <div data-testid="menu-section-cta-head-copy">
          <h2 className="bo-panelTitle" data-testid="menu-section-cta-title">Botón en sección</h2>
          <p className="bo-panelMeta" data-testid="menu-section-cta-help">Añade un botón bajo una sección del menú en la web, con el destino que elijas.</p>
        </div>
      </div>
      <div className="bo-menuConfigSectionBody bo-form" data-testid="menu-section-cta-body">
        {persisted.map((section) => {
          const cta = current(section);
          const dirty = Boolean(drafts[section.id]);
          const busy = savingId === section.id;
          const name = section.displayTitle || section.title || `Sección ${section.id}`;
          return (
            <div className="bo-field bo-field--full bo-sectionCtaRow" key={section.id} data-testid={`menu-section-cta-row-${section.id}`}>
              <div className="flex items-center justify-between gap-2" data-testid={`menu-section-cta-row-head-${section.id}`}>
                <span className="bo-label" data-testid={`menu-section-cta-section-name-${section.id}`}>{name}</span>
                <Switch
                  checked={cta.enabled}
                  disabled={busy}
                  onCheckedChange={(enabled) => void save(section.id, { ...cta, enabled })}
                  aria-label={`Mostrar botón en ${name}`}
                  data-testid={`menu-section-cta-switch-${section.id}`}
                />
              </div>
              {cta.enabled ? (
                <div className="bo-stackFields" data-testid={`menu-section-cta-fields-${section.id}`}>
                  <Select
                    value={cta.target}
                    options={TARGET_OPTIONS.map(({ value, label }) => ({ value, label }))}
                    disabled={busy}
                    ariaLabel="Destino del botón"
                    onChange={(value) => setDrafts((prev) => ({ ...prev, [section.id]: { ...cta, target: value as MenuSectionCtaTarget } }))}
                    data-testid={`menu-section-cta-target-${section.id}`}
                  />
                  <AutosaveInput
                    className="bo-input"
                    value={cta.label}
                    disabled={busy}
                    maxLength={80}
                    placeholder="Texto del botón"
                    onChange={(e) => setDrafts((prev) => ({ ...prev, [section.id]: { ...cta, label: e.target.value } }))}
                    data-testid={`menu-section-cta-label-${section.id}`}
                  />
                  <button
                    className="bo-btn bo-btn--primary bo-btn--sm"
                    type="button"
                    disabled={busy || !dirty}
                    onClick={() => void save(section.id, cta)}
                    data-testid={`menu-section-cta-save-${section.id}`}
                  >
                    {busy ? "Guardando…" : "Guardar botón"}
                  </button>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
