import React from "react";

import { cn } from "../shadcn/utils";

/**
 * Renders a standalone SVG document produced by `buildTemplateSvg`
 * (`lib/qr/templates.ts`).
 *
 * Coordination point: `qr-templates:frame` — the responsive wrapper around the
 * injected SVG document. The SVG itself publishes `qr-templates:svg`.
 */
export function QrTemplateFrame(props: {
  svg: string;
  className?: string;
  "data-testid"?: string;
  "data-ui"?: string;
}): React.ReactElement {
  const { svg, className } = props;
  const testId = props["data-testid"] ?? "qr-template-frame";
  const dataUi = props["data-ui"] ?? "qr-template-frame";

  return (
    <div
      className={cn(
        "block w-full leading-none [&>svg]:block [&>svg]:h-auto [&>svg]:max-w-full",
        className,
      )}
      style={{ maxWidth: "100%" }}
      data-testid={testId}
      data-ui={dataUi}
      data-slot="qr-template-frame"
      data-coord-id="qr-templates:frame"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
