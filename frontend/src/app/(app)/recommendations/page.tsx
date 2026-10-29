"use client";

import { useEffect, useRef, useState } from "react";
import { Leaf, MapPin, Search, Sparkles, Loader2 } from "lucide-react";
import api from "@/lib/axios";
import { extractErrorMessage } from "@/lib/utils";
import { coordinates } from "@/lib/recommendations";
import SpeciesCard, { type Species } from "@/components/recommendations/SpeciesCard";
import PlantRegistrationModal from "@/components/plants/PlantRegistrationModal";

interface Analysis {
  plant_name: string;
  scientific_name: string;
  overall_score: number;
  suitability_grade: string;
  xai_breakdown: { feature: string; score: number; weight_pct: number; reason: string }[];
  genai_synthesis: string;
  recommended_space: string;
  care_guide: string;
  environment_note?: string;
  safety_note?: string;
}
const inputClass = "w-full min-h-11 rounded-xl border border-sage bg-white px-3 py-2 text-canopy focus:outline-none focus:ring-2 focus:ring-fern";
const buttonClass = "min-h-11 rounded-xl bg-fern px-5 py-3 text-white font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-forest inline-flex items-center justify-center gap-2";

export default function RecommendationsPage() {
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [space, setSpace] = useState("outdoor_garden");
  const [beginner, setBeginner] = useState(false);
  const [lowCare, setLowCare] = useState(false);
  const [pets, setPets] = useState(false);
  const [children, setChildren] = useState(false);
  const [locLoading, setLocLoading] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Species[] | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Species | null>(null);
  const requestRef = useRef<AbortController | null>(null);
  const analysisRef = useRef<AbortController | null>(null);
  const gpsRef = useRef(0);
  const registrationTrigger = useRef<HTMLButtonElement | null>(null);
  const location = coordinates(latitude, longitude);

  // A changed preference invalidates results and any older in-flight response.
  useEffect(() => {
    requestRef.current?.abort(); analysisRef.current?.abort();
    requestRef.current = null; analysisRef.current = null;
    setResults(null); setAnalysis(null); setLoading(false); setAnalyzing(false);
    setFetchError(null); setAnalysisError(null);
  }, [latitude, longitude, space, beginner, lowCare, pets, children]);
  useEffect(() => () => {
    requestRef.current?.abort(); analysisRef.current?.abort(); gpsRef.current += 1;
  }, []);

  function useLocation() {
    if (!navigator.geolocation) { setLocError("Location access is unavailable. Enter coordinates below."); return; }
    const requestId = ++gpsRef.current;
    setLocLoading(true); setLocError(null);
    navigator.geolocation.getCurrentPosition((position) => {
      if (gpsRef.current !== requestId) return;
      setLatitude(position.coords.latitude.toFixed(5)); setLongitude(position.coords.longitude.toFixed(5)); setLocLoading(false);
    }, (error) => {
      if (gpsRef.current !== requestId) return;
      setLocLoading(false);
      setLocError(error.code === 1 ? "Location permission was denied. Allow it in your browser or enter coordinates below." : "Could not find your location. Try again or enter coordinates below.");
    }, { timeout: 10000, maximumAge: 60000 });
  }
  function changeCoordinate(setter: (value: string) => void, value: string) {
    gpsRef.current += 1; setLocLoading(false); setLocError(null); setter(value);
  }
  function preferences() {
    return { ...location!, space_type: space, indoor: space === "indoor", experience_level: beginner ? "low" : "medium", has_pets: pets, has_children: children, low_maintenance: lowCare };
  }
  async function recommend() {
    if (!location || locLoading || requestRef.current) return;
    const controller = new AbortController(); requestRef.current = controller;
    setLoading(true); setFetchError(null); setResults(null);
    try {
      const response = await api.post<Species[]>("/recommendations/", preferences(), { signal: controller.signal });
      if (controller.signal.aborted) return;
      if (!Array.isArray(response.data)) throw new Error("Invalid recommendation response");
      setResults(response.data);
    } catch (error) {
      if (!controller.signal.aborted) setFetchError(extractErrorMessage(error, "Recommendations could not load. Please try again."));
    } finally {
      if (requestRef.current === controller) { requestRef.current = null; setLoading(false); }
    }
  }
  async function analyze(name = query) {
    if (!location || locLoading || !name.trim()) return;
    analysisRef.current?.abort();
    const controller = new AbortController(); analysisRef.current = controller;
    setQuery(name); setAnalyzing(true); setAnalysis(null); setAnalysisError(null);
    try {
      const response = await api.post<Analysis>("/recommendations/analyze", { ...preferences(), plant_name: name.trim() }, { signal: controller.signal });
      if (!controller.signal.aborted) setAnalysis(response.data);
    } catch (error) {
      if (!controller.signal.aborted) setAnalysisError(extractErrorMessage(error, "This plant could not be checked. Please try again."));
    } finally {
      if (analysisRef.current === controller) { analysisRef.current = null; setAnalyzing(false); }
    }
  }
  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <header><p className="text-fern text-sm font-semibold mb-2">GROW WITH CONFIDENCE</p><h1 className="font-display text-3xl sm:text-4xl font-semibold text-canopy">Find plants for your space</h1><p className="text-canopy/70 mt-2 max-w-2xl">Choose your growing conditions to explore suitable plants, compare care needs, or check a plant you have in mind.</p></header>
      <section aria-labelledby="preferences-title" className="rounded-2xl border border-sage/40 bg-white/90 p-5 sm:p-6 space-y-5 shadow-card">
        <div><h2 id="preferences-title" className="font-display text-xl font-semibold text-canopy">1. Your growing conditions</h2><p className="text-sm text-canopy/70 mt-1">These preferences apply to both tools below. Changing them clears previous results.</p></div>
        <div className="flex flex-wrap justify-between items-center gap-3"><h3 className="text-sm font-semibold text-canopy">Location</h3><button type="button" onClick={useLocation} disabled={locLoading} className={buttonClass}>{locLoading ? <Loader2 size={16} className="animate-spin" /> : <MapPin size={16} />}{locLoading ? "Finding location…" : "Use my location"}</button></div>
        <p className="text-sm text-canopy/70">Use your location or enter coordinates for the place you plan to grow. Coordinates are used to look up area conditions.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="text-sm font-medium text-canopy space-y-1 block">Latitude<input type="number" min={-90} max={90} step="any" value={latitude} onChange={e => changeCoordinate(setLatitude, e.target.value)} placeholder="−90 to 90" className={inputClass} /></label>
          <label className="text-sm font-medium text-canopy space-y-1 block">Longitude<input type="number" min={-180} max={180} step="any" value={longitude} onChange={e => changeCoordinate(setLongitude, e.target.value)} placeholder="−180 to 180" className={inputClass} /></label>
        </div>
        {locError && <p role="alert" className="text-sm text-red-700">{locError}</p>}
        {!location && <p className="text-sm text-canopy/70">Enter valid latitude and longitude to enable recommendations.</p>}
        <label className="block text-sm font-semibold text-canopy space-y-2">Growing space<select value={space} onChange={e => setSpace(e.target.value)} className={inputClass}><option value="indoor">Indoors</option><option value="outdoor_balcony">Balcony</option><option value="outdoor_garden">Outdoor garden</option><option value="public_park">Public park</option></select></label>
        <fieldset><legend className="text-sm font-semibold text-canopy mb-2">Care and household preferences</legend><div className="grid grid-cols-1 sm:grid-cols-2 gap-2">{[
          { label: "Beginner gardener", checked: beginner, set: setBeginner },
          { label: "Low-maintenance plants only", checked: lowCare, set: setLowCare },
          { label: "I have pets", checked: pets, set: setPets },
          { label: "I have children", checked: children, set: setChildren },
        ].map(item => <label key={item.label} className="flex items-center gap-3 min-h-11 rounded-xl bg-sage/10 px-3 py-2 text-sm text-canopy cursor-pointer"><input type="checkbox" checked={item.checked} onChange={e => item.set(e.target.checked)} className="w-4 h-4 accent-fern" />{item.label}</label>)}</div><p className="text-xs text-canopy/70 mt-2">Household preferences exclude catalog-listed toxic plants from the list. They do not certify a plant as safe or edible.</p></fieldset>
      </section>
      <section aria-labelledby="catalog-title" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 id="catalog-title" className="font-display text-xl font-semibold text-canopy">2. Explore recommended plants</h2><p className="text-sm text-canopy/70 mt-1">Ranked suggestions, not a probability of growth success.</p></div><button type="button" onClick={recommend} disabled={!location || loading || locLoading} className={buttonClass}>{loading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}{loading ? "Finding plants…" : "Find recommendations"}</button></div>
        <div aria-live="polite" aria-busy={loading}>
          {loading && <p role="status" className="rounded-xl bg-sage/15 p-5 text-canopy">Checking your conditions against the plant catalog…</p>}
          {fetchError && <div role="alert" className="rounded-xl bg-red-50 border border-red-200 p-4 text-red-700"><p>{fetchError}</p><button type="button" onClick={recommend} className="underline min-h-11 font-semibold">Try again</button></div>}
          {!loading && !fetchError && results === null && <div className="rounded-2xl border border-dashed border-sage p-6 text-canopy/70 flex gap-3 items-center"><Leaf className="shrink-0 text-fern" /><p>Your plant shortlist will appear here once you choose your conditions and select Find recommendations.</p></div>}
          {results && !loading && <><p className="text-sm text-canopy/70 mb-3">{results.length ? `${results.length} ${results.length === 1 ? "plant" : "plants"} matched your preferences.` : "No plants matched. Try another growing space or adjust the care preferences."}</p>{results[0]?.environment_note && <p className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-sm text-amber-900 mb-4">{results[0].environment_note}</p>}<div className="grid grid-cols-1 md:grid-cols-2 gap-4">{results.map(species => <SpeciesCard key={species.species_id} species={species} onChoose={(plant, trigger) => { registrationTrigger.current = trigger; setSelected(plant); }} />)}</div></>}
        </div>
      </section>
      <section aria-labelledby="analysis-title" className="rounded-2xl border border-sage/40 bg-white/90 p-5 sm:p-6 space-y-4 shadow-card">
        <div><h2 id="analysis-title" className="font-display text-xl font-semibold text-canopy">Have a plant in mind?</h2><p className="text-sm text-canopy/70 mt-1">Check a common or scientific name against catalog facts and your selected conditions.</p></div>
        <form onSubmit={e => { e.preventDefault(); void analyze(); }} className="space-y-2"><label htmlFor="plant-search" className="text-sm font-semibold text-canopy">Plant name</label><div className="flex flex-col sm:flex-row gap-3"><input id="plant-search" maxLength={100} value={query} onChange={e => { setQuery(e.target.value); analysisRef.current?.abort(); analysisRef.current = null; setAnalyzing(false); setAnalysis(null); setAnalysisError(null); }} placeholder="Common or scientific name" className={inputClass} /><button disabled={!location || locLoading || analyzing || !query.trim()} className={`${buttonClass} shrink-0`}>{analyzing ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}{analyzing ? "Checking…" : "Check plant"}</button></div></form>
        {!!results?.length && <div className="flex flex-wrap gap-2">{results.slice(0, 4).map(item => <button type="button" key={item.species_id} onClick={() => analyze(item.scientific_name)} disabled={locLoading} className="min-h-11 px-3 rounded-full border border-sage text-sm text-canopy hover:bg-sage/20">{item.common_name}</button>)}</div>}
        <div aria-live="polite" aria-busy={analyzing}>
          {analyzing && <p role="status" className="text-sm text-canopy/70">Checking catalog information…</p>}
          {analysisError && <p role="alert" className="rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700">{analysisError}</p>}
          {analysis && <div className="space-y-4 border-t border-sage/40 pt-5">
            <div className="flex flex-wrap justify-between gap-3"><div><h3 className="font-display text-2xl text-canopy font-semibold break-words">{analysis.plant_name}</h3><p className="text-sm italic text-canopy/70">{analysis.scientific_name}</p></div><div className="rounded-xl bg-sage/15 p-3 text-canopy"><p className="font-semibold">{analysis.suitability_grade}</p><p className="text-sm">{analysis.overall_score}/100 factor score</p></div></div>
            <p className="text-sm text-canopy/80 leading-relaxed">{analysis.genai_synthesis}</p>
            <p className="text-sm text-canopy/70">Catalog-based assessment. Scores describe the factors below, not a guarantee of plant health.</p>
            {analysis.environment_note && <p className="text-sm rounded-xl bg-amber-50 p-3 text-amber-900">{analysis.environment_note}</p>}
            {analysis.safety_note && <p className="text-sm rounded-xl border border-sage p-3 text-canopy"><strong>Household note:</strong> {analysis.safety_note}</p>}
            <div className="space-y-4">{analysis.xai_breakdown.map(item => <div key={item.feature}><div className="flex flex-wrap justify-between gap-2 text-sm text-canopy"><strong>{item.feature}</strong><span>{item.score}/100 · {item.weight_pct}% weight</span></div><div className="mt-2 h-2 rounded-full bg-sage/20 overflow-hidden" aria-hidden="true"><div className="h-full bg-fern rounded-full" style={{width: `${Math.min(100, Math.max(0, item.score))}%`}} /></div><p className="text-sm text-canopy/70 mt-1">{item.reason}</p></div>)}</div>
            <p className="text-sm text-canopy/80"><strong>Listed growing spaces:</strong> {analysis.recommended_space}</p><p className="text-sm text-canopy/80"><strong>Care:</strong> {analysis.care_guide}</p>
          </div>}
        </div>
      </section>
      {selected && <PlantRegistrationModal isOpen onClose={() => setSelected(null)} onSuccess={() => {}} initialPlantName={selected.common_name} initialSpaceType={space} returnFocusRef={registrationTrigger} />}
    </div>
  );
}
