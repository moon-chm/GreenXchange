"use client";

/**
 * CinematicIntroLoader — "Field Notes"
 * ------------------------------------
 * A full-screen intro sequence styled as a botanical field-guide plate:
 * a single ink line draws a tree onto aged paper, leaves unfurl as small
 * hand-cut leaf shapes (not gradient circles), a warm bloom settles in,
 * and the whole plate closes like a lens iris on exit.
 *
 * Design notes:
 * - Palette: aged paper, warm charcoal ink, burnt sienna + ochre bloom.
 * - No glossy gradients-as-sky, no glow-bokeh particles — texture comes
 *   from crosshatching and fine dust motes instead.
 * - `minDisplayTime` now genuinely drives total duration: every beat in
 *   the growth timeline is expressed as a fraction of it, so a 1.5s call
 *   and an 8s call both play the full sequence at a different pace.
 */

import React, { useEffect, useMemo, useRef } from "react";
import gsap from "gsap";

interface CinematicIntroLoaderProps {
  onComplete?: () => void;
  autoDismiss?: boolean;
  minDisplayTime?: number;
  /** Small caption that letterpresses in under the plate. Pass "" to omit. */
  title?: string;
}

/* ---------------------------------------------------------------------- */
/* Deterministic PRNG so leaf scatter is identical on server & client     */
/* (avoids hydration mismatch from Math.random in render).                */
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

type Tone = "ink" | "gold" | "sienna";
interface LeafDatum {
  id: string;
  x: number;
  y: number;
  rot: number;
  scale: number;
  tone: Tone;
}

/** Rough tips of the primary/secondary boughs below — leaves cluster here. */
const LOBES: Array<{ x: number; y: number; spread: number; count: number }> = [
  { x: 250, y: 66, spread: 26, count: 9 },
  { x: 210, y: 82, spread: 22, count: 7 },
  { x: 292, y: 80, spread: 22, count: 7 },
  { x: 150, y: 118, spread: 24, count: 8 },
  { x: 108, y: 154, spread: 22, count: 7 },
  { x: 350, y: 112, spread: 24, count: 8 },
  { x: 392, y: 150, spread: 22, count: 7 },
  { x: 250, y: 140, spread: 26, count: 8 },
  { x: 182, y: 172, spread: 18, count: 6 },
  { x: 320, y: 168, spread: 18, count: 6 },
];

const TONE_FILL: Record<Tone, string> = {
  ink: "#3a332c",
  gold: "#c99a3b",
  sienna: "#b5482e",
};

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

  // Keep the latest onComplete without forcing the whole effect to re-run
  // every render (an inline arrow prop is a new reference each time).
  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  // Deterministic leaf scatter, computed once.
  const leaves = useMemo(() => {
    const rand = mulberry32(20260817);
    const out: LeafDatum[] = [];
    LOBES.forEach((lobe, li) => {
      for (let i = 0; i < lobe.count; i++) {
        const angle = rand() * Math.PI * 2;
        const radius = lobe.spread * (0.25 + rand() * 0.75);
        const toneRoll = rand();
        out.push({
          id: `${li}-${i}`,
          x: lobe.x + Math.cos(angle) * radius,
          y: lobe.y + Math.sin(angle) * radius * 0.85,
          rot: rand() * 360,
          scale: 0.55 + rand() * 0.7,
          tone: toneRoll < 0.55 ? "ink" : toneRoll < 0.82 ? "gold" : "sienna",
        });
      }
    });
    return out;
  }, []);

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

    /* ---------------- ink dust motes (no glow, fine specks) ------------- */
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
    const MOTE_COUNT = 60;
    const motes: Mote[] = Array.from({ length: MOTE_COUNT }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.25,
      vy: Math.random() * 0.15 + 0.05,
      size: Math.random() * 1.3 + 0.5,
      alpha: Math.random() * 0.35 + 0.15,
      settled: false,
      flicker: Math.random() * Math.PI * 2,
    }));

    const progressRef = { current: 0 };

    let raf = 0;
    const render = () => {
      if (ctx) {
        ctx.clearRect(0, 0, width, height);
        const bloomAmt = progressRef.current; // 0 -> 1 across the growth beat
        motes.forEach((m) => {
          m.flicker += 0.03;
          if (!m.settled && bloomAmt > 0.7 && Math.random() < 0.02) {
            m.settled = true;
            m.vy = -(Math.random() * 0.22 + 0.06);
            m.vx = (Math.random() - 0.5) * 0.18;
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

    /* ---------------- draw-on lengths, computed for real ---------------- */
    const strokeEls = Array.from(
      svg.querySelectorAll<SVGPathElement>(".ink-line")
    );
    strokeEls.forEach((el) => {
      const len = el.getTotalLength();
      el.style.strokeDasharray = `${len}`;
      el.style.strokeDashoffset = `${len}`;
    });

    const leafGroups = Array.from(
      svg.querySelectorAll<SVGGElement>(".leaf-pop")
    );
    gsap.set(leafGroups, { scale: 0, opacity: 0, transformOrigin: "center" });
    gsap.set(bloomRef.current, { opacity: 0 });
    gsap.set(captionRef.current, { opacity: 0, y: 8, letterSpacing: "0.5em" });
    gsap.set(frameRef.current, { opacity: 0 });

    if (reduceMotion) {
      // Skip straight to the resolved state, then dismiss on a simple fade.
      strokeEls.forEach((el) => (el.style.strokeDashoffset = "0"));
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

    // Every beat below is a FRACTION of T, so total growth duration always
    // equals minDisplayTime regardless of its value.
    const T = Math.max(1.2, minDisplayTime / 1000);

    const tl = gsap.timeline({
      onUpdate: () => {
        progressRef.current = tl.progress();
      },
      onComplete: () => {
        if (autoDismiss) {
          gsap.to(container, {
            "--iris": "0%",
            duration: 0.9,
            ease: "power3.inOut",
            onComplete: () => onCompleteRef.current?.(),
          } as gsap.TweenVars);
        }
      },
    });

    // Paper + frame settle in.
    tl.to(container, { "--paper-opacity": 1, duration: 0.18 * T } as gsap.TweenVars, 0);
    tl.to(frameRef.current, { opacity: 1, duration: 0.3 * T }, 0.06 * T);

    // Roots draw.
    const roots = strokeEls.filter((el) => el.dataset.part === "root");
    tl.to(
      roots,
      { strokeDashoffset: 0, duration: 0.24 * T, stagger: 0.03 * T, ease: "power2.inOut" },
      0.08 * T
    );

    // Trunk draws.
    const trunk = strokeEls.filter((el) => el.dataset.part === "trunk");
    tl.to(
      trunk,
      { strokeDashoffset: 0, duration: 0.3 * T, ease: "power2.inOut" },
      0.2 * T
    );

    // Primary boughs.
    const primary = strokeEls.filter((el) => el.dataset.part === "primary");
    tl.to(
      primary,
      { strokeDashoffset: 0, duration: 0.22 * T, stagger: 0.025 * T, ease: "power2.out" },
      0.42 * T
    );

    // Secondary twigs.
    const secondary = strokeEls.filter((el) => el.dataset.part === "secondary");
    tl.to(
      secondary,
      { strokeDashoffset: 0, duration: 0.18 * T, stagger: 0.015 * T, ease: "power2.out" },
      0.56 * T
    );

    // Leaves unfurl — organic per-leaf rotation wobble, not a uniform pop.
    leafGroups.forEach((g, i) => {
      const wobble = ((i * 37) % 11) - 5; // deterministic small jitter
      tl.to(
        g,
        {
          scale: 1,
          opacity: 1,
          rotation: `+=${wobble}`,
          duration: 0.22 * T,
          ease: "back.out(1.7)",
        },
        0.62 * T + (i / leafGroups.length) * 0.28 * T
      );
    });

    // Warm bloom settles.
    tl.to(bloomRef.current, { opacity: 0.55, duration: 0.16 * T, ease: "power1.out" }, 0.78 * T);

    // Caption letterpresses in.
    if (title) {
      tl.to(
        captionRef.current,
        { opacity: 1, y: 0, letterSpacing: "0.18em", duration: 0.16 * T, ease: "power2.out" },
        0.86 * T
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
          background:
            "radial-gradient(ellipse at 50% 42%, #f1e7cf 0%, #e7ddc3 55%, #d8caa8 100%)",
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

      {/* Ink dust motes */}
      <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none z-10" />

      {/* Warm bloom light behind the canopy */}
      <div
        ref={bloomRef}
        className="absolute top-[30%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[560px] h-[560px] rounded-full pointer-events-none z-10"
        style={{
          background:
            "radial-gradient(circle, rgba(201,154,59,0.35) 0%, rgba(181,72,46,0.14) 42%, transparent 72%)",
        }}
      />

      {/* Center plate */}
      <div className="relative z-20 w-full max-w-xl flex items-center justify-center p-6">
        <svg
          ref={svgRef}
          viewBox="0 0 500 500"
          className="w-[300px] h-[300px] sm:w-[420px] sm:h-[420px]"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <pattern id="hatch" width="5" height="5" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
              <line x1="0" y1="0" x2="0" y2="5" stroke="#3a332c" strokeWidth="0.7" opacity="0.5" />
            </pattern>
          </defs>

          {/* Roots */}
          <g fill="none" stroke="#3a332c" strokeWidth="1.6" strokeLinecap="round">
            <path className="ink-line" data-part="root" d="M250 438 Q214 460 168 480 Q136 490 102 493" />
            <path className="ink-line" data-part="root" d="M250 438 Q284 462 328 481 Q362 490 396 494" />
            <path className="ink-line" data-part="root" d="M244 440 Q210 452 154 464" />
            <path className="ink-line" data-part="root" d="M256 440 Q292 454 348 466" />
            <path className="ink-line" data-part="root" d="M250 440 Q248 470 244 495" />
          </g>

          {/* Trunk — single continuous ink line, tapered by a second offset stroke */}
          <g fill="none" stroke="#2a241f" strokeWidth="3.2" strokeLinecap="round">
            <path className="ink-line" data-part="trunk" d="M240 436 C236 350 230 270 246 200" />
            <path className="ink-line" data-part="trunk" d="M260 436 C264 350 268 270 254 200" />
          </g>

          {/* Primary boughs */}
          <g fill="none" stroke="#3a332c" strokeWidth="2" strokeLinecap="round">
            <path className="ink-line" data-part="primary" d="M246 260 Q188 214 138 182" />
            <path className="ink-line" data-part="primary" d="M254 250 Q312 202 362 176" />
            <path className="ink-line" data-part="primary" d="M248 215 Q198 152 162 116" />
            <path className="ink-line" data-part="primary" d="M252 210 Q302 148 338 112" />
            <path className="ink-line" data-part="primary" d="M250 195 Q250 132 250 68" />
          </g>

          {/* Secondary twigs */}
          <g fill="none" stroke="#4a4038" strokeWidth="1.1" strokeLinecap="round">
            <path className="ink-line" data-part="secondary" d="M160 195 Q122 162 92 148" />
            <path className="ink-line" data-part="secondary" d="M340 190 Q378 158 408 142" />
            <path className="ink-line" data-part="secondary" d="M180 137 Q142 102 122 78" />
            <path className="ink-line" data-part="secondary" d="M320 132 Q358 97 378 72" />
            <path className="ink-line" data-part="secondary" d="M250 142 Q217 98 198 74" />
            <path className="ink-line" data-part="secondary" d="M250 142 Q283 98 302 74" />
          </g>

          {/* Leaves — small pointed shapes, hatched, not gradient blobs */}
          {leaves.map((leaf) => (
            <g key={leaf.id} className="leaf-pop" transform={`translate(${leaf.x} ${leaf.y}) rotate(${leaf.rot})`}>
              <g transform={`scale(${leaf.scale})`}>
                <path d="M0,0 C-6,-6 -6,-17 0,-25 C6,-17 6,-6 0,0 Z" fill={TONE_FILL[leaf.tone]} />
                <path d="M0,0 C-6,-6 -6,-17 0,-25 C6,-17 6,-6 0,0 Z" fill="url(#hatch)" opacity={0.4} />
                <path d="M0,-2 L0,-21" stroke="#211c17" strokeWidth="0.5" opacity={0.5} />
              </g>
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