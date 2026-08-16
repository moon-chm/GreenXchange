"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { motion, AnimatePresence } from "framer-motion";
import {
  Globe,
  User,
  Calendar,
  Sparkles,
  MapPin,
  Leaf,
  X,
  ShieldCheck,
  Trees,
  CheckCircle2
} from "lucide-react";
import api from "@/lib/axios";

export interface CommunityTree {
  id: string;
  scan_id: string;
  common_name: string;
  species_name: string;
  owner_first_name: string;
  owner_id: string;
  is_owner?: boolean;
  planting_date: string;
  age_days?: number;
  age_formatted?: string;
  space_type: string;
  lat: number;
  lng: number;
  image_url?: string;
  estimated_carbon_kg?: number;
  status?: string;
}

interface PlantMapProps {
  myPlants: any[];
  onSelectPlant: (plant: any) => void;
}

export default function PlantMap({ myPlants, onSelectPlant }: PlantMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);

  const [activeTab, setActiveTab] = useState<"community" | "my">("community");
  const [communityTrees, setCommunityTrees] = useState<CommunityTree[]>([]);
  const [loadingCommunity, setLoadingCommunity] = useState(true);
  const [selectedTree, setSelectedTree] = useState<CommunityTree | null>(null);

  // Fetch all public community trees
  const fetchCommunityTrees = useCallback(async () => {
    try {
      setLoadingCommunity(true);
      const res = await api.get<CommunityTree[]>("/plants/community-map");
      setCommunityTrees(res.data ?? []);
    } catch (err) {
      console.error("Failed to load community map trees:", err);
    } finally {
      setLoadingCommunity(false);
    }
  }, []);

  useEffect(() => {
    fetchCommunityTrees();
  }, [fetchCommunityTrees]);

  // Active list of plants to render on map
  const activeTrees: CommunityTree[] = activeTab === "community"
    ? communityTrees
    : myPlants.map((p) => ({
        id: p.id,
        scan_id: p.scan_id,
        common_name: p.common_name || p.species_name,
        species_name: p.species_name,
        owner_first_name: "You",
        owner_id: "me",
        is_owner: true,
        planting_date: p.planting_date,
        space_type: p.space_type,
        lat: p.lat,
        lng: p.lng,
        image_url: p.image_url,
        estimated_carbon_kg: 18.5,
        status: p.status || "verified",
      }));

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    let center: [number, number] = [28.6139, 77.2090]; // Default New Delhi / Urban center
    if (activeTrees.length > 0) {
      const valid = activeTrees.find((p) => typeof p.lat === "number" && typeof p.lng === "number");
      if (valid) {
        center = [valid.lat, valid.lng];
      }
    }

    const map = L.map(mapContainerRef.current, {
      center,
      zoom: 12,
      zoomControl: false,
    });
    mapRef.current = map;

    L.control.zoom({ position: "bottomright" }).addTo(map);

    L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: "abcd",
      maxZoom: 20,
    }).addTo(map);

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Update Markers when active list changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    const bounds = L.latLngBounds([]);

    activeTrees.forEach((tree) => {
      if (typeof tree.lat !== "number" || typeof tree.lng !== "number") return;

      const position: [number, number] = [tree.lat, tree.lng];
      bounds.extend(position);

      const isUserTree = tree.is_owner || tree.owner_first_name === "You";
      const markerColor = isUserTree ? "bg-fern" : "bg-[#2A6F4E]";
      const ringColor = isUserTree ? "bg-fern/40" : "bg-sage/40";

      const customIcon = L.divIcon({
        className: "custom-plant-marker-icon",
        html: `
          <div class="relative flex items-center justify-center cursor-pointer group" style="transform: translate(-50%, -50%);">
            <div class="absolute w-9 h-9 rounded-full ${ringColor} animate-ping opacity-75"></div>
            <div class="relative w-10 h-10 rounded-full ${markerColor} text-white border-2 border-white flex items-center justify-center shadow-lg group-hover:scale-125 transition-transform duration-200">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 22v-7"/>
                <path d="M7 12a5 5 0 0 1 10 0v2a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2v-2z"/>
                <path d="M12 2a4 4 0 0 1 4 4c0 1.5-.8 2.8-2 3.5"/>
              </svg>
            </div>
            <!-- Owner first name tooltip label -->
            <div class="absolute -bottom-6 bg-white/95 text-canopy font-bold text-[10px] px-2 py-0.5 rounded-full border border-sage/40 shadow-xs whitespace-nowrap pointer-events-none">
              ${tree.owner_first_name}
            </div>
          </div>
        `,
        iconSize: [40, 40],
        iconAnchor: [0, 0],
      });

      const marker = L.marker(position, { icon: customIcon }).addTo(map);

      marker.on("click", () => {
        setSelectedTree(tree);
      });

      markersRef.current.push(marker);
    });

    if (activeTrees.length > 1 && bounds.isValid()) {
      map.fitBounds(bounds, { padding: [60, 60] });
    } else if (activeTrees.length === 1 && bounds.isValid()) {
      map.setView(bounds.getCenter(), 14);
    }
  }, [activeTrees]);

  return (
    <div className="relative w-full h-[620px] rounded-3xl overflow-hidden border border-sage/40 shadow-card bg-white">
      {/* Map Leaflet Container */}
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* Top Map Filter & Scope Controls */}
      <div className="absolute top-4 left-4 z-10 flex flex-wrap items-center gap-2">
        <div className="bg-white/95 backdrop-blur-md p-1 rounded-2xl border border-sage/40 shadow-sm flex items-center gap-1">
          <button
            onClick={() => {
              setActiveTab("community");
              setSelectedTree(null);
            }}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              activeTab === "community"
                ? "bg-fern text-white shadow-xs"
                : "text-canopy/70 hover:text-canopy hover:bg-sage/10"
            }`}
          >
            <Globe size={14} />
            <span>Community Canopy ({communityTrees.length})</span>
          </button>

          <button
            onClick={() => {
              setActiveTab("my");
              setSelectedTree(null);
            }}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              activeTab === "my"
                ? "bg-fern text-white shadow-xs"
                : "text-canopy/70 hover:text-canopy hover:bg-sage/10"
            }`}
          >
            <Trees size={14} />
            <span>My Trees ({myPlants.length})</span>
          </button>
        </div>
      </div>

      {/* Live Tree Counter Badge */}
      <div className="absolute top-4 right-4 z-10 bg-white/95 backdrop-blur-md px-3.5 py-1.5 rounded-2xl border border-sage/40 text-xs font-semibold text-canopy shadow-sm flex items-center gap-2">
        <div className="w-2.5 h-2.5 rounded-full bg-fern animate-pulse" />
        <span>{activeTrees.length} Trees on Map</span>
      </div>

      {/* Selected Tree Detailed Interactive Card Drawer */}
      <AnimatePresence>
        {selectedTree && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="absolute bottom-6 left-6 right-6 sm:left-auto sm:right-6 sm:w-96 z-20 bg-white/95 backdrop-blur-lg border border-sage/60 rounded-3xl p-5 shadow-2xl overflow-hidden"
          >
            {/* Header with Photo & Close */}
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex items-center gap-3">
                {selectedTree.image_url ? (
                  <div className="w-14 h-14 rounded-2xl overflow-hidden border border-sage/40 shadow-xs shrink-0">
                    <img
                      src={selectedTree.image_url}
                      alt={selectedTree.common_name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="w-14 h-14 rounded-2xl bg-fern/10 text-fern border border-fern/20 flex items-center justify-center shrink-0">
                    <Leaf size={26} />
                  </div>
                )}

                <div>
                  <h3 className="font-display font-bold text-canopy text-base leading-tight">
                    {selectedTree.common_name}
                  </h3>
                  <p className="text-xs text-canopy/60 italic mt-0.5">
                    {selectedTree.species_name}
                  </p>
                  <div className="inline-flex items-center gap-1 mt-1 text-[11px] font-bold text-fern bg-fern/10 px-2 py-0.5 rounded-md">
                    <CheckCircle2 size={12} />
                    <span>Verified Citizen Tree</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setSelectedTree(null)}
                className="w-8 h-8 rounded-full bg-sage/20 hover:bg-sage/40 text-canopy flex items-center justify-center transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Tree Details Breakdown Grid */}
            <div className="grid grid-cols-2 gap-2 my-3 text-xs">
              {/* Owner */}
              <div className="bg-parchment/70 border border-sage/30 rounded-xl p-2.5">
                <div className="flex items-center gap-1.5 text-canopy/50 mb-0.5">
                  <User size={13} />
                  <span className="font-semibold uppercase tracking-wider text-[10px]">Owner</span>
                </div>
                <p className="font-bold text-canopy text-sm">
                  {selectedTree.is_owner ? "You (Owner)" : selectedTree.owner_first_name}
                </p>
              </div>

              {/* Age */}
              <div className="bg-parchment/70 border border-sage/30 rounded-xl p-2.5">
                <div className="flex items-center gap-1.5 text-canopy/50 mb-0.5">
                  <Calendar size={13} />
                  <span className="font-semibold uppercase tracking-wider text-[10px]">Age</span>
                </div>
                <p className="font-bold text-canopy text-sm">
                  {selectedTree.age_formatted || "Active"}
                </p>
              </div>

              {/* Space Type */}
              <div className="bg-parchment/70 border border-sage/30 rounded-xl p-2.5">
                <div className="flex items-center gap-1.5 text-canopy/50 mb-0.5">
                  <MapPin size={13} />
                  <span className="font-semibold uppercase tracking-wider text-[10px]">Space</span>
                </div>
                <p className="font-bold text-canopy capitalize">
                  {selectedTree.space_type?.replace("_", " ") || "Outdoor"}
                </p>
              </div>

              {/* Carbon Offset */}
              <div className="bg-parchment/70 border border-sage/30 rounded-xl p-2.5">
                <div className="flex items-center gap-1.5 text-canopy/50 mb-0.5">
                  <Sparkles size={13} />
                  <span className="font-semibold uppercase tracking-wider text-[10px]">Carbon</span>
                </div>
                <p className="font-bold text-fern">
                  {selectedTree.estimated_carbon_kg ?? 18.5} kg CO₂
                </p>
              </div>
            </div>

            {/* Coordinates & Action */}
            <div className="pt-2 border-t border-sage/30 flex items-center justify-between">
              <span className="text-[11px] text-canopy/50 font-mono">
                {selectedTree.lat.toFixed(4)}° N, {selectedTree.lng.toFixed(4)}° E
              </span>

              {selectedTree.is_owner && (
                <button
                  onClick={() => {
                    onSelectPlant(selectedTree);
                    setSelectedTree(null);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-fern hover:bg-forest text-white text-xs font-semibold transition-colors shadow-xs"
                >
                  Manage Tree
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
