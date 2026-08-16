"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import api from "@/lib/axios";
import { Camera, MapPin, Upload, Loader2, CheckCircle, ArrowLeft } from "lucide-react";
import { fadeUp } from "@/lib/motion";
import { extractErrorMessage } from "@/lib/utils";

export default function GrowthUpdatePage() {
  const { id } = useParams();
  const router = useRouter();
  const shouldReduce = useReducedMotion();

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locStatus, setLocStatus] = useState("Locating device...");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const requestLocation = useCallback(() => {
    setLocStatus("Requesting location access...");
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          setLocStatus("GPS Verified");
        },
        (err) => {
          console.error("GPS error:", err);
          setLocStatus("Permission denied or HTTP restricted. Tap to retry or use HTTPS.");
          if (!location) {
            setLocation({ lat: 28.6139, lng: 77.2090 });
          }
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    } else {
      setLocStatus("Geolocation not supported by browser");
      if (!location) {
        setLocation({ lat: 28.6139, lng: 77.2090 });
      }
    }
  }, [location]);

  useEffect(() => {
    requestLocation();
  }, []);


  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const f = e.target.files[0];
      setFile(f);
      setPreview(URL.createObjectURL(f));
    }
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!file || !location) return;

      setLoading(true);
      const formData = new FormData();
      formData.append("image", file);
      formData.append("lat", location.lat.toString());
      formData.append("lng", location.lng.toString());

      try {
        await api.post(`/plants/${id}/growth`, formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        setSuccess(true);
        setTimeout(() => {
          router.push("/plants");
        }, 2200);
      } catch (err: any) {
        alert(extractErrorMessage(err, "Failed to submit update"));
        setLoading(false);
      }
    },
    [file, location, id, router]
  );

  const containerAnim = shouldReduce ? {} : fadeUp;

  if (success) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white/80 border border-sage/40 rounded-2xl p-8 max-w-md w-full text-center shadow-panel backdrop-blur-sm flex flex-col items-center gap-4"
        >
          <div className="w-16 h-16 rounded-full bg-fern/10 flex items-center justify-center text-fern">
            <CheckCircle className="w-12 h-12" />
          </div>
          <h2 className="font-display text-2xl font-bold text-canopy">
            Update Submitted!
          </h2>
          <p className="text-sm text-canopy/60 leading-relaxed">
            Your plant's growth update is being verified using our environmental computer vision model. Points will be awarded upon validation.
          </p>
          <div className="w-8 h-8 border-2 border-fern/20 border-t-fern rounded-full animate-spin mt-2" />
        </motion.div>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto space-y-6">
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
            Capture your plant's progress for verified rewards.
          </p>
        </div>
      </motion.div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Upload Card */}
        <motion.div
          variants={containerAnim}
          initial={shouldReduce ? "visible" : "hidden"}
          animate="visible"
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-sage/60 rounded-2xl h-72 flex flex-col items-center justify-center cursor-pointer overflow-hidden relative bg-white/60 hover:bg-white/80 hover:border-fern/60 transition-all shadow-sm group"
        >
          {preview ? (
            <img src={preview} alt="Growth update preview" className="w-full h-full object-cover" />
          ) : (
            <div className="text-center p-6 flex flex-col items-center gap-3">
              <div className="w-12 h-12 bg-sage/20 rounded-xl flex items-center justify-center text-sage group-hover:text-fern group-hover:bg-fern/10 transition-colors">
                <Camera className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-semibold text-canopy">
                  Tap to capture or upload photo
                </p>
                <p className="text-xs text-canopy/50 mt-1">
                  EXIF metadata will be verified to validate environmental impact
                </p>
              </div>
            </div>
          )}
        </motion.div>

        <input
          type="file"
          ref={fileInputRef}
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFile}
        />

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
                Device Location
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
              Get GPS
            </button>
          </div>
        </motion.div>


        {/* Action Button */}
        <motion.button
          type="submit"
          disabled={!file || !location || loading}
          whileTap={shouldReduce ? undefined : { scale: 0.97 }}
          className="w-full bg-fern hover:bg-forest disabled:bg-sage/20 disabled:text-canopy/30 text-parchment font-semibold py-3.5 rounded-xl transition-all flex justify-center items-center text-sm shadow-md disabled:shadow-none"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Submitting for verification…
            </span>
          ) : (
            "Submit for Verification"
          )}
        </motion.button>
      </form>
    </div>
  );
}
