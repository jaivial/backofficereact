import React, { type HTMLAttributes, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "../shadcn/utils";

type ModalHeaderProps = Omit<HTMLAttributes<HTMLDivElement>, "title"> & {
  title: ReactNode;
  onClose: () => void;
  closeLabel?: string;
};

export function ModalHeader({
  title,
  onClose,
  closeLabel = "Cerrar",
  className,
  ...rest
}: ModalHeaderProps) {
  return (
    <div className={cn("bo-modalHead", className)} {...rest}>
      <div className="bo-modalTitle">{title}</div>
      <button className="bo-modalX" type="button" onClick={onClose} aria-label={closeLabel}>
        <X size={18} strokeWidth={1.8} />
      </button>
    </div>
  );
}
