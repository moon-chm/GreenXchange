"use client";

import { useState } from "react";
import Link from "next/link";
import { useReducedMotion, motion } from "framer-motion";
import api from "@/lib/axios";
import GxcLogo from "@/components/icons/GxcLogo";
import { extractErrorMessage } from "@/lib/utils";
import { CheckCircle2, ArrowRight, Sparkles } from "lucide-react";

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
export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [isRegistered, setIsRegistered] = useState(false);
  const [verificationUrl, setVerificationUrl] = useState<string | null>(null);
  const reduced = useReducedMotion() ?? false;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);
    try {
      const res = await api.post("/auth/register", { name, email, password });
      if (res.data?.verification_url) {
        setVerificationUrl(res.data.verification_url);
      }
      setIsRegistered(true);
    } catch (err: any) {
      if (err.response?.status === 400 || err.response?.status === 409) {
        setError(err.response?.data?.detail || "An account with this email already exists.");
      } else {
        setError(extractErrorMessage(err, "Registration failed. Please try again."));
      }
    } finally {
      setLoading(false);
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
          className="leaf-float-1 absolute top-[8%] left-[15%] text-sage/60"
          style={{ fontSize: 0 }}
        />
        <FloatingLeaf
          className="leaf-float-2 absolute top-[40%] right-[6%] text-parchment/30"
          style={{ fontSize: 0 }}
        />
        <FloatingLeaf
          className="leaf-float-3 absolute bottom-[15%] left-[10%] text-sage/40"
          style={{ fontSize: 0 }}
        />
        <FloatingLeaf
          className="leaf-float-4 absolute bottom-[38%] right-[22%] text-fern/50"
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
          {isRegistered ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center space-y-6 bg-white/80 border border-sage/40 rounded-3xl p-8 shadow-card"
            >
              <div className="w-16 h-16 bg-fern/10 text-fern rounded-2xl flex items-center justify-center mx-auto border border-fern/20 shadow-xs">
                <CheckCircle2 size={36} />
              </div>

              <div className="space-y-2">
                <h2 className="text-2xl font-display font-bold text-canopy">Verify Your Email</h2>
                <p className="text-sm text-canopy/70">
                  We&apos;ve sent a verification link to <strong>{email}</strong>.
                </p>
                <p className="text-xs text-canopy/50 pt-1">
                  Please click the link in your email or click the instant activation button below to begin:
                </p>
              </div>

              {verificationUrl ? (
                <div className="space-y-3 pt-2">
                  <a
                    href={verificationUrl}
                    className="inline-flex items-center justify-center gap-2 w-full px-6 py-3.5 rounded-xl bg-fern hover:bg-forest text-parchment font-semibold shadow-button transition-all duration-200 text-sm"
                  >
                    <Sparkles size={16} />
                    Activate Account Instantly
                  </a>
                  <Link
                    href="/login"
                    className="inline-flex items-center justify-center gap-2 w-full px-6 py-2.5 rounded-xl border border-sage/60 hover:bg-sage/10 text-canopy font-medium text-xs transition-all duration-200"
                  >
                    Go to Sign In <ArrowRight size={14} />
                  </Link>
                </div>
              ) : (
                <div className="pt-2">
                  <Link
                    href="/login"
                    className="inline-flex items-center justify-center gap-2 w-full px-6 py-3 rounded-xl bg-fern hover:bg-forest text-parchment font-semibold shadow-button transition-all duration-200 text-sm"
                  >
                    Go to Sign In
                    <ArrowRight size={16} />
                  </Link>
                </div>
              )}
            </motion.div>
          ) : (
            <>
              {/* Heading */}
              <motion.div
                initial={reduced ? {} : { opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={reduced ? {} : { duration: 0.4, ease: "easeOut" }}
                className="mb-8"
              >
                <h1 className="font-display text-3xl font-bold text-canopy tracking-tight">
                  Create account
                </h1>
                <p className="text-canopy/60 text-sm mt-1">
                  Join GreenXchange and start making a difference
                </p>
              </motion.div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                <FormRow index={0} reduced={reduced}>
                  <div>
                    <label
                      htmlFor="register-name"
                      className="block text-xs font-semibold text-canopy mb-1.5"
                    >
                      Full name
                    </label>
                    <input
                      id="register-name"
                      type="text"
                      required
                      autoComplete="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Rohit Avinash Kumbhar"
                      className={inputClass}
                    />
                  </div>
                </FormRow>

                <FormRow index={1} reduced={reduced}>
                  <div>
                    <label
                      htmlFor="register-email"
                      className="block text-xs font-semibold text-canopy mb-1.5"
                    >
                      Email address
                    </label>
                    <input
                      id="register-email"
                      type="email"
                      required
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="rohitak1865@gmail.com"
                      className={inputClass}
                    />
                  </div>
                </FormRow>

                <FormRow index={2} reduced={reduced}>
                  <div>
                    <label
                      htmlFor="register-password"
                      className="block text-xs font-semibold text-canopy mb-1.5"
                    >
                      Password
                    </label>
                    <input
                      id="register-password"
                      type="password"
                      required
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className={inputClass}
                    />
                  </div>
                </FormRow>

                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-3.5 bg-red-50/80 border border-red-200/80 text-red-700 text-xs rounded-xl font-sans"
                    role="alert"
                  >
                    {error}
                  </motion.div>
                )}

                <FormRow index={3} reduced={reduced}>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 px-4 bg-forest hover:bg-canopy text-parchment font-semibold rounded-xl transition-all duration-200 flex items-center justify-center text-sm shadow-button disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer mt-2"
                  >
                    {loading ? <Spinner /> : "Create account"}
                  </button>
                </FormRow>
              </form>

              {/* Footer switch */}
              <motion.p
                initial={reduced ? {} : { opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={reduced ? {} : { delay: 0.3, duration: 0.4 }}
                className="text-center text-xs text-canopy/60 mt-8 font-sans"
              >
                Already have an account?{" "}
                <Link
                  href="/login"
                  className="font-semibold text-forest hover:text-canopy underline underline-offset-2 transition-colors"
                >
                  Sign in
                </Link>
              </motion.p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
