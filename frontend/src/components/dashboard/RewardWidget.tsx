"use client";

import { useReducedMotion, motion, useSpring, useMotionValue, useTransform } from "framer-motion";
import { useEffect } from "react";
import Link from "next/link";
import { Coins, TrendingUp, Leaf, Users, ArrowRight, ShoppingBag } from "lucide-react";
import StaleIndicator from "@/components/shared/StaleIndicator";
import { fadeUp } from "@/lib/motion";

interface Transaction {
  id: string;
  type: string;
  points: number;
  description: string;
  created_at: string;
}

interface RewardData {
  balance: number;
  level: number;
  next_level_threshold: number;
  recent_transactions: Transaction[];
}

interface RewardWidgetProps {
  stale: boolean;
  data: RewardData | null;
  loading?: boolean;
}

const RADIUS = 48;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const txIcon: Record<string, React.ReactNode> = {
  plant_registered: <Leaf size={12} />,
  drive_joined: <Users size={12} />,
  default: <TrendingUp size={12} />,
};

function txColor(points: number) {
  return points >= 0 ? "text-fern" : "text-red-500";
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function Skeleton() {
  return (
    <div className="rounded-2xl border border-sage/40 bg-white/80 backdrop-blur-sm shadow-card p-6 flex flex-col items-center gap-4">
      <div className="skeleton-shimmer rounded-full w-32 h-32" />
      <div className="skeleton-shimmer rounded-xl h-4 w-24" />
      <div className="w-full space-y-2 mt-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="skeleton-shimmer rounded-xl h-10 w-full" />
        ))}
      </div>
    </div>
  );
}

export default function RewardWidget({
  stale,
  data,
  loading = false,
}: RewardWidgetProps) {
  const shouldReduce = useReducedMotion();

  const balance = data?.balance ?? 0;
  const threshold = data?.next_level_threshold ?? 1000;
  const level = data?.level ?? 1;
  const pct = Math.min(balance / threshold, 1);

  const mv = useMotionValue(CIRCUMFERENCE);
  const spring = useSpring(mv, { duration: 1400, bounce: 0 });
  const strokeDashoffset = useTransform(spring, (v) => v);

  useEffect(() => {
    if (shouldReduce) {
      mv.set(CIRCUMFERENCE * (1 - pct));
    } else {
      mv.set(CIRCUMFERENCE);
      const timeout = setTimeout(() => {
        spring.set(CIRCUMFERENCE * (1 - pct));
      }, 200);
      return () => clearTimeout(timeout);
    }
  }, [pct, mv, spring, shouldReduce]);

  if (loading) return <Skeleton />;

  const transactions = data?.recent_transactions?.slice(0, 3) ?? [];

  return (
    <motion.div
      variants={fadeUp}
      initial={shouldReduce ? "visible" : "hidden"}
      animate="visible"
      className="rounded-2xl border border-sage/40 bg-white/80 backdrop-blur-sm shadow-card p-6 flex flex-col gap-4 h-full"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-fern/10 text-fern flex items-center justify-center">
            <Coins size={18} />
          </div>
          <div>
            <h2 className="font-display text-lg font-semibold text-canopy leading-tight">
              GXC Wallet & Rewards
            </h2>
            <p className="text-[10px] text-canopy/50">Carbon Token Balance</p>
          </div>
        </div>
        {stale && (
          <span className="flex items-center gap-1 text-xs font-medium bg-amber-500/10 text-amber-700 px-2 py-1 rounded-lg border border-amber-400/30">
            Stale
          </span>
        )}
      </div>

      {stale && !data && <StaleIndicator label="Rewards data unavailable" />}

      {/* Ring */}
      <div className="flex flex-col items-center gap-1 py-1">
        <div className="relative w-32 h-32">
          <svg
            width="128"
            height="128"
            viewBox="0 0 120 120"
            className="-rotate-90"
            aria-hidden="true"
          >
            <circle
              cx="60"
              cy="60"
              r={RADIUS}
              fill="none"
              stroke="rgba(163,177,138,0.25)"
              strokeWidth="8"
            />
            <motion.circle
              cx="60"
              cy="60"
              r={RADIUS}
              fill="none"
              stroke="#588157"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              style={{ strokeDashoffset }}
            />
          </svg>

          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-display text-3xl font-bold text-canopy leading-none">
              {balance.toLocaleString()}
            </span>
            <span className="text-[10px] text-canopy/50 uppercase tracking-widest mt-0.5 font-semibold">
              GXC PTS
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 mt-1 bg-fern/10 border border-fern/20 px-3 py-1 rounded-full text-xs font-semibold text-fern">
          <span>Level {level} Guardian</span>
          <span className="text-canopy/40 font-normal">({Math.round(pct * 100)}%)</span>
        </div>
        <p className="text-[10px] text-canopy/50 font-sans mt-0.5">
          {(threshold - balance).toLocaleString()} pts to next tier
        </p>
      </div>

      {/* Redeem Store CTA */}
      <Link
        href="/rewards"
        className="flex items-center justify-center gap-2 bg-fern hover:bg-forest text-parchment py-2.5 rounded-xl text-xs font-semibold transition-all shadow-md shadow-fern/20"
      >
        <ShoppingBag size={14} />
        Redeem Rewards & Cashout
      </Link>

      {/* Divider */}
      <div className="border-t border-sage/20" />

      {/* Recent transactions */}
      <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold text-canopy/50 uppercase tracking-wider">
          Recent Activity
        </p>
        {transactions.length === 0 ? (
          <p className="text-sm text-canopy/40 text-center py-2">
            No transactions yet
          </p>
        ) : (
          transactions.map((tx) => (
            <div
              key={tx.id}
              className="flex items-center justify-between gap-2 bg-sage/5 hover:bg-sage/10 rounded-xl px-3 py-2 transition-colors"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="flex-shrink-0 w-6 h-6 rounded-lg bg-fern/10 text-fern flex items-center justify-center">
                  {txIcon[tx.type] ?? txIcon.default}
                </span>
                <span className="text-xs text-canopy/80 truncate font-medium">
                  {tx.description}
                </span>
              </div>
              <div className="flex flex-col items-end flex-shrink-0">
                <span
                  className={`text-xs font-bold font-mono ${txColor(tx.points)}`}
                >
                  {tx.points >= 0 ? "+" : ""}
                  {tx.points}
                </span>
                <span className="text-[10px] text-canopy/30">
                  {relativeTime(tx.created_at)}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </motion.div>
  );
}

