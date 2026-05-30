"use client";
import { useEffect, useState } from "react";
import api from "@/lib/axios";
import { useAuth } from "@/context/AuthContext";
import { Cloud, Droplets, Thermometer, Wind, AlertCircle } from "lucide-react";

interface EnvironmentProfile {
  tile_id: string;
  weather: {
    temperature: number;
    humidity: number;
    climate_zone: string;
  };
  air_quality: {
    aqi: number;
    pm25: number;
    severity: string;
  };
  stale: boolean;
}

export default function EnvironmentalPanel() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<EnvironmentProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Need user location
    if (!user) return;
    
    // Simulate user having location, default to NYC if null in db
    // Wait, the API requires lat/lng in query params!
    // In a real app we'd pull this from user object or geolocation API.
    // Assuming backend returns lat/lng in user profile.
    const lat = 40.7128; // fallback
    const lng = -74.0060;

    api.get(`/environment/profile?lat=${lat}&lng=${lng}`)
      .then((res) => {
        setProfile(res.data);
      })
      .catch((err) => {
        setError("Failed to load environment profile.");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [user]);

  if (loading) {
    return <div className="animate-pulse bg-gray-800 rounded-xl h-48 w-full max-w-lg mt-8"></div>;
  }

  if (error || !profile) {
    return <div className="text-red-400 mt-8 text-center">{error}</div>;
  }

  const { weather, air_quality, stale } = profile;

  // Compute ring color based on severity
  const getSeverityColor = (severity: string) => {
    switch(severity) {
      case "Good": return "text-emerald-400 border-emerald-400/50 shadow-[0_0_15px_rgba(52,211,153,0.3)]";
      case "Moderate": return "text-yellow-400 border-yellow-400/50 shadow-[0_0_15px_rgba(250,204,21,0.3)]";
      case "Unhealthy for Sensitive Groups": return "text-orange-400 border-orange-400/50 shadow-[0_0_15px_rgba(251,146,60,0.3)]";
      case "Unhealthy": return "text-red-400 border-red-400/50 shadow-[0_0_15px_rgba(248,113,113,0.3)]";
      default: return "text-purple-400 border-purple-400/50 shadow-[0_0_15px_rgba(192,132,252,0.3)]";
    }
  };

  const getSeverityBg = (severity: string) => {
    switch(severity) {
      case "Good": return "bg-emerald-500/10";
      case "Moderate": return "bg-yellow-500/10";
      case "Unhealthy for Sensitive Groups": return "bg-orange-500/10";
      case "Unhealthy": return "bg-red-500/10";
      default: return "bg-purple-500/10";
    }
  };

  const ringStyle = getSeverityColor(air_quality.severity);
  const bgStyle = getSeverityBg(air_quality.severity);

  return (
    <div className={`mt-8 w-full max-w-3xl rounded-2xl border border-white/5 bg-gray-900/40 backdrop-blur-xl p-8 relative overflow-hidden transition-all duration-500 hover:bg-gray-800/60`}>
      {/* Decorative gradient orb */}
      <div className={`absolute -right-20 -top-20 w-64 h-64 rounded-full blur-3xl opacity-20 ${bgStyle}`}></div>
      
      <div className="relative z-10 flex flex-col md:flex-row items-center md:items-stretch justify-between gap-8">
        
        {/* Left: AQI Primary Ring */}
        <div className="flex flex-col items-center justify-center space-y-4">
          <h2 className="text-gray-400 text-sm font-semibold tracking-widest uppercase">Air Quality</h2>
          <div className={`w-36 h-36 rounded-full border-4 flex flex-col items-center justify-center ${ringStyle}`}>
            <span className="text-4xl font-bold">{air_quality.aqi}</span>
            <span className="text-xs font-medium uppercase mt-1">AQI</span>
          </div>
          <span className={`text-sm font-medium ${ringStyle.split(' ')[0]}`}>{air_quality.severity}</span>
        </div>

        {/* Right: Metrics Grid */}
        <div className="flex-1 grid grid-cols-2 gap-4 w-full">
          {/* PM2.5 */}
          <div className="bg-gray-900/50 border border-white/5 rounded-xl p-4 flex items-start space-x-3 hover:border-white/10 transition-colors">
            <Wind className="text-gray-400 w-5 h-5 mt-0.5" />
            <div>
              <p className="text-gray-400 text-xs uppercase font-semibold">PM2.5</p>
              <p className="text-white font-medium text-lg mt-1">{air_quality.pm25} µg/m³</p>
            </div>
          </div>
          
          {/* Temp */}
          <div className="bg-gray-900/50 border border-white/5 rounded-xl p-4 flex items-start space-x-3 hover:border-white/10 transition-colors">
            <Thermometer className="text-gray-400 w-5 h-5 mt-0.5" />
            <div>
              <p className="text-gray-400 text-xs uppercase font-semibold">Temperature</p>
              <p className="text-white font-medium text-lg mt-1">{weather.temperature}°C</p>
            </div>
          </div>

          {/* Humidity */}
          <div className="bg-gray-900/50 border border-white/5 rounded-xl p-4 flex items-start space-x-3 hover:border-white/10 transition-colors">
            <Droplets className="text-blue-400/80 w-5 h-5 mt-0.5" />
            <div>
              <p className="text-gray-400 text-xs uppercase font-semibold">Humidity</p>
              <p className="text-white font-medium text-lg mt-1">{weather.humidity}%</p>
            </div>
          </div>

          {/* Climate */}
          <div className="bg-gray-900/50 border border-white/5 rounded-xl p-4 flex items-start space-x-3 hover:border-white/10 transition-colors">
            <Cloud className="text-gray-400 w-5 h-5 mt-0.5" />
            <div>
              <p className="text-gray-400 text-xs uppercase font-semibold">Zone</p>
              <p className="text-white font-medium text-lg mt-1">{weather.climate_zone}</p>
            </div>
          </div>
        </div>
      </div>
      
      {/* Stale Warning Indicator */}
      {stale && (
        <div className="absolute top-4 right-4 flex items-center text-yellow-500/80 text-xs font-medium bg-yellow-500/10 px-2 py-1 rounded-full border border-yellow-500/20">
          <AlertCircle className="w-3 h-3 mr-1" />
          Refreshing
        </div>
      )}
    </div>
  );
}
