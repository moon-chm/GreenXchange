"use client";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  LayoutDashboard, Leaf, Sparkles, Coins, Users, Newspaper, LogOut, ChevronRight
} from "lucide-react";
import LeafIcon from "@/components/icons/LeafIcon";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/",                icon: LayoutDashboard, label: "Dashboard" },
  { href: "/plants",          icon: Leaf,            label: "My Plants" },
  { href: "/recommendations", icon: Sparkles,        label: "Recommendations" },
  { href: "/rewards",         icon: Coins,           label: "Rewards" },
  { href: "/drives",          icon: Users,           label: "Community" },
  { href: "/news",            icon: Newspaper,       label: "News Feed" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  return (
    <aside className="hidden lg:flex flex-col w-60 min-h-screen bg-canopy fixed left-0 top-0 z-40">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 py-6 border-b border-white/10">
        <div className="w-8 h-8 rounded-lg bg-fern flex items-center justify-center">
          <LeafIcon size={18} className="text-parchment" />
        </div>
        <span className="font-display text-lg font-semibold text-parchment tracking-tight">
          GreenXchange
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-3 space-y-0.5">
        {navItems.map(({ href, icon: Icon, label }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link key={href} href={href}>
              <motion.div
                whileHover={{ x: 2 }}
                transition={{ duration: 0.15 }}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer",
                  active
                    ? "bg-forest/80 text-parchment border-l-2 border-fern pl-[10px]"
                    : "text-parchment/60 hover:text-parchment hover:bg-forest/40"
                )}
              >
                <Icon size={17} />
                <span>{label}</span>
                {active && (
                  <motion.span
                    layoutId="sidebar-active"
                    className="ml-auto"
                    transition={{ duration: 0.2 }}
                  >
                    <ChevronRight size={14} className="text-fern" />
                  </motion.span>
                )}
              </motion.div>
            </Link>
          );
        })}
      </nav>

      {/* User footer */}
      <div className="p-4 border-t border-white/10">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-full bg-fern/40 flex items-center justify-center text-parchment text-xs font-semibold flex-shrink-0">
            {user?.name?.[0]?.toUpperCase() ?? "U"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-parchment text-sm font-medium truncate">{user?.name ?? "User"}</p>
            <p className="text-parchment/40 text-xs truncate">{user?.email}</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-parchment/60 hover:text-parchment hover:bg-forest/40 text-sm transition-colors"
        >
          <LogOut size={15} />
          Sign out
        </button>
      </div>
    </aside>
  );
}
