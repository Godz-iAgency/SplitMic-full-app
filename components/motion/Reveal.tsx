"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

type Props = {
  children: React.ReactNode;
  /** Seconds to delay the entrance — used to stagger siblings. */
  delay?: number;
  /** How far (px) the element rises as it fades in. */
  y?: number;
  className?: string;
};

/**
 * Fades + rises its children into view the first time they scroll on screen.
 *
 * IMPORTANT — fail-safe by design:
 * The server (and the very first client render) outputs the children as a plain,
 * fully-visible <div>. We only swap in the animated version AFTER the component
 * has mounted on the client. This guarantees the page is never shipped with
 * hidden (opacity:0) HTML, so a slow or failed hydration can't leave sections
 * blank — the behaviour that previously made content intermittently vanish on
 * mobile. The scroll animation is a pure enhancement layered on top.
 *
 * - Animates once, then stays put (no replay on every scroll).
 * - Uses transform + opacity only (GPU-accelerated, 60fps).
 * - Respects prefers-reduced-motion: renders instantly with no movement.
 *
 * Stagger a grid by passing an index-based delay, e.g.
 *   <Reveal delay={Math.min(i, 8) * 0.05}>…</Reveal>
 */
export function Reveal({ children, delay = 0, y = 16, className }: Props) {
  const reduceMotion = useReducedMotion();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Before mount (SSR + first paint) and for reduced-motion users: render the
  // content visible and static. Content is always in the HTML, never hidden.
  if (!mounted || reduceMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
