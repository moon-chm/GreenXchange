"use client";

import { useReducedMotion, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { Plus, QrCode } from "lucide-react";
import StatusBadge from "@/components/shared/StatusBadge";
import StaleIndicator from "@/components/shared/StaleIndicator";
import { staggerContainer, staggerItem, fadeUp } from "@/lib/motion";

interface Plant {
  id: string;
  scan_id: string;
  common_name?: string;
  species_name: string;
  planting_date: string;
  status: "verified" | "pending" | "rejected" | "active" | "inactive";
}

interface PlantPortfolioPanelProps {
  stale: boolean;
  data: Plant[] | null;
  loading?: boolean;
}

function LeafSVG() {
  return (
    <svg
      width="40"
      height="40"
      viewBox="0 0 40 40"
      fill="none"
      className="text-fern"
      aria-hidden="true"
    >
      <path
        d="M20 4C20 4 6 10 6 22C6 30 13 35 20 35C27 35 34 30 34 22C34 10 20 4 20 4Z"
        fill="currentColor"
        fillOpacity="0.3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <line
        x1="20"
        y1="34"
        x2="20"
        y2="14"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M20 26 C 15 22 13 18 16 14"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M20 20 C 25 16 27 12 24 8"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

function PlantCardSkeleton() {
  return (
    <div className="rounded-2xl border border-sage/40 bg-white/80 backdrop-blur-sm shadow-card p-6 flex flex-col gap-3">
      <div className="bg-sage/20 rounded-xl h-24 skeleton-shimmer" />
      <div className="skeleton-shimmer rounded-xl h-5 w-3/4" />
      <div className="skeleton-shimmer rounded-xl h-3 w-1/2" />
      <div className="skeleton-shimmer rounded-full h-5 w-16" />
    </div>
  );
}

export default function PlantPortfolioPanel({
  stale,
  data,
  loading = false,
}: PlantPortfolioPanelProps) {
  const shouldReduce = useReducedMotion();
  const router = useRouter();

  return (
    <motion.section
      variants={fadeUp}
      initial={shouldReduce ? "visible" : "hidden"}
      animate="visible"
      className="rounded-2xl border border-sage/40 bg-white/80 backdrop-blur-sm shadow-card p-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <QrCode size={18} className="text-fern" />
          <h2 className="font-display text-xl font-semibold text-canopy">
            My Plant Portfolio
          </h2>
        </div>
        {stale && !loading && (
          <span className="flex items-center gap-1 text-xs font-medium bg-amber-500/10 text-amber-700 px-2 py-1 rounded-lg border border-amber-400/30">
            Stale
          </span>
        )}
      </div>

      {stale && !loading && !data && (
        <StaleIndicator label="Plant data unavailable" />
      )}

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <PlantCardSkeleton key={i} />
          ))}
        </div>
      ) : (
        <motion.div
          variants={shouldReduce ? undefined : staggerContainer}
          initial={shouldReduce ? "visible" : "hidden"}
          animate="visible"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          {(data ?? []).map((plant) => (
            <motion.div
              key={plant.id}
              variants={shouldReduce ? undefined : staggerItem}
              onClick={() => router.push(`/plants/${plant.id}/growth`)}
              className="group rounded-2xl border border-sage/40 bg-white/80 backdrop-blur-sm shadow-card p-5 cursor-pointer hover:border-fern/60 hover:shadow-md transition-all duration-200 flex flex-col gap-3"
            >
              {/* Icon placeholder */}
              <div className="bg-sage/20 rounded-xl h-24 flex items-center justify-center group-hover:bg-fern/10 transition-colors duration-200">
                <LeafSVG />
              </div>

              {/* Species */}
              <div className="flex-1">
                <p className="font-display text-base font-semibold text-canopy leading-tight line-clamp-1">
                  {plant.common_name || plant.species_name}
                </p>
                {plant.common_name && (
                  <p className="text-xs text-canopy/50 italic mt-0.5 line-clamp-1">
                    {plant.species_name}
                  </p>
                )}
              </div>

              {/* Scan ID */}
              <p className="font-mono text-xs text-canopy/40 tracking-wider truncate">
                {plant.scan_id}
              </p>

              {/* Status */}
              <div className="flex items-center justify-between">
                <StatusBadge status={plant.status} />
                <span className="text-[10px] text-canopy/30">
                  {new Date(plant.planting_date).toLocaleDateString("en-US", {
                    month: "short",
                    year: "numeric",
                  })}
                </span>
              </div>
            </motion.div>
          ))}

          {/* Register new plant card */}
          <motion.button
            variants={shouldReduce ? undefined : staggerItem}
            onClick={() => router.push("/plants/register")}
            className="rounded-2xl border-2 border-dashed border-sage/50 bg-transparent hover:border-fern hover:bg-fern/5 transition-all duration-200 p-5 flex flex-col items-center justify-center gap-3 cursor-pointer min-h-[180px] group"
            aria-label="Register a new plant"
          >
            <div className="w-12 h-12 rounded-xl bg-sage/20 group-hover:bg-fern/15 flex items-center justify-center transition-colors duration-200">
              <Plus size={24} className="text-sage group-hover:text-fern transition-colors duration-200" />
            </div>
            <span className="font-sans text-sm font-medium text-sage group-hover:text-fern transition-colors duration-200">
              Register Plant
            </span>
          </motion.button>
        </motion.div>
      )}
    </motion.section>
  );
}
