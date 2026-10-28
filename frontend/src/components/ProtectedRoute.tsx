"use client";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, ReactNode } from "react";

export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);
  if (loading || !user) {
    return <div role="status" className="min-h-dvh flex items-center justify-center text-canopy bg-parchment"><p>{loading ? "Loading your account…" : "Taking you to sign in…"}</p></div>;
  }
  return <>{children}</>;
}
