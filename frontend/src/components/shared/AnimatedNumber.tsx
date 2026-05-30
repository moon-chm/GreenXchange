"use client";
import { useEffect, useRef } from "react";
import { useSpring, useMotionValue, useTransform, motion } from "framer-motion";

interface AnimatedNumberProps {
  value: number;
  duration?: number;
  decimals?: number;
  className?: string;
  style?: React.CSSProperties;
}

export default function AnimatedNumber({
  value,
  duration = 1.2,
  decimals = 0,
  className = "",
  style,
}: AnimatedNumberProps) {
  const mv = useMotionValue(0);
  const spring = useSpring(mv, { duration: duration * 1000, bounce: 0 });
  const display = useTransform(spring, (v) => v.toFixed(decimals));
  const prevValue = useRef(0);

  useEffect(() => {
    mv.set(prevValue.current);
    spring.set(value);
    prevValue.current = value;
  }, [value, mv, spring]);

  return <motion.span style={style} className={className}>{display}</motion.span>;
}

