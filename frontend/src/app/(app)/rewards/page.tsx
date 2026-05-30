"use client";

import { useState, useEffect, useCallback } from "react";
import { useReducedMotion, motion } from "framer-motion";
import api from "@/lib/axios";
import { fadeUp, staggerContainer, staggerItem } from "@/lib/motion";
import RewardRing from "@/components/rewards/RewardRing";
import TransactionTimeline, {
  Transaction,
} from "@/components/rewards/TransactionTimeline";

// ─── Filter pills config ──────────────────────────────────────────────────────
const FILTERS = ["All", "Plant Verified", "Bonus"] as const;
type Filter = (typeof FILTERS)[number];

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function RewardsPage() {
  const reduced = useReducedMotion();

  // ── State ──────────────────────────────────────────────────────────────────
  const [balance, setBalance]         = useState<number>(0);
  const [history, setHistory]         = useState<Transaction[]>([]);
  const [loadingBal, setLoadingBal]   = useState(true);
  const [loadingHist, setLoadingHist] = useState(true);
  const [error, setError]             = useState<string | null>(null);
  const [filter, setFilter]           = useState<Filter>("All");

  // ── Data fetching ──────────────────────────────────────────────────────────
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

  useEffect(() => {
    fetchBalance();
    fetchHistory();
  }, [fetchBalance, fetchHistory]);

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
        className="mb-8"
      >
        <h1 className="font-display text-4xl md:text-5xl font-bold text-canopy leading-tight">
          Reward Ledger
        </h1>
        <p className="mt-2 text-canopy/60 font-sans text-sm">
          Track your GXC Points and transaction history
        </p>
      </motion.header>

      {/* ── Error banner ── */}
      {error && (
        <motion.div
          variants={reduced ? undefined : fadeUp}
          role="alert"
          className="mb-6 rounded-xl border border-fern/30 bg-fern/10 px-4 py-3 text-sm text-fern font-sans"
        >
          {error}
        </motion.div>
      )}

      {/* ── Two-column desktop layout ── */}
      <motion.div
        variants={reduced ? undefined : staggerContainer}
        className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start"
      >
        {/* ── LEFT: Hero ring + tier progress ── col-span-5 ── */}
        <motion.section
          variants={reduced ? undefined : staggerItem}
          aria-label="Reward ring and tier progress"
          className="lg:col-span-5"
        >
          <div className="rounded-2xl border border-sage/40 bg-white/80 backdrop-blur-sm shadow-card p-6 flex flex-col items-center gap-8">
            {/* Animated ring */}
            <RewardRing points={balance} loading={loadingBal} />

            {/* Stats row */}
            {!loadingBal && (
              <dl className="w-full grid grid-cols-2 gap-3">
                <StatCell
                  label="Current Balance"
                  value={`${balance.toLocaleString()} pts`}
                />
                <StatCell
                  label="Transactions"
                  value={loadingHist ? "—" : String(history.length)}
                />
              </dl>
            )}
          </div>
        </motion.section>

        {/* ── RIGHT: Transaction history ── col-span-7 ── */}
        <motion.section
          variants={reduced ? undefined : staggerItem}
          aria-label="Transaction history"
          className="lg:col-span-7"
        >
          <div className="rounded-2xl border border-sage/40 bg-white/80 backdrop-blur-sm shadow-card p-6">
            {/* Section header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
              <h2 className="font-display text-xl font-semibold text-canopy">
                Transaction History
              </h2>

              {/* Filter pills */}
              <div
                className="flex gap-2 flex-wrap"
                role="group"
                aria-label="Filter transactions"
              >
                {FILTERS.map((f) => (
                  <FilterPill
                    key={f}
                    label={f}
                    active={filter === f}
                    reduced={!!reduced}
                    onClick={() => setFilter(f)}
                  />
                ))}
              </div>
            </div>

            {/* Timeline */}
            <TransactionTimeline
              transactions={history}
              filter={filter}
              loading={loadingHist}
            />
          </div>
        </motion.section>
      </motion.div>
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
