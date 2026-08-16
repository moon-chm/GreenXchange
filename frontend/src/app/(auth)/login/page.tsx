"use client";

import { useState } from "react";
import Link from "next/link";
import { useReducedMotion, motion } from "framer-motion";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/axios";
import GxcLogo from "@/components/icons/GxcLogo";
import { extractErrorMessage } from "@/lib/utils";

/* ─── Inline SVG leaf shape ─────────────────────────────────────── */
function FloatingLeaf({
  className,
  style,
}: {
  className: string;
  style?: React.CSSProperties;
}) {
  return (
    <span
      className={className}
      style={style}
      aria-hidden="true"
    >
      <svg
        width="40"
        height="40"
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M20 4C20 4 6 10 6 24C6 31.732 12.268 38 20 38C20 38 20 24 34 14C26 14 20 4 20 4Z"
          fill="currentColor"
          opacity="0.7"
        />
        <line
          x1="20"
          y1="38"
          x2="20"
          y2="16"
          stroke="currentColor"
          strokeWidth="1.2"
          opacity="0.5"
        />
      </svg>
    </span>
  );
}

/* ─── Spinner ────────────────────────────────────────────────────── */
function Spinner() {
  return (
    <svg
      className="animate-spin h-5 w-5 text-parchment"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

/* ─── Field row wrapper — staggered entrance ─────────────────────── */
function FormRow({
  children,
  index,
  reduced,
}: {
  children: React.ReactNode;
  index: number;
  reduced: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: reduced ? 0 : 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={
        reduced ? { duration: 0 } : { delay: index * 0.06, duration: 0.35, ease: "easeOut" }
      }
    >
      {children}
    </motion.div>
  );
}

/* ─── Page ───────────────────────────────────────────────────────── */
export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [isUnverified, setIsUnverified] = useState(false);
  const [resendStatus, setResendStatus] = useState<string | null>(null);
  const { login } = useAuth();
  const reduced = useReducedMotion() ?? false;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsUnverified(false);
    setResendStatus(null);
    setLoading(true);

    try {
      const formData = new URLSearchParams();
      formData.append("username", email);
      formData.append("password", password);

      const res = await api.post("/auth/login", formData, {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });
      await login(res.data.access_token, res.data.user ?? undefined);
    } catch (err: any) {
      if (err.response?.status === 403 && err.response?.data?.detail === "email_not_verified") {
        setIsUnverified(true);
        setError("Your email address is not verified yet. Please check your inbox for the activation link.");
      } else if (err.response?.status === 429) {
        setError("Too many failed attempts. Please try again later.");
      } else {
        setError(extractErrorMessage(err, "Invalid email or password."));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    if (!email.trim()) return;
    try {
      setResendStatus("Sending...");
      const res = await api.post("/auth/resend-verification", { email: email.trim() });
      setResendStatus(res.data.message || "Verification link sent! Check your inbox.");
    } catch (err: any) {
      setResendStatus("Failed to resend verification link.");
    }
  };

  const inputClass =
    "w-full px-4 py-3 border border-sage focus:border-fern focus:ring-2 focus:ring-fern/20 bg-white/60 rounded-xl outline-none transition-all duration-200 text-canopy placeholder-canopy/40 font-sans text-sm";

  return (
    <div className="min-h-screen flex">
      {/* ── Left panel (desktop only) ────────────────────────────── */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-gradient-to-br from-canopy to-forest overflow-hidden flex-col items-center justify-center px-16">
        {/* Floating leaves */}
        <FloatingLeaf
          className="leaf-float-1 absolute top-[12%] left-[10%] text-sage/60"
          style={{ fontSize: 0 }}
        />
        <FloatingLeaf
          className="leaf-float-2 absolute top-[30%] right-[8%] text-parchment/30"
          style={{ fontSize: 0 }}
        />
        <FloatingLeaf
          className="leaf-float-3 absolute bottom-[20%] left-[18%] text-sage/40"
          style={{ fontSize: 0 }}
        />
        <FloatingLeaf
          className="leaf-float-4 absolute bottom-[35%] right-[20%] text-fern/50"
          style={{ fontSize: 0 }}
        />

        {/* Logo */}
        <motion.div
          initial={reduced ? {} : { opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reduced ? {} : { duration: 0.5, ease: "easeOut" }}
          className="flex items-center gap-3 mb-12"
        >
          <GxcLogo size={44} variant="full" dark={true} />
        </motion.div>

        {/* Quote */}
        <motion.blockquote
          initial={reduced ? {} : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reduced ? {} : { delay: 0.15, duration: 0.55, ease: "easeOut" }}
          className="font-display text-3xl font-semibold text-parchment leading-snug text-center max-w-xs italic"
        >
          &ldquo;Every leaf is a promise of a greener world&rdquo;
        </motion.blockquote>

        {/* Subtle radial highlight */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at 60% 30%, rgba(163,177,138,0.10) 0%, transparent 70%)",
          }}
        />
      </div>

      {/* ── Right panel ──────────────────────────────────────────── */}
      <div className="flex-1 bg-parchment flex flex-col items-center justify-center px-6 py-16 min-h-screen">
        {/* Mobile logo */}
        <div className="flex lg:hidden items-center gap-2 mb-10">
          <GxcLogo size={30} variant="full" dark={false} />
        </div>

        <div className="w-full max-w-sm">
          {/* Heading */}
          <FormRow index={0} reduced={reduced}>
            <h1 className="font-display text-3xl font-semibold text-canopy mb-1">
              Welcome back
            </h1>
            <p className="font-sans text-sm text-canopy/60 mb-8">
              Sign in to your account to continue
            </p>
          </FormRow>

          <form onSubmit={handleSubmit} noValidate className="space-y-5">
            {/* Email */}
            <FormRow index={1} reduced={reduced}>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-canopy mb-1.5"
              >
                Email address
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
              />
            </FormRow>

            {/* Password */}
            <FormRow index={2} reduced={reduced}>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-canopy"
                >
                  Password
                </label>
                <Link
                  href="/forgot-password"
                  className="text-xs font-medium text-fern hover:text-forest transition-colors"
                >
                  Forgot password?
                </Link>
              </div>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClass}
              />
            </FormRow>

            {/* Error / Unverified Notice */}
            {error && (
              <FormRow index={3} reduced={reduced}>
                <div className="space-y-2">
                  <p className="text-sm text-red-600 font-medium bg-red-50 border border-red-200 rounded-xl p-3" role="alert">
                    {error}
                  </p>
                  {isUnverified && (
                    <div className="text-center pt-1">
                      <button
                        type="button"
                        onClick={handleResendVerification}
                        className="text-xs font-semibold text-fern hover:underline"
                      >
                        Resend verification email to {email}
                      </button>
                      {resendStatus && (
                        <p className="text-xs text-canopy/70 mt-1 font-medium">{resendStatus}</p>
                      )}
                    </div>
                  )}
                </div>
              </FormRow>
            )}

            {/* Submit */}
            <FormRow index={error ? 4 : 3} reduced={reduced}>
              <motion.button
                type="submit"
                disabled={loading}
                whileTap={reduced ? {} : { scale: 0.97 }}
                className="bg-fern hover:bg-forest text-parchment rounded-xl py-3 w-full font-semibold text-sm transition-colors duration-200 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <Spinner />
                    <span>Signing in…</span>
                  </>
                ) : (
                  "Sign in"
                )}
              </motion.button>
            </FormRow>
          </form>

          {/* Footer link */}
          <FormRow index={error ? 5 : 4} reduced={reduced}>
            <p className="mt-6 text-center text-sm text-canopy/60">
              Don&apos;t have an account?{" "}
              <Link
                href="/register"
                className="text-fern hover:text-forest font-medium transition-colors duration-200"
              >
                Create one
              </Link>
            </p>
          </FormRow>
        </div>
      </div>
    </div>
  );
}
