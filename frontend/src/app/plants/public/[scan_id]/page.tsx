"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import { Leaf, Calendar, MapPin, ShieldCheck, Heart, Award, ArrowRight } from "lucide-react";
import axios from "axios";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Axios client for public endpoints (no authentication headers needed)
const publicApi = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "/api",
});

interface PublicPlant {
  scan_id: string;
  species_name: string;
  scientific_name: string;
  common_name?: string;
  planting_date: string;
  space_type: string;
  locality_lat: number;
  locality_lng: number;
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

export default function PublicPlantPassport() {
  const { scan_id } = useParams();
  const [plant, setPlant] = useState<PublicPlant | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!scan_id) return;

    setLoading(true);
    publicApi.get<PublicPlant>(`/plants/${scan_id}/public`)
      .then((res) => {
        setPlant(res.data);
      })
      .catch((err) => {
        console.error("Public passport fetch error:", err);
        setError("This plant passport could not be found. Verify the QR link.");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [scan_id]);

  // Load Map when plant coordinates are available
  useEffect(() => {
    if (!plant || !mapContainerRef.current || mapRef.current) return;

    const center: [number, number] = [plant.locality_lat, plant.locality_lng];

    const map = L.map(mapContainerRef.current, {
      center,
      zoom: 12,
      zoomControl: false,
      attributionControl: false,
    });
    mapRef.current = map;

    // Clean light maps matching our green design
    L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
      maxZoom: 18,
    }).addTo(map);

    // Render an obfuscated locality zone (circle of ~10 km radius) to protect location privacy
    L.circle(center, {
      color: "#16a34a",
      fillColor: "#16a34a",
      fillOpacity: 0.15,
      weight: 1.5,
      radius: 5000, // 5km radius circle
    }).addTo(map);

    // Custom marker at center of zone
    const customIcon = L.divIcon({
      className: "public-locality-marker",
      html: `
        <div class="relative flex items-center justify-center" style="transform: translate(-50%, -50%);">
          <div class="w-5 h-5 rounded-full bg-fern border border-white shadow-md"></div>
        </div>
      `,
      iconSize: [20, 20],
      iconAnchor: [0, 0],
    });
    L.marker(center, { icon: customIcon }).addTo(map);

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [plant]);

  if (loading) {
    return (
      <div className="min-h-screen bg-parchment flex flex-col items-center justify-center gap-4 px-6">
        <div className="w-8 h-8 border-3 border-fern/30 border-t-fern rounded-full animate-spin"></div>
        <p className="text-sm font-semibold text-canopy/60 animate-pulse">Retrieving plant credentials...</p>
      </div>
    );
  }

  if (error || !plant) {
    return (
      <div className="min-h-screen bg-parchment flex flex-col items-center justify-center gap-4 px-6 text-center">
        <Leaf size={40} className="text-red-500 animate-bounce" />
        <h1 className="font-display font-bold text-2xl text-canopy">Invalid Passport</h1>
        <p className="text-sm text-canopy/60 max-w-sm">{error || "Plant not found."}</p>
        <a href="/" className="mt-4 px-6 py-2.5 rounded-xl bg-fern hover:bg-forest text-parchment text-sm font-semibold transition-all shadow-md shadow-fern/20">
          Back to GreenXchange
        </a>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-parchment/30 py-8 px-4 sm:px-6 flex flex-col items-center justify-center">
      {/* Decorative background shapes */}
      <div className="absolute top-0 left-0 right-0 h-64 bg-gradient-to-b from-fern/10 to-transparent pointer-events-none z-0" />

      {/* Main card */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="relative max-w-md w-full bg-white/80 border border-sage/40 rounded-3xl shadow-panel backdrop-blur-md overflow-hidden z-10"
      >
        {/* Certificate banner */}
        <div className="bg-forest px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-parchment">
            <ShieldCheck size={18} className="text-fern-light animate-pulse" />
            <span className="text-xs font-bold uppercase tracking-wider">Verified Asset Passport</span>
          </div>
          <span className="font-mono text-[10px] text-parchment/60 font-semibold bg-white/10 px-2.5 py-0.5 rounded-full">
            ID: {plant.scan_id}
          </span>
        </div>

        {/* Hero visual */}
        <div className="relative h-44 bg-sage/10 border-b border-sage/20 flex flex-col items-center justify-center gap-2">
          <div className="w-16 h-16 rounded-2xl bg-fern/10 flex items-center justify-center text-fern">
            <Leaf size={32} />
          </div>
          <h2 className="font-display font-bold text-canopy text-xl text-center px-4 leading-tight">
            {plant.common_name || plant.species_name}
          </h2>
          <p className="text-xs italic text-canopy/50">{plant.scientific_name}</p>
        </div>

        {/* Specifications */}
        <div className="p-6 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-start gap-2.5">
              <Calendar size={16} className="text-fern mt-0.5" />
              <div>
                <p className="text-[10px] uppercase font-semibold tracking-wider text-canopy/40">Planted On</p>
                <p className="text-xs font-bold text-canopy mt-0.5">{formatDate(plant.planting_date)}</p>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <Award size={16} className="text-fern mt-0.5" />
              <div>
                <p className="text-[10px] uppercase font-semibold tracking-wider text-canopy/40">GXC Registry</p>
                <p className="text-xs font-bold text-fern mt-0.5">Active Ledger</p>
              </div>
            </div>
          </div>

          <div className="h-px bg-sage/20" />

          {/* Obfuscated location and Map */}
          <div className="space-y-3">
            <div className="flex items-start gap-2">
              <MapPin size={16} className="text-fern mt-0.5 shrink-0" />
              <div>
                <p className="text-[10px] uppercase font-semibold tracking-wider text-canopy/40">General Locality</p>
                <p className="text-xs font-bold text-canopy mt-0.5">Approx. {plant.locality_lat.toFixed(1)}°N, {plant.locality_lng.toFixed(1)}°E</p>
                <p className="text-[10px] text-canopy/50 leading-normal mt-0.5">Coordinates are obfuscated to a 5 km buffer zone to protect owner privacy.</p>
              </div>
            </div>

            {/* Embedded Mini Map */}
            <div className="w-full h-36 rounded-xl overflow-hidden border border-sage/20 shadow-inner">
              <div ref={mapContainerRef} className="w-full h-full z-0" />
            </div>
          </div>

          <div className="h-px bg-sage/20" />

          {/* Social Proof */}
          <div className="flex items-center gap-3.5 bg-sage/5 border border-sage/20 rounded-2xl p-4">
            <div className="w-10 h-10 rounded-full bg-fern/10 text-fern flex items-center justify-center shrink-0">
              <Heart size={18} />
            </div>
            <div>
              <p className="text-xs font-bold text-canopy">Planted by GreenXchange Member</p>
              <p className="text-[10px] text-canopy/60 leading-normal mt-0.5">
                This asset was registered using GPS proof-of-presence and verified through computer-vision anomaly checks.
              </p>
            </div>
          </div>

          {/* CTA Link */}
          <a
            href="/"
            className="w-full inline-flex items-center justify-center gap-2 bg-fern hover:bg-forest text-parchment text-sm font-semibold py-3 rounded-xl transition-all shadow-md shadow-fern/20 mt-2"
          >
            Join the Green Revolution
            <ArrowRight size={15} />
          </a>
        </div>
      </motion.div>
    </div>
  );
}
