"use client";

import { motion, useReducedMotion } from "framer-motion";
import { staggerItem } from "@/lib/motion";
import StatusBadge from "@/components/shared/StatusBadge";
import LeafIcon from "@/components/icons/LeafIcon";

interface Plant {
  id: string;
  species_name: string;
  scientific_name?: string;
  qr_scan_id: string;
  status: "verified" | "pending" | "rejected";
  points_earned: number;
  updated_at: string;
}

interface PlantCardProps {
  plant: Plant;
}

function CoinsIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="inline-block"
    >
      <circle cx="8" cy="14" r="5" stroke="currentColor" strokeWidth="2" />
      <path
        d="M13 11.5C13.82 10.58 15.07 10 16.5 10C19.54 10 22 12.46 22 15.5C22 18.54 19.54 21 16.5 21C15.07 21 13.82 20.42 13 19.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M16.5 10C16.5 7.5 14.5 5.5 11.5 5C10.1 4.75 8.75 4.92 7.63 5.38"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function formatDate(dateString: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(dateString));
  } catch {
    return dateString;
  }
}

export default function PlantCard({ plant }: PlantCardProps) {
  const shouldReduceMotion = useReducedMotion();

  const cardVariants = shouldReduceMotion
    ? { hidden: {}, visible: {} }
    : staggerItem;

  const hoverProps = shouldReduceMotion
    ? {}
    : { whileHover: { y: -4, transition: { duration: 0.2, ease: "easeOut" } } };

  return (
    <motion.div
      variants={cardVariants}
      {...(hoverProps as any)}
      className="relative rounded-2xl border border-sage/40 bg-white/80 backdrop-blur-sm shadow-card p-5 flex flex-col gap-3 cursor-pointer group"
    >
      {/* Status badge — absolute top-right */}
      <div className="absolute top-4 right-4 z-10">
        <StatusBadge status={plant.status} />
      </div>

      {/* Leaf image placeholder */}
      <div className="w-full h-32 bg-sage/15 rounded-xl flex items-center justify-center">
        <LeafIcon size={40} className="text-sage" />
      </div>

      {/* Plant info */}
      <div className="flex flex-col gap-0.5 pr-20">
        <h3 className="font-display text-lg font-semibold text-canopy leading-tight">
          {plant.species_name}
        </h3>
        {plant.scientific_name && (
          <p className="italic text-sm text-canopy/60">{plant.scientific_name}</p>
        )}
      </div>

      {/* Scan ID */}
      <p className="font-mono text-xs text-canopy/50 truncate" title={plant.qr_scan_id}>
        {plant.qr_scan_id}
      </p>

      {/* Footer row */}
      <div className="flex items-center justify-between mt-auto pt-1 border-t border-sage/20">
        <span className="flex items-center gap-1.5 text-fern text-sm font-medium">
          <CoinsIcon size={15} />
          {plant.points_earned.toLocaleString()} pts
        </span>
        <span className="text-xs text-canopy/50">
          {formatDate(plant.updated_at)}
        </span>
      </div>
    </motion.div>
  );
}
