"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { CheckCircle2, XCircle, Loader2, ArrowRight, RefreshCw, Mail } from "lucide-react";
import api from "@/lib/axios";
import GxcLogo from "@/components/icons/GxcLogo";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");


  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [message, setMessage] = useState("");
  const [resendEmail, setResendEmail] = useState("");
  const [resending, setResending] = useState(false);
  const [resendMsg, setResendMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      setSuccess(false);
      setMessage("Verification token is missing from the link.");
      return;
    }

    const verify = async () => {
      try {
        const res = await api.get(`/auth/verify-email?token=${token}`);
        setSuccess(true);
        setMessage(res.data.message || "Email verified successfully!");
      } catch (err: any) {
        setSuccess(false);
        setMessage(err?.response?.data?.detail || "Invalid or expired verification link.");
      } finally {
        setLoading(false);
      }
    };

    verify();
  }, [token]);

  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resendEmail.trim()) return;
    setResending(true);
    setResendMsg(null);
    try {
      const res = await api.post("/auth/resend-verification", { email: resendEmail.trim() });
      setResendMsg(res.data.message || "Verification link sent! Check your inbox.");
    } catch (err: any) {
      setResendMsg(err?.response?.data?.detail || "Failed to resend verification link.");
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen bg-parchment flex flex-col items-center justify-center px-4 py-12 relative overflow-hidden">
      {/* Background Ambience */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-fern/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-sage/20 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-white/90 border border-sage/40 rounded-3xl p-8 shadow-card backdrop-blur-sm z-10 text-center">
        {/* Brand Header */}
        <div className="flex justify-center mb-6">
          <GxcLogo size={36} variant="full" />
        </div>

        {loading ? (
          <div className="py-10 space-y-4">
            <Loader2 className="w-12 h-12 animate-spin text-fern mx-auto" />
            <h2 className="text-xl font-display font-semibold text-canopy">Verifying Your Account...</h2>
            <p className="text-sm text-canopy/60">Please wait while we confirm your email address.</p>
          </div>
        ) : success ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="space-y-6"
          >
            <div className="w-16 h-16 bg-fern/10 text-fern rounded-2xl flex items-center justify-center mx-auto border border-fern/20 shadow-xs">
              <CheckCircle2 size={36} />
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-display font-bold text-canopy">Email Verified!</h2>
              <p className="text-sm text-canopy/70">{message}</p>
            </div>

            <Link
              href="/login"
              className="inline-flex items-center justify-center gap-2 w-full px-6 py-3 rounded-xl bg-fern hover:bg-forest text-parchment font-semibold shadow-button transition-all duration-200"
            >
              Sign In to GreenXchange
              <ArrowRight size={18} />
            </Link>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="space-y-6"
          >
            <div className="w-16 h-16 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mx-auto border border-red-200">
              <XCircle size={36} />
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-display font-bold text-canopy">Verification Failed</h2>
              <p className="text-sm text-red-700 bg-red-50 border border-red-100 p-3 rounded-xl">
                {message}
              </p>
            </div>

            {/* Resend Box */}
            <div className="bg-parchment/60 border border-sage/40 rounded-2xl p-4 text-left space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-canopy">
                <Mail size={16} className="text-fern" />
                <span>Request a New Verification Link</span>
              </div>
              <form onSubmit={handleResend} className="space-y-2">
                <input
                  type="email"
                  value={resendEmail}
                  onChange={(e) => setResendEmail(e.target.value)}
                  placeholder="Enter your registered email"
                  required
                  className="w-full px-3 py-2 text-xs border border-sage/60 rounded-lg bg-white text-canopy outline-none focus:border-fern"
                />
                <button
                  type="submit"
                  disabled={resending}
                  className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-fern text-white text-xs font-semibold hover:bg-forest transition-colors disabled:opacity-50"
                >
                  {resending ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                  Resend Verification Email
                </button>
              </form>
              {resendMsg && (
                <p className="text-xs text-fern font-medium pt-1 text-center">{resendMsg}</p>
              )}
            </div>

            <div className="pt-2">
              <Link
                href="/login"
                className="text-xs text-canopy/60 hover:text-fern transition-colors font-medium"
              >
                Back to Sign In
              </Link>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-parchment flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-fern" />
      </div>
    }>
      <VerifyEmailContent />
    </Suspense>
  );
}

