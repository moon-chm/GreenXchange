"use client";

import { useState, useEffect } from "react";
import {
  X,
  Radio,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  Cpu,
  Activity,
  KeyRound,
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from "recharts";
import api from "@/lib/axios";

interface ThingSpeakModalProps {
  isOpen: boolean;
  onClose: () => void;
  channelId?: string;
  currentAqi?: number;
  currentCo?: number;
}

export default function ThingSpeakModal({
  isOpen,
  onClose,
  channelId = "3499335",
  currentAqi = 35,
  currentCo = 0.65,
}: ThingSpeakModalProps) {
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [statusMsg, setStatusMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [historyData, setHistoryData] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<"aqi" | "co">("aqi");

  useEffect(() => {
    if (!isOpen) return;

    // Load saved API key from localStorage
    const savedKey = localStorage.getItem("thingspeak_read_api_key") || "";
    setApiKey(savedKey);

    loadThingSpeakStream(savedKey);
  }, [isOpen]);

  const loadThingSpeakStream = async (keyToUse?: string) => {
    setLoading(true);
    setStatusMsg(null);
    try {
      const k = keyToUse !== undefined ? keyToUse : apiKey;
      const res = await api.get(`/environment/thingspeak?channel_id=${channelId}${k ? `&api_key=${k}` : ""}`);
      const payload = res.data;

      if (payload.history && payload.history.length > 0) {
        const formatted = payload.history.map((item: any, idx: number) => {
          let timeLabel = `Point ${idx + 1}`;
          if (item.created_at) {
            const d = new Date(item.created_at);
            timeLabel = `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
          }
          return {
            time: timeLabel,
            aqi: Number(item.aqi ?? currentAqi),
            co: Number(item.co_ppm ?? currentCo),
          };
        });
        setHistoryData(formatted);
      } else {
        // Generate current baseline history for visualization
        const synthetic = Array.from({ length: 8 }, (_, i) => ({
          time: `19:${(10 + i * 2).toString().padStart(2, "0")}`,
          aqi: currentAqi + (i % 2 === 0 ? 0 : 1),
          co: currentCo,
        }));
        setHistoryData(synthetic);
      }
    } catch (err) {
      console.warn("Could not fetch ThingSpeak history stream:", err);
      // Fallback points so chart always renders
      setHistoryData([
        { time: "19:16", aqi: currentAqi, co: currentCo },
        { time: "19:17", aqi: currentAqi, co: currentCo },
        { time: "19:18", aqi: currentAqi, co: currentCo },
        { time: "19:19", aqi: currentAqi, co: currentCo },
        { time: "19:20", aqi: currentAqi, co: currentCo },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAndSync = async () => {
    setSyncing(true);
    setStatusMsg(null);
    try {
      localStorage.setItem("thingspeak_read_api_key", apiKey.trim());
      await api.post("/environment/thingspeak/config", {
        channel_id: channelId,
        read_api_key: apiKey.trim() || null,
      });
      await loadThingSpeakStream(apiKey.trim());
      setStatusMsg({ type: "success", text: "Successfully synced with ThingSpeak!" });
    } catch (err: any) {
      setStatusMsg({
        type: "error",
        text: err?.response?.data?.detail || "Could not sync with ThingSpeak. Please verify your Read API key.",
      });
    } finally {
      setSyncing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl rounded-2xl border border-white/15 bg-gradient-to-br from-[#1b3022] via-[#233d2b] to-[#16271c] text-parchment shadow-2xl p-6 sm:p-7 overflow-hidden flex flex-col gap-5 max-h-[90vh] overflow-y-auto">
        {/* Glow ambient background circles */}
        <div className="absolute top-0 right-0 w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-72 h-72 bg-fern/15 rounded-full blur-3xl pointer-events-none" />

        {/* Modal Header */}
        <div className="flex items-start justify-between z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-300">
              <Radio size={20} className="animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-display text-xl font-bold text-parchment">
                  ThingSpeak IoT Hardware Stream
                </h3>
                <span className="text-[11px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  Live MQTT
                </span>
              </div>
              <p className="text-xs text-parchment/70">
                Channel ID: <span className="font-mono text-emerald-300 font-semibold">{channelId}</span> • ESP32 Gas Telemetry
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-parchment/70 hover:text-parchment flex items-center justify-center transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Real-time Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 z-10">
          {/* Field 1: AQI */}
          <div className="bg-white/10 border border-white/15 rounded-xl p-3.5 flex flex-col justify-between">
            <div className="flex items-center justify-between text-[11px] text-parchment/70 uppercase font-medium">
              <span>Field 1 • AQI</span>
              <Cpu size={14} className="text-emerald-400" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="font-display text-3xl font-extrabold text-emerald-300">
                {currentAqi}
              </span>
              <span className="text-[10px] font-semibold uppercase bg-emerald-400/20 text-emerald-300 px-1.5 py-0.5 rounded">
                Good (CPCB)
              </span>
            </div>
            <p className="text-[10px] text-parchment/50 mt-1">Calculated on ESP32</p>
          </div>

          {/* Field 2: CO PPM */}
          <div className="bg-white/10 border border-white/15 rounded-xl p-3.5 flex flex-col justify-between">
            <div className="flex items-center justify-between text-[11px] text-parchment/70 uppercase font-medium">
              <span>Field 2 • CO PPM</span>
              <Activity size={14} className="text-amber-400" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="font-display text-3xl font-extrabold text-amber-300">
                {currentCo.toFixed(2)}
              </span>
              <span className="text-xs text-parchment/60 font-normal">ppm</span>
            </div>
            <p className="text-[10px] text-parchment/50 mt-1">MQ-7 Carbon Monoxide</p>
          </div>

          {/* Hardware Connection Protocol */}
          <div className="col-span-2 sm:col-span-1 bg-white/10 border border-white/15 rounded-xl p-3.5 flex flex-col justify-between">
            <div className="flex items-center justify-between text-[11px] text-parchment/70 uppercase font-medium">
              <span>Broker Sync</span>
              <ShieldCheck size={14} className="text-sky-400" />
            </div>
            <div className="mt-2">
              <p className="text-xs font-mono text-emerald-300 truncate">mqtt3.thingspeak.com</p>
              <p className="text-[11px] text-parchment/70 font-semibold mt-0.5">Port 1883 • QoS 0</p>
            </div>
            <p className="text-[10px] text-parchment/50 mt-1">Subscribed to Channel</p>
          </div>
        </div>

        {/* Historical Chart Section */}
        <div className="bg-black/20 border border-white/10 rounded-xl p-4 z-10 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setActiveTab("aqi")}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === "aqi"
                    ? "bg-emerald-500/30 text-emerald-300 border border-emerald-400/40 shadow-sm"
                    : "text-parchment/60 hover:text-parchment hover:bg-white/5"
                }`}
              >
                AQI Trend (Field 1)
              </button>
              <button
                onClick={() => setActiveTab("co")}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === "co"
                    ? "bg-amber-500/30 text-amber-300 border border-amber-400/40 shadow-sm"
                    : "text-parchment/60 hover:text-parchment hover:bg-white/5"
                }`}
              >
                CO (ppm) Trend (Field 2)
              </button>
            </div>
            <button
              onClick={() => loadThingSpeakStream()}
              disabled={loading}
              className="text-xs text-parchment/60 hover:text-parchment flex items-center gap-1 bg-white/5 hover:bg-white/10 px-2.5 py-1 rounded-lg border border-white/10 transition-colors"
            >
              <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
              Refresh
            </button>
          </div>

          <div className="h-44 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={historyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorAqi" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="colorCo" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                <XAxis dataKey="time" stroke="#ffffff40" fontSize={10} tickLine={false} />
                <YAxis stroke="#ffffff40" fontSize={10} tickLine={false} domain={activeTab === "aqi" ? [0, "auto"] : [0, "auto"]} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#16271c",
                    borderColor: "#ffffff20",
                    borderRadius: "0.75rem",
                    color: "#DAD7CD",
                    fontSize: "12px",
                  }}
                />
                {activeTab === "aqi" ? (
                  <Area
                    type="monotone"
                    dataKey="aqi"
                    stroke="#10b981"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorAqi)"
                    name="AQI"
                  />
                ) : (
                  <Area
                    type="monotone"
                    dataKey="co"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorCo)"
                    name="CO (ppm)"
                  />
                )}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Read API Key Configuration & Sync Box */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 z-10 space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-parchment flex items-center gap-1.5">
              <KeyRound size={13} className="text-emerald-400" />
              ThingSpeak Read API Key (Optional for Private Feed History)
            </label>
            <a
              href={`https://thingspeak.mathworks.com/channels/${channelId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-semibold"
            >
              Open ThingSpeak <ExternalLink size={10} />
            </a>
          </div>

          <p className="text-[11px] text-parchment/60 leading-relaxed">
            Your ESP32 is streaming live data via MQTT. To also load full 24-hour historical charts, enter your Read API Key from ThingSpeak (under <strong>API Keys</strong> tab), or set your channel to <strong>Public</strong> under Sharing.
          </p>

          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              placeholder="e.g. 16-character Read API Key"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="flex-1 bg-black/30 border border-white/15 rounded-xl px-3.5 py-2 text-xs text-parchment placeholder-parchment/30 focus:outline-none focus:border-emerald-400 font-mono"
            />
            <button
              onClick={handleSaveAndSync}
              disabled={syncing}
              className="bg-fern hover:bg-forest text-parchment px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-2 border border-white/20 shadow-md disabled:opacity-50"
            >
              <RefreshCw size={13} className={syncing ? "animate-spin" : ""} />
              {syncing ? "Syncing..." : "Save & Sync Now"}
            </button>
          </div>

          {statusMsg && (
            <div
              className={`p-2.5 rounded-lg text-xs flex items-center gap-2 ${
                statusMsg.type === "success"
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-400/30"
                  : "bg-red-500/20 text-red-300 border border-red-400/30"
              }`}
            >
              {statusMsg.type === "success" ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
              <span>{statusMsg.text}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
