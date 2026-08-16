"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Building2, Lock, ShieldAlert, ArrowRight, CheckCircle2 } from "lucide-react";
import api from "@/lib/axios";
import GxcLogo from "@/components/icons/GxcLogo";

export default function OrgLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleOrgLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // 1. Authenticate via OAuth2 form data
      const formData = new URLSearchParams();
      formData.append("username", email.trim());
      formData.append("password", password);

      const loginRes = await api.post("/auth/login", formData, {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });

      const { access_token } = loginRes.data;
      localStorage.setItem("access_token", access_token);
      localStorage.setItem("org_token", access_token);

      // 2. Verify user has ORGANIZATION role / is_org flag
      const meRes = await api.get("/users/me", {
        headers: { Authorization: `Bearer ${access_token}` },
      });

      const userData = meRes.data;

      if (!userData.is_org && userData.role !== "ORGANIZATION" && userData.role !== "ADMIN") {
        localStorage.removeItem("access_token");
        localStorage.removeItem("org_token");
        setError("Access Denied: Standard citizen accounts cannot access the Organization Portal. Credentials are strictly issued by the Municipal Government.");
        setLoading(false);
        return;
      }

      // 3. Store org session and redirect to billing portal
      localStorage.setItem("org_user", JSON.stringify(userData));
      router.push("/org/billing");
    } catch (err: any) {
      const msg = err?.response?.data?.detail || "Invalid Organization Username or Password.";
      setError(msg);
      localStorage.removeItem("access_token");
      localStorage.removeItem("org_token");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-parchment/40 text-canopy flex flex-col justify-between px-4 py-6 sm:px-6 md:px-10 font-sans relative overflow-x-hidden">
      {/* Background Decorator Circles */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-fern/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-sage/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header Bar */}
      <header className="flex items-center justify-between z-10 max-w-6xl w-full mx-auto border-b border-sage/30 pb-4">
        <div className="flex items-center gap-3">
          <GxcLogo size={36} variant="full" dark={false} />
          <span className="text-fern text-xs font-semibold px-2 py-0.5 rounded-full bg-fern/10 border border-fern/20">
            Org Portal
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-canopy/50">
          <Building2 size={14} />
          <span>Government Allocated Partner Ecosystem</span>
        </div>
      </header>

      {/* Login Card Container */}
      <div className="flex-1 flex items-center justify-center py-6 sm:py-8 z-10">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md bg-white/90 border border-sage/40 rounded-3xl p-6 sm:p-8 shadow-card backdrop-blur-sm space-y-6"
        >
          {/* Card Header */}
          <div className="space-y-2 text-center">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-fern/10 text-fern border border-fern/20 flex items-center justify-center">
              <Lock size={26} />
            </div>
            <h2 className="font-display text-2xl font-bold text-canopy">
              Organization Login
            </h2>
            <p className="text-xs text-canopy/60">
              Sign in with your government-allocated organization credentials
            </p>
          </div>

          {/* Official Notice */}
          <div className="p-3.5 rounded-2xl bg-parchment/60 border border-sage/30 text-xs text-canopy space-y-1 font-sans">
            <div className="font-bold flex items-center gap-1.5 text-fern">
              <ShieldAlert size={14} /> Public Registration Disabled
            </div>
            <p className="text-[11px] text-canopy/70 leading-relaxed">
              Registration is disabled for organizations. Access is restricted to government-authorized eco-partner nurseries.
            </p>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-300 text-rose-700 text-xs font-sans">
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleOrgLogin} className="space-y-4 font-sans">
            <div>
              <label className="block text-xs font-semibold text-canopy/80 uppercase tracking-wider mb-1">
                Organization Email / User ID
              </label>
              <input
                type="email"
                placeholder="org@authority.gov.in"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-parchment/20 border border-sage/40 text-canopy placeholder-canopy/40 text-sm focus:outline-none focus:ring-2 focus:ring-fern/50"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-canopy/80 uppercase tracking-wider mb-1">
                Password
              </label>
              <input
                type="password"
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-parchment/20 border border-sage/40 text-canopy placeholder-canopy/40 text-sm focus:outline-none focus:ring-2 focus:ring-fern/50"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-fern hover:bg-fern/90 text-parchment font-bold rounded-xl shadow-md transition-colors flex items-center justify-center gap-2 group text-sm"
            >
              {loading ? "Authenticating Authority..." : "Access Organization Portal"}
              <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
            </button>
          </form>
        </motion.div>
      </div>

      {/* Footer */}
      <footer className="text-center text-xs text-canopy/60 z-10 max-w-6xl w-full mx-auto border-t border-sage/30 pt-4 pb-2 flex flex-col sm:flex-row items-center justify-between gap-2">
        <p>© 2026 GreenXchange Government Ecosystem. All Rights Reserved.</p>
        <div className="flex items-center gap-4 text-[11px]">
          <span className="flex items-center gap-1 text-canopy/70"><CheckCircle2 size={12} className="text-fern" /> Municipal Audit Protocol</span>
          <span className="flex items-center gap-1 text-canopy/70"><CheckCircle2 size={12} className="text-fern" /> Encrypted Payment Channel</span>
        </div>
      </footer>
    </div>
  );
}
