"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";

export const EASE_EXPO = [0.16, 1, 0.3, 1] as const;

type RevealProps = {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
};

/** Fade-up-on-scroll once. Reduced motion is handled globally via MotionConfig. */
export function Reveal({ children, delay = 0, y = 24, className }: RevealProps) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.7, delay, ease: [...EASE_EXPO] }}
    >
      {children}
    </motion.div>
  );
}
