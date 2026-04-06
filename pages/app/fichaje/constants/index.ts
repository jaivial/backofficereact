import type { Transition } from "motion/react";

export const ANIMATION_TRANSITION_REDUCED: Transition = { duration: 0 };
export const ANIMATION_TRANSITION_NORMAL: Transition = { duration: 0.22, ease: "easeOut" as const };
