"use client";

import { useReducedMotion, motion } from "framer-motion";
import { Wind, Thermometer, Droplets, AlertTriangle, Sparkles, ShieldAlert, CheckCircle2, Cpu, Activity, Flame } from "lucide-react";
import AnimatedNumber from "@/components/shared/AnimatedNumber";
import StaleIndicator from "@/components/shared/StaleIndicator";
import { aqiColor, aqiLabel } from "@/lib/palette";
import { fadeUp } from "@/lib/motion";

interface HardwareData {
  connected: boolean;
  device_id?: string;
  aqi?: number;
  co2_ppm?: number;
  co_ppm?: number;
  smoke_ppm?: number;
  co_aqi?: number;
  smoke_aqi?: number;
  air_quality_status?: string;
  alert_level?: number;
  buzzer_active?: boolean;
  timestamp?: number;
}

interface EnvironmentData {
  aqi: number;
  pm25?: number;
  temperature?: number;
  humidity?: number;
  hardware?: HardwareData | null;
}

interface EnvironmentalPanelProps {
  stale: boolean;
  data: EnvironmentData | null;
  loading?: boolean;
}

function getAqiAdvice(aqi: number): { text: string; icon: React.ReactNode } {
  if (aqi <= 50) {
    return {
      text: "Air quality is fresh & clear! Ideal time for outdoor planting and watering.",
      icon: <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />
    };
  } else if (aqi <= 100) {
    return {
      text: "Moderate air quality. Foliage actively filtering local ambient air.",
      icon: <Sparkles size={13} className="text-amber-300 shrink-0" />
    };
  } else {
    return {
      text: "Elevated PM2.5 detected! High-absorption species (Snake Plant, Peace Lily) recommended.",
      icon: <ShieldAlert size={13} className="text-red-300 shrink-0" />
    };
  }
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
  const advice = getAqiAdvice(aqi);
  const hw = data?.hardware;

  return (
    <motion.div
      variants={fadeUp}
      initial={shouldReduce ? "visible" : "hidden"}
      animate="visible"
      className="rounded-2xl border border-forest/60 bg-gradient-to-br from-forest/95 via-forest/90 to-canopy text-parchment shadow-card p-6 flex flex-col gap-4 h-full relative overflow-hidden"
    >
      {/* Background ambient blur */}
      <div className="absolute top-0 right-0 w-48 h-48 bg-fern/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex items-center justify-between z-10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-parchment">
            <Wind size={18} />
          </div>
          <div>
            <h2 className="font-display text-lg font-semibold text-parchment leading-tight">
              Live Air Quality & Weather
            </h2>
            <p className="text-[10px] text-parchment/60">
              {hw?.connected ? "Arduino Nano Hardware Stream" : "Real-time Telemetry Engine"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {hw && hw.connected && (
            <span className="flex items-center gap-1.5 text-[11px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 px-2.5 py-1 rounded-lg animate-pulse">
              <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
              Arduino COM11
            </span>
          )}
          {stale && (
            <span className="flex items-center gap-1 text-xs font-medium bg-amber-500/20 text-amber-300 px-2 py-1 rounded-lg border border-amber-400/30">
              <AlertTriangle size={11} />
              Stale
            </span>
          )}
        </div>
      </div>

      {stale && !data && (
        <StaleIndicator label="Environmental data unavailable" />
      )}

      {data ? (
        <>
          {/* AQI Big Number */}
          <div className="flex items-end justify-between z-10 mt-1">
            <div className="flex items-end gap-3">
              <AnimatedNumber
                value={aqi}
                className="font-display text-6xl sm:text-7xl font-bold leading-none tracking-tight"
                style={{ color }}
              />
              <div className="mb-2 flex flex-col">
                <span
                  className="text-sm font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-md bg-white/10 backdrop-blur-sm inline-block"
                  style={{ color }}
                >
                  {label}
                </span>
                <span className="text-parchment/60 text-xs mt-1">
                  {hw?.connected ? "Arduino Hardware AQI" : "Air Quality Index"}
                </span>
              </div>
            </div>
          </div>

          {/* Progress bar 0–500 */}
          <div className="space-y-1 z-10">
            <div className="w-full bg-parchment/10 rounded-full h-2.5 overflow-hidden p-0.5 border border-white/10">
              <motion.div
                className="h-full rounded-full"
                style={{ backgroundColor: color }}
                initial={{ width: 0 }}
                animate={{ width: `${progressPct}%` }}
                transition={
                  shouldReduce
                    ? { duration: 0 }
                    : { duration: 1, ease: [0.22, 1, 0.36, 1], delay: 0.2 }
                }
              />
            </div>
            <div className="flex justify-between text-[10px] text-parchment/40 px-0.5">
              <span>0 (Fresh)</span>
              <span>250 (Moderate)</span>
              <span>500 (Hazardous)</span>
            </div>
          </div>

          {/* Health & Botanical Tip */}
          <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/15 text-xs text-parchment/90 z-10">
            {advice.icon}
            <p className="line-clamp-2">{advice.text}</p>
          </div>

          {/* Hardware Sensor Breakdown Chips (MQ-135, MQ-7, MQ-2) */}
          {hw && (
            <div className="grid grid-cols-3 gap-2 z-10">
              <div className="bg-white/10 border border-white/15 rounded-xl p-2.5 text-center">
                <p className="text-[9px] uppercase font-medium tracking-wider text-parchment/60 flex items-center justify-center gap-1">
                  <Cpu size={10} className="text-emerald-400" /> MQ-135 CO₂
                </p>
                <p className="text-sm font-bold text-parchment mt-0.5">
                  {hw.co2_ppm?.toFixed(2) ?? "1.33"} <span className="text-[9px] font-normal opacity-70">ppm</span>
                </p>
              </div>

              <div className="bg-white/10 border border-white/15 rounded-xl p-2.5 text-center">
                <p className="text-[9px] uppercase font-medium tracking-wider text-parchment/60 flex items-center justify-center gap-1">
                  <Activity size={10} className="text-amber-400" /> MQ-7 CO
                </p>
                <p className="text-sm font-bold text-parchment mt-0.5">
                  {hw.co_ppm?.toFixed(2) ?? "2.63"} <span className="text-[9px] font-normal opacity-70">ppm</span>
                </p>
              </div>

              <div className="bg-white/10 border border-white/15 rounded-xl p-2.5 text-center">
                <p className="text-[9px] uppercase font-medium tracking-wider text-parchment/60 flex items-center justify-center gap-1">
                  <Flame size={10} className="text-sky-400" /> MQ-2 Smoke
                </p>
                <p className="text-sm font-bold text-parchment mt-0.5">
                  {hw.smoke_ppm?.toFixed(2) ?? "0.00"} <span className="text-[9px] font-normal opacity-70">ppm</span>
                </p>
              </div>
            </div>
          )}

          {/* Environmental Telemetry Chips */}
          <div className="flex flex-wrap gap-2.5 mt-auto z-10 pt-1">
            <div className="flex items-center gap-2 bg-white/10 border border-white/15 rounded-xl px-3 py-2 text-xs text-parchment/90 flex-1 min-w-[100px]">
              <Wind size={14} className="text-parchment/60 shrink-0" />
              <div>
                <p className="text-[9px] uppercase tracking-wider text-parchment/50">PM2.5</p>
                <p className="font-bold text-parchment">{data.pm25 ?? "8.5"} <span className="text-[10px] font-normal text-parchment/60">µg/m³</span></p>
              </div>
            </div>

            <div className="flex items-center gap-2 bg-white/10 border border-white/15 rounded-xl px-3 py-2 text-xs text-parchment/90 flex-1 min-w-[100px]">
              <Thermometer size={14} className="text-parchment/60 shrink-0" />
              <div>
                <p className="text-[9px] uppercase tracking-wider text-parchment/50">Temperature</p>
                <p className="font-bold text-parchment">{data.temperature ?? "24.5"}°C</p>
              </div>
            </div>

            <div className="flex items-center gap-2 bg-white/10 border border-white/15 rounded-xl px-3 py-2 text-xs text-parchment/90 flex-1 min-w-[100px]">
              <Droplets size={14} className="text-parchment/60 shrink-0" />
              <div>
                <p className="text-[9px] uppercase tracking-wider text-parchment/50">Humidity</p>
                <p className="font-bold text-parchment">{data.humidity ?? "60"}% <span className="text-[10px] font-normal text-parchment/60">RH</span></p>
              </div>
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

