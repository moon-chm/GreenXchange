"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { MapPin, Sparkles, Plus, Leaf, Copy, Check, User as UserIcon } from "lucide-react";
import api from "@/lib/axios";
import { useAuth } from "@/context/AuthContext";
import EnvironmentalPanel from "@/components/dashboard/EnvironmentalPanel";
import RewardWidget from "@/components/dashboard/RewardWidget";
import PlantPortfolioPanel from "@/components/dashboard/PlantPortfolioPanel";
import DrivesPanel from "@/components/dashboard/DrivesPanel";
import NewsFeedPanel from "@/components/dashboard/NewsFeedPanel";
import CinematicIntroLoader from "@/components/shared/CinematicIntroLoader";
import { fadeUp } from "@/lib/motion";

export default function Dashboard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showCinematic, setShowCinematic] = useState(false);
  const router = useRouter();
  const { user } = useAuth();
  const shouldReduce = useReducedMotion();
  const [greeting, setGreeting] = useState("Welcome back");
  const [copiedId, setCopiedId] = useState(false);

  const copyUserId = () => {
    const idToCopy = user?.id || user?.email || "";
    if (idToCopy) {
      navigator.clipboard.writeText(idToCopy);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    }
  };

  useEffect(() => {
    const hr = new Date().getHours();
    let pool: string[] = [];

    if (hr >= 5 && hr < 12) {
      pool = [
        "Good morning",
        "Rise and photosynthesize",
        "Sun's up, saplings out",
        "Morning sunshine & fresh oxygen",
        "Breathe deep, it's a brand new day",
        "Ready to nurture your urban forest?"
      ];
    } else if (hr >= 12 && hr < 17) {
      pool = [
        "Good afternoon",
        "Peak solar power hours",
        "High noon in the canopy",
        "Soaking up that afternoon light",
        "Keep growing & thriving",
        "Welcome back to your green sanctuary"
      ];
    } else if (hr >= 17 && hr < 22) {
      pool = [
        "Good evening",
        "Golden hour in the garden",
        "Unwind under the green canopy",
        "Twilight transpiration in progress",
        "Great progress on your eco goals today",
        "Checking in on your urban sanctuary"
      ];
    } else {
      pool = [
        "Starlight & midnight oxygen",
        "Even micro-forests rest at night",
        "Late night eco guardian online",
        "Quiet hours in the canopy",
        "Nurturing the green revolution"
      ];
    }

    const randomGreeting = pool[Math.floor(Math.random() * pool.length)];
    setGreeting(randomGreeting);
  }, []);

  const fetchDashboard = (lat?: number, lng?: number) => {
    let url = "/dashboard";
    if (lat !== undefined && lng !== undefined) {
      url += `?lat=${lat}&lng=${lng}`;
    }

    setLoading(true);
    api.get(url)
      .then((res) => {
        setData(res.data);
      })
      .catch((err) => {
        console.error("Dashboard fetch error:", err);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          fetchDashboard(pos.coords.latitude, pos.coords.longitude);
        },
        () => {
          fetchDashboard();
        },
        { timeout: 5000 }
      );
    } else {
      fetchDashboard();
    }

    // Auto-poll live hardware & environmental telemetry every 5 seconds
    const telemetryInterval = setInterval(() => {
      api.get("/dashboard")
        .then((res) => {
          setData(res.data);
        })
        .catch((err) => {
          console.error("Live telemetry polling failed:", err);
        });
    }, 5000);

    return () => clearInterval(telemetryInterval);
  }, []);

  const displayName = data?.user?.full_name?.split(" ")[0] ?? user?.name ?? "Explorer";
  const displayLat = data?.user?.location_lat ?? 0.00;
  const displayLng = data?.user?.location_lng ?? 0.00;

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.header
        variants={fadeUp}
        initial={shouldReduce ? "visible" : "hidden"}
        animate="visible"
        className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5 bg-white/80 border border-sage/40 rounded-2xl p-6 shadow-card backdrop-blur-sm relative overflow-hidden"
      >
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-2xl sm:text-3xl font-semibold text-canopy tracking-tight">
              {greeting}, {displayName}
            </h1>
            <span className="bg-fern/10 text-fern text-xs font-semibold px-2.5 py-0.5 rounded-full border border-fern/20 flex items-center gap-1">
              <Leaf size={11} /> Eco Guardian
            </span>
            {user && (
              <button
                onClick={copyUserId}
                className="bg-parchment/60 hover:bg-parchment border border-sage/30 text-canopy/80 text-xs font-mono px-2.5 py-0.5 rounded-full flex items-center gap-1.5 transition-colors"
                title="Click to copy your User ID for organizations"
              >
                <UserIcon size={11} className="text-fern" />
                <span>ID: {user.email || user.id?.substring(0, 8)}</span>
                {copiedId ? <Check size={11} className="text-fern" /> : <Copy size={11} className="text-canopy/40" />}
                {copiedId && <span className="text-[10px] text-fern font-sans font-bold">Copied!</span>}
              </button>
            )}
          </div>
          <p className="text-canopy/60 text-xs sm:text-sm flex items-center gap-2 font-medium">
            <span className="flex items-center gap-1 text-fern">
              <MapPin size={14} />
              {displayLat !== 0 ? `${displayLat.toFixed(4)}°N, ${displayLng.toFixed(4)}°E` : "Detecting Location..."}
            </span>
            <button
              onClick={() => {
                if (navigator.geolocation) {
                  navigator.geolocation.getCurrentPosition((pos) => {
                    fetchDashboard(pos.coords.latitude, pos.coords.longitude);
                  });
                }
              }}
              className="text-[11px] text-fern hover:underline font-semibold"
            >
              Sync GPS
            </button>
          </p>
        </div>

        {/* Quick Eco Impact Metric Pills */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="bg-sage/10 border border-sage/30 rounded-xl px-3.5 py-2 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-fern/10 text-fern flex items-center justify-center font-bold">
              <Leaf size={16} />
            </div>
            <div>
              <p className="text-[10px] uppercase font-semibold text-canopy/50 tracking-wider">Registered Plants</p>
              <p className="font-display text-sm font-bold text-canopy">{data?.plants?.data?.length ?? 0} Assets</p>
            </div>
          </div>

          <div className="bg-sage/10 border border-sage/30 rounded-xl px-3.5 py-2 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold">
              <Sparkles size={16} />
            </div>
            <div>
              <p className="text-[10px] uppercase font-semibold text-canopy/50 tracking-wider">Est. Annual CO₂</p>
              <p className="font-display text-sm font-bold text-canopy">
                ~{((data?.plants?.data?.length ?? 0) * 12.5).toFixed(0)} kg/yr
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <motion.button
              whileTap={shouldReduce ? undefined : { scale: 0.97 }}
              onClick={() => setShowCinematic(true)}
              className="flex items-center gap-2 bg-gradient-to-r from-emerald-600/15 via-teal-500/15 to-sky-500/15 border border-emerald-500/30 hover:border-emerald-500 text-emerald-800 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all shadow-xs"
              title="Experience the Canopy Metamorphosis & Air Purification Sequence"
            >
              <Sparkles size={14} className="text-emerald-600 animate-spin" />
              <span>Experience Metamorphosis</span>
            </motion.button>

            <motion.button
              whileTap={shouldReduce ? undefined : { scale: 0.97 }}
              onClick={() => router.push("/recommendations")}
              className="flex items-center gap-2 bg-sage/20 border border-sage/40 hover:border-fern/50 text-canopy hover:text-fern px-4 py-2.5 rounded-xl text-xs font-semibold transition-all shadow-sm"
            >
              <Sparkles size={14} />
              AI Matcher
            </motion.button>
            
            <motion.button
              whileTap={shouldReduce ? undefined : { scale: 0.97 }}
              onClick={() => router.push("/plants?register=true")}
              className="flex items-center gap-2 bg-fern hover:bg-forest text-parchment px-4 py-2.5 rounded-xl text-xs font-semibold transition-all shadow-md shadow-fern/20"
            >
              <Plus size={14} />
              Register Plant
            </motion.button>
          </div>
        </div>
      </motion.header>

      {/* Full-screen Cinematic Metamorphosis Loader Modal */}
      {showCinematic && (
        <CinematicIntroLoader
          autoDismiss={false}
          minDisplayTime={4500}
          onComplete={() => setShowCinematic(false)}
        />
      )}

      {/* Grid container */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Environmental Overview */}
        <div className="lg:col-span-8">
          <EnvironmentalPanel
            stale={data?.environment?.stale ?? false}
            data={data?.environment?.data ?? null}
            loading={loading}
          />
        </div>

        {/* Reward widget */}
        <div className="lg:col-span-4">
          <RewardWidget
            stale={data?.rewards?.stale ?? false}
            data={data?.rewards?.data ?? null}
            loading={loading}
          />
        </div>

        {/* Plant portfolio */}
        <div className="lg:col-span-12">
          <PlantPortfolioPanel
            stale={data?.plants?.stale ?? false}
            data={data?.plants?.data ?? null}
            loading={loading}
          />
        </div>

        {/* Drives Panel */}
        <div className="lg:col-span-7">
          <DrivesPanel
            stale={data?.drives?.stale ?? false}
            data={data?.drives?.data ?? null}
            loading={loading}
          />
        </div>

        {/* News feed panel */}
        <div className="lg:col-span-5">
          <NewsFeedPanel
            stale={data?.news?.stale ?? false}
            data={data?.news?.data ?? null}
            loading={loading}
          />
        </div>
      </div>
    </div>
  );
}
