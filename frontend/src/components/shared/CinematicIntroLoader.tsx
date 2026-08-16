"use client";

/**
 * CinematicIntroLoader — "Field Notes" Full-Screen Botanical Metamorphosis
 * -----------------------------------------------------------------------
 * A full-screen procedural fractal tree that grows and fits perfectly inside
 * any viewport (desktop, laptop, tablet, mobile) without overflowing.
 *
 * Sequence:
 * 1. Roots anchor into the soil at the base of the frame.
 * 2. Trunk and boughs branch outward depth-by-depth across the screen.
 * 3. Hundreds of botanical leaves unfurl with delicate organic veins.
 * 4. Ambient canopy breathing breeze settles in.
 * 5. Iris transition closes and opens the login page directly.
 */

import React, { useEffect, useMemo, useRef } from "react";
import gsap from "gsap";
import { DrawSVGPlugin } from "gsap/DrawSVGPlugin";

if (typeof window !== "undefined") {
  gsap.registerPlugin(DrawSVGPlugin);
}

interface CinematicIntroLoaderProps {
  onComplete?: () => void;
  autoDismiss?: boolean;
  minDisplayTime?: number;
  title?: string;
}

/* ---------------------------------------------------------------------- */
/* Deterministic PRNG for SSR and client hydration consistency            */
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

  const children = depth < 2 ? 2 : rand() < 0.65 ? 2 : 3;
  for (let i = 0; i < children; i++) {
    const dir = i - (children - 1) / 2;
    const spread = 18 + rand() * 22;
    const childAngle = angle + dir * spread + (rand() - 0.5) * 10;
    const childLength = length * (0.65 + rand() * 0.16);
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
  green: "#6f9152",
  brightGreen: "#93b565",
  emerald: "#4a7c3b",
  gold: "#c99a3b",
  shadow: "#3d4a34",
};

// 1000x650 coordinate space perfectly matches standard 16:9 / 16:10 screens
const VIEW_W = 1000;
const VIEW_H = 650;
const GROUND_Y = 590;
const TRUNK_X = 500;

export default function CinematicIntroLoader({
  onComplete,
  autoDismiss = true,
  minDisplayTime = 4200,
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
      y: GROUND_Y - 8,
      angle: -90,
      length: 190,
      depth: 0,
      width: 10,
      maxDepth: CANOPY_MAX_DEPTH,
      rand,
      segments: canopySegments,
      tips,
      midAnchors,
      minLength: 9,
      maxSegments: 220,
    });

    const rootSegs: Segment[] = [];
    const rootTips: Anchor[] = [];
    const rootMid: Anchor[] = [];
    const rootRand = mulberry32(864197253);
    growBranches({
      x: TRUNK_X,
      y: GROUND_Y + 3,
      angle: 90,
      length: 60,
      depth: 0,
      width: 5.5,
      maxDepth: 3,
      rand: rootRand,
      segments: rootSegs,
      tips: rootTips,
      midAnchors: rootMid,
      minLength: 12,
      maxSegments: 45,
    });

    const rawAnchors: Array<{ a: Anchor; count: number }> = [
      ...tips.map((a) => ({ a, count: 3 })),
      ...midAnchors.map((a) => ({ a, count: 2 })),
    ];
    const MAX_ANCHORS = 140;
    const step = rawAnchors.length > MAX_ANCHORS ? rawAnchors.length / MAX_ANCHORS : 1;
    const anchors: Array<{ a: Anchor; count: number }> = [];
    for (let i = 0; i < rawAnchors.length; i += step) anchors.push(rawAnchors[Math.floor(i)]);

    const leafList: LeafDatum[] = [];
    const anchorPts: Anchor[] = [];
    anchors.forEach(({ a, count }, ai) => {
      anchorPts.push(a);
      for (let i = 0; i < count; i++) {
        const ang = rand() * Math.PI * 2;
        const r = 5 + rand() * 18;
        const toneRoll = rand();
        const tone: Tone =
          toneRoll < 0.42
            ? "green"
            : toneRoll < 0.7
            ? "brightGreen"
            : toneRoll < 0.85
            ? "emerald"
            : toneRoll < 0.93
            ? "gold"
            : "shadow";
        leafList.push({
          id: `${ai}-${i}`,
          x: a.x + Math.cos(ang) * r,
          y: a.y + Math.sin(ang) * r * 0.85,
          rot: rand() * 360,
          scale: 0.65 + rand() * 0.55,
          tone,
          variant: rand() < 0.55 ? "A" : "B",
          clusterId: ai,
        });
      }
    });

    return {
      branchSegments: canopySegments,
      rootSegments: rootSegs,
      leaves: leafList.slice(0, 480),
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
    const MOTE_COUNT = 55;
    const motes: Mote[] = Array.from({ length: MOTE_COUNT }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.22,
      vy: Math.random() * 0.14 + 0.04,
      size: Math.random() * 1.3 + 0.5,
      alpha: Math.random() * 0.3 + 0.12,
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
    const clusterGroups = Array.from(svg.querySelectorAll<SVGGElement>(".leaf-cluster"));
    const rootPaths = Array.from(svg.querySelectorAll<SVGPathElement>(".root-line"));
    const branchPaths = Array.from(svg.querySelectorAll<SVGPathElement>(".branch-line"));

    gsap.set(rootPaths, { strokeDashoffset: 100 });
    gsap.set(branchPaths, { strokeDashoffset: 100 });
    gsap.set(leafGroups, { scale: 0, opacity: 0, transformOrigin: "center" });
    gsap.set(bloomRef.current, { opacity: 0 });
    gsap.set(captionRef.current, { opacity: 0, y: 8, letterSpacing: "0.5em" });
    gsap.set(frameRef.current, { opacity: 0 });

    let swayTl: gsap.core.Timeline | null = null;

    if (reduceMotion) {
      gsap.set(rootPaths, { strokeDashoffset: 0 });
      gsap.set(branchPaths, { strokeDashoffset: 0 });
      gsap.set(leafGroups, { scale: 1, opacity: 1 });
      gsap.set(bloomRef.current, { opacity: 0.5 });
      gsap.set(captionRef.current, { opacity: 1, y: 0, letterSpacing: "0.18em" });
      gsap.set(frameRef.current, { opacity: 1 });
      progressRef.current = 1;
      const t = setTimeout(() => {
        if (autoDismiss) {
          gsap.to(container, {
            opacity: 0,
            duration: 0.5,
            onComplete: () => onCompleteRef.current?.(),
          });
        }
      }, Math.max(600, minDisplayTime * 0.4));
      return () => {
        clearTimeout(t);
        cancelAnimationFrame(raf);
        window.removeEventListener("resize", handleResize);
      };
    }

    const T = Math.max(1.4, minDisplayTime / 1000);

    const tl = gsap.timeline({
      onUpdate: () => {
        progressRef.current = tl.progress();
      },
      onComplete: () => {
        if (autoDismiss) {
          swayTl?.kill();
          gsap.to(container, {
            "--iris": "0%",
            duration: 0.9,
            ease: "power3.inOut",
            onComplete: () => onCompleteRef.current?.(),
          } as gsap.TweenVars);
        }
      },
    });

    // 1. Paper and letterpress frame reveal
    tl.to(container, { "--paper-opacity": 1, duration: 0.16 * T } as gsap.TweenVars, 0);
    tl.to(frameRef.current, { opacity: 1, duration: 0.3 * T }, 0.05 * T);

    // 2. Roots draw into the ground
    tl.to(
      rootPaths,
      { strokeDashoffset: 0, duration: 0.2 * T, stagger: 0.015 * T, ease: "power2.inOut" },
      0.05 * T
    );

    // 3. Branches draw outward depth by depth across the viewport
    const growthStart = 0.1 * T;
    const growthEnd = 0.6 * T;
    const growthSpan = growthEnd - growthStart;
    for (let d = 0; d <= CANOPY_MAX_DEPTH; d++) {
      const segs = branchPaths.filter((el) => el.getAttribute("data-depth") === String(d));
      if (segs.length > 0) {
        const segStart = growthStart + (d / CANOPY_MAX_DEPTH) * growthSpan;
        const segDur = (growthSpan / CANOPY_MAX_DEPTH) * 1.5;
        tl.to(
          segs,
          { strokeDashoffset: 0, duration: segDur, stagger: segDur * 0.1, ease: "power2.out" },
          segStart
        );
      }
    }

    // 4. Leaves unfurl in lush clusters with organic rotation wobble
    tl.to(
      leafGroups,
      {
        scale: 1,
        opacity: 1,
        rotation: (i: number) => `+=${((i * 37) % 13) - 6}`,
        duration: 0.24 * T,
        ease: "back.out(1.6)",
        stagger: { amount: 0.26 * T, from: "random" },
      },
      0.58 * T
    );

    // 5. Warm golden canopy bloom
    tl.to(bloomRef.current, { opacity: 0.55, duration: 0.16 * T, ease: "power1.out" }, 0.8 * T);

    // 6. Letterpress caption
    if (title) {
      tl.to(
        captionRef.current,
        { opacity: 1, y: 0, letterSpacing: "0.18em", duration: 0.16 * T, ease: "power2.out" },
        0.86 * T
      );
    }

    // 7. Ambient wind breathing for foliage clusters
    swayTl = gsap.timeline({ repeat: -1, yoyo: true, delay: 0.9 * T });
    clusterGroups.forEach((g, i) => {
      swayTl!.to(
        g,
        {
          rotation: (i % 2 === 0 ? 1 : -1) * (1.2 + (i % 5) * 0.2),
          transformOrigin: "center",
          duration: 2.4 + (i % 7) * 0.35,
          ease: "sine.inOut",
        },
        (i % 9) * 0.08
      );
    });

    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(raf);
      tl.kill();
      swayTl?.kill();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minDisplayTime, autoDismiss, leaves]);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden select-none"
      style={
        {
          "--paper-opacity": 0,
          "--iris": "150%",
          background: "#e7ddc6",
          clipPath: "circle(var(--iris) at 50% 50%)",
        } as React.CSSProperties
      }
    >
      {/* Aged paper base + vignette */}
      <div
        className="absolute inset-0"
        style={{
          opacity: "var(--paper-opacity)" as unknown as number,
          transition: "opacity 0.4s ease-out",
          background:
            "radial-gradient(ellipse at 50% 45%, #f1e7cf 0%, #e7ddc3 55%, #d8caa8 100%)",
        }}
      />

      {/* Fine paper grain */}
      <svg className="absolute inset-0 w-full h-full opacity-[0.05] mix-blend-multiply pointer-events-none">
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

      {/* Warm bloom light behind canopy */}
      <div
        ref={bloomRef}
        className="absolute top-[32%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full pointer-events-none z-10"
        style={{
          background:
            "radial-gradient(circle, rgba(147,181,101,0.32) 0%, rgba(201,154,59,0.18) 42%, transparent 72%)",
        }}
      />

      {/* Full-Screen Botanical SVG perfectly proportioned & framed */}
      <div className="absolute inset-0 z-20 flex items-center justify-center p-4 sm:p-8">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          preserveAspectRatio="xMidYMid meet"
          className="w-full h-full max-w-6xl max-h-screen object-contain"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <symbol id="leafA" viewBox="-10 -26 20 30">
              <path d="M0,2 C-7,-4 -7,-18 0,-26 C7,-18 7,-4 0,2 Z" />
              <path d="M0,0 L0,-22" stroke="#00000030" strokeWidth="0.6" fill="none" />
              <path
                d="M0,-6 L-4,-11 M0,-11 L4,-16"
                stroke="#00000022"
                strokeWidth="0.5"
                fill="none"
              />
            </symbol>
            <symbol id="leafB" viewBox="-10 -24 20 28">
              <path d="M0,3 C-8,-1 -8,-15 0,-23 C8,-15 8,-1 0,3 Z" />
              <path d="M0,1 L0,-19" stroke="#00000028" strokeWidth="0.6" fill="none" />
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

          {/* Botanical foliage clusters */}
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
            strokeOpacity="0.32"
            strokeWidth="1"
          />
          <line x1="24" y1="16" x2="24" y2="32" stroke="#3a332c" strokeOpacity="0.35" />
          <line x1="16" y1="24" x2="32" y2="24" stroke="#3a332c" strokeOpacity="0.35" />
        </g>
      </svg>

      {/* Title */}
      {title ? (
        <div
          ref={captionRef}
          className="absolute bottom-[4%] left-1/2 -translate-x-1/2 z-30 text-center pointer-events-none"
          style={{
            fontFamily: "Georgia, 'Times New Roman', serif",
            fontStyle: "italic",
            fontSize: "13px",
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