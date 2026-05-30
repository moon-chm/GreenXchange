import { Leaf, Wind, Info, AlertTriangle, Droplets } from "lucide-react";

interface SpeciesCardProps {
  species: {
    species_id: string;
    common_name: string;
    scientific_name: string;
    pollution_absorption_score: number;
    maintenance_level: string;
    explanation: string;
    care_guidance: string;
    score: number;
  };
  rank: number;
}

export default function SpeciesCard({ species, rank }: SpeciesCardProps) {
  return (
    <div className="bg-gray-900/60 border border-white/10 rounded-2xl p-6 relative overflow-hidden transition-all duration-300 hover:border-emerald-500/50 hover:bg-gray-800/80 group">
      
      {/* Rank Badge */}
      <div className="absolute top-0 right-0 bg-emerald-500 text-gray-950 font-bold px-4 py-1 rounded-bl-xl text-sm z-10">
        #{rank} Match
      </div>

      <div className="flex flex-col md:flex-row gap-6 items-start relative z-10">
        
        {/* Image Placeholder */}
        <div className="w-full md:w-32 h-40 bg-gray-800 rounded-xl flex flex-col items-center justify-center border border-white/5 relative overflow-hidden">
          <Leaf className="w-12 h-12 text-emerald-500/20 absolute -right-2 -bottom-2" />
          <div className="text-gray-500 text-sm font-medium uppercase tracking-widest text-center mt-2">
            Image<br/>Stub
          </div>
        </div>

        {/* Info Area */}
        <div className="flex-1 space-y-3">
          <div>
            <h3 className="text-2xl font-bold text-white group-hover:text-emerald-400 transition-colors">
              {species.common_name}
            </h3>
            <p className="text-gray-400 text-sm italic">{species.scientific_name}</p>
          </div>

          <p className="text-gray-300 text-sm leading-relaxed border-l-2 border-emerald-500/50 pl-3 my-3">
            {species.explanation}
          </p>

          <div className="flex flex-wrap gap-3 mt-4">
            
            {/* Air Quality Gauge */}
            <div className="flex items-center space-x-2 bg-gray-950/50 px-3 py-1.5 rounded-lg border border-white/5">
              <Wind className="w-4 h-4 text-sky-400" />
              <div className="flex flex-col">
                <span className="text-[10px] uppercase text-gray-500 font-semibold tracking-wider">Pollution Filter</span>
                <div className="w-24 h-1.5 bg-gray-800 rounded-full mt-1 overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-sky-500 to-emerald-400 rounded-full"
                    style={{ width: `${Math.min(100, species.pollution_absorption_score * 2)}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Maintenance */}
            <div className="flex items-center space-x-2 bg-gray-950/50 px-3 py-1.5 rounded-lg border border-white/5">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <div className="flex flex-col">
                <span className="text-[10px] uppercase text-gray-500 font-semibold tracking-wider">Maintenance</span>
                <span className="text-xs font-medium text-white">{species.maintenance_level}</span>
              </div>
            </div>

            {/* Care Guidance */}
            <div className="flex items-center space-x-2 bg-gray-950/50 px-3 py-1.5 rounded-lg border border-white/5">
              <Droplets className="w-4 h-4 text-blue-400" />
              <div className="flex flex-col">
                <span className="text-[10px] uppercase text-gray-500 font-semibold tracking-wider">Care Info</span>
                <span className="text-xs font-medium text-white">{species.care_guidance}</span>
              </div>
            </div>

          </div>
        </div>
        
        {/* Score Ring */}
        <div className="hidden md:flex flex-col items-center justify-center shrink-0 w-24 h-24 rounded-full border-4 border-emerald-500/20">
          <span className="text-2xl font-bold text-emerald-400">{Math.round(species.score * 100)}</span>
          <span className="text-[10px] uppercase font-bold text-gray-500 tracking-widest mt-1">Score</span>
        </div>

      </div>
    </div>
  );
}
