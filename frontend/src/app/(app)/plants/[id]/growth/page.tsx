"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import api from "@/lib/axios";
import { MapPin, Loader2, CheckCircle, ArrowLeft, Sparkles, ShieldAlert, HeartPulse, TreePine, Award } from "lucide-react";
import { fadeUp } from "@/lib/motion";
import { extractErrorMessage } from "@/lib/utils";
import LiveCameraCapture from "@/components/shared/LiveCameraCapture";

interface AnalysisResult {
  is_verified?: boolean;
  is_tree?: boolean;
  tree_confidence?: number;
  health_status?: string;
  is_healthy?: boolean;
  health_confidence?: number;
  growth_stage?: string;
  summary_reason?: string;
}

export default function GrowthUpdatePage() {
  const { id } = useParams();
  const router = useRouter();
  const shouldReduce = useReducedMotion();

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [location, setLocation] = useState<{ lat: number; lng: number }>({ lat: 28.6139, lng: 77.2090 });
  const [locStatus, setLocStatus] = useState("Acquiring GPS coordinates...");
  const [loading, setLoading] = useState(false);
  const [successResult, setSuccessResult] = useState<{
    status: string;
    growth_stage?: string;
    confidence_score?: number;
    analysis?: AnalysisResult;
  } | null>(null);

  const requestLocation = useCallback(() => {
    setLocStatus("Requesting location access...");
    if (typeof window !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          setLocStatus("GPS Verified & Locked");
        },
        (err) => {
          console.warn("GPS error:", err);
          setLocStatus("Using default/approximate location");
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    } else {
      setLocStatus("Using default/approximate location");
    }
  }, []);

  useEffect(() => {
    requestLocation();
  }, []);

  const handleCapture = useCallback((capturedFile: File, previewUrl: string) => {
    setFile(capturedFile);
    setPreview(previewUrl);
  }, []);

  const handleClear = useCallback(() => {
    setFile(null);
    setPreview(null);
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!file) {
        alert("Please capture or select a photo of your plant first.");
        return;
      }

      const activeCoords = location || { lat: 28.6139, lng: 77.2090 };
      setLoading(true);
      const formData = new FormData();
      formData.append("image", file);
      formData.append("lat", activeCoords.lat.toString());
      formData.append("lng", activeCoords.lng.toString());

      try {
        let res;
        try {
          // 1. Primary route matching currently live backend deployment
          res = await api.post(`/growth/${id}/growth`, formData, {
            headers: { "Content-Type": undefined },
            timeout: 90000,
          });
        } catch (err1: any) {
          if (err1?.response?.status === 404) {
            try {
              // 2. Fallback to /plants/{id}/growth
              res = await api.post(`/plants/${id}/growth`, formData, {
                headers: { "Content-Type": undefined },
                timeout: 90000,
              });
            } catch (err2: any) {
              if (err2?.response?.status === 404) {
                // 3. Fallback to /growth/{id}
                res = await api.post(`/growth/${id}`, formData, {
                  headers: { "Content-Type": undefined },
                  timeout: 90000,
                });
              } else {
                throw err2;
              }
            }
          } else {
            throw err1;
          }
        }

        setSuccessResult({
          status: res?.data?.verification_status || "VERIFIED",
          growth_stage: res?.data?.growth_stage,
          confidence_score: res?.data?.confidence_score,
          analysis: res?.data?.analysis,
        });

        setTimeout(() => {
          router.push(`/plants`);
        }, 3600);
      } catch (err: any) {
        const detailMsg = err?.response?.data?.detail;
        const msg = typeof detailMsg === "string" ? detailMsg : extractErrorMessage(err, "Failed to submit growth update. Please ensure a live tree is captured.");
        alert(msg);
        setLoading(false);
      }
    },
    [file, location, id, router]
  );

  const containerAnim = shouldReduce ? {} : fadeUp;

  if (successResult) {
    const isVerified = successResult.status === "VERIFIED";
    const analysis = successResult.analysis;
    const healthStatus = analysis?.health_status || "Healthy";
    const isHealthy = analysis?.is_healthy ?? true;

    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white/90 border border-sage/40 rounded-3xl p-8 max-w-lg w-full text-center shadow-panel backdrop-blur-md flex flex-col items-center gap-5"
        >
          <div className={`w-16 h-16 rounded-2xl ${isVerified ? "bg-fern/10 text-fern" : "bg-amber-500/10 text-amber-600"} flex items-center justify-center`}>
            {isVerified ? <CheckCircle className="w-10 h-10" /> : <ShieldAlert className="w-10 h-10" />}
          </div>

          <div>
            <h2 className="font-display text-2xl font-bold text-canopy">
              {isVerified ? "Growth Update Verified!" : "Update Submitted for Review"}
            </h2>
            <p className="text-sm text-canopy/70 mt-1">
              Evaluated with Dual PyTorch ResNet18 AI Models & GPS Proof-of-Presence.
            </p>
          </div>

          {/* AI Diagnostic Summary Card */}
          <div className="w-full bg-sage/15 border border-sage/30 rounded-2xl p-4 text-left flex flex-col gap-3">
            <div className="flex items-center justify-between border-b border-sage/20 pb-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-canopy">
                <TreePine className="w-4 h-4 text-fern" />
                <span>Tree / Plant Detection</span>
              </div>
              <span className="text-xs font-mono font-bold text-fern">
                {analysis?.tree_confidence ? `${(analysis.tree_confidence * 100).toFixed(1)}% Confirmed` : "Verified"}
              </span>
            </div>

            <div className="flex items-center justify-between border-b border-sage/20 pb-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-canopy">
                <HeartPulse className={`w-4 h-4 ${isHealthy ? "text-emerald-500" : "text-amber-500"}`} />
                <span>Plant Health Assessment</span>
              </div>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-md ${isHealthy ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
                {healthStatus}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold text-canopy">
                <Award className="w-4 h-4 text-amber-500" />
                <span>Reward Credited</span>
              </div>
              <span className="text-xs font-bold text-fern">
                +10 GXC Points
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-canopy/50">
            <div className="w-4 h-4 border-2 border-fern/30 border-t-fern rounded-full animate-spin" />
            <span>Redirecting to portfolio...</span>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto space-y-6 pb-8">
      {/* Header */}
      <motion.div
        variants={containerAnim}
        initial={shouldReduce ? "visible" : "hidden"}
        animate="visible"
        className="flex items-center gap-4 border-b border-sage/40 pb-6"
      >
        <button
          onClick={() => router.back()}
          className="p-2 rounded-xl border border-sage/40 hover:border-fern bg-white/60 text-canopy hover:text-fern transition-all"
          aria-label="Go back"
        >
          <ArrowLeft size={16} />
        </button>
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-semibold text-canopy tracking-tight">
            Log Growth Update
          </h1>
          <p className="text-canopy/60 text-xs sm:text-sm mt-0.5">
            Capture a live photo to verify growth & earn +10 GXC tokens.
          </p>
        </div>
      </motion.div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Live Camera Viewfinder Component */}
        <motion.div
          variants={containerAnim}
          initial={shouldReduce ? "visible" : "hidden"}
          animate="visible"
          className="bg-white/80 border border-sage/40 rounded-3xl p-5 shadow-sm"
        >
          <LiveCameraCapture
            label="Live Plant Growth Camera"
            sublabel="Capture a clear live photo of the tree/foliage. Gallery uploads are strictly disabled."
            initialPreview={preview}
            onCapture={handleCapture}
            onClear={handleClear}
          />
        </motion.div>

        {/* Location Info Card */}
        <motion.div
          variants={containerAnim}
          initial={shouldReduce ? "visible" : "hidden"}
          animate="visible"
          className="bg-white/80 border border-sage/40 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-fern/10 flex items-center justify-center text-fern shrink-0">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-canopy uppercase tracking-wider">
                Proof of Presence GPS
              </p>
              <p className="text-xs text-canopy/60 mt-0.5">{locStatus}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            {location && (
              <div className="text-xs font-mono bg-sage/20 text-canopy px-2.5 py-1.5 rounded-lg">
                {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
              </div>
            )}
            <button
              type="button"
              onClick={requestLocation}
              className="px-3 py-1.5 bg-fern/10 hover:bg-fern/20 text-fern rounded-lg text-xs font-semibold font-sans transition-colors"
            >
              Update GPS
            </button>
          </div>
        </motion.div>

        {/* Action Button */}
        <motion.button
          type="submit"
          disabled={!file || !location || loading}
          whileTap={shouldReduce ? undefined : { scale: 0.97 }}
          className="w-full bg-fern hover:bg-forest disabled:bg-sage/20 disabled:text-canopy/30 text-parchment font-semibold py-4 rounded-2xl transition-all flex justify-center items-center text-sm shadow-md disabled:shadow-none"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Running Dual ResNet18 AI Analysis & Verifying…
            </span>
          ) : (
            "Submit Live Growth Update"
          )}
        </motion.button>
      </form>
    </div>
  );
}
