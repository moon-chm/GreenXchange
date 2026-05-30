"use client";

import { useReducedMotion, motion } from "framer-motion";
import { Wind, Thermometer, Droplets, AlertTriangle } from "lucide-react";
import AnimatedNumber from "@/components/shared/AnimatedNumber";
import StaleIndicator from "@/components/shared/StaleIndicator";
import { aqiColor, aqiLabel } from "@/lib/palette";
import { fadeUp } from "@/lib/motion";

interface EnvironmentData {
  aqi: number;
  pm25: number;
  temperature: number;
  humidity: number;
}

interface EnvironmentalPanelProps {
  stale: boolean;
  data: EnvironmentData | null;
  loading?: boolean;
}

function Skeleton() {
  return (
    <div className="rounded-2xl border border-sage/40 bg-forest/90 p-6 h-full min-h-[260px] flex flex-col gap-4">
      <div className="skeleton-shimmer rounded-xl h-6 w-32 opacity-40" />
      <div className="skeleton-shimmer rounded-xl h-20 w-24 opacity-30" />
      <div className="skeleton-shimmer rounded-xl h-2 w-full opacity-30" />
      <div className="flex gap-2 mt-auto">
        {[0, 1, 2].map((i) => (
          <div key={i} className="skeleton-shimmer rounded-full h-8 flex-1 opacity-30" />
        ))}
      </div>
    </div>
  );
}

export default function EnvironmentalPanel({
  stale,
  data,
  loading = false,
}: EnvironmentalPanelProps) {
  const shouldReduce = useReducedMotion();

  if (loading) return <Skeleton />;

  const aqi = data?.aqi ?? 0;
  const color = aqiColor(aqi);
  const label = aqiLabel(aqi);
  const progressPct = Math.min((aqi / 500) * 100, 100);

  return (
    <motion.div
      variants={fadeUp}
      initial={shouldReduce ? "visible" : "hidden"}
      animate="visible"
      className="rounded-2xl border border-forest/60 bg-gradient-to-br from-forest/90 to-canopy text-parchment shadow-card p-6 flex flex-col gap-4 h-full"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wind size={18} className="text-parchment/70" />
          <h2 className="font-display text-lg font-semibold text-parchment">
            Air Quality
          </h2>
        </div>
        {stale && (
          <span className="flex items-center gap-1 text-xs font-medium bg-amber-500/20 text-amber-300 px-2 py-1 rounded-lg border border-amber-400/30">
            <AlertTriangle size={11} />
            Stale
          </span>
        )}
      </div>

      {stale && !data && (
        <StaleIndicator label="Environmental data unavailable" />
      )}

      {data ? (
        <>
          {/* AQI Big Number */}
          <div className="flex items-end gap-3">
            <AnimatedNumber
              value={aqi}
              className="font-display text-7xl font-bold leading-none"
              style={{ color }}
            />
            <div className="mb-2 flex flex-col">
              <span
                className="text-sm font-semibold uppercase tracking-widest"
                style={{ color }}
              >
                {label}
              </span>
              <span className="text-parchment/50 text-xs">AQI Index</span>
            </div>
          </div>

          {/* Progress bar 0–500 */}
          <div className="w-full bg-parchment/10 rounded-full h-2 overflow-hidden">
            <motion.div
              className="h-2 rounded-full"
              style={{ backgroundColor: color }}
              initial={{ width: 0 }}
              animate={{ width: shouldReduce ? `${progressPct}%` : `${progressPct}%` }}
              transition={
                shouldReduce
                  ? { duration: 0 }
                  : { duration: 1, ease: [0.22, 1, 0.36, 1], delay: 0.3 }
              }
            />
          </div>
          <div className="flex justify-between text-[10px] text-parchment/40 -mt-2">
            <span>0</span>
            <span>500</span>
          </div>

          {/* Chips */}
          <div className="flex flex-wrap gap-2 mt-auto">
            <div className="flex items-center gap-1.5 bg-parchment/10 border border-parchment/20 rounded-full px-3 py-1.5 text-xs text-parchment/80">
              <Wind size={12} className="text-parchment/50" />
              <span>PM2.5</span>
              <span className="font-semibold text-parchment">
                {data.pm25 ?? "—"}
              </span>
              <span className="text-parchment/40">µg/m³</span>
            </div>

            <div className="flex items-center gap-1.5 bg-parchment/10 border border-parchment/20 rounded-full px-3 py-1.5 text-xs text-parchment/80">
              <Thermometer size={12} className="text-parchment/50" />
              <span className="font-semibold text-parchment">
                {data.temperature ?? "—"}°C
              </span>
            </div>

            <div className="flex items-center gap-1.5 bg-parchment/10 border border-parchment/20 rounded-full px-3 py-1.5 text-xs text-parchment/80">
              <Droplets size={12} className="text-parchment/50" />
              <span className="font-semibold text-parchment">
                {data.humidity ?? "—"}%
              </span>
              <span className="text-parchment/40">RH</span>
            </div>
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center flex-1 gap-2 text-parchment/40">
          <Wind size={32} />
          <p className="text-sm">Environmental data unavailable</p>
        </div>
      )}
    </motion.div>
  );
}
