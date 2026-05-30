"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import api from "@/lib/axios";

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
  species_name: string;
  species_description: string;
  latitude: string;
  longitude: string;
}

const TOTAL_STEPS = 3;

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

  const [formData, setFormData] = useState<FormData>({
    species_name: "",
    species_description: "",
    latitude: "",
    longitude: "",
  });

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const { name, value } = e.target;
      setFormData((prev) => ({ ...prev, [name]: value }));
    },
    []
  );

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
      () => {
        setError("Unable to retrieve your location.");
        setIsGpsLoading(false);
      }
    );
  }, []);

  const handleNext = useCallback(() => {
    setError(null);
    if (step === 1) {
      if (!formData.species_name.trim()) {
        setError("Species name is required.");
        return;
      }
    }
    if (step === 2) {
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
      await api.post("/plants", {
        species_name: formData.species_name,
        description: formData.species_description,
        latitude: parseFloat(formData.latitude),
        longitude: parseFloat(formData.longitude),
      });
      setStep(3);
      onSuccess();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        "Registration failed. Please try again.";
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, onSuccess]);

  const handleClose = useCallback(() => {
    setStep(1);
    setError(null);
    setFormData({
      species_name: "",
      species_description: "",
      latitude: "",
      longitude: "",
    });
    onClose();
  }, [onClose]);

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
              {[1, 2, 3].map((s, idx) => (
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
                  {idx < 2 && (
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
                  <div>
                    <label htmlFor="species_name" className={labelClass}>
                      Species Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="species_name"
                      name="species_name"
                      type="text"
                      value={formData.species_name}
                      onChange={handleChange}
                      placeholder="e.g. Sacred Fig"
                      className={inputClass}
                      autoFocus
                    />
                  </div>
                  <div>
                    <label htmlFor="species_description" className={labelClass}>
                      Description
                    </label>
                    <textarea
                      id="species_description"
                      name="species_description"
                      value={formData.species_description}
                      onChange={handleChange}
                      placeholder="Describe the plant, its characteristics, or any notable features…"
                      rows={4}
                      className={`${inputClass} resize-none`}
                    />
                  </div>
                </motion.div>
              )}

              {step === 2 && (
                <motion.div key="step2" {...(stepAnim as any)} className="flex flex-col gap-4">
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
                </motion.div>
              )}

              {step === 3 && (
                <motion.div
                  key="step3"
                  {...(stepAnim as any)}
                  className="flex flex-col items-center gap-4 py-4"
                >
                  {/* QR placeholder */}
                  <div className="w-16 h-16 bg-fern rounded-xl flex items-center justify-center text-parchment">
                    <QRIcon size={36} />
                  </div>
                  <div className="text-center">
                    <h3 className="font-display text-lg font-semibold text-canopy mb-1">
                      Plant Registered!
                    </h3>
                    <p className="text-sm text-canopy/60 max-w-xs">
                      <span className="font-medium text-canopy">{formData.species_name}</span> has
                      been submitted for verification. Your QR code will be generated shortly.
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
              {step < 3 && step > 1 && (
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

              {step < 3 ? (
                <motion.button
                  type="button"
                  onClick={handleNext}
                  disabled={isSubmitting}
                  whileTap={shouldReduceMotion ? {} : { scale: 0.97 }}
                  className="flex-1 py-2.5 rounded-xl bg-fern hover:bg-forest text-parchment text-sm font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {step === 2
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
