"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldCheck, AlertCircle, X, Check, Lock } from "lucide-react";
import api from "@/lib/axios";

export interface PendingPaymentRequest {
  id: string;
  org_id: string;
  org_name?: string;
  user_id: string;
  amount_gxc: number;
  service_description: string;
  status: string;
  created_at: string;
}

interface PendingPaymentApprovalModalProps {
  requests: PendingPaymentRequest[];
  isOpen: boolean;
  onClose: () => void;
  onProcessed: () => void;
}

export default function PendingPaymentApprovalModal({
  requests,
  isOpen,
  onClose,
  onProcessed
}: PendingPaymentApprovalModalProps) {
  const [selectedReq, setSelectedReq] = useState<PendingPaymentRequest | null>(
    requests.length > 0 ? requests[0] : null
  );
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen || requests.length === 0) return null;

  const currentReq = selectedReq || requests[0];

  const handleApprove = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!password) {
      setError("Please enter your password to authorize payment.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.post<{ success: boolean; new_balance: number; amount_paid: number }>("/rewards/approve-org-request", {
        request_id: currentReq.id,
        password: password
      });
      setSuccessMsg(`Payment of ${res.data.amount_paid} GXC approved! New Balance: ${res.data.new_balance} GXC.`);
      setPassword("");
      setTimeout(() => {
        setSuccessMsg(null);
        onProcessed();
      }, 1500);
    } catch (err: any) {
      const msg = err?.response?.data?.detail || "Approval failed. Please check your password.";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    setError(null);
    setSubmitting(true);
    try {
      await api.post("/rewards/reject-org-request", {
        request_id: currentReq.id
      });
      setSuccessMsg("Payment request rejected.");
      setTimeout(() => {
        setSuccessMsg(null);
        onProcessed();
      }, 1200);
    } catch (err: any) {
      const msg = err?.response?.data?.detail || "Rejection failed.";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl border border-sage/40 space-y-6 relative"
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-xl text-canopy/50 hover:text-canopy hover:bg-sage/10 transition-colors"
          >
            <X size={18} />
          </button>

          {/* Header */}
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center">
              <ShieldCheck size={24} />
            </div>
            <div>
              <h2 className="font-display text-2xl font-bold text-canopy">
                Pending Payment Approval
              </h2>
              <p className="text-xs font-sans text-canopy/60">
                An organization has requested a GXC token payment for service
              </p>
            </div>
          </div>

          {/* Error & Success Banners */}
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-sans">
              {error}
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-sans font-bold">
              {successMsg}
            </div>
          )}

          {/* Request Selector if multiple */}
          {requests.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-2">
              {requests.map((r, idx) => (
                <button
                  key={r.id}
                  onClick={() => { setSelectedReq(r); setError(null); }}
                  className={[
                    "px-3 py-1.5 rounded-xl text-xs font-semibold font-sans whitespace-nowrap transition-colors",
                    currentReq.id === r.id
                      ? "bg-fern text-parchment shadow-sm"
                      : "bg-sage/20 text-canopy hover:bg-sage/30"
                  ].join(" ")}
                >
                  Request #{idx + 1} ({r.amount_gxc} GXC)
                </button>
              ))}
            </div>
          )}

          {/* Details Card */}
          <div className="p-5 rounded-2xl bg-parchment/40 border border-sage/30 space-y-3 font-sans">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wider text-canopy/50 font-bold">Requesting Org</span>
              <span className="text-sm font-bold text-canopy">{currentReq.org_name || "Partner Organization"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wider text-canopy/50 font-bold">Service Provided</span>
              <span className="text-sm font-semibold text-canopy">{currentReq.service_description}</span>
            </div>
            <div className="pt-3 border-t border-sage/20 flex items-center justify-between">
              <span className="text-xs uppercase tracking-wider text-canopy/50 font-bold">Requested Payment</span>
              <span className="font-display text-2xl font-bold text-fern">{currentReq.amount_gxc} GXC</span>
            </div>
          </div>

          {/* Password Confirmation Form */}
          <form onSubmit={handleApprove} className="space-y-4 font-sans">
            <div>
              <label className="block text-xs font-semibold text-canopy/80 mb-1 flex items-center gap-1">
                <Lock size={12} /> Confirm Your Account Password
              </label>
              <input
                type="password"
                placeholder="Enter password to authorize GXC transfer"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-sage/40 bg-white text-canopy font-sans text-sm focus:outline-none focus:ring-2 focus:ring-fern/50"
                required
              />
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleReject}
                disabled={submitting}
                className="flex-1 py-3 border border-rose-200 text-rose-700 hover:bg-rose-50 font-bold rounded-xl text-sm transition-colors"
              >
                Reject Request
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 py-3 bg-fern hover:bg-fern/90 text-parchment font-bold rounded-xl text-sm shadow-md transition-colors flex items-center justify-center gap-2"
              >
                <Check size={16} />
                {submitting ? "Processing..." : "Approve & Pay"}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
