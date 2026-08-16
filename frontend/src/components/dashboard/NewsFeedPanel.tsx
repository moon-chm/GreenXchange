"use client";

import { useReducedMotion, motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import Link from "next/link";
import { Newspaper, AlertTriangle, Users, MapPin, ArrowRight, Sparkles, Wind, Lightbulb, ShieldAlert, X, ExternalLink } from "lucide-react";
import StaleIndicator from "@/components/shared/StaleIndicator";
import { fadeUp, staggerContainer, staggerItem } from "@/lib/motion";

interface NewsItem {
  id: string;
  title: string;
  content_summary: string;
  category: string;
  is_local: boolean;
  published_at?: string;
  source_url?: string;
}

interface NewsFeedPanelProps {
  stale: boolean;
  data: NewsItem[] | null;
  loading?: boolean;
}

function getCategoryBadge(category: string): { style: string; icon: React.ReactNode } {
  const lower = category.toLowerCase();
  if (lower.includes("environment") || lower.includes("aqi") || lower.includes("air")) {
    return {
      style: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20",
      icon: <Wind size={10} className="text-emerald-600" />
    };
  }
  if (lower.includes("community") || lower.includes("drive")) {
    return {
      style: "bg-fern/15 text-fern border-fern/30",
      icon: <Users size={10} className="text-fern" />
    };
  }
  if (lower.includes("tips") || lower.includes("gardening")) {
    return {
      style: "bg-amber-500/10 text-amber-800 border-amber-500/20",
      icon: <Lightbulb size={10} className="text-amber-600" />
    };
  }
  return {
    style: "bg-rose-500/10 text-rose-700 border-rose-500/20",
    icon: <ShieldAlert size={10} className="text-rose-600" />
  };
}

function formatRelativeTime(publishedAt?: string): string {
  if (!publishedAt) return "Recently";
  const diff = Date.now() - new Date(publishedAt).getTime();
  const hrs = Math.floor(diff / 3600000);
  if (hrs < 1) return "Just now";
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
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
  const [selectedArticle, setSelectedArticle] = useState<NewsItem | null>(null);

  if (loading) return <Skeleton />;

  const items = data?.slice(0, 3) ?? [];

  return (
    <>
      <motion.div
        variants={fadeUp}
        initial={shouldReduce ? "visible" : "hidden"}
        animate="visible"
        className="rounded-2xl border border-sage/40 bg-white/80 backdrop-blur-sm shadow-card p-6 flex flex-col gap-4 h-full"
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-fern/10 text-fern flex items-center justify-center">
              <Newspaper size={18} />
            </div>
            <div>
              <h2 className="font-display text-xl font-semibold text-canopy leading-tight">
                Local Updates
              </h2>
              <p className="text-[10px] text-canopy/50">Climate & Environmental Intelligence</p>
            </div>
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
            {items.map((item) => {
              const badge = getCategoryBadge(item.category);
              return (
                <motion.li
                  key={item.id}
                  variants={shouldReduce ? undefined : staggerItem}
                  onClick={() => setSelectedArticle(item)}
                  className="group rounded-xl border border-sage/20 bg-sage/5 hover:bg-sage/10 transition-all duration-150 p-4 flex flex-col gap-2 cursor-pointer"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase border ${badge.style}`}>
                      {badge.icon}
                      {item.category.replace(/_/g, " ")}
                    </span>
                    
                    <div className="flex items-center gap-2">
                      {item.is_local && (
                        <span className="flex items-center gap-0.5 text-[10px] font-bold text-fern bg-fern/10 px-2 py-0.5 rounded-full">
                          <MapPin size={9} />
                          Local
                        </span>
                      )}
                      <span className="text-[10px] text-canopy/40">
                        {formatRelativeTime(item.published_at)}
                      </span>
                    </div>
                  </div>
                  
                  <h3 className="font-display text-sm font-semibold text-canopy leading-snug line-clamp-1 group-hover:text-fern transition-colors duration-150">
                    {item.title}
                  </h3>
                  
                  <p className="text-xs text-canopy/60 line-clamp-2 leading-relaxed">
                    {item.content_summary}
                  </p>
                </motion.li>
              );
            })}
          </motion.ul>
        )}

        {/* Footer link */}
        <Link
          href="/news"
          className="flex items-center justify-center gap-1.5 text-sm font-semibold text-fern hover:text-forest transition-colors duration-150 pt-2 border-t border-sage/20 mt-auto"
        >
          View full intelligence feed
          <ArrowRight size={14} />
        </Link>
      </motion.div>

      {/* Article Quick Read Modal */}
      <AnimatePresence>
        {selectedArticle && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-canopy/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedArticle(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-parchment rounded-3xl p-6 max-w-lg w-full shadow-panel border border-sage/40 relative space-y-4"
            >
              <div className="flex items-start justify-between">
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-fern/10 text-fern">
                  <Sparkles size={12} />
                  {selectedArticle.category.replace(/_/g, " ")}
                </span>
                <button
                  onClick={() => setSelectedArticle(null)}
                  className="p-1.5 rounded-xl text-canopy/50 hover:text-canopy hover:bg-sage/20 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              <h2 className="font-display font-bold text-xl text-canopy leading-tight">
                {selectedArticle.title}
              </h2>

              <p className="text-sm text-canopy/75 leading-relaxed bg-white/60 border border-sage/20 rounded-2xl p-4">
                {selectedArticle.content_summary}
              </p>

              <div className="flex items-center justify-between pt-2">
                <span className="text-xs text-canopy/50">
                  Published: {formatRelativeTime(selectedArticle.published_at)}
                </span>
                {selectedArticle.source_url && (
                  <a
                    href={selectedArticle.source_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 bg-fern hover:bg-forest text-parchment text-xs font-semibold px-4 py-2 rounded-xl transition-colors shadow-sm"
                  >
                    Read Source
                    <ExternalLink size={12} />
                  </a>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

