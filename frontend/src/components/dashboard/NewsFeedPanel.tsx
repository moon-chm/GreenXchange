"use client";

import { useReducedMotion, motion } from "framer-motion";
import Link from "next/link";
import { Newspaper, AlertTriangle, Users, MapPin, ArrowRight } from "lucide-react";
import StaleIndicator from "@/components/shared/StaleIndicator";
import { fadeUp, staggerContainer, staggerItem } from "@/lib/motion";

interface NewsItem {
  id: string;
  title: string;
  content_summary: string;
  category: string;
  is_local: boolean;
}

interface NewsFeedPanelProps {
  stale: boolean;
  data: NewsItem[] | null;
  loading?: boolean;
}

function getCategoryStyle(category: string): string {
  const lower = category.toLowerCase();
  if (lower.includes("aqi")) {
    return "bg-amber-100 text-amber-800 border border-amber-200";
  }
  if (lower.includes("drive")) {
    return "bg-fern/15 text-fern border border-fern/30";
  }
  if (lower.includes("awareness")) {
    return "bg-sage/20 text-canopy border border-sage/40";
  }
  return "bg-white/60 text-canopy border border-sage/40";
}

function Skeleton() {
  return (
    <div className="rounded-2xl border border-sage/40 bg-white/80 backdrop-blur-sm shadow-card p-6 flex flex-col gap-4">
      <div className="skeleton-shimmer rounded-xl h-6 w-32" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="space-y-2 border border-sage/10 p-3 rounded-xl">
          <div className="skeleton-shimmer rounded-lg h-4 w-3/4" />
          <div className="skeleton-shimmer rounded-lg h-3 w-1/2" />
        </div>
      ))}
    </div>
  );
}

export default function NewsFeedPanel({
  stale,
  data,
  loading = false,
}: NewsFeedPanelProps) {
  const shouldReduce = useReducedMotion();

  if (loading) return <Skeleton />;

  const items = data?.slice(0, 3) ?? [];

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
          <Newspaper size={18} className="text-fern" />
          <h2 className="font-display text-xl font-semibold text-canopy">
            Local Updates
          </h2>
        </div>
        {stale && (
          <span className="flex items-center gap-1 text-xs font-medium bg-amber-500/10 text-amber-700 px-2 py-1 rounded-lg border border-amber-400/30">
            Stale
          </span>
        )}
      </div>

      {stale && !data && <StaleIndicator label="News feed unavailable" />}

      {/* News list */}
      {items.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm text-canopy/40 text-center py-4">
            No recent local updates.
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
          {items.map((item) => (
            <motion.li
              key={item.id}
              variants={shouldReduce ? undefined : staggerItem}
              className="group rounded-xl border border-sage/20 bg-sage/5 hover:bg-sage/10 transition-all duration-150 p-4 flex flex-col gap-1.5"
            >
              <div className="flex items-start justify-between gap-2">
                <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide uppercase ${getCategoryStyle(item.category)}`}>
                  {item.category.replace(/_/g, " ")}
                </span>
                {item.is_local && (
                  <span className="flex items-center gap-0.5 text-[10px] font-medium text-fern">
                    <MapPin size={10} className="text-fern" />
                    Local
                  </span>
                )}
              </div>
              
              <h3 className="font-display text-sm font-semibold text-canopy leading-snug line-clamp-1 group-hover:text-fern transition-colors duration-150">
                {item.title}
              </h3>
              
              <p className="text-xs text-canopy/60 line-clamp-2 leading-relaxed">
                {item.content_summary}
              </p>
            </motion.li>
          ))}
        </motion.ul>
      )}

      {/* Footer link */}
      <Link
        href="/news"
        className="flex items-center justify-center gap-1.5 text-sm font-medium text-fern hover:text-forest transition-colors duration-150 pt-1 border-t border-sage/20 mt-auto"
      >
        View full feed
        <ArrowRight size={14} />
      </Link>
    </motion.div>
  );
}
