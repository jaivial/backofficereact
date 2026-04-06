import React from "react";

export type MenuPublishPanelProps = {
  isDraft: boolean;
  busy: boolean;
  onPublish: () => Promise<void>;
};

export function MenuPublishPanel({ isDraft, busy, onPublish }: MenuPublishPanelProps) {
  if (!isDraft) return null;
  return (
    <div className="bo-menuWizardActions bo-menuWizardActions--publishDraft" data-publish-panel="true">
      <button
        className="bo-btn bo-btn--primary"
        type="button"
        disabled={busy}
        onClick={() => void onPublish()}
      >
        {busy ? "Publicando..." : "Publicar borrador"}
      </button>
    </div>
  );
}
