"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Leaf, Sparkles, Users, Newspaper } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/",                icon: LayoutDashboard, label: "Home" },
  { href: "/plants",          icon: Leaf,            label: "Plants" },
  { href: "/recommendations", icon: Sparkles,        label: "Tips" },
  { href: "/drives",          icon: Users,           label: "Drives" },
  { href: "/news",            icon: Newspaper,       label: "News" },
];

export default function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 h-16 bg-canopy border-t border-white/10 flex items-center justify-around px-2 lg:hidden xs:hidden sm:flex" style={{ display: "none" }}>
      {tabs.map(({ href, icon: Icon, label }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link key={href} href={href} className="flex flex-col items-center gap-1 flex-1 py-2">
            <Icon
              size={20}
              className={cn(active ? "text-fern" : "text-parchment/50")}
              strokeWidth={active ? 2.5 : 1.8}
            />
            <span className={cn("text-[10px] font-medium", active ? "text-fern" : "text-parchment/50")}>
              {label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
