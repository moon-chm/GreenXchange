"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Plus } from "lucide-react";
import api from "@/lib/axios";
import PlantCard from "@/components/plants/PlantCard";
import PlantRegistrationModal from "@/components/plants/PlantRegistrationModal";
import EmptyState from "@/components/shared/EmptyState";
import { staggerContainer, fadeUp } from "@/lib/motion";

type FilterStatus = "all" | "verified" | "pending" | "rejected";
type SortOption = "date" | "species";

interface Plant {
  id: string;
  species_name: string;
  scientific_name?: string;
  qr_scan_id: string;
  status: "verified" | "pending" | "rejected";
  points_earned: number;
  updated_at: string;
}

export default function PlantsPage() {
  const [plants, setPlants] = useState<Plant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterStatus>("all");
  const [sortBy, setSortBy] = useState<SortOption>("date");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const shouldReduce = useReducedMotion();

  const fetchPlants = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get<Plant[]>("/plants/my");
      setPlants(res.data ?? []);
    } catch (err) {
      console.error("Failed to fetch plants:", err);
      setError("Failed to load plants. Please try again later.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPlants();
  }, [fetchPlants]);

  // Filtering and Sorting
  const filteredPlants = plants.filter((plant) => {
    if (filter === "all") return true;
    return plant.status === filter;
  });

  const sortedPlants = [...filteredPlants].sort((a, b) => {
    if (sortBy === "species") {
      return a.species_name.localeCompare(b.species_name);
    }
    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
  });

  return (
    <div className="space-y-6">
      {/* Heading */}
      <motion.div
        variants={fadeUp}
        initial={shouldReduce ? "visible" : "hidden"}
        animate="visible"
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-sage/40 pb-6"
      >
        <div>
          <h1 className="font-display text-3xl sm:text-4xl font-semibold text-canopy tracking-tight">
            My Plants
          </h1>
          <p className="text-canopy/60 text-sm sm:text-base mt-1">
            Manage your registered environmental assets and track their points.
          </p>
        </div>

        <motion.button
          whileTap={shouldReduce ? undefined : { scale: 0.97 }}
          onClick={() => setIsModalOpen(true)}
          className="flex items-center justify-center gap-2 bg-fern hover:bg-forest text-parchment px-5 py-3 rounded-xl text-sm font-semibold transition-all shadow-md shadow-fern/20 w-full sm:w-auto"
        >
          <Plus size={16} />
          Register Plant
        </motion.button>
      </motion.div>

      {/* Filter and Sort Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        {/* Filter Pills */}
        <div className="flex flex-wrap gap-2">
          {(["all", "verified", "pending", "rejected"] as const).map((status) => {
            const isActive = filter === status;
            return (
              <button
                key={status}
                onClick={() => setFilter(status)}
                className={`px-4 py-2 rounded-xl text-xs font-semibold capitalize tracking-wide border transition-all duration-200 ${
                  isActive
                    ? "bg-fern text-parchment border-fern shadow-sm"
                    : "bg-white/60 text-canopy border-sage/40 hover:border-fern/50"
                }`}
              >
                {status}
              </button>
            );
          })}
        </div>

        {/* Sort Select */}
        <div className="flex items-center gap-2">
          <label htmlFor="sortBy" className="text-xs font-semibold text-canopy/60">
            Sort by:
          </label>
          <select
            id="sortBy"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="px-3 py-2 rounded-xl border border-sage/40 focus:border-fern bg-white/60 text-xs font-semibold text-canopy outline-none cursor-pointer"
          >
            <option value="date">Last Updated</option>
            <option value="species">Species Name</option>
          </select>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[0, 1, 2, 3, 5].map((i) => (
            <div
              key={i}
              className="rounded-2xl border border-sage/40 bg-white/80 p-5 flex flex-col gap-3 animate-pulse h-[220px]"
            >
              <div className="bg-sage/15 rounded-xl h-32 w-full skeleton-shimmer" />
              <div className="skeleton-shimmer h-5 w-2/3 rounded-lg" />
              <div className="skeleton-shimmer h-4 w-1/3 rounded-lg mt-auto" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-sage/40 bg-white/80 p-8 text-center max-w-md mx-auto">
          <p className="text-sm text-canopy/70 font-medium">{error}</p>
          <button
            onClick={fetchPlants}
            className="mt-4 px-5 py-2 rounded-xl bg-fern hover:bg-forest text-parchment text-xs font-semibold transition-colors"
          >
            Try Again
          </button>
        </div>
      ) : sortedPlants.length === 0 ? (
        <div className="rounded-2xl border border-sage/40 bg-white/80">
          <EmptyState
            title="No plants found"
            description={
              filter === "all"
                ? "You haven't registered any plants yet. Tap the button in the top right to start!"
                : `No plants matching the "${filter}" filter status.`
            }
          />
        </div>
      ) : (
        <AnimatePresence mode="popLayout">
          <motion.div
            variants={shouldReduce ? undefined : staggerContainer}
            initial={shouldReduce ? "visible" : "hidden"}
            animate="visible"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {sortedPlants.map((plant) => (
              <PlantCard key={plant.id} plant={plant} />
            ))}
          </motion.div>
        </AnimatePresence>
      )}

      {/* Registration Modal */}
      <PlantRegistrationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={fetchPlants}
      />
    </div>
  );
}
