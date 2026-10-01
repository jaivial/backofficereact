// The reusable entrance of a chat bubble, host side. A thread stands the entrance ON when its
// history lands (or when its parent says the messages are live) and every bubble below reads it;
// this way the same motion serves rooms, the SAGE assistant and SAGE Code without any host
// counting frames by itself.
//
// Observational point: [CHAT-BUBBLE-MOTION]. Coordination id: `chat-bubble-motion-001`.
import { useEffect, useState, type ReactNode } from 'react';
import { LazyMotion, domAnimation, useReducedMotion } from 'framer-motion';
import { forkyObserve } from './observe';

/** Coordination id every chat surface passes so the entrance of a bubble greps as ONE trail. */
export const CHAT_BUBBLE_MOTION_COORD = 'chat-bubble-motion-001';

/** Named observational point of the shared chat-bubble entrance. */
export const CHAT_BUBBLE_MOTION_OBS = 'chat-bubble-motion';

/** Air of the entrance (seconds) and the curve the app already uses for surface motion. */
const DURATION = 0.32;
const EASE = [0.23, 1, 0.32, 1] as const;
const RISE = 14;
const STAGGER = 0.045;
/** The stagger of the first paint is a beat, never a queue: the tail of a long thread lands together. */
const STAGGER_CAP = 0.4;

/** Where a bubble ends: relaxed and opaque. `<m.div initial={false}>` paints it there at once. */
export type BubbleMotionTarget = { opacity: number; y: number };

/** Where the entrance of a thread is: closed → opened on the history paint → ready for the arrivals. */
export type ChatBubbleMotionPhase = 'closed' | 'thread' | 'received';

/** Where a bubble starts: my message rises from below, whatever another member sent drops in. */
export function bubbleMotionTarget({ variant, mine }: { variant: ChatBubbleMotionPhase; mine?: boolean }): BubbleMotionTarget {
  return { opacity: 0, y: mine && variant === 'received' ? RISE : -RISE };
}

/** Timing of the entrance: the live arrival is one beat; the first paint of a thread is staggered. */
export type ChatBubbleMotionTransition = { duration: number; ease: readonly [number, number, number, number]; delay?: number };

/** Timing of one bubble: the live arrival is instant; the first paint of a thread is staggered. */
export function bubbleMotionTransition({ variant, index = 0 }: { variant: ChatBubbleMotionPhase; index?: number }): ChatBubbleMotionTransition {
  if (variant === 'thread') return { duration: DURATION, ease: EASE, delay: Math.min(index * STAGGER, STAGGER_CAP) };
  return { duration: DURATION, ease: EASE };
}

/** No motion at all: a host that opts a bubble out (a voice clip, a placeholder) paints it settled. */
const SETTLED_TRANSITION = { duration: 0, ease: EASE };

/** Motion provider of a chat thread: registers the animation features once for every `m` bubble. */
export function ChatBubbleMotionProvider({ children, testId }: { children: ReactNode; testId: string }) {
  return (
    <LazyMotion data-testid={testId} features={domAnimation}>
      {children}
    </LazyMotion>
  );
}

/** Handles the thread passes to each bubble; spread them on the motion element of the bubble. */
export type ChatBubbleMotionHandles = {
  initial: BubbleMotionTarget | false;
  animate: BubbleMotionTarget;
  transition: ChatBubbleMotionTransition;
  /** Observational attribute of the bubble: where the entrance of this thread stands. */
  boundary: { 'data-obs': string; 'data-coord': string; 'data-bubble-motion': ChatBubbleMotionPhase };
};

export type ChatBubbleMotionHandlesOptions = {
  /** `'thread'` staggers the first paint of a loaded thread; `'received'` is the live arrival. */
  variant: ChatBubbleMotionPhase;
  /** Sender is me: my own bubbles rise from below, the incoming ones drop in from above. */
  mine?: boolean;
  /** Position of the bubble in the thread — orders the stagger of the `'thread'` entrance. */
  index?: number;
  /** Host opts this bubble out (a voice clip, a placeholder): it is painted settled. */
  disabled?: boolean;
};

/**
 * Opens the entrance of a chat thread: the history paint (staggered, once) and the live arrivals.
 * `active` false (reduced motion, or nothing to animate) leaves every bubble settled; the next load
 * of the same host paints settled — a thread already on screen never replays its entrance.
 */
export function useChatBubbleMotionScope(active: boolean): ChatBubbleMotionPhase {
  const reduced = useReducedMotion();
  const [painted, setPainted] = useState(false);
  const open = active && !painted && !reduced;
  // The opening of the thread is a checkpoint operators grep across the chat surfaces.
  useEffect(() => {
    if (open) forkyObserve(CHAT_BUBBLE_MOTION_OBS, { variant: 'thread' });
  }, [open]);
  // Opening the entrance arms the scope: the phase of this paint is `thread`, the next one `received`.
  if (open && !painted) setPainted(true);
  return open ? 'thread' : 'received';
}

/** Index a bubble passes to the entrance: only the opening paint of the thread staggers. */
export function bubbleMotionIndex(phase: ChatBubbleMotionPhase, index: number): number | undefined {
  return phase === 'thread' ? index : undefined;
}

/** Handles of one bubble: reads the phase the thread opened and never re-runs on later renders. */
export function useChatBubbleMotion({ variant, mine, index = 0, disabled }: ChatBubbleMotionHandlesOptions): ChatBubbleMotionHandles {
  return {
    initial: disabled || variant === 'closed' ? false : bubbleMotionTarget({ variant, mine }),
    animate: { opacity: 1, y: 0 },
    transition: disabled ? SETTLED_TRANSITION : bubbleMotionTransition({ variant, index }),
    boundary: {
      'data-obs': CHAT_BUBBLE_MOTION_OBS,
      'data-coord': CHAT_BUBBLE_MOTION_COORD,
      'data-bubble-motion': disabled ? 'closed' : variant,
    },
  };
}
