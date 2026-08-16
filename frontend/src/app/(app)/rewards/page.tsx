"use client";

import { useState, useEffect, useCallback } from "react";
import { useReducedMotion, motion } from "framer-motion";
import api from "@/lib/axios";
import { fadeUp, staggerContainer, staggerItem } from "@/lib/motion";
import RewardRing from "@/components/rewards/RewardRing";
import TransactionTimeline, {
  Transaction,
} from "@/components/rewards/TransactionTimeline";
import PendingPaymentApprovalModal, { PendingPaymentRequest } from "@/components/rewards/PendingPaymentApprovalModal";

// ─── Types & Interfaces ───────────────────────────────────────────────────────
const MAIN_TABS = ["Ledger & Activity", "Eco Marketplace", "Crypto Wallet Payout"] as const;
type MainTab = (typeof MAIN_TABS)[number];

const FILTERS = ["All", "Plant Verified", "Bonus"] as const;
type Filter = (typeof FILTERS)[number];

interface MarketplaceItem {
  id: string;
  title: string;
  description: string;
  points_cost: number;
  category: string;
  stock: number;
  is_active: boolean;
}

interface Redemption {
  id: string;
  item_id: string;
  points_spent: number;
  voucher_code: string;
  status: string;
  created_at: string;
}

interface PayoutRequest {
  id: string;
  amount_gxc: number;
  wallet_address: string;
  tx_hash?: string;
  status: string;
  created_at: string;
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function RewardsPage() {
  const reduced = useReducedMotion();

  // ── Main Tab state ──
  const [activeTab, setActiveTab] = useState<MainTab>("Ledger & Activity");

  // ── Balance & History State ──
  const [balance, setBalance]         = useState<number>(0);
  const [history, setHistory]         = useState<Transaction[]>([]);
  const [loadingBal, setLoadingBal]   = useState(true);
  const [loadingHist, setLoadingHist] = useState(true);
  const [error, setError]             = useState<string | null>(null);
  const [successMsg, setSuccessMsg]   = useState<string | null>(null);
  const [filter, setFilter]           = useState<Filter>("All");

  // ── Marketplace & Payout Polish State ──
  const [items, setItems]               = useState<MarketplaceItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [myRedemptions, setMyRedemptions] = useState<Redemption[]>([]);
  const [loadingMarket, setLoadingMarket] = useState(false);
  const [redeemingId, setRedeemingId]   = useState<string | null>(null);
  const [claimedVoucher, setClaimedVoucher] = useState<{ code: string; title: string } | null>(null);
  const [copiedCode, setCopiedCode]     = useState<string | null>(null);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(text);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  // ── Payout & Org Payment Request State ──
  const [payouts, setPayouts]           = useState<PayoutRequest[]>([]);
  const [loadingPayouts, setLoadingPayouts] = useState(false);
  const [walletAddr, setWalletAddr]     = useState("");
  const [payoutAmount, setPayoutAmount] = useState<number>(50);
  const [submittingPayout, setSubmittingPayout] = useState(false);

  const [pendingOrgRequests, setPendingOrgRequests] = useState<PendingPaymentRequest[]>([]);
  const [isApprovalModalOpen, setIsApprovalModalOpen] = useState(false);

  // ── Fetch Balance & History ──
  const fetchBalance = useCallback(async () => {
    try {
      const res = await api.get<{ balance: number }>("/rewards/balance");
      setBalance(res.data.balance);
    } catch (err) {
      console.error("Failed to fetch balance", err);
      setError("Unable to load your reward balance. Please try again.");
    } finally {
      setLoadingBal(false);
    }
  }, []);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await api.get<Transaction[]>("/rewards/history?limit=100");
      setHistory(res.data);
    } catch (err) {
      console.error("Failed to fetch history", err);
    } finally {
      setLoadingHist(false);
    }
  }, []);

  const fetchPendingOrgRequests = useCallback(async () => {
    try {
      const res = await api.get<PendingPaymentRequest[]>("/rewards/pending-org-requests");
      setPendingOrgRequests(res.data);
    } catch (err) {
      console.error("Failed to fetch pending org requests", err);
    }
  }, []);

  // ── Fetch Marketplace Items & Redemptions ──
  const fetchMarketplace = useCallback(async () => {
    setLoadingMarket(true);
    try {
      const [itemsRes, redemptionsRes] = await Promise.all([
        api.get<MarketplaceItem[]>("/rewards/marketplace"),
        api.get<Redemption[]>("/rewards/redemptions"),
      ]);
      setItems(itemsRes.data);
      setMyRedemptions(redemptionsRes.data);
    } catch (err) {
      console.error("Failed to fetch marketplace", err);
    } finally {
      setLoadingMarket(false);
    }
  }, []);

  // ── Fetch Payout Requests ──
  const fetchPayouts = useCallback(async () => {
    setLoadingPayouts(true);
    try {
      const res = await api.get<PayoutRequest[]>("/rewards/payouts");
      setPayouts(res.data);
    } catch (err) {
      console.error("Failed to fetch payouts", err);
    } finally {
      setLoadingPayouts(false);
    }
  }, []);

  useEffect(() => {
    fetchBalance();
    fetchHistory();
    fetchPendingOrgRequests();
  }, [fetchBalance, fetchHistory, fetchPendingOrgRequests]);

  useEffect(() => {
    if (activeTab === "Eco Marketplace") {
      fetchMarketplace();
    } else if (activeTab === "Crypto Wallet Payout") {
      fetchPayouts();
    }
  }, [activeTab, fetchMarketplace, fetchPayouts]);

  // ── Handle Redeem ──
  const handleRedeem = async (item: MarketplaceItem) => {
    if (balance < item.points_cost) {
      setError(`Insufficient GXC. You need ${item.points_cost} GXC to redeem '${item.title}'.`);
      return;
    }
    setError(null);
    setRedeemingId(item.id);

    try {
      const res = await api.post<{ voucher_code: string; new_balance: number; item_title: string }>("/rewards/redeem", {
        item_id: item.id,
      });
      setBalance(res.data.new_balance);
      setClaimedVoucher({ code: res.data.voucher_code, title: res.data.item_title });
      fetchMarketplace();
      fetchHistory();
    } catch (err: any) {
      const msg = err?.response?.data?.detail || "Redemption failed. Please try again.";
      setError(msg);
    } finally {
      setRedeemingId(null);
    }
  };

  // ── Handle Payout ──
  const handlePayoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!walletAddr.startsWith("0x") || walletAddr.length !== 42) {
      setError("Please enter a valid Web3 Ethereum/Polygon wallet address starting with 0x (42 characters).");
      return;
    }

    if (payoutAmount < 50) {
      setError("Minimum withdrawal threshold is 50 GXC.");
      return;
    }

    if (balance < payoutAmount) {
      setError(`Insufficient GXC balance. Available: ${balance} GXC.`);
      return;
    }

    setSubmittingPayout(true);
    try {
      const res = await api.post<PayoutRequest>("/rewards/payout", {
        amount_gxc: payoutAmount,
        wallet_address: walletAddr,
      });
      setSuccessMsg(`Payout request of ${res.data.amount_gxc} GXC submitted successfully! Status: PENDING.`);
      setWalletAddr("");
      setPayoutAmount(50);
      fetchBalance();
      fetchHistory();
      fetchPayouts();
    } catch (err: any) {
      const msg = err?.response?.data?.detail || "Payout submission failed.";
      setError(msg);
    } finally {
      setSubmittingPayout(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <motion.div
      variants={reduced ? undefined : staggerContainer}
      initial={reduced ? false : "hidden"}
      animate="visible"
      className="min-h-screen bg-parchment/30 px-4 py-8 md:px-8 md:py-10"
    >
      {/* ── Page heading ── */}
      <motion.header
        variants={reduced ? undefined : fadeUp}
        className="mb-6 flex flex-col md:flex-row md:items-end md:justify-between gap-4"
      >
        <div>
          <h1 className="font-display text-4xl md:text-5xl font-bold text-canopy leading-tight">
            GXC Token & Rewards Hub
          </h1>
          <p className="mt-2 text-canopy/60 font-sans text-sm">
            Manage your append-only GXC ledger, redeem eco-vouchers, and request Web3 crypto payouts
          </p>
        </div>

        {/* Balance Card Quick View */}
        <div className="rounded-2xl border border-sage/40 bg-white/90 backdrop-blur-sm px-5 py-3 shadow-card flex items-center gap-4">
          <div className="flex flex-col">
            <span className="text-xs font-sans text-canopy/60">GXC Balance</span>
            <span className="font-display text-2xl font-bold text-canopy">{balance.toLocaleString()} GXC</span>
          </div>
        </div>
      </motion.header>

      {/* ── Navigation Tabs ── */}
      <div className="flex border-b border-sage/30 mb-8 gap-2 overflow-x-auto">
        {MAIN_TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={[
              "px-5 py-3 font-sans text-sm font-semibold border-b-2 transition-colors whitespace-nowrap focus:outline-none",
              activeTab === tab
                ? "border-fern text-fern bg-fern/5 rounded-t-xl"
                : "border-transparent text-canopy/60 hover:text-canopy hover:border-sage/40",
            ].join(" ")}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* ── Pending Payment Alert Banner ── */}
      {pendingOrgRequests.length > 0 && (
        <motion.div
          variants={reduced ? undefined : fadeUp}
          className="mb-6 rounded-2xl border border-amber-300 bg-amber-50 p-4 font-sans flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm"
        >
          <div className="flex items-center gap-3">
            <span className="text-xl">⚠️</span>
            <div>
              <h4 className="font-bold text-amber-900 text-sm">
                {pendingOrgRequests.length} Pending Organization Payment Approval{pendingOrgRequests.length > 1 ? "s" : ""}
              </h4>
              <p className="text-xs text-amber-800">
                An organization has requested a service payment of <strong>{pendingOrgRequests[0].amount_gxc} GXC</strong> for <em>"{pendingOrgRequests[0].service_description}"</em>.
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsApprovalModalOpen(true)}
            className="px-4 py-2 rounded-xl bg-amber-800 hover:bg-amber-900 text-white font-bold text-xs transition-colors shrink-0 shadow-xs"
          >
            Review & Pay
          </button>
        </motion.div>
      )}

      {/* ── Error & Success Banners ── */}
      {error && (
        <motion.div
          variants={reduced ? undefined : fadeUp}
          role="alert"
          className="mb-6 rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-700 font-sans flex items-center justify-between"
        >
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-rose-500 hover:text-rose-700 font-bold ml-4">✕</button>
        </motion.div>
      )}

      {successMsg && (
        <motion.div
          variants={reduced ? undefined : fadeUp}
          role="status"
          className="mb-6 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 font-sans flex items-center justify-between"
        >
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-500 hover:text-emerald-700 font-bold ml-4">✕</button>
        </motion.div>
      )}

      {/* ── TAB 1: Ledger & Activity ── */}
      {activeTab === "Ledger & Activity" && (
        <motion.div
          variants={reduced ? undefined : staggerContainer}
          className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start"
        >
          {/* LEFT: Hero ring */}
          <motion.section
            variants={reduced ? undefined : staggerItem}
            aria-label="Reward ring and tier progress"
            className="lg:col-span-5"
          >
            <div className="rounded-2xl border border-sage/40 bg-white/80 backdrop-blur-sm shadow-card p-6 flex flex-col items-center gap-6">
              <RewardRing points={balance} loading={loadingBal} />
              {!loadingBal && (
                <dl className="w-full grid grid-cols-2 gap-3">
                  <StatCell label="Current Balance" value={`${balance.toLocaleString()} GXC`} />
                  <StatCell label="Ledger Total" value={loadingHist ? "—" : `${history.length} Events`} />
                </dl>
              )}
            </div>

            {/* How to Earn GXC Reference Card */}
            <div className="mt-6 rounded-2xl border border-sage/40 bg-white/80 backdrop-blur-sm p-6 space-y-4">
              <h3 className="font-display text-base font-bold text-canopy flex items-center gap-2">
                <span>🌱</span> How to Earn GXC Tokens
              </h3>
              <div className="space-y-2.5 font-sans text-xs">
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-parchment/40 border border-sage/20">
                  <span className="text-canopy font-medium">Register New Plant Passport</span>
                  <span className="font-bold text-fern bg-white px-2 py-0.5 rounded border border-sage/30">+10 GXC</span>
                </div>
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-parchment/40 border border-sage/20">
                  <span className="text-canopy font-medium">Submit Verified Growth Update</span>
                  <span className="font-bold text-fern bg-white px-2 py-0.5 rounded border border-sage/30">+10 GXC</span>
                </div>
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-parchment/40 border border-sage/20">
                  <span className="text-canopy font-medium">Join Community Reforestation Drive</span>
                  <span className="font-bold text-fern bg-white px-2 py-0.5 rounded border border-sage/30">+25 GXC</span>
                </div>
              </div>
            </div>
          </motion.section>

          {/* RIGHT: Transaction history */}
          <motion.section
            variants={reduced ? undefined : staggerItem}
            aria-label="Transaction history"
            className="lg:col-span-7"
          >
            <div className="rounded-2xl border border-sage/40 bg-white/80 backdrop-blur-sm shadow-card p-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                <h2 className="font-display text-xl font-semibold text-canopy">Append-Only Ledger</h2>
                <div className="flex gap-2 flex-wrap">
                  {FILTERS.map((f) => (
                    <FilterPill key={f} label={f} active={filter === f} reduced={!!reduced} onClick={() => setFilter(f)} />
                  ))}
                </div>
              </div>
              <TransactionTimeline transactions={history} filter={filter} loading={loadingHist} />
            </div>
          </motion.section>
        </motion.div>
      )}

      {/* ── TAB 2: Eco Marketplace ── */}
      {activeTab === "Eco Marketplace" && (
        <motion.div variants={reduced ? undefined : fadeUp} className="space-y-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="font-display text-2xl font-bold text-canopy">Eco Marketplace</h2>
              <p className="text-sm text-canopy/60 font-sans">Redeem your verified GXC tokens for nursery vouchers, tree certificates, and IoT sensors.</p>
            </div>
            
            {/* Category Filter Pills */}
            <div className="flex gap-2 flex-wrap">
              {["All", "Voucher", "Certificate", "Hardware", "Offset"].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={[
                    "px-3 py-1 rounded-full text-xs font-semibold font-sans transition-all",
                    selectedCategory === cat
                      ? "bg-fern text-parchment shadow-sm"
                      : "bg-sage/20 text-canopy hover:bg-sage/40"
                  ].join(" ")}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {loadingMarket ? (
            <div className="p-12 text-center text-canopy/60 font-sans">Loading marketplace catalog...</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {items
                .filter((item) => selectedCategory === "All" || item.category.toLowerCase().includes(selectedCategory.toLowerCase()))
                .map((item) => {
                  const canAfford = balance >= item.points_cost;
                  const isRedeeming = redeemingId === item.id;
                  return (
                    <div key={item.id} className="rounded-2xl border border-sage/40 bg-white/90 shadow-card p-5 flex flex-col justify-between hover:shadow-lg transition-shadow">
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-fern/10 text-fern font-sans uppercase tracking-wider">{item.category}</span>
                          <span className="text-xs font-sans text-canopy/50">{item.stock} remaining</span>
                        </div>
                        <h3 className="font-display text-lg font-bold text-canopy mb-2">{item.title}</h3>
                        <p className="text-xs text-canopy/70 font-sans line-clamp-3 mb-4">{item.description}</p>
                      </div>

                      <div className="pt-4 border-t border-sage/20 flex items-center justify-between">
                        <div className="flex flex-col">
                          <span className="text-[10px] text-canopy/50 uppercase tracking-wider font-sans">Cost</span>
                          <span className="font-display text-xl font-bold text-canopy">{item.points_cost} GXC</span>
                        </div>

                        <button
                          onClick={() => handleRedeem(item)}
                          disabled={!canAfford || item.stock <= 0 || isRedeeming}
                          className={[
                            "px-4 py-2 rounded-xl text-xs font-bold font-sans transition-colors focus:outline-none",
                            canAfford && item.stock > 0
                              ? "bg-fern text-parchment hover:bg-fern/90 shadow-sm"
                              : "bg-sage/20 text-canopy/40 cursor-not-allowed",
                          ].join(" ")}
                        >
                          {isRedeeming ? "Redeeming..." : item.stock <= 0 ? "Out of Stock" : !canAfford ? "Low Balance" : "Redeem"}
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}

          {/* User Redemptions History with 1-click Copy */}
          {myRedemptions.length > 0 && (
            <div className="mt-10 rounded-2xl border border-sage/40 bg-white/80 p-6">
              <h3 className="font-display text-lg font-bold text-canopy mb-4">My Claimed Vouchers ({myRedemptions.length})</h3>
              <div className="space-y-3">
                {myRedemptions.map((r) => (
                  <div key={r.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl bg-parchment/40 border border-sage/20 font-sans text-sm gap-3">
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-canopy">Voucher Code: </span>
                      <span className="font-mono bg-white px-2.5 py-1 rounded border border-sage/30 text-fern font-bold">{r.voucher_code}</span>
                      <button
                        onClick={() => copyToClipboard(r.voucher_code)}
                        className="px-2.5 py-1 rounded-lg bg-fern/10 hover:bg-fern/20 text-fern text-xs font-bold transition-colors"
                      >
                        {copiedCode === r.voucher_code ? "✓ Copied!" : "Copy Code"}
                      </button>
                    </div>
                    <div className="text-right text-xs text-canopy/60">
                      <span>Spent: {r.points_spent} GXC</span> • <span>{new Date(r.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Claimed Voucher Modal Popup with Copy Button */}
          {claimedVoucher && (
            <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl border border-sage/40 text-center space-y-4">
                <div className="w-16 h-16 bg-fern/10 rounded-full flex items-center justify-center mx-auto text-fern text-2xl font-bold">✓</div>
                <h3 className="font-display text-2xl font-bold text-canopy">Voucher Claimed!</h3>
                <p className="text-sm font-sans text-canopy/70">You successfully redeemed <strong>{claimedVoucher.title}</strong>.</p>
                <div className="p-4 bg-parchment/60 rounded-2xl border border-sage/30 font-mono text-xl font-bold text-fern tracking-wider flex items-center justify-center gap-3">
                  <span>{claimedVoucher.code}</span>
                  <button
                    onClick={() => copyToClipboard(claimedVoucher.code)}
                    className="px-3 py-1 text-xs bg-white border border-sage/30 rounded-lg text-canopy hover:bg-sage/10 font-sans"
                  >
                    {copiedCode === claimedVoucher.code ? "✓ Copied!" : "Copy"}
                  </button>
                </div>
                <p className="text-xs text-canopy/50 font-sans">Save this code. You can also view it anytime under My Claimed Vouchers.</p>
                <button
                  onClick={() => setClaimedVoucher(null)}
                  className="w-full py-3 bg-fern text-parchment font-bold rounded-xl font-sans hover:bg-fern/90 transition-colors"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* ── TAB 3: Crypto Wallet Payout ── */}
      {activeTab === "Crypto Wallet Payout" && (
        <motion.div variants={reduced ? undefined : fadeUp} className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left: Request Form */}
          <div className="lg:col-span-6 rounded-2xl border border-sage/40 bg-white/90 shadow-card p-6 space-y-6">
            <div>
              <h2 className="font-display text-2xl font-bold text-canopy">Web3 Crypto Payout</h2>
              <p className="text-sm text-canopy/60 font-sans mt-1">Withdraw GXC tokens to your external Ethereum or Polygon wallet (Min 50 GXC).</p>
            </div>

            <form onSubmit={handlePayoutSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-canopy/80 font-sans mb-1 uppercase tracking-wider">Web3 Wallet Address</label>
                <input
                  type="text"
                  placeholder="0x71C7656EC7ab88b098defB751B7401B5f6d8976F"
                  value={walletAddr}
                  onChange={(e) => setWalletAddr(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-sage/40 bg-parchment/20 text-canopy font-mono text-sm focus:outline-none focus:ring-2 focus:ring-fern/50"
                  required
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-canopy/80 font-sans uppercase tracking-wider">Payout Amount (GXC)</label>
                  <span className="text-[11px] text-canopy/50 font-sans">Available: {balance} GXC</span>
                </div>
                <input
                  type="number"
                  min={50}
                  max={balance}
                  value={payoutAmount}
                  onChange={(e) => setPayoutAmount(Number(e.target.value))}
                  className="w-full px-4 py-3 rounded-xl border border-sage/40 bg-parchment/20 text-canopy font-sans text-sm focus:outline-none focus:ring-2 focus:ring-fern/50"
                  required
                />
                {/* Preset Amount Pills */}
                <div className="flex gap-2 mt-2">
                  {[50, 100, 250, balance].map((amt, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setPayoutAmount(Math.max(50, amt))}
                      className="px-2.5 py-1 rounded-lg bg-sage/15 hover:bg-sage/30 text-canopy text-xs font-semibold font-sans transition-colors"
                    >
                      {amt === balance ? "Max" : `${amt} GXC`}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={submittingPayout || balance < 50}
                className={[
                  "w-full py-3.5 rounded-xl font-bold font-sans text-sm transition-colors focus:outline-none",
                  balance >= 50 && !submittingPayout
                    ? "bg-fern text-parchment hover:bg-fern/90 shadow-md"
                    : "bg-sage/20 text-canopy/40 cursor-not-allowed",
                ].join(" ")}
              >
                {submittingPayout ? "Submitting Request..." : "Request Payout"}
              </button>
            </form>
          </div>

          {/* Right: Payout History */}
          <div className="lg:col-span-6 rounded-2xl border border-sage/40 bg-white/90 shadow-card p-6 space-y-4">
            <h3 className="font-display text-xl font-bold text-canopy">Withdrawal Request History</h3>
            {loadingPayouts ? (
              <p className="text-sm font-sans text-canopy/60">Loading payout records...</p>
            ) : payouts.length === 0 ? (
              <p className="text-sm font-sans text-canopy/50 py-8 text-center border border-dashed border-sage/30 rounded-xl">No withdrawal requests submitted yet.</p>
            ) : (
              <div className="space-y-3">
                {payouts.map((p) => (
                  <div key={p.id} className="p-4 rounded-xl bg-parchment/30 border border-sage/20 font-sans space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-canopy text-base">{p.amount_gxc} GXC</span>
                      <span className={[
                        "px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider",
                        p.status === "COMPLETED" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                      ].join(" ")}>{p.status}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs font-mono text-canopy/70">
                      <span className="truncate max-w-[200px] sm:max-w-[260px]">{p.wallet_address}</span>
                      <button
                        onClick={() => copyToClipboard(p.wallet_address)}
                        className="px-2 py-0.5 rounded bg-sage/20 hover:bg-sage/30 text-canopy text-[10px] font-sans font-bold"
                      >
                        {copiedCode === p.wallet_address ? "Copied" : "Copy"}
                      </button>
                    </div>
                    {p.tx_hash && (
                      <a
                        href={`https://polygonscan.com/tx/${p.tx_hash}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] text-fern font-semibold hover:underline"
                      >
                        View on Polygonscan ↗
                      </a>
                    )}
                    <span className="text-[11px] text-canopy/40 block">{new Date(p.created_at).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* Pending Org Payment Approval Modal */}
      <PendingPaymentApprovalModal
        requests={pendingOrgRequests}
        isOpen={isApprovalModalOpen}
        onClose={() => setIsApprovalModalOpen(false)}
        onProcessed={() => {
          setIsApprovalModalOpen(false);
          fetchBalance();
          fetchHistory();
          fetchPendingOrgRequests();
        }}
      />
    </motion.div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────
interface StatCellProps {
  label: string;
  value: string;
}

function StatCell({ label, value }: StatCellProps) {
  return (
    <div className="rounded-xl bg-parchment/40 border border-sage/20 px-4 py-3">
      <dt className="text-xs text-canopy/50 font-sans mb-0.5">{label}</dt>
      <dd className="text-sm font-semibold text-canopy font-sans">{value}</dd>
    </div>
  );
}

interface FilterPillProps {
  label: string;
  active: boolean;
  reduced: boolean;
  onClick: () => void;
}

function FilterPill({ label, active, reduced, onClick }: FilterPillProps) {
  return (
    <motion.button
      whileTap={reduced ? undefined : { scale: 0.97 }}
      onClick={onClick}
      aria-pressed={active}
      className={[
        "px-3 py-1 rounded-full text-xs font-medium font-sans transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-fern/50",
        active
          ? "bg-fern text-parchment shadow-sm"
          : "bg-sage/20 text-canopy hover:bg-sage/40",
      ].join(" ")}
    >
      {label}
    </motion.button>
  );
}

