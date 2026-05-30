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
        <main className="lg:pl-60 pt-14 lg:pt-0">
          <div className="max-w-7xl mx-auto p-4 lg:p-6 pb-20 lg:pb-8">
            {children}
          </div>
        </main>
        <MobileNav />
      </div>
    </ProtectedRoute>
  );
}
