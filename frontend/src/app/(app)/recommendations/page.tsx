"use client";

import { useState, useCallback } from "react";
import { motion, useReducedMotion, AnimatePresence } from "framer-motion";
import { MapPin, Sparkles, Search, BrainCircuit, CheckCircle2, AlertTriangle, ShieldCheck, Leaf } from "lucide-react";
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

const SUGGESTED_PLANTS = [
  "Neem",
  "Tulsi",
  "Snake Plant",
  "Peace Lily",
  "Monstera",
  "Aloe Vera",
  "Lavender",
  "Peepal Tree",
] as const;

interface XAIContribution {
  feature: string;
  weight_pct: number;
  score: number;
  impact: "positive" | "neutral" | "negative";
  reason: string;
}

interface PlantAnalysis {
  plant_name: string;
  scientific_name: string;
  overall_score: number;
  suitability_grade: string;
  xai_breakdown: XAIContribution[];
  genai_synthesis: string;
  microclimate_fit: string;
  carbon_offset_kg_year: number;
  care_guide: string;
  recommended_space: string;
}

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

  // general recommendation fetch state
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Species[]>([]);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [hasFetched, setHasFetched] = useState(false);

  // GenAI & XAI Custom Plant Analyzer State
  const [queryPlant, setQueryPlant] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<PlantAnalysis | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

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

  // ── handle GenAI & XAI Custom Plant Analysis ─────────────────────────────────

  const handleAnalyzePlant = async (plantNameInput?: string) => {
    const targetPlant = plantNameInput || queryPlant;
    if (!targetPlant.trim()) return;

    setAnalyzing(true);
    setAnalysisError(null);

    try {
      const body = {
        plant_name: targetPlant.trim(),
        lat: lat ?? 0,
        lng: lng ?? 0,
        space_type: activeFilters.has("Indoor") ? "indoor" : "outdoor_garden",
        experience_level: activeFilters.has("Beginner") ? "low" : "medium",
        has_pets: activeFilters.has("Pet Safe"),
        has_children: activeFilters.has("Child Safe"),
      };

      const res = await api.post<PlantAnalysis>("/recommendations/analyze", body);
      setAnalysisResult(res.data);
    } catch (err: any) {
      setAnalysisError(err?.response?.data?.detail || "Could not analyze the requested plant. Please try again.");
    } finally {
      setAnalyzing(false);
    }
  };

  // ─── render ─────────────────────────────────────────────────────────────────

  return (
    <motion.div
      variants={shouldReduceMotion ? undefined : fadeUp}
      initial="hidden"
      animate="visible"
      className="space-y-8"
    >
      {/* ── page heading ─────────────────────────────────────────────────── */}
      <div>
        <h1 className="font-display text-3xl font-semibold text-canopy tracking-tight">
          AI Plant Recommendations & XAI Analyzer
        </h1>
        <p className="text-sm text-canopy/60 mt-1">
          Explore explainable AI suggestions and test any plant against your local microclimate
        </p>
      </div>

      {/* ── SECTION 1: GenAI & Explainable AI (XAI) Plant Selection Analyzer ── */}
      <motion.section
        variants={fadeUp}
        className="rounded-3xl border border-fern/30 bg-gradient-to-br from-white via-parchment/40 to-fern/5 p-6 sm:p-8 shadow-card space-y-6"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-fern text-parchment flex items-center justify-center shadow-md">
              <BrainCircuit className="w-6 h-6" />
            </div>
            <div>
              <h2 className="font-display text-2xl font-bold text-canopy">
                Ask AI: Which Plant Do You Want to Grow?
              </h2>
              <p className="text-xs sm:text-sm text-canopy/70 font-sans mt-0.5">
                Type any plant name or tap a quick pick to get a <strong>GenAI & Explainable AI (XAI)</strong> breakdown.
              </p>
            </div>
          </div>
        </div>

        {/* Quick Suggestion Pills */}
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs font-semibold text-canopy/50 uppercase tracking-wider font-sans mr-1">Quick Picks:</span>
          {SUGGESTED_PLANTS.map((plant) => (
            <button
              key={plant}
              onClick={() => {
                setQueryPlant(plant);
                handleAnalyzePlant(plant);
              }}
              className="px-3 py-1 rounded-xl text-xs font-semibold font-sans bg-white border border-sage/40 text-canopy hover:border-fern hover:text-fern transition-all hover:shadow-sm"
            >
              + {plant}
            </button>
          ))}
        </div>

        {/* Search Input Bar */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-5 h-5 absolute left-4 top-3.5 text-canopy/40" />
            <input
              type="text"
              placeholder="Enter any plant (e.g. Neem, Jasmine, Ficus, Peepal, Lavender)..."
              value={queryPlant}
              onChange={(e) => setQueryPlant(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAnalyzePlant();
              }}
              className="w-full pl-12 pr-4 py-3 rounded-2xl border border-sage/40 bg-white/90 text-canopy font-sans text-sm focus:outline-none focus:ring-2 focus:ring-fern/50 shadow-inner"
            />
          </div>
          <button
            onClick={() => handleAnalyzePlant()}
            disabled={analyzing || !queryPlant.trim()}
            className="px-6 py-3 bg-fern hover:bg-forest text-parchment font-bold text-sm rounded-2xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-md shrink-0"
          >
            {analyzing ? (
              <span className="animate-spin inline-block w-4 h-4 border-2 border-parchment border-t-transparent rounded-full" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            {analyzing ? "Analyzing XAI..." : "Analyze with GenAI & XAI"}
          </button>
        </div>

        {analysisError && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm font-sans">
            {analysisError}
          </div>
        )}

        {/* Analysis Results Display */}
        {analysisResult && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="pt-6 border-t border-sage/30 space-y-6"
          >
            {/* Result Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-white border border-sage/30 shadow-sm">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-display text-2xl font-bold text-canopy">{analysisResult.plant_name}</h3>
                  <span className="text-xs font-mono italic text-canopy/60">({analysisResult.scientific_name})</span>
                </div>
                <p className="text-xs text-canopy/70 font-sans mt-1">Recommended Space: <strong>{analysisResult.recommended_space}</strong></p>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex flex-col items-end">
                  <span className="text-[10px] text-canopy/50 uppercase tracking-wider font-sans">Overall Fit</span>
                  <span className="font-display text-3xl font-extrabold text-canopy">{analysisResult.overall_score}<span className="text-sm font-normal text-canopy/60">/100</span></span>
                </div>
                <div className="w-14 h-14 rounded-2xl bg-fern text-parchment flex items-center justify-center font-display text-2xl font-bold shadow-md">
                  {analysisResult.suitability_grade}
                </div>
              </div>
            </div>

            {/* Explainable AI (XAI) Feature Contribution Breakdown */}
            <div className="p-5 rounded-2xl bg-white border border-sage/30 shadow-sm space-y-4">
              <div className="flex items-center gap-2">
                <BrainCircuit className="w-5 h-5 text-fern" />
                <h4 className="font-display text-lg font-bold text-canopy">Explainable AI (XAI) Attribution Weights</h4>
              </div>

              <div className="space-y-3">
                {analysisResult.xai_breakdown.map((item, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex items-center justify-between text-xs font-sans font-semibold text-canopy">
                      <span>{item.feature} <span className="text-canopy/50 font-normal">({item.weight_pct}% weight)</span></span>
                      <span className={item.impact === "positive" ? "text-emerald-700 font-bold" : item.impact === "negative" ? "text-rose-700 font-bold" : "text-amber-700 font-bold"}>
                        Score: {item.score}/100
                      </span>
                    </div>
                    <div className="w-full h-2.5 rounded-full bg-parchment/80 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${item.score}%` }}
                        transition={{ duration: 0.8, delay: idx * 0.1 }}
                        className={item.impact === "positive" ? "h-full bg-fern" : item.impact === "negative" ? "h-full bg-rose-500" : "h-full bg-amber-500"}
                      />
                    </div>
                    <p className="text-[11px] text-canopy/60 font-sans">{item.reason}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* GenAI Botanical Care & Environmental Impact Assessment */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              <div className="md:col-span-8 p-5 rounded-2xl bg-fern/10 border border-fern/20 space-y-2">
                <div className="flex items-center gap-2 text-fern font-bold font-display text-base">
                  <Sparkles className="w-5 h-5" />
                  GenAI Microclimate Synthesis Report
                </div>
                <p className="text-xs sm:text-sm text-canopy/80 font-sans leading-relaxed">
                  {analysisResult.genai_synthesis}
                </p>
                <div className="pt-2 text-xs font-sans text-canopy/70 border-t border-fern/15">
                  <strong>Care Guidance:</strong> {analysisResult.care_guide}
                </div>
              </div>

              <div className="md:col-span-4 p-5 rounded-2xl bg-white border border-sage/30 shadow-sm flex flex-col justify-between">
                <div className="flex items-center gap-2 text-canopy font-bold font-display text-sm">
                  <Leaf className="w-4 h-4 text-fern" />
                  Carbon Reduction Yield
                </div>
                <div className="py-3">
                  <span className="font-display text-3xl font-extrabold text-fern">~{analysisResult.carbon_offset_kg_year}</span>
                  <span className="text-xs font-sans text-canopy/60 ml-1">kg CO₂ / year</span>
                </div>
                <span className="text-[10px] text-canopy/50 font-sans">Verified atmospheric carbon sequestration projection</span>
              </div>
            </div>
          </motion.div>
        )}
      </motion.section>

      {/* ── SECTION 2: General Recommendations & Location Filters ── */}
      <div className="pt-4 border-t border-sage/30">
        <h2 className="font-display text-xl font-semibold text-canopy mb-3">
          Explore Environment-Matched Catalog
        </h2>

        {/* ── location bar ─────────────────────────────────────────────────── */}
        <div className="rounded-2xl bg-white/80 border border-sage/40 p-4 flex flex-col sm:flex-row sm:items-center gap-3 shadow-card mb-4">
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
        <div className="flex gap-2 overflow-x-auto pb-3 scrollbar-none">
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
          className="w-full flex items-center justify-center gap-2 bg-fern hover:bg-forest text-parchment font-medium py-3 rounded-xl transition-colors disabled:opacity-60 disabled:cursor-not-allowed shadow-sm"
        >
          {loading ? (
            <span className="animate-spin inline-block w-5 h-5 border-2 border-parchment border-t-transparent rounded-full" />
          ) : (
            <Sparkles className="w-5 h-5" />
          )}
          {loading ? "Finding plants…" : "Get Top Recommendations"}
        </motion.button>
      </div>

      {/* ── results area ─────────────────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        {loading ? (
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
          <motion.div
            key="pre-fetch"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <EmptyState
              title="Ready when you are"
              description="Configure your preferences above and hit 'Get Top Recommendations'."
            />
          </motion.div>
        ) : (
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

