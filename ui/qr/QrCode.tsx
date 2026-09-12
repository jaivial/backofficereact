import React, { useEffect, useState } from "react";

import {
  QR_CORE_COORD_ID,
  sanitizeQrValue,
  toDataUrl,
  type QrErrorCorrection,
} from "../../lib/qr/core";

export type QrCodeProps = {
  value: string;
  size?: number;
  margin?: number;
  errorCorrectionLevel?: QrErrorCorrection;
  dark?: string;
  light?: string;
  className?: string;
  alt?: string;
  "data-testid"?: string;
  "data-ui"?: string;
};

const DEFAULT_QR_SIZE = 512;

export function QrCode({
  value,
  size = DEFAULT_QR_SIZE,
  margin,
  errorCorrectionLevel,
  dark,
  light,
  className,
  alt = "",
  "data-testid": testId = "qr-code-image",
  "data-ui": dataUi,
}: QrCodeProps): React.ReactElement {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const sanitized = sanitizeQrValue(value);

  useEffect(() => {
    if (!sanitized) {
      setDataUrl(null);
      return;
    }

    let active = true;
    setDataUrl(null);
    toDataUrl(sanitized, { size, margin, errorCorrectionLevel, dark, light })
      .then((url) => {
        if (active) setDataUrl(url);
      })
      .catch(() => {
        if (active) setDataUrl(null);
      });

    return () => {
      active = false;
    };
  }, [sanitized, size, margin, errorCorrectionLevel, dark, light]);

  const box = { width: size, height: size };

  if (!dataUrl) {
    return (
      <div
        className={className}
        style={box}
        role="img"
        aria-label={alt}
        data-testid={`${testId}-placeholder`}
        data-ui={dataUi ? `${dataUi}-placeholder` : undefined}
        data-coord-id={`${QR_CORE_COORD_ID}:pending`}
        data-observe="qr-code-pending"
      />
    );
  }

  return (
    <img
      src={dataUrl}
      alt={alt}
      width={size}
      height={size}
      className={className}
      style={box}
      data-testid={testId}
      data-ui={dataUi}
      data-coord-id={QR_CORE_COORD_ID}
      data-observe="qr-code-image"
    />
  );
}
