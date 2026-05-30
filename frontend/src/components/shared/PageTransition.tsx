"use client";
import { motion, useReducedMotion } from "framer-motion";
import { pageTransition } from "@/lib/motion";

export default function PageTransition({ children }: { children: React.ReactNode }) {
  const reduced = useReducedMotion();
  const props = reduced
    ? {}
    : {
        initial: pageTransition.initial,
        animate: pageTransition.animate,
        exit:    pageTransition.exit,
        transition: pageTransition.transition,
      };

  return (
    <motion.div className="min-h-full" {...(props as any)}>
      {children}
    </motion.div>
  );
}

