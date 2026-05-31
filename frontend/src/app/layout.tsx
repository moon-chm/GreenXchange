import type { Metadata } from "next";
import { Inter, Fraunces, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import SmoothScrolling from "@/components/shared/SmoothScrolling";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
});

export const metadata: Metadata = {
  title: "GreenXchange — Environmental Intelligence Platform",
  description: "Track your plants, earn rewards, and contribute to urban greening with AI-powered insights.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${fraunces.variable} ${jetbrainsMono.variable}`}>
      <body className="bg-parchment text-canopy antialiased">
        <AuthProvider>
          <SmoothScrolling>{children}</SmoothScrolling>
        </AuthProvider>
      </body>
    </html>
  );
}

