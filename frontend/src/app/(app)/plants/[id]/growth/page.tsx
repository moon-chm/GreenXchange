"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import api from "@/lib/axios";
import { MapPin, Loader2, CheckCircle, ArrowLeft, ShieldAlert, HeartPulse, TreePine, Award } from "lucide-react";
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
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locStatus, setLocStatus] = useState("Acquiring GPS coordinates...");
  const [loading, setLoading] = useState(false);
  const submittingRef = useRef(false);
  const locationRequestRef = useRef(0);
  const [error, setError] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<{
    status: string;
    growth_stage?: string;
    confidence_score?: number;
    analysis?: AnalysisResult;
  } | null>(null);

  const requestLocation = useCallback(() => {
    const requestId = ++locationRequestRef.current;
    setLocation(null);
    setLocStatus("Requesting location access...");
    if (typeof window !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (requestId !== locationRequestRef.current) return;
          setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          setLocStatus("Location acquired");
        },
        (err) => {
          if (requestId !== locationRequestRef.current) return;
          console.warn("GPS error:", err);
          setLocStatus("Location unavailable. Allow location access and try again.");
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    } else {
      setLocStatus("Location unavailable. Allow location access and try again.");
    }
  }, []);

  useEffect(() => {
    requestLocation();
    return () => { locationRequestRef.current += 1; };
  }, [requestLocation]);

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
      if (submittingRef.current) return;
      if (!file || !location) {
        setError("Add a plant photo and enable location before submitting.");
        return;
      }

      submittingRef.current = true;
      const activeCoords = location;
      setError(null);
      setLoading(true);
      const formData = new FormData();
      formData.append("image", file);
      formData.append("lat", activeCoords.lat.toString());
      formData.append("lng", activeCoords.lng.toString());

      try {
        // POST to /api/growth/{id}/growth — unambiguous, always registered
        const res = await api.post(`/growth/${id}/growth`, formData, {
          headers: { "Content-Type": undefined },
          timeout: 90000,
        });

        setSuccessResult({
          status: res?.data?.verification_status || "PENDING",
          growth_stage: res?.data?.growth_stage,
          confidence_score: res?.data?.confidence_score,
          analysis: res?.data?.analysis,
        });

      } catch (err: unknown) {
        setError(extractErrorMessage(err, "Could not submit your update. Please try again."));
      } finally {
        submittingRef.current = false;
        setLoading(false);
      }
    },
    [file, location, id]
  );

  const containerAnim = shouldReduce ? {} : fadeUp;

  if (successResult) {
    const isVerified = successResult.status.toUpperCase() === "VERIFIED";
    const analysis = successResult.analysis;
    const healthStatus = analysis?.health_status || "Not assessed";
    const isHealthy = analysis?.is_healthy === true;

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
              {isVerified ? "Growth Update Verified!" : successResult.status.toUpperCase() === "REJECTED" ? "Update Not Verified" : "Update Submitted for Review"}
            </h2>
            <p className="text-sm text-canopy/70 mt-1">
              {analysis?.summary_reason || "Your update has been saved. Review the results below."}
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
                {typeof analysis?.tree_confidence === "number" ? `${(analysis.tree_confidence * 100).toFixed(1)}% confidence` : "Not assessed"}
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
                <span>Rewards</span>
              </div>
              <span className="text-xs font-bold text-fern">
                {isVerified ? "Check your rewards balance" : "Not confirmed"}
              </span>
            </div>
          </div>

          <button type="button" onClick={() => router.push("/plants")} className="min-h-11 rounded-xl bg-fern px-5 py-3 text-white font-semibold">Back to My Plants</button>
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
            Add a recent photo and your location to record plant growth.
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
            sublabel="Take a clear photo with the plant and foliage in view."
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

        {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>}
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
              Submitting and checking your photo…
            </span>
          ) : (
            "Submit Live Growth Update"
          )}
        </motion.button>
      </form>
    </div>
  );
}
