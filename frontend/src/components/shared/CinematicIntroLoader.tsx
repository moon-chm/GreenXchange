"use client";

/**
 * CinematicIntroLoader — "Field Notes" Full-Screen Botanical Metamorphosis
 * -----------------------------------------------------------------------
 * The procedural fractal tree is projected across the entire viewport using
 * `preserveAspectRatio="xMidYMax slice"` (anchored at bottom-center like
 * background-size: cover).
 *
 * Sequence:
 * 1. Roots shoot deep into the ground.
 * 2. Majestic trunk and branches draw outward depth-by-depth across the screen.
 * 3. Hundreds of botanical leaves with hand-drawn vein structures unfurl in organic waves.
 * 4. Warm golden bloom settles in, then smoothly fades out directly to the login page.
 */

import React, { useEffect, useMemo, useRef } from "react";
import gsap from "gsap";

interface CinematicIntroLoaderProps {
  onComplete?: () => void;
  autoDismiss?: boolean;
  minDisplayTime?: number;
  title?: string;
}

/* ---------------------------------------------------------------------- */
/* Deterministic PRNG for SSR and hydration consistency                   */
/* ---------------------------------------------------------------------- */
function mulberry32(seed: number) {
  let s = seed | 0;
  return function () {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------------------------------------------------------------------- */
/* Fractal branch recursive engine                                        */
/* ---------------------------------------------------------------------- */
interface Segment {
  d: string;
  depth: number;
  width: number;
}
interface Anchor {
  x: number;
  y: number;
}

function growBranches(opts: {
  x: number;
  y: number;
  angle: number; // degrees, -90 = straight up
  length: number;
  depth: number;
  width: number;
  maxDepth: number;
  rand: () => number;
  segments: Segment[];
  tips: Anchor[];
  midAnchors: Anchor[];
  minLength: number;
  maxSegments: number;
}) {
  const {
    x,
    y,
    angle,
    length,
    depth,
    width,
    maxDepth,
    rand,
    segments,
    tips,
    midAnchors,
    minLength,
    maxSegments,
  } = opts;

  if (segments.length > maxSegments || length < minLength) {
    tips.push({ x, y });
    return;
  }

  const rad = (angle * Math.PI) / 180;
  const x2 = x + Math.cos(rad) * length;
  const y2 = y + Math.sin(rad) * length;

  const bow = (rand() - 0.5) * length * 0.22;
  const cx = (x + x2) / 2 + Math.cos(rad + Math.PI / 2) * bow;
  const cy = (y + y2) / 2 + Math.sin(rad + Math.PI / 2) * bow;

  segments.push({
    d: `M${x.toFixed(1)},${y.toFixed(1)} Q${cx.toFixed(1)},${cy.toFixed(1)} ${x2.toFixed(1)},${y2.toFixed(1)}`,
    depth,
    width,
  });

  if (depth >= Math.floor(maxDepth * 0.4) && rand() < 0.45) {
    midAnchors.push({ x: x2, y: y2 });
  }

  if (depth >= maxDepth) {
    tips.push({ x: x2, y: y2 });
    return;
  }

  const children = depth < 2 ? 2 : rand() < 0.6 ? 2 : 3;
  for (let i = 0; i < children; i++) {
    const dir = i - (children - 1) / 2;
    const spread = 18 + rand() * 22;
    const childAngle = angle + dir * spread + (rand() - 0.5) * 10;
    const childLength = length * (0.66 + rand() * 0.16);
    const childWidth = Math.max(0.6, width * 0.66);
    growBranches({
      ...opts,
      x: x2,
      y: y2,
      angle: childAngle,
      length: childLength,
      depth: depth + 1,
      width: childWidth,
    });
  }
}

function barkTone(depth: number, isRoot: boolean) {
  if (isRoot) return "#2f2a24";
  const tones = ["#241f1a", "#332b23", "#443a2f", "#564a3b", "#6b5c48", "#7d6c54", "#8f7d63"];
  return tones[Math.min(depth, tones.length - 1)];
}

type Tone = "green" | "brightGreen" | "emerald" | "gold" | "shadow";
interface LeafDatum {
  id: string;
  x: number;
  y: number;
  rot: number;
  scale: number;
  tone: Tone;
  variant: "A" | "B";
  clusterId: number;
}

const TONE_FILL: Record<Tone, string> = {
  green: "#5a8247",
  brightGreen: "#82b258",
  emerald: "#3d6e3c",
  gold: "#c99a3b",
  shadow: "#2b3b27",
};

const VIEW_W = 1000;
const VIEW_H = 1000;
const GROUND_Y = 920;
const TRUNK_X = 500;

export default function CinematicIntroLoader({
  onComplete,
  autoDismiss = true,
  minDisplayTime = 2600,
  title = "Rooted",
}: CinematicIntroLoaderProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const bloomRef = useRef<HTMLDivElement>(null);
  const captionRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<SVGGElement>(null);

  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  /* ---- Grow the tree canopy + roots once deterministically ---- */
  const CANOPY_MAX_DEPTH = 6;
  const { branchSegments, rootSegments, leaves, anchorPoints } = useMemo(() => {
    const rand = mulberry32(20260817);

    const canopySegments: Segment[] = [];
    const tips: Anchor[] = [];
    const midAnchors: Anchor[] = [];
    growBranches({
      x: TRUNK_X,
      y: GROUND_Y - 10,
      angle: -90,
      length: 270,
      depth: 0,
      width: 14,
      maxDepth: CANOPY_MAX_DEPTH,
      rand,
      segments: canopySegments,
      tips,
      midAnchors,
      minLength: 12,
      maxSegments: 260,
    });

    const rootSegs: Segment[] = [];
    const rootTips: Anchor[] = [];
    const rootMid: Anchor[] = [];
    const rootRand = mulberry32(864197253);
    growBranches({
      x: TRUNK_X,
      y: GROUND_Y + 4,
      angle: 90,
      length: 80,
      depth: 0,
      width: 7,
      maxDepth: 3,
      rand: rootRand,
      segments: rootSegs,
      tips: rootTips,
      midAnchors: rootMid,
      minLength: 14,
      maxSegments: 50,
    });

    const rawAnchors: Array<{ a: Anchor; count: number }> = [
      ...tips.map((a) => ({ a, count: 4 })),
      ...midAnchors.map((a) => ({ a, count: 3 })),
    ];

    const leafList: LeafDatum[] = [];
    const anchorPts: Anchor[] = [];
    rawAnchors.forEach(({ a, count }, ai) => {
      anchorPts.push(a);
      for (let i = 0; i < count; i++) {
        const ang = rand() * Math.PI * 2;
        const r = 6 + rand() * 26;
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
        leafList.push({
          id: `${ai}-${i}`,
          x: a.x + Math.cos(ang) * r,
          y: a.y + Math.sin(ang) * r * 0.85,
          rot: rand() * 360,
          scale: 0.9 + rand() * 0.75,
          tone,
          variant: rand() < 0.55 ? "A" : "B",
          clusterId: ai,
        });
      }
    });

    return {
      branchSegments: canopySegments,
      rootSegments: rootSegs,
      leaves: leafList.slice(0, 520),
      anchorPoints: anchorPts,
    };
  }, []);

  const clusters = useMemo(() => {
    const map = new Map<number, LeafDatum[]>();
    leaves.forEach((l) => {
      if (!map.has(l.clusterId)) map.set(l.clusterId, []);
      map.get(l.clusterId)!.push(l);
    });
    return Array.from(map.entries()).map(([id, items]) => {
      const anchor = anchorPoints[id] ?? { x: items[0]?.x ?? 0, y: items[0]?.y ?? 0 };
      return { id, x: anchor.x, y: anchor.y, items };
    });
  }, [leaves, anchorPoints]);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    const svg = svgRef.current;
    if (!container || !canvas || !svg) return;

    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    const ctx = canvas.getContext("2d");
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    let width = window.innerWidth;
    let height = window.innerHeight;

    const sizeCanvas = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    sizeCanvas();

    const handleResize = () => {
      sizeCanvas();
      motes.forEach((m) => {
        m.x = Math.min(m.x, width);
        m.y = Math.min(m.y, height);
      });
    };
    window.addEventListener("resize", handleResize);

    /* ---------------- Fine ink dust motes ---------------- */
    interface Mote {
      x: number;
      y: number;
      vx: number;
      vy: number;
      size: number;
      alpha: number;
      settled: boolean;
      flicker: number;
    }
    const MOTE_COUNT = 65;
    const motes: Mote[] = Array.from({ length: MOTE_COUNT }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.22,
      vy: Math.random() * 0.15 + 0.04,
      size: Math.random() * 1.4 + 0.5,
      alpha: Math.random() * 0.32 + 0.12,
      settled: false,
      flicker: Math.random() * Math.PI * 2,
    }));

    const progressRef = { current: 0 };
    let raf = 0;
    const render = () => {
      if (ctx) {
        ctx.clearRect(0, 0, width, height);
        const bloomAmt = progressRef.current;
        motes.forEach((m) => {
          m.flicker += 0.03;
          if (!m.settled && bloomAmt > 0.7 && Math.random() < 0.02) {
            m.settled = true;
            m.vy = -(Math.random() * 0.2 + 0.05);
            m.vx = (Math.random() - 0.5) * 0.16;
          }
          m.x += m.vx;
          m.y += m.vy;
          if (m.x < -4) m.x = width + 4;
          if (m.x > width + 4) m.x = -4;
          if (m.y < -4) m.y = height + 4;
          if (m.y > height + 4) m.y = -4;
          ctx.globalAlpha = m.alpha * (0.6 + 0.4 * Math.sin(m.flicker));
          ctx.fillStyle = m.settled ? "#c99a3b" : "#3a332c";
          ctx.fillRect(m.x, m.y, m.size, m.size);
        });
        ctx.globalAlpha = 1;
      }
      raf = requestAnimationFrame(render);
    };
    render();

    const leafGroups = Array.from(svg.querySelectorAll<SVGGElement>(".leaf-pop"));
    const rootPaths = Array.from(svg.querySelectorAll<SVGPathElement>(".root-line"));
    const branchPaths = Array.from(svg.querySelectorAll<SVGPathElement>(".branch-line"));

    gsap.set(rootPaths, { strokeDashoffset: 100 });
    gsap.set(branchPaths, { strokeDashoffset: 100 });
    gsap.set(leafGroups, { scale: 0, opacity: 0, transformOrigin: "center" });
    gsap.set(bloomRef.current, { opacity: 0 });
    gsap.set(captionRef.current, { opacity: 0, y: 8, letterSpacing: "0.5em" });
    gsap.set(frameRef.current, { opacity: 0 });

    if (reduceMotion) {
      gsap.set(rootPaths, { strokeDashoffset: 0 });
      gsap.set(branchPaths, { strokeDashoffset: 0 });
      gsap.set(leafGroups, { scale: 1, opacity: 1 });
      gsap.set(bloomRef.current, { opacity: 0.6 });
      gsap.set(captionRef.current, { opacity: 1, y: 0, letterSpacing: "0.18em" });
      gsap.set(frameRef.current, { opacity: 1 });
      progressRef.current = 1;
      const t = setTimeout(() => {
        if (autoDismiss) {
          gsap.to(container, {
            opacity: 0,
            duration: 0.35,
            onComplete: () => onCompleteRef.current?.(),
          });
        }
      }, 500);
      return () => clearTimeout(t);
    }

    const T = Math.max(1.4, minDisplayTime / 1000);

    const tl = gsap.timeline({
      onUpdate: () => {
        progressRef.current = tl.progress();
      },
      onComplete: () => {
        if (autoDismiss) {
          // Direct smooth fade-out into login page without any delay
          gsap.to(container, {
            opacity: 0,
            scale: 1.03,
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

    // 1. Paper and letterpress frame reveal
    tl.to(container, { "--paper-opacity": 1, duration: 0.15 * T } as gsap.TweenVars, 0);
    tl.to(frameRef.current, { opacity: 1, duration: 0.28 * T }, 0.04 * T);

    // 2. Roots grow into the ground
    tl.to(
      rootPaths,
      { strokeDashoffset: 0, duration: 0.22 * T, stagger: 0.012 * T, ease: "power2.inOut" },
      0.04 * T
    );

    // 3. Trunk & Branches spread upward & outward across the full screen
    const growthStart = 0.08 * T;
    const growthEnd = 0.62 * T;
    const growthSpan = growthEnd - growthStart;
    for (let d = 0; d <= CANOPY_MAX_DEPTH; d++) {
      const segs = branchPaths.filter((el) => el.getAttribute("data-depth") === String(d));
      if (segs.length > 0) {
        const segStart = growthStart + (d / CANOPY_MAX_DEPTH) * growthSpan;
        const segDur = (growthSpan / CANOPY_MAX_DEPTH) * 1.5;
        tl.to(
          segs,
          { strokeDashoffset: 0, duration: segDur, stagger: segDur * 0.08, ease: "power2.out" },
          segStart
        );
      }
    }

    // 4. Foliage unfurls in lush waves
    tl.to(
      leafGroups,
      {
        scale: 1,
        opacity: 1,
        rotation: (i: number) => `+=${((i * 37) % 15) - 7}`,
        duration: 0.28 * T,
        ease: "back.out(1.5)",
        stagger: { amount: 0.32 * T, from: "center" },
      },
      0.54 * T
    );

    // 5. Warm golden canopy bloom
    tl.to(bloomRef.current, { opacity: 0.65, duration: 0.18 * T, ease: "power1.out" }, 0.78 * T);

    // 6. Letterpress caption
    if (title) {
      tl.to(
        captionRef.current,
        { opacity: 1, y: 0, letterSpacing: "0.22em", duration: 0.18 * T, ease: "power2.out" },
        0.84 * T
      );
    }

    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(raf);
      tl.kill();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minDisplayTime, autoDismiss, leaves]);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden select-none bg-[#e8dec4]"
      style={
        {
          "--paper-opacity": 0,
        } as React.CSSProperties
      }
    >
      {/* Aged paper background */}
      <div
        className="absolute inset-0"
        style={{
          opacity: "var(--paper-opacity)" as unknown as number,
          transition: "opacity 0.4s ease-out",
          background:
            "radial-gradient(ellipse at 50% 45%, #f2e9d2 0%, #e8dec4 50%, #d5c5a2 100%)",
        }}
      />

      {/* Fine paper grain texture */}
      <svg className="absolute inset-0 w-full h-full opacity-[0.055] mix-blend-multiply pointer-events-none">
        <filter id="grain">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.85"
            numOctaves="2"
            stitchTiles="stitch"
          />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#grain)" />
      </svg>

      {/* Ink dust motes canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none z-10" />

      {/* Golden sun bloom behind canopy */}
      <div
        ref={bloomRef}
        className="absolute top-[35%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[850px] h-[850px] rounded-full pointer-events-none z-10"
        style={{
          background:
            "radial-gradient(circle, rgba(163,205,116,0.38) 0%, rgba(201,154,59,0.22) 45%, transparent 75%)",
        }}
      />

      {/* Full-Screen Botanical SVG with xMidYMax slice (like background-size: cover anchored bottom-center) */}
      <div className="absolute inset-0 w-full h-full pointer-events-none z-20 flex items-center justify-center">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          preserveAspectRatio="xMidYMax slice"
          className="w-full h-full object-cover filter drop-shadow-[0_15px_35px_rgba(40,30,20,0.18)]"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <symbol id="leafA" viewBox="-12 -30 24 36">
              <path d="M0,3 C-9,-5 -9,-22 0,-30 C9,-22 9,-5 0,3 Z" />
              <path d="M0,1 L0,-26" stroke="#00000032" strokeWidth="0.7" fill="none" />
              <path
                d="M0,-7 L-5,-13 M0,-13 L5,-19 M0,-19 L-4,-24"
                stroke="#00000022"
                strokeWidth="0.5"
                fill="none"
              />
            </symbol>
            <symbol id="leafB" viewBox="-14 -28 28 34">
              <path d="M0,4 C-11,-2 -11,-18 0,-27 C11,-18 11,-2 0,4 Z" />
              <path d="M0,2 L0,-23" stroke="#0000002e" strokeWidth="0.7" fill="none" />
              <path
                d="M0,-6 L-6,-11 M0,-12 L6,-17"
                stroke="#00000020"
                strokeWidth="0.5"
                fill="none"
              />
            </symbol>
          </defs>

          {/* Roots */}
          <g fill="none" strokeLinecap="round">
            {rootSegments.map((s, i) => (
              <path
                key={`r${i}`}
                className="root-line"
                d={s.d}
                stroke={barkTone(0, true)}
                strokeWidth={s.width}
                pathLength={100}
                style={{ strokeDasharray: "100", strokeDashoffset: "100" }}
              />
            ))}
          </g>

          {/* Canopy branches */}
          <g fill="none" strokeLinecap="round">
            {branchSegments.map((s, i) => (
              <path
                key={`b${i}`}
                className="branch-line"
                data-depth={s.depth}
                d={s.d}
                stroke={barkTone(s.depth, false)}
                strokeWidth={s.width}
                pathLength={100}
                style={{ strokeDasharray: "100", strokeDashoffset: "100" }}
              />
            ))}
          </g>

          {/* Botanical leaves */}
          {clusters.map((cluster) => (
            <g
              key={cluster.id}
              className="leaf-cluster"
              transform={`translate(${cluster.x} ${cluster.y})`}
            >
              {cluster.items.map((leaf) => (
                <g
                  key={leaf.id}
                  className="leaf-pop"
                  transform={`translate(${(leaf.x - cluster.x).toFixed(1)} ${(
                    leaf.y - cluster.y
                  ).toFixed(1)}) rotate(${leaf.rot.toFixed(0)})`}
                >
                  <g transform={`scale(${leaf.scale.toFixed(2)})`}>
                    <use href={`#leaf${leaf.variant}`} fill={TONE_FILL[leaf.tone]} />
                  </g>
                </g>
              ))}
            </g>
          ))}
        </svg>
      </div>

      {/* Letterpress frame */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none z-30">
        <g ref={frameRef}>
          <rect
            x="24"
            y="24"
            style={{ width: "calc(100% - 48px)", height: "calc(100% - 48px)" }}
            fill="none"
            stroke="#3a332c"
            strokeOpacity="0.3"
            strokeWidth="1"
          />
          <line x1="24" y1="16" x2="24" y2="32" stroke="#3a332c" strokeOpacity="0.35" />
          <line x1="16" y1="24" x2="32" y2="24" stroke="#3a332c" strokeOpacity="0.35" />
        </g>
      </svg>

      {/* Caption */}
      {title ? (
        <div
          ref={captionRef}
          className="absolute bottom-[6%] left-1/2 -translate-x-1/2 z-30 text-center pointer-events-none"
          style={{
            fontFamily: "Georgia, 'Times New Roman', serif",
            fontStyle: "italic",
            fontSize: "14px",
            color: "#3a332c",
            textTransform: "uppercase",
            letterSpacing: "0.22em",
          }}
        >
          {title}
        </div>
      ) : null}
    </div>
  );
}