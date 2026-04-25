import React, { useEffect } from "react";
import { X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../../shadcn/utils";

interface MobileModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
  "data-ui"?: string;
}

export function MobileModal({
  open,
  onClose,
  title,
  children,
  className,
  "data-ui": dataUi,
}: MobileModalProps) {
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden="true"
          />
          {/* Modal */}
          <motion.div
            key="modal"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: "spring", damping: 25, stiffness: 400 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
          >
            <div
              className={cn(
                "pointer-events-auto w-full max-w-sm rounded-2xl bg-[hsl(var(--background))]",
                "border border-[hsl(var(--border))] shadow-2xl",
                "flex flex-col max-h-[80vh]",
                className,
              )}
              data-ui={dataUi}
              role="dialog"
              aria-modal="true"
              aria-label={title}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              {title && (
                <div
                  className="flex items-center justify-between px-5 py-4 border-b border-[hsl(var(--border))]"
                  data-ui="mobile-modal-header"
                >
                  <h2 className="text-base font-bold text-[hsl(var(--foreground))]" data-ui="mobile-modal-title">{title}</h2>
                  <button
                    type="button"
                    onClick={onClose}
                    className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[hsl(var(--muted))] transition-colors"
                    data-ui="mobile-modal-close"
                    aria-label="Cerrar"
                  >
                    <X size={18} strokeWidth={2} className="text-[hsl(var(--muted-foreground))]" aria-hidden="true" />
                  </button>
                </div>
              )}

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-5" data-ui="mobile-modal-content">
                {children}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
