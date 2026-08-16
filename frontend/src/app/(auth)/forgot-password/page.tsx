"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Mail, ArrowLeft, Loader2, CheckCircle2, ShieldQuestion } from "lucide-react";
import api from "@/lib/axios";
import GxcLogo from "@/components/icons/GxcLogo";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setError(null);
    setLoading(true);

    try {
      const res = await api.post("/auth/forgot-password", { email: email.trim() });
      setMessage(res.data.message || "Password reset instructions have been sent.");
      setSubmitted(true);
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Failed to submit request. Please try again.");
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

        {submitted ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center space-y-5"
          >
            <div className="w-16 h-16 bg-fern/10 text-fern rounded-2xl flex items-center justify-center mx-auto border border-fern/20 shadow-xs">
              <CheckCircle2 size={36} />
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-display font-bold text-canopy">Check Your Inbox</h2>
              <p className="text-sm text-canopy/70">{message}</p>
              <p className="text-xs text-canopy/50 pt-2">
                We sent a password reset link to <strong>{email}</strong>. It will expire in 1 hour.
              </p>
            </div>

            <div className="pt-4">
              <Link
                href="/login"
                className="inline-flex items-center justify-center gap-2 w-full px-6 py-3 rounded-xl bg-fern hover:bg-forest text-parchment font-semibold shadow-button transition-all duration-200"
              >
                <ArrowLeft size={18} />
                Return to Sign In
              </Link>
            </div>
          </motion.div>
        ) : (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 bg-fern/10 text-fern rounded-xl flex items-center justify-center mx-auto mb-3">
                <ShieldQuestion size={24} />
              </div>
              <h1 className="text-2xl font-display font-bold text-canopy">Forgot Password?</h1>
              <p className="text-sm text-canopy/60">
                Enter the email address associated with your account and we&apos;ll send you a password reset link.
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
                  Account Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-3.5 text-canopy/40" size={18} />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    className="w-full pl-10 pr-4 py-3 border border-sage focus:border-fern focus:ring-2 focus:ring-fern/20 bg-white/70 rounded-xl outline-none transition-all text-canopy text-sm"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-fern hover:bg-forest text-parchment font-semibold shadow-button transition-all duration-200 disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Send Reset Link"}
              </button>
            </form>

            <div className="text-center pt-2">
              <Link
                href="/login"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-canopy/60 hover:text-fern transition-colors"
              >
                <ArrowLeft size={14} />
                Back to Sign In
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
