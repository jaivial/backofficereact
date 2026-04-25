import React, { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../../shadcn/utils";

interface MobileBottomSheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
  "data-ui"?: string;
}

export function MobileBottomSheet({
  open,
  onClose,
  title,
  children,
  className,
  "data-ui": dataUi,
}: MobileBottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);

  // Trap focus inside sheet and handle Escape
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
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden="true"
          />
          {/* Sheet */}
          <motion.div
            key="sheet"
            ref={sheetRef}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 400 }}
            className={cn(
              "fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl bg-[hsl(var(--background))]",
              "flex flex-col max-h-[90vh]",
              "shadow-2xl border-t border-[hsl(var(--border))]",
              className,
            )}
            data-ui={dataUi}
            role="dialog"
            aria-modal="true"
            aria-label={title}
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-2" aria-hidden="true" data-ui="mobile-sheet-handle">
              <div className="w-10 h-1 rounded-full bg-[hsl(var(--muted-foreground))]/30" / data-slot="mobileBottomSheet-bg-[hsl(var(-">
            </div>

            {/* Header */}
            {title && (
              <div
                className="flex items-center justify-between px-5 pb-3 border-b border-[hsl(var(--border))]"
                data-ui="mobile-sheet-header"
              >
                <h2 className="text-base font-bold text-[hsl(var(--foreground))]" data-ui="mobile-sheet-title">{title}</h2>
                <button
                  type="button"
                  onClick={onClose}
                  className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[hsl(var(--muted))] transition-colors"
                  data-ui="mobile-sheet-close"
                  aria-label="Cerrar"
                >
                  <X size={18} strokeWidth={2} className="text-[hsl(var(--muted-foreground))]" aria-hidden="true" />
                </button>
              </div>
            )}

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-5" data-ui="mobile-sheet-content">
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
