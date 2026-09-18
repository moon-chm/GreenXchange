"use client";
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { useState, useCallback, ReactNode } from 'react';
import CinematicIntroLoader from '@/components/shared/CinematicIntroLoader';

const INTRO_SHOWN_KEY = 'gx_intro_shown';

export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  // Play the full cinematic intro once per browser tab session only — without
  // this, every hard refresh or deep link into the app (not just first login)
  // forced a mandatory 5s wait before content, or even a login redirect, showed.
  const [animationComplete, setAnimationComplete] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      return sessionStorage.getItem(INTRO_SHOWN_KEY) === '1';
    } catch {
      return false;
    }
  });

  const handleFinish = useCallback(() => {
    try {
      sessionStorage.setItem(INTRO_SHOWN_KEY, '1');
    } catch {
      // Private browsing / storage disabled — safe to ignore, just replays next time.
    }
    setAnimationComplete(true);
    if (!loading && !user) {
      router.push('/login');
    }
  }, [loading, user, router]);

  // Play the full-screen radial center-to-edge botanical bloom
  if (!animationComplete) {
    return (
      <CinematicIntroLoader
        minDisplayTime={5000}
        autoDismiss={true}
        onComplete={handleFinish}
      />
    );
  }

  // After animation finishes: if not logged in, navigate immediately without any second loader delay
  if (!user) {
    return null;
  }

  return <>{children}</>;
}
