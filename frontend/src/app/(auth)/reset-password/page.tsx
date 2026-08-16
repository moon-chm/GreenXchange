"use client";

import { useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Lock, ArrowRight, Loader2, CheckCircle2, KeyRound } from "lucide-react";
import api from "@/lib/axios";
import GxcLogo from "@/components/icons/GxcLogo";

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const router = useRouter();


  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!token) {
      setError("Reset token is missing or invalid. Please request a new link.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      await api.post("/auth/reset-password", {
        token,
        new_password: password
      });
      setSuccess(true);
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Failed to reset password. The link may have expired.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-parchment flex flex-col items-center justify-center px-4 py-12 relative overflow-hidden">
      {/* Background Ambience */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-fern/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-sage/20 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-white/90 border border-sage/40 rounded-3xl p-8 shadow-card backdrop-blur-sm z-10">
        {/* Brand Header */}
        <div className="flex justify-center mb-6">
          <GxcLogo size={36} variant="full" />
        </div>

        {success ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center space-y-5"
          >
            <div className="w-16 h-16 bg-fern/10 text-fern rounded-2xl flex items-center justify-center mx-auto border border-fern/20 shadow-xs">
              <CheckCircle2 size={36} />
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-display font-bold text-canopy">Password Reset Complete!</h2>
              <p className="text-sm text-canopy/70">
                Your account password has been updated. You can now sign in with your new credentials.
              </p>
            </div>

            <div className="pt-4">
              <Link
                href="/login"
                className="inline-flex items-center justify-center gap-2 w-full px-6 py-3 rounded-xl bg-fern hover:bg-forest text-parchment font-semibold shadow-button transition-all duration-200"
              >
                Sign In Now
                <ArrowRight size={18} />
              </Link>
            </div>
          </motion.div>
        ) : (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 bg-fern/10 text-fern rounded-xl flex items-center justify-center mx-auto mb-3">
                <KeyRound size={24} />
              </div>
              <h1 className="text-2xl font-display font-bold text-canopy">Set New Password</h1>
              <p className="text-sm text-canopy/60">
                Please enter and confirm your new secure account password.
              </p>
            </div>

            {error && (
              <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl p-3 text-center">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-canopy/70 uppercase tracking-wider mb-2">
                  New Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-3.5 text-canopy/40" size={18} />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    required
                    minLength={8}
                    className="w-full pl-10 pr-4 py-3 border border-sage focus:border-fern focus:ring-2 focus:ring-fern/20 bg-white/70 rounded-xl outline-none transition-all text-canopy text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-canopy/70 uppercase tracking-wider mb-2">
                  Confirm New Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-3.5 text-canopy/40" size={18} />
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat password"
                    required
                    minLength={8}
                    className="w-full pl-10 pr-4 py-3 border border-sage focus:border-fern focus:ring-2 focus:ring-fern/20 bg-white/70 rounded-xl outline-none transition-all text-canopy text-sm"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-fern hover:bg-forest text-parchment font-semibold shadow-button transition-all duration-200 disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Update Password"}
              </button>
            </form>

            <div className="text-center pt-2">
              <Link
                href="/login"
                className="text-xs font-semibold text-canopy/60 hover:text-fern transition-colors"
              >
                Cancel and return to Sign In
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-parchment flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-fern" />
      </div>
    }>
      <ResetPasswordContent />
    </Suspense>
  );
}

