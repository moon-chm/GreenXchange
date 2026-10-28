"use client";
import Sidebar from "@/components/layout/Sidebar";
import TopBar from "@/components/layout/TopBar";
import MobileNav from "@/components/layout/MobileNav";
import ProtectedRoute from "@/components/ProtectedRoute";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-parchment">
        <Sidebar />
        <TopBar />
        <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:bg-white focus:p-3 focus:rounded-lg">Skip to content</a>
        <main id="main-content" tabIndex={-1} className="lg:pl-60 pt-14 lg:pt-0">
          <div className="max-w-7xl mx-auto p-4 lg:p-6 pb-[calc(5rem+env(safe-area-inset-bottom))] lg:pb-8">
            {children}
          </div>
        </main>
        <MobileNav />
      </div>
    </ProtectedRoute>
  );
}
