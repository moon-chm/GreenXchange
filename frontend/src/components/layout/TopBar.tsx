"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { Menu, X, LayoutDashboard, Leaf, Sparkles, Coins, Users, Newspaper, LogOut } from "lucide-react";
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

export default function TopBar() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { user, logout } = useAuth();

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <header className="lg:hidden fixed top-0 left-0 right-0 z-50 h-14 bg-canopy flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-fern flex items-center justify-center">
            <LeafIcon size={15} className="text-parchment" />
          </div>
          <span className="font-display text-base font-semibold text-parchment">GreenXchange</span>
        </div>
        <Dialog.Trigger asChild><button
          aria-label="Open navigation menu"
          className="w-11 h-11 flex items-center justify-center rounded-lg text-parchment/70 hover:text-parchment hover:bg-forest/50 transition-colors"
        >
          <Menu size={20} />
        </button></Dialog.Trigger>
      </header>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-canopy/60 z-50" />
        <Dialog.Content aria-describedby={undefined} className="fixed top-0 left-0 h-dvh w-72 max-w-[90vw] bg-canopy z-50 flex flex-col overflow-y-auto">
          <Dialog.Title className="sr-only">Navigation menu</Dialog.Title>
              <div className="flex items-center justify-between px-5 py-5 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-fern flex items-center justify-center">
                    <LeafIcon size={15} className="text-parchment" />
                  </div>
                  <span className="font-display text-base font-semibold text-parchment">GreenXchange</span>
                </div>
                <Dialog.Close asChild><button aria-label="Close navigation menu" className="min-h-11 min-w-11 flex items-center justify-center text-parchment/60 hover:text-parchment">
                  <X size={20} />
                </button></Dialog.Close>
              </div>

              <nav className="flex-1 py-4 px-3 space-y-0.5">
                {navItems.map(({ href, icon: Icon, label }) => {
                  const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
                  return (
                    <Link key={href} href={href} aria-current={active ? "page" : undefined} onClick={() => setOpen(false)}>
                      <div className={cn(
                        "flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-colors",
                        active
                          ? "bg-forest/80 text-parchment border-l-2 border-fern pl-[10px]"
                          : "text-parchment/60 hover:text-parchment hover:bg-forest/40"
                      )}>
                        <Icon size={17} />
                        {label}
                      </div>
                    </Link>
                  );
                })}
              </nav>

              <div className="p-4 border-t border-white/10">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 rounded-full bg-fern/40 flex items-center justify-center text-parchment text-xs font-semibold">
                    {user?.name?.[0]?.toUpperCase() ?? "U"}
                  </div>
                  <div className="min-w-0">
                    <p className="text-parchment text-sm font-medium truncate">{user?.name}</p>
                    <p className="text-parchment/40 text-xs truncate">{user?.email}</p>
                  </div>
                </div>
                <button
                  onClick={() => { logout(); setOpen(false); }}
                  className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-parchment/60 hover:text-parchment hover:bg-forest/40 text-sm transition-colors"
                >
                  <LogOut size={15} /> Sign out
                </button>
              </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
