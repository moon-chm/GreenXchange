"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Plus, Grid, Map as MapIcon, Sparkles, HeartHandshake } from "lucide-react";
import dynamic from "next/dynamic";
import api from "@/lib/axios";
import PlantCard from "@/components/plants/PlantCard";
import PlantRegistrationModal from "@/components/plants/PlantRegistrationModal";
import PlantDetailModal from "@/components/plants/PlantDetailModal";
import PlantCareAIModal from "@/components/plants/PlantCareAIModal";
import EmptyState from "@/components/shared/EmptyState";
import { staggerContainer, fadeUp } from "@/lib/motion";

const PlantMap = dynamic(() => import("@/components/plants/PlantMap"), { ssr: false });

type FilterStatus = "all" | "verified" | "pending" | "rejected";
type SortOption = "date" | "species";

interface Plant {
  id: string;
  scan_id: string;
  species_name: string;
  scientific_name?: string;
  common_name: string;
  planting_date: string;
  space_type: string;
  lat: number;
  lng: number;
  status?: "verified" | "pending" | "rejected";
  points_earned?: number;
  updated_at?: string;
}

export default function PlantsPage() {
  const [plants, setPlants] = useState<Plant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterStatus>("all");
  const [sortBy, setSortBy] = useState<SortOption>("date");
  const [viewMode, setViewMode] = useState<"card" | "map">("card");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPlant, setSelectedPlant] = useState<Plant | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isCareModalOpen, setIsCareModalOpen] = useState(false);
  const [careTargetPlant, setCareTargetPlant] = useState<string>("");
  const shouldReduce = useReducedMotion();

  const handleOpenDetails = useCallback((plant: Plant) => {
    setSelectedPlant(plant);
    setIsDetailOpen(true);
  }, []);

  const handleOpenCareAI = useCallback((plantName?: string) => {
    if (plantName) setCareTargetPlant(plantName);
    setIsCareModalOpen(true);
  }, []);

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

    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("register") === "true") {
        setIsModalOpen(true);
        const newUrl = window.location.pathname;
        window.history.replaceState({ path: newUrl }, "", newUrl);
      }
    }
  }, [fetchPlants]);

  // Filtering and Sorting
  const filteredPlants = plants.filter((plant) => {
    if (filter === "all") return true;
    return plant.status === filter;
  });

  const sortedPlants = [...filteredPlants].sort((a, b) => {
    if (sortBy === "species") {
      const nameA = a.common_name || a.species_name;
      const nameB = b.common_name || b.species_name;
      return nameA.localeCompare(nameB);
    }
    return new Date(b.updated_at || b.planting_date).getTime() - new Date(a.updated_at || a.planting_date).getTime();
  });

  const userPlantOptions = plants.map((p) => ({
    id: p.id,
    name: p.common_name || p.species_name,
  }));

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

        <div className="flex items-center gap-3">
          <motion.button
            whileTap={shouldReduce ? undefined : { scale: 0.97 }}
            onClick={() => handleOpenCareAI()}
            className="flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500/20 to-fern/20 border border-fern/40 text-canopy hover:border-fern px-4 py-3 rounded-xl text-sm font-bold transition-all shadow-sm"
          >
            🌱 Plant Care AI
          </motion.button>

          <motion.button
            whileTap={shouldReduce ? undefined : { scale: 0.97 }}
            onClick={() => setIsModalOpen(true)}
            className="flex items-center justify-center gap-2 bg-fern hover:bg-forest text-parchment px-5 py-3 rounded-xl text-sm font-semibold transition-all shadow-md shadow-fern/20 w-full sm:w-auto"
          >
            <Plus size={16} />
            Register Plant
          </motion.button>
        </div>
      </motion.div>

      {/* Sprout Nursery Care AI Banner */}
      <motion.div
        variants={fadeUp}
        initial={shouldReduce ? "visible" : "hidden"}
        animate="visible"
        className="rounded-3xl border border-amber-400/40 bg-gradient-to-r from-amber-500/10 via-parchment to-fern/10 p-5 sm:p-6 shadow-card flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
      >
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-fern to-forest text-parchment flex items-center justify-center text-2xl shadow-md shrink-0">
            🌱
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-display text-lg font-bold text-canopy">
                Ask Sprout: Plant Nursery Caretaker AI
              </h2>
              <span className="bg-amber-400/20 text-amber-900 border border-amber-500/30 text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full">
                Multi-lingual Guide
              </span>
            </div>
            <p className="text-xs text-canopy/70 font-sans mt-0.5">
              Get simple, expert guidance on water quantity (ml/cups), sunlight, fertilizer & secret nursery caretaker tips in your preferred language!
            </p>
          </div>
        </div>

        <button
          onClick={() => handleOpenCareAI()}
          className="px-5 py-2.5 bg-fern hover:bg-forest text-parchment font-bold text-xs rounded-xl transition-all shadow-md flex items-center gap-2 shrink-0"
        >
          <Sparkles size={14} />
          Get Nursery Care Guidance
        </button>
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

        {/* View Toggle */}
        <div className="flex items-center gap-1 bg-white/60 border border-sage/40 rounded-xl p-1 shadow-sm">
          <button
            onClick={() => setViewMode("card")}
            className={`p-1.5 rounded-lg transition-all ${
              viewMode === "card"
                ? "bg-fern text-parchment shadow-sm"
                : "text-canopy/60 hover:text-canopy hover:bg-sage/20"
            }`}
            title="Card View"
            aria-label="Switch to Card View"
          >
            <Grid size={16} />
          </button>
          <button
            onClick={() => setViewMode("map")}
            className={`p-1.5 rounded-lg transition-all ${
              viewMode === "map"
                ? "bg-fern text-parchment shadow-sm"
                : "text-canopy/60 hover:text-canopy hover:bg-sage/20"
            }`}
            title="Map View"
            aria-label="Switch to Map View"
          >
            <MapIcon size={16} />
          </button>
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
      ) : viewMode === "map" ? (
        <PlantMap myPlants={sortedPlants} onSelectPlant={handleOpenDetails} />
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
              <PlantCard
                key={plant.id}
                plant={plant}
                onClick={() => handleOpenDetails(plant)}
              />
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

      {/* Detail Modal */}
      <PlantDetailModal
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        plant={selectedPlant}
        onDelete={fetchPlants}
      />

      {/* Sprout Nursery Care AI Modal */}
      <PlantCareAIModal
        isOpen={isCareModalOpen}
        onClose={() => setIsCareModalOpen(false)}
        userPlants={userPlantOptions}
        defaultPlantName={careTargetPlant}
      />
    </div>
  );
}

