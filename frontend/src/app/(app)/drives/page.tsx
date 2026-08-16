"use client";

import { useState, useEffect, useCallback, useReducer } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  Users,
  Check,
  ChevronDown,
  ChevronUp,
  MapPin,
  TreePine,
} from "lucide-react";
import api from "@/lib/axios";
import { useAuth } from "@/context/AuthContext";
import { extractErrorMessage } from "@/lib/utils";
import EmptyState from "@/components/shared/EmptyState";
import { fadeUp, staggerContainer, staggerItem } from "@/lib/motion";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Drive {
  id: string;
  title: string;
  description: string;
  participant_count: number;
  start_date: string;
  end_date: string;
  lat: number;
  lng: number;
  radius_meters: number;
  distance_meters?: number;
  created_at: string;
}

type SortOption = "nearest" | "newest" | "popular";

interface CreateDriveForm {
  title: string;
  description: string;
  start_date: string;
  end_date: string;
  lat: string;
  lng: string;
  radius_meters: string;
}

// ─── Reducer for join state ────────────────────────────────────────────────────

type JoinAction =
  | { type: "JOIN_OPTIMISTIC"; id: string }
  | { type: "JOIN_ROLLBACK"; id: string }
  | { type: "SET_JOINED"; ids: string[] };

function joinedReducer(state: Set<string>, action: JoinAction): Set<string> {
  const next = new Set(state);
  switch (action.type) {
    case "JOIN_OPTIMISTIC":
    case "JOIN_ROLLBACK":
      action.type === "JOIN_OPTIMISTIC"
        ? next.add(action.id)
        : next.delete(action.id);
      return next;
    case "SET_JOINED":
      return new Set(action.ids);
    default:
      return state;
  }
}

// ─── Skeleton card ────────────────────────────────────────────────────────────

function DriveCardSkeleton() {
  return (
    <div className="rounded-2xl border border-sage/40 bg-white/80 backdrop-blur-sm shadow-card p-5 space-y-3">
      <div className="flex justify-between items-center">
        <div className="skeleton-shimmer rounded-full h-5 w-20" />
        <div className="skeleton-shimmer rounded-full h-4 w-28" />
      </div>
      <div className="skeleton-shimmer rounded-xl h-5 w-3/4" />
      <div className="skeleton-shimmer rounded-xl h-4 w-full" />
      <div className="skeleton-shimmer rounded-xl h-4 w-5/6" />
      <div className="flex justify-between items-center pt-1">
        <div className="skeleton-shimmer rounded-full h-4 w-16" />
        <div className="skeleton-shimmer rounded-lg h-9 w-24" />
      </div>
    </div>
  );
}

// ─── Drive Card ───────────────────────────────────────────────────────────────

interface DriveCardProps {
  drive: Drive;
  joined: boolean;
  onJoin: (id: string) => void;
  joining: boolean;
  shouldAnimate: boolean;
}

function DriveCard({ drive, joined, onJoin, joining, shouldAnimate }: DriveCardProps) {
  const distanceKm =
    drive.distance_meters != null
      ? (drive.distance_meters / 1000).toFixed(1)
      : null;

  const startDate = new Date(drive.start_date).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const endDate = new Date(drive.end_date).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  const cardVariants = shouldAnimate ? staggerItem : {};
  const hoverProps = shouldAnimate ? { whileHover: { y: -3 } } : {};
  const tapProps = shouldAnimate ? { whileTap: { scale: 0.97 } } : {};

  return (
    <motion.div
      variants={cardVariants}
      {...hoverProps}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="rounded-2xl border border-sage/40 bg-white/80 backdrop-blur-sm shadow-card p-5 flex flex-col gap-3"
    >
      {/* Top row: distance badge + date range */}
      <div className="flex items-center justify-between">
        {distanceKm !== null ? (
          <span className="inline-flex items-center gap-1 bg-fern/15 text-fern text-xs px-2.5 py-1 rounded-full font-medium">
            <MapPin size={10} />
            {distanceKm} km away
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 bg-fern/15 text-fern text-xs px-2.5 py-1 rounded-full font-medium">
            <MapPin size={10} />
            Nearby
          </span>
        )}
        <span className="text-xs text-canopy/50">
          {startDate} — {endDate}
        </span>
      </div>

      {/* Title */}
      <h2 className="font-display text-lg font-semibold text-canopy leading-snug">
        {drive.title}
      </h2>

      {/* Description */}
      <p className="text-sm text-canopy/60 line-clamp-2 mt-1 flex-1">
        {drive.description}
      </p>

      {/* Bottom row: participants + join button */}
      <div className="flex items-center justify-between pt-1">
        <span className="flex items-center gap-1.5 text-sm text-canopy/60">
          <Users size={14} />
          {drive.participant_count.toLocaleString()}
        </span>

        {joined ? (
          <span className="inline-flex items-center gap-1.5 bg-fern/15 text-fern border border-fern/40 text-sm px-4 py-2 rounded-lg font-medium cursor-default select-none">
            <Check size={14} />
            Joined
          </span>
        ) : (
          <motion.button
            {...tapProps}
            onClick={() => onJoin(drive.id)}
            disabled={joining}
            className="bg-fern hover:bg-forest text-parchment text-sm px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {joining ? "Joining…" : "Join Drive"}
          </motion.button>
        )}
      </div>
    </motion.div>
  );
}

// ─── Create Drive Form ────────────────────────────────────────────────────────

interface CreateDriveFormProps {
  onCreated: () => void;
  shouldAnimate: boolean;
  userLoc: { lat: number; lng: number };
}

function CreateDrivePanel({ onCreated, shouldAnimate, userLoc }: CreateDriveFormProps) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<CreateDriveForm>({
    title: "",
    description: "",
    start_date: "",
    end_date: "",
    lat: "",
    lng: "",
    radius_meters: "5000",
  });

  useEffect(() => {
    if (userLoc.lat && userLoc.lng) {
      setForm((prev) => ({
        ...prev,
        lat: prev.lat || userLoc.lat.toFixed(6),
        lng: prev.lng || userLoc.lng.toFixed(6),
      }));
    }
  }, [userLoc]);

  const inputClass =
    "w-full border border-sage focus:border-fern focus:ring-2 focus:ring-fern/20 bg-white/60 rounded-xl px-3 py-2 text-sm text-canopy placeholder:text-canopy/40 outline-none transition";

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.title.trim() || !form.start_date || !form.end_date) {
      setError("Title, start date, and end date are required.");
      return;
    }
    if (new Date(form.end_date) < new Date(form.start_date)) {
      setError("End date must be after start date.");
      return;
    }
    setSubmitting(true);
    try {
      await api.post("/drives", {
        title: form.title.trim(),
        description: form.description.trim(),
        start_date: form.start_date,
        end_date: form.end_date,
        lat: parseFloat(form.lat) || 0,
        lng: parseFloat(form.lng) || 0,
        radius_meters: parseInt(form.radius_meters, 10) || 5000,
      });
      setForm({
        title: "",
        description: "",
        start_date: "",
        end_date: "",
        lat: "",
        lng: "",
        radius_meters: "5000",
      });
      setOpen(false);
      onCreated();
    } catch (err: any) {
      setError(extractErrorMessage(err, "Failed to create drive. Please try again."));
    } finally {
      setSubmitting(false);
    }
  };

  const chevronProps = shouldAnimate
    ? { animate: { rotate: open ? 180 : 0 }, transition: { duration: 0.2 } }
    : {};

  return (
    <div className="rounded-2xl border border-sage/40 bg-white/80 backdrop-blur-sm shadow-card overflow-hidden">
      {/* Collapsible header */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between p-5 text-left group focus:outline-none"
        aria-expanded={open}
      >
        <div className="flex items-center gap-2">
          <TreePine size={18} className="text-fern" />
          <span className="font-display text-base font-semibold text-canopy">
            Create a Drive
          </span>
        </div>
        <motion.span {...chevronProps} className="text-canopy/50">
          {open ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="create-form"
            initial={shouldAnimate ? { height: 0, opacity: 0 } : false}
            animate={{ height: "auto", opacity: 1 }}
            exit={shouldAnimate ? { height: 0, opacity: 0 } : undefined}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            style={{ overflow: "hidden" }}
          >
            <form onSubmit={handleSubmit} className="px-5 pb-5 space-y-4">
              <div className="h-px bg-sage/20 mb-2" />

              {error && (
                <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              {/* Title */}
              <div>
                <label className="block text-xs font-medium text-canopy/70 mb-1">
                  Drive Title <span className="text-red-500">*</span>
                </label>
                <input
                  name="title"
                  value={form.title}
                  onChange={handleChange}
                  placeholder="e.g. Riverside Reforestation Day"
                  className={inputClass}
                  required
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-medium text-canopy/70 mb-1">
                  Description
                </label>
                <textarea
                  name="description"
                  value={form.description}
                  onChange={handleChange}
                  placeholder="What will participants be doing?"
                  rows={3}
                  className={`${inputClass} resize-none`}
                />
              </div>

              {/* Date range */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-canopy/70 mb-1">
                    Start Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    name="start_date"
                    type="date"
                    value={form.start_date}
                    onChange={handleChange}
                    className={inputClass}
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-canopy/70 mb-1">
                    End Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    name="end_date"
                    type="date"
                    value={form.end_date}
                    onChange={handleChange}
                    className={inputClass}
                    required
                  />
                </div>
              </div>

              {/* Coordinates */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-canopy/70 mb-1">
                    Latitude
                  </label>
                  <input
                    name="lat"
                    type="number"
                    step="any"
                    value={form.lat}
                    onChange={handleChange}
                    placeholder="e.g. 51.5072"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-canopy/70 mb-1">
                    Longitude
                  </label>
                  <input
                    name="lng"
                    type="number"
                    step="any"
                    value={form.lng}
                    onChange={handleChange}
                    placeholder="e.g. -0.1276"
                    className={inputClass}
                  />
                </div>
              </div>

              {/* Radius */}
              <div>
                <label className="block text-xs font-medium text-canopy/70 mb-1">
                  Radius (metres)
                </label>
                <input
                  name="radius_meters"
                  type="number"
                  min={100}
                  max={100000}
                  value={form.radius_meters}
                  onChange={handleChange}
                  placeholder="5000"
                  className={inputClass}
                />
              </div>

              <motion.button
                type="submit"
                disabled={submitting}
                whileTap={shouldAnimate ? { scale: 0.97 } : undefined}
                className="w-full bg-fern hover:bg-forest text-parchment text-sm py-2.5 rounded-xl font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {submitting ? "Creating…" : "Create Drive"}
              </motion.button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CommunityDrivesPage() {
  const { user } = useAuth();
  const prefersReduced = useReducedMotion();
  const shouldAnimate = !prefersReduced;

  const [drives, setDrives] = useState<Drive[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [userLoc, setUserLoc] = useState<{ lat: number; lng: number }>({
    lat: 0,
    lng: 0,
  });
  const [distanceKm, setDistanceKm] = useState(50);
  const [sort, setSort] = useState<SortOption>("nearest");
  const [joinedIds, dispatch] = useReducer(joinedReducer, new Set<string>());
  const [joiningId, setJoiningId] = useState<string | null>(null);

  // ── Geolocation ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!navigator.geolocation) {
      setUserLoc({ lat: 51.5072, lng: -0.1276 });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => {
        setUserLoc({ lat: 51.5072, lng: -0.1276 });
      },
      { timeout: 5000 }
    );
  }, []);

  // ── Fetch nearby drives ──────────────────────────────────────────────────────
  const fetchDrives = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const res = await api.get<Drive[]>(
        `/drives/nearby?lat=${userLoc.lat}&lng=${userLoc.lng}&radius=${distanceKm * 1000}`
      );
      setDrives(res.data);
    } catch {
      setFetchError("Could not load drives. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [userLoc, distanceKm]);

  // ── Fetch joined drives ──────────────────────────────────────────────────────
  const fetchMyDrives = useCallback(async () => {
    if (!user) return;
    try {
      const res = await api.get<Drive[]>("/drives/my");
      dispatch({ type: "SET_JOINED", ids: res.data.map((d) => d.id) });
    } catch {
      // non-fatal — joined state will be empty
    }
  }, [user]);

  useEffect(() => {
    fetchDrives();
  }, [fetchDrives]);

  useEffect(() => {
    fetchMyDrives();
  }, [fetchMyDrives]);

  // ── Join handler ─────────────────────────────────────────────────────────────
  const handleJoin = async (id: string) => {
    if (joiningId) return;
    dispatch({ type: "JOIN_OPTIMISTIC", id });
    setJoiningId(id);
    try {
      await api.post(`/drives/${id}/join`);
    } catch (err: any) {
      // 409 = already joined — keep optimistic state
      if (err.response?.status !== 409) {
        dispatch({ type: "JOIN_ROLLBACK", id });
      }
    } finally {
      setJoiningId(null);
    }
  };

  // ── Sorting ──────────────────────────────────────────────────────────────────
  const sortedDrives = [...drives].sort((a, b) => {
    if (sort === "nearest") {
      return (a.distance_meters ?? Infinity) - (b.distance_meters ?? Infinity);
    }
    if (sort === "newest") {
      return (
        new Date(b.start_date).getTime() - new Date(a.start_date).getTime()
      );
    }
    // popular
    return b.participant_count - a.participant_count;
  });

  // ── Animation variants ───────────────────────────────────────────────────────
  const containerVariants = shouldAnimate ? staggerContainer : {};
  const headingVariants = shouldAnimate ? fadeUp : {};

  return (
    <div className="space-y-6">
      {/* ── Page heading ──────────────────────────────────────────────────── */}
      <motion.div
        variants={headingVariants}
        initial="hidden"
        animate="visible"
        className="space-y-1"
      >
        <h1 className="font-display text-3xl lg:text-4xl font-semibold text-canopy">
          Community Drives
        </h1>
        <p className="text-canopy/60 text-sm lg:text-base">
          Join local tree planting initiatives near you
        </p>
      </motion.div>

      {/* ── Top bar: distance slider + sort ───────────────────────────────── */}
      <motion.div
        variants={shouldAnimate ? fadeUp : {}}
        initial="hidden"
        animate="visible"
        className="flex flex-col sm:flex-row sm:items-center gap-4 rounded-2xl border border-sage/40 bg-white/80 backdrop-blur-sm shadow-card p-4 lg:p-5"
      >
        {/* Distance slider */}
        <div className="flex-1 space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-canopy/70">
              Search radius
            </label>
            <span className="text-xs font-semibold text-fern">
              {distanceKm} km
            </span>
          </div>
          <input
            type="range"
            min={1}
            max={200}
            step={1}
            value={distanceKm}
            onChange={(e) => setDistanceKm(Number(e.target.value))}
            className="w-full h-1.5 rounded-full appearance-none cursor-pointer accent-fern bg-sage/30"
            aria-label="Search radius in kilometres"
          />
          <div className="flex justify-between text-[10px] text-canopy/40">
            <span>1 km</span>
            <span>200 km</span>
          </div>
        </div>

        {/* Divider */}
        <div className="hidden sm:block w-px h-12 bg-sage/30" />

        {/* Sort buttons */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-canopy/50 shrink-0">
            Sort by
          </span>
          <div className="flex gap-1.5">
            {(
              [
                { key: "nearest", label: "Nearest" },
                { key: "newest", label: "Newest" },
                { key: "popular", label: "Most Popular" },
              ] as const
            ).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setSort(key)}
                className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                  sort === key
                    ? "bg-fern text-parchment"
                    : "bg-sage/20 text-canopy/60 hover:bg-sage/40"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </motion.div>

      {/* ── Drive cards grid ──────────────────────────────────────────────── */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <DriveCardSkeleton key={i} />
          ))}
        </div>
      ) : fetchError ? (
        <div className="rounded-2xl border border-sage/40 bg-white/80 backdrop-blur-sm shadow-card p-8 text-center">
          <p className="text-canopy/60 text-sm mb-3">{fetchError}</p>
          <button
            onClick={fetchDrives}
            className="bg-fern hover:bg-forest text-parchment text-sm px-4 py-2 rounded-lg font-medium transition-colors"
          >
            Retry
          </button>
        </div>
      ) : sortedDrives.length === 0 ? (
        <EmptyState
          title="No drives nearby"
          description={`No community drives found within ${distanceKm} km. Try increasing the search radius or create one below.`}
        />
      ) : (
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 md:grid-cols-2 gap-4"
        >
          {sortedDrives.map((drive) => (
            <DriveCard
              key={drive.id}
              drive={drive}
              joined={joinedIds.has(drive.id)}
              onJoin={handleJoin}
              joining={joiningId === drive.id}
              shouldAnimate={shouldAnimate}
            />
          ))}
        </motion.div>
      )}

      {/* ── Create Drive section ──────────────────────────────────────────── */}
      <motion.div
        variants={shouldAnimate ? fadeUp : {}}
        initial="hidden"
        animate="visible"
      >
        <CreateDrivePanel
          onCreated={fetchDrives}
          shouldAnimate={shouldAnimate}
          userLoc={userLoc}
        />
      </motion.div>
    </div>
  );
}
