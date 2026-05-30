"use client";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

type Status = "verified" | "pending" | "rejected" | "active" | "inactive";

const statusConfig: Record<Status, { label: string; classes: string; pulse?: boolean }> = {
  verified: {
    label: "Verified",
    classes: "bg-fern/15 text-fern border border-fern/30",
  },
  pending: {
    label: "Pending",
    classes: "bg-amber-500/15 text-amber-700 border border-amber-400/30",
    pulse: true,
  },
  rejected: {
    label: "Rejected",
    classes: "bg-red-500/15 text-red-700 border border-red-400/30",
  },
  active: {
    label: "Active",
    classes: "bg-fern/15 text-fern border border-fern/30",
  },
  inactive: {
    label: "Inactive",
    classes: "bg-sage/20 text-canopy/60 border border-sage/30",
  },
};

export default function StatusBadge({
  status,
  className,
}: {
  status: Status;
  className?: string;
}) {
  const config = statusConfig[status] ?? statusConfig.pending;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium font-sans uppercase tracking-wide",
        config.classes,
        className
      )}
    >
      {config.pulse ? (
        <motion.span
          className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block"
          animate={{ scale: [1, 1.4, 1], opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        />
      ) : (
        <span className="w-1.5 h-1.5 rounded-full bg-current inline-block opacity-70" />
      )}
      {config.label}
    </span>
  );
}
