import type { ReactNode } from 'react';
import { m } from 'framer-motion';
import { Monogram } from './EntityChip';
import { useChatBubbleMotion } from '../chat-motion';
import { BUBBLE_AVATAR_CLASS, bubbleCornerClass, bubbleLayoutBoundary, bubbleRowClass, bubbleStackClass } from '../chat-motion/bubbleLayout';

/**
 * One turn of the thread, in the same order a Cortex room draws it: the incoming turn keeps its
 * avatar outside the bubble on the left, top-aligned and lifted; my turn mirrors to the right with
 * no avatar; the distinct corner sits on the top corner of the bubble, on the side of its sender.
 */
export function MessageBubble({
  role,
  author,
  bubbleTestId,
  avatarTestId,
  index,
  surface = 'sage-assistant',
  avatar,
  bare = false,
  children,
}: {
  role: 'user' | 'assistant';
  /** Sender name; the monogram shows its initial. No name, no avatar. */
  author: string;
  bubbleTestId: string;
  /** Avatar hook of the host; the avatar is skipped when the host has no name for it. */
  avatarTestId: string;
  /** Position of the bubble in the thread: it takes its turn in the entrance of the history paint. */
  index?: number;
  /** Surface that draws the bubble — stamped on the row for the [CHAT-BUBBLE-LAYOUT] trail. */
  surface?: string;
  /** Replaces the monogram (a delegated agent's own mascot). */
  avatar?: ReactNode;
  /** No bubble surface: the speaker (a big mascot) carries the turn, the text sits beside it. */
  bare?: boolean;
  children: ReactNode;
}) {
  const mine = role === 'user';
  // [CHAT-BUBBLE-MOTION] the assistant thread enters with the same motion as the chat rooms: the
  // host opens the entrance at load, my own bubbles rise from below and a SAGE reply drops in.
  const motion = useChatBubbleMotion({ variant: index === undefined ? 'received' : 'thread', mine, index });

  return (
    <m.div
      data-testid={bubbleTestId}
      initial={motion.initial} animate={motion.animate} transition={motion.transition} {...motion.boundary}
      {...bubbleLayoutBoundary(surface, mine)}
      className={bubbleRowClass(mine)}
    >
      {!mine && author && (
        <span data-testid={avatarTestId} className={avatar ? 'shrink-0 self-start' : BUBBLE_AVATAR_CLASS}>
          {avatar ?? <Monogram color="var(--ink-3)" className="!size-6 !text-[10px]">{author.charAt(0).toUpperCase()}</Monogram>}
        </span>
      )}
      <div data-testid={`${bubbleTestId}-stack`} className={bubbleStackClass(mine, !mine)}>
        {!mine && author && (
          <p data-testid={`${bubbleTestId}-sender`} className="px-1 text-[10px] font-semibold text-ink-2">{author}</p>
        )}
        <div
          data-testid={`${bubbleTestId}-body`}
          className={bare
            ? 'min-w-0 max-w-full px-1 py-0.5 text-[13px] leading-[1.4] text-ink'
            : `min-w-0 max-w-full px-2.5 py-1.5 text-[13px] leading-[1.4] text-ink ${bubbleCornerClass({ mine })} ${mine ? 'bg-field shadow-hairline' : 'bg-surface-3'}`}
        >
          {children}
        </div>
      </div>
    </m.div>
  );
}
