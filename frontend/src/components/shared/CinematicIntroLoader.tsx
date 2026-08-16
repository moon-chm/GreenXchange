"use client";

/**
 * CinematicIntroLoader — "Field Notes"
 * ------------------------------------
 * A full-screen intro sequence styled as a botanical field-guide plate.
 * The tree is not a handful of hand-placed <path>s — it's grown with a
 * recursive branching function (the same fractal-tree technique used for
 * procedural trees/rivers/veins: each branch spawns 2-3 children at a
 * randomized divergence angle, ~30% shorter and thinner than its parent,
 * until it runs out of length). That's what gives it hundreds of natural
 * branch tips to hang leaves from instead of a fixed handful of blobs.
 *
 * Line drawing uses GSAP's DrawSVGPlugin (free since the Webflow
 * acquisition — no Club GreenSock membership needed), which is the
 * documented, robust way to animate stroke reveals instead of hand-rolled
 * stroke-dasharray math.
 *
 * Design notes:
 * - Palette: aged paper + warm charcoal ink for the structure, but the
 *   canopy itself uses real living greens (moss / spring / shadow-olive)
 *   with gold as an accent, not the dominant tone — reads "alive," not
 *   "old sepia photo."
 * - Leaves are grown in clusters at branch tips AND scattered along the
 *   outer branches (the way real canopies thicken toward their edges),
 *   not one leaf per tip.
 * - A quiet idle sway keeps the canopy breathing once it's grown in,
 *   instead of the scene going static while it waits to dismiss.
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
  /** Small caption that letterpresses in under the plate. Pass "" to omit. */
  title?: string;
}

/* ---------------------------------------------------------------------- */
/* Deterministic PRNG — leaf/branch scatter is identical on server &      */
/* client, so there's no hydration mismatch from Math.random in render.   */
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
/* Recursive branch generator — the classic fractal-tree recursion:       */
/* draw a segment, then spawn 2-3 shorter/thinner children at a jittered  */
/* divergence angle, with a gentle organic bow instead of a dead-straight */
/* rod, and slightly lighter bark tone the further out you get.           */
/* ---------------------------------------------------------------------- */
interface Segment {
  d: string; // path "d" attribute (single-segment quadratic curve)
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
  const { x, y, angle, length, depth, width, maxDepth, rand, segments, tips, midAnchors, minLength, maxSegments } = opts;

  if (segments.length > maxSegments || length < minLength) {
    tips.push({ x, y });
    return;
  }

  const rad = (angle * Math.PI) / 180;
  const x2 = x + Math.cos(rad) * length;
  const y2 = y + Math.sin(rad) * length;

  // Gentle organic bow, perpendicular to the segment — real branches
  // are never perfectly straight rods.
  const bow = (rand() - 0.5) * length * 0.22;
  const cx = (x + x2) / 2 + Math.cos(rad + Math.PI / 2) * bow;
  const cy = (y + y2) / 2 + Math.sin(rad + Math.PI / 2) * bow;

  segments.push({ d: `M${x.toFixed(1)},${y.toFixed(1)} Q${cx.toFixed(1)},${cy.toFixed(1)} ${x2.toFixed(1)},${y2.toFixed(1)}`, depth, width });

  // Branches thicken toward the outer canopy — sprout a leaf cluster
  // mid-branch sometimes, not just at the very tip.
  if (depth >= Math.floor(maxDepth * 0.45) && rand() < 0.4) {
    midAnchors.push({ x: x2, y: y2 });
  }

  if (depth >= maxDepth) {
    tips.push({ x: x2, y: y2 });
    return;
  }

  const children = depth < 2 ? 2 : rand() < 0.68 ? 2 : 3;
  for (let i = 0; i < children; i++) {
    const dir = i - (children - 1) / 2;
    const spread = 16 + rand() * 22; // divergence angle, degrees
    const childAngle = angle + dir * spread + (rand() - 0.5) * 10;
    const childLength = length * (0.64 + rand() * 0.18); // ~30% shorter per generation
    const childWidth = Math.max(0.5, width * 0.66);
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

type Tone = "green" | "brightGreen" | "gold" | "shadow";
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
  green: "#6f9152", // living spring green — the dominant tone
  brightGreen: "#93b565", // sunlit highlight leaves
  gold: "#c99a3b", // warm accent, used sparingly
  shadow: "#3d4a34", // interior canopy depth, cool olive (not brown ink)
};

const GROUND_Y = 452;
const TRUNK_X = 250;

export default function CinematicIntroLoader({
  onComplete,
  autoDismiss = true,
  minDisplayTime = 4600,
  title = "Rooted",
}: CinematicIntroLoaderProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const bloomRef = useRef<HTMLDivElement>(null);
  const captionRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<SVGGElement>(null);

  // Keep the latest onComplete without forcing the whole effect to
  // re-run every render (an inline arrow prop is a new reference each time).
  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  /* ---- Grow the canopy + roots once, deterministically. ---- */
  const CANOPY_MAX_DEPTH = 6;
  const { branchSegments, rootSegments, leaves, anchorPoints } = useMemo(() => {
    const rand = mulberry32(20260817);

    const canopySegments: Segment[] = [];
    const tips: Anchor[] = [];
    const midAnchors: Anchor[] = [];
    growBranches({
      x: TRUNK_X,
      y: GROUND_Y - 6,
      angle: -90,
      length: 150,
      depth: 0,
      width: 8,
      maxDepth: CANOPY_MAX_DEPTH,
      rand,
      segments: canopySegments,
      tips,
      midAnchors,
      minLength: 7,
      maxSegments: 190,
    });

    const rootSegs: Segment[] = [];
    const rootTips: Anchor[] = [];
    const rootMid: Anchor[] = [];
    const rootRand = mulberry32(864197253);
    growBranches({
      x: TRUNK_X,
      y: GROUND_Y + 2,
      angle: 90,
      length: 55,
      depth: 0,
      width: 4.5,
      maxDepth: 3,
      rand: rootRand,
      segments: rootSegs,
      tips: rootTips,
      midAnchors: rootMid,
      minLength: 10,
      maxSegments: 40,
    });

    // Build leaf clusters: 3 leaves per branch tip, 2 per mid-branch sprout.
    // Thin evenly (not by truncating) if there are more anchors than we
    // want to render, so density stays even across the whole canopy.
    const rawAnchors: Array<{ a: Anchor; count: number }> = [
      ...tips.map((a) => ({ a, count: 3 })),
      ...midAnchors.map((a) => ({ a, count: 2 })),
    ];
    const MAX_ANCHORS = 130;
    const step = rawAnchors.length > MAX_ANCHORS ? rawAnchors.length / MAX_ANCHORS : 1;
    const anchors: Array<{ a: Anchor; count: number }> = [];
    for (let i = 0; i < rawAnchors.length; i += step) anchors.push(rawAnchors[Math.floor(i)]);

    const leafList: LeafDatum[] = [];
    const anchorPoints: Anchor[] = [];
    anchors.forEach(({ a, count }, ai) => {
      anchorPoints.push(a); // the true branch-tip point, before leaf jitter
      for (let i = 0; i < count; i++) {
        const ang = rand() * Math.PI * 2;
        const r = 4 + rand() * 15;
        const toneRoll = rand();
        const tone: Tone = toneRoll < 0.46 ? "green" : toneRoll < 0.72 ? "brightGreen" : toneRoll < 0.86 ? "gold" : "shadow";
        leafList.push({
          id: `${ai}-${i}`,
          x: a.x + Math.cos(ang) * r,
          y: a.y + Math.sin(ang) * r * 0.85,
          rot: rand() * 360,
          scale: 0.5 + rand() * 0.62,
          tone,
          variant: rand() < 0.6 ? "A" : "B",
          clusterId: ai,
        });
      }
    });

    return { branchSegments: canopySegments, rootSegments: rootSegs, leaves: leafList.slice(0, 420), anchorPoints };
  }, []);

  // Group leaves by their anchor cluster so we can sway each cluster as
  // one unit later, pivoting around its own true branch-tip point (not a
  // jittered leaf position).
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

    /* ---------------- ink dust motes (fine specks, no glow/bokeh) ------- */
    interface Mote {
      x: number; y: number; vx: number; vy: number; size: number; alpha: number; settled: boolean; flicker: number;
    }
    const MOTE_COUNT = 55;
    const motes: Mote[] = Array.from({ length: MOTE_COUNT }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.22,
      vy: Math.random() * 0.14 + 0.04,
      size: Math.random() * 1.2 + 0.5,
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

    gsap.set(".branch-line, .root-line", { drawSVG: "0%" });
    gsap.set(leafGroups, { scale: 0, opacity: 0, transformOrigin: "center" });
    gsap.set(bloomRef.current, { opacity: 0 });
    gsap.set(captionRef.current, { opacity: 0, y: 8, letterSpacing: "0.5em" });
    gsap.set(frameRef.current, { opacity: 0 });

    let swayTl: gsap.core.Timeline | null = null;

    if (reduceMotion) {
      gsap.set(".branch-line, .root-line", { drawSVG: "100%" });
      gsap.set(leafGroups, { scale: 1, opacity: 1 });
      gsap.set(bloomRef.current, { opacity: 0.5 });
      gsap.set(captionRef.current, { opacity: 1, y: 0, letterSpacing: "0.18em" });
      gsap.set(frameRef.current, { opacity: 1 });
      progressRef.current = 1;
      const t = setTimeout(() => {
        if (autoDismiss) {
          gsap.to(container, { opacity: 0, duration: 0.5, onComplete: () => onCompleteRef.current?.() });
        }
      }, Math.max(600, minDisplayTime * 0.4));
      return () => {
        clearTimeout(t);
        cancelAnimationFrame(raf);
        window.removeEventListener("resize", handleResize);
      };
    }

    // Every beat is a FRACTION of T, so the growth sequence always takes
    // exactly minDisplayTime regardless of its value.
    const T = Math.max(1.4, minDisplayTime / 1000);

    const tl = gsap.timeline({
      onUpdate: () => (progressRef.current = tl.progress()),
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

    tl.to(container, { "--paper-opacity": 1, duration: 0.16 * T } as gsap.TweenVars, 0);
    tl.to(frameRef.current, { opacity: 1, duration: 0.3 * T }, 0.05 * T);

    // Roots draw first.
    tl.to(".root-line", { drawSVG: "100%", duration: 0.2 * T, stagger: 0.015 * T, ease: "power2.inOut" }, 0.05 * T);

    // Branches draw outward, depth by depth (trunk -> boughs -> twigs).
    const growthStart = 0.1 * T;
    const growthEnd = 0.6 * T;
    const growthSpan = growthEnd - growthStart;
    for (let d = 0; d <= CANOPY_MAX_DEPTH; d++) {
      const segStart = growthStart + (d / CANOPY_MAX_DEPTH) * growthSpan;
      const segDur = (growthSpan / CANOPY_MAX_DEPTH) * 1.5;
      tl.to(
        `.branch-line[data-depth="${d}"]`,
        { drawSVG: "100%", duration: segDur, stagger: segDur * 0.12, ease: "power2.out" },
        segStart
      );
    }

    // Leaves unfurl with a randomized per-leaf rotation wobble — an
    // organic pop, not a uniform stagger grid.
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

    tl.to(bloomRef.current, { opacity: 0.55, duration: 0.16 * T, ease: "power1.out" }, 0.8 * T);

    if (title) {
      tl.to(
        captionRef.current,
        { opacity: 1, y: 0, letterSpacing: "0.18em", duration: 0.16 * T, ease: "power2.out" },
        0.86 * T
      );
    }

    // Idle canopy sway — a quiet breathing loop once the leaves settle,
    // so the plate feels alive rather than static while it waits to exit.
    swayTl = gsap.timeline({ repeat: -1, yoyo: true, delay: 0.9 * T });
    clusterGroups.forEach((g, i) => {
      swayTl!.to(
        g,
        {
          rotation: (i % 2 === 0 ? 1 : -1) * (1.1 + (i % 5) * 0.2),
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
          clipPath: "circle(var(--iris) at 50% 44%)",
        } as React.CSSProperties
      }
    >
      {/* Aged paper base + vignette */}
      <div
        className="absolute inset-0"
        style={{
          opacity: "var(--paper-opacity)" as unknown as number,
          transition: "opacity 0.4s ease-out",
          background: "radial-gradient(ellipse at 50% 42%, #f1e7cf 0%, #e7ddc3 55%, #d8caa8 100%)",
        }}
      />
      {/* Fine paper grain */}
      <svg className="absolute inset-0 w-full h-full opacity-[0.05] mix-blend-multiply pointer-events-none">
        <filter id="grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#grain)" />
      </svg>

      <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none z-10" />

      {/* Warm bloom light behind the canopy */}
      <div
        ref={bloomRef}
        className="absolute top-[28%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full pointer-events-none z-10"
        style={{
          background: "radial-gradient(circle, rgba(147,181,101,0.3) 0%, rgba(201,154,59,0.16) 42%, transparent 72%)",
        }}
      />

      {/* Center plate — full-bleed: the SVG "covers" the viewport like a
          background image (uniform scale, cropped, anchored to bottom
          center) so the same grown tree spreads edge-to-edge instead of
          sitting in a small centered box. */}
      <div className="absolute inset-0 z-20">
        <svg
          ref={svgRef}
          viewBox="0 0 500 500"
          preserveAspectRatio="xMidYMax slice"
          className="w-full h-full block"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            {/* Leaf symbols carry their own vein texture, so a single
                <use> per leaf is enough — no doubled-up hatch overlay. */}
            <symbol id="leafA" viewBox="-10 -26 20 30">
              <path d="M0,2 C-7,-4 -7,-18 0,-26 C7,-18 7,-4 0,2 Z" />
              <path d="M0,0 L0,-22" stroke="#00000030" strokeWidth="0.6" fill="none" />
              <path d="M0,-6 L-4,-11 M0,-11 L4,-16" stroke="#00000022" strokeWidth="0.5" fill="none" />
            </symbol>
            <symbol id="leafB" viewBox="-10 -24 20 28">
              <path d="M0,3 C-8,-1 -8,-15 0,-23 C8,-15 8,-1 0,3 Z" />
              <path d="M0,1 L0,-19" stroke="#00000028" strokeWidth="0.6" fill="none" />
            </symbol>
          </defs>

          {/* Roots — grown with the same recursion as the canopy, just
              shorter, thinner, and pointed downward. */}
          <g fill="none" strokeLinecap="round">
            {rootSegments.map((s, i) => (
              <path key={`r${i}`} className="root-line" d={s.d} stroke={barkTone(0, true)} strokeWidth={s.width} />
            ))}
          </g>

          {/* Canopy — every segment came out of growBranches(), so the
              structure (angles, tapering, count) is procedural, not
              hand-placed. */}
          <g fill="none" strokeLinecap="round">
            {branchSegments.map((s, i) => (
              <path key={`b${i}`} className="branch-line" data-depth={s.depth} d={s.d} stroke={barkTone(s.depth, false)} strokeWidth={s.width} />
            ))}
          </g>

          {/* Leaves, grouped by branch-tip cluster so each cluster can
              sway together later. */}
          {clusters.map((cluster) => (
            <g key={cluster.id} className="leaf-cluster" transform={`translate(${cluster.x} ${cluster.y})`}>
              {cluster.items.map((leaf) => (
                <g
                  key={leaf.id}
                  className="leaf-pop"
                  transform={`translate(${(leaf.x - cluster.x).toFixed(1)} ${(leaf.y - cluster.y).toFixed(1)}) rotate(${leaf.rot.toFixed(0)})`}
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

      {/* Letterpress frame + caption */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none z-30">
        <g ref={frameRef}>
          <rect x="28" y="28" width="calc(100% - 56px)" height="calc(100% - 56px)" fill="none" stroke="#3a332c" strokeOpacity="0.35" strokeWidth="1" />
          <line x1="28" y1="20" x2="28" y2="36" stroke="#3a332c" strokeOpacity="0.35" />
          <line x1="20" y1="28" x2="36" y2="28" stroke="#3a332c" strokeOpacity="0.35" />
        </g>
      </svg>

      {title ? (
        <div
          ref={captionRef}
          className="absolute bottom-[12%] left-1/2 -translate-x-1/2 z-30 text-center"
          style={{
            fontFamily: "Georgia, 'Times New Roman', serif",
            fontStyle: "italic",
            fontSize: "13px",
            color: "#3a332c",
            textTransform: "uppercase",
          }}
        >
          {title}
          
        </div>
      ) : null}
    </div>
  );
}