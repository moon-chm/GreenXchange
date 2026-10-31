"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import CinematicIntroLoader from "./CinematicIntroLoader";

const INTRO_SHOWN_KEY = "gx_intro_shown";

export default function StartupIntro({ children }: { children: ReactNode }) {
  const [showIntro, setShowIntro] = useState(true);
  const contentRef = useRef<HTMLDivElement>(null);

  const finishIntro = useCallback(() => {
    try {
      sessionStorage.setItem(INTRO_SHOWN_KEY, "1");
    } catch {
      // The app still opens when browser storage is unavailable.
    }
    setShowIntro(false);
  }, []);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(INTRO_SHOWN_KEY) === "1") setShowIntro(false);
    } catch {
      // Play normally if this browser cannot remember the session.
    }
  }, []);

  useEffect(() => {
    const content = contentRef.current;
    if (!showIntro) return;

    // Pages and authentication can load underneath without accepting input.
    content?.setAttribute("inert", "");
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Never leave the app covered if an animation fails to complete.
    const timeout = window.setTimeout(finishIntro, 15000);
    return () => {
      content?.removeAttribute("inert");
      document.body.style.overflow = previousOverflow;
      window.clearTimeout(timeout);
    };
  }, [showIntro, finishIntro]);

  return (
    <>
      <div ref={contentRef} aria-hidden={showIntro || undefined}>
        {children}
      </div>
      {showIntro && (
        <>
          <CinematicIntroLoader minDisplayTime={5000} autoDismiss onComplete={finishIntro} />
          <button
            type="button"
            onClick={finishIntro}
            className="fixed bottom-6 right-6 z-[10000] min-h-11 rounded-full bg-parchment/90 px-5 py-2 text-sm font-medium text-canopy shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-fern"
          >
            Skip intro
          </button>
        </>
      )}
    </>
  );
}
