"use client";
import { motion } from "framer-motion";
import LeafIcon from "@/components/icons/LeafIcon";

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export default function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="flex flex-col items-center justify-center py-16 px-8 text-center"
    >
      <div className="w-20 h-20 rounded-full bg-sage/20 flex items-center justify-center mb-6">
        <LeafIcon size={40} className="text-sage" />
      </div>
      <h3 className="font-display text-xl font-semibold text-canopy mb-2">{title}</h3>
      {description && (
        <p className="text-canopy/60 text-sm max-w-xs mb-6">{description}</p>
      )}
      {action}
    </motion.div>
  );
}
