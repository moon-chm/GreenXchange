"use client";

import { useReducedMotion, motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Plus, QrCode, ExternalLink, Leaf, Award, X, ShieldCheck, Copy, Check } from "lucide-react";
import StatusBadge from "@/components/shared/StatusBadge";
import StaleIndicator from "@/components/shared/StaleIndicator";
import { staggerContainer, staggerItem, fadeUp } from "@/lib/motion";

interface Plant {
  id: string;
  scan_id: string;
  common_name?: string;
  species_name: string;
  planting_date: string;
  status: "verified" | "pending" | "rejected" | "active" | "inactive";
  image_url?: string;
}

interface PlantPortfolioPanelProps {
  stale: boolean;
  data: Plant[] | null;
  loading?: boolean;
}

function PlantCardImage({ plant }: { plant: Plant }) {
  const [hasError, setHasError] = useState(false);

  if (plant.image_url && !hasError) {
    return (
      <img
        src={plant.image_url}
        alt={plant.common_name || plant.species_name}
        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        onError={() => setHasError(true)}
      />
    );
  }

  return (
    <div className="flex flex-col items-center justify-center gap-1 text-fern">
      <div className="w-10 h-10 rounded-full bg-fern/10 flex items-center justify-center">
        <Leaf size={20} />
      </div>
      <span className="text-[10px] font-semibold text-canopy/40 uppercase tracking-wider">
        Asset #{(plant.scan_id || "").slice(-6)}
      </span>
    </div>
  );
}

function PlantCardSkeleton() {
  return (
    <div className="rounded-2xl border border-sage/40 bg-white/80 backdrop-blur-sm shadow-card p-6 flex flex-col gap-3">
      <div className="bg-sage/20 rounded-xl h-24 skeleton-shimmer" />
      <div className="skeleton-shimmer rounded-xl h-5 w-3/4" />
      <div className="skeleton-shimmer rounded-xl h-3 w-1/2" />
      <div className="skeleton-shimmer rounded-full h-5 w-16" />
    </div>
  );
}

export default function PlantPortfolioPanel({
  stale,
  data,
  loading = false,
}: PlantPortfolioPanelProps) {
  const shouldReduce = useReducedMotion();
  const router = useRouter();
  const [selectedPassport, setSelectedPassport] = useState<Plant | null>(null);
  const [copied, setCopied] = useState(false);

  const plants = data ?? [];

  const copyPassportLink = (scanId: string) => {
    const url = `${window.location.origin}/plants/public/${scanId}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <motion.section
        variants={fadeUp}
        initial={shouldReduce ? "visible" : "hidden"}
        animate="visible"
        className="rounded-2xl border border-sage/40 bg-white/80 backdrop-blur-sm shadow-card p-6"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-fern/10 text-fern flex items-center justify-center">
              <QrCode size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display text-xl font-semibold text-canopy">
                  My Plant Portfolio
                </h2>
                <span className="bg-fern/15 text-fern font-bold text-xs px-2.5 py-0.5 rounded-full">
                  {plants.length} Assets
                </span>
              </div>
              <p className="text-[10px] text-canopy/50">Verified Proof-of-Planting Ledger</p>
            </div>
          </div>
          {stale && !loading && (
            <span className="flex items-center gap-1 text-xs font-medium bg-amber-500/10 text-amber-700 px-2 py-1 rounded-lg border border-amber-400/30">
              Stale
            </span>
          )}
        </div>

        {stale && !loading && !data && (
          <StaleIndicator label="Plant data unavailable" />
        )}

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[0, 1, 2, 3].map((i) => (
              <PlantCardSkeleton key={i} />
            ))}
          </div>
        ) : (
          <motion.div
            variants={shouldReduce ? undefined : staggerContainer}
            initial={shouldReduce ? "visible" : "hidden"}
            animate="visible"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            {plants.map((plant) => (
              <motion.div
                key={plant.id}
                variants={shouldReduce ? undefined : staggerItem}
                onClick={() => router.push(`/plants/${plant.id}/growth`)}
                className="group rounded-2xl border border-sage/40 bg-white/80 backdrop-blur-sm shadow-card p-5 cursor-pointer hover:border-fern/60 hover:shadow-md transition-all duration-200 flex flex-col gap-3 relative"
              >
                {/* Plant Photo or Custom Icon Container */}
                <div className="bg-sage/15 border border-sage/20 rounded-xl h-28 overflow-hidden flex items-center justify-center group-hover:bg-fern/10 transition-colors duration-200 shadow-inner relative">
                  <PlantCardImage plant={plant} />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedPassport(plant);
                    }}
                    className="absolute top-2 right-2 bg-black/50 hover:bg-black/80 backdrop-blur-md text-white font-mono text-[9px] px-2 py-1 rounded-full font-semibold flex items-center gap-1 transition-all"
                    title="View QR Passport Modal"
                  >
                    <QrCode size={11} />
                    ID: {plant.scan_id}
                  </button>
                </div>

                {/* Species */}
                <div className="flex-1">
                  <p className="font-display text-base font-semibold text-canopy leading-tight line-clamp-1 group-hover:text-fern transition-colors">
                    {plant.common_name || plant.species_name}
                  </p>
                  {plant.common_name && (
                    <p className="text-xs text-canopy/50 italic mt-0.5 line-clamp-1">
                      {plant.species_name}
                    </p>
                  )}
                </div>

                {/* Status & Passport quick link */}
                <div className="flex items-center justify-between pt-2 border-t border-sage/20">
                  <StatusBadge status={plant.status} />

                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-canopy/40 font-medium">
                      {new Date(plant.planting_date).toLocaleDateString("en-US", {
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedPassport(plant);
                      }}
                      className="p-1.5 rounded-lg bg-fern/10 hover:bg-fern/20 text-fern transition-colors"
                      title="Open QR Passport"
                    >
                      <QrCode size={14} />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}

            {/* Register new plant card */}
            <motion.button
              variants={shouldReduce ? undefined : staggerItem}
              onClick={() => router.push("/plants?register=true")}
              className="rounded-2xl border-2 border-dashed border-sage/50 bg-transparent hover:border-fern hover:bg-fern/5 transition-all duration-200 p-5 flex flex-col items-center justify-center gap-3 cursor-pointer min-h-[200px] group"
              aria-label="Register a new plant"
            >
              <div className="w-12 h-12 rounded-xl bg-sage/20 group-hover:bg-fern/15 flex items-center justify-center transition-colors duration-200">
                <Plus size={24} className="text-sage group-hover:text-fern transition-colors duration-200" />
              </div>
              <div className="text-center">
                <span className="font-sans text-sm font-semibold text-canopy/70 group-hover:text-fern transition-colors duration-200 block">
                  Register New Plant
                </span>
                <span className="text-[11px] text-canopy/40 block mt-0.5">
                  Earn +50 GXC Tokens with GPS Proof
                </span>
              </div>
            </motion.button>
          </motion.div>
        )}
      </motion.section>

      {/* QR Passport Modal */}
      <AnimatePresence>
        {selectedPassport && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-canopy/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedPassport(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 15 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-parchment rounded-3xl p-6 max-w-sm w-full shadow-panel border border-sage/40 relative flex flex-col items-center text-center space-y-4"
            >
              <button
                onClick={() => setSelectedPassport(null)}
                className="absolute top-4 right-4 p-1.5 rounded-xl text-canopy/50 hover:text-canopy hover:bg-sage/20 transition-colors"
              >
                <X size={18} />
              </button>

              <div className="flex items-center gap-1.5 bg-forest text-parchment text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full">
                <ShieldCheck size={12} className="text-emerald-400" />
                Verified Plant Passport
              </div>

              {/* QR Image Visual */}
              <div className="p-4 bg-white border border-sage/30 rounded-2xl shadow-inner">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(
                    `${typeof window !== "undefined" ? window.location.origin : ""}/plants/public/${selectedPassport.scan_id}`
                  )}`}
                  alt="QR Passport Code"
                  className="w-40 h-40 object-contain"
                />
              </div>

              <div>
                <h3 className="font-display text-lg font-bold text-canopy">
                  {selectedPassport.common_name || selectedPassport.species_name}
                </h3>
                <p className="font-mono text-xs text-canopy/50 font-semibold mt-0.5">
                  ID: {selectedPassport.scan_id}
                </p>
              </div>

              <div className="w-full flex items-center gap-2 pt-2 border-t border-sage/20">
                <button
                  onClick={() => copyPassportLink(selectedPassport.scan_id)}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 bg-sage/20 hover:bg-sage/30 text-canopy text-xs font-semibold py-2.5 rounded-xl transition-colors"
                >
                  {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                  {copied ? "Copied Link!" : "Copy Passport Link"}
                </button>

                <a
                  href={`/plants/public/${selectedPassport.scan_id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center p-2.5 bg-fern hover:bg-forest text-parchment rounded-xl transition-colors shadow-sm"
                  title="Open Public Passport"
                >
                  <ExternalLink size={16} />
                </a>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}


