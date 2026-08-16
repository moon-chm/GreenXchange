"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Building2, Send, CheckCircle2, Clock, XCircle, RefreshCw, LogOut, ShieldCheck, User } from "lucide-react";
import api from "@/lib/axios";

interface IssuedPaymentRequest {
  id: string;
  user_id: string;
  user_email?: string;
  amount_gxc: number;
  service_description: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  created_at: string;
}

export default function OrgBillingPage() {
  const router = useRouter();

  // Org Session State
  const [orgUser, setOrgUser] = useState<any>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  // Form State
  const [userIdentifier, setUserIdentifier] = useState("");
  const [amountGxc, setAmountGxc] = useState<number>(25);
  const [serviceDescription, setServiceDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Table State
  const [issuedRequests, setIssuedRequests] = useState<IssuedPaymentRequest[]>([]);
  const [loading, setLoading] = useState(true);

  // Auth Guard for Standalone Org Portal
  useEffect(() => {
    const token = localStorage.getItem("access_token") || localStorage.getItem("org_token");
    if (!token) {
      router.push("/org/login");
      return;
    }

    api.get("/users/me", {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then((res) => {
        if (!res.data.is_org && res.data.role !== "ORGANIZATION" && res.data.role !== "ADMIN") {
          localStorage.removeItem("access_token");
          localStorage.removeItem("org_token");
          router.push("/org/login");
        } else {
          setOrgUser(res.data);
          setCheckingAuth(false);
        }
      })
      .catch(() => {
        localStorage.removeItem("access_token");
        localStorage.removeItem("org_token");
        router.push("/org/login");
      });
  }, [router]);

  const fetchIssuedRequests = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("access_token") || localStorage.getItem("org_token");
      const res = await api.get<IssuedPaymentRequest[]>("/rewards/org-issued-requests", {
        headers: { Authorization: `Bearer ${token}` }
      });
      setIssuedRequests(res.data);
    } catch (err) {
      console.error("Failed to fetch issued requests", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!checkingAuth) {
      fetchIssuedRequests();
    }
  }, [checkingAuth, fetchIssuedRequests]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!userIdentifier.trim()) {
      setError("Please enter a valid target User Email or User ID.");
      return;
    }

    if (amountGxc <= 0) {
      setError("Payment amount must be greater than 0 GXC.");
      return;
    }

    if (!serviceDescription.trim()) {
      setError("Please enter a service description.");
      return;
    }

    setSubmitting(true);
    try {
      const token = localStorage.getItem("access_token") || localStorage.getItem("org_token");
      await api.post("/rewards/org-request-payment", {
        user_identifier: userIdentifier.trim(),
        amount_gxc: amountGxc,
        service_description: serviceDescription.trim()
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setSuccessMsg(`Payment request of ${amountGxc} GXC successfully issued to '${userIdentifier}'!`);
      setUserIdentifier("");
      setAmountGxc(25);
      setServiceDescription("");
      fetchIssuedRequests();
    } catch (err: any) {
      const msg = err?.response?.data?.detail || "Failed to submit payment request.";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSignOut = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("org_token");
    localStorage.removeItem("org_user");
    router.push("/org/login");
  };

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-parchment/30 flex items-center justify-center text-canopy font-sans">
        <p className="animate-pulse flex items-center gap-2 font-semibold text-sm">
          <ShieldCheck size={20} className="text-fern" /> Verifying Organization Credentials...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-parchment/30 text-canopy flex flex-col font-sans">
      {/* Top Header Bar matching Main Canopy Theme */}
      <header className="bg-canopy border-b border-white/10 px-6 py-4 sticky top-0 z-40 text-parchment">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-fern flex items-center justify-center shadow-xs text-parchment font-bold">
              <Building2 size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-display text-lg font-bold text-parchment">
                  {orgUser?.name || "Government Allocated Eco-Partner"}
                </h1>
                <span className="px-2 py-0.5 rounded-full bg-fern/20 text-parchment text-[10px] font-mono border border-fern/40">
                  GOV ALLOCATED
                </span>
              </div>
              <p className="text-xs text-parchment/60 flex items-center gap-2">
                <span>Account Email: <strong className="text-parchment">{orgUser?.email}</strong></span>
                <span>•</span>
                <span className="font-mono text-[11px] text-parchment/50">ID: {orgUser?.id?.substring(0, 8)}...</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={fetchIssuedRequests}
              className="p-2.5 rounded-xl bg-forest/80 hover:bg-forest text-parchment/80 hover:text-parchment transition-colors flex items-center gap-1.5 text-xs font-semibold"
              title="Refresh Requests"
            >
              <RefreshCw size={14} /> Refresh
            </button>
            <button
              onClick={handleSignOut}
              className="px-4 py-2 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 text-rose-200 border border-rose-800/60 transition-colors flex items-center gap-1.5 text-xs font-bold"
            >
              <LogOut size={14} /> Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Main Portal Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 md:p-8 space-y-6">
        {/* Banner Messages */}
        {error && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-300 text-rose-700 text-sm font-sans flex items-center justify-between shadow-xs">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-rose-500 font-bold ml-4">✕</button>
          </div>
        )}

        {successMsg && (
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-700 text-sm font-sans flex items-center justify-between shadow-xs">
            <span>{successMsg}</span>
            <button onClick={() => setSuccessMsg(null)} className="text-emerald-500 font-bold ml-4">✕</button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Payment Request Form */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="lg:col-span-5 bg-white/90 border border-sage/40 rounded-3xl p-6 shadow-card backdrop-blur-sm space-y-5"
          >
            <div>
              <h2 className="font-display text-xl font-bold text-canopy flex items-center gap-2">
                <Send size={18} className="text-fern" /> Issue Service Payment Request
              </h2>
              <p className="text-xs text-canopy/60 mt-1">
                Enter customer User Email or User ID. The user will receive an in-app password approval notification.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 font-sans text-sm">
              <div>
                <label className="block text-xs font-semibold text-canopy/80 mb-1 uppercase tracking-wider">
                  Target Customer User Email or ID
                </label>
                <div className="relative">
                  <User size={16} className="absolute left-3.5 top-3.5 text-canopy/40" />
                  <input
                    type="text"
                    placeholder="e.g. user@example.com or User UUID"
                    value={userIdentifier}
                    onChange={(e) => setUserIdentifier(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 rounded-xl bg-parchment/20 border border-sage/40 text-canopy placeholder-canopy/40 text-sm focus:outline-none focus:ring-2 focus:ring-fern/50"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-canopy/80 mb-1 uppercase tracking-wider">
                  Requested Payment Amount (GXC Tokens)
                </label>
                <input
                  type="number"
                  min={1}
                  value={amountGxc}
                  onChange={(e) => setAmountGxc(Number(e.target.value))}
                  className="w-full px-4 py-3 rounded-xl bg-parchment/20 border border-sage/40 text-canopy text-sm focus:outline-none focus:ring-2 focus:ring-fern/50"
                  required
                />
                <div className="flex gap-2 mt-2">
                  {[10, 25, 50, 100].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setAmountGxc(val)}
                      className="px-3 py-1 rounded-lg bg-sage/15 hover:bg-sage/30 text-canopy text-xs font-semibold"
                    >
                      {val} GXC
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-canopy/80 mb-1 uppercase tracking-wider">
                  Eco-Service Description
                </label>
                <textarea
                  rows={3}
                  placeholder="e.g., Organic Fertilizer Treatment & Sapling Delivery"
                  value={serviceDescription}
                  onChange={(e) => setServiceDescription(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-parchment/20 border border-sage/40 text-canopy placeholder-canopy/40 text-sm focus:outline-none focus:ring-2 focus:ring-fern/50"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3.5 bg-fern hover:bg-fern/90 text-parchment font-bold rounded-xl shadow-md transition-colors flex items-center justify-center gap-2 text-sm"
              >
                <Send size={16} />
                {submitting ? "Sending Request..." : "Issue Service Request"}
              </button>
            </form>
          </motion.div>

          {/* Right Column: Issued Requests History */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="lg:col-span-7 bg-white/90 border border-sage/40 rounded-3xl p-6 shadow-card backdrop-blur-sm space-y-4"
          >
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display text-xl font-bold text-canopy">Issued Payment Request Log</h2>
                <p className="text-xs text-canopy/60 mt-0.5">Real-time status of service payment requests issued by your organization</p>
              </div>
              <button
                onClick={fetchIssuedRequests}
                className="p-2 rounded-xl bg-sage/15 hover:bg-sage/30 text-canopy transition-colors"
                title="Refresh"
              >
                <RefreshCw size={16} />
              </button>
            </div>

            {loading ? (
              <p className="text-sm text-canopy/60 py-8 text-center">Loading request log...</p>
            ) : issuedRequests.length === 0 ? (
              <div className="py-12 text-center border border-dashed border-sage/30 rounded-2xl p-6 space-y-2">
                <p className="text-canopy font-semibold text-sm">No Payment Requests Issued Yet</p>
                <p className="text-xs text-canopy/60">Use the form on the left to issue your first service payment request to a customer.</p>
              </div>
            ) : (
              <div className="space-y-3 font-sans">
                {issuedRequests.map((req) => (
                  <div key={req.id} className="p-4 rounded-2xl bg-parchment/30 border border-sage/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-canopy">{req.service_description}</span>
                        <span className="font-display font-bold text-fern text-base">({req.amount_gxc} GXC)</span>
                      </div>
                      <p className="text-xs text-canopy/60">
                        Customer: <span className="font-mono text-canopy">{req.user_email || req.user_id}</span>
                      </p>
                      <span className="text-[11px] text-canopy/40 block">{new Date(req.created_at).toLocaleString()}</span>
                    </div>

                    <div>
                      {req.status === "APPROVED" ? (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                          <CheckCircle2 size={14} /> Approved
                        </span>
                      ) : req.status === "REJECTED" ? (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800">
                          <XCircle size={14} /> Rejected
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
                          <Clock size={14} /> Pending Approval
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        </div>
      </main>
    </div>
  );
}
