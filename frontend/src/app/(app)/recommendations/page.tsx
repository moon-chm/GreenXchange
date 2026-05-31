"use client";

import { useState, useCallback } from "react";
import { motion, useReducedMotion, AnimatePresence } from "framer-motion";
import { MapPin, Sparkles } from "lucide-react";
import api from "@/lib/axios";
import { fadeUp, staggerContainer } from "@/lib/motion";
import SpeciesCard, { type Species } from "@/components/recommendations/SpeciesCard";
import EmptyState from "@/components/shared/EmptyState";

// ─── types ───────────────────────────────────────────────────────────────────

type FilterKey =
  | "Indoor"
  | "Outdoor"
  | "Beginner"
  | "Low Maintenance"
  | "Pet Safe"
  | "Child Safe";

const ALL_FILTERS: FilterKey[] = [
  "Indoor",
  "Outdoor",
  "Beginner",
  "Low Maintenance",
  "Pet Safe",
  "Child Safe",
];

// ─── skeleton card ────────────────────────────────────────────────────────────

function SkeletonCard() {
  return <div className="skeleton-shimmer rounded-2xl h-48" />;
}

// ─── page ────────────────────────────────────────────────────────────────────

export default function RecommendationsPage() {
  const shouldReduceMotion = useReducedMotion();

  // location
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [locError, setLocError] = useState<string | null>(null);
  const [locLoading, setLocLoading] = useState(false);

  // filters
  const [activeFilters, setActiveFilters] = useState<Set<FilterKey>>(new Set());

  // fetch state
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Species[]>([]);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [hasFetched, setHasFetched] = useState(false);

  // ── geolocation ─────────────────────────────────────────────────────────────

  const handleUseLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocError("Geolocation is not supported by your browser.");
      return;
    }
    setLocLoading(true);
    setLocError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(Number(pos.coords.latitude.toFixed(5)));
        setLng(Number(pos.coords.longitude.toFixed(5)));
        setLocLoading(false);
      },
      () => {
        setLocError("Unable to retrieve your location. Please allow location access.");
        setLocLoading(false);
      }
    );
  }, []);

  // ── filter toggle ────────────────────────────────────────────────────────────

  const toggleFilter = useCallback((key: FilterKey) => {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  // ── fetch recommendations ────────────────────────────────────────────────────

  const handleGetRecommendations = async () => {
    setLoading(true);
    setFetchError(null);
    setHasFetched(true);
    setResults([]);

    try {
      // Build POST body matching backend RecommendationRequest schema
      const body: Record<string, unknown> = {
        lat: lat ?? 0,
        lng: lng ?? 0,
        space_type: activeFilters.has("Indoor")
          ? "indoor"
          : "outdoor_garden",
        available_space: 10.0,
        indoor: activeFilters.has("Indoor"),
        has_pets: activeFilters.has("Pet Safe"),
        has_children: activeFilters.has("Child Safe"),
        allergies: [],
        experience_level: activeFilters.has("Beginner") ? "low" : "medium",
      };

      const res = await api.post<Species[]>("/recommendations/", body);
      setResults(Array.isArray(res.data) ? res.data : []);
    } catch {
      setFetchError(
        "We couldn't fetch recommendations right now. Please check your connection and try again."
      );
    } finally {
      setLoading(false);
    }
  };

  // ─── render ─────────────────────────────────────────────────────────────────

  return (
    <motion.div
      variants={shouldReduceMotion ? undefined : fadeUp}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* ── page heading ─────────────────────────────────────────────────── */}
      <div>
        <h1 className="font-display text-3xl font-semibold text-canopy">
          Plant Recommendations
        </h1>
        <p className="text-sm text-canopy/60 mt-1">
          AI-powered suggestions based on your local environment
        </p>
      </div>

      {/* ── location bar ─────────────────────────────────────────────────── */}
      <div className="rounded-2xl bg-white/80 border border-sage/40 p-4 flex flex-col sm:flex-row sm:items-center gap-3 shadow-card">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <MapPin className="w-5 h-5 text-fern shrink-0" />
          <span className="text-sm text-canopy/80 truncate">
            {lat !== null && lng !== null ? (
              <>
                <span className="font-mono text-fern">{lat}</span>
                <span className="text-canopy/40 mx-1">,</span>
                <span className="font-mono text-fern">{lng}</span>
              </>
            ) : (
              <span className="text-canopy/50">No location selected</span>
            )}
          </span>
        </div>

        <motion.button
          onClick={handleUseLocation}
          disabled={locLoading}
          whileTap={shouldReduceMotion ? undefined : { scale: 0.97 }}
          className="shrink-0 flex items-center gap-2 bg-fern hover:bg-forest text-parchment text-sm font-medium px-4 py-2 rounded-xl transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {locLoading ? (
            <span className="animate-spin inline-block w-4 h-4 border-2 border-parchment border-t-transparent rounded-full" />
          ) : (
            <MapPin className="w-4 h-4" />
          )}
          Use My Location
        </motion.button>

        {locError && (
          <p className="text-xs text-red-500 sm:col-span-2 w-full">{locError}</p>
        )}
      </div>

      {/* ── filter chips ─────────────────────────────────────────────────── */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {ALL_FILTERS.map((key) => {
          const isActive = activeFilters.has(key);
          return (
            <button
              key={key}
              onClick={() => toggleFilter(key)}
              className={`shrink-0 text-sm font-medium px-4 py-1.5 rounded-full border transition-colors ${
                isActive
                  ? "bg-fern/20 text-fern border-fern"
                  : "bg-white/60 text-canopy border-sage/40 hover:border-sage hover:bg-white/80"
              }`}
            >
              {key}
            </button>
          );
        })}
      </div>

      {/* ── CTA button ───────────────────────────────────────────────────── */}
      <motion.button
        onClick={handleGetRecommendations}
        disabled={loading}
        whileTap={shouldReduceMotion ? undefined : { scale: 0.97 }}
        className="w-full flex items-center justify-center gap-2 bg-fern hover:bg-forest text-parchment font-medium py-3 rounded-xl transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {loading ? (
          <span className="animate-spin inline-block w-5 h-5 border-2 border-parchment border-t-transparent rounded-full" />
        ) : (
          <Sparkles className="w-5 h-5" />
        )}
        {loading ? "Finding plants…" : "Get Recommendations"}
      </motion.button>

      {/* ── results area ─────────────────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        {loading ? (
          /* skeleton state */
          <motion.div
            key="skeletons"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-4"
          >
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </motion.div>
        ) : fetchError ? (
          /* error state */
          <motion.div
            key="error"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="rounded-2xl border border-sage/40 bg-white/80 backdrop-blur-sm shadow-card p-6 text-center"
          >
            <p className="text-canopy/70 text-sm">{fetchError}</p>
          </motion.div>
        ) : hasFetched && results.length === 0 ? (
          /* empty results after fetch */
          <motion.div
            key="no-results"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <EmptyState
              title="No plants matched"
              description="Try adjusting your filters or broadening your search criteria."
            />
          </motion.div>
        ) : !hasFetched ? (
          /* pre-fetch empty state */
          <motion.div
            key="pre-fetch"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <EmptyState
              title="Ready when you are"
              description="Configure your preferences above and hit 'Get Recommendations'."
            />
          </motion.div>
        ) : (
          /* results */
          <motion.div
            key="results"
            variants={shouldReduceMotion ? undefined : staggerContainer}
            initial="hidden"
            animate="visible"
            className="space-y-4"
          >
            {results.map((species) => (
              <SpeciesCard key={species.species_id} species={species} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
