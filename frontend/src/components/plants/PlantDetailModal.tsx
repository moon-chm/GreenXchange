"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { X, Calendar, MapPin, Coins, ExternalLink, Copy, Check, Leaf, Clock, Camera, Trash2, AlertTriangle } from "lucide-react";
import api from "@/lib/axios";
import StatusBadge from "@/components/shared/StatusBadge";

interface Plant {
  id: string;
  species_name: string;
  scientific_name?: string;
  scan_id: string;
  common_name: string;
  planting_date: string;
  space_type: string;
  lat: number;
  lng: number;
  status?: string;
  points_earned?: number;
}

interface GrowthUpdate {
  id: string;
  status: "pending" | "verified" | "rejected";
  stage: string | null;
  timestamp: string;
  image_url: string;
  confidence_score?: number | null;
  rejection_reason?: string | null;
}

interface PlantDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  plant: Plant | null;
  onDelete?: (plantId: string) => void;
}

function formatDate(dateString: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    }).format(new Date(dateString));
  } catch {
    return dateString;
  }
}

export default function PlantDetailModal({ isOpen, onClose, plant, onDelete }: PlantDetailModalProps) {
  const shouldReduceMotion = useReducedMotion();
  const [growthUpdates, setGrowthUpdates] = useState<GrowthUpdate[]>([]);
  const [loadingUpdates, setLoadingUpdates] = useState(false);
  const [copied, setCopied] = useState(false);

  // Delete confirmation states
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Fetch growth updates for this plant
  useEffect(() => {
    if (!plant || !isOpen) return;

    setLoadingUpdates(true);
    setGrowthUpdates([]);
    setConfirmingDelete(false);
    setDeleteError(null);

    api.get<GrowthUpdate[]>(`/plants/${plant.id}/growth`)
      .then((res) => {
        setGrowthUpdates(res.data ?? []);
      })
      .catch((err) => {
        console.error("Failed to load growth updates:", err);
      })
      .finally(() => {
        setLoadingUpdates(false);
      });
  }, [plant, isOpen]);

  const handleDeletePlant = async () => {
    if (!plant) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await api.delete(`/plants/${plant.id}`);
      setConfirmingDelete(false);
      onDelete?.(plant.id);
      onClose();
    } catch (err: any) {
      setDeleteError(err?.response?.data?.detail || "Failed to delete plant. Please try again.");
    } finally {
      setDeleting(false);
    }
  };

  const getPublicUrl = useCallback(() => {
    if (!plant) return "";
    if (typeof window !== "undefined") {
      let host = window.location.host;
      if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
        const port = window.location.port ? `:${window.location.port}` : "";
        host = `10.132.167.93${port}`;
      }
      return `${window.location.protocol}//${host}/plants/public/${plant.scan_id}`;
    }
    return `/plants/public/${plant.scan_id}`;
  }, [plant]);


  const handleCopyLink = () => {
    const url = getPublicUrl();
    if (!url) return;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!plant) return null;

  const displayStatus = (plant.status as "verified" | "pending" | "rejected") ?? "verified";
  const displayPoints = plant.points_earned ?? 10;
  const qrUrl = getPublicUrl();
  const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(qrUrl)}`;

  const overlayAnim = {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: 0.2 }
  };

  const modalAnim = shouldReduceMotion
    ? {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
        transition: { duration: 0.15 },
      }
    : {
        initial: { opacity: 0, scale: 0.94, y: 10 },
        animate: { opacity: 1, scale: 1, y: 0 },
        exit: { opacity: 0, scale: 0.94, y: 10 },
        transition: { duration: 0.25, ease: [0.22, 1, 0.36, 1] as const },
      };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="detail-overlay"
          {...overlayAnim}
          className="fixed inset-0 bg-canopy/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <motion.div
            key="detail-modal"
            {...modalAnim}
            className="bg-parchment rounded-2xl max-w-4xl w-full shadow-panel relative overflow-hidden flex flex-col md:flex-row max-h-[90vh] md:max-h-[85vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Action buttons (Delete & Close) */}
            <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
              <button
                onClick={() => setConfirmingDelete(true)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 hover:bg-rose-100 hover:text-rose-700 text-xs font-semibold transition-all shadow-xs"
                title="Delete Plant"
              >
                <Trash2 size={14} />
                <span className="hidden sm:inline">Delete Plant</span>
              </button>
              <button
                onClick={onClose}
                className="p-1.5 rounded-xl bg-white/80 border border-sage/20 text-canopy/50 hover:text-canopy hover:bg-white transition-colors"
                aria-label="Close details"
              >
                <X size={18} />
              </button>
            </div>

            {/* Double-Check Delete Confirmation Modal Overlay */}
            <AnimatePresence>
              {confirmingDelete && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-canopy/80 backdrop-blur-md z-50 flex items-center justify-center p-6 text-center"
                >
                  <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-rose-200 flex flex-col items-center gap-4"
                  >
                    <div className="w-14 h-14 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center shadow-inner">
                      <AlertTriangle size={30} />
                    </div>
                    <div className="space-y-1">
                      <h3 className="font-display font-bold text-canopy text-xl">Delete Plant Asset?</h3>
                      <p className="text-xs text-canopy/70 font-sans leading-relaxed">
                        Are you sure you want to delete <strong className="text-canopy font-semibold">{plant.common_name || plant.species_name}</strong>?
                        This will permanently delete its public verification passport, growth timeline, and rewards ledger records.
                      </p>
                      <p className="text-xs font-bold text-rose-600 mt-2">This action cannot be undone.</p>
                    </div>

                    {deleteError && (
                      <div className="w-full p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-sans">
                        {deleteError}
                      </div>
                    )}

                    <div className="flex items-center gap-3 w-full mt-2">
                      <button
                        onClick={() => setConfirmingDelete(false)}
                        disabled={deleting}
                        className="flex-1 py-2.5 rounded-xl border border-sage/40 text-canopy hover:bg-sage/10 text-xs font-bold font-sans transition-all disabled:opacity-50"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleDeletePlant}
                        disabled={deleting}
                        className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold font-sans transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        {deleting ? (
                          <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                        ) : (
                          <Trash2 size={14} />
                        )}
                        {deleting ? "Deleting..." : "Yes, Delete Plant"}
                      </button>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>


            {/* Left Column: Plant Specs & Info */}
            <div className="flex-1 p-6 md:p-8 flex flex-col gap-6 overflow-y-auto border-r border-sage/20">
              <div className="flex items-center gap-3">
                <StatusBadge status={displayStatus} />
                <span className="flex items-center gap-1 text-fern text-sm font-semibold">
                  <Coins size={14} />
                  {displayPoints} GXC Tokens
                </span>
              </div>

              {/* Plant Headers */}
              <div>
                <h2 className="font-display text-2xl md:text-3xl font-bold text-canopy leading-tight">
                  {plant.common_name || plant.species_name}
                </h2>
                <p className="text-sm italic text-canopy/60 mt-1">
                  {plant.scientific_name || plant.species_name}
                </p>
              </div>

              {/* Spec Grid */}
              <div className="grid grid-cols-2 gap-4 bg-white/60 border border-sage/30 rounded-2xl p-4">
                <div className="flex items-start gap-2.5">
                  <Leaf size={16} className="text-fern mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[10px] uppercase tracking-wider font-semibold text-canopy/40">Space Type</p>
                    <p className="text-xs font-semibold text-canopy capitalize mt-0.5">{plant.space_type.replace("_", " ")}</p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <Calendar size={16} className="text-fern mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[10px] uppercase tracking-wider font-semibold text-canopy/40">Date Planted</p>
                    <p className="text-xs font-semibold text-canopy mt-0.5">{formatDate(plant.planting_date)}</p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <MapPin size={16} className="text-fern mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[10px] uppercase tracking-wider font-semibold text-canopy/40">Coordinates</p>
                    <p className="text-xs font-mono text-canopy mt-0.5">{plant.lat.toFixed(4)}, {plant.lng.toFixed(4)}</p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <Clock size={16} className="text-fern mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[10px] uppercase tracking-wider font-semibold text-canopy/40">Scan ID</p>
                    <p className="text-xs font-mono text-canopy mt-0.5">{plant.scan_id}</p>
                  </div>
                </div>
              </div>

              {/* QR Code Segment */}
              <div className="flex flex-col sm:flex-row items-center gap-5 bg-white/80 border border-sage/40 rounded-2xl p-5 shadow-sm">
                <div className="w-32 h-32 bg-white rounded-xl border border-sage/20 flex items-center justify-center p-2 shadow-inner shrink-0">
                  <img src={qrApiUrl} alt="Unique Plant QR Link" className="w-full h-full object-contain" />
                </div>
                <div className="flex-1 min-w-0 flex flex-col gap-2.5 text-center sm:text-left">
                  <div>
                    <h4 className="font-display font-semibold text-canopy text-sm">Unique Plant Passport</h4>
                    <p className="text-xs text-canopy/60 leading-normal mt-0.5">
                      This unique QR code points to your plant's public verification passport. Anyone who scans it can view the planting location, owner ledger, and growth timeline.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={handleCopyLink}
                      className="inline-flex items-center justify-center gap-1.5 bg-fern hover:bg-forest text-parchment text-xs font-semibold px-3.5 py-2 rounded-xl transition-all shadow-sm active:scale-95 cursor-pointer"
                    >
                      {copied ? <Check size={13} /> : <Copy size={13} />}
                      {copied ? "Copied!" : "Copy Link"}
                    </button>
                    <a
                      href={qrUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-1.5 bg-sage/20 border border-sage/40 hover:border-fern/50 text-canopy hover:text-fern text-xs font-semibold px-3.5 py-2 rounded-xl transition-all cursor-pointer"
                    >
                      View Live
                      <ExternalLink size={13} />
                    </a>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Growth Timeline */}
            <div className="flex-1 p-6 md:p-8 bg-sage/5 overflow-y-auto flex flex-col gap-5 max-h-[45vh] md:max-h-full">
              <div className="flex items-center gap-2">
                <Camera size={18} className="text-fern" />
                <h3 className="font-display text-lg font-semibold text-canopy">
                  Growth Timeline
                </h3>
              </div>

              {loadingUpdates ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-3 py-10">
                  <div className="w-6 h-6 border-2 border-fern/30 border-t-fern rounded-full animate-spin"></div>
                  <p className="text-xs text-canopy/40">Loading growth timeline…</p>
                </div>
              ) : growthUpdates.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-2 border border-dashed border-sage/60 rounded-2xl p-6 py-10 text-center bg-white/40">
                  <Camera size={24} className="text-canopy/30" />
                  <p className="font-display font-semibold text-canopy/60 text-sm">No updates submitted yet</p>
                  <p className="text-xs text-canopy/50 max-w-xs mt-0.5 leading-normal">
                    Submit growth photos to verify your plant's progress and earn additional GXC token rewards on the ledger!
                  </p>
                </div>
              ) : (
                <div className="relative pl-6 border-l border-sage/40 space-y-6 flex-1 py-1">
                  {growthUpdates.map((update, idx) => {
                    const isVerified = update.status === "verified";
                    return (
                      <div key={update.id} className="relative">
                        {/* Timeline node dot */}
                        <div className={`absolute left-[-29px] top-1.5 w-3.5 h-3.5 rounded-full border-2 border-parchment flex items-center justify-center ${
                          isVerified ? "bg-fern" : update.status === "rejected" ? "bg-red-500" : "bg-amber-500"
                        }`} />

                        <div className="bg-white/80 border border-sage/30 rounded-2xl p-4 flex gap-4 shadow-sm hover:border-fern/30 transition-all">
                          {/* Update thumbnail image */}
                          <div className="w-16 h-16 rounded-xl overflow-hidden bg-sage/10 border border-sage/20 shrink-0 shadow-inner">
                            <img
                              src={update.image_url.startsWith("http") ? update.image_url : `http://localhost/api${update.image_url}`}
                              alt={update.stage || "Growth Update"}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                // Fallback image if resource loads slow/fails
                                (e.target as HTMLImageElement).src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2'%3E%3Cpath d='M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 3.5 1 9.8a7 7 0 0 1-9 8.2Z'/%3E%3C/svg%3E";
                              }}
                            />
                          </div>

                          <div className="flex-1 min-w-0 flex flex-col gap-0.5 justify-center">
                            <div className="flex items-center justify-between gap-2">
                              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                                isVerified
                                  ? "bg-fern/10 text-fern border-fern/20"
                                  : update.status === "rejected"
                                  ? "bg-red-500/10 text-red-700 border-red-500/20"
                                  : "bg-amber-500/10 text-amber-700 border-amber-500/20"
                              }`}>
                                {update.status.toUpperCase()}
                              </span>
                              <span className="text-[10px] text-canopy/40">
                                {new Date(update.timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                              </span>
                            </div>
                            <h4 className="font-display font-semibold text-canopy text-sm mt-1">
                              {update.stage || "Unidentified Stage"}
                            </h4>
                            {update.confidence_score !== undefined && update.confidence_score !== null && (
                              <p className="text-[10px] text-fern font-mono font-medium">
                                AI Confidence: {(update.confidence_score * 100).toFixed(1)}%
                              </p>
                            )}
                            {update.rejection_reason && (
                              <p className="text-[10px] text-red-600 line-clamp-1" title={update.rejection_reason}>
                                {update.rejection_reason}
                              </p>
                            )}
                            <p className="text-[9px] text-canopy/40 truncate">ID: {update.id.substring(0, 8)}...</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
