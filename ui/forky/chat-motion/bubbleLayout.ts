// Chat bubble layout — the order a Cortex room draws a message in, shared by every chat surface
// (Cortex rooms, SAGE assistant, sheets, agent creator, SAGE Code): the avatar sits outside the
// bubble, top-aligned and nudged up optically; my row mirrors to the right; the distinct corner
// sits on the top corner of the first bubble of a run, on the side of its sender.
//
// Observational point: [CHAT-BUBBLE-LAYOUT]. Coordination id: `chat-bubble-layout-001`.

/** Coordination id every chat surface stamps on a bubble row so the layout greps as ONE trail. */
export const CHAT_BUBBLE_LAYOUT_COORD = 'chat-bubble-layout-001';

/** Named observational point of the shared chat-bubble layout. */
export const CHAT_BUBBLE_LAYOUT_OBS = 'chat-bubble-layout';

/** Row of one run: my own messages mirror to the right, the incoming ones stay on the left. */
export function bubbleRowClass(mine: boolean): string {
  return `flex min-w-0 gap-2 ${mine ? 'flex-row-reverse justify-start' : 'justify-start'}`;
}

/** Avatar outside the bubble: once per run, on top, lifted to the cap height of the first line. */
export const BUBBLE_AVATAR_CLASS = 'shrink-0 self-start -translate-y-[5px] rounded-full outline outline-1 outline-[oklch(1_0_0/0.08)]';

/** Column of bubbles of one run, hugging the side of its sender. `wide` lets a rich reply
 *  (markdown, code, charts) take the rest of the row instead of the chat-room cap. */
export function bubbleStackClass(mine: boolean, wide = false): string {
  return `flex min-w-0 flex-col gap-1 ${wide ? 'flex-1' : 'max-w-[78%]'} ${mine ? 'items-end' : 'items-start'}`;
}

/** Corners of one bubble: fully rounded, the distinct corner on the top corner of the run. */
export function bubbleCornerClass({ mine, tail = true }: { mine: boolean; tail?: boolean }): string {
  return `rounded-2xl ${tail ? (mine ? 'rounded-tr-md' : 'rounded-tl-md') : ''}`;
}

/** Observational attributes of a bubble row: which surface drew it and on which side. */
export function bubbleLayoutBoundary(surface: string, mine: boolean) {
  return {
    'data-layout-obs': CHAT_BUBBLE_LAYOUT_OBS,
    'data-layout-coord': CHAT_BUBBLE_LAYOUT_COORD,
    'data-bubble-surface': surface,
    'data-bubble-side': mine ? 'mine' : 'theirs',
  } as const;
}
