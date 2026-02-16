import React, { useCallback, useRef, useState } from "react";

type ImageDropInputProps = {
  className?: string;
  accept?: string;
  disabled?: boolean;
  ariaLabel?: string;
  onSelectFile: (file: File) => void | Promise<void>;
  children: React.ReactNode;
};

export function ImageDropInput({
  className,
  accept = "image/*",
  disabled,
  ariaLabel = "Subir imagen",
  onSelectFile,
  children,
}: ImageDropInputProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = useState(false);

  const pickFile = useCallback(() => {
    if (disabled) return;
    inputRef.current?.click();
  }, [disabled]);

  const pushFile = useCallback(
    (file: File | null | undefined) => {
      if (!file || disabled) return;
      void onSelectFile(file);
    },
    [disabled, onSelectFile],
  );

  return (
    <div
      className={["bo-imageDropInput", dragging ? "is-dragging" : "", disabled ? "is-disabled" : "", className].filter(Boolean).join(" ")}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-label={ariaLabel}
      onClick={pickFile}
      onKeyDown={(ev) => {
        if (disabled) return;
        if (ev.key === "Enter" || ev.key === " ") {
          ev.preventDefault();
          pickFile();
        }
      }}
      onDragEnter={(ev) => {
        if (disabled) return;
        ev.preventDefault();
        setDragging(true);
      }}
      onDragOver={(ev) => {
        if (disabled) return;
        ev.preventDefault();
        if (ev.dataTransfer) ev.dataTransfer.dropEffect = "copy";
        setDragging(true);
      }}
      onDragLeave={(ev) => {
        if (disabled) return;
        ev.preventDefault();
        const nextTarget = ev.relatedTarget as Node | null;
        if (!nextTarget || !ev.currentTarget.contains(nextTarget)) {
          setDragging(false);
        }
      }}
      onDrop={(ev) => {
        if (disabled) return;
        ev.preventDefault();
        setDragging(false);
        const file = ev.dataTransfer?.files?.[0] ?? null;
        pushFile(file);
      }}
    >
      {children}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        tabIndex={-1}
        style={{ display: "none" }}
        onChange={(ev) => {
          const file = ev.target.files?.[0] ?? null;
          pushFile(file);
          ev.currentTarget.value = "";
        }}
      />
    </div>
  );
}
