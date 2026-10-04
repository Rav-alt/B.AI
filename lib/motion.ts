// The only animations B.AI uses (DESIGN.md §10). Reuse these; don't write one-off values.
import type { Transition, Variants } from "motion/react";

const easeOut: Transition = { duration: 0.16, ease: "easeOut" };

/** New chat message (user or B.AI). */
export const fadeUp = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: easeOut,
} as const;

/** Route steps: same fade-up, 40 ms apart (only the first 6 are staggered). */
export const stepList: Variants = {
  hidden: {},
  shown: { transition: { staggerChildren: 0.04 } },
};
export const stepItem: Variants = {
  hidden: { opacity: 0, y: 8 },
  shown: { opacity: 1, y: 0, transition: easeOut },
};

/** Map card: fade only, after the steps. */
export const mapFade = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  transition: { duration: 0.2, ease: "easeOut", delay: 0.2 },
} as const;

/** "B.AI is thinking": opacity 0.3 ↔ 1, 900 ms loop. */
export const thinkingDot = (i: number) => ({
  animate: { opacity: [0.3, 1, 0.3] },
  transition: { duration: 0.9, repeat: Infinity, ease: "easeInOut" as const, delay: i * 0.15 },
});
