"use client";

import { useReducedMotion, motion } from "framer-motion";
import { useState } from "react";
import Link from "next/link";
import { Users, Calendar, Check, ArrowRight } from "lucide-react";
import StaleIndicator from "@/components/shared/StaleIndicator";
import { fadeUp, staggerContainer, staggerItem } from "@/lib/motion";

interface Drive {
  id: string;
  title: string;
  distance_meters: number;
  participant_count: number;
  start_date: string;
  end_date: string;
  is_joined?: boolean;
}

interface DrivesPanelProps {
  stale: boolean;
  data: Drive[] | null;
  loading?: boolean;
}

function formatDateRange(start: string, end: string) {
  const s = new Date(start).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  const e = new Date(end).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  return `${s} – ${e}`;
}

function Skeleton() {
  return (
    <div className="rounded-2xl border border-sage/40 bg-white/80 backdrop-blur-sm shadow-card p-6 flex flex-col gap-4">
      <div className="skeleton-shimmer rounded-xl h-6 w-32" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="rounded-xl border border-sage/20 p-4 flex gap-3">
          <div className="flex-1 space-y-2">
            <div className="skeleton-shimmer rounded-lg h-4 w-3/4" />
            <div className="skeleton-shimmer rounded-lg h-3 w-1/2" />
          </div>
          <div className="skeleton-shimmer rounded-xl h-8 w-16" />
        </div>
      ))}
    </div>
  );
}

export default function DrivesPanel({
  stale,
  data,
  loading = false,
}: DrivesPanelProps) {
  const shouldReduce = useReducedMotion();
  const [joined, setJoined] = useState<Set<string>>(
    new Set((data ?? []).filter((d) => d.is_joined).map((d) => d.id))
  );

  if (loading) return <Skeleton />;

  return (
    <motion.div
      variants={fadeUp}
      initial={shouldReduce ? "visible" : "hidden"}
      animate="visible"
      className="rounded-2xl border border-sage/40 bg-white/80 backdrop-blur-sm shadow-card p-6 flex flex-col gap-4 h-full"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users size={18} className="text-fern" />
          <h2 className="font-display text-xl font-semibold text-canopy">
            Nearby Drives
          </h2>
        </div>
        {stale && (
          <span className="flex items-center gap-1 text-xs font-medium bg-amber-500/10 text-amber-700 px-2 py-1 rounded-lg border border-amber-400/30">
            Stale
          </span>
        )}
      </div>

      {stale && !data && <StaleIndicator label="Drives data unavailable" />}

      {/* Drive list */}
      {!data || data.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm text-canopy/40 text-center py-4">
            No nearby drives found.
          </p>
        </div>
      ) : (
        <motion.ul
          variants={shouldReduce ? undefined : staggerContainer}
          initial={shouldReduce ? "visible" : "hidden"}
          animate="visible"
          className="flex-1 flex flex-col gap-3"
          role="list"
        >
          {data.map((drive) => {
            const isJoined = joined.has(drive.id);
            return (
              <motion.li
                key={drive.id}
                variants={shouldReduce ? undefined : staggerItem}
                className="flex items-center gap-3 rounded-xl border border-sage/30 bg-sage/5 hover:bg-sage/10 transition-colors duration-150 p-4"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-display text-sm font-semibold text-canopy leading-tight line-clamp-1">
                    {drive.title}
                  </p>

                  <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                    {/* Distance */}
                    <span className="inline-flex items-center gap-1 bg-fern/15 text-fern text-xs font-medium px-2 py-0.5 rounded-full">
                      {(drive.distance_meters / 1000).toFixed(1)} km
                    </span>

                    {/* Participants */}
                    <span className="flex items-center gap-1 text-xs text-canopy/50">
                      <Users size={11} />
                      {drive.participant_count}
                    </span>

                    {/* Date range */}
                    <span className="flex items-center gap-1 text-xs text-canopy/40">
                      <Calendar size={11} />
                      {formatDateRange(drive.start_date, drive.end_date)}
                    </span>
                  </div>
                </div>

                {/* Join button */}
                <motion.button
                  whileTap={shouldReduce ? undefined : { scale: 0.97 }}
                  onClick={() =>
                    setJoined((prev) => {
                      const next = new Set(prev);
                      if (next.has(drive.id)) {
                        next.delete(drive.id);
                      } else {
                        next.add(drive.id);
                      }
                      return next;
                    })
                  }
                  aria-pressed={isJoined}
                  className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-200 ${
                    isJoined
                      ? "bg-fern/20 text-fern border border-fern"
                      : "bg-fern text-parchment hover:bg-forest"
                  }`}
                >
                  {isJoined ? (
                    <>
                      <Check size={13} />
                      Joined
                    </>
                  ) : (
                    "Join"
                  )}
                </motion.button>
              </motion.li>
            );
          })}
        </motion.ul>
      )}

      {/* Footer link */}
      <Link
        href="/drives"
        className="flex items-center justify-center gap-1.5 text-sm font-medium text-fern hover:text-forest transition-colors duration-150 pt-1 border-t border-sage/20 mt-auto"
      >
        Explore all drives
        <ArrowRight size={14} />
      </Link>
    </motion.div>
  );
}
