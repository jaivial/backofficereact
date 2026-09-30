"use client";
// HOST-EDIT (registry has no button file): minimal local fallback matching
// ApprovalCard's `variant`/`size` usage so no new dependency is needed.
// Keep on re-pull: `size` + `testId` + press-scale props. Coordination id: sage-questions-006.
export function SageQuestionsButton({
  children,
  onClick,
  disabled,
  variant = "ghost",
  size = "sm",
  testId,
  pressable = true,
  ariaLabel,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "ghost" | "accent";
  size?: "sm" | "md";
  testId?: string;
  pressable?: boolean;
  ariaLabel?: string;
}) {
  const cls =
    variant === "accent"
      ? "bg-zinc-900 text-white hover:bg-zinc-700 disabled:opacity-40 dark:bg-white dark:text-zinc-900"
      : "text-zinc-500 hover:text-zinc-900 disabled:opacity-40 dark:text-zinc-400 dark:hover:text-white";
  const pad = size === "md" ? "px-4 py-2 text-[13px]" : "px-3 py-1.5 text-[12px]";
  // HOST-EDIT: better-ui press feedback (interruptible CSS transition, scale 0.96).
  const press = pressable ? "active:scale-[0.96] disabled:active:scale-100" : "";
  return (
    <button
      type="button"
      data-testid={testId ?? `sage-questions-btn-${variant}`}
      aria-label={ariaLabel}
      onClick={onClick}
      disabled={disabled}
      className={`rounded-full font-medium transition-all duration-150 ease-out ${pad} ${cls} ${press}`}
    >
      {children}
    </button>
  );
}
