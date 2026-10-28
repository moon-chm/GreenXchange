"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Leaf, Sparkles, Users, Newspaper, Coins } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/",                icon: LayoutDashboard, label: "Home" },
  { href: "/plants",          icon: Leaf,            label: "Plants" },
  { href: "/recommendations", icon: Sparkles,        label: "Tips" },
  { href: "/rewards",         icon: Coins,           label: "Rewards" },
  { href: "/drives",          icon: Users,           label: "Drives" },
  { href: "/news",            icon: Newspaper,       label: "News" },
];

export default function MobileNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Main navigation" className="fixed bottom-0 left-0 right-0 z-40 bg-canopy border-t border-white/10 flex items-center justify-around px-1 pb-[env(safe-area-inset-bottom)] lg:hidden">
      {tabs.map(({ href, icon: Icon, label }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link key={href} href={href} aria-current={active ? "page" : undefined} className="flex min-h-16 min-w-0 flex-col items-center justify-center gap-1 flex-1 py-2 rounded-lg">
            <Icon
              size={20}
              className={cn(active ? "text-white" : "text-parchment/70")}
              strokeWidth={active ? 2.5 : 1.8}
            />
            <span className={cn("text-[10px] font-medium", active ? "text-white" : "text-parchment/70")}>
              {label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
