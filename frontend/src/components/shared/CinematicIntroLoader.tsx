"use client";

/**
 * CinematicIntroLoader — Center-to-Edge Full Screen Botanical Bloom
 * -----------------------------------------------------------------
 * Starts filling from the exact center of the screen, expands outward in
 * lush radial waves of botanical leaves until 100% of the screen is covered,
 * then smoothly fades out and opens the login page without delay.
 */

import React, { useEffect, useMemo, useRef } from "react";
import gsap from "gsap";

interface CinematicIntroLoaderProps {
  onComplete?: () => void;
  autoDismiss?: boolean;
  minDisplayTime?: number;
}

function mulberry32(seed: number) {
  let s = seed | 0;
  return function () {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Tone = "green" | "brightGreen" | "emerald" | "gold" | "shadow";

interface RadialLeaf {
  id: string;
  x: number;
  y: number;
  rot: number;
  scale: number;
  tone: Tone;
  variant: "A" | "B";
  distFromCenter: number;
}

const TONE_FILL: Record<Tone, string> = {
  green: "#588147",
  brightGreen: "#7eb653",
  emerald: "#3d6e3c",
  gold: "#c99a3b",
  shadow: "#2a3b25",
};

const VIEW_W = 1440;
const VIEW_H = 900;
const CX = VIEW_W / 2;
const CY = VIEW_H / 2;

export default function CinematicIntroLoader({
  onComplete,
  autoDismiss = true,
  minDisplayTime = 2600,
}: CinematicIntroLoaderProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  // Generate dense grid of leaves radiating outward from center to cover 100% screen
  const leaves = useMemo(() => {
    const rand = mulberry32(421987);
    const list: RadialLeaf[] = [];

    // 1. Core central burst (Dense cluster at center)
    for (let i = 0; i < 45; i++) {
      const angle = rand() * Math.PI * 2;
      const r = rand() * 120;
      const x = CX + Math.cos(angle) * r;
      const y = CY + Math.sin(angle) * r * 0.9;
      const dist = Math.hypot(x - CX, y - CY);
      const toneRoll = rand();
      list.push({
        id: `c-${i}`,
        x,
        y,
        rot: rand() * 360,
        scale: 1.1 + rand() * 0.9,
        tone: toneRoll < 0.35 ? "brightGreen" : toneRoll < 0.7 ? "green" : "gold",
        variant: rand() < 0.5 ? "A" : "B",
        distFromCenter: dist,
      });
    }

    // 2. Concentric expanding rings to cover the entire 1440x900 viewport
    const RINGS = [
      { rMin: 100, rMax: 260, count: 85, scaleBase: 1.2 },
      { rMin: 240, rMax: 460, count: 140, scaleBase: 1.35 },
      { rMin: 420, rMax: 680, count: 210, scaleBase: 1.5 },
      { rMin: 640, rMax: 920, count: 280, scaleBase: 1.7 },
      { rMin: 880, rMax: 1100, count: 220, scaleBase: 1.9 }, // Overfill outer corners
    ];

    RINGS.forEach((ring, ri) => {
      for (let i = 0; i < ring.count; i++) {
        const angle = rand() * Math.PI * 2;
        // Aspect ratio compensation so it expands elliptically to fill wide screens
        const r = ring.rMin + rand() * (ring.rMax - ring.rMin);
        const x = CX + Math.cos(angle) * r * 1.08;
        const y = CY + Math.sin(angle) * r * 0.88;
        const dist = Math.hypot(x - CX, y - CY);
        const toneRoll = rand();
        const tone: Tone =
          toneRoll < 0.38
            ? "green"
            : toneRoll < 0.65
            ? "brightGreen"
            : toneRoll < 0.82
            ? "emerald"
            : toneRoll < 0.92
            ? "gold"
            : "shadow";

        list.push({
          id: `r-${ri}-${i}`,
          x,
          y,
          rot: rand() * 360,
          scale: ring.scaleBase + rand() * 0.8,
          tone,
          variant: rand() < 0.55 ? "A" : "B",
          distFromCenter: dist,
        });
      }
    });

    // Sort strictly by distance from center so animation flows outward concentrically
    return list.sort((a, b) => a.distFromCenter - b.distFromCenter);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    const svg = svgRef.current;
    if (!container || !svg) return;

    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    const leafNodes = Array.from(svg.querySelectorAll<SVGGElement>(".leaf-item"));

    // Initially hide all leaves at scale 0
    gsap.set(leafNodes, { scale: 0, opacity: 0, transformOrigin: "center" });

    if (reduceMotion) {
      gsap.set(leafNodes, { scale: 1, opacity: 1 });
      const t = setTimeout(() => {
        if (autoDismiss) {
          gsap.to(container, {
            opacity: 0,
            duration: 0.3,
            onComplete: () => onCompleteRef.current?.(),
          });
        }
      }, 500);
      return () => clearTimeout(t);
    }

    const maxDist = leaves[leaves.length - 1]?.distFromCenter || 1000;
    const duration = Math.max(2.0, minDisplayTime / 1000);
    const growthDuration = duration * 0.78;

    const tl = gsap.timeline({
      onComplete: () => {
        if (autoDismiss) {
          // Smooth fade out directly into login page without delay
          gsap.to(container, {
            opacity: 0,
            scale: 1.04,
            duration: 0.45,
            ease: "power2.inOut",
            onComplete: () => {
              if (onCompleteRef.current) {
                onCompleteRef.current();
              }
            },
          });
        }
      },
    });

    // Animate leaves bursting outward from center to cover whole screen
    leafNodes.forEach((node, idx) => {
      const leafData = leaves[idx];
      const normalizedDist = (leafData?.distFromCenter || 0) / maxDist; // 0 (center) -> 1 (edge)
      const startTime = normalizedDist * growthDuration;

      tl.to(
        node,
        {
          scale: 1,
          opacity: 1,
          rotation: `+=${((idx * 37) % 24) - 12}`,
          duration: 0.38,
          ease: "back.out(1.5)",
        },
        startTime
      );
    });

    return () => {
      tl.kill();
    };
  }, [minDisplayTime, autoDismiss, leaves]);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden select-none bg-[#e8dec4]"
    >
      {/* Aged paper background */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 50% 50%, #f3ebda 0%, #e8dec4 55%, #d5c5a2 100%)",
        }}
      />

      {/* Full-screen botanical leaves container */}
      <div className="absolute inset-0 w-full h-full pointer-events-none flex items-center justify-center">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          preserveAspectRatio="xMidYMid slice"
          className="w-full h-full object-cover filter drop-shadow-[0_12px_24px_rgba(20,28,18,0.22)]"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <symbol id="leafA" viewBox="-12 -30 24 36">
              <path d="M0,3 C-9,-5 -9,-22 0,-30 C9,-22 9,-5 0,3 Z" />
              <path d="M0,1 L0,-26" stroke="#00000030" strokeWidth="0.7" fill="none" />
              <path
                d="M0,-7 L-5,-13 M0,-13 L5,-19 M0,-19 L-4,-24"
                stroke="#00000020"
                strokeWidth="0.5"
                fill="none"
              />
            </symbol>
            <symbol id="leafB" viewBox="-14 -28 28 34">
              <path d="M0,4 C-11,-2 -11,-18 0,-27 C11,-18 11,-2 0,4 Z" />
              <path d="M0,2 L0,-23" stroke="#0000002c" strokeWidth="0.7" fill="none" />
              <path
                d="M0,-6 L-6,-11 M0,-12 L6,-17"
                stroke="#0000001e"
                strokeWidth="0.5"
                fill="none"
              />
            </symbol>
          </defs>

          {/* Densely packed leaves filling screen from center outwards */}
          {leaves.map((leaf) => (
            <g
              key={leaf.id}
              className="leaf-item"
              transform={`translate(${leaf.x.toFixed(1)} ${leaf.y.toFixed(1)}) rotate(${leaf.rot.toFixed(0)})`}
            >
              <g transform={`scale(${leaf.scale.toFixed(2)})`}>
                <use href={`#leaf${leaf.variant}`} fill={TONE_FILL[leaf.tone]} />
              </g>
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}