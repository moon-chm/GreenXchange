"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { MapPin, Sparkles, Plus, Leaf } from "lucide-react";
import api from "@/lib/axios";
import { useAuth } from "@/context/AuthContext";
import EnvironmentalPanel from "@/components/dashboard/EnvironmentalPanel";
import RewardWidget from "@/components/dashboard/RewardWidget";
import PlantPortfolioPanel from "@/components/dashboard/PlantPortfolioPanel";
import DrivesPanel from "@/components/dashboard/DrivesPanel";
import NewsFeedPanel from "@/components/dashboard/NewsFeedPanel";
import { fadeUp } from "@/lib/motion";

export default function Dashboard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const { user } = useAuth();
  const shouldReduce = useReducedMotion();

  const getGreeting = () => {
    const hr = new Date().getHours();
    if (hr < 12) return "Good morning";
    if (hr < 17) return "Good afternoon";
    return "Good evening";
  };

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
          fetchDashboard(); // Fallback
        }
      );
    } else {
      fetchDashboard();
    }
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
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white/80 border border-sage/40 rounded-2xl p-6 shadow-card backdrop-blur-sm"
      >
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-semibold text-canopy tracking-tight">
            {getGreeting()}, {displayName}
          </h1>
          <p className="text-canopy/50 text-xs sm:text-sm mt-1.5 flex items-center gap-1.5 font-medium">
            <MapPin size={14} className="text-fern" />
            {displayLat.toFixed(4)}, {displayLng.toFixed(4)}
          </p>
        </div>

        {/* Quick action buttons */}
        <div className="flex flex-wrap items-center gap-3">
          <motion.button
            whileTap={shouldReduce ? undefined : { scale: 0.97 }}
            onClick={() => router.push("/recommendations")}
            className="flex items-center gap-2 bg-sage/20 border border-sage/40 hover:border-fern/50 text-canopy hover:text-fern px-4 py-2.5 rounded-xl text-xs font-semibold transition-all shadow-sm"
          >
            <Sparkles size={14} />
            AI Advice
          </motion.button>
          
          <motion.button
            whileTap={shouldReduce ? undefined : { scale: 0.97 }}
            onClick={() => router.push("/plants/register")}
            className="flex items-center gap-2 bg-fern hover:bg-forest text-parchment px-4 py-2.5 rounded-xl text-xs font-semibold transition-all shadow-md shadow-fern/20"
          >
            <Plus size={14} />
            Register Plant
          </motion.button>
        </div>
      </motion.header>

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
