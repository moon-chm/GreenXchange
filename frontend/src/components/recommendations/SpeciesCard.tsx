"use client";
import { Leaf, ArrowRight } from "lucide-react";
import { rankingScore } from "@/lib/recommendations";

export interface Species {
  species_id: string;
  common_name: string;
  scientific_name: string;
  maintenance_level?: string | number;
  explanation: string;
  care_guidance?: string;
  score?: number;
  environment_note?: string;
}

export default function SpeciesCard({ species, onChoose }: { species: Species; onChoose: (species: Species, trigger: HTMLButtonElement) => void }) {
  const score = rankingScore(species.score);
  return (
    <article className="rounded-2xl border border-sage/40 bg-white/90 shadow-card p-5 sm:p-6 space-y-4 min-w-0">
      <div className="flex flex-col sm:flex-row items-start justify-between gap-3">
        <div className="flex gap-3 min-w-0 flex-1">
          <div className="rounded-xl bg-fern/10 p-3 text-fern self-start"><Leaf size={22} aria-hidden="true" /></div>
          <div className="min-w-0"><h3 className="font-display text-xl font-semibold text-canopy break-words">{species.common_name}</h3><p className="text-sm italic text-canopy/70 break-words">{species.scientific_name}</p></div>
        </div>
        <span className="shrink-0 rounded-full bg-fern/10 px-3 py-1.5 text-sm text-forest font-semibold">{score === null ? "Score unavailable" : `${score}/100 ranking`}</span>
      </div>
      <p className="text-sm text-canopy/80 leading-relaxed">{species.explanation}</p>
      <p className="text-sm text-canopy/70"><strong>Care level:</strong> {species.maintenance_level ?? "Not listed"}</p>
      {species.care_guidance && <p className="text-sm text-canopy/70 leading-relaxed">{species.care_guidance}</p>}
      <button type="button" onClick={(event) => onChoose(species, event.currentTarget)} className="min-h-11 w-full sm:w-auto rounded-xl bg-fern px-4 py-3 text-white text-sm font-semibold inline-flex justify-center items-center gap-2">Register this plant <ArrowRight size={16} aria-hidden="true" /></button>
    </article>
  );
}
