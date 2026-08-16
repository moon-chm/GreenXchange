"use client";

/**
 * CinematicIntroLoader — "Field Notes" Botanical Metamorphosis
 * -----------------------------------------------------------
 * A finely-proportioned botanical illustration plate inspired by classic
 * natural history field guides (Ernst Haeckel / John James Audubon).
 *
 * Sequence:
 * 1. Deep roots branch naturally into the soil.
 * 2. Majestic trunk and curved boughs grow depth-by-depth.
 * 3. Hundreds of delicate, realistic botanical leaves unfurl on the branch tips.
 * 4. Gentle organic breeze sways foliage clusters.
 * 5. Smooth iris circle transition directly reveals the login page.
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
/* Deterministic PRNG for hydration consistency                           */
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

  if (depth >= Math.floor(maxDepth * 0.4) && rand() < 0.5) {
    midAnchors.push({ x: x2, y: y2 });
  }

  if (depth >= maxDepth) {
    tips.push({ x: x2, y: y2 });
    return;
  }

  const children = depth < 2 ? 2 : rand() < 0.6 ? 2 : 3;
  for (let i = 0; i < children; i++) {
    const dir = i - (children - 1) / 2;
    const spread = 18 + rand() * 20;
    const childAngle = angle + dir * spread + (rand() - 0.5) * 12;
    const childLength = length * (0.68 + rand() * 0.14);
    const childWidth = Math.max(0.7, width * 0.65);
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
  if (isRoot) return "#2c251e";
  const tones = ["#231d17", "#322920", "#42362b", "#534537", "#685746", "#7c6853", "#8e7861"];
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
  brightGreen: "#7cae52",
  emerald: "#3d6c38",
  gold: "#c59838",
  shadow: "#2f4029",
};

// 1000x700 coordinate box perfectly frames a majestic tree
const VIEW_W = 1000;
const VIEW_H = 700;
const GROUND_Y = 620;
const TRUNK_X = 500;

export default function CinematicIntroLoader({
  onComplete,
  autoDismiss = true,
  minDisplayTime = 4200,
  title = "GreenXchange",
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

  /* ---- Grow the botanical canopy + roots once deterministically ---- */
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
      length: 180,
      depth: 0,
      width: 11,
      maxDepth: CANOPY_MAX_DEPTH,
      rand,
      segments: canopySegments,
      tips,
      midAnchors,
      minLength: 8,
      maxSegments: 240,
    });

    const rootSegs: Segment[] = [];
    const rootTips: Anchor[] = [];
    const rootMid: Anchor[] = [];
    const rootRand = mulberry32(864197253);
    growBranches({
      x: TRUNK_X,
      y: GROUND_Y + 4,
      angle: 90,
      length: 65,
      depth: 0,
      width: 6,
      maxDepth: 3,
      rand: rootRand,
      segments: rootSegs,
      tips: rootTips,
      midAnchors: rootMid,
      minLength: 10,
      maxSegments: 45,
    });

    const rawAnchors: Array<{ a: Anchor; count: number }> = [
      ...tips.map((a) => ({ a, count: 4 })),
      ...midAnchors.map((a) => ({ a, count: 2 })),
    ];
    const MAX_ANCHORS = 150;
    const step = rawAnchors.length > MAX_ANCHORS ? rawAnchors.length / MAX_ANCHORS : 1;
    const anchors: Array<{ a: Anchor; count: number }> = [];
    for (let i = 0; i < rawAnchors.length; i += step) anchors.push(rawAnchors[Math.floor(i)]);

    const leafList: LeafDatum[] = [];
    const anchorPts: Anchor[] = [];
    anchors.forEach(({ a, count }, ai) => {
      anchorPts.push(a);
      for (let i = 0; i < count; i++) {
        const ang = rand() * Math.PI * 2;
        const r = 4 + rand() * 16;
        const toneRoll = rand();
        const tone: Tone =
          toneRoll < 0.45
            ? "green"
            : toneRoll < 0.72
            ? "brightGreen"
            : toneRoll < 0.85
            ? "emerald"
            : toneRoll < 0.94
            ? "gold"
            : "shadow";
        leafList.push({
          id: `${ai}-${i}`,
          x: a.x + Math.cos(ang) * r,
          y: a.y + Math.sin(ang) * r * 0.9,
          rot: rand() * 360,
          scale: 0.6 + rand() * 0.45,
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
      vx: (Math.random() - 0.5) * 0.2,
      vy: Math.random() * 0.12 + 0.04,
      size: Math.random() * 1.2 + 0.5,
      alpha: Math.random() * 0.28 + 0.1,
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
            m.vy = -(Math.random() * 0.18 + 0.05);
            m.vx = (Math.random() - 0.5) * 0.15;
          }
          m.x += m.vx;
          m.y += m.vy;
          if (m.x < -4) m.x = width + 4;
          if (m.x > width + 4) m.x = -4;
          if (m.y < -4) m.y = height + 4;
          if (m.y > height + 4) m.y = -4;
          ctx.globalAlpha = m.alpha * (0.6 + 0.4 * Math.sin(m.flicker));
          ctx.fillStyle = m.settled ? "#c59838" : "#3a332c";
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
    gsap.set(captionRef.current, { opacity: 0, y: 8, letterSpacing: "0.45em" });
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
            duration: 0.45,
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
            duration: 0.85,
            ease: "power3.inOut",
            onComplete: () => onCompleteRef.current?.(),
          } as gsap.TweenVars);
        }
      },
    });

    // 1. Paper and letterpress frame reveal
    tl.to(container, { "--paper-opacity": 1, duration: 0.15 * T } as gsap.TweenVars, 0);
    tl.to(frameRef.current, { opacity: 1, duration: 0.28 * T }, 0.05 * T);

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
        const segDur = (growthSpan / CANOPY_MAX_DEPTH) * 1.4;
        tl.to(
          segs,
          { strokeDashoffset: 0, duration: segDur, stagger: segDur * 0.1, ease: "power2.out" },
          segStart
        );
      }
    }

    // 4. Leaves unfurl in delicate organic clusters
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
    tl.to(bloomRef.current, { opacity: 0.5, duration: 0.16 * T, ease: "power1.out" }, 0.8 * T);

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
      className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden select-none bg-[#e8dec6]"
      style={
        {
          "--paper-opacity": 0,
          "--iris": "150%",
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
            "radial-gradient(ellipse at 50% 45%, #f2e9d2 0%, #e8dec4 55%, #d5c5a2 100%)",
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
        className="absolute top-[34%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[650px] h-[650px] rounded-full pointer-events-none z-10"
        style={{
          background:
            "radial-gradient(circle, rgba(147,181,101,0.3) 0%, rgba(201,154,59,0.16) 42%, transparent 72%)",
        }}
      />

      {/* Botanical Tree SVG */}
      <div className="absolute inset-0 z-20 flex items-center justify-center p-4 sm:p-8">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          preserveAspectRatio="xMidYMid meet"
          className="w-full h-full max-w-5xl max-h-[92vh] object-contain"
          xmlns="http://www.w3.org/2000/svg"
        >
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

          {/* Botanical foliage clusters — delicately proportioned */}
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
                  ).toFixed(1)}) rotate(${leaf.rot.toFixed(0)}) scale(${leaf.scale.toFixed(2)})`}
                >
                  {/* Leaf blade */}
                  <path
                    d={
                      leaf.variant === "A"
                        ? "M0,2 C-7,-4 -7,-18 0,-26 C7,-18 7,-4 0,2 Z"
                        : "M0,3 C-8,-1 -8,-15 0,-23 C8,-15 8,-1 0,3 Z"
                    }
                    fill={TONE_FILL[leaf.tone]}
                    stroke="#23301d"
                    strokeWidth="0.5"
                    strokeOpacity="0.45"
                  />
                  {/* Central vein */}
                  <path
                    d={leaf.variant === "A" ? "M0,0 L0,-22" : "M0,1 L0,-19"}
                    stroke="#192415"
                    strokeWidth="0.6"
                    strokeOpacity="0.35"
                    fill="none"
                  />
                  {/* Side veins */}
                  <path
                    d={
                      leaf.variant === "A"
                        ? "M0,-6 L-4,-10 M0,-11 L4,-15 M0,-16 L-3,-19"
                        : "M0,-5 L-4,-9 M0,-10 L4,-14"
                    }
                    stroke="#192415"
                    strokeWidth="0.45"
                    strokeOpacity="0.25"
                    fill="none"
                  />
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
          className="absolute bottom-[3.5%] left-1/2 -translate-x-1/2 z-30 text-center pointer-events-none"
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