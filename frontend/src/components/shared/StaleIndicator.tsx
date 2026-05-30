"use client";
import { motion } from "framer-motion";
import { AlertTriangle } from "lucide-react";

interface StaleIndicatorProps {
  label?: string;
  lastUpdated?: string;
}

export default function StaleIndicator({
  label = "Data may be outdated",
  lastUpdated,
}: StaleIndicatorProps) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-xs font-medium mb-3">
      <motion.span
        className="w-2 h-2 rounded-full bg-amber-500 inline-block flex-shrink-0"
        animate={{ scale: [1, 1.3, 1], opacity: [0.6, 1, 0.6] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
      />
      <AlertTriangle size={12} className="flex-shrink-0" />
      <span>{label}{lastUpdated ? ` · Last updated ${lastUpdated}` : ""}</span>
    </div>
  );
}
