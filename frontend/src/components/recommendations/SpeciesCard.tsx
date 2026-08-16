"use client";

import { useReducedMotion, motion } from "framer-motion";
import LeafIcon from "@/components/icons/LeafIcon";
import { staggerItem } from "@/lib/motion";
import api from "@/lib/axios";
import { useState } from "react";
import { extractErrorMessage } from "@/lib/utils";
import { Sparkles, Check, Info, ShieldCheck, Heart } from "lucide-react";

export interface Species {
  species_id: string;
  common_name: string;
  scientific_name: string;
  pollution_absorption_score?: number;
  co2_absorption?: number;
  maintenance_level?: string | number;
  explanation: string;
  care_guidance?: string;
  score?: number;
}

interface SpeciesCardProps {
  species: Species;
}

function getMaintenanceTextAndDots(level?: string | number): { text: string; dots: number } {
  if (typeof level === "number") {
    const dots = Math.min(3, Math.max(1, level));
    return { text: dots === 1 ? "Low" : dots === 2 ? "Moderate" : "High", dots };
  }
  const str = (level || "Low").toLowerCase();
  if (str.includes("low") || str.includes("easy")) return { text: "Low", dots: 1 };
  if (str.includes("high") || str.includes("hard")) return { text: "High", dots: 3 };
  return { text: "Moderate", dots: 2 };
}

export default function SpeciesCard({ species }: SpeciesCardProps) {
  const shouldReduceMotion = useReducedMotion();
  const [registering, setRegistering] = useState(false);
  const [registered, setRegistered] = useState(false);
  const [registerError, setRegisterError] = useState<string | null>(null);

  const absorptionScore = Math.min(
    100,
    Math.max(0, species.pollution_absorption_score ?? species.co2_absorption ?? 75)
  );
  const matchScore = species.score ? Math.round(species.score) : 92;
  const { text: maintText, dots: maintDots } = getMaintenanceTextAndDots(species.maintenance_level);

  const handleRegister = async () => {
    setRegistering(true);
    setRegisterError(null);
    
    const getCoordinates = () => {
      return new Promise<{ lat: number; lng: number }>((resolve, reject) => {
        if (!navigator.geolocation) {
          resolve({ lat: 28.6139, lng: 77.2090 });
          return;
        }
        navigator.geolocation.getCurrentPosition(
          (position) => {
            resolve({
              lat: position.coords.latitude,
              lng: position.coords.longitude,
            });
          },
          () => {
            resolve({ lat: 28.6139, lng: 77.2090 });
          }
        );
      });
    };

    try {
      const coords = await getCoordinates();
      await api.post("/plants/register", {
        species_id: species.species_id,
        lat: coords.lat,
        lng: coords.lng,
        planting_date: new Date().toISOString(),
        space_type: "indoor",
      });
      setRegistered(true);
    } catch (err) {
      setRegisterError(extractErrorMessage(err, "Could not register this plant. Please try again."));
    } finally {
      setRegistering(false);
    }
  };

  return (
    <motion.div
      variants={staggerItem}
      whileHover={shouldReduceMotion ? undefined : { y: -4 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="rounded-2xl border border-sage/40 bg-white/90 backdrop-blur-sm shadow-card p-5 sm:p-6 flex flex-col sm:flex-row gap-5 relative overflow-hidden group"
    >
      {/* Match Score Badge */}
      <div className="absolute top-4 right-4 bg-fern/10 border border-fern/20 text-fern px-3 py-1 rounded-full text-xs font-bold font-sans flex items-center gap-1">
        <Sparkles size={12} />
        {matchScore}% Match
      </div>

      {/* Thumbnail */}
      <div className="shrink-0 w-20 h-20 sm:w-24 sm:h-24 bg-sage/15 border border-sage/30 rounded-2xl flex flex-col items-center justify-center text-fern group-hover:bg-fern/10 transition-colors">
        <LeafIcon size={36} />
      </div>

      {/* Main Info */}
      <div className="flex-1 min-w-0 pr-16 sm:pr-24 space-y-2.5">
        <div>
          <h3 className="font-display text-xl font-bold text-canopy leading-tight truncate">
            {species.common_name}
          </h3>
          <p className="text-xs italic text-canopy/60 font-serif truncate mt-0.5">{species.scientific_name}</p>
        </div>

        {/* Metric Badges */}
        <div className="flex flex-wrap items-center gap-4 text-xs font-sans">
          {/* Air Filtration */}
          <div className="flex items-center gap-2 flex-1 min-w-[140px]">
            <span className="text-canopy/60 font-medium">Air Filtration:</span>
            <div className="flex-1 h-2 rounded-full bg-sage/20 overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-fern"
                initial={{ width: "0%" }}
                animate={{ width: `${absorptionScore}%` }}
                transition={{ duration: 0.8, ease: "easeOut" }}
              />
            </div>
            <span className="font-bold text-fern">{absorptionScore}/100</span>
          </div>

          {/* Maintenance */}
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-canopy/60 font-medium">Care:</span>
            <div className="flex gap-1">
              {[1, 2, 3].map((dot) => (
                <span
                  key={dot}
                  className={`w-2 h-2 rounded-full ${
                    dot <= maintDots ? "bg-fern" : "bg-sage/30"
                  }`}
                />
              ))}
            </div>
            <span className="font-semibold text-canopy">{maintText}</span>
          </div>
        </div>

        {/* Explanation */}
        {species.explanation && (
          <p className="text-xs sm:text-sm text-canopy/80 leading-relaxed font-sans bg-sage/5 border border-sage/20 rounded-xl p-3">
            {species.explanation}
          </p>
        )}

        {/* Care Guidance */}
        {species.care_guidance && (
          <p className="text-[11px] text-canopy/60 italic font-sans flex items-center gap-1">
            <Info size={12} className="text-fern shrink-0" />
            Care Tip: {species.care_guidance}
          </p>
        )}

        {/* Action Button */}
        <div className="pt-1 flex items-center gap-3">
          {registered ? (
            <span className="inline-flex items-center gap-1.5 text-xs text-fern font-bold bg-fern/10 px-3 py-1.5 rounded-xl border border-fern/20">
              <Check size={14} />
              Plant Registered to Portfolio (+50 GXC)
            </span>
          ) : (
            <button
              onClick={handleRegister}
              disabled={registering}
              className="text-xs font-semibold bg-fern hover:bg-forest text-parchment px-4 py-2 rounded-xl transition-all shadow-sm disabled:opacity-60 flex items-center gap-1.5"
            >
              {registering ? (
                <span className="animate-spin w-3 h-3 border-2 border-parchment border-t-transparent rounded-full" />
              ) : (
                <LeafIcon size={14} />
              )}
              {registering ? "Registering…" : "Register to My Portfolio"}
            </button>
          )}
          {registerError && (
            <p className="text-xs text-red-500">{registerError}</p>
          )}
        </div>
      </div>
    </motion.div>
  );
}

