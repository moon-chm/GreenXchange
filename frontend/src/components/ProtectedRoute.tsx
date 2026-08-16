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

  // Always allow the full cinematic intro to play its complete metamorphosis
  if (!animationComplete) {
    return (
      <CinematicIntroLoader
        minDisplayTime={3600}
        autoDismiss={true}
        onComplete={handleFinish}
      />
    );
  }

  // After animation finishes: if not logged in, redirect to login
  if (!user) {
    return (
      <div className="min-h-screen bg-parchment flex items-center justify-center">
        <CinematicIntroLoader
          minDisplayTime={800}
          autoDismiss={true}
          onComplete={() => router.push('/login')}
        />
      </div>
    );
  }

  return <>{children}</>;
}
