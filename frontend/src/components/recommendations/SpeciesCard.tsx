"use client";

import { useReducedMotion, motion } from "framer-motion";
import LeafIcon from "@/components/icons/LeafIcon";
import { staggerItem } from "@/lib/motion";
import api from "@/lib/axios";
import { useState } from "react";

export interface Species {
  species_id: string;
  common_name: string;
  scientific_name: string;
  /** 0–100 */
  co2_absorption: number;
  /** 1 = easy, 2 = medium, 3 = hard */
  maintenance_level: number;
  explanation: string;
}

interface SpeciesCardProps {
  species: Species;
}

export default function SpeciesCard({ species }: SpeciesCardProps) {
  const shouldReduceMotion = useReducedMotion();
  const [registering, setRegistering] = useState(false);
  const [registered, setRegistered] = useState(false);
  const [registerError, setRegisterError] = useState<string | null>(null);

  const clampedCo2 = Math.min(100, Math.max(0, species.co2_absorption ?? 0));
  const maintenanceDots = Math.min(3, Math.max(1, species.maintenance_level ?? 1));

  const handleRegister = async () => {
    setRegistering(true);
    setRegisterError(null);
    try {
      await api.post("/plants/register", { species_id: species.species_id });
      setRegistered(true);
    } catch {
      setRegisterError("Could not register this plant. Please try again.");
    } finally {
      setRegistering(false);
    }
  };

  return (
    <motion.div
      variants={staggerItem}
      whileHover={shouldReduceMotion ? undefined : { y: -4 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="rounded-2xl border border-sage/40 bg-white/80 backdrop-blur-sm shadow-card p-5 flex gap-4"
    >
      {/* Left: leaf icon thumbnail */}
      <div className="shrink-0 w-20 h-20 bg-sage/20 rounded-xl flex items-center justify-center">
        <LeafIcon size={32} className="text-fern" />
      </div>

      {/* Right: content */}
      <div className="flex-1 min-w-0">
        {/* Names */}
        <h3 className="font-display text-lg font-semibold text-canopy leading-snug truncate">
          {species.common_name}
        </h3>
        <p className="text-sm italic text-canopy/60 truncate">{species.scientific_name}</p>

        {/* CO₂ Absorption Bar */}
        <div className="mt-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-canopy/70">CO₂ Absorption</span>
            <span className="text-xs font-mono text-fern">{clampedCo2}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-sage/20 overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-fern"
              initial={{ width: "0%" }}
              animate={{ width: shouldReduceMotion ? `${clampedCo2}%` : `${clampedCo2}%` }}
              transition={
                shouldReduceMotion
                  ? { duration: 0 }
                  : { duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: 0.15 }
              }
            />
          </div>
        </div>

        {/* Maintenance dots */}
        <div className="flex items-center gap-2 mt-2">
          <span className="text-xs text-canopy/60">Maintenance:</span>
          <div className="flex gap-1">
            {[1, 2, 3].map((dot) => (
              <span
                key={dot}
                className={`w-2.5 h-2.5 rounded-full transition-colors ${
                  dot <= maintenanceDots
                    ? "bg-fern"
                    : "bg-sage/30"
                }`}
              />
            ))}
          </div>
          <span className="text-xs text-canopy/50">
            {maintenanceDots === 1 ? "Easy" : maintenanceDots === 2 ? "Moderate" : "High"}
          </span>
        </div>

        {/* Explanation */}
        {species.explanation && (
          <p className="text-sm text-canopy/70 mt-2 line-clamp-2 leading-relaxed">
            {species.explanation}
          </p>
        )}

        {/* Register button */}
        <div className="mt-3">
          {registered ? (
            <span className="inline-flex items-center gap-1.5 text-sm text-fern font-medium">
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Registered
            </span>
          ) : (
            <button
              onClick={handleRegister}
              disabled={registering}
              className="text-sm bg-fern/10 hover:bg-fern/20 text-fern border border-fern/30 px-4 py-2 rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {registering ? "Registering…" : "Register This Plant"}
            </button>
          )}
          {registerError && (
            <p className="text-xs text-red-500 mt-1">{registerError}</p>
          )}
        </div>
      </div>
    </motion.div>
  );
}
