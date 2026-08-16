"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  AlertTriangle,
  Users,
  Newspaper,
  MapPin,
  ExternalLink,
  Clock,
} from "lucide-react";
import api from "@/lib/axios";
import { useAuth } from "@/context/AuthContext";
import EmptyState from "@/components/shared/EmptyState";
import { staggerContainer, staggerItem, fadeUp } from "@/lib/motion";

// ─── Types ────────────────────────────────────────────────────────────────────

type Category = "All" | "AQI Alerts" | "Drive Announcements" | "Awareness";

interface NewsItem {
  id: string;
  title: string;
  content_summary: string;
  source_url: string;
  category: string;
  tags: string[];
  published_at: string;
  dynamic_score: number;
  is_local: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES: Category[] = ["All", "AQI Alerts", "Drive Announcements", "Awareness"];

const CATEGORY_API_MAP: Record<string, string> = {
  "AQI Alerts": "alerts",
  "Drive Announcements": "community",
  Awareness: "environment",
};

const PAGE_SIZE = 10;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function timeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffSec < 60) return "Just now";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  if (diffSec < 172800) return "Yesterday";
  return `${Math.floor(diffSec / 86400)}d ago`;
}

function normalisedCategory(raw: string): string {
  const lower = raw.toLowerCase();
  if (lower === "alerts") return "AQI Alerts";
  if (lower === "community") return "Drive Announcements";
  if (lower === "environment") return "Awareness";
  if (lower === "tips") return "Tips";
  return raw.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// ─── Category pill styling ────────────────────────────────────────────────────

function getCategoryStyle(category: string): string {
  const lower = category.toLowerCase();
  if (lower.includes("aqi") || lower.includes("alert")) {
    return "bg-amber-100 text-amber-800 border border-amber-200";
  }
  if (lower.includes("drive") || lower.includes("community")) {
    return "bg-fern/15 text-fern border border-fern/30";
  }
  if (lower.includes("awareness") || lower.includes("environment") || lower.includes("tips")) {
    return "bg-sage/20 text-canopy border border-sage/40";
  }
  return "bg-white/60 text-canopy border border-sage/40";
}

function getCategoryIcon(category: string): React.ReactNode {
  const lower = category.toLowerCase();
  if (lower.includes("aqi") || lower.includes("alert")) {
    return <AlertTriangle size={28} className="text-amber-600" />;
  }
  if (lower.includes("drive") || lower.includes("community")) {
    return <Users size={28} className="text-fern" />;
  }
  return <Newspaper size={28} className="text-sage" />;
}

// ─── Skeleton card ────────────────────────────────────────────────────────────

function NewsCardSkeleton() {
  return (
    <div className="rounded-2xl border border-sage/40 bg-white/80 backdrop-blur-sm p-5 flex gap-4 animate-pulse">
      <div className="shrink-0 w-20 h-20 rounded-xl bg-sage/15" />
      <div className="flex-1 space-y-3 min-w-0">
        <div className="skeleton-shimmer rounded-xl h-4 w-24" />
        <div className="skeleton-shimmer rounded-xl h-5 w-3/4" />
        <div className="skeleton-shimmer rounded-xl h-4 w-full" />
        <div className="skeleton-shimmer rounded-xl h-4 w-2/3" />
        <div className="skeleton-shimmer rounded-xl h-1 w-full mt-2" />
      </div>
    </div>
  );
}

// ─── News card ────────────────────────────────────────────────────────────────

interface NewsCardProps {
  item: NewsItem;
  reducedMotion: boolean;
}

function NewsCard({ item, reducedMotion }: NewsCardProps) {
  const score = Math.max(0, Math.min(1, item.dynamic_score));
  const displayCategory = normalisedCategory(item.category);

  return (
    <motion.article
      variants={reducedMotion ? undefined : staggerItem}
      layout
      className="rounded-2xl border border-sage/40 bg-white/80 backdrop-blur-sm shadow-card p-5
                 flex flex-col sm:flex-row gap-4 group
                 hover:border-fern/40 hover:shadow-lg transition-shadow duration-200"
    >
      {/* Icon column */}
      <div className="shrink-0 w-20 h-20 rounded-xl bg-sage/15 flex items-center justify-center">
        {getCategoryIcon(item.category)}
      </div>

      {/* Content column */}
      <div className="flex-1 min-w-0 flex flex-col gap-2">
        {/* Top row: category pill + local badge */}
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getCategoryStyle(
              item.category
            )}`}
          >
            {displayCategory}
          </span>
          {item.is_local && (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-fern">
              <MapPin size={11} className="shrink-0" />
              Local
            </span>
          )}
        </div>

        {/* Title */}
        <h2 className="font-display text-base font-semibold text-canopy leading-snug line-clamp-2">
          {item.title}
        </h2>

        {/* Geo-score bar */}
        <div
          className="h-1 bg-sage/20 rounded-full overflow-hidden"
          title={`Local relevance score: ${(score * 100).toFixed(0)}%`}
          aria-label={`Local relevance score ${(score * 100).toFixed(0)}%`}
        >
          <div
            className="h-full bg-fern rounded-full transition-all duration-500"
            style={{ width: `${score * 100}%` }}
          />
        </div>

        {/* Summary */}
        <p className="text-sm text-canopy/60 leading-relaxed line-clamp-2">
          {item.content_summary}
        </p>

        {/* Footer: time + source */}
        <div className="flex items-center justify-between gap-4 mt-auto pt-1">
          <span className="inline-flex items-center gap-1.5 text-xs text-canopy/50">
            <Clock size={12} className="shrink-0" />
            {timeAgo(item.published_at)}
          </span>

          {item.source_url && (
            <a
              href={item.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-medium text-fern
                         hover:text-forest transition-colors duration-150"
              aria-label={`Read full story: ${item.title}`}
            >
              Read more
              <ExternalLink size={11} className="shrink-0" />
            </a>
          )}
        </div>
      </div>
    </motion.article>
  );
}

// ─── Category filter tabs ─────────────────────────────────────────────────────

interface FilterTabsProps {
  active: Category;
  onChange: (c: Category) => void;
}

function FilterTabs({ active, onChange }: FilterTabsProps) {
  return (
    <div
      role="tablist"
      aria-label="Filter news by category"
      className="flex flex-wrap gap-2"
    >
      {CATEGORIES.map((cat) => {
        const isActive = cat === active;
        return (
          <button
            key={cat}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(cat)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-150
              focus:outline-none focus-visible:ring-2 focus-visible:ring-fern/40
              ${
                isActive
                  ? "bg-fern text-parchment shadow-sm"
                  : "bg-white/60 text-canopy border border-sage/40 hover:border-fern/50"
              }`}
          >
            {cat}
          </button>
        );
      })}
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function NewsPage() {
  const { user } = useAuth();
  const reducedMotion = useReducedMotion() ?? false;

  const [activeCategory, setActiveCategory] = useState<Category>("All");
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [userLoc, setUserLoc] = useState<{ lat: number | null; lng: number | null }>({
    lat: null,
    lng: null,
  });

  // Fetch geolocation on mount
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        },
        () => {
          setUserLoc({ lat: 51.5072, lng: -0.1276 }); // London fallback
        },
        { timeout: 5000 }
      );
    } else {
      setUserLoc({ lat: 51.5072, lng: -0.1276 });
    }
  }, []);

  // ── Fetch ────────────────────────────────────────────────────────────────

  const fetchNews = useCallback(
    async (category: Category, pageNum: number, append = false) => {
      try {
        append ? setLoadingMore(true) : setLoading(true);
        setError(null);

        const params: Record<string, string | number> = {
          page: pageNum,
          page_size: PAGE_SIZE,
        };
        if (category !== "All") {
          params.category = CATEGORY_API_MAP[category] ?? category.toLowerCase();
        }
        if (userLoc.lat !== null && userLoc.lng !== null) {
          params.lat = userLoc.lat;
          params.lng = userLoc.lng;
        }

        const res = await api.get<NewsItem[]>("/news/feed", { params });
        const items: NewsItem[] = res.data ?? [];

        setNews((prev) => (append ? [...prev, ...items] : items));
        setHasMore(items.length === PAGE_SIZE);
      } catch (err) {
        console.error("Failed to fetch news:", err);
        setError("Failed to load news. Please try again.");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [userLoc]
  );

  // Initial + category-change load
  useEffect(() => {
    if (userLoc.lat === null || userLoc.lng === null) return;
    setPage(1);
    setNews([]);
    fetchNews(activeCategory, 1, false);
  }, [activeCategory, fetchNews, userLoc]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleCategoryChange = (cat: Category) => {
    if (cat === activeCategory) return;
    setActiveCategory(cat);
  };

  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchNews(activeCategory, nextPage, true);
  };

  // ── Render ────────────────────────────────────────────────────────────────

  const containerVariants = reducedMotion ? undefined : staggerContainer;
  const headingVariants = reducedMotion ? undefined : fadeUp;

  return (
    <div className="min-h-screen bg-parchment/30">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 space-y-8">

        {/* ── Page header ───────────────────────────────────────────────── */}
        <motion.header
          variants={headingVariants}
          initial="hidden"
          animate="visible"
          className="space-y-1"
        >
          <h1 className="font-display text-3xl sm:text-4xl font-semibold text-canopy tracking-tight">
            Environmental News
          </h1>
          <p className="text-canopy/60 text-sm sm:text-base">
            Locally relevant environmental updates and alerts
          </p>
        </motion.header>

        {/* ── Filter tabs ───────────────────────────────────────────────── */}
        <FilterTabs active={activeCategory} onChange={handleCategoryChange} />

        {/* ── Content ───────────────────────────────────────────────────── */}
        {loading ? (
          /* Skeleton */
          <div className="space-y-4" aria-busy="true" aria-label="Loading news">
            {Array.from({ length: 5 }).map((_, i) => (
              <NewsCardSkeleton key={i} />
            ))}
          </div>
        ) : error ? (
          /* Error state */
          <div
            role="alert"
            className="rounded-2xl border border-sage/40 bg-white/80 backdrop-blur-sm p-8 text-center"
          >
            <p className="text-canopy/70 text-sm">{error}</p>
            <motion.button
              whileTap={reducedMotion ? undefined : { scale: 0.97 }}
              onClick={() => fetchNews(activeCategory, 1, false)}
              className="mt-4 px-5 py-2 rounded-xl bg-fern hover:bg-forest text-parchment text-sm font-medium transition-colors duration-150"
            >
              Retry
            </motion.button>
          </div>
        ) : news.length === 0 ? (
          /* Empty state */
          <div className="rounded-2xl border border-sage/40 bg-white/80 backdrop-blur-sm">
            <EmptyState
              title="No news available"
              description={
                activeCategory === "All"
                  ? "Check back later for the latest environmental updates."
                  : `No ${activeCategory} articles at the moment.`
              }
            />
          </div>
        ) : (
          /* News list */
          <AnimatePresence mode="wait">
            <motion.div
              key={activeCategory}
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="space-y-4"
            >
              {news.map((item) => (
                <NewsCard key={item.id} item={item} reducedMotion={reducedMotion} />
              ))}
            </motion.div>
          </AnimatePresence>
        )}

        {/* ── Load more ─────────────────────────────────────────────────── */}
        {!loading && !error && news.length > 0 && hasMore && (
          <div className="flex justify-center pt-2">
            <motion.button
              whileTap={reducedMotion ? undefined : { scale: 0.97 }}
              onClick={handleLoadMore}
              disabled={loadingMore}
              className="px-8 py-2.5 rounded-xl bg-white/80 border border-sage/40
                         text-canopy text-sm font-medium
                         hover:border-fern hover:text-fern
                         disabled:opacity-50 disabled:cursor-not-allowed
                         transition-all duration-150 backdrop-blur-sm shadow-sm"
            >
              {loadingMore ? (
                <span className="inline-flex items-center gap-2">
                  <span
                    className="inline-block w-3.5 h-3.5 border-2 border-fern/40 border-t-fern rounded-full animate-spin"
                    aria-hidden="true"
                  />
                  Loading…
                </span>
              ) : (
                "Load more"
              )}
            </motion.button>
          </div>
        )}
      </div>
    </div>
  );
}
