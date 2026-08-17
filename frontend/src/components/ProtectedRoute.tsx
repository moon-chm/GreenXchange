"use client";
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { useState, useCallback, ReactNode } from 'react';
import CinematicIntroLoader from '@/components/shared/CinematicIntroLoader';

export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [animationComplete, setAnimationComplete] = useState(false);

  const handleFinish = useCallback(() => {
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
