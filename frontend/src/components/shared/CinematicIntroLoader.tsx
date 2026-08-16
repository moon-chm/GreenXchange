"use client";

import React, { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Wind, ShieldCheck, ArrowRight } from "lucide-react";

interface CinematicIntroLoaderProps {
  onComplete?: () => void;
  autoDismiss?: boolean;
  minDisplayTime?: number;
}

export default function CinematicIntroLoader({
  onComplete,
  autoDismiss = true,
  minDisplayTime = 3800,
}: CinematicIntroLoaderProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const treeSvgRef = useRef<SVGSVGElement>(null);
  const skyBgRef = useRef<HTMLDivElement>(null);
  const sunRaysRef = useRef<HTMLDivElement>(null);

  const [aqiValue, setAqiValue] = useState(382);
  const [phaseText, setPhaseText] = useState("Urban Smog & Particulate Detected");
  const [progress, setProgress] = useState(0);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", handleResize);

    // Particle simulation
    interface Particle {
      x: number;
      y: number;
      vx: number;
      vy: number;
      size: number;
      color: string;
      alpha: number;
      targetAlpha: number;
      isPolluted: boolean;
      glow: boolean;
    }

    const particles: Particle[] = [];
    const PARTICLE_COUNT = 90;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.8,
        vy: (Math.random() - 0.5) * 0.8 - 0.2,
        size: Math.random() * 3.5 + 1.2,
        color: "#6b6355", // initial soot/smog particle
        alpha: Math.random() * 0.6 + 0.2,
        targetAlpha: Math.random() * 0.6 + 0.2,
        isPolluted: true,
        glow: false,
      });
    }

    let progressObj = { val: 0, aqi: 382 };

    // GSAP Master Timeline
    const tl = gsap.timeline({
      onComplete: () => {
        setIsReady(true);
        if (autoDismiss) {
          setTimeout(() => {
            if (onComplete) onComplete();
          }, 800);
        }
      },
    });

    // 1. Animate Progress & AQI countdown
    tl.to(progressObj, {
      val: 100,
      aqi: 18,
      duration: minDisplayTime / 1000,
      ease: "power2.inOut",
      onUpdate: () => {
        setProgress(Math.round(progressObj.val));
        setAqiValue(Math.round(progressObj.aqi));

        if (progressObj.val < 30) {
          setPhaseText("Analyzing Urban Atmosphere & High Smog Index...");
        } else if (progressObj.val < 65) {
          setPhaseText("Sprouting Canopy Network & Root Biomes...");
        } else if (progressObj.val < 90) {
          setPhaseText("Absorbing Carbon & Rejuvenating Air Quality...");
        } else {
          setPhaseText("Pristine Sky & Living Biosphere Online");
        }
      },
    }, 0);

    // 2. Background Sky Color Transition (Polluted Charcoal/Brown -> Radiant Cerulean Blue)
    if (skyBgRef.current) {
      tl.to(
        skyBgRef.current,
        {
          background: "radial-gradient(ellipse at 50% 30%, #38bdf8 0%, #0284c7 45%, #0369a1 85%, #075985 100%)",
          duration: (minDisplayTime / 1000) * 0.85,
          ease: "power3.inOut",
        },
        (minDisplayTime / 1000) * 0.2
      );
    }

    // 3. Sun Rays Piercing & Glow
    if (sunRaysRef.current) {
      tl.to(
        sunRaysRef.current,
        {
          opacity: 0.85,
          scale: 1.15,
          duration: (minDisplayTime / 1000) * 0.7,
          ease: "sine.out",
        },
        (minDisplayTime / 1000) * 0.35
      );
    }

    // 4. Tree SVG Morphing & Branch Expansion
    if (treeSvgRef.current) {
      const trunk = treeSvgRef.current.querySelector("#tree-trunk");
      const roots = treeSvgRef.current.querySelectorAll(".tree-root");
      const branches = treeSvgRef.current.querySelectorAll(".tree-branch");
      const leaves = treeSvgRef.current.querySelectorAll(".tree-leaf");
      const seedLeaf = treeSvgRef.current.querySelector("#seed-leaf");

      // Seed falls and settles
      if (seedLeaf) {
        tl.fromTo(
          seedLeaf,
          { y: -120, opacity: 0, rotation: -45, scale: 0.5 },
          { y: 0, opacity: 1, rotation: 0, scale: 1, duration: 1.0, ease: "bounce.out" },
          0.1
        );
        tl.to(seedLeaf, { scale: 0, opacity: 0, duration: 0.4 }, 1.2);
      }

      // Trunk and roots sprout
      if (roots.length > 0) {
        tl.fromTo(
          roots,
          { strokeDashoffset: 100, opacity: 0 },
          { strokeDashoffset: 0, opacity: 1, stagger: 0.1, duration: 1.0, ease: "power2.out" },
          1.1
        );
      }

      if (trunk) {
        tl.fromTo(
          trunk,
          { scaleY: 0, transformOrigin: "bottom center" },
          { scaleY: 1, duration: 1.4, ease: "elastic.out(1, 0.75)" },
          1.3
        );
      }

      // Branches blossom outwards
      if (branches.length > 0) {
        tl.fromTo(
          branches,
          { scale: 0, transformOrigin: "bottom center", opacity: 0 },
          { scale: 1, opacity: 1, stagger: 0.08, duration: 1.2, ease: "back.out(1.7)" },
          1.6
        );
      }

      // Foliage emerald leaves burst into life
      if (leaves.length > 0) {
        tl.fromTo(
          leaves,
          { scale: 0, opacity: 0, transformOrigin: "center center" },
          { scale: 1, opacity: 1, stagger: { amount: 1.0, from: "center" }, duration: 1.4, ease: "elastic.out(1.2, 0.5)" },
          2.0
        );
      }
    }

    // Particle Animation Loop
    const render = () => {
      ctx.clearRect(0, 0, width, height);

      const isCleanPhase = progressObj.val > 45;

      particles.forEach((p, idx) => {
        p.x += p.vx;
        p.y += p.vy;

        // Wrap particles
        if (p.x < 0) p.x = width;
        if (p.x > width) p.x = 0;
        if (p.y < 0) p.y = height;
        if (p.y > height) p.y = 0;

        // Color transformation from smog to glowing clean bio-particles
        if (isCleanPhase && p.isPolluted) {
          if (Math.random() < 0.05) {
            p.isPolluted = false;
            p.color = idx % 2 === 0 ? "#4ade80" : "#38bdf8"; // emerald & cyan glow
            p.size = Math.random() * 4 + 1.5;
            p.glow = true;
          }
        }

        ctx.save();
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);

        if (p.glow) {
          ctx.shadowBlur = 12;
          ctx.shadowColor = p.color;
        }

        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.alpha;
        ctx.fill();
        ctx.restore();
      });

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animationFrameId);
      tl.kill();
    };
  }, [minDisplayTime, autoDismiss, onComplete]);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-between overflow-hidden select-none font-sans"
    >
      {/* Dynamic Sky Background (Morphs from murky polluted smog to crystal blue sky) */}
      <div
        ref={skyBgRef}
        className="absolute inset-0 transition-colors duration-500 ease-out"
        style={{
          background:
            "radial-gradient(ellipse at 50% 60%, #2a2c27 0%, #1c1f1c 50%, #121412 100%)",
        }}
      />

      {/* Sun Ray Beams (Emerges during purification) */}
      <div
        ref={sunRaysRef}
        className="absolute -top-32 left-1/2 -translate-x-1/2 w-[900px] h-[900px] rounded-full pointer-events-none opacity-0 mix-blend-screen"
        style={{
          background:
            "radial-gradient(circle, rgba(254, 240, 138, 0.45) 0%, rgba(56, 189, 248, 0.25) 45%, transparent 70%)",
          filter: "blur(40px)",
        }}
      />

      {/* Atmospheric Horizon Haze & Soil base */}
      <div className="absolute bottom-0 inset-x-0 h-48 bg-gradient-to-t from-black/60 via-canopy/20 to-transparent pointer-events-none z-0" />

      {/* Particle Canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none z-10" />

      {/* Top Telemetry Header HUD */}
      <header className="relative z-20 w-full max-w-5xl px-6 pt-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-emerald-400 shadow-lg">
            <Wind size={18} className="animate-pulse" />
          </div>
          <div>
            <h1 className="text-white font-display font-bold text-lg tracking-tight flex items-center gap-2">
              GreenXchange
              <span className="text-[10px] uppercase font-mono tracking-widest px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Climate Core
              </span>
            </h1>
            <p className="text-xs text-white/60 font-mono">Atmospheric Biosphere Engine</p>
          </div>
        </div>

        {/* Live AQI Badge (Transitions in real time) */}
        <div
          className={`flex items-center gap-2.5 px-4 py-2 rounded-2xl backdrop-blur-xl border transition-all duration-700 shadow-xl ${
            aqiValue > 150
              ? "bg-rose-950/40 border-rose-500/40 text-rose-300"
              : aqiValue > 50
              ? "bg-amber-950/40 border-amber-500/40 text-amber-300"
              : "bg-emerald-950/40 border-emerald-400/50 text-emerald-200"
          }`}
        >
          <div
            className={`w-2.5 h-2.5 rounded-full animate-ping ${
              aqiValue > 150 ? "bg-rose-400" : aqiValue > 50 ? "bg-amber-400" : "bg-emerald-400"
            }`}
          />
          <div className="text-right">
            <div className="text-[10px] font-mono uppercase tracking-wider text-white/50">Air Quality Index</div>
            <div className="text-sm font-bold font-mono">
              AQI {aqiValue} · {aqiValue > 150 ? "Polluted" : aqiValue > 50 ? "Cleansing" : "Pure Pristine"}
            </div>
          </div>
        </div>
      </header>

      {/* Center Stage: Transforming Seed-to-Tree SVG Animation */}
      <div className="relative z-20 flex-1 flex flex-col items-center justify-center my-auto">
        <svg
          ref={treeSvgRef}
          viewBox="0 0 400 400"
          className="w-[320px] h-[320px] sm:w-[400px] sm:h-[400px] filter drop-shadow-[0_20px_40px_rgba(0,0,0,0.4)]"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Defs for gradients and organic foliage */}
          <defs>
            <linearGradient id="trunkGrad" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor="#27272a" />
              <stop offset="60%" stopColor="#452a18" />
              <stop offset="100%" stopColor="#15803d" />
            </linearGradient>

            <linearGradient id="leafGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#86efac" />
              <stop offset="50%" stopColor="#22c55e" />
              <stop offset="100%" stopColor="#15803d" />
            </linearGradient>

            <linearGradient id="glowLeafGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#fef08a" />
              <stop offset="50%" stopColor="#4ade80" />
              <stop offset="100%" stopColor="#0ea5e9" />
            </linearGradient>

            <filter id="foliageGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Ground Soil Arc */}
          <path
            d="M 60 350 Q 200 330 340 350"
            fill="none"
            stroke="#15803d"
            strokeWidth="3"
            strokeLinecap="round"
            opacity="0.6"
          />

          {/* Seed/Sprout Initial Leaf */}
          <g id="seed-leaf" transform="translate(200, 340)">
            <path
              d="M0 0 C-15 -25 -25 -45 0 -60 C25 -45 15 -25 0 0 Z"
              fill="url(#glowLeafGrad)"
              stroke="#ffffff"
              strokeWidth="1.5"
            />
          </g>

          {/* Root Network */}
          <g className="roots" stroke="#3f2e1f" strokeWidth="2.5" fill="none" strokeLinecap="round">
            <path className="tree-root" d="M 200 345 Q 180 365 150 380" strokeDasharray="100" />
            <path className="tree-root" d="M 200 345 Q 220 370 250 385" strokeDasharray="100" />
            <path className="tree-root" d="M 195 348 Q 170 355 130 365" strokeDasharray="100" />
            <path className="tree-root" d="M 205 348 Q 230 360 270 370" strokeDasharray="100" />
          </g>

          {/* Tree Trunk */}
          <path
            id="tree-trunk"
            d="M 192 345 C 190 280 185 240 196 200 C 205 240 210 280 208 345 Z"
            fill="url(#trunkGrad)"
          />

          {/* Tree Branches */}
          <g className="branches" stroke="url(#trunkGrad)" strokeWidth="5" fill="none" strokeLinecap="round">
            <path className="tree-branch" d="M 196 240 Q 150 200 115 175" />
            <path className="tree-branch" d="M 204 235 Q 250 195 285 170" />
            <path className="tree-branch" d="M 198 200 Q 165 150 140 120" />
            <path className="tree-branch" d="M 202 195 Q 235 145 260 115" />
            <path className="tree-branch" d="M 200 180 Q 200 130 200 95" />
          </g>

          {/* Procedural Canopy Leaves Cluster */}
          <g className="leaves" filter="url(#foliageGlow)">
            {/* Top Canopy */}
            <circle className="tree-leaf" cx="200" cy="85" r="28" fill="url(#glowLeafGrad)" />
            <circle className="tree-leaf" cx="175" cy="95" r="24" fill="url(#leafGrad)" />
            <circle className="tree-leaf" cx="225" cy="95" r="24" fill="url(#leafGrad)" />

            {/* Left Tier */}
            <circle className="tree-leaf" cx="130" cy="125" r="26" fill="url(#glowLeafGrad)" />
            <circle className="tree-leaf" cx="105" cy="165" r="28" fill="url(#leafGrad)" />
            <circle className="tree-leaf" cx="145" cy="170" r="22" fill="url(#leafGrad)" />
            <circle className="tree-leaf" cx="80" cy="180" r="18" fill="url(#glowLeafGrad)" />

            {/* Right Tier */}
            <circle className="tree-leaf" cx="270" cy="120" r="26" fill="url(#glowLeafGrad)" />
            <circle className="tree-leaf" cx="295" cy="160" r="28" fill="url(#leafGrad)" />
            <circle className="tree-leaf" cx="255" cy="165" r="22" fill="url(#leafGrad)" />
            <circle className="tree-leaf" cx="320" cy="175" r="18" fill="url(#glowLeafGrad)" />

            {/* Center Foliage Volume */}
            <circle className="tree-leaf" cx="200" cy="140" r="32" fill="url(#leafGrad)" />
            <circle className="tree-leaf" cx="175" cy="155" r="25" fill="url(#glowLeafGrad)" />
            <circle className="tree-leaf" cx="225" cy="155" r="25" fill="url(#glowLeafGrad)" />
            <circle className="tree-leaf" cx="200" cy="180" r="24" fill="url(#leafGrad)" />
          </g>
        </svg>

        {/* Cinematic Headline Text */}
        <div className="text-center mt-2 px-4 max-w-lg">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            <p className="text-xs font-mono text-emerald-300 tracking-widest uppercase mb-1.5 flex items-center justify-center gap-1.5">
              <Sparkles size={14} className="text-yellow-300 animate-spin" />
              {phaseText}
            </p>
            <h2 className="text-2xl sm:text-3xl font-display font-extrabold text-white tracking-tight leading-tight">
              {progress >= 95 ? "Urban Canopy Restored" : "Transforming Smog into Living Canopy"}
            </h2>
          </motion.div>
        </div>
      </div>

      {/* Bottom Progress & Action HUD */}
      <footer className="relative z-20 w-full max-w-2xl px-6 pb-10 flex flex-col items-center gap-4">
        {/* Progress Bar Container */}
        <div className="w-full bg-white/10 backdrop-blur-md rounded-full h-3 p-0.5 border border-white/20 shadow-inner relative overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-amber-400 via-emerald-400 to-sky-400 shadow-[0_0_15px_rgba(56,189,248,0.8)]"
            style={{ width: `${progress}%` }}
            transition={{ ease: "easeOut" }}
          />
        </div>

        <div className="w-full flex items-center justify-between text-xs font-mono text-white/70">
          <span>Purification Engine</span>
          <span className="text-white font-bold">{progress}% Complete</span>
        </div>

        {/* Enter Dashboard / Skip Button */}
        <div className="flex items-center gap-3 mt-1">
          {onComplete && (
            <button
              onClick={onComplete}
              className="px-6 py-2.5 rounded-2xl bg-white/20 hover:bg-white/30 text-white font-semibold text-xs backdrop-blur-xl border border-white/30 transition-all hover:scale-105 active:scale-95 flex items-center gap-2 shadow-2xl"
            >
              <span>{isReady ? "Enter GreenXchange" : "Skip Intro"}</span>
              <ArrowRight size={14} />
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}
