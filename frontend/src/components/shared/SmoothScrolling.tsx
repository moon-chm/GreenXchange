"use client";

import { ReactLenis } from "lenis/react";
import { useReducedMotion } from "framer-motion";
import "lenis/dist/lenis.css";

export default function SmoothScrolling({ children }: { children: React.ReactNode }) {
  const shouldReduce = useReducedMotion();

  // If the user prefers reduced motion, we disable/bypass the smooth animation properties
  const lenisOptions = shouldReduce
    ? {
        duration: 0,
        lerp: 1,
        smoothWheel: false,
      }
    : {
        duration: 1.2,
        lerp: 0.1,
        smoothWheel: true,
      };

  return (
    <ReactLenis root options={lenisOptions}>
      {children}
    </ReactLenis>
  );
}
