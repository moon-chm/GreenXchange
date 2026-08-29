"use client";

import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import api from "@/lib/axios";
import { extractErrorMessage } from "@/lib/utils";

import { Camera, Sparkles, AlertCircle, Globe, Upload, Image as ImageIcon } from "lucide-react";
import LiveCameraCapture from "@/components/shared/LiveCameraCapture";

interface PlantRegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

function QRIcon({ size = 24 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect x="3" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2" />
      <rect x="14" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2" />
      <rect x="3" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2" />
      <rect x="5" y="5" width="3" height="3" fill="currentColor" />
      <rect x="16" y="5" width="3" height="3" fill="currentColor" />
      <rect x="5" y="16" width="3" height="3" fill="currentColor" />
      <path d="M14 14h2v2h-2z" fill="currentColor" />
      <path d="M18 14h3v2h-3z" fill="currentColor" />
      <path d="M14 18h2v3h-2z" fill="currentColor" />
      <path d="M18 18h3v3h-3z" fill="currentColor" />
    </svg>
  );
}

function MapPinIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="9" r="2.5" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function XIcon({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

interface FormData {
  species_id: string;
  common_name: string;
  space_type: string;
  planting_date: string;
  latitude: string;
  longitude: string;
  image_url: string;
  is_public_on_map: boolean;
}

const TOTAL_STEPS = 4;

const OTHER_SPECIES_ID = "__other__";

const labelClass = "block text-sm font-medium text-canopy mb-1.5";
const inputClass =
  "w-full px-4 py-2.5 rounded-xl border border-sage focus:border-fern focus:ring-2 focus:ring-fern/20 bg-white/60 text-canopy placeholder:text-canopy/40 outline-none transition-all text-sm";

export default function PlantRegistrationModal({
  isOpen,
  onClose,
  onSuccess,
}: PlantRegistrationModalProps) {
  const shouldReduceMotion = useReducedMotion();

  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isGpsLoading, setIsGpsLoading] = useState(false);

  const [speciesList, setSpeciesList] = useState<any[]>([]);
  const [loadingSpecies, setLoadingSpecies] = useState(false);
  const [customSpeciesName, setCustomSpeciesName] = useState("");

  const [formData, setFormData] = useState<FormData>({
    species_id: "",
    common_name: "",
    space_type: "indoor",
    planting_date: new Date().toISOString().split("T")[0],
    latitude: "",
    longitude: "",
    image_url: "",
    is_public_on_map: true,
  });

  useEffect(() => {
    if (!isOpen) return;
    const fetchSpecies = async () => {
      try {
        setLoadingSpecies(true);
        const res = await api.get("/plants/species");
        const data = res.data ?? [];
        setSpeciesList(data);
      } catch (err) {
        console.error("Failed to load species:", err);
      } finally {
        setLoadingSpecies(false);
      }
    };
    fetchSpecies();
  }, [isOpen]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      const { name, value } = e.target;
      setFormData((prev) => ({ ...prev, [name]: value }));
    },
    []
  );

  const handleImageFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setError("Image size must be less than 10MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = (evt) => {
      if (evt.target?.result) {
        setFormData((prev) => ({ ...prev, image_url: evt.target!.result as string }));
      }
    };
    reader.readAsDataURL(file);
  }, []);

  const handleGpsAutoFill = useCallback(() => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser.");
      return;
    }
    setIsGpsLoading(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setFormData((prev) => ({
          ...prev,
          latitude: position.coords.latitude.toFixed(6),
          longitude: position.coords.longitude.toFixed(6),
        }));
        setIsGpsLoading(false);
      },
      (err) => {
        console.warn("GPS auto-fill error:", err);
        setError("Unable to retrieve GPS location. Ensure location permissions are granted.");
        setIsGpsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, []);

  const handleNext = useCallback(() => {
    setError(null);
    if (step === 1) {
      if (!customSpeciesName.trim()) {
        setError("Please enter your plant name.");
        return;
      }
    }
    if (step === 2) {
      if (!formData.image_url) {
        setError("Please upload or snap a photo of your plant.");
        return;
      }
    }
    if (step === 3) {
      if (!formData.latitude.trim() || !formData.longitude.trim()) {
        setError("Please provide both latitude and longitude.");
        return;
      }
      const lat = parseFloat(formData.latitude);
      const lng = parseFloat(formData.longitude);
      if (isNaN(lat) || lat < -90 || lat > 90) {
        setError("Latitude must be between -90 and 90.");
        return;
      }
      if (isNaN(lng) || lng < -180 || lng > 180) {
        setError("Longitude must be between -180 and 180.");
        return;
      }
      handleSubmit();
      return;
    }
    setStep((s) => s + 1);
  }, [step, formData]);

  const handleSubmit = useCallback(async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      const plantName = customSpeciesName.trim() || formData.common_name.trim();
      const nickname = formData.common_name.trim();

      // Find matching species in the predefined library (e.g. "Ashok" -> "Ashoka Tree", "Tulsi" -> "Tulsi (Holy Basil)")
      let resolvedSpeciesId: string | undefined;
      if (plantName && speciesList.length > 0) {
        const pLower = plantName.toLowerCase();
        const matched = speciesList.find((s: any) => {
          const sName = (s.common_name || "").toLowerCase();
          return (
            sName === pLower ||
            sName.includes(pLower) ||
            pLower.includes(sName.replace(" tree", "").replace(" plant", "").trim())
          );
        });
        if (matched) {
          resolvedSpeciesId = matched.id;
        }
      }

      await api.post("/plants/register", {
        species_id: resolvedSpeciesId,
        common_name: nickname && nickname.toLowerCase() !== plantName.toLowerCase() ? nickname : plantName,
        lat: parseFloat(formData.latitude),
        lng: parseFloat(formData.longitude),
        planting_date: new Date(formData.planting_date).toISOString(),
        space_type: formData.space_type || "indoor",
        image_url: formData.image_url || undefined,
        is_public_on_map: formData.is_public_on_map,
      });
      setStep(4);
      onSuccess();

    } catch (err: unknown) {
      setError(extractErrorMessage(err, "Registration failed. Please try again."));
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, customSpeciesName, speciesList, onSuccess]);

  const handleClose = useCallback(() => {
    setStep(1);
    setError(null);
    setCustomSpeciesName("");
    setFormData({
      species_id: speciesList.length > 0 ? speciesList[0].id : "",
      common_name: "",
      space_type: "indoor",
      planting_date: new Date().toISOString().split("T")[0],
      latitude: "",
      longitude: "",
      image_url: "",
      is_public_on_map: true,
    });
    onClose();
  }, [onClose, speciesList]);


  const overlayAnim = shouldReduceMotion
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } };

  const modalAnim = shouldReduceMotion
    ? {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
        transition: { duration: 0.15 },
      }
    : {
        initial: { opacity: 0, scale: 0.94 },
        animate: { opacity: 1, scale: 1 },
        exit: { opacity: 0, scale: 0.94 },
        transition: { duration: 0.22, ease: [0.22, 1, 0.36, 1] },
      };

  const stepAnim = shouldReduceMotion
    ? {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
        transition: { duration: 0.15 },
      }
    : {
        initial: { opacity: 0, x: -20 },
        animate: { opacity: 1, x: 0 },
        exit: { opacity: 0, x: 20 },
        transition: { duration: 0.22, ease: "easeInOut" },
      };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="overlay"
          {...(overlayAnim as any)}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 bg-canopy/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) handleClose();
          }}
        >
          <motion.div
            key="modal"
            {...(modalAnim as any)}
            className="bg-parchment rounded-2xl p-6 max-w-lg w-full mx-4 shadow-panel relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-5">
              <div>
                <h2 className="font-display text-xl font-semibold text-canopy">
                  Register New Plant
                </h2>
                <p className="text-sm text-canopy/60 mt-0.5">
                  Step {step} of {TOTAL_STEPS}
                </p>
              </div>
              <button
                onClick={handleClose}
                className="p-1.5 rounded-xl text-canopy/50 hover:text-canopy hover:bg-sage/20 transition-colors"
                aria-label="Close modal"
              >
                <XIcon size={20} />
              </button>
            </div>

            {/* Step indicator */}
            <div className="flex items-center gap-0 mb-6">
              {[1, 2, 3, 4].map((s, idx) => (
                <div key={s} className="flex items-center flex-1 last:flex-none">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-colors duration-200 shrink-0 ${
                      step >= s
                        ? "bg-fern text-parchment"
                        : "bg-sage/30 text-canopy/50"
                    }`}
                  >
                    {s}
                  </div>
                  {idx < 3 && (
                    <div className="flex-1 h-0.5 mx-1">
                      <div
                        className={`h-full transition-all duration-300 rounded-full ${
                          step > s ? "bg-fern" : "bg-sage/30"
                        }`}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Step content */}
            <AnimatePresence mode="wait">
              {step === 1 && (
                <motion.div key="step1" {...(stepAnim as any)} className="flex flex-col gap-4">
                  {/* Plant name — free-text input */}
                  <div>
                    <label htmlFor="custom_species_name" className={labelClass}>
                      Plant Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="custom_species_name"
                      type="text"
                      value={customSpeciesName}
                      onChange={(e) => setCustomSpeciesName(e.target.value)}
                      placeholder="Type ANY plant: e.g. Mango, Tomato, Cactus, Rose, Neem…"
                      className={inputClass}
                      autoFocus
                    />
                    <p className="text-xs text-canopy/50 mt-1">
                      Type any plant name — tree, herb, vegetable, succulent, fruit, or flower.
                    </p>

                    {/* Quick suggestions */}
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {[
                        "Neem Tree",
                        "Tulsi",
                        "Money Plant",
                        "Snake Plant",
                        "Mango Tree",
                        "Aloe Vera",
                        "Rose",
                        "Moringa",
                        "Tomato",
                        "Lemon Tree",
                        "Jasmine",
                        "Bamboo",
                      ].map((item) => (
                        <button
                          key={item}
                          type="button"
                          onClick={() => setCustomSpeciesName(item)}
                          className={`text-xs px-2.5 py-1 rounded-full border transition-all ${
                            customSpeciesName.toLowerCase() === item.toLowerCase()
                              ? "bg-fern text-white border-fern"
                              : "bg-white/80 text-canopy/70 border-sage/50 hover:border-fern hover:text-canopy"
                          }`}
                        >
                          {item}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Optional nickname */}
                  <div>
                    <label htmlFor="common_name" className={labelClass}>
                      Nickname <span className="text-canopy/40">(Optional)</span>
                    </label>
                    <input
                      id="common_name"
                      name="common_name"
                      type="text"
                      value={formData.common_name}
                      onChange={handleChange}
                      placeholder="e.g. My Balcony Neem, Office Snake Plant"
                      className={inputClass}
                    />
                  </div>
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label htmlFor="space_type" className={labelClass}>
                        Space Type
                      </label>
                      <select
                        id="space_type"
                        name="space_type"
                        value={formData.space_type}
                        onChange={handleChange as any}
                        className={inputClass}
                      >
                        <option value="indoor">Indoor</option>
                        <option value="outdoor_balcony">Outdoor Balcony</option>
                        <option value="outdoor_garden">Outdoor Garden</option>
                        <option value="public_park">Public Park</option>
                      </select>
                    </div>
                    <div className="flex-1">
                      <label htmlFor="planting_date" className={labelClass}>
                        Planting Date
                      </label>
                      <input
                        id="planting_date"
                        name="planting_date"
                        type="date"
                        value={formData.planting_date}
                        onChange={handleChange}
                        className={inputClass}
                      />
                    </div>
                  </div>
                </motion.div>
              )}

              {step === 2 && (
                <motion.div key="step2" {...(stepAnim as any)} className="flex flex-col gap-3">
                  <LiveCameraCapture
                    label="Live Plant Registration Photo"
                    sublabel="Strictly live camera capture required. Align the plant/tree inside the target frame."
                    initialPreview={formData.image_url}
                    onCapture={(_file, previewUrl) => {
                      setFormData((prev) => ({ ...prev, image_url: previewUrl }));
                    }}
                    onClear={() => {
                      setFormData((prev) => ({ ...prev, image_url: "" }));
                    }}
                  />
                </motion.div>
              )}

              {step === 3 && (
                <motion.div key="step3" {...(stepAnim as any)} className="flex flex-col gap-4">
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label htmlFor="latitude" className={labelClass}>
                        Latitude <span className="text-red-500">*</span>
                      </label>
                      <input
                        id="latitude"
                        name="latitude"
                        type="number"
                        step="any"
                        value={formData.latitude}
                        onChange={handleChange}
                        placeholder="e.g. 28.6139"
                        className={inputClass}
                      />
                    </div>
                    <div className="flex-1">
                      <label htmlFor="longitude" className={labelClass}>
                        Longitude <span className="text-red-500">*</span>
                      </label>
                      <input
                        id="longitude"
                        name="longitude"
                        type="number"
                        step="any"
                        value={formData.longitude}
                        onChange={handleChange}
                        placeholder="e.g. 77.2090"
                        className={inputClass}
                      />
                    </div>
                  </div>

                  <motion.button
                    type="button"
                    onClick={handleGpsAutoFill}
                    disabled={isGpsLoading}
                    whileTap={shouldReduceMotion ? {} : { scale: 0.97 }}
                    className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border border-sage/60 bg-white/60 text-fern text-sm font-medium hover:bg-sage/10 transition-colors disabled:opacity-60"
                  >
                    <MapPinIcon size={18} />
                    {isGpsLoading ? "Fetching location…" : "Auto-fill from GPS"}
                  </motion.button>

                  {/* Public Community Map Opt-In */}
                  <div className="p-4 rounded-2xl bg-white/80 border border-sage/60 shadow-xs flex items-start gap-3.5 mt-1 transition-all">
                    <input
                      type="checkbox"
                      id="is_public_on_map"
                      name="is_public_on_map"
                      checked={formData.is_public_on_map}
                      onChange={(e) => setFormData((prev) => ({ ...prev, is_public_on_map: e.target.checked }))}
                      className="mt-1 w-4 h-4 rounded text-fern focus:ring-fern accent-fern cursor-pointer"
                    />
                    <label htmlFor="is_public_on_map" className="flex-1 cursor-pointer select-none">
                      <div className="flex items-center gap-2">
                        <Globe size={15} className="text-fern" />
                        <span className="text-sm font-semibold text-canopy">
                          Display this tree on the Public Community Map
                        </span>
                      </div>
                      <p className="text-xs text-canopy/60 mt-1 leading-relaxed">
                        When enabled, other citizens across your city can discover this tree, its location, age, and your first name on the Community Canopy Map.
                      </p>
                    </label>
                  </div>
                </motion.div>
              )}

              {step === 4 && (
                <motion.div
                  key="step4"
                  {...(stepAnim as any)}
                  className="flex flex-col items-center gap-4 py-4"
                >
                  {/* Photo & QR Confirmation */}
                  <div className="flex items-center gap-4">
                    {formData.image_url && (
                      <div className="w-16 h-16 rounded-xl overflow-hidden border border-sage/30 shadow-sm">
                        <img src={formData.image_url} alt="Plant" className="w-full h-full object-cover" />
                      </div>
                    )}
                    <div className="w-16 h-16 bg-fern rounded-xl flex items-center justify-center text-parchment shadow-sm">
                      <QRIcon size={36} />
                    </div>
                  </div>

                  <div className="text-center">
                    <h3 className="font-display text-lg font-semibold text-canopy mb-1">
                      Plant Registered!
                    </h3>
                    <p className="text-sm text-canopy/60 max-w-xs">
                      <span className="font-medium text-canopy">
                        {formData.common_name || speciesList.find((s) => s.id === formData.species_id)?.common_name || "Plant"}
                      </span> has been submitted for verification. Your plant photo & passport are live.
                    </p>
                  </div>
                  <div className="text-xs font-mono text-canopy/40 bg-sage/10 px-3 py-1.5 rounded-lg">
                    {formData.latitude}, {formData.longitude}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Error message */}
            {error && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-2"
              >
                {error}
              </motion.p>
            )}

            {/* Footer buttons */}
            <div className="flex gap-3 mt-6">
              {step < 4 && step > 1 && (
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setStep((s) => s - 1);
                  }}
                  className="flex-1 py-2.5 rounded-xl border border-sage/60 bg-white/60 text-canopy text-sm font-medium hover:bg-sage/10 transition-colors"
                >
                  Back
                </button>
              )}

              {step < 4 ? (
                <motion.button
                  type="button"
                  onClick={handleNext}
                  disabled={isSubmitting}
                  whileTap={shouldReduceMotion ? {} : { scale: 0.97 }}
                  className="flex-1 py-2.5 rounded-xl bg-fern hover:bg-forest text-parchment text-sm font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {step === 3
                    ? isSubmitting
                      ? "Registering…"
                      : "Register Plant"
                    : "Next"}
                </motion.button>
              ) : (
                <motion.button
                  type="button"
                  onClick={handleClose}
                  whileTap={shouldReduceMotion ? {} : { scale: 0.97 }}
                  className="flex-1 py-2.5 rounded-xl bg-fern hover:bg-forest text-parchment text-sm font-medium transition-colors"
                >
                  Done
                </motion.button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

