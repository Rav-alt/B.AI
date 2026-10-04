"use client";
// Motion setup (DESIGN.md §10): the slim `m` components + domAnimation only, and no motion for
// people who ask their OS for reduced motion.
import { LazyMotion, MotionConfig, domAnimation } from "motion/react";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </LazyMotion>
  );
}
