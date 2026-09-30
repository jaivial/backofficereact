// Chat bubble motion — the shared entrance every chat surface uses (Cortex rooms, SAGE assistant,
// SAGE Code). Import the provider for a thread, the scope for its host and the handles for a bubble.
export {
  CHAT_BUBBLE_MOTION_COORD,
  CHAT_BUBBLE_MOTION_OBS,
  ChatBubbleMotionProvider,
  bubbleMotionIndex,
  bubbleMotionTarget,
  bubbleMotionTransition,
  type BubbleMotionTarget,
} from './ChatBubbleMotion';
export {
  useChatBubbleMotion,
  useChatBubbleMotionScope,
  type ChatBubbleMotionHandles,
  type ChatBubbleMotionPhase,
} from './ChatBubbleMotion';
