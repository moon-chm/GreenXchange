"use client";

import { useReducedMotion, motion } from "framer-motion";
import { slideFromLeft, staggerContainer } from "@/lib/motion";
import EmptyState from "@/components/shared/EmptyState";

// ─── Types ────────────────────────────────────────────────────────────────────
export interface Transaction {
  id: string;
  points: number;
  trigger_event: string;
  balance_snapshot: number;
  created_at: string;
  plant_name?: string;
}

type FilterType = "All" | "Plant Verified" | "Bonus";

interface TransactionTimelineProps {
  transactions: Transaction[];
  filter: FilterType;
  loading?: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Map a raw trigger_event value to the badge label shown in the UI.
 * Falls back to the raw string if no mapping exists.
 */
function getTriggerLabel(event: string): string {
  const map: Record<string, string> = {
    plant_verified: "Plant Verified",
    plant_registered: "Plant Registered",
    bonus: "Bonus",
    referral_bonus: "Referral Bonus",
    milestone_bonus: "Milestone Bonus",
    manual_credit: "Manual Credit",
  };
  return map[event] ?? event.replace(/_/g, " ");
}

/**
 * Map a trigger event to a filter bucket.
 */
function getFilterBucket(event: string): FilterType {
  if (event.includes("bonus") || event === "referral_bonus" || event === "milestone_bonus") {
    return "Bonus";
  }
  if (event === "plant_verified") {
    return "Plant Verified";
  }
  return "All";
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function TimelineSkeleton() {
  return (
    <div className="relative pl-8 space-y-6">
      <div
        className="absolute left-3 top-0 bottom-0 w-0.5"
        style={{ background: "rgba(163,177,138,0.3)" }}
        aria-hidden
      />
      {[...Array(4)].map((_, i) => (
        <div key={i} className="relative">
          <div className="absolute left-[-22px] top-1 w-3 h-3 rounded-full bg-sage/40 border-2 border-parchment" />
          <div className="space-y-2">
            <div className="skeleton-shimmer rounded-xl h-3 w-24" />
            <div className="skeleton-shimmer rounded-xl h-4 w-48" />
            <div className="skeleton-shimmer rounded-xl h-3 w-32" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function TransactionTimeline({
  transactions,
  filter,
  loading = false,
}: TransactionTimelineProps) {
  const reduced = useReducedMotion();

  if (loading) return <TimelineSkeleton />;

  // Apply filter
  const visible =
    filter === "All"
      ? transactions
      : transactions.filter(
          (tx) => getFilterBucket(tx.trigger_event) === filter
        );

  if (visible.length === 0) {
    return (
      <EmptyState
        title="No transactions yet"
        description={
          filter === "All"
            ? "Register plants and verify updates to start earning GXC Points."
            : `No "${filter}" transactions found.`
        }
      />
    );
  }

  return (
    <motion.div
      variants={reduced ? undefined : staggerContainer}
      initial={reduced ? false : "hidden"}
      animate="visible"
      className="relative pl-8"
    >
      {/* Vertical line */}
      <div
        className="absolute left-3 top-0 bottom-0 w-0.5 bg-sage/30"
        aria-hidden
      />

      <div className="space-y-7">
        {visible.map((tx, idx) => (
          <motion.div
            key={tx.id}
            variants={reduced ? undefined : slideFromLeft}
            className="relative group"
          >
            {/* Timeline dot */}
            <div
              className="absolute left-[-22px] top-1 w-3 h-3 rounded-full bg-fern border-2 border-parchment
                         group-hover:scale-125 transition-transform duration-200"
              aria-hidden
            />

            {/* Card content */}
            <div className="rounded-xl border border-sage/30 bg-white/60 backdrop-blur-sm p-4 shadow-sm
                            hover:border-sage/60 hover:bg-white/80 transition-all duration-200">
              <div className="flex items-start justify-between gap-3">
                {/* Left: date + plant + event */}
                <div className="min-w-0 space-y-1">
                  <p className="text-xs text-canopy/50 font-sans tabular-nums">
                    {formatDate(tx.created_at)}&nbsp;&middot;&nbsp;{formatTime(tx.created_at)}
                  </p>

                  <p className="text-sm font-medium text-canopy font-sans truncate">
                    {tx.plant_name ?? "GreenXchange Reward"}
                  </p>

                  {/* Trigger badge */}
                  <span className="inline-block px-2 py-0.5 rounded-full bg-fern/10 text-fern text-xs font-medium font-sans">
                    {getTriggerLabel(tx.trigger_event)}
                  </span>
                </div>

                {/* Right: points + running balance */}
                <div className="flex flex-col items-end shrink-0 gap-1">
                  <span className="text-base font-semibold text-fern font-sans tabular-nums">
                    +{tx.points.toLocaleString()}
                  </span>
                  <span className="text-xs text-canopy/40 font-mono tabular-nums">
                    ={tx.balance_snapshot.toLocaleString()} pts
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
