"use client";

import { useReducedMotion, motion, animate } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import AnimatedNumber from "@/components/shared/AnimatedNumber";

// ─── Tier config ──────────────────────────────────────────────────────────────
interface Tier {
  label: string;
  min: number;
  max: number | null;
  color: string;
}

const TIERS: Tier[] = [
  { label: "Seedling",        min: 0,    max: 100,  color: "#A3B18A" },
  { label: "Sapling",         min: 101,  max: 500,  color: "#588157" },
  { label: "Tree",            min: 501,  max: 2000, color: "#3A5A40" },
  { label: "Forest Guardian", min: 2001, max: null, color: "#344E41" },
];

const CIRCUMFERENCE = 2 * Math.PI * 48; // 301.59...

function getTier(points: number): Tier {
  return (
    TIERS.find((t) => points >= t.min && (t.max === null || points <= t.max)) ??
    TIERS[TIERS.length - 1]
  );
}

function getTierFraction(points: number, tier: Tier): number {
  if (tier.max === null) return 1;
  const range = tier.max - tier.min;
  const progress = points - tier.min;
  return Math.min(Math.max(progress / range, 0), 1);
}

function ptsToNextTier(points: number, tier: Tier): number | null {
  if (tier.max === null) return null;
  return tier.max - points + 1;
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface RewardRingProps {
  points: number;
  loading?: boolean;
}

// ─── Animated SVG ring ────────────────────────────────────────────────────────
function ProgressCircle({
  fraction,
  skip,
}: {
  fraction: number;
  skip: boolean;
}) {
  const circleRef = useRef<SVGCircleElement>(null);
  const targetOffset = CIRCUMFERENCE * (1 - fraction);

  useEffect(() => {
    const el = circleRef.current;
    if (!el) return;

    if (skip) {
      el.style.strokeDashoffset = String(targetOffset);
      return;
    }

    const ctrl = animate(CIRCUMFERENCE, targetOffset, {
      duration: 1.2,
      ease: [0.22, 1, 0.36, 1],
      onUpdate(v) {
        el.style.strokeDashoffset = String(v);
      },
    });

    return () => ctrl.stop();
  }, [fraction, skip, targetOffset]);

  return (
    <circle
      ref={circleRef}
      cx={60}
      cy={60}
      r={48}
      fill="none"
      stroke="#588157"
      strokeWidth={8}
      strokeLinecap="round"
      strokeDasharray={CIRCUMFERENCE}
      strokeDashoffset={CIRCUMFERENCE}
      style={{ transformOrigin: "center", transform: "rotate(-90deg)" }}
    />
  );
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function RewardRing({ points, loading = false }: RewardRingProps) {
  const reduced = useReducedMotion();
  const tier = getTier(points);
  const fraction = getTierFraction(points, tier);
  const toNext = ptsToNextTier(points, tier);

  // Animate progress-bar width
  const [barWidth, setBarWidth] = useState(0);
  useEffect(() => {
    if (loading) return;
    const target = Math.round(fraction * 100);
    if (reduced) {
      setBarWidth(target);
      return;
    }
    const timer = setTimeout(() => setBarWidth(target), 200);
    return () => clearTimeout(timer);
  }, [fraction, loading, reduced]);

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-6">
        <div className="skeleton-shimmer rounded-full" style={{ width: 120, height: 120 }} />
        <div className="skeleton-shimmer rounded-xl h-4 w-40" />
        <div className="skeleton-shimmer rounded-full h-2 w-full" />
      </div>
    );
  }

  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="flex flex-col items-center gap-6 w-full"
    >
      {/* ── SVG Ring ── */}
      <div className="relative">
        <svg
          viewBox="0 0 120 120"
          width={192}
          height={192}
          aria-label={`${points} GXC Points`}
          role="img"
        >
          {/* Track */}
          <circle
            cx={60}
            cy={60}
            r={48}
            fill="none"
            stroke="#A3B18A"
            strokeWidth={8}
          />
          {/* Progress */}
          <ProgressCircle fraction={fraction} skip={!!reduced} />
        </svg>

        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
          <AnimatedNumber
            value={points}
            duration={reduced ? 0 : 1.2}
            className="font-display text-3xl font-bold text-canopy leading-none"
          />
          <span className="text-sm text-canopy/60 font-sans">GXC Points</span>
        </div>
      </div>

      {/* ── Tier badge ── */}
      <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-fern/20 text-fern text-sm font-semibold font-sans">
        <span
          className="w-2 h-2 rounded-full"
          style={{ backgroundColor: tier.color }}
          aria-hidden
        />
        {tier.label}
      </span>

      {/* ── Tier progress bar ── */}
      <div className="w-full space-y-1.5">
        <div
          className="w-full h-2 rounded-full bg-sage/20 overflow-hidden"
          role="progressbar"
          aria-valuenow={Math.round(fraction * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full rounded-full bg-fern transition-all ease-out"
            style={{
              width: `${barWidth}%`,
              transitionDuration: reduced ? "0ms" : "1000ms",
            }}
          />
        </div>
        <p className="text-xs text-canopy/60 text-center font-sans">
          {toNext !== null
            ? `${toNext.toLocaleString()} pts to next tier`
            : "Maximum tier reached — Forest Guardian 🌲"}
        </p>
      </div>
    </motion.div>
  );
}
