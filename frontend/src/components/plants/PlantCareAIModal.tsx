"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Sparkles, Droplets, Sun, Sparkle, Scissors, ShieldAlert, HeartHandshake, Check, ChevronRight, ArrowLeft } from "lucide-react";
import api from "@/lib/axios";

interface PlantOption {
  id: string;
  name: string;
}

interface PlantCareAIModalProps {
  isOpen: boolean;
  onClose: () => void;
  userPlants?: PlantOption[];
  defaultPlantName?: string;
}

const LANGUAGES = [
  { code: "English", label: "English", flag: "🇬🇧" },
  { code: "Hindi", label: "Hindi (हिंदी)", flag: "🇮🇳" },
  { code: "Marathi", label: "Marathi (मराठी)", flag: "🚩" },
  { code: "Spanish", label: "Spanish (Español)", flag: "🇪🇸" },
  { code: "French", label: "French (Français)", flag: "🇫🇷" },
  { code: "German", label: "German (Deutsch)", flag: "🇩🇪" },
  { code: "Tamil", label: "Tamil (தமிழ்)", flag: "🇮🇳" },
  { code: "Telugu", label: "Telugu (తెలుగు)", flag: "🇮🇳" },
  { code: "Gujarati", label: "Gujarati (ગુજરાતી)", flag: "🇮🇳" },
  { code: "Bengali", label: "Bengali (বাংলা)", flag: "🇮🇳" },
];

const AGE_OPTIONS = [
  { label: "1 - 3 Months (Sapling)", months: 2 },
  { label: "4 - 6 Months (Young Plant)", months: 5 },
  { label: "7 - 12 Months (1 Year)", months: 9 },
  { label: "1 - 2 Years (Growing)", months: 18 },
  { label: "3+ Years (Established)", months: 36 },
];

interface CareGuideResult {
  plant_name: string;
  caretaker_greeting: string;
  language: string;
  age_months: number;
  water_advice: {
    quantity_ml_or_cups: string;
    frequency: string;
    instructions: string;
  };
  sunlight_advice: {
    placement: string;
    hours_per_day: string;
    tip: string;
  };
  fertilizer_advice: {
    type_recommended: string;
    frequency: string;
    npk_or_organic_tip: string;
  };
  pruning_soil_advice: string;
  nursery_secret_tip: string;
}

export default function PlantCareAIModal({
  isOpen,
  onClose,
  userPlants = [],
  defaultPlantName = "",
}: PlantCareAIModalProps) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Form State
  const [selectedPlantName, setSelectedPlantName] = useState(defaultPlantName || (userPlants[0]?.name ?? ""));
  const [customPlantName, setCustomPlantName] = useState("");
  const [selectedLanguage, setSelectedLanguage] = useState("English");
  const [ageMonths, setAgeMonths] = useState(6);
  const [spaceType, setSpaceType] = useState("indoor");
  const [seasonCondition, setSeasonCondition] = useState("Summer/Monsoon");

  // API Call State
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CareGuideResult | null>(null);

  const effectivePlantName = customPlantName.trim() || selectedPlantName || "Plant";

  const handleGenerateCareGuide = async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = {
        plant_name: effectivePlantName,
        language: selectedLanguage,
        age_months: ageMonths,
        space_type: spaceType,
        season_or_condition: seasonCondition,
      };

      const res = await api.post<CareGuideResult>("/plants/nursery-ai-guide", payload);
      setResult(res.data);
      setStep(4);
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Could not generate care guidance. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setStep(1);
    setResult(null);
    setError(null);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-canopy/65 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 15 }}
          className="bg-parchment rounded-3xl p-6 sm:p-8 max-w-2xl w-full shadow-2xl border border-sage/40 relative my-8"
        >
          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-5 right-5 p-2 rounded-2xl bg-sage/20 hover:bg-sage/40 text-canopy/70 hover:text-canopy transition-all"
          >
            <X size={20} />
          </button>

          {/* Modal Header */}
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-fern to-forest text-parchment flex items-center justify-center shadow-lg shadow-fern/20 text-2xl">
              🌱
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display text-2xl font-bold text-canopy">
                  Sprout AI Nursery Caretaker
                </h2>
                <span className="bg-amber-400/20 border border-amber-500/30 text-amber-900 font-bold text-[10px] uppercase tracking-wider px-2.5 py-0.5 rounded-full">
                  Plant Teacher
                </span>
              </div>
              <p className="text-xs text-canopy/70 font-sans mt-0.5">
                Simple, expert guidance on water quantity, sunlight, fertilizers & secret nursery tricks!
              </p>
            </div>
          </div>

          {/* Progress Indicator */}
          {step < 4 && (
            <div className="flex items-center justify-between mb-6 bg-white/70 p-3 rounded-2xl border border-sage/30">
              {[
                { s: 1, label: "1. Select Plant" },
                { s: 2, label: "2. Language" },
                { s: 3, label: "3. Age & Environment" },
              ].map((st) => (
                <div
                  key={st.s}
                  className={`flex items-center gap-1.5 text-xs font-semibold ${
                    step === st.s
                      ? "text-fern font-bold"
                      : step > st.s
                      ? "text-emerald-700 font-semibold"
                      : "text-canopy/40"
                  }`}
                >
                  <span
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                      step === st.s
                        ? "bg-fern text-parchment shadow-sm"
                        : step > st.s
                        ? "bg-emerald-600 text-parchment"
                        : "bg-sage/20 text-canopy/50"
                    }`}
                  >
                    {step > st.s ? <Check size={12} /> : st.s}
                  </span>
                  <span className="hidden sm:inline">{st.label}</span>
                </div>
              ))}
            </div>
          )}

          {/* STEP 1: Select Plant */}
          {step === 1 && (
            <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="space-y-5">
              <div>
                <label className="block text-sm font-bold text-canopy mb-2">
                  Which plant do you want nursery care suggestions for?
                </label>

                {userPlants.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                    {userPlants.map((plant) => {
                      const isSelected = selectedPlantName === plant.name && !customPlantName;
                      return (
                        <button
                          key={plant.id}
                          onClick={() => {
                            setSelectedPlantName(plant.name);
                            setCustomPlantName("");
                          }}
                          className={`p-3.5 rounded-2xl border text-left transition-all flex items-center gap-3 ${
                            isSelected
                              ? "border-fern bg-fern/10 shadow-sm"
                              : "border-sage/40 bg-white/80 hover:border-fern/50"
                          }`}
                        >
                          <span className="text-xl">🪴</span>
                          <div>
                            <p className="font-display font-semibold text-sm text-canopy">{plant.name}</p>
                            <p className="text-[10px] text-canopy/50">Registered in your portfolio</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                <div className="space-y-1.5">
                  <span className="text-xs font-semibold text-canopy/60">Or type any plant species name:</span>
                  <input
                    type="text"
                    placeholder="e.g. Money Plant, Rose, Tulsi, Snake Plant, Ficus, Bonsai..."
                    value={customPlantName}
                    onChange={(e) => setCustomPlantName(e.target.value)}
                    className="w-full px-4 py-3 rounded-2xl border border-sage/40 bg-white text-canopy text-sm font-sans focus:outline-none focus:ring-2 focus:ring-fern/50"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <button
                  onClick={() => setStep(2)}
                  disabled={!effectivePlantName}
                  className="px-6 py-3 bg-fern hover:bg-forest text-parchment font-semibold text-sm rounded-2xl transition-all disabled:opacity-50 flex items-center gap-2 shadow-md"
                >
                  Next: Choose Language <ChevronRight size={16} />
                </button>
              </div>
            </motion.div>
          )}

          {/* STEP 2: Language Selection */}
          {step === 2 && (
            <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="space-y-5">
              <div>
                <label className="block text-sm font-bold text-canopy mb-2">
                  Select your preferred guidance language:
                </label>
                <p className="text-xs text-canopy/60 mb-4">
                  Sprout AI will generate nursery caretaker guidance natively in this language!
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {LANGUAGES.map((lang) => {
                    const isSelected = selectedLanguage === lang.code;
                    return (
                      <button
                        key={lang.code}
                        onClick={() => setSelectedLanguage(lang.code)}
                        className={`p-3 rounded-2xl border text-left transition-all flex items-center gap-2.5 ${
                          isSelected
                            ? "border-fern bg-fern/15 text-fern font-bold shadow-sm"
                            : "border-sage/40 bg-white/80 text-canopy hover:border-fern/50"
                        }`}
                      >
                        <span className="text-lg">{lang.flag}</span>
                        <span className="text-xs font-semibold truncate">{lang.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-between pt-4">
                <button
                  onClick={() => setStep(1)}
                  className="px-4 py-2.5 text-canopy/70 hover:text-canopy font-semibold text-xs flex items-center gap-1"
                >
                  <ArrowLeft size={16} /> Back
                </button>

                <button
                  onClick={() => setStep(3)}
                  className="px-6 py-3 bg-fern hover:bg-forest text-parchment font-semibold text-sm rounded-2xl transition-all flex items-center gap-2 shadow-md"
                >
                  Next: Age & Environment <ChevronRight size={16} />
                </button>
              </div>
            </motion.div>
          )}

          {/* STEP 3: Age & Environment */}
          {step === 3 && (
            <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="space-y-5">
              {/* Plant Age Selection */}
              <div>
                <label className="block text-sm font-bold text-canopy mb-2">
                  How old is your {effectivePlantName}?
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {AGE_OPTIONS.map((opt) => (
                    <button
                      key={opt.months}
                      onClick={() => setAgeMonths(opt.months)}
                      className={`p-3 rounded-2xl border text-left text-xs font-semibold transition-all ${
                        ageMonths === opt.months
                          ? "border-fern bg-fern/15 text-fern font-bold shadow-sm"
                          : "border-sage/40 bg-white/80 text-canopy hover:border-fern/50"
                      }`}
                    >
                      🌱 {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Environment Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-canopy mb-1">Growing Location</label>
                  <select
                    value={spaceType}
                    onChange={(e) => setSpaceType(e.target.value)}
                    className="w-full p-3 rounded-2xl border border-sage/40 bg-white text-xs font-semibold text-canopy outline-none"
                  >
                    <option value="indoor">🏡 Indoor / Living Room / Desk</option>
                    <option value="outdoor_garden">🌻 Outdoor Garden / Balcony</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-canopy mb-1">Current Season / Weather</label>
                  <select
                    value={seasonCondition}
                    onChange={(e) => setSeasonCondition(e.target.value)}
                    className="w-full p-3 rounded-2xl border border-sage/40 bg-white text-xs font-semibold text-canopy outline-none"
                  >
                    <option value="Summer">☀️ Summer (Warm & Dry)</option>
                    <option value="Monsoon">🌧️ Monsoon / Rainy (Humid)</option>
                    <option value="Winter">❄️ Winter (Cool & Mild)</option>
                    <option value="Spring">🌸 Spring (Moderate)</option>
                  </select>
                </div>
              </div>

              {error && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-sans">
                  {error}
                </div>
              )}

              <div className="flex items-center justify-between pt-4">
                <button
                  onClick={() => setStep(2)}
                  className="px-4 py-2.5 text-canopy/70 hover:text-canopy font-semibold text-xs flex items-center gap-1"
                >
                  <ArrowLeft size={16} /> Back
                </button>

                <button
                  onClick={handleGenerateCareGuide}
                  disabled={loading}
                  className="px-6 py-3 bg-gradient-to-r from-fern to-forest text-parchment font-bold text-sm rounded-2xl transition-all shadow-lg shadow-fern/20 flex items-center gap-2 disabled:opacity-50"
                >
                  {loading ? (
                    <span className="animate-spin w-4 h-4 border-2 border-parchment border-t-transparent rounded-full" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  {loading ? "Asking Sprout AI..." : "Get Sprout Care Guide"}
                </button>
              </div>
            </motion.div>
          )}

          {/* STEP 4: Care Guide Result */}
          {step === 4 && result && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              {/* Sprout Caretaker Greeting */}
              <div className="p-5 rounded-2xl bg-gradient-to-r from-fern/20 via-emerald-50 to-amber-50 border border-fern/30 shadow-sm flex items-start gap-3">
                <div className="text-3xl shrink-0">🪴</div>
                <div>
                  <h3 className="font-display text-lg font-bold text-canopy">{result.plant_name} Nursery Care Guide</h3>
                  <p className="text-xs sm:text-sm text-canopy/80 italic font-sans mt-1 leading-relaxed">
                    "{result.caretaker_greeting}"
                  </p>
                  <div className="flex gap-2 mt-2">
                    <span className="text-[10px] font-bold bg-white/80 border border-sage/30 px-2 py-0.5 rounded-full text-canopy/70">
                      Age: ~{result.age_months} Months
                    </span>
                    <span className="text-[10px] font-bold bg-white/80 border border-sage/30 px-2 py-0.5 rounded-full text-canopy/70">
                      Language: {result.language}
                    </span>
                  </div>
                </div>
              </div>

              {/* Care Breakdown Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Water Advice */}
                <div className="p-4 rounded-2xl bg-white border border-sky-200/60 shadow-sm space-y-2">
                  <div className="flex items-center gap-2 text-sky-700 font-bold font-display text-sm">
                    <Droplets className="w-4 h-4" />
                    Watering Quantity & Schedule
                  </div>
                  <div className="text-xs space-y-1 font-sans text-canopy">
                    <p><strong>Exact Quantity:</strong> <span className="text-sky-800 font-bold">{result.water_advice.quantity_ml_or_cups}</span></p>
                    <p><strong>Frequency:</strong> {result.water_advice.frequency}</p>
                    <p className="text-[11px] text-canopy/70 bg-sky-50 p-2 rounded-xl border border-sky-100 mt-1">
                      {result.water_advice.instructions}
                    </p>
                  </div>
                </div>

                {/* Sunlight Advice */}
                <div className="p-4 rounded-2xl bg-white border border-amber-200/60 shadow-sm space-y-2">
                  <div className="flex items-center gap-2 text-amber-700 font-bold font-display text-sm">
                    <Sun className="w-4 h-4" />
                    Sunlight & Spot Selection
                  </div>
                  <div className="text-xs space-y-1 font-sans text-canopy">
                    <p><strong>Placement:</strong> {result.sunlight_advice.placement}</p>
                    <p><strong>Duration:</strong> {result.sunlight_advice.hours_per_day}</p>
                    <p className="text-[11px] text-canopy/70 bg-amber-50 p-2 rounded-xl border border-amber-100 mt-1">
                      {result.sunlight_advice.tip}
                    </p>
                  </div>
                </div>

                {/* Fertilizer Advice */}
                <div className="p-4 rounded-2xl bg-white border border-emerald-200/60 shadow-sm space-y-2">
                  <div className="flex items-center gap-2 text-emerald-700 font-bold font-display text-sm">
                    <Sparkles className="w-4 h-4" />
                    Fertilizer & NPK Feeding
                  </div>
                  <div className="text-xs space-y-1 font-sans text-canopy">
                    <p><strong>Type:</strong> {result.fertilizer_advice.type_recommended}</p>
                    <p><strong>Feeding Cycle:</strong> {result.fertilizer_advice.frequency}</p>
                    <p className="text-[11px] text-canopy/70 bg-emerald-50 p-2 rounded-xl border border-emerald-100 mt-1">
                      {result.fertilizer_advice.npk_or_organic_tip}
                    </p>
                  </div>
                </div>

                {/* Pruning & Soil */}
                <div className="p-4 rounded-2xl bg-white border border-sage/30 shadow-sm space-y-2">
                  <div className="flex items-center gap-2 text-canopy font-bold font-display text-sm">
                    <Scissors className="w-4 h-4 text-fern" />
                    Pruning & Soil Mix
                  </div>
                  <p className="text-xs text-canopy/80 font-sans leading-relaxed">
                    {result.pruning_soil_advice}
                  </p>
                </div>
              </div>

              {/* Nursery Secret Tip */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/15 to-fern/15 border border-amber-400/40 space-y-1">
                <div className="flex items-center gap-2 text-amber-900 font-bold font-display text-sm">
                  🌟 Nursery Caretaker Secret Trick
                </div>
                <p className="text-xs text-canopy/90 font-sans leading-relaxed">
                  {result.nursery_secret_tip}
                </p>
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  onClick={handleReset}
                  className="px-5 py-2.5 rounded-2xl border border-sage/40 bg-white hover:bg-sage/20 text-canopy font-semibold text-xs transition-all"
                >
                  Ask Care Guide for Another Plant
                </button>
                <button
                  onClick={onClose}
                  className="px-6 py-2.5 bg-fern hover:bg-forest text-parchment font-bold text-xs rounded-2xl transition-all shadow-md"
                >
                  Done
                </button>
              </div>
            </motion.div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
