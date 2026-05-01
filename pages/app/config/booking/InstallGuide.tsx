import React, { useCallback, useState } from "react";
import { Check, Copy } from "lucide-react";
import { useToasts } from "../../../../ui/feedback/useToasts";

const CDN_BASE = "https://cdn.newvillacarmen.com/booking-widget";
const SCRIPT_TAG = (restaurantId: string) =>
  `<script src="${CDN_BASE}/booking-widget.iife.js" data-restaurant-id="${restaurantId}" async></script>`;
const SHORTCODE = (restaurantId: string) => `[booking_widget restaurant_id="${restaurantId}"]`;

type Step = {
  title: string;
  description: string;
  code: string;
};

const STEPS = (restaurantId: string): Step[] => [
  {
    title: "1. Añade el script a tu web",
    description: "Copia y pega este código en el <head> o antes del cierre </body> de tu página HTML.",
    code: SCRIPT_TAG(restaurantId),
  },
  {
    title: "2. Coloca el widget donde quieras",
    description: "Añade esta etiqueta donde quieres que aparezca el calendario de reservas.",
    code: `<div id="vc-booking-widget" data-restaurant-id="${restaurantId}"></div>`,
  },
  {
    title: "3. WordPress / CMS",
    description: "Si usas WordPress, puedes usar este shortcode en cualquier entrada o página.",
    code: SHORTCODE(restaurantId),
  },
];

function CopyButton({ code }: { code: string }) {
  const { pushToast } = useToasts();
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      pushToast({ kind: "success", title: "Copiado", message: "Código copiado al portapapeles" });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      pushToast({ kind: "error", title: "Error", message: "No se pudo copiar" });
    }
  }, [code, pushToast]);

  return (
    <button
      type="button"
      className="bo-btn bo-btn--ghost bo-btn--sm"
      onClick={handleCopy}
      aria-label="Copiar código"
      data-ui="install-copy-btn"
    >
      {copied ? <Check size={14} data-ui="install-copy-icon-check" /> : <Copy size={14} data-ui="install-copy-icon" />}
    </button>
  );
}

export function InstallGuide({ restaurantId }: { restaurantId: string }) {
  const steps = STEPS(restaurantId);

  return (
    <div className="bo-install-guide" data-ui="install-guide">
      {steps.map((step, index) => (
        <div key={index} className="bo-install-step" data-ui="install-step">
          <div className="bo-install-stepHead" data-ui="install-step-head">
            <div className="bo-install-stepTitle" data-ui="install-step-title">
              {step.title}
            </div>
            <div className="bo-install-stepMeta" data-ui="install-step-meta">
              {step.description}
            </div>
          </div>
          <div className="bo-install-codeBlock" data-ui="install-code-block">
            <pre className="bo-install-code" data-ui="install-code">
              <code data-ui="install-code-content">{step.code}</code>
            </pre>
            <CopyButton code={step.code} />
          </div>
        </div>
      ))}

      <div className="bo-install-note" data-ui="install-note">
        <div className="bo-install-noteLabel" data-ui="install-note-label">
          Nota
        </div>
        <div className="bo-install-noteText" data-ui="install-note-text">
          El widget se adapta automáticamente al ancho del contenedor donde lo coloques. Para mejores resultados,
          usa un contenedor de al menos 320px de ancho.
        </div>
      </div>
    </div>
  );
}
