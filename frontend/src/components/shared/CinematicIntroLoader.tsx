"use client";

import React, { useEffect, useRef } from "react";
import gsap from "gsap";

interface CinematicIntroLoaderProps {
  onComplete?: () => void;
  autoDismiss?: boolean;
  minDisplayTime?: number;
}

export default function CinematicIntroLoader({
  onComplete,
  autoDismiss = true,
  minDisplayTime = 4000,
}: CinematicIntroLoaderProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const skyBgRef = useRef<HTMLDivElement>(null);
  const sunGlowRef = useRef<HTMLDivElement>(null);
  const sunBeamsRef = useRef<HTMLDivElement>(null);
  const treeSvgRef = useRef<SVGSVGElement>(null);

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

    // Particle dynamics: soot smog -> glowing bio-luminescent oxygen spores
    interface Particle {
      x: number;
      y: number;
      vx: number;
      vy: number;
      size: number;
      baseSize: number;
      alpha: number;
      color: string;
      isCleansed: boolean;
      swayOffset: number;
      swaySpeed: number;
    }

    const particles: Particle[] = [];
    const PARTICLE_COUNT = 110;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.6,
        vy: -Math.random() * 0.6 - 0.2,
        size: Math.random() * 2.8 + 1.0,
        baseSize: Math.random() * 2.8 + 1.0,
        alpha: Math.random() * 0.5 + 0.2,
        color: "#57534e", // smog ash
        isCleansed: false,
        swayOffset: Math.random() * Math.PI * 2,
        swaySpeed: Math.random() * 0.03 + 0.01,
      });
    }

    let progressObj = { val: 0 };

    // Master Timeline
    const tl = gsap.timeline({
      onComplete: () => {
        if (autoDismiss) {
          gsap.to(containerRef.current, {
            opacity: 0,
            scale: 1.03,
            duration: 0.9,
            ease: "power2.inOut",
            onComplete: () => {
              if (onComplete) onComplete();
            },
          });
        }
      },
    });

    // 1. Progress driver
    tl.to(
      progressObj,
      {
        val: 100,
        duration: minDisplayTime / 1000,
        ease: "power2.inOut",
      },
      0
    );

    // 2. Sky background transition (Murky industrial soot -> Radiant crystalline cerulean blue dawn)
    if (skyBgRef.current) {
      tl.to(
        skyBgRef.current,
        {
          background: "radial-gradient(ellipse at 50% 35%, #7dd3fc 0%, #38bdf8 30%, #0284c7 65%, #0369a1 90%, #075985 100%)",
          duration: (minDisplayTime / 1000) * 0.8,
          ease: "power2.inOut",
        },
        (minDisplayTime / 1000) * 0.15
      );
    }

    // 3. Volumetric Sun Glow and Radiant God Rays
    if (sunGlowRef.current) {
      tl.to(
        sunGlowRef.current,
        {
          opacity: 0.95,
          scale: 1.25,
          duration: (minDisplayTime / 1000) * 0.7,
          ease: "power2.out",
        },
        (minDisplayTime / 1000) * 0.3
      );
    }

    if (sunBeamsRef.current) {
      tl.to(
        sunBeamsRef.current,
        {
          opacity: 0.7,
          rotation: 25,
          duration: (minDisplayTime / 1000) * 0.8,
          ease: "sine.out",
        },
        (minDisplayTime / 1000) * 0.35
      );
    }

    // 4. Tree SVG Natural Growth
    if (treeSvgRef.current) {
      const seed = treeSvgRef.current.querySelector("#seed-sprout");
      const roots = treeSvgRef.current.querySelectorAll(".root-path");
      const trunk = treeSvgRef.current.querySelector("#main-trunk");
      const primaryBranches = treeSvgRef.current.querySelectorAll(".branch-primary");
      const secondaryBranches = treeSvgRef.current.querySelectorAll(".branch-secondary");
      const leavesBg = treeSvgRef.current.querySelectorAll(".leaf-bg");
      const leavesMg = treeSvgRef.current.querySelectorAll(".leaf-mg");
      const leavesFg = treeSvgRef.current.querySelectorAll(".leaf-fg");

      // Seed descends with fluttering rotation
      if (seed) {
        tl.fromTo(
          seed,
          { y: -180, x: -30, rotation: -60, opacity: 0, scale: 0.6 },
          { y: 0, x: 0, rotation: 0, opacity: 1, scale: 1, duration: 1.1, ease: "bounce.out" },
          0.05
        );
        tl.to(seed, { scale: 0, opacity: 0, duration: 0.35 }, 1.1);
      }

      // Taproots branch into the earth
      if (roots.length > 0) {
        tl.fromTo(
          roots,
          { strokeDashoffset: 120, opacity: 0 },
          { strokeDashoffset: 0, opacity: 0.9, stagger: 0.08, duration: 1.1, ease: "power2.out" },
          1.0
        );
      }

      // Majestic trunk expands upward
      if (trunk) {
        tl.fromTo(
          trunk,
          { scaleY: 0, transformOrigin: "bottom center", opacity: 0 },
          { scaleY: 1, opacity: 1, duration: 1.4, ease: "power3.out" },
          1.15
        );
      }

      // Branches emerge
      if (primaryBranches.length > 0) {
        tl.fromTo(
          primaryBranches,
          { scale: 0, transformOrigin: "bottom center", opacity: 0 },
          { scale: 1, opacity: 1, stagger: 0.06, duration: 1.2, ease: "back.out(1.4)" },
          1.4
        );
      }

      if (secondaryBranches.length > 0) {
        tl.fromTo(
          secondaryBranches,
          { scale: 0, transformOrigin: "bottom center", opacity: 0 },
          { scale: 1, opacity: 1, stagger: 0.04, duration: 1.0, ease: "back.out(1.2)" },
          1.7
        );
      }

      // Foliage Bloom (Back -> Mid -> Front layered for realistic depth)
      if (leavesBg.length > 0) {
        tl.fromTo(
          leavesBg,
          { scale: 0, opacity: 0, transformOrigin: "center center" },
          { scale: 1, opacity: 0.85, stagger: { amount: 0.8, from: "center" }, duration: 1.1, ease: "elastic.out(1, 0.6)" },
          1.9
        );
      }

      if (leavesMg.length > 0) {
        tl.fromTo(
          leavesMg,
          { scale: 0, opacity: 0, transformOrigin: "center center" },
          { scale: 1, opacity: 0.95, stagger: { amount: 0.9, from: "center" }, duration: 1.2, ease: "elastic.out(1.1, 0.5)" },
          2.1
        );
      }

      if (leavesFg.length > 0) {
        tl.fromTo(
          leavesFg,
          { scale: 0, opacity: 0, transformOrigin: "center center" },
          { scale: 1, opacity: 1, stagger: { amount: 0.9, from: "center" }, duration: 1.3, ease: "elastic.out(1.2, 0.4)" },
          2.3
        );
      }
    }

    // Continuous Canvas Particle & Bio-Atmosphere Render Loop
    let time = 0;
    const render = () => {
      time += 0.02;
      ctx.clearRect(0, 0, width, height);

      const isClean = progressObj.val > 40;

      particles.forEach((p, idx) => {
        p.swayOffset += p.swaySpeed;
        p.x += p.vx + Math.sin(p.swayOffset) * 0.4;
        p.y += p.vy;

        if (p.x < 0) p.x = width;
        if (p.x > width) p.x = 0;
        if (p.y < 0) p.y = height;
        if (p.y > height) p.y = 0;

        // Particle metamorphosis
        if (isClean && !p.isCleansed) {
          if (Math.random() < 0.08) {
            p.isCleansed = true;
            p.color = idx % 3 === 0 ? "#86efac" : idx % 3 === 1 ? "#38bdf8" : "#fef08a";
            p.size = p.baseSize * 1.4;
            p.vy = -Math.random() * 0.9 - 0.4; // float upward smoothly
          }
        }

        ctx.save();
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);

        if (p.isCleansed) {
          ctx.shadowBlur = 10;
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
      className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden select-none pointer-events-none"
    >
      {/* Dynamic Sky Atmosphere (Murky Smog -> Crystalline Blue Sky) */}
      <div
        ref={skyBgRef}
        className="absolute inset-0 transition-all duration-700 ease-out"
        style={{
          background:
            "radial-gradient(ellipse at 50% 55%, #26241e 0%, #171816 45%, #0d0e0d 100%)",
        }}
      />

      {/* Radiant Sun Glow behind Tree */}
      <div
        ref={sunGlowRef}
        className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full opacity-0 pointer-events-none mix-blend-screen"
        style={{
          background:
            "radial-gradient(circle, rgba(254, 240, 138, 0.7) 0%, rgba(56, 189, 248, 0.35) 45%, transparent 70%)",
          filter: "blur(45px)",
        }}
      />

      {/* Volumetric Rotating Sunbeam Rays */}
      <div
        ref={sunBeamsRef}
        className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1100px] h-[1100px] opacity-0 pointer-events-none mix-blend-screen"
        style={{
          background:
            "conic-gradient(from 0deg at 50% 50%, rgba(254,240,138,0.25) 0deg, transparent 25deg, rgba(56,189,248,0.2) 45deg, transparent 70deg, rgba(254,240,138,0.25) 90deg, transparent 115deg, rgba(56,189,248,0.2) 140deg, transparent 170deg, rgba(254,240,138,0.25) 200deg, transparent 230deg, rgba(56,189,248,0.2) 260deg, transparent 290deg, rgba(254,240,138,0.25) 320deg, transparent 345deg, rgba(254,240,138,0.25) 360deg)",
          filter: "blur(30px)",
        }}
      />

      {/* Ambient Bio-Particles & Smog Canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none z-10" />

      {/* Soil Horizon & Gentle Grass Gradient */}
      <div className="absolute bottom-0 inset-x-0 h-44 bg-gradient-to-t from-[#0a0f0a]/90 via-[#142318]/40 to-transparent pointer-events-none z-10" />

      {/* Center Stage: Organic Tree SVG Metamorphosis */}
      <div className="relative z-20 w-full max-w-2xl flex items-center justify-center p-4">
        <svg
          ref={treeSvgRef}
          viewBox="0 0 500 500"
          className="w-[340px] h-[340px] sm:w-[460px] sm:h-[460px] filter drop-shadow-[0_25px_50px_rgba(0,0,0,0.45)]"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            {/* Organic Bark Gradient */}
            <linearGradient id="barkGrad" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor="#1c1917" />
              <stop offset="40%" stopColor="#292524" />
              <stop offset="70%" stopColor="#44403c" />
              <stop offset="100%" stopColor="#15803d" />
            </linearGradient>

            {/* Branch Gradient */}
            <linearGradient id="branchGrad" x1="0" y1="1" x2="0.5" y2="0">
              <stop offset="0%" stopColor="#292524" />
              <stop offset="60%" stopColor="#44403c" />
              <stop offset="100%" stopColor="#166534" />
            </linearGradient>

            {/* Layered Foliage Gradients */}
            <linearGradient id="leafBgGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#14532d" />
              <stop offset="100%" stopColor="#052e16" />
            </linearGradient>

            <linearGradient id="leafMgGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#22c55e" />
              <stop offset="100%" stopColor="#15803d" />
            </linearGradient>

            <linearGradient id="leafFgGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#86efac" />
              <stop offset="50%" stopColor="#4ade80" />
              <stop offset="100%" stopColor="#16a34a" />
            </linearGradient>

            <linearGradient id="goldenHighlightGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#fef08a" />
              <stop offset="40%" stopColor="#86efac" />
              <stop offset="100%" stopColor="#22c55e" />
            </linearGradient>

            {/* Organic Soft Foliage Glow */}
            <filter id="softGlow" x="-25%" y="-25%" width="150%" height="150%">
              <feGaussianBlur stdDeviation="3.5" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Initial Golden Fluttering Sprout / Seed */}
          <g id="seed-sprout" transform="translate(250, 425)">
            <path
              d="M0 0 C-18 -28 -30 -50 0 -68 C30 -50 18 -28 0 0 Z"
              fill="url(#goldenHighlightGrad)"
              stroke="#ffffff"
              strokeWidth="1.5"
            />
            <path d="M0 0 L0 -55" stroke="#15803d" strokeWidth="1.2" strokeLinecap="round" />
          </g>

          {/* Root Network with Natural Curvature */}
          <g className="roots" stroke="#292524" strokeWidth="2.8" fill="none" strokeLinecap="round">
            <path className="root-path" d="M 250 435 Q 220 460 170 480 Q 140 490 105 492" strokeDasharray="120" />
            <path className="root-path" d="M 250 435 Q 280 465 330 482 Q 365 490 400 493" strokeDasharray="120" />
            <path className="root-path" d="M 242 438 Q 210 450 150 462" strokeDasharray="120" />
            <path className="root-path" d="M 258 438 Q 295 452 355 464" strokeDasharray="120" />
            <path className="root-path" d="M 250 440 Q 250 470 245 495" strokeDasharray="120" />
          </g>

          {/* Tapered Trunk Structure */}
          <path
            id="main-trunk"
            d="M 238 435 C 235 340 228 280 244 220 C 255 220 265 280 262 340 C 265 385 264 435 262 435 Z"
            fill="url(#barkGrad)"
          />

          {/* Primary Boughs & Limbs */}
          <g className="primary-boughs" stroke="url(#branchGrad)" strokeWidth="6.5" fill="none" strokeLinecap="round">
            <path className="branch-primary" d="M 244 260 Q 185 210 135 180" />
            <path className="branch-primary" d="M 256 250 Q 315 200 365 175" />
            <path className="branch-primary" d="M 246 215 Q 195 150 160 115" />
            <path className="branch-primary" d="M 254 210 Q 305 145 340 110" />
            <path className="branch-primary" d="M 250 190 Q 250 130 250 85" />
          </g>

          {/* Secondary Sub-Branches */}
          <g className="secondary-boughs" stroke="url(#branchGrad)" strokeWidth="3.5" fill="none" strokeLinecap="round">
            <path className="branch-secondary" d="M 160 195 Q 120 160 90 145" />
            <path className="branch-secondary" d="M 340 190 Q 380 155 410 140" />
            <path className="branch-secondary" d="M 180 135 Q 140 100 120 75" />
            <path className="branch-secondary" d="M 320 130 Q 360 95 380 70" />
            <path className="branch-secondary" d="M 250 140 Q 215 95 195 70" />
            <path className="branch-secondary" d="M 250 140 Q 285 95 305 70" />
          </g>

          {/* Multi-Layered Photorealistic Foliage Clusters */}
          {/* Layer 1: Dark Forest Background Depth */}
          <g className="foliage-bg" filter="url(#softGlow)">
            <circle className="leaf-bg" cx="250" cy="75" r="35" fill="url(#leafBgGrad)" />
            <circle className="leaf-bg" cx="215" cy="90" r="30" fill="url(#leafBgGrad)" />
            <circle className="leaf-bg" cx="285" cy="90" r="30" fill="url(#leafBgGrad)" />
            <circle className="leaf-bg" cx="155" cy="130" r="32" fill="url(#leafBgGrad)" />
            <circle className="leaf-bg" cx="115" cy="165" r="34" fill="url(#leafBgGrad)" />
            <circle className="leaf-bg" cx="345" cy="125" r="32" fill="url(#leafBgGrad)" />
            <circle className="leaf-bg" cx="385" cy="160" r="34" fill="url(#leafBgGrad)" />
            <circle className="leaf-bg" cx="250" cy="155" r="38" fill="url(#leafBgGrad)" />
          </g>

          {/* Layer 2: Midground Emerald Volume */}
          <g className="foliage-mg" filter="url(#softGlow)">
            <circle className="leaf-mg" cx="250" cy="80" r="28" fill="url(#leafMgGrad)" />
            <circle className="leaf-mg" cx="185" cy="105" r="26" fill="url(#leafMgGrad)" />
            <circle className="leaf-mg" cx="315" cy="100" r="26" fill="url(#leafMgGrad)" />
            <circle className="leaf-mg" cx="130" cy="145" r="28" fill="url(#leafMgGrad)" />
            <circle className="leaf-mg" cx="370" cy="140" r="28" fill="url(#leafMgGrad)" />
            <circle className="leaf-mg" cx="210" cy="150" r="30" fill="url(#leafMgGrad)" />
            <circle className="leaf-mg" cx="290" cy="145" r="30" fill="url(#leafMgGrad)" />
            <circle className="leaf-mg" cx="250" cy="180" r="26" fill="url(#leafMgGrad)" />
          </g>

          {/* Layer 3: Sunlit Specular Foreground Leaves */}
          <g className="foliage-fg" filter="url(#softGlow)">
            <circle className="leaf-fg" cx="250" cy="65" r="20" fill="url(#goldenHighlightGrad)" />
            <circle className="leaf-fg" cx="220" cy="75" r="18" fill="url(#leafFgGrad)" />
            <circle className="leaf-fg" cx="280" cy="70" r="18" fill="url(#goldenHighlightGrad)" />
            <circle className="leaf-fg" cx="165" cy="115" r="20" fill="url(#leafFgGrad)" />
            <circle className="leaf-fg" cx="335" cy="110" r="20" fill="url(#goldenHighlightGrad)" />
            <circle className="leaf-fg" cx="100" cy="155" r="22" fill="url(#goldenHighlightGrad)" />
            <circle className="leaf-fg" cx="400" cy="150" r="22" fill="url(#leafFgGrad)" />
            <circle className="leaf-fg" cx="250" cy="130" r="24" fill="url(#goldenHighlightGrad)" />
            <circle className="leaf-fg" cx="180" cy="175" r="18" fill="url(#leafFgGrad)" />
            <circle className="leaf-fg" cx="320" cy="170" r="18" fill="url(#goldenHighlightGrad)" />
          </g>
        </svg>
      </div>
    </div>
  );
}
